from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.schemas import RefreshRequest, TokenResponse, UserLogin, UserOut, UserRegister
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister):
    db = get_db()
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    doc = {
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    user_id = str(result.inserted_id)

    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)
    settings_exp = decode_token(refresh, expected_type="refresh")
    await db.refresh_tokens.insert_one(
        {
            "token": refresh,
            "user_id": user_id,
            "expires_at": datetime.fromtimestamp(settings_exp["exp"], tz=timezone.utc),
        }
    )
    await db.portfolios.insert_one(
        {"user_id": user_id, "symbols": [], "updated_at": datetime.now(timezone.utc)}
    )
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    user_id = str(user["_id"])
    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)
    settings_exp = decode_token(refresh, expected_type="refresh")
    await db.refresh_tokens.insert_one(
        {
            "token": refresh,
            "user_id": user_id,
            "expires_at": datetime.fromtimestamp(settings_exp["exp"], tz=timezone.utc),
        }
    )
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(payload: RefreshRequest):
    data = decode_token(payload.refresh_token, expected_type="refresh")
    db = get_db()
    stored = await db.refresh_tokens.find_one({"token": payload.refresh_token})
    if not stored:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked or unknown")

    user_id = data["sub"]
    await db.refresh_tokens.delete_one({"token": payload.refresh_token})
    access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)
    exp = decode_token(new_refresh, expected_type="refresh")
    await db.refresh_tokens.insert_one(
        {
            "token": new_refresh,
            "user_id": user_id,
            "expires_at": datetime.fromtimestamp(exp["exp"], tz=timezone.utc),
        }
    )
    return TokenResponse(access_token=access, refresh_token=new_refresh)


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        created_at=user["created_at"],
    )
