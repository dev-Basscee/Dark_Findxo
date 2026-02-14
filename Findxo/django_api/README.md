# Django API (Auth + Subscriptions)

This adds a standalone Django 5 + DRF API alongside your existing codebase. It provides JWT authentication and a simple subscription system.

## Quick start

- Install deps: `pip install -r django_api/requirements.txt`
- Apply migrations: `python django_api/manage.py migrate`
- (Optional) Create a superuser: `python django_api/manage.py createsuperuser`
- Seed plans (optional): via admin or `python django_api/manage.py shell`
- Run server: `python django_api/manage.py runserver 0.0.0.0:8001`

## Base URL

- http://localhost:8001/
- API root is `/api/`

## Auth endpoints (JWT)

- POST `/api/auth/register/`
  - Body: `{ "username": "john", "email": "john@example.com", "password": "secret123" }`
  - Creates a user account

- POST `/api/auth/login/`
  - Body: `{ "username": "john", "password": "secret123" }`
  - Returns: `{ "refresh": "...", "access": "..." }`

- POST `/api/auth/refresh/`
  - Body: `{ "refresh": "..." }`
  - Returns a new access token

- POST `/api/auth/logout/`
  - Body: `{ "refresh": "..." }`
  - Blacklists refresh token

- GET `/api/auth/me/`
  - Headers: `Authorization: Bearer <access>`
  - Returns the current user profile

## Subscriptions endpoints

- GET `/api/subscriptions/plans/`
  - Public list of available plans

- POST `/api/subscriptions/subscribe/`
  - Headers: `Authorization: Bearer <access>`
  - Body: `{ "plan_id": 1 }`
  - Creates an active subscription for the user (auto-cancels any existing active one)

- POST `/api/subscriptions/cancel/`
  - Headers: `Authorization: Bearer <access>`
  - Cancels the current active subscription

- GET `/api/subscriptions/status/`
  - Headers: `Authorization: Bearer <access>`
  - Returns the latest subscription; marks it expired if end_date passed

## Notes

- Default DB is SQLite under `django_api/db.sqlite3`.
- Plans include fields: `name`, `price`, `interval` (monthly|yearly).
- Subscription end dates are computed from plan interval (30 or 365 days).
- This API runs separately from your FastAPI dark web APIs; they can coexist.