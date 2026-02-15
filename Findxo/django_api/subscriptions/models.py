from django.db import models
from django.utils import timezone
import uuid

class SubscriptionPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=50, unique=True)
    daily_requests = models.IntegerField()
    monthly_price_eur = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    yearly_price_eur = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    paystack_monthly_plan_code = models.CharField(max_length=100, null=True, blank=True)
    paystack_yearly_plan_code = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'subscription_plans'
        managed = False
        app_label = 'subscriptions'

    def __str__(self):
        return self.name

class UserSubscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.DO_NOTHING, db_column='plan_id')
    status = models.CharField(max_length=20, default='active')
    starts_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    paystack_subscription_id = models.CharField(max_length=100, null=True, blank=True)
    paystack_customer_code = models.CharField(max_length=100, null=True, blank=True)
    solana_signature = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_subscriptions'
        managed = False
        app_label = 'subscriptions'

    def __str__(self):
        return f"{self.user_id} -> {self.plan.name}"

class APIKey(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    name = models.CharField(max_length=100)
    key_hash = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=20, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'api_keys'
        managed = False
        app_label = 'subscriptions'

    def __str__(self):
        return f"{self.user_id}:{self.name}"

class APIUsage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    api_key = models.ForeignKey(APIKey, on_delete=models.DO_NOTHING, db_column='api_key_id', null=True, blank=True)
    endpoint = models.TextField()
    request_count = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    date = models.DateField(default=timezone.now)

    class Meta:
        db_table = 'api_usage'
        managed = False
        app_label = 'subscriptions'
