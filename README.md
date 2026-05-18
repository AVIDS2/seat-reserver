# 一考即过座位预约 CLI

Personal CLI for submitting the normal mini-program reservation request with your own account token.

It does not bypass captcha, signatures, rate limits, login checks, or any server-side controls.

## Config

Copy the example file:

```bash
cp .env.example .env
chmod 600 .env
```

Edit `.env`:

```bash
BOOK_TOKEN=<TOKEN_FROM_REQABLE>
BOOK_USERNAME=<USERNAME>
BOOK_PASSWORD=<PASSWORD>
BOOK_PRIMARY_SEAT=197
BOOK_BACKUP_SEATS=211
BOOK_TIME_CANDIDATES=840-1320,780-1260,900-1320
```

Time values are minutes after midnight:

```text
14:00 = 840
22:00 = 1320
```

## Fallback Strategy

The script uses seat-major ordering:

```text
197 14:00-22:00
197 13:00-21:00
197 15:00-22:00
211 14:00-22:00
211 13:00-21:00
211 15:00-22:00
```

It stops immediately after the first success. Keep `BOOK_MAX_ATTEMPTS` small and bounded.

## Token Refresh

Before booking, the script calls:

```text
GET /cczukaoyan/rest/v2/user
```

If the token is invalid and `BOOK_AUTO_REFRESH_TOKEN=true`, it refreshes normally through:

```text
GET /cczukaoyan/rest/auth?username=...&password=...
```

The refreshed token is written back to `.env` when `BOOK_PERSIST_REFRESHED_TOKEN=true`.

## Run Once

```bash
python3 seat_reserver.py --date "$(date +%F)"
```

If the server rejects the request because `X-hmac-request-key` is required, refresh the token/request headers from the normal mini-program flow. This tool intentionally does not reverse or bypass request signing.

## Debian 12 Deployment

Install Python if needed:

```bash
sudo apt update
sudo apt install -y python3
```

Place this project somewhere stable, for example:

```bash
mkdir -p ~/seat-reserver
```

Use cron to run at 06:00:01 in China time. On a US VPS, set the cron timezone explicitly:

```bash
crontab -e
```

Add:

```cron
CRON_TZ=Asia/Shanghai
0 6 * * * sleep 1; cd /home/YOUR_USER/seat-reserver && /usr/bin/python3 seat_reserver.py >> seat_reserver.log 2>&1
```

Check logs:

```bash
tail -n 100 ~/seat-reserver/seat_reserver.log
```
