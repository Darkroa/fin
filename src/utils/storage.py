"""
Storage utility: upload images/files to cloud storage or local fallback.

Priority order:
  1. S3-compatible (boto3) — if SUPABASE_KEY_ID + SUPABASE_ACCESS_KEY + ENDPOINT_URL + REGION are set
  2. Supabase Storage client — if SUPABASE_URL + SUPABASE_KEY are set
  3. Local /uploads/ folder — always available as last resort
"""

import os
import uuid
import base64
from pathlib import Path
from loguru import logger

# ── S3-compatible credentials (Supabase Storage S3 API or any S3-compatible) ──
S3_KEY_ID     = os.getenv("SUPABASE_KEY_ID", "").strip()
S3_ACCESS_KEY = os.getenv("SUPABASE_ACCESS_KEY", "").strip()
S3_ENDPOINT   = os.getenv("ENDPOINT_URL", "").strip()
S3_REGION     = os.getenv("REGION", "auto").strip()
S3_BUCKET     = os.getenv("S3_BUCKET", "Finstroage").strip()

# ── Supabase client credentials ────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()
BUCKET       = os.getenv("STORAGE_BUCKET", "Finstroage")
FOLDER       = os.getenv("STORAGE_FOLDER", "amen")

LOCAL_UPLOADS_DIR = Path(__file__).parent.parent.parent / "uploads"
LOCAL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# ── Availability checks ────────────────────────────────────────────────────────

def _s3_available() -> bool:
    return bool(S3_KEY_ID and S3_ACCESS_KEY and S3_ENDPOINT)


def _supabase_available() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY)


# ── S3-compatible upload (boto3) ───────────────────────────────────────────────

def _upload_s3(content: bytes, fname: str, mime: str) -> str | None:
    """Upload via boto3 S3-compatible API. Returns public URL or None on failure."""
    try:
        import boto3
        from botocore.config import Config

        s3 = boto3.client(
            "s3",
            region_name=S3_REGION or "auto",
            endpoint_url=S3_ENDPOINT,
            aws_access_key_id=S3_KEY_ID,
            aws_secret_access_key=S3_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
        )

        key = f"{FOLDER}/{fname}"
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=content,
            ContentType=mime,
        )

        # Supabase's S3 endpoint is an upload API endpoint, not the public
        # object URL. Prefer the canonical public Storage URL when available.
        # Keep the generic S3 form for other S3-compatible providers.
        if SUPABASE_URL:
            public_url = (
                f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/"
                f"{S3_BUCKET}/{key}"
            )
        else:
            endpoint = S3_ENDPOINT.rstrip("/")
            public_url = f"{endpoint}/{S3_BUCKET}/{key}"
        logger.info(f"Uploaded via S3 API: {public_url}")
        return public_url

    except ImportError:
        logger.warning("boto3 not installed — S3 upload unavailable")
        return None
    except Exception as exc:
        logger.warning(f"S3 upload failed: {exc}")
        return None


# ── Supabase client upload ─────────────────────────────────────────────────────

def _get_supabase_client():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def _ensure_bucket(client) -> bool:
    try:
        buckets = client.storage.list_buckets()
        names = [b.name for b in buckets]
        if BUCKET not in names:
            client.storage.create_bucket(BUCKET, options={"public": True})
            logger.info(f"Created Supabase Storage bucket: {BUCKET}")
        return True
    except Exception as exc:
        logger.warning(f"Supabase bucket check failed: {exc}")
        return False


def _upload_supabase(content: bytes, fname: str, mime: str) -> str | None:
    """Upload via Supabase client library. Returns public URL or None on failure."""
    try:
        client = _get_supabase_client()
        if not _ensure_bucket(client):
            return None
        path = f"{FOLDER}/{fname}"
        client.storage.from_(BUCKET).upload(
            path=path,
            file=content,
            file_options={"content-type": mime, "upsert": "true"},
        )
        public_url = client.storage.from_(BUCKET).get_public_url(path)
        logger.info(f"Uploaded to Supabase Storage: {public_url}")
        return public_url
    except Exception as exc:
        logger.warning(f"Supabase client upload failed: {exc}")
        return None


# ── Public API ─────────────────────────────────────────────────────────────────

def upload_image(content: bytes, mime: str = "image/jpeg", filename: str | None = None) -> str:
    """
    Upload raw image bytes. Returns a public URL string.

    Priority:
      1. S3-compatible (boto3) if SUPABASE_KEY_ID + SUPABASE_ACCESS_KEY + ENDPOINT_URL set
      2. Supabase Storage client if SUPABASE_URL + SUPABASE_KEY set
      3. Local /uploads/ folder (always available)
    """
    ext  = _ext_from_mime(mime)
    fname = filename or f"{uuid.uuid4().hex}{ext}"

    if _s3_available():
        url = _upload_s3(content, fname, mime)
        if url:
            return url
        logger.warning("S3 upload failed — trying Supabase client next")

    if _supabase_available():
        url = _upload_supabase(content, fname, mime)
        if url:
            return url
        logger.warning("Supabase client upload failed — saving locally")

    return _save_local(content, fname)


def upload_image_from_base64(data_url_or_b64: str, mime: str = "image/jpeg", filename: str | None = None) -> str:
    """
    Accept either a data-URL (data:image/...;base64,...) or a raw base64 string.
    Returns a public/relative URL.
    """
    if data_url_or_b64.startswith("data:"):
        header, b64part = data_url_or_b64.split(",", 1)
        detected_mime = header.split(":")[1].split(";")[0]
        mime = detected_mime or mime
        raw = base64.b64decode(b64part)
    else:
        raw = base64.b64decode(data_url_or_b64)

    return upload_image(raw, mime=mime, filename=filename)


def _save_local(content: bytes, fname: str) -> str:
    dest = LOCAL_UPLOADS_DIR / fname
    dest.write_bytes(content)
    logger.info(f"Saved image locally: {dest}")
    return f"/uploads/{fname}"


def _ext_from_mime(mime: str) -> str:
    mapping = {
        "image/jpeg":   ".jpg",
        "image/jpg":    ".jpg",
        "image/png":    ".png",
        "image/gif":    ".gif",
        "image/webp":   ".webp",
        "image/svg+xml": ".svg",
        "application/pdf": ".pdf",
    }
    return mapping.get(mime.lower(), ".jpg")
