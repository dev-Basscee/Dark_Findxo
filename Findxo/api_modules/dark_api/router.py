import logging
import hashlib
from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from pydantic import BaseModel, Field
from django.utils import timezone
from django.db.models import Sum
from .scraper import run_dark_scrape
from fastapi.concurrency import run_in_threadpool
from accounts.models import SupabaseUser
from subscriptions.models import APIKey, UserSubscription, APIUsage, SubscriptionPlan

# Setup logging
logger = logging.getLogger("dark_api")

router = APIRouter(prefix="/dark", tags=["dark-api"])

class SearchIn(BaseModel):
    keyword: str = Field(..., description="Keyword to search for on onion engines")
    max_results: int = Field(5, ge=1, le=50, description="Maximum number of top-level onion links to scrape")
    depth: int = Field(0, ge=0, le=2, description="Crawl depth for internal links")
    rotate: bool = Field(False, description="Whether to rotate Tor identity between scrapes")

class SearchResponse(BaseModel):
    session_id: str
    keyword: str
    timestamp: str
    results: list

def track_usage(user_id, api_key_id, endpoint):
    """
    Background task to record API usage.
    """
    try:
        today = timezone.now().date()
        usage, created = APIUsage.objects.get_or_create(
            user_id=user_id,
            api_key_id=api_key_id,
            endpoint=endpoint,
            date=today,
            defaults={'request_count': 1}
        )
        if not created:
            APIUsage.objects.filter(id=usage.id).update(request_count=usage.request_count + 1)
    except Exception as e:
        logger.error(f"Failed to track usage: {e}")

def _check_api_key(x_api_key: str):
    """
    Validates API key, checks subscription status, and enforces daily limits.
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")
    
    digest = hashlib.sha256(x_api_key.encode()).hexdigest()
    
    # 1. Verify API Key
    key_record = APIKey.objects.filter(key_hash=digest, status='active').first()
    if not key_record:
        logger.warning(f"Invalid API key attempt: {digest[:10]}...")
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    
    if key_record.expires_at and key_record.expires_at < timezone.now():
        raise HTTPException(status_code=401, detail="API key expired")

    # 2. Get User and Subscription
    user = SupabaseUser.objects.filter(id=key_record.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Find latest active subscription
    sub = UserSubscription.objects.filter(
        user_id=user.id, 
        status='active'
    ).select_related('plan').order_by('-created_at').first()

    # Default to free plan if no sub found (though system should create one)
    if not sub:
        plan_limit = 10 
    else:
        # Check if subscription expired
        if sub.expires_at and sub.expires_at < timezone.now():
             # Fallback to free plan limit or block
             plan_limit = 10
        else:
             plan_limit = sub.plan.daily_requests

    # 3. Check Daily Usage
    today = timezone.now().date()
    current_usage = APIUsage.objects.filter(
        user_id=user.id, 
        date=today
    ).aggregate(total=Sum('request_count'))['total'] or 0

    if current_usage >= plan_limit:
        logger.warning(f"Usage limit reached for user {user.wallet_address}")
        raise HTTPException(status_code=429, detail="Daily request limit reached. Please upgrade your plan.")

    # Update last used timestamp
    APIKey.objects.filter(id=key_record.id).update(last_used_at=timezone.now())
    
    return user, key_record

@router.get("/verify")
async def verify_key(x_api_key: str = Header(..., alias="x-api-key")):
    """
    Endpoint for the frontend to verify an API key and check limits.
    """
    user, key_record = await run_in_threadpool(_check_api_key, x_api_key)
    
    # Get current usage for info
    today = timezone.now().date()
    current_usage = await run_in_threadpool(
        lambda: APIUsage.objects.filter(user_id=user.id, date=today).aggregate(total=Sum('request_count'))['total'] or 0
    )

    return {
        "valid": True,
        "wallet_address": user.wallet_address,
        "user_id": str(user.id),
        "usage_today": current_usage
    }

@router.post("/search", response_model=SearchResponse)
async def search(
    body: SearchIn, 
    background_tasks: BackgroundTasks,
    x_api_key: str = Header(..., alias="x-api-key")
):
    """
    Performs a deep search and scrape of the dark web with usage tracking.
    """
    # Authenticate and check limits
    user, key_record = await run_in_threadpool(_check_api_key, x_api_key)
    
    # Track usage in background
    background_tasks.add_task(track_usage, user.id, key_record.id, "/v1/dark/search")
    
    try:
        logger.info(f"User {user.wallet_address} starting search for: {body.keyword}")
        
        report = await run_dark_scrape(
            keyword=body.keyword,
            max_results=body.max_results,
            depth=body.depth,
            rotate=body.rotate
        )
        
        if "error" in report:
            raise HTTPException(status_code=500, detail=report["error"])
            
        return report
        
    except Exception as e:
        logger.exception("Error during dark web search")
        raise HTTPException(status_code=500, detail=f"Scraper error: {str(e)}")

@router.get("/status")
async def get_status():
    return {"status": "operational", "engine": "multi-hybrid-v2"}
