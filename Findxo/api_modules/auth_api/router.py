from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password, check_password
from django.db.models import Q
from ..common.jwt_utils import create_access_token, decode_token
from accounts.models import UserProfile

router = APIRouter(prefix="/auth", tags=["auth"])

class RegisterIn(BaseModel):
    username: str
    email: EmailStr
    password: str
    wallet_address: str | None = None

class LoginIn(BaseModel):
    # identifier can be username, email, or wallet_address. For backward compatibility
    # the field is named 'username'.
    username: str
    password: str

class TokenOut(BaseModel):
    access: str

def get_current_user(authorization: str = Header(default="")) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ", 1)[1]
    data = decode_token(token)
    if not data:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        user = User.objects.get(username=data.get("sub"))
    except User.DoesNotExist:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn):
    if User.objects.filter(Q(username=body.username) | Q(email__iexact=body.email)).exists():
        raise HTTPException(status_code=400, detail="User already exists")
    user = User.objects.create(username=body.username, email=body.email, password=make_password(body.password))
    # create or update profile with wallet if provided
    if body.wallet_address:
        # enforce uniqueness at application level for clearer error message
        if UserProfile.objects.filter(wallet_address__iexact=body.wallet_address).exists():
            raise HTTPException(status_code=400, detail="Wallet already linked to another user")
        UserProfile.objects.update_or_create(user=user, defaults={"wallet_address": body.wallet_address})
    else:
        UserProfile.objects.get_or_create(user=user)
    token = create_access_token(sub=user.username)
    return {"access": token}

@router.post("/login", response_model=TokenOut)
def login(body: LoginIn):
    identifier = body.username.strip()
    user: User | None = (
        User.objects.filter(Q(username=identifier) | Q(email__iexact=identifier)).order_by("id").first()
    )
    if user is None:
        prof = UserProfile.objects.select_related("user").filter(wallet_address__iexact=identifier).first()
        user = prof.user if prof else None
    if user is None or not check_password(body.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    token = create_access_token(sub=user.username)
    return {"access": token}

@router.get("/me")
def me(user: User = Depends(get_current_user)):
    wallet = None
    try:
        wallet = user.profile.wallet_address
    except Exception:
        wallet = None
    return {"id": user.id, "username": user.username, "email": user.email, "wallet_address": wallet}

@router.post("/refresh", response_model=TokenOut)
def refresh(user: User = Depends(get_current_user)):
    token = create_access_token(sub=user.username)
    return {"access": token}
