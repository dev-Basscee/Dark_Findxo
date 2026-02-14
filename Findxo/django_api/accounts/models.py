from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
	"""
	Extension of Django's built-in User with an optional unique wallet address.
	Users can authenticate using their username/email or this wallet address
	(paired with their password) via the custom auth backend.
	"""

	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
	wallet_address = models.CharField(
		max_length=128,
		unique=True,
		null=True,
		blank=True,
		db_index=True,
		help_text="Optional unique wallet address used for login.",
	)

	class Meta:
		app_label = "accounts"

	def __str__(self) -> str:  # pragma: no cover - trivial
		return f"Profile(user={self.user.username}, wallet={self.wallet_address or '-'} )"

