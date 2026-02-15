from django.utils import timezone
from fastapi import APIRouter, Depends
from django.contrib.auth.models import User
from ..auth_api.router import get_current_user
from subscriptions.models import SubscriptionPlan, UserSubscription

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

@router.get("/plans")
def list_plans():
    items = list(SubscriptionPlan.objects.all().order_by('name').values('id','name','daily_requests'))
    return {"plans": items}

@router.get("/status")
def status(user: User = Depends(get_current_user)):
    # Note: UserSubscription uses user_id (UUID) not a direct FK to User in some schemas
    # But here we assume we can filter by user_id if we have it.
    # If the schema uses Django User, we might need to adjust.
    # Looking at the model, it's user_id = models.UUIDField()
    sub = UserSubscription.objects.filter(user_id=user.id).order_by('-created_at').first()
    if not sub:
        return {"status": "none"}
    if sub.status == 'active' and sub.expires_at and sub.expires_at < timezone.now():
        sub.status = 'expired'
        sub.save(update_fields=['status'])
    return {"status": sub.status, "plan": sub.plan.name}

