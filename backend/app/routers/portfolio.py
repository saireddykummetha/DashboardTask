from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.schemas import PortfolioOut, PortfolioUpdate
from app.services.symbols import ALL_SYMBOLS
from app.utils.security import get_current_user

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("", response_model=PortfolioOut)
async def get_portfolio(user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.portfolios.find_one({"user_id": user["id"]})
    if not doc:
        doc = {"user_id": user["id"], "symbols": [], "updated_at": datetime.now(timezone.utc)}
        await db.portfolios.insert_one(doc)
    return PortfolioOut(user_id=user["id"], symbols=doc.get("symbols", []), updated_at=doc["updated_at"])


@router.put("", response_model=PortfolioOut)
async def update_portfolio(payload: PortfolioUpdate, user: dict = Depends(get_current_user)):
    allowed = set(ALL_SYMBOLS)
    invalid = [s for s in payload.symbols if s not in allowed]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown symbols: {', '.join(invalid)}",
        )

    db = get_db()
    now = datetime.now(timezone.utc)
    await db.portfolios.update_one(
        {"user_id": user["id"]},
        {"$set": {"symbols": payload.symbols, "updated_at": now}},
        upsert=True,
    )
    return PortfolioOut(user_id=user["id"], symbols=payload.symbols, updated_at=now)
