import os
import sys
from pathlib import Path
import pytest
import anyio
from httpx import AsyncClient, ASGITransport


@pytest.fixture(scope="session", autouse=True)
def _setup_django():
	# Ensure workspace root is importable so 'django_api.*' can be found
	ROOT = Path(__file__).resolve().parents[1]
	if str(ROOT) not in sys.path:
		sys.path.insert(0, str(ROOT))
	os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_api.findxo_django.settings")
	import django
	django.setup()
	# apply migrations once for the test session
	from django.core.management import call_command
	call_command("migrate", verbosity=0)


@pytest.fixture()
def client():
	# import app after Django is set up
	from api_modules.app import app
	class _SyncClient:
		def __init__(self, app):
			self.app = app
			self.base_url = "http://testserver"

		def request(self, method: str, url: str, **kwargs):
			async def _send():
				async with AsyncClient(transport=ASGITransport(app=self.app), base_url=self.base_url) as ac:
					return await ac.request(method, url, **kwargs)

			return anyio.run(_send)

		def get(self, url: str, **kwargs):
			return self.request("GET", url, **kwargs)

		def post(self, url: str, **kwargs):
			return self.request("POST", url, **kwargs)

		def delete(self, url: str, **kwargs):
			return self.request("DELETE", url, **kwargs)

	return _SyncClient(app)


@pytest.fixture()
def create_user_and_token(client):
	# returns (username, token)
	def _create(username: str, email: str, password: str = "secret123"):
		r = client.post("/v1/auth/register", json={"username": username, "email": email, "password": password})
		if r.status_code == 400:  # user exists, login instead
			r = client.post("/v1/auth/login", json={"username": username, "password": password})
		r.raise_for_status()
		token = r.json()["access"]
		return username, token

	return _create

