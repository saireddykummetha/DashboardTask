import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.services.alerts import evaluate_alerts
from app.services.market_data import refresh_market_quotes

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def _price_and_alert_job() -> None:
    try:
        count = await refresh_market_quotes()
        logger.info("Scheduled refresh saved %s quotes", count)
        fired = await evaluate_alerts()
        if fired:
            logger.info("Scheduled evaluation fired %s alerts", fired)
    except Exception:
        logger.exception("Scheduled job failed (non-fatal)")


def start_scheduler() -> None:
    settings = get_settings()
    minutes = max(1, min(settings.price_refresh_minutes, 5))
    if scheduler.running:
        return
    scheduler.add_job(
        _price_and_alert_job,
        trigger="interval",
        minutes=minutes,
        id="price_refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info("Scheduler started — refresh every %s minute(s)", minutes)


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
