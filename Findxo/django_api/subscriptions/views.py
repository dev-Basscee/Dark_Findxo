import secrets
import hashlib
from datetime import timedelta
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Plan, Subscription, APIKey
from .serializers import PlanSerializer, SubscriptionSerializer, SubscribeInputSerializer, APIKeySerializer
import stripe
from django.conf import settings
from django.urls import reverse

class PlansListView(generics.ListAPIView):
    queryset = Plan.objects.all().order_by('price')
    serializer_class = PlanSerializer
    permission_classes = [permissions.AllowAny]

class SubscribeView(generics.GenericAPIView):
    serializer_class = SubscribeInputSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        plan_id = data.validated_data['plan_id']
        try:
            plan = Plan.objects.get(id=plan_id)
        except Plan.DoesNotExist:
            return Response({'detail': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)

        stripe.api_key = settings.STRIPE_SECRET_KEY
        
        success_url = request.build_absolute_uri(reverse('status')) + '?session_id={CHECKOUT_SESSION_ID}'
        cancel_url = request.build_absolute_uri(reverse('plans'))

        try:
            checkout_session = stripe.checkout.Session.create(
                client_reference_id=request.user.id,
                success_url=success_url,
                cancel_url=cancel_url,
                payment_method_types=['card'],
                mode='subscription',
                line_items=[{
                    'price_data': {
                        'currency': 'usd',
                        'unit_amount': int(plan.price * 100),
                        'product_data': {
                            'name': plan.name,
                        },
                        'recurring': {
                            'interval': plan.interval,
                        },
                    },
                    'quantity': 1,
                }],
                metadata={
                    'plan_id': plan.id,
                }
            )
            return Response({'checkout_url': checkout_session.url})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CancelSubscriptionView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        sub = Subscription.objects.filter(user=request.user, status='active').first()
        if not sub:
            return Response({'detail': 'No active subscription'}, status=status.HTTP_404_NOT_FOUND)

        if not sub.stripe_subscription_id:
            # This case should ideally not happen with a proper webhook implementation
            return Response({'detail': 'Cannot cancel subscription without a Stripe subscription ID.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            stripe.api_key = settings.STRIPE_SECRET_KEY
            stripe.Subscription.delete(sub.stripe_subscription_id)
            
            # Best practice is to wait for the 'customer.subscription.deleted' webhook
            # to update the status. But for immediate feedback, we can update it here.
            # The webhook should be idempotent and handle this case.
            sub.status = 'canceled'
            sub.end_date = timezone.now()
            sub.save(update_fields=['status', 'end_date'])

            return Response({'detail': 'Subscription canceled successfully.'})
        except stripe.error.StripeError as e:
            # Handle Stripe API errors (e.g., subscription already canceled)
            return Response({'detail': f'Stripe error: {e.user_message}'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Handle other unexpected errors
            return Response({'detail': 'An unexpected error occurred.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SubscriptionStatusView(generics.RetrieveAPIView):
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        sub = Subscription.objects.filter(user=self.request.user).order_by('-created_at').first()
        if sub and sub.status == 'active' and sub.end_date < timezone.now():
            sub.status = 'expired'
            sub.save(update_fields=['status'])
        return sub

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def subscription_status(request):
    sub = Subscription.objects.filter(user=request.user).order_by('-created_at').first()
    if not sub:
        return Response({'detail': 'No subscription found'}, status=status.HTTP_404_NOT_FOUND)
    if sub.status == 'active' and sub.end_date < timezone.now():
        sub.status = 'expired'
        sub.save(update_fields=['status'])
    serializer = SubscriptionSerializer(sub)
    return Response(serializer.data)

class APIKeyView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = APIKeySerializer

    def get_queryset(self):
        return APIKey.objects.filter(user=self.request.user, revoked_at__isnull=True).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        # Check for active subscription first
        has_active_subscription = Subscription.objects.filter(user=request.user, status='active', end_date__gt=timezone.now()).exists()
        if not has_active_subscription:
            return Response({'detail': 'You must have an active subscription to create API keys.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Generate secure key
        raw_key = secrets.token_urlsafe(32)
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

        api_key = serializer.save(user=request.user, key_hash=key_hash)

        # Return the raw key to the user ONLY once
        data = serializer.data
        data['key'] = raw_key
        return Response(data, status=status.HTTP_201_CREATED)

class RevokeAPIKeyView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        # Only allow revoking own keys
        APIKey.objects.filter(user=request.user, id=pk).update(revoked_at=timezone.now())
        return Response({'detail': 'API Key revoked'}, status=status.HTTP_200_OK)
