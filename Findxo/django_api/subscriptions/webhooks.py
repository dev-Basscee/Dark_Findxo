import json
import hmac
import hashlib
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from .models import UserSubscription, SubscriptionPlan
from datetime import datetime, timedelta
from django.utils import timezone

@csrf_exempt
def paystack_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_X_PAYSTACK_SIGNATURE')

    if not sig_header:
        return HttpResponse(status=400)

    # Verify signature
    paystack_secret_key = settings.PAYSTACK_SECRET_KEY
    hash = hmac.new(paystack_secret_key.encode('utf-8'), payload, hashlib.sha512).hexdigest()

    if hash != sig_header:
        return HttpResponse(status=400)

    event_data = json.loads(payload)
    event_type = event_data.get('event')

    if event_type == 'charge.success':
        handle_charge_success(event_data)
    elif event_type == 'subscription.create':
        handle_subscription_create(event_data)
    elif event_type == 'subscription.disable':
        handle_subscription_disable(event_data)
    elif event_type == 'invoice.payment_failed':
        handle_payment_failed(event_data)

    return HttpResponse(status=200)

def handle_charge_success(event):
    data = event['data']
    metadata = data.get('metadata', {})
    user_id = metadata.get('user_id')
    plan_id = metadata.get('plan_id')
    billing_period = metadata.get('billing_period', 'monthly')
    
    paystack_subscription_id = data.get('subscription', {}).get('subscription_code')
    customer_code = data.get('customer', {}).get('customer_code')

    if not all([user_id, plan_id]):
        # This might be a recurring charge where metadata isn't present in the same way
        # In that case, we should identify by customer or subscription_code
        if paystack_subscription_id:
            sub = UserSubscription.objects.filter(paystack_subscription_id=paystack_subscription_id).first()
            if sub:
                # Update expiration date
                days = 30 if sub.plan.paystack_monthly_plan_code == sub.paystack_subscription_id else 365 # Rough estimate
                sub.expires_at = timezone.now() + timedelta(days=days)
                sub.status = 'active'
                sub.save()
                return
        return

    try:
        plan = SubscriptionPlan.objects.get(id=plan_id)
    except SubscriptionPlan.DoesNotExist:
        return

    # Calculate expiration
    starts_at = timezone.now()
    if billing_period == 'monthly':
        expires_at = starts_at + timedelta(days=30)
    else:
        expires_at = starts_at + timedelta(days=365)

    try:
        with transaction.atomic():
            # Deactivate old subscriptions
            UserSubscription.objects.filter(user_id=user_id, status='active').update(status='canceled')

            # Create new or update
            UserSubscription.objects.create(
                user_id=user_id,
                plan=plan,
                starts_at=starts_at,
                expires_at=expires_at,
                status='active',
                paystack_subscription_id=paystack_subscription_id,
                paystack_customer_code=customer_code
            )
    except Exception as e:
        print(f"Error handling charge.success: {e}")

def handle_subscription_create(event):
    # This event is fired when a subscription is successfully created
    data = event['data']
    # You can implement additional logic here if needed
    pass

def handle_subscription_disable(event):
    data = event['data']
    subscription_code = data.get('subscription_code')
    
    if subscription_code:
        UserSubscription.objects.filter(paystack_subscription_id=subscription_code).update(
            status='canceled',
            expires_at=timezone.now()
        )

def handle_payment_failed(event):
    data = event['data']
    # Handle payment failure logic
    pass
