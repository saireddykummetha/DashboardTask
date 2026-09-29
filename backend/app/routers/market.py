from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.config import get_settings
from app.database import get_db
from app.schemas import HistoryOut, MarketSummaryOut, QuoteOut
from app.services import market_data
from app.services.symbols import ALL_SYMBOLS, NIFTY_100, SYMBOL_NAME_MAP
from app.utils.security import get_current_user

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/symbols")
async def list_symbols(user: dict = Depends(get_current_user)):
    return NIFTY_100


@router.get("/quotes", response_model=MarketSummaryOut)
async def get_quotes(user: dict = Depends(get_current_user)):
    db = get_db()
    settings = get_settings()
    docs = await db.market_quotes.find({}).to_list(200)
    # Preserve universe order
    by_sym = {d["symbol"]: d for d in docs}
    quotes = []
    for sym in ALL_SYMBOLS:
        d = by_sym.get(sym)
        if not d:
            continue
        quotes.append(
            QuoteOut(
                symbol=d["symbol"],
                name=d.get("name") or SYMBOL_NAME_MAP.get(sym, sym),
                price=d["price"],
                change=d.get("change", 0),
                change_percent=d.get("change_percent", 0),
                volume=d.get("volume"),
                previous_close=d.get("previous_close"),
                currency=d.get("currency", "INR"),
                market_state=d.get("market_state"),
                updated_at=d["updated_at"],
            )
        )

    meta = market_data.get_refresh_meta()
    note = None
    if meta.get("last_error"):
        note = f"Last refresh issue: {meta['last_error']}"
    elif not meta.get("market_open"):
        note = "Market appears closed or delayed. Showing last available prices (INR)."

    return MarketSummaryOut(
        quotes=quotes,
        market_open=bool(meta.get("market_open")),
        last_refresh=meta.get("last_refresh"),
        refresh_interval_minutes=settings.price_refresh_minutes,
        note=note,
    )


@router.get("/history/{symbol}", response_model=HistoryOut)
async def get_history(
    symbol: str,
    period: str = Query(default="1mo", pattern="^(5d|1mo|3mo|6mo|1y)$"),
    user: dict = Depends(get_current_user),
):
    symbol = symbol.strip().upper()
    # Allow URL-encoded ^NSEI etc.
    if symbol not in ALL_SYMBOLS and symbol.replace("%5E", "^") not in ALL_SYMBOLS:
        # try with caret
        if f"^{symbol}" in ALL_SYMBOLS:
            symbol = f"^{symbol}"
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Symbol not found")

    points = await market_data.get_history(symbol, period=period)
    return HistoryOut(symbol=symbol, points=points)


@router.post("/refresh")
async def force_refresh(user: dict = Depends(get_current_user)):
    count = await market_data.refresh_market_quotes()
    from app.services.alerts import evaluate_alerts

    fired = await evaluate_alerts()
    return {"refreshed": count, "alerts_fired": fired, "meta": market_data.get_refresh_meta()}
