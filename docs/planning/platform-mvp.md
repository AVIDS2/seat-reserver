# Seat Reserver Platform MVP 开发计划

> 给 Claude Code 的工程启动说明。当前仓库已有稳定可用的 `seat_reserver.py` 单账号 CLI 和 VPS cron 部署。平台化开发必须保持现有 CLI 兼容，不要破坏当前 VPS 上的 `.env` / `.env.friend` / cron 运行方式。

## 目标

构建一个邀请制抢座任务管理平台，让用户通过平台账号登录后，配置自己的学校账号、目标座位、时间段和备选策略。系统每天自动预热 token，并在预约开放时间执行任务。

首版只支持当前“一考即过座位预约”小程序接口：

```text
GET  /cczukaoyan/rest/auth?username=...&password=...
GET  /cczukaoyan/rest/v2/user
POST /cczukaoyan/rest/v2/freeBook
```

## 非目标

- 不做验证码绕过、风控绕过、签名逆向或高频刷接口。
- 不做公开注册，必须邀请码注册。
- 不做多学校通用适配，首版只支持当前学校/场馆链路。
- 不替换当前 VPS cron 版，平台先独立开发和部署。

## 推荐技术栈

```text
前端：Next.js + TypeScript + shadcn/ui + Tailwind CSS
数据请求：TanStack Query
表单：React Hook Form + Zod
后端：FastAPI + Pydantic
数据库：PostgreSQL
ORM：SQLAlchemy 2.0 + Alembic
队列/锁：Redis
调度：APScheduler
任务执行：独立 worker service
部署：Docker Compose
```

## 服务拆分

```text
web        Next.js 管理面板
api        FastAPI HTTP API
scheduler 生成每日预热/预约任务
worker     执行 token 刷新和预约请求
postgres   持久化用户、任务、日志
redis      分布式锁、轻量任务队列、限流
```

MVP 可以用 Docker Compose 启动全部服务，不要上 Kubernetes。

## 目录结构

```text
web/
  app/
  components/
  lib/
  package.json

api/
  app/
    main.py
    core/
      config.py
      security.py
      crypto.py
    db/
      base.py
      session.py
      models.py
    modules/
      auth/
      invitations/
      school_accounts/
      booking_tasks/
      booking_runs/
      seat_client/
    worker/
      scheduler.py
      jobs.py
  alembic/
  pyproject.toml

docker-compose.yml
.env.example
```

## 核心安全要求

- 平台用户密码必须 hash，使用 Argon2 或 bcrypt。
- 学校账号密码必须加密存储，使用 `cryptography.Fernet`，密钥来自环境变量 `CREDENTIAL_ENCRYPTION_KEY`。
- 日志中禁止打印学校密码、token、邀请码明文。
- 普通用户只能访问自己的学校账号、任务和运行日志。
- 管理员才能创建邀请码、查看全局任务状态。
- 每个用户首版限制最多 2 个启用任务。

## 数据模型

### users

```text
id
email
password_hash
display_name
role: admin | user
status: active | disabled
created_at
updated_at
```

### invitations

```text
id
code
created_by_user_id
max_uses
used_count
expires_at
status: active | disabled
created_at
```

### invitation_uses

```text
id
invitation_id
used_by_user_id
used_at
```

### school_accounts

```text
id
user_id
school_username
encrypted_school_password
cached_token
last_token_refresh_at
last_verified_at
status: active | invalid_credentials | disabled
created_at
updated_at
```

### booking_tasks

```text
id
user_id
school_account_id
name
primary_seat_id
backup_seat_ids_json
time_candidates_json
max_attempts
attempt_delay_seconds
prewarm_time
run_time
enabled
created_at
updated_at
```

示例：

```json
{
  "primary_seat_id": "197",
  "backup_seat_ids": ["211"],
  "time_candidates": [
    {"start": 840, "end": 1320},
    {"start": 780, "end": 1260},
    {"start": 900, "end": 1320}
  ]
}
```

### booking_runs

```text
id
task_id
run_type: prewarm | booking
status: pending | running | success | failed
started_at
finished_at
message
receipt
location
reserved_begin
reserved_end
raw_code
raw_status
```

## 后端 API

### Auth

```text
POST /auth/register
Body: { email, password, display_name, invitation_code }

POST /auth/login
Body: { email, password }

POST /auth/logout

GET /auth/me
```

登录态首版使用 HttpOnly cookie + JWT。

### Invitations

```text
GET  /admin/invitations
POST /admin/invitations
PATCH /admin/invitations/{id}/disable
```

### School Accounts

```text
GET  /school-accounts
POST /school-accounts
POST /school-accounts/{id}/verify
PATCH /school-accounts/{id}
DELETE /school-accounts/{id}
```

`verify` 只调用登录和 `/user`，不预约。

### Booking Tasks

```text
GET  /booking-tasks
POST /booking-tasks
PATCH /booking-tasks/{id}
POST /booking-tasks/{id}/enable
POST /booking-tasks/{id}/disable
POST /booking-tasks/{id}/prewarm
POST /booking-tasks/{id}/dry-run
```

`dry-run` 只生成候选列表和检查 token，不调用 `freeBook`。

### Runs

```text
GET /booking-runs?task_id=...
GET /booking-runs/latest
```

## Seat Client 模块

把现有 `seat_reserver.py` 的核心逻辑抽成后端模块：

```text
SeatClient.auth(username, password) -> token
SeatClient.get_user(token) -> user info
SeatClient.free_book(token, seat_id, date, start, end) -> result
```

保留 CLI 文件，不要删除。平台模块可以复制/重构逻辑，但不要让当前 CLI 失效。

## 调度策略

每天每个启用任务生成两个执行点：

```text
prewarm_time: 默认 05:59:45 起，按任务错峰
run_time: 默认 06:00:01 起，按任务错峰
```

错峰策略：

```text
第 1 个任务：05:59:45 / 06:00:01
第 2 个任务：05:59:46 / 06:00:02
第 3 个任务：05:59:47 / 06:00:03
```

worker 执行任务前必须加 Redis lock：

```text
booking-task:{task_id}:{date}:{run_type}
```

避免重复执行。

## 前端页面

### 登录/注册

- 登录页。
- 邀请码注册页。
- 注册后进入任务面板。

### Dashboard

- 今日任务状态卡片。
- 最近成功预约。
- 最近失败原因。
- 明天启用任务概览。

### 学校账号

- 添加学校账号：学号、密码。
- 验证账号按钮。
- 显示最近 token 刷新时间，不显示 token。

### 预约任务

- 任务列表。
- 新增任务。
- 编辑目标座位、备选座位、时间段。
- 启用/禁用任务。
- 手动预热 token。
- dry-run 检查。

### 日志

- 按任务筛选。
- 展示 prewarm / booking 运行记录。
- 成功显示 receipt、location、time。
- 失败显示 message、raw_code。

### 管理员

- 邀请码列表。
- 创建邀请码。
- 用户列表。
- 全局任务运行状态。

## UI 选择

使用 shadcn/ui，不手搓基础组件。

建议组件：

```text
Card
Table
Badge
Button
Dialog
Sheet
Tabs
Select
Input
Switch
Alert
Toast / sonner
```

复杂表格用 TanStack Table。

## 第一阶段任务拆分

### Phase 1: 项目骨架

- 创建 `web/` Next.js 项目。
- 初始化 shadcn/ui。
- 创建 `api/` FastAPI 项目。
- 创建 Docker Compose：web、api、postgres、redis。
- 添加健康检查接口 `/health`。

验收：

```text
docker compose up 后 web 和 api 都能启动
GET /health 返回 ok
```

### Phase 2: 数据库和认证

- 建 SQLAlchemy models。
- 配 Alembic migration。
- 实现用户注册/登录。
- 实现邀请码注册。
- 实现管理员种子账号。

验收：

```text
无邀请码不能注册
有效邀请码可以注册
登录后 /auth/me 返回当前用户
```

### Phase 3: 学校账号

- 实现学校账号加密保存。
- 实现 verify：调用 `/rest/auth` 和 `/rest/v2/user`。
- 保存 cached_token。

验收：

```text
正确学号密码 verify 成功
错误密码 verify 失败
数据库不出现明文学校密码
日志不出现明文 token/password
```

### Phase 4: 预约任务

- 实现任务 CRUD。
- 实现候选座位/时间段校验。
- 实现任务启用/禁用。
- 实现 dry-run。

验收：

```text
用户只能看到自己的任务
primary seat 和 time candidates 可以保存
dry-run 不发送 freeBook
```

### Phase 5: worker 和 scheduler

- 实现 prewarm job。
- 实现 booking job。
- 实现 Redis lock。
- 实现 booking_runs 日志。

验收：

```text
手动触发 prewarm 能刷新 token
booking job 成功/失败都会写 booking_runs
同一 task/date/run_type 不会重复执行
```

### Phase 6: 前端面板

- 登录/注册页。
- Dashboard。
- 学校账号页。
- 任务页。
- 日志页。
- 管理员邀请码页。

验收：

```text
可以完成从注册到创建任务的全流程
可以手动 verify 学校账号
可以查看运行日志
管理员可以创建邀请码
```

## 测试要求

后端：

```text
pytest
httpx AsyncClient
sqlite test database
mock SeatClient 外部接口
```

必须覆盖：

```text
邀请码注册
登录
权限隔离
学校账号密码加密
token verify 成功/失败
任务 CRUD
worker 幂等锁
booking run 日志
```

前端：

```text
至少保证 TypeScript、lint、build 通过
关键表单用 Zod schema
```

## Claude Code 执行规则

- 不要修改 VPS 上正在跑的 cron 配置。
- 不要提交 `.env`、token、真实账号密码。
- 每个 phase 单独提交。
- 每次提交前运行对应测试。
- 遇到外部接口不确定时，用 mock，不要真实发预约请求。
- 所有真实预约能力必须默认关闭，只允许手动显式触发。

## 建议提交顺序

```text
chore: scaffold platform services
feat(api): add auth and invitation models
feat(api): add school account verification
feat(api): add booking task management
feat(worker): add prewarm and booking jobs
feat(web): add auth and dashboard pages
feat(web): add booking task management UI
docs: add deployment guide
```
