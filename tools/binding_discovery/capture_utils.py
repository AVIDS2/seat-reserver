from __future__ import annotations

import json
from copy import deepcopy
from typing import Any
from urllib.parse import parse_qsl, quote_plus, urlsplit, urlunsplit


CAPTURE_HOSTS = {
    "leosys.cn",
    "xsq.leosys.cn",
    "202.195.100.14",
    "sso.cczu.edu.cn",
}

BLOCK_PATH_FRAGMENTS = {
    "/freeBook",
}

SENSITIVE_KEYS = {
    "authorization",
    "cookie",
    "password",
    "passwd",
    "pwd",
    "token",
    "access_token",
    "refresh_token",
    "book_token",
    "school_password",
}


def should_capture_url(url: str) -> bool:
    host = urlsplit(url).hostname or ""
    return host in CAPTURE_HOSTS or host.endswith(".leosys.cn")


def should_block_url(url: str) -> bool:
    path = urlsplit(url).path
    return any(fragment in path for fragment in BLOCK_PATH_FRAGMENTS)


def mask_secret(value: str) -> str:
    if not value:
        return value
    if len(value) <= 6:
        return "***"
    return f"{value[:3]}***{value[-3:]}"


def _is_sensitive_key(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    return normalized in SENSITIVE_KEYS or any(part in normalized for part in ("password", "token"))


def sanitize_url(url: str) -> str:
    parts = urlsplit(url)
    query = []
    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        query.append((key, "***" if _is_sensitive_key(key) else value))
    encoded_query = "&".join(
        f"{quote_plus(key)}={'***' if value == '***' else quote_plus(value)}"
        for key, value in query
    )
    return urlunsplit((parts.scheme, parts.netloc, parts.path, encoded_query, parts.fragment))


def sanitize_value(key: str, value: Any) -> Any:
    if key == "url" and isinstance(value, str):
        return sanitize_url(value)
    if _is_sensitive_key(key) and isinstance(value, str):
        return mask_secret(value)
    if _is_sensitive_key(key):
        return "***"
    return sanitize_any(value)


def sanitize_any(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: sanitize_value(str(key), item) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize_any(item) for item in value]
    if isinstance(value, str):
        return sanitize_text(value)
    return value


def sanitize_text(text: str) -> str:
    stripped = text.strip()
    if not stripped:
        return text

    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return sanitize_form_text(text)

    return json.dumps(sanitize_any(parsed), ensure_ascii=False)


def sanitize_form_text(text: str) -> str:
    if "=" not in text or "://" in text:
        return text

    pairs = []
    changed = False
    for key, value in parse_qsl(text, keep_blank_values=True):
        if _is_sensitive_key(key):
            pairs.append((key, "***"))
            changed = True
        else:
            pairs.append((key, value))

    if not changed:
        return text
    return "&".join(f"{quote_plus(key)}={quote_plus(value)}" for key, value in pairs)


def sanitize_record(record: dict[str, Any]) -> dict[str, Any]:
    sanitized = deepcopy(record)
    return sanitize_any(sanitized)
