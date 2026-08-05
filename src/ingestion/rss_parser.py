import feedparser
from newspaper import Article
from datetime import datetime, timedelta
import json
import os
import socket
from pathlib import Path
from urllib.parse import urlparse
from loguru import logger

DATA_DIR = Path("data/raw_news")
DATA_DIR.mkdir(parents=True, exist_ok=True)
ARTICLE_DOWNLOAD_TIMEOUT = 10  # seconds — newspaper3k has no default cap
_ARTICLE_MAX_BYTES = 2 * 1024 * 1024  # 2 MB cap per article HTML payload
_RETENTION_DAYS = int(os.getenv("RAW_NEWS_RETENTION_DAYS", "7"))


def _is_safe_url(url: str) -> bool:
    """SSRF guard: only http(s) to non-private/non-loopback hosts.
    Keeps the parser usable for normal news feeds while blocking requests to
    169.254.169.254, localhost, RFC1918 ranges, etc."""
    try:
        p = urlparse(url)
        if p.scheme not in ("http", "https"):
            return False
        host = (p.hostname or "").lower()
        if not host:
            return False
        # Reject IP literals that resolve to private/loopback/link-local.
        try:
            infos = socket.getaddrinfo(host, None)
        except socket.gaierror:
            return False
        for fam, _t, _p, _c, sockaddr in infos:
            ip = sockaddr[0]
            try:
                import ipaddress
                ip_obj = ipaddress.ip_address(ip)
                if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
                    return False
            except ValueError:
                return False
        return True
    except Exception:
        return False


def _cleanup_old_news() -> None:
    """Remove news files older than _RETENTION_DAYS to bound disk usage."""
    try:
        cutoff = datetime.now() - timedelta(days=_RETENTION_DAYS)
        removed = 0
        for p in DATA_DIR.glob("news_*.json"):
            try:
                if datetime.fromtimestamp(p.stat().st_mtime) < cutoff:
                    p.unlink()
                    removed += 1
            except Exception:
                continue
        if removed:
            logger.info(f"Pruned {removed} old news files (>{_RETENTION_DAYS}d)")
    except Exception as e:
        logger.warning(f"news retention cleanup failed: {e}")


def parse_rss_feed(url: str, limit: int = 20):
    """Parse RSS feed and download full article text.

    Defenses:
      - SSRF guard on the feed URL itself.
      - Per-article download timeout (newspaper3k default is uncapped).
      - Per-article byte cap to avoid memory blow-up on slow-loris responses.
    """
    if not _is_safe_url(url):
        logger.warning(f"Refusing RSS feed (URL failed SSRF guard): {url}")
        return []
    feed = feedparser.parse(url)
    articles = []

    for entry in feed.entries[:limit]:
        try:
            link = getattr(entry, "link", "")
            if not _is_safe_url(link):
                logger.warning(f"Skipping entry (bad link): {link[:80]}")
                continue
            article = Article(link)
            # newspaper3k exposes config; setting both timeout and memoize_articles=False
            # prevents an unbounded download.
            article.config.request_timeout = ARTICLE_DOWNLOAD_TIMEOUT
            article.config.memoize_articles = False
            article.download()
            # Enforce a byte cap on the raw HTML.
            if hasattr(article, "html") and article.html and len(article.html) > _ARTICLE_MAX_BYTES:
                logger.warning(f"Skipping oversized article ({len(article.html)} bytes): {link[:80]}")
                continue
            article.parse()
            full_text = (article.text or "")[:50_000]  # cap before LLM prompt

            articles.append({
                "title": entry.title,
                "link": link,
                "summary": entry.get("summary", ""),
                "published": entry.get("published", datetime.now().isoformat()),
                "full_text": full_text,
                "authors": article.authors,
                "source": feed.feed.title if hasattr(feed.feed, "title") else "Unknown",
                "fetched_at": datetime.now().isoformat()
            })
            logger.info(f"✅ Parsed: {entry.title[:60]}...")
        except Exception as e:
            logger.warning(f"Failed to parse {getattr(entry, 'link', '?')}: {e}")

    return articles


def save_articles(articles, filename: str = None):
    if not filename:
        filename = f"news_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    path = DATA_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    logger.success(f"💾 Saved {len(articles)} articles → {path}")
    _cleanup_old_news()