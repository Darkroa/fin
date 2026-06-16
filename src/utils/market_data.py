"""Live market data fetcher — used by FinAi agent for context injection."""
import time
import requests
from loguru import logger

_CACHE: dict = {}
_TTL_PRICE   = 60    # seconds for price data
_TTL_DETAIL  = 120   # seconds for detailed coin data

_PAIR_TO_CG: dict[str, str] = {
    "BTC/USDT":  "bitcoin",      "BTC":  "bitcoin",
    "ETH/USDT":  "ethereum",     "ETH":  "ethereum",
    "BNB/USDT":  "binancecoin",  "BNB":  "binancecoin",
    "SOL/USDT":  "solana",       "SOL":  "solana",
    "XRP/USDT":  "ripple",       "XRP":  "ripple",
    "DOGE/USDT": "dogecoin",     "DOGE": "dogecoin",
    "ADA/USDT":  "cardano",      "ADA":  "cardano",
    "AVAX/USDT": "avalanche-2",  "AVAX": "avalanche-2",
    "LINK/USDT": "chainlink",    "LINK": "chainlink",
    "DOT/USDT":  "polkadot",     "DOT":  "polkadot",
    "UNI/USDT":  "uniswap",      "UNI":  "uniswap",
    "MATIC/USDT":"matic-network","MATIC":"matic-network",
    "LTC/USDT":  "litecoin",     "LTC":  "litecoin",
    "XLM/USDT":  "stellar",      "XLM":  "stellar",
}

_TOP_IDS = "bitcoin,ethereum,binancecoin,solana,ripple,dogecoin,cardano,avalanche-2,chainlink,polkadot"

_BINANCE_SYMS: dict[str, str] = {
    "bitcoin":      "BTCUSDT",  "ethereum":    "ETHUSDT",   "binancecoin": "BNBUSDT",
    "solana":       "SOLUSDT",  "ripple":      "XRPUSDT",   "cardano":     "ADAUSDT",
    "dogecoin":     "DOGEUSDT", "polkadot":    "DOTUSDT",   "chainlink":   "LINKUSDT",
    "avalanche-2":  "AVAXUSDT", "matic-network":"MATICUSDT","litecoin":    "LTCUSDT",
    "uniswap":      "UNIUSDT",  "stellar":     "XLMUSDT",
}


def _ts() -> float:
    return time.time()


def _cached(key: str, ttl: int):
    entry = _CACHE.get(key)
    if entry and _ts() - entry["ts"] < ttl:
        return entry["data"]
    return None


def _store(key: str, data):
    _CACHE[key] = {"data": data, "ts": _ts()}
    return data


def get_top_snapshot() -> dict:
    """
    Returns {cg_id: {usd, usd_24h_change, usd_24h_vol, usd_market_cap}} for top assets.
    Tries Binance.US 24hr ticker first (faster/no rate limit), falls back to CoinGecko.
    """
    hit = _cached("top", _TTL_PRICE)
    if hit:
        return hit

    result = {}

    # Primary: Binance.US 24hr ticker batch
    try:
        r = requests.get("https://api.binance.us/api/v3/ticker/24hr", timeout=6)
        if r.status_code == 200:
            tickers = {item["symbol"]: item for item in r.json()}
            for cg_id, sym in _BINANCE_SYMS.items():
                item = tickers.get(sym, {})
                price = float(item.get("lastPrice", 0) or 0)
                chg   = float(item.get("priceChangePercent", 0) or 0)
                vol   = float(item.get("quoteVolume", 0) or 0)
                if price > 0:
                    result[cg_id] = {
                        "usd":             round(price, 8),
                        "usd_24h_change":  round(chg, 4),
                        "usd_24h_vol":     round(vol, 2),
                        "usd_high_24h":    float(item.get("highPrice", 0) or 0),
                        "usd_low_24h":     float(item.get("lowPrice",  0) or 0),
                    }
    except Exception as e:
        logger.warning(f"Binance.US snapshot failed: {e}")

    # Fallback / supplement: CoinGecko simple/price
    if not result:
        try:
            r = requests.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={
                    "ids":                _TOP_IDS,
                    "vs_currencies":      "usd",
                    "include_24hr_change":"true",
                    "include_24hr_vol":   "true",
                    "include_market_cap": "true",
                },
                timeout=8,
            )
            if r.status_code == 200:
                for cg_id, d in r.json().items():
                    result[cg_id] = {
                        "usd":            d.get("usd", 0),
                        "usd_24h_change": d.get("usd_24h_change", 0),
                        "usd_24h_vol":    d.get("usd_24h_vol", 0),
                        "usd_market_cap": d.get("usd_market_cap", 0),
                    }
        except Exception as e:
            logger.warning(f"CoinGecko top snapshot failed: {e}")

    if result:
        _store("top", result)
    else:
        result = _cached("top", 9999) or {}

    return result


def get_pair_detail(pair: str) -> dict:
    """Returns detailed market data for a single pair via CoinGecko /coins/{id}."""
    base   = pair.split("/")[0].upper()
    cg_id  = _PAIR_TO_CG.get(pair.upper()) or _PAIR_TO_CG.get(base)
    if not cg_id:
        return {}

    key = f"detail_{cg_id}"
    hit = _cached(key, _TTL_DETAIL)
    if hit:
        return hit

    try:
        r = requests.get(
            f"https://api.coingecko.com/api/v3/coins/{cg_id}",
            params={"localization": "false", "tickers": "false",
                    "community_data": "false", "developer_data": "false"},
            timeout=10,
        )
        if r.status_code == 200:
            raw  = r.json()
            mkt  = raw.get("market_data", {})
            data = {
                "name":             raw.get("name", cg_id),
                "symbol":           raw.get("symbol", base).upper(),
                "price_usd":        mkt.get("current_price", {}).get("usd", 0),
                "change_24h":       mkt.get("price_change_percentage_24h", 0),
                "change_7d":        mkt.get("price_change_percentage_7d",  0),
                "change_30d":       mkt.get("price_change_percentage_30d", 0),
                "high_24h":         mkt.get("high_24h", {}).get("usd", 0),
                "low_24h":          mkt.get("low_24h",  {}).get("usd", 0),
                "volume_24h":       mkt.get("total_volume",  {}).get("usd", 0),
                "market_cap":       mkt.get("market_cap",    {}).get("usd", 0),
                "market_cap_rank":  raw.get("market_cap_rank"),
                "circulating":      mkt.get("circulating_supply", 0),
                "total_supply":     mkt.get("total_supply", 0),
                "ath":              mkt.get("ath",  {}).get("usd", 0),
                "ath_change_pct":   mkt.get("ath_change_percentage", {}).get("usd", 0),
                "atl":              mkt.get("atl",  {}).get("usd", 0),
            }
            return _store(key, data)
    except Exception as e:
        logger.warning(f"CoinGecko detail failed ({pair}): {e}")

    return _cached(key, 9999) or {}


def build_market_context(
    pair: str,
    price: float = 0,
    change_24h: float = 0,
    high_24h: float = 0,
    low_24h: float = 0,
    volume_24h: float = 0,
) -> str:
    """
    Builds the live-market-data block injected into Fin's system prompt.
    Merges caller-supplied values (from frontend) with fetched detail data.
    """
    lines = ["━━━ LIVE MARKET DATA ━━━"]
    lines.append(f"Asset: {pair}")

    # Enrich with fetched detail if available
    try:
        detail = get_pair_detail(pair)
    except Exception:
        detail = {}

    p      = price      or detail.get("price_usd",  0)
    chg24  = change_24h or detail.get("change_24h", 0)
    hi     = high_24h   or detail.get("high_24h",   0)
    lo     = low_24h    or detail.get("low_24h",    0)
    vol    = volume_24h or detail.get("volume_24h", 0)

    if p > 0:
        lines.append(f"Price (USD):  ${p:,.4f}" if p < 1 else f"Price (USD):  ${p:,.2f}")
    if chg24 != 0:
        sign = "+" if chg24 >= 0 else ""
        lines.append(f"24h Change:   {sign}{chg24:.2f}%  {'▲' if chg24 >= 0 else '▼'}")
    if hi > 0:
        lines.append(f"24h High:     ${hi:,.2f}")
    if lo > 0:
        lines.append(f"24h Low:      ${lo:,.2f}")
    if vol > 0:
        vol_b = vol / 1_000_000_000
        vol_m = vol / 1_000_000
        lines.append(f"24h Volume:   ${vol_b:.2f}B" if vol_b >= 1 else f"24h Volume:   ${vol_m:.1f}M")

    if detail:
        mc = detail.get("market_cap", 0)
        if mc > 0:
            lines.append(f"Market Cap:   ${mc/1_000_000_000:.2f}B")
        if detail.get("market_cap_rank"):
            lines.append(f"CMC Rank:     #{detail['market_cap_rank']}")
        chg7 = detail.get("change_7d")
        if chg7 is not None:
            sign = "+" if chg7 >= 0 else ""
            lines.append(f"7d Change:    {sign}{chg7:.2f}%")
        ath = detail.get("ath", 0)
        if ath > 0:
            lines.append(f"ATH:          ${ath:,.2f}  ({detail.get('ath_change_pct', 0):.1f}% from ATH)")

    # Top 5 market snapshot
    try:
        snap = get_top_snapshot()
        if snap:
            lines.append("\nTop market snapshot:")
            labels = [
                ("bitcoin",     "BTC"),
                ("ethereum",    "ETH"),
                ("solana",      "SOL"),
                ("binancecoin", "BNB"),
                ("ripple",      "XRP"),
            ]
            for cg_id, sym in labels:
                d = snap.get(cg_id, {})
                sp = d.get("usd", 0)
                sc = d.get("usd_24h_change", 0)
                if sp > 0:
                    sign = "+" if sc >= 0 else ""
                    lines.append(f"  {sym}: ${sp:,.2f}  {sign}{sc:.2f}%")
    except Exception:
        pass

    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)
