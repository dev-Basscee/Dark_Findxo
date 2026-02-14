# API Documentation

## Badguy-API (Deprecated)

- POST /v1/badguy/search
  - This endpoint is deprecated and will be removed in a future version.

## Dark-API

- POST /v1/dark/search
  - Headers: `x-api-key: <key>`
  - Body: `{ "keyword": "string", "max_results": 5, "depth": 0, "rotate": false }`
  - Use: Runs the dark web scraper with Tor and saves artifacts; returns a session report.

## Authentication

- POST /v1/auth/register
  - Body: `{ "username": "john", "email": "john@example.com", "password": "secret123" }`
  - Use: Create a new user and return an access token.

- POST /v1/auth/login
  - Body: `{ "username": "john", "password": "secret123" }`
  - Use: Login and receive an access token.

- GET /v1/auth/me
  - Headers: `Authorization: Bearer <access>`
  - Use: Return the current user profile.

- POST /v1/auth/refresh
  - Headers: `Authorization: Bearer <access>`
  - Use: Issue a fresh access token.

## Subscriptions

- GET /v1/subscriptions/plans
  - Use: List available plans.

- POST /v1/subscriptions/subscribe
  - Headers: `Authorization: Bearer <access>`
  - Body: `{ "plan_id": 1 }`
  - Use: Start an active subscription.

- POST /v1/subscriptions/cancel
  - Headers: `Authorization: Bearer <access>`
  - Use: Cancel the current subscription.

- GET /v1/subscriptions/status
  - Headers: `Authorization: Bearer <access>`
  - Use: Get current subscription status.

- POST /v1/subscriptions/api-keys
  - Headers: `Authorization: Bearer <access>`
  - Use: Create an API key and receive the raw key value once.

- GET /v1/subscriptions/api-keys
  - Headers: `Authorization: Bearer <access>`
  - Use: List API keys with metadata (last4 only).

- DELETE /v1/subscriptions/api-keys/{id}
  - Headers: `Authorization: Bearer <access>`
  - Use: Revoke an API key.

## Run

- App entrypoint: `api_modules/app.py` (FastAPI)
- Start server with Uvicorn and set env `DJANGO_SETTINGS_MODULE` is not required since code sets it.
