import os
import logging
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import time

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("findxo_api")

# Custom Middleware for request timing and logging
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(f"{request.method} {request.url.path} - Completed in {process_time:.4f}s")
        response.headers["X-Process-Time"] = str(process_time)
        return response

app = FastAPI(
    title="Findxo Cyber Intelligence API",
    description="Advanced dark web scraping and analysis platform",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(LoggingMiddleware)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Our engineers have been notified."},
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

# Import and include routers
from .auth_api.router import router as auth_router
from .subscriptions_api.router import router as subs_router
from .dark_api.router import router as dark_router

app.include_router(auth_router, prefix="/v1")
app.include_router(subs_router, prefix="/v1")
app.include_router(dark_router, prefix="/v1")

@app.get("/health")
async def health():
    """
    Service health check
    """
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "2.0.0"
    }

# Proxy to frontend for all other routes
import httpx
from fastapi.responses import StreamingResponse

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def proxy_frontend(request: Request, path: str):
    # Skip proxying for API routes and docs
    if path.startswith(("v1/", "docs", "redoc", "openapi.json", "health")):
        raise HTTPException(status_code=404)

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    # Handle the root path
    url_path = path if path else ""
    url = f"{frontend_url}/{url_path}"
    
    # Add query parameters back
    if request.query_params:
        url += f"?{request.query_params}"

    async def stream_response():
        async with httpx.AsyncClient() as client:
            try:
                # Prepare headers (excluding host to avoid issues)
                headers = dict(request.headers)
                headers.pop("host", None)
                
                async with client.stream(
                    method=request.method,
                    url=url,
                    headers=headers,
                    content=await request.body(),
                    timeout=None
                ) as response:
                    async for chunk in response.aiter_raw():
                        yield chunk
            except Exception as e:
                logger.error(f"Proxy error: {e}")
                yield b"Frontend not available. Make sure 'npm run dev' is running."

    return StreamingResponse(stream_response())

# Ensure Django DB connections are handled correctly
from django.db import close_old_connections

@app.middleware("http")
async def db_session_middleware(request: Request, call_next):
    close_old_connections()
    try:
        response = await call_next(request)
    finally:
        close_old_connections()
    return response

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing Findxo Cyber Intelligence API...")
    # Add any startup logic here (e.g. pre-warming Tor circuits)

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Findxo Cyber Intelligence API...")
