# core/stock_client.py
from decimal import Decimal
import requests
from django.conf import settings

ALPHAVANTAGE_BASE = "https://www.alphavantage.co/query"

# Fallback quotes (used if external fetch fails or is unavailable)
_FALLBACK_QUOTES = {
    "AAPL": {"symbol": "AAPL", "name": "Apple Inc.", "price": 178.45, "change": 1.24, "changePct": 0.7},
    "MSFT": {"symbol": "MSFT", "name": "Microsoft", "price": 326.10, "change": -2.31, "changePct": -0.7},
    "NVDA": {"symbol": "NVDA", "name": "NVIDIA", "price": 468.90, "change": 5.12, "changePct": 1.1},
    "AMZN": {"symbol": "AMZN", "name": "Amazon", "price": 133.40, "change": 0.92, "changePct": 0.7},
    "GOOGL": {"symbol": "GOOGL", "name": "Alphabet", "price": 138.75, "change": -1.10, "changePct": -0.8},
}
ALPHAVANTAGE_API_KEY = getattr(settings, "ALPHAVANTAGE_API_KEY", None)


def fetch_stock_quote(symbol: str) -> dict:
    """
    Fetch a single symbol using AlphaVantage GLOBAL_QUOTE endpoint.
    """
    if not ALPHAVANTAGE_API_KEY:
        raise RuntimeError("ALPHAVANTAGE_API_KEY is not configured")

    params = {
      "function": "GLOBAL_QUOTE",
      "symbol": symbol,
      "apikey": ALPHAVANTAGE_API_KEY,
    }

    r = requests.get(ALPHAVANTAGE_BASE, params=params, timeout=10)
    r.raise_for_status()
    data = r.json()

    quote = data.get("Global Quote") or data.get("globalQuote") or {}

    if not quote:
        raise RuntimeError(f"No quote returned for {symbol}: {data}")

    # AlphaVantage uses funky keys like "05. price"
    price = Decimal(quote.get("05. price", "0") or "0")
    change = Decimal(quote.get("09. change", "0") or "0")
    change_pct = quote.get("10. change percent", "0%").strip("%")
    change_pct = Decimal(change_pct or "0")

    return {
        "symbol": quote.get("01. symbol", symbol),
        "name": symbol,  # free tier doesn’t give company name, we can fake it
        "price": price,
        "change": change,
        "changePct": change_pct,
    }


def fetch_stock_quotes(symbols: list[str]) -> list[dict]:
    """
    Fetch multiple symbols, one by one (simple but fine for demo).
    If one symbol fails, we skip it instead of blowing up the whole list.
    """
    results = []
    for sym in symbols:
        try:
            results.append(fetch_stock_quote(sym))
        except Exception:
            # You can log here if you want, but don’t break everything
            continue

    # Fallback: if nothing was fetched (e.g., no network/API limits), return static quotes
    if not results:
        for sym in symbols:
            key = sym.strip().upper()
            if not key:
                continue
            if key in _FALLBACK_QUOTES:
                results.append(_FALLBACK_QUOTES[key])
            else:
                results.append(
                    {
                        "symbol": key,
                        "name": key,
                        "price": Decimal("100.00"),
                        "change": Decimal("0"),
                        "changePct": Decimal("0"),
                    }
                )
    return results
