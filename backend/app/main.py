import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import close_db, ensure_indexes
from app.routers import alerts, auth, market, portfolio
from app.services.market_data import refresh_market_quotes
from app.services.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await ensure_indexes()
    start_scheduler()
   
    asyncio.create_task(_warmup())
    yield
    stop_scheduler()
    await close_db()


async def _warmup() -> None:
    try:
        await asyncio.sleep(1)
        count = await refresh_market_quotes()
        logger.info("Warmup refresh: %s quotes", count)
    except Exception:
        logger.exception("Warmup refresh failed (will retry on schedule)")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Stock Portfolio & Alerts API",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth.router, prefix="/api")
    app.include_router(market.router, prefix="/api")
    app.include_router(portfolio.router, prefix="/api")
    app.include_router(alerts.router, prefix="/api")

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
