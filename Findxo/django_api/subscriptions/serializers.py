from rest_framework import serializers
from .models import Plan, Subscription, APIKey

class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ('id', 'name', 'price', 'interval')

class SubscriptionSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)

    class Meta:
        model = Subscription
        fields = ('id', 'plan', 'start_date', 'end_date', 'status')

class SubscribeInputSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField()

class APIKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = APIKey
        fields = ('id', 'name', 'created_at', 'last_used_at', 'revoked_at')
        read_only_fields = ('created_at', 'last_used_at', 'revoked_at')
