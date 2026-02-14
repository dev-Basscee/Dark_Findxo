import asyncio
import secrets
import hashlib


def test_health(client):
	r = client.get("/health")
	assert r.status_code == 200
	assert r.json()["status"] == "ok"


def test_auth_register_login_me_refresh(client):
	uname = f"user_{secrets.token_hex(4)}"
	email = f"{uname}@ex.com"

	# register
	r = client.post("/v1/auth/register", json={"username": uname, "email": email, "password": "secret123"})
	assert r.status_code == 200
	access = r.json()["access"]

	# me
	r = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
	assert r.status_code == 200
	assert r.json()["username"] == uname

	# login
	r = client.post("/v1/auth/login", json={"username": uname, "password": "secret123"})
	assert r.status_code == 200
	access2 = r.json()["access"]
	assert isinstance(access2, str) and access2

	# refresh
	r = client.post("/v1/auth/refresh", headers={"Authorization": f"Bearer {access2}"})
	assert r.status_code == 200
	assert r.json()["access"]


def test_auth_login_with_wallet_address(client):
	uname = f"user_{secrets.token_hex(4)}"
	email = f"{uname}@ex.com"
	wallet = f"0x{secrets.token_hex(20)}"

	# register with wallet
	r = client.post(
		"/v1/auth/register",
		json={"username": uname, "email": email, "password": "secret123", "wallet_address": wallet},
	)
	assert r.status_code == 200
	access = r.json()["access"]
	assert access

	# me should include wallet
	r = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
	assert r.status_code == 200
	assert r.json()["wallet_address"].lower() == wallet.lower()

	# login using wallet address as identifier
	r = client.post("/v1/auth/login", json={"username": wallet, "password": "secret123"})
	assert r.status_code == 200
	assert r.json()["access"]


def test_subscriptions_and_api_keys_flow(client, create_user_and_token):
	uname = f"user_{secrets.token_hex(4)}"
	_, token = create_user_and_token(uname, f"{uname}@ex.com")

	# list plans
	r = client.get("/v1/subscriptions/plans")
	assert r.status_code == 200
	plans = r.json()["plans"]
	assert isinstance(plans, list) and len(plans) >= 1
	plan_id = plans[0]["id"]

	# subscribe
	r = client.post("/v1/subscriptions/subscribe", headers={"Authorization": f"Bearer {token}"}, json={"plan_id": plan_id})
	assert r.status_code == 200
	assert r.json()["status"] == "active"

	# status
	r = client.get("/v1/subscriptions/status", headers={"Authorization": f"Bearer {token}"})
	assert r.status_code == 200
	assert r.json()["status"] in ("active", "expired", "canceled")

	# create api key
	r = client.post("/v1/subscriptions/api-keys", headers={"Authorization": f"Bearer {token}"})
	assert r.status_code == 200
	api_key = r.json()["api_key"]
	assert isinstance(api_key, str) and len(api_key) > 10

	# list api keys
	r = client.get("/v1/subscriptions/api-keys", headers={"Authorization": f"Bearer {token}"})
	assert r.status_code == 200
	keys = r.json()["keys"]
	expected_last4 = hashlib.sha256(api_key.encode()).hexdigest()[-4:]
	assert any(k["last4"] == expected_last4 for k in keys)
	key_id = keys[0]["id"]

	# revoke api key
	r = client.delete(f"/v1/subscriptions/api-keys/{key_id}", headers={"Authorization": f"Bearer {token}"})
	assert r.status_code == 200
	assert r.json()["revoked"] is True


def test_dark_search_with_api_key_mocked(client, create_user_and_token, monkeypatch):
	# setup: user, subscription, api key
	uname = f"user_{secrets.token_hex(4)}"
	_, token = create_user_and_token(uname, f"{uname}@ex.com")

	plans = client.get("/v1/subscriptions/plans").json()["plans"]
	client.post("/v1/subscriptions/subscribe", headers={"Authorization": f"Bearer {token}"}, json={"plan_id": plans[0]["id"]})
	api_key = client.post("/v1/subscriptions/api-keys", headers={"Authorization": f"Bearer {token}"}).json()["api_key"]

	# mock run_dark to avoid hitting Playwright and external network
	async def fake_run_dark(keyword: str, max_results: int = 5, depth: int = 0, rotate: bool = False):
		return {"keyword": keyword, "found_count": 1, "scraped_count": 1, "results": [{"url": "http://example.onion"}]}

	monkeypatch.setattr("api_modules.dark_api.router.run_dark", fake_run_dark)

	r = client.post("/v1/dark/search", headers={"x-api-key": api_key}, json={"keyword": "test", "max_results": 3})
	assert r.status_code == 200
	data = r.json()
	assert data["keyword"] == "test"
	assert data["scraped_count"] == 1

