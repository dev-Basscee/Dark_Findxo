from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from django.utils import timezone
from django.contrib.auth.models import User
from django.db.models import Q
from ..subscriptions_api.router import hashlib  # reuse import
from .runner import run_dark
from fastapi.concurrency import run_in_threadpool

router = APIRouter(prefix="/dark", tags=["dark-api"])

class SearchIn(BaseModel):
    keyword: str
    max_results: int = Field(5, ge=1, le=50)
    depth: int = Field(0, ge=0, le=2)
    rotate: bool = False

def _check_api_key(x_api_key: str) -> User:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")
    from django_api.subscriptions.models import APIKey, Subscription
    digest = hashlib.sha256(x_api_key.encode()).hexdigest()
    row = APIKey.objects.filter(key_hash=digest, revoked_at__isnull=True).first()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid API key")
    now = timezone.now()
    sub = Subscription.objects.filter(user=row.user).order_by('-created_at').first()
    if not sub or sub.status != 'active' or sub.end_date < now:
        raise HTTPException(status_code=402, detail="Subscription inactive")
    row.last_used_at = now
    row.save(update_fields=['last_used_at'])
    return row.user

@router.post("/search")
async def search(body: SearchIn, x_api_key: str = Header(alias="x-api-key")):
    # perform sync Django ORM checks in a threadpool to avoid async-unsafe DB access
    _ = await run_in_threadpool(_check_api_key, x_api_key)
    try:
        return await run_dark(body.keyword, body.max_results, body.depth, body.rotate)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
