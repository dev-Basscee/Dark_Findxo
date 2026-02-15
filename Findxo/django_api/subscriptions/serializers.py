from rest_framework import serializers
from .models import SubscriptionPlan, UserSubscription, APIKey

class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = ('id', 'name', 'monthly_price_eur', 'yearly_price_eur', 'daily_requests')

class SubscriptionSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)

    class Meta:
        model = UserSubscription
        fields = ('id', 'plan', 'starts_at', 'expires_at', 'status')

class SubscribeInputSerializer(serializers.Serializer):
    plan_id = serializers.UUIDField()
    billing_period = serializers.ChoiceField(choices=['monthly', 'yearly'])

class APIKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = APIKey
        fields = ('id', 'name', 'created_at', 'last_used_at', 'expires_at', 'status')
        read_only_fields = ('created_at', 'last_used_at')
