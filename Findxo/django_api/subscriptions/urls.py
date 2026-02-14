from django.urls import path
from .views import PlansListView, SubscribeView, CancelSubscriptionView, SubscriptionStatusView, APIKeyView, RevokeAPIKeyView
from .webhooks import stripe_webhook

urlpatterns = [
    path('plans/', PlansListView.as_view(), name='plans'),
    path('subscribe/', SubscribeView.as_view(), name='subscribe'),
    path('cancel/', CancelSubscriptionView.as_view(), name='cancel'),
    path('status/', SubscriptionStatusView.as_view(), name='status'),
    path('api-keys/', APIKeyView.as_view(), name='api_keys'),
    path('api-keys/<int:pk>/revoke/', RevokeAPIKeyView.as_view(), name='revoke_api_key'),
    path('stripe-webhook/', stripe_webhook, name='stripe-webhook'),
]
