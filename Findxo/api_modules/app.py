import os
import sys
from pathlib import Path
from fastapi import FastAPI, Request
from starlette.middleware.cors import CORSMiddleware

# init Django so we can use ORM
ROOT_DIR = Path(__file__).resolve().parents[1]

# only add workspace root so we import packages via 'django_api.*'
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# use fully-qualified settings module path inside 'django_api'
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_api.findxo_django.settings")
import django  # noqa
django.setup()

from .auth_api.router import router as auth_router  # noqa
from .subscriptions_api.router import router as subs_router  # noqa
from .dark_api.router import router as dark_router  # noqa
from .badguy_api.router import router as badguy_router # noqa

app = FastAPI(title="Findxo Unified API", version="1.0.0")

# CORS (allow list from env, comma-separated)
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure Django DB connections are recycled per-request to avoid leaks
from django.db import close_old_connections  # noqa: E402

@app.middleware("http")
async def django_db_connection_middleware(request: Request, call_next):
    close_old_connections()
    try:
        response = await call_next(request)
    finally:
        close_old_connections()
    return response

@app.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(auth_router, prefix="/v1")
app.include_router(subs_router, prefix="/v1")
app.include_router(dark_router, prefix="/v1")
app.include_router(badguy_router, prefix="/v1")
