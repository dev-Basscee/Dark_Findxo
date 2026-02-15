from django.urls import path
from .views import PlansListView, SubscribeView, SolanaVerifyView, CancelSubscriptionView, SubscriptionStatusView, APIKeyView, RevokeAPIKeyView
from .webhooks import paystack_webhook

urlpatterns = [
    path('plans/', PlansListView.as_view(), name='plans'),
    path('subscribe/', SubscribeView.as_view(), name='subscribe'),
    path('solana-verify/', SolanaVerifyView.as_view(), name='solana-verify'),
    path('cancel/', CancelSubscriptionView.as_view(), name='cancel'),
    path('status/', SubscriptionStatusView.as_view(), name='status'),
    path('api-keys/', APIKeyView.as_view(), name='api_keys'),
    path('api-keys/<int:pk>/revoke/', RevokeAPIKeyView.as_view(), name='revoke_api_key'),
    path('paystack-webhook/', paystack_webhook, name='paystack-webhook'),
]
