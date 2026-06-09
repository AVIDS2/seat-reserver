# 一考即过座位预约 CLI

一个用于“一考即过座位预约”小程序的个人预约 CLI 工具。

它的作用是把你自己账号在小程序里可以正常完成的预约请求，放到服务器上按时间自动执行。项目不包含验证码绕过、风控绕过、签名逆向、高频刷接口等能力。

## 功能

- 支持指定座位和预约时间段。
- 支持多个候选座位和候选时间段。
- 成功预约后立即停止，不继续请求。
- 预约前检查 token 是否有效。
- token 失效时，可使用账号密码走正常登录接口刷新 token。
- 支持 Debian 12 / Linux VPS 使用 cron 定时执行。
- 日志记录预约结果、回执号、时间和座位位置。

## 当前默认策略

默认优先抢 44 号座位，60 号座位作为兜底。

候选顺序如下：

```text
1. 44号 14:00-22:00
2. 44号 13:00-21:00
3. 44号 15:00-22:00
4. 60号 14:00-22:00
5. 60号 13:00-21:00
6. 60号 15:00-22:00
```

对应配置：

```env
BOOK_PRIMARY_SEAT=197
BOOK_BACKUP_SEATS=211
BOOK_TIME_CANDIDATES=840-1320,780-1260,900-1320
BOOK_MAX_ATTEMPTS=6
BOOK_ATTEMPT_DELAY_SECONDS=1.2
```

时间使用“当天 00:00 后的分钟数”表示：

```text
13:00 = 780
14:00 = 840
15:00 = 900
21:00 = 1260
22:00 = 1320
```

## 配置

复制配置模板：

```bash
cp .env.example .env
chmod 600 .env
```

编辑 `.env`：

```env
BOOK_TOKEN=<小程序后端 token>
BOOK_USERNAME=<账号>
BOOK_PASSWORD=<密码>

BOOK_PRIMARY_SEAT=197
BOOK_BACKUP_SEATS=211
BOOK_TIME_CANDIDATES=840-1320,780-1260,900-1320

BOOK_MAX_ATTEMPTS=6
BOOK_ATTEMPT_DELAY_SECONDS=1.2
BOOK_TIMEOUT_SECONDS=8
BOOK_NETWORK_RETRY_ATTEMPTS=3
BOOK_NETWORK_RETRY_DELAY_SECONDS=0.8
BOOK_TOKEN_REFRESHED_AT=0
BOOK_ASSUME_FRESH_TOKEN_SECONDS=180
```

真实的 `.env` 不要提交到 Git。项目里的 `.gitignore` 已经忽略 `.env`。

## token 刷新机制

脚本启动后会先请求：

```text
GET /cczukaoyan/rest/v2/user
```

如果 token 有效，就直接开始预约。

如果 token 失效，并且配置了：

```env
BOOK_AUTO_REFRESH_TOKEN=true
BOOK_USERNAME=<账号>
BOOK_PASSWORD=<密码>
```

脚本会通过正常登录接口刷新 token：

```text
GET /cczukaoyan/rest/auth?username=...&password=...
```

刷新成功后，会从响应里的 `data.token` 读取新 token。若配置了：

```env
BOOK_PERSIST_REFRESHED_TOKEN=true
```

新 token 会自动写回 `.env`。

## 瞬时网络重试

为降低 VPS 在 6 点前后遇到瞬时 DNS 或网络抖动时直接失败的概率，脚本会对底层 `URLError` 做有限次短重试。

默认配置：

```env
BOOK_NETWORK_RETRY_ATTEMPTS=3
BOOK_NETWORK_RETRY_DELAY_SECONDS=0.8
BOOK_TOKEN_REFRESHED_AT=0
BOOK_ASSUME_FRESH_TOKEN_SECONDS=180
```

说明：

- `BOOK_NETWORK_RETRY_*` 只针对临时网络错误，不会改变座位候选顺序，也不会增加 `BOOK_MAX_ATTEMPTS` 的业务重试次数。
- `BOOK_TOKEN_REFRESHED_AT` 由脚本在预热成功后自动写回 `.env`。
- `BOOK_ASSUME_FRESH_TOKEN_SECONDS` 用来让 6 点的正式预约在 token 刚刚预热成功后，跳过 `/rest/v2/user` 校验，直接进入预约，减少关键窗口里的额外网络请求。

## 手动运行

运行当天预约：

```bash
python3 seat_reserver.py
```

指定日期：

```bash
python3 seat_reserver.py --date 2026-05-18
```

指定配置文件：

```bash
python3 seat_reserver.py --env /path/to/.env
```

只刷新 token，不预约：

```bash
python3 seat_reserver.py --refresh-token-only
```

## Debian 12 部署

安装 Python：

```bash
sudo apt update
sudo apt install -y python3 git
```

拉取项目：

```bash
git clone https://github.com/AVIDS2/seat-reserver.git
cd seat-reserver
cp .env.example .env
chmod 600 .env
```

编辑配置：

```bash
nano .env
```

手动测试：

```bash
python3 seat_reserver.py --date "$(date +%F)"
```

## 定时任务

建议使用两段 cron：`05:59:45` 先刷新 token，`06:00:01` 再直接预约。这样可以避免 6 点后再耗时登录。

编辑 crontab：

```bash
crontab -e
```

添加：

```cron
CRON_TZ=Asia/Shanghai
59 5 * * * sleep 45; cd /home/YOUR_USER/seat-reserver && /usr/bin/python3 seat_reserver.py --refresh-token-only >> seat_reserver.log 2>&1
0 6 * * * sleep 1; cd /home/YOUR_USER/seat-reserver && /usr/bin/python3 seat_reserver.py >> seat_reserver.log 2>&1
```

把 `/home/YOUR_USER/seat-reserver` 改成你的实际项目路径。

查看日志：

```bash
tail -n 100 seat_reserver.log
```

持续查看日志：

```bash
tail -f seat_reserver.log
```

## 运行流程

```text
1. 05:59:45 预热任务刷新 token，并写回 .env
2. 06:00:01 预约任务启动
3. 读取 .env 配置
4. 检查 token 是否有效
5. token 有效时直接进入预约
6. 按候选座位和候选时间段依次预约
7. 第一个成功后立即停止
8. 全部失败后退出并写日志
```

## 注意事项

- 不要把真实 `.env`、token、账号密码提交到公开仓库。
- 候选数量不要设置过大，避免不必要的高频请求。
- 如果服务端调整接口、签名或登录规则，需要重新抓取正常请求并更新配置。
- 如果账号当天已有预约，新的预约请求可能会失败。
- 如果预约成功后需要取消，请在小程序里手动处理，注意每日取消次数限制。

## 开发验证

语法检查：

```bash
python3 -m py_compile seat_reserver.py
```

查看帮助：

```bash
python3 seat_reserver.py --help
```
