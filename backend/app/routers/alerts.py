from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.schemas import AlertCreate, AlertOut
from app.services.symbols import ALL_SYMBOLS
from app.utils.security import get_current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _to_out(doc: dict) -> AlertOut:
    return AlertOut(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        symbol=doc["symbol"],
        threshold=doc["threshold"],
        direction=doc["direction"],
        mode=doc.get("mode", "recurring"),
        active=doc.get("active", True),
        armed=doc.get("armed", True),
        last_triggered_at=doc.get("last_triggered_at"),
        created_at=doc["created_at"],
    )


@router.get("", response_model=list[AlertOut])
async def list_alerts(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = await db.alerts.find({"user_id": user["id"]}).sort("created_at", -1).to_list(200)
    return [_to_out(d) for d in docs]


@router.post("", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
async def create_alert(payload: AlertCreate, user: dict = Depends(get_current_user)):
    if payload.symbol not in ALL_SYMBOLS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown symbol")

    db = get_db()
    portfolio = await db.portfolios.find_one({"user_id": user["id"]})
    symbols = (portfolio or {}).get("symbols", [])
    if payload.symbol not in symbols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alert symbol must be in your portfolio. Add it first.",
        )

    doc = {
        "user_id": user["id"],
        "symbol": payload.symbol,
        "threshold": payload.threshold,
        "direction": payload.direction,
        "mode": payload.mode,
        "active": True,
        "armed": True,
        "last_triggered_at": None,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.alerts.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_out(doc)


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(alert_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(alert_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid alert id") from exc

    result = await db.alerts.delete_one({"_id": oid, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return None
