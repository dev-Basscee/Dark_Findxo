from typing import Optional

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

UserModel = get_user_model()


class WalletEmailUsernameBackend(ModelBackend):
    """
    Authenticate against username, email, or linked wallet address (UserProfile.wallet_address).
    Usage: pass any identifier into the 'username' field of authenticate().
    """

    def authenticate(self, request, username: Optional[str] = None, password: Optional[str] = None, **kwargs):
        if username is None:
            username = kwargs.get(UserModel.USERNAME_FIELD)
        if username is None or password is None:
            return None

        identifier = str(username).strip()
        # Try to find user by username or email first
        user = (
            UserModel.objects.filter(Q(username=identifier) | Q(email__iexact=identifier))
            .order_by("id")
            .first()
        )

        # If not found, try via profile wallet address
        if user is None:
            try:
                from .models import UserProfile  # local import to avoid app registry timing issues

                profile = UserProfile.objects.select_related("user").filter(wallet_address__iexact=identifier).first()
                if profile:
                    user = profile.user
            except Exception:
                user = None

        if user and self.user_can_authenticate(user) and user.check_password(password):
            return user
        return None
