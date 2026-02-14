import stripe
from stripe import SignatureVerificationError
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Subscription, Plan
from django.contrib.auth.models import User
from datetime import datetime, timedelta
from django.utils import timezone

@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    event = None

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        # Invalid payload
        return HttpResponse(status=400)
    except SignatureVerificationError as e:
        # Invalid signature
        return HttpResponse(status=400)

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        handle_checkout_session(event)
    elif event['type'] == 'customer.subscription.updated':
        handle_subscription_updated(event)
    elif event['type'] == 'customer.subscription.deleted':
        handle_subscription_deleted(event)
    elif event['type'] == 'invoice.payment_failed':
        handle_payment_failed(event)

    return HttpResponse(status=200)

def handle_checkout_session(event):
    session = event['data']['object']
    user_id = session.get('client_reference_id')
    stripe_subscription_id = session.get('subscription')
    plan_id = session.get('metadata', {}).get('plan_id')

    if not all([user_id, plan_id, stripe_subscription_id]):
        print(f"Webhook Error: Missing user_id, plan_id, or stripe_subscription_id in session: {session}")
        return

    try:
        user = User.objects.get(id=user_id)
        plan = Plan.objects.get(id=plan_id)
    except (User.DoesNotExist, Plan.DoesNotExist) as e:
        print(f"Webhook Error: {e}")
        return

    # Get subscription data from Stripe to ensure we have the correct dates
    try:
        # PERFORMANCE NOTE: This is a blocking, synchronous network call.
        # In a high-traffic environment, this could block the server thread.
        # For production, consider making the webhook view async and using an
        # async Stripe library or running this call in a separate thread.
        stripe.api_key = settings.STRIPE_SECRET_KEY
        stripe_sub = stripe.Subscription.retrieve(stripe_subscription_id)
        start_date = datetime.fromtimestamp(stripe_sub.current_period_start, tz=timezone.utc)
        end_date = datetime.fromtimestamp(stripe_sub.current_period_end, tz=timezone.utc)
    except stripe.StripeError as e:
        print(f"Stripe API error on subscription retrieve: {e}")
        # Fallback to calculating dates manually, which is less accurate
        start_date = timezone.now()
        if plan.interval == 'monthly':
            end_date = start_date + timedelta(days=30)
        else:  # yearly
            try:
                end_date = start_date.replace(year=start_date.year + 1)
            except ValueError:
                # Handle leap year case where Feb 29 doesn't exist in the next year
                end_date = start_date.replace(year=start_date.year + 1, day=28)

    try:
        with transaction.atomic():
            # Check if a subscription with this ID already exists
            if Subscription.objects.filter(stripe_subscription_id=stripe_subscription_id).exists():
                print(f"Webhook Info: Subscription {stripe_subscription_id} already exists. Skipping creation.")
                return

            # Cancel existing active subscriptions for this user to prevent duplicates
            Subscription.objects.filter(user=user, status='active').update(status='canceled')

            # Create a new subscription
            Subscription.objects.create(
                user=user,
                plan=plan,
                start_date=start_date,
                end_date=end_date,
                status='active',
                stripe_subscription_id=stripe_subscription_id,
            )
        print(f"Subscription created for user {user.username} with plan {plan.name}")
    except Exception as e:
        print(f"Webhook Error: Database transaction failed for user {user.pk} on checkout: {e}")
        # Optionally, notify developers about the failure
        # so they can manually inspect the user's account state.
        return



def handle_subscription_updated(event):
    subscription = event['data']['object']
    stripe_subscription_id = subscription.get('id')
    
    try:
        with transaction.atomic():
            sub = Subscription.objects.filter(stripe_subscription_id=stripe_subscription_id).first()

            if not sub:
                print(f"Webhook Error: Received subscription.updated for an unknown subscription: {stripe_subscription_id}")
                return

            fields_to_update = []

            # Update period end date
            new_end_date = datetime.fromtimestamp(subscription.current_period_end, tz=timezone.utc)
            if sub.end_date != new_end_date:
                sub.end_date = new_end_date
                fields_to_update.append('end_date')

            # See: https://stripe.com/docs/billing/subscriptions/lifecycle
            stripe_status = subscription.get('status')
            new_status = sub.status

            if stripe_status == 'active':
                new_status = 'active'
            elif stripe_status == 'past_due':
                new_status = 'past_due'
            elif stripe_status in ['unpaid', 'incomplete_expired']:  # unpaid is a terminal state
                new_status = 'expired'
            elif stripe_status == 'canceled':
                # If canceled, Stripe provides `cancel_at_period_end`
                if subscription.get('cancel_at_period_end', False):
                    # The subscription is set to cancel at the end of the period.
                    # It remains active until then.
                    new_status = 'pending_cancellation'
                else:
                    # The subscription was canceled immediately.
                    new_status = 'canceled'
                    if sub.end_date > timezone.now():
                        sub.end_date = timezone.now()
                        fields_to_update.append('end_date')

            if sub.status != new_status:
                sub.status = new_status
                fields_to_update.append('status')

            if fields_to_update:
                sub.save(update_fields=fields_to_update)
                print(f"Subscription {sub.pk} for user {sub.user.username} updated. Changed fields: {fields_to_update}")
            else:
                print(f"Subscription {sub.pk} for user {sub.user.username} received update, but no changes were needed.")
    except Exception as e:
        print(f"Webhook Error: Database transaction failed for subscription {stripe_subscription_id} on update: {e}")

def handle_subscription_deleted(event):
    subscription = event['data']['object']
    stripe_subscription_id = subscription.get('id')
    sub = Subscription.objects.filter(stripe_subscription_id=stripe_subscription_id).first()

    if not sub:
        # This can happen if the user deletes their account from our side first.
        print(f"Webhook Info: Received subscription.deleted for an already deleted/unknown subscription: {stripe_subscription_id}")
        return
    
    sub.status = 'canceled'
    sub.end_date = timezone.now()
    try:
        with transaction.atomic():
            sub.save(update_fields=['status', 'end_date'])
        print(f"Subscription {sub.pk} for user {sub.user.username} canceled via webhook.")
    except Exception as e:
        print(f"Webhook Error: Database transaction failed for subscription {sub.pk} on delete: {e}")

def handle_payment_failed(event):
    invoice = event['data']['object']
    stripe_subscription_id = invoice.get('subscription')
    if not stripe_subscription_id:
        return # Not a subscription payment

    try:
        with transaction.atomic():
            sub = Subscription.objects.filter(stripe_subscription_id=stripe_subscription_id).first()
            if not sub:
                return

            # Mark the subscription as past_due. Stripe will attempt retries.
            # If all retries fail, a `customer.subscription.updated` with `status: 'unpaid'`
            # or `customer.subscription.deleted` will be sent.
            sub.status = 'past_due'
            sub.save(update_fields=['status'])
            print(f"Subscription {sub.pk} for user {sub.user.username} marked as past_due due to payment failure.")
    except Exception as e:
        print(f"Webhook Error: Database transaction failed for subscription {stripe_subscription_id} on payment failure: {e}")