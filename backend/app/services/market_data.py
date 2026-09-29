import asyncio
import logging
from datetime import datetime, time, timezone, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

import httpx

from app.database import get_db
from app.services.symbols import ALL_SYMBOLS, SYMBOL_NAME_MAP

logger = logging.getLogger(__name__)

_last_refresh: Optional[datetime] = None
_market_open: bool = False
_last_error: Optional[str] = None

# Yahoo v7/quote returns 401 without crumb cookies. v8/chart works without auth
# and includes regularMarketPrice in meta — preferred for NSE .NS symbols.
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def get_refresh_meta() -> dict[str, Any]:
    return {
        "last_refresh": _last_refresh,
        "market_open": _market_open,
        "last_error": _last_error,
    }


def _is_nse_session_open() -> bool:
    try:
        now = datetime.now(ZoneInfo("Asia/Kolkata"))
    except Exception:
        now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    if now.weekday() >= 5:
        return False
    t = now.time()
    return time(9, 15) <= t <= time(15, 30)


def _quote_from_chart(payload: dict[str, Any]) -> Optional[dict[str, Any]]:
    result = (payload.get("chart") or {}).get("result") or []
    if not result:
        return None
    block = result[0]
    meta = block.get("meta") or {}
    symbol = meta.get("symbol")
    price = meta.get("regularMarketPrice")
    if not symbol or price is None:
        # Fall back to last close in indicators
        closes = ((block.get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
        closes = [c for c in closes if c is not None]
        if not closes:
            return None
        price = closes[-1]
        prev = closes[-2] if len(closes) >= 2 else price
    else:
        prev = meta.get("chartPreviousClose") or meta.get("previousClose") or price

    price = float(price)
    prev = float(prev) if prev is not None else price
    change = price - prev
    change_pct = (change / prev * 100.0) if prev else 0.0
    volume = meta.get("regularMarketVolume")

    return {
        "symbol": symbol,
        "name": SYMBOL_NAME_MAP.get(symbol, symbol),
        "price": round(price, 2),
        "change": round(change, 2),
        "change_percent": round(change_pct, 2),
        "volume": float(volume) if volume is not None else None,
        "previous_close": round(prev, 2),
        "currency": meta.get("currency") or "INR",
        "market_state": "REGULAR" if _is_nse_session_open() else "CLOSED",
        "updated_at": datetime.now(timezone.utc),
    }


async def _fetch_one_chart(
    client: httpx.AsyncClient,
    symbol: str,
    sem: asyncio.Semaphore,
) -> Optional[dict[str, Any]]:
    async with sem:
        try:
            url = YAHOO_CHART_URL.format(symbol=symbol)
            resp = await client.get(url, params={"interval": "1d", "range": "5d"})
            if resp.status_code == 429:
                await asyncio.sleep(2)
                resp = await client.get(url, params={"interval": "1d", "range": "5d"})
            if resp.status_code != 200:
                logger.debug("Chart HTTP %s for %s", resp.status_code, symbol)
                return None
            return _quote_from_chart(resp.json())
        except Exception as exc:
            logger.debug("Chart fetch failed for %s: %s", symbol, exc)
            return None


async def _fetch_quotes_via_chart(symbols: list[str]) -> list[dict[str, Any]]:
    headers = {"User-Agent": USER_AGENT}
    sem = asyncio.Semaphore(8)
    async with httpx.AsyncClient(timeout=25.0, headers=headers, follow_redirects=True) as client:
        tasks = [_fetch_one_chart(client, sym, sem) for sym in symbols]
        rows = await asyncio.gather(*tasks)
    return [r for r in rows if r]


async def refresh_market_quotes(symbols: Optional[list[str]] = None) -> int:
    """Refresh quotes using Yahoo chart v8 (works without crumb/cookie)."""
    global _last_refresh, _market_open, _last_error

    target = symbols or ALL_SYMBOLS
    try:
        all_quotes = await _fetch_quotes_via_chart(target)

        if not all_quotes:
            _last_error = "No quotes returned (Yahoo unavailable or rate limited)"
            logger.warning(_last_error)
            return 0

        db = get_db()
        for q in all_quotes:
            await db.market_quotes.update_one({"symbol": q["symbol"]}, {"$set": q}, upsert=True)

        _market_open = _is_nse_session_open()
        _last_refresh = datetime.now(timezone.utc)
        _last_error = None
        logger.info("Refreshed %s quotes (market_open=%s)", len(all_quotes), _market_open)
        return len(all_quotes)
    except Exception as exc:
        _last_error = str(exc)
        logger.exception("Market refresh failed: %s", exc)
        return 0


async def get_history(symbol: str, period: str = "1mo") -> list[dict[str, Any]]:
    range_map = {"5d": "5d", "1mo": "1mo", "3mo": "3mo", "6mo": "6mo", "1y": "1y"}
    yahoo_range = range_map.get(period, "1mo")
    url = YAHOO_CHART_URL.format(symbol=symbol)
    headers = {"User-Agent": USER_AGENT}
    try:
        async with httpx.AsyncClient(timeout=30.0, headers=headers, follow_redirects=True) as client:
            resp = await client.get(url, params={"interval": "1d", "range": yahoo_range})
            if resp.status_code != 200:
                return []
            result = (resp.json().get("chart") or {}).get("result") or []
            if not result:
                return []
            block = result[0]
            timestamps = block.get("timestamp") or []
            closes = ((block.get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
            points = []
            for ts, close in zip(timestamps, closes):
                if close is None:
                    continue
                points.append(
                    {
                        "date": datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d"),
                        "close": round(float(close), 2),
                    }
                )
            return points
    except Exception as exc:
        logger.warning("History fetch failed for %s: %s", symbol, exc)
        return []
