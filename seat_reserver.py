#!/usr/bin/env python3
"""
Personal seat reservation CLI for the "一考即过座位预约" mini program.

This script sends the same normal booking request your account can submit in
the mini program. It does not bypass verification, signatures, limits, or
server-side controls.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib import error, parse, request


DEFAULT_API_URL = "https://leosys.cn/cczukaoyan/rest/v2/freeBook"
DEFAULT_AUTH_URL = "https://leosys.cn/cczukaoyan/rest/auth"
DEFAULT_USER_URL = "https://leosys.cn/cczukaoyan/rest/v2/user"
DEFAULT_REFERER = "https://servicewechat.com/wxd0a21b477b3ac4f2/56/page-frame.html"
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 "
    "MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI "
    "MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) "
    "UnifiedPCWindowsWechat(0xf2541938) XWEB/19823"
)
MIN_BOOKING_ATTEMPT_TIMEOUT_SECONDS = 0.5


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class BookingCandidate:
    seat_id: str
    start_time: int
    end_time: int


@dataclass
class Config:
    api_url: str
    auth_url: str
    user_url: str
    token: str
    username: str
    password: str
    auto_refresh_token: bool
    persist_refreshed_token: bool
    candidates: list[BookingCandidate]
    max_attempts: int
    attempt_delay_seconds: float
    request_timeout_seconds: float
    network_retry_attempts: int
    network_retry_delay_seconds: float
    token_refreshed_at_epoch: int
    assume_fresh_token_seconds: int
    booking_window_seconds: float
    booking_request_timeout_seconds: float
    hmac_request_key: str
    user_agent: str
    referer: str
    env_path: Path


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def getenv(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None or value == "":
        raise ConfigError(f"Missing required environment variable: {name}")
    return value


def getenv_optional(name: str, default: str = "") -> str:
    value = os.getenv(name)
    if value is None:
        return default
    return value


def getenv_bool(name: str, default: bool) -> bool:
    value = getenv_optional(name, str(default)).strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    raise ConfigError(f"{name} must be true or false, got {value!r}")


def getenv_int(name: str, default: int) -> int:
    value = getenv(name, str(default))
    try:
        return int(value)
    except ValueError as exc:
        raise ConfigError(f"{name} must be an integer, got {value!r}") from exc


def getenv_float(name: str, default: float) -> float:
    value = getenv(name, str(default))
    try:
        return float(value)
    except ValueError as exc:
        raise ConfigError(f"{name} must be a number, got {value!r}") from exc


def parse_time_range(value: str) -> tuple[int, int]:
    if "-" not in value:
        raise ConfigError(f"Invalid time candidate {value!r}; expected START-END")

    start_raw, end_raw = value.split("-", 1)
    try:
        start_time = int(start_raw)
        end_time = int(end_raw)
    except ValueError as exc:
        raise ConfigError(f"Invalid time candidate {value!r}; expected integer minutes") from exc

    validate_time_range(start_time, end_time)
    return start_time, end_time


def validate_time_range(start_time: int, end_time: int) -> None:
    if not 0 <= start_time <= 1440:
        raise ConfigError("start time must be between 0 and 1440")
    if not 0 <= end_time <= 1440:
        raise ConfigError("end time must be between 0 and 1440")
    if end_time <= start_time:
        raise ConfigError("end time must be greater than start time")


def parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def build_candidates() -> list[BookingCandidate]:
    primary_seat = getenv_optional("BOOK_PRIMARY_SEAT") or getenv_optional("BOOK_SEAT_ID", "197")
    backup_seats = parse_csv(getenv_optional("BOOK_BACKUP_SEATS"))
    all_seats = [primary_seat, *[seat for seat in backup_seats if seat != primary_seat]]

    default_range = f"{getenv_int('BOOK_START_TIME', 840)}-{getenv_int('BOOK_END_TIME', 1320)}"
    time_ranges = parse_csv(getenv_optional("BOOK_TIME_CANDIDATES", default_range))
    if not time_ranges:
        time_ranges = [default_range]

    parsed_ranges = [parse_time_range(item) for item in time_ranges]
    candidates: list[BookingCandidate] = []

    # Seat-major ordering: keep the preferred seat across fallback times first,
    # then try backup seats. This preserves the "44号优先" goal.
    for seat_id in all_seats:
        for start_time, end_time in parsed_ranges:
            candidates.append(BookingCandidate(seat_id=seat_id, start_time=start_time, end_time=end_time))

    if not candidates:
        raise ConfigError("No booking candidates configured")

    return candidates


def load_config(env_path: Path) -> Config:
    load_dotenv(env_path)

    candidates = build_candidates()
    max_attempts = getenv_int("BOOK_MAX_ATTEMPTS", min(len(candidates), 8))
    if max_attempts <= 0:
        raise ConfigError("BOOK_MAX_ATTEMPTS must be > 0")

    username = getenv_optional("BOOK_USERNAME")
    password = getenv_optional("BOOK_PASSWORD")
    token = getenv_optional("BOOK_TOKEN")
    if not token and not (username and password):
        raise ConfigError("Set BOOK_TOKEN, or set BOOK_USERNAME and BOOK_PASSWORD for token refresh")

    return Config(
        api_url=getenv("BOOK_API_URL", DEFAULT_API_URL),
        auth_url=getenv("BOOK_AUTH_URL", DEFAULT_AUTH_URL),
        user_url=getenv("BOOK_USER_URL", DEFAULT_USER_URL),
        token=token,
        username=username,
        password=password,
        auto_refresh_token=getenv_bool("BOOK_AUTO_REFRESH_TOKEN", True),
        persist_refreshed_token=getenv_bool("BOOK_PERSIST_REFRESHED_TOKEN", True),
        candidates=candidates,
        max_attempts=max_attempts,
        attempt_delay_seconds=getenv_float("BOOK_ATTEMPT_DELAY_SECONDS", 1.2),
        request_timeout_seconds=getenv_float("BOOK_TIMEOUT_SECONDS", 8.0),
        network_retry_attempts=getenv_int("BOOK_NETWORK_RETRY_ATTEMPTS", 3),
        network_retry_delay_seconds=getenv_float("BOOK_NETWORK_RETRY_DELAY_SECONDS", 0.8),
        token_refreshed_at_epoch=getenv_int("BOOK_TOKEN_REFRESHED_AT", 0),
        assume_fresh_token_seconds=getenv_int("BOOK_ASSUME_FRESH_TOKEN_SECONDS", 180),
        booking_window_seconds=getenv_float("BOOK_BOOKING_WINDOW_SECONDS", 20.0),
        booking_request_timeout_seconds=getenv_float("BOOK_BOOKING_REQUEST_TIMEOUT_SECONDS", 3.0),
        hmac_request_key=getenv_optional("BOOK_HMAC_REQUEST_KEY"),
        user_agent=getenv("BOOK_USER_AGENT", DEFAULT_USER_AGENT),
        referer=getenv("BOOK_REFERER", DEFAULT_REFERER),
        env_path=env_path,
    )


def resolve_date(date_arg: str | None) -> str:
    if date_arg:
        return date_arg
    return dt.date.today().isoformat()


def request_headers(config: Config) -> dict[str, str]:
    headers = {
        "Connection": "keep-alive",
        "X-request-id": str(uuid.uuid4()),
        "user_ip": "1.1.1.1",
        "xweb_xhr": "1",
        "loginType": "APPLET",
        "X-request-date": str(int(time.time() * 1000)),
        "User-Agent": config.user_agent,
        "Content-Type": "application/x-www-form-urlencoded",
        "token": config.token,
        "Accept": "*/*",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        "Referer": config.referer,
        "Accept-Language": "zh-CN,zh;q=0.9",
    }

    # Only replay a captured key if the server accepts it. This script does not
    # derive or bypass request signatures.
    if config.hmac_request_key:
        headers["X-hmac-request-key"] = config.hmac_request_key

    return headers


def book_once(
    config: Config,
    date_value: str,
    candidate: BookingCandidate,
    timeout_seconds: float | None = None,
) -> tuple[int, dict[str, Any] | None, str]:
    body = parse.urlencode(
        {
            "seat": candidate.seat_id,
            "date": date_value,
            "startTime": str(candidate.start_time),
            "endTime": str(candidate.end_time),
            "authid": "",
        }
    ).encode("utf-8")

    req = request.Request(
        config.api_url,
        data=body,
        headers=request_headers(config),
        method="POST",
    )

    effective_timeout = timeout_seconds if timeout_seconds is not None else config.booking_request_timeout_seconds
    return send_request_with_retry(config, req, timeout_seconds=effective_timeout)


def get_json(
    config: Config,
    url: str,
    extra_headers: dict[str, str] | None = None,
) -> tuple[int, dict[str, Any] | None, str]:
    headers = request_headers(config)
    if extra_headers:
        headers.update(extra_headers)

    req = request.Request(url, headers=headers, method="GET")
    return send_request_with_retry(config, req)


def send_request_with_retry(
    config: Config,
    req: request.Request,
    timeout_seconds: float | None = None,
) -> tuple[int, dict[str, Any] | None, str]:
    attempts = max(1, config.network_retry_attempts)
    last_error = ""
    request_timeout = timeout_seconds if timeout_seconds is not None else config.request_timeout_seconds

    for attempt in range(1, attempts + 1):
        try:
            with request.urlopen(req, timeout=request_timeout) as resp:
                text = resp.read().decode("utf-8", errors="replace")
                return resp.status, parse_json(text), text
        except error.HTTPError as exc:
            text = exc.read().decode("utf-8", errors="replace")
            return exc.code, parse_json(text), text
        except error.URLError as exc:
            last_error = str(exc)
            if attempt >= attempts:
                break
            print(
                f"Transient network error on attempt {attempt}/{attempts}: "
                f"{last_error}. Retrying..."
            )
            time.sleep(config.network_retry_delay_seconds)

    return 0, None, last_error


def token_is_valid(config: Config) -> bool:
    if not config.token:
        return False

    status_code, payload, _raw = get_json(config, config.user_url)
    return status_code == 200 and is_success(payload)


def refresh_token(config: Config) -> bool:
    if not (config.username and config.password):
        print("Token refresh skipped: BOOK_USERNAME/BOOK_PASSWORD not configured")
        return False

    query = parse.urlencode({"username": config.username, "password": config.password})
    auth_url = f"{config.auth_url}?{query}"
    status_code, payload, raw = get_json(
        config,
        auth_url,
        extra_headers={
            "Actcode": "true",
            "Content-Type": "application/json",
        },
    )
    if status_code != 200 or not is_success(payload):
        print("Token refresh failed")
        if raw:
            print(raw)
        return False

    data = payload.get("data") or {}
    token = data.get("token")
    if not isinstance(token, str) or not token:
        print("Token refresh failed: response did not contain data.token")
        return False

    config.token = token
    config.token_refreshed_at_epoch = int(time.time())
    print("Token refresh success")
    if config.persist_refreshed_token:
        update_env_value(config.env_path, "BOOK_TOKEN", token)
        update_env_value(
            config.env_path,
            "BOOK_TOKEN_REFRESHED_AT",
            str(config.token_refreshed_at_epoch),
        )
    return True


def ensure_token(config: Config) -> bool:
    if token_recently_refreshed(config):
        print("Token check skipped: recently refreshed")
        return True

    if token_is_valid(config):
        print("Token check success")
        return True

    print("Token check failed")
    if not config.auto_refresh_token:
        return False

    return refresh_token(config)


def token_recently_refreshed(config: Config) -> bool:
    if not config.token:
        return False
    if config.token_refreshed_at_epoch <= 0:
        return False
    if config.assume_fresh_token_seconds <= 0:
        return False

    age_seconds = int(time.time()) - config.token_refreshed_at_epoch
    return 0 <= age_seconds <= config.assume_fresh_token_seconds


def update_env_value(path: Path, key: str, value: str) -> None:
    lines: list[str] = []
    found = False
    if path.exists():
        lines = path.read_text(encoding="utf-8").splitlines()

    for index, line in enumerate(lines):
        if line.startswith(f"{key}="):
            lines[index] = f"{key}={value}"
            found = True
            break

    if not found:
        lines.append(f"{key}={value}")

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_json(text: str) -> dict[str, Any] | None:
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


def is_success(payload: dict[str, Any] | None) -> bool:
    return bool(payload and payload.get("status") == "success" and payload.get("code") == "0")


def print_result(status_code: int, payload: dict[str, Any] | None, raw: str) -> None:
    now = dt.datetime.now().isoformat(timespec="seconds")
    print(f"[{now}] HTTP {status_code}")

    if payload is None:
        print(raw)
        return

    if is_success(payload):
        data = payload.get("data") or {}
        print("Reservation success")
        print(f"receipt: {data.get('receipt', '')}")
        print(f"date: {data.get('onDate', '')}")
        print(f"time: {data.get('begin', '')}-{data.get('end', '')}")
        print(f"location: {data.get('location', '')}")
        return

    print("Reservation failed")
    print(f"code: {payload.get('code', '')}")
    print(f"message: {payload.get('message', '')}")
    if raw:
        print(raw)


def format_time(minutes: int) -> str:
    hour, minute = divmod(minutes, 60)
    return f"{hour:02d}:{minute:02d}"


def run(config: Config, date_value: str) -> int:
    if not ensure_token(config):
        return 1

    candidates = config.candidates
    max_attempts = max(1, config.max_attempts)
    start_time = time.monotonic()
    deadline = start_time + max(0.0, config.booking_window_seconds)

    for attempt in range(1, max_attempts + 1):
        now = time.monotonic()
        remaining_window = deadline - now
        if remaining_window < MIN_BOOKING_ATTEMPT_TIMEOUT_SECONDS:
            print("Booking window exhausted")
            break

        candidate = candidates[(attempt - 1) % len(candidates)]
        per_attempt_timeout = min(
            config.booking_request_timeout_seconds,
            remaining_window,
        )
        print(
            f"Attempt {attempt}/{max_attempts}: "
            f"seat={candidate.seat_id}, date={date_value}, "
            f"time={format_time(candidate.start_time)}-{format_time(candidate.end_time)}"
        )
        status_code, payload, raw = book_once(
            config,
            date_value,
            candidate,
            timeout_seconds=per_attempt_timeout,
        )
        print_result(status_code, payload, raw)

        if is_success(payload):
            return 0

        if attempt < max_attempts:
            remaining_window = deadline - time.monotonic()
            if remaining_window < MIN_BOOKING_ATTEMPT_TIMEOUT_SECONDS:
                print("Booking window exhausted")
                break
            time.sleep(min(config.attempt_delay_seconds, max(0.0, remaining_window)))

    return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Reserve a study-room seat.")
    parser.add_argument(
        "--env",
        default=".env",
        help="Path to env file. Default: .env",
    )
    parser.add_argument(
        "--date",
        help="Booking date in YYYY-MM-DD. Default: today on the server.",
    )
    parser.add_argument(
        "--refresh-token-only",
        action="store_true",
        help="Refresh and persist token, then exit without booking.",
    )
    return parser


def refresh_token_only(config: Config) -> int:
    if config.username and config.password:
        return 0 if refresh_token(config) else 1

    return 0 if ensure_token(config) else 1


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        config = load_config(Path(args.env))
        date_value = resolve_date(args.date)
    except ConfigError as exc:
        print(f"Config error: {exc}", file=sys.stderr)
        return 2

    if args.refresh_token_only:
        return refresh_token_only(config)

    return run(config, date_value)


if __name__ == "__main__":
    raise SystemExit(main())
