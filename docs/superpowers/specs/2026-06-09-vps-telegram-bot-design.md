# VPS Telegram Bot V1 Design

## Goal

Build a single-user Telegram bot that runs on the existing VPS and acts as a lightweight operations bot. The first shipping use case is seat reservation monitoring. The bot should send status notifications and respond to simple commands without changing the existing booking flow.

This is a VPS bot foundation, not a one-off seat script wrapper. Seat reservation is the first module. Later modules can add system monitoring, technical news feeds, and GitHub trending summaries.

## Scope

### In Scope for V1

- Deploy on the existing seat reservation VPS.
- Serve exactly one Telegram chat.
- Use Telegram long polling. No webhook, no public port exposure.
- Read local files and local process state directly from the VPS.
- Push seat reservation notifications automatically.
- Support simple Telegram commands for status and logs.
- Provide basic VPS health information relevant to the booking workflow.

### Out of Scope for V1

- Multi-user support.
- Database-backed storage.
- Admin UI or web panel.
- AI features.
- News feeds, GitHub trending, or external content aggregation.
- Remote control actions like restart, git pull, or arbitrary shell execution.

## Constraints

- Must not break the current stable `seat_reserver.py` workflow.
- Must not require opening new inbound network ports.
- Must keep secrets out of Git.
- Must degrade safely if Telegram API is temporarily unavailable.
- Must avoid duplicate notifications when cron jobs append multiple lines quickly.

## Recommended Architecture

Use a lightweight modular Python bot within the current repository.

```text
seat-reserver/
  seat_reserver.py
  bot/
    __init__.py
    main.py
    router.py
    telegram_api.py
    state_store.py
    config.py
    modules/
      seat.py
      system.py
    services/
      log_reader.py
      notifier.py
      health.py
  tests/
    test_bot_*.py
  .env.bot.example
```

## Design Decision

### Option A: Single-file bot

- Fastest to ship.
- Highest risk of turning into a large mixed script.
- Poor fit for later feature growth.

### Option B: Lightweight modular bot

- Slightly more upfront structure.
- Clear module boundaries.
- Easy to extend with future `feed`, `github`, or `server` modules.
- Best fit for current and future requirements.

### Option C: Full service platform bot

- Too heavy for V1.
- Would force premature choices like database schema, job queue, and permission model.

### Recommendation

Choose **Option B**.

## Runtime Model

Two processes, both local to the VPS:

1. `bot/main.py`
   - Long polls Telegram updates.
   - Handles commands.
   - Sends replies.

2. `bot/services/notifier.py`
   - Runs from cron every minute.
   - Reads new log lines from `a.log` and `f.log`.
   - Detects important seat events.
   - Sends push notifications once.

This split keeps command handling and scheduled notification logic simple. If the polling process dies, push notifications can still continue once restarted. If the notifier fails once, next minute retry is straightforward.

## State Storage

Use a small local JSON file, for example:

```text
/opt/seat-reserver/bot_state.json
```

Stored fields:

- `chat_id`
- `last_a_log_offset`
- `last_f_log_offset`
- `last_sent_event_keys`
- `last_health_summary_at`

This is enough for V1. No database needed.

## Telegram Auth Model

V1 is single-user only.

Rules:

- The allowed Telegram `chat_id` is configured in `.env.bot`.
- `/start` replies only if the chat matches the configured `chat_id`, or optionally allows first-run bind when `TG_CHAT_ID` is empty.
- All other chats are ignored or receive a generic denial message.

Recommended first version:

- Require explicit `TG_CHAT_ID`.
- Avoid auto-binding to reduce accidental exposure.

## Commands

### Required Commands

- `/start`
  - Confirms the bot is online.
- `/help`
  - Lists available commands.
- `/ping`
  - Returns a simple alive response.
- `/status`
  - Shows today’s primary seat reservation status from `a.log`.
- `/friend`
  - Shows friend reservation status from `f.log`.
- `/logs`
  - Returns a short recent log summary for both accounts.
- `/health`
  - Shows booking-chain health summary.

### Command Output Style

Keep messages compact and readable in Telegram.

Example `/status`:

```text
今日抢座状态
账号：主账号
日期：2026-06-10
结果：成功
座位：44号
时间：14:00-22:00
回执：0131-123-4
```

Example `/health`:

```text
VPS 状态
cron：正常
1panel-agent：active
磁盘：31%
内存：42%
最近预热：成功
最近抢座：成功
```

## Seat Module

### Inputs

- `/opt/seat-reserver/a.log`
- `/opt/seat-reserver/f.log`

### Detected Events

- `Token refresh success`
- `Token refresh failed`
- `Token check failed`
- `Reservation success`
- `Reservation failed`
- `Booking window exhausted`
- transient DNS/network retry lines

### Parsing Strategy

Parse log blocks by grouping lines around known markers.

For example:

- start of attempt block: `Attempt X/Y: ...`
- result block:
  - `Reservation success`
  - `Reservation failed`
- metadata lines:
  - `receipt:`
  - `date:`
  - `time:`
  - `location:`

The parser should return structured events, not raw strings.

Suggested event schema:

```python
{
  "account": "me" | "friend",
  "kind": "reservation_success" | "reservation_failed" | "token_refresh_failed" | ...,
  "timestamp": "...",
  "date": "...",
  "seat_text": "...",
  "message": "...",
  "dedupe_key": "..."
}
```

## Notification Policy

### Push Events

Send Telegram push for:

- prewarm success
- prewarm failure
- reservation success
- reservation failure
- abnormal health event that affects tomorrow morning booking confidence

### Deduplication

Use a `dedupe_key` derived from:

- account
- event kind
- target date
- receipt or message fingerprint

Store recent keys in `bot_state.json` so cron reruns do not resend the same message.

## System Module

### `/health` should include

- `systemctl is-active cron`
- `systemctl is-active 1panel-agent`
- disk usage for `/`
- memory usage summary
- latest successful token refresh timestamp
- latest reservation result for each account

### Not included in V1

- CPU time series
- docker inventory
- process list dump
- restart actions

## Configuration

Add a separate env file:

```text
.env.bot
```

Example keys:

```env
TG_BOT_TOKEN=<telegram_bot_token>
TG_CHAT_ID=<your_chat_id>
BOT_STATE_PATH=/opt/seat-reserver/bot_state.json
BOT_A_LOG_PATH=/opt/seat-reserver/a.log
BOT_F_LOG_PATH=/opt/seat-reserver/f.log
BOT_TIMEZONE=Asia/Shanghai
BOT_POLL_TIMEOUT_SECONDS=30
BOT_LOG_TAIL_LINES=40
```

Keep `.env.bot` out of Git.

## Deployment

### Bot command process

Run as a persistent systemd service:

```text
python3 -m bot.main --env /opt/seat-reserver/.env.bot
```

This is better than cron for long polling.

### Notifier process

Run every minute from cron:

```cron
* * * * * cd /opt/seat-reserver && /usr/bin/python3 -m bot.services.notifier --env /opt/seat-reserver/.env.bot >> /opt/seat-reserver/bot_notifier.log 2>&1
```

## Error Handling

- Telegram send failure: log locally, retry on next cron interval if event is still unsent.
- Missing logs: return a clear status instead of crashing.
- Corrupt `bot_state.json`: rebuild from empty state and log warning.
- Unknown log lines: ignore unless they match a future event pattern.

## Security

- Only accept commands from the configured chat id.
- Never echo secrets, tokens, or raw `.env` content into Telegram.
- Truncate logs before sending.
- Avoid shell command passthrough in V1.

## Testing

### V1 Required Tests

- parse success block from `a.log`
- parse failure block from `a.log`
- parse token refresh failure
- dedupe logic prevents duplicate sends
- command router rejects unauthorized chat id
- `/status` formatting from parsed event
- `/health` formatting with mocked service checks

### V1 Verification

- unit tests with `python -m unittest`
- syntax check with `python -m py_compile`
- manual Telegram smoke test on VPS

## Future Extension Path

Planned later modules:

- `modules/github.py`
- `modules/feed.py`
- `modules/server.py`

These should plug into the same router and notifier model without changing bot core.

## V1 Success Criteria

V1 is complete when:

- The bot replies to `/ping`, `/help`, `/status`, `/friend`, `/logs`, `/health`
- Daily reservation success/failure is automatically pushed to Telegram once
- Prewarm failures are pushed to Telegram once
- Unauthorized chats cannot query bot state
- Existing seat reservation workflow remains unchanged
