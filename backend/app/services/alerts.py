import logging
from datetime import datetime, timezone

from bson import ObjectId

from app.database import get_db
from app.services.email_service import send_alert_email

logger = logging.getLogger(__name__)


def _condition_met(price: float, threshold: float, direction: str) -> bool:
    if direction == "above":
        return price >= threshold
    return price <= threshold


async def evaluate_alerts() -> int:
    """
    Evaluate all active alerts against latest quotes.

    Alert modes:
    - one_time: fires once when condition is met, then deactivates.
    - recurring: fires when condition is met while armed; then disarms until
      price moves back across the threshold (re-arms), preventing spam.

    Returns number of alerts that fired.
    """
    db = get_db()
    quotes = {q["symbol"]: q async for q in db.market_quotes.find({})}
    if not quotes:
        return 0

    fired = 0
    cursor = db.alerts.find({"active": True})
    async for alert in cursor:
        symbol = alert["symbol"]
        quote = quotes.get(symbol)
        if not quote:
            continue

        price = float(quote["price"])
        threshold = float(alert["threshold"])
        direction = alert["direction"]
        mode = alert.get("mode", "recurring")
        armed = alert.get("armed", True)
        met = _condition_met(price, threshold, direction)

        if mode == "recurring" and not met:
            # Re-arm once price moves back across the threshold
            if not armed:
                await db.alerts.update_one({"_id": alert["_id"]}, {"$set": {"armed": True}})
            continue

        if not met or not armed:
            continue

        user = await db.users.find_one({"_id": ObjectId(alert["user_id"])})
        if not user:
            continue

        ok = await send_alert_email(
            to_email=user["email"],
            user_name=user.get("name", "Investor"),
            symbol=symbol,
            direction=direction,
            threshold=threshold,
            current_price=price,
        )
        if not ok:
            continue

        now = datetime.now(timezone.utc)
        update: dict = {"last_triggered_at": now, "armed": False}
        if mode == "one_time":
            update["active"] = False

        await db.alerts.update_one({"_id": alert["_id"]}, {"$set": update})
        fired += 1
        logger.info(
            "Alert fired user=%s symbol=%s price=%.2f threshold=%.2f",
            alert["user_id"],
            symbol,
            price,
            threshold,
        )

    return fired
