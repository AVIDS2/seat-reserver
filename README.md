# 席定高校座位预约平台

席定是面向高校场景的座位预约平台；根目录同时保留底层个人预约 CLI，作为现有稳定自动执行链路。

它的作用是把你自己账号在小程序里可以正常完成的预约请求，放到服务器上按时间自动执行。项目不包含验证码绕过、风控绕过、签名逆向、高频刷接口等能力。

## 功能

- 支持指定座位和预约时间段。
- 支持多个候选座位和候选时间段。
- 成功预约后立即停止，不继续请求。
- 预约前检查 token 是否有效。
- token 失效时，可使用账号密码走正常登录接口刷新 token。
- 支持 Debian 12 / Linux VPS 使用 cron 定时执行。
- 日志记录预约结果、回执号、时间和座位位置。

## Web 预约控制台

`web/` 是基于 Kiranism Next.js Dashboard Starter 的席定前端控制台，提供总览、预约任务、座位图、我的预约、账号与授权、运行记录、通知中心和管理员工作台。生产构建通过同域 `/api/v1` 调用平台 API；只有显式设置 `NEXT_PUBLIC_DEMO_MODE=true` 时才使用 mock 数据。

本地启动：

```bash
cd web
bun install
bun run dev
```

根目录的 `seat_reserver.py` 和 VPS cron 继续独立运行，平台服务作为新的并行链路部署。

## 平台后端

`api/` 是基于 [brocoders/nestjs-boilerplate](https://github.com/brocoders/nestjs-boilerplate) 的 NestJS 平台后端，负责用户认证、邀请码、学校账号加密、预约任务、座位图、预约记录、Redis/BullMQ 调度和运行记录。它与 `web/` 放在同一个仓库中，真实座位请求只在 API 的队列执行器中发出。

后端使用 NestJS、TypeORM、PostgreSQL、JWT/HttpOnly Cookie、角色权限、Swagger、Redis/BullMQ、Nest Schedule 和 Docker。API 容器内包含 scheduler 与 queue worker，当前规模不需要单独拆进程。

本地验证后端：

```bash
cd api
npm install
npm run build
npm run lint
```

平台 API 主要入口：

```text
POST /api/v1/platform/auth/register
POST /api/v1/platform/auth/login
GET  /api/v1/platform/auth/me
GET  /api/v1/platform/dashboard
GET  /api/v1/platform/admin/overview
GET  /api/v1/platform/admin/accounts
GET  /api/v1/platform/admin/tasks
GET  /api/v1/platform/admin/runs
GET  /api/v1/platform/health
```

首个注册账号自动成为管理员；后续注册需要管理员在 `/dashboard/admin` 创建的邀请码。学校账号绑定时由后端调用学校登录接口和用户校验接口，密码与 Token 加密后保存。

平台以 `user.id` 作为租户根。普通用户的账号、任务、运行记录和通知查询全部按当前用户过滤，数据库还用复合外键阻止任务或运行记录挂到其他用户的学校账号；管理员只能查看脱敏的全局资源。模板自带的通用公开注册、社交登录和 mock API 路由不参与生产平台。

不要把 `api/.env`、学校账号密码、Token 或 Redis/数据库凭据提交到 Git。

## 平台部署

生产编排文件是 `docker-compose.platform.yml`，配置模板是 `deploy/platform.env.example`。它只将 Web/API 绑定到 VPS 本机端口，公网入口由现有 OpenResty 反向代理提供。

## 仓库结构

```text
web/                  Kiranism Next.js 管理端和移动端路由
api/                  brocoders NestJS API 基线
seat_reserver.py      现有稳定抢座 CLI，继续兼容 VPS cron
tests/                Python CLI 和抓包工具测试
tools/                登录/绑定流量捕获和分析工具
docs/                 产品、架构和部署文档
```

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
BOOK_MAX_ATTEMPTS=12
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

BOOK_MAX_ATTEMPTS=12
BOOK_ATTEMPT_DELAY_SECONDS=1.2
BOOK_TIMEOUT_SECONDS=8
BOOK_NETWORK_RETRY_ATTEMPTS=3
BOOK_NETWORK_RETRY_DELAY_SECONDS=0.8
BOOK_TOKEN_REFRESHED_AT=0
BOOK_ASSUME_FRESH_TOKEN_SECONDS=180
BOOK_BOOKING_WINDOW_SECONDS=20
BOOK_BOOKING_REQUEST_TIMEOUT_SECONDS=3
BOOK_HMAC_REQUEST_KEY=<当前小程序 freeBook 请求中的 X-hmac-request-key>
```

真实的 `.env` 不要提交到 Git。项目里的 `.gitignore` 已经忽略 `.env`。

## 小程序客户端参数

预约接口除了 token，还会校验当前小程序客户端请求参数。当前已验证可用的客户端版本为：

```text
Referer 页面版本：59
UnifiedPCWindowsWechat：0xf2541b37
XWEB：20089
```

`BOOK_HMAC_REQUEST_KEY` 必须从当前小程序一次正常的 `freeBook` 请求头中获取。它不是账号密码或 token，不要把真实值提交到 Git。小程序升级后如果 token 刷新成功、但预约接口持续返回业务错误，应先对比当前正常请求中的 `Referer`、`User-Agent` 和 `X-hmac-request-key`。

预约请求体中的 `authid` 当前仍为空，不需要额外配置。

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
BOOK_BOOKING_WINDOW_SECONDS=20
BOOK_BOOKING_REQUEST_TIMEOUT_SECONDS=3
```

说明：

- `BOOK_NETWORK_RETRY_*` 只针对临时网络错误，不会改变座位候选顺序，也不会增加 `BOOK_MAX_ATTEMPTS` 的业务重试次数。
- `BOOK_TOKEN_REFRESHED_AT` 由脚本在预热成功后自动写回 `.env`。
- `BOOK_ASSUME_FRESH_TOKEN_SECONDS` 用来让 6 点的正式预约在 token 刚刚预热成功后，跳过 `/rest/v2/user` 校验，直接进入预约，减少关键窗口里的额外网络请求。
- `BOOK_BOOKING_WINDOW_SECONDS` 控制 6 点开始后的总抢座窗口，建议设为 `20`。
- `BOOK_BOOKING_REQUEST_TIMEOUT_SECONDS` 控制单次预约请求超时，避免被单次慢请求拖死整个窗口。

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
