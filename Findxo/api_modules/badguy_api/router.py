from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/badguy", tags=["badguy"])

class SearchRequest(BaseModel):
    keyword: str = Field(...)
    max_results: int = Field(5, ge=1, le=50)
    depth: int = Field(0, ge=0, le=2)
    rotate: bool = False

@router.post("/search")
async def search_onion(req: SearchRequest):
    raise HTTPException(status_code=501, detail="This endpoint is deprecated")
