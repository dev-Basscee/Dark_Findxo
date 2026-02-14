from django.utils import timezone
from fastapi import APIRouter, Depends
from django.contrib.auth.models import User
from ..auth_api.router import get_current_user
from django_api.subscriptions.models import Plan, Subscription

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

@router.get("/plans")
def list_plans():
    items = list(Plan.objects.all().order_by('price').values('id','name','price','interval'))
    return {"plans": items}

@router.get("/status")
def status(user: User = Depends(get_current_user)):
    sub = Subscription.objects.filter(user=user).order_by('-created_at').first()
    if not sub:
        return {"status": "none"}
    if sub.status == 'active' and sub.end_date < timezone.now():
        sub.status = 'expired'
        sub.save(update_fields=['status'])
    return {"status": sub.status, "plan": sub.plan.name}

