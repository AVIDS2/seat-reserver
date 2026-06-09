# 座位预约平台 — 架构提案

> 基于现有 `seat_reserver.py` 单账号 CLI 的平台化扩展方案。
> 前提：现有 CLI + VPS cron 方案必须继续独立运行，平台是平行路径，不是替代。

---

## 1. 产品边界和非目标

### 1.1 产品定位

一个 **邀请制、小规模** 的座位预约任务管理平台。用户通过 Web 面板配置自己的学校账号和抢座策略，系统每天自动执行 token 预热和预约。

核心价值：把"登录 VPS 改 .env + 看 cron 日志"变成"浏览器点几下 + 看面板状态"。

### 1.2 边界（做什么）

| 维度 | 范围 |
|---|---|
| 用户规模 | 50 人以内，邀请制，不公开注册 |
| 学校范围 | 首版仅支持当前"一考即过"小程序接口 |
| 预约能力 | 与 CLI 完全相同 — 正常 HTTP 请求，不绕过任何服务端限制 |
| 部署目标 | 单台 VPS，Docker Compose，不上 K8s |
| 可用性 | 允许短暂中断（VPS 重启），不做高可用 |

### 1.3 非目标（明确不做什么）

- **不做验证码绕过、风控绕过、签名逆向** — 平台只发送与小程序客户端相同的正常请求
- **不做公开注册** — 必须有邀请码才能注册
- **不做多学校通用适配** — 首版硬编码当前接口路径和请求格式
- **不做手机端** — 响应式 Web 即可，不做原生 App
- **不替换现有 CLI** — `seat_reserver.py` 继续可用，VPS cron 继续运行
- **不做高可用/自动扩缩容** — 单机 Docker Compose 足够
- **不做支付/商业化** — 纯个人/小圈子工具

---

## 2. 用户角色和权限模型

### 2.1 角色定义

| 角色 | 说明 | 典型用户 |
|---|---|---|
| `admin` | 平台管理员，可管理邀请码、查看全局状态、禁用用户 | 你自己 |
| `user` | 普通用户，管理自己的学校账号和预约任务 | 被邀请的同学 |

### 2.2 权限矩阵

| 资源 | `admin` | `user` |
|---|---|---|
| 邀请码 CRUD | ✅ 全局 | ❌ |
| 用户列表/禁用 | ✅ 全局 | ❌ |
| 全局任务运行概览 | ✅ 全局 | ❌ |
| 学校账号 | ✅ 查看全部（脱敏） | ✅ 仅自己的 |
| 预约任务 | ✅ 查看全部 | ✅ 仅自己的 |
| 运行日志 | ✅ 查看全部（脱敏） | ✅ 仅自己的 |

### 2.3 资源隔离规则

- 所有用户级 API 通过 `current_user.id` 过滤，**代码层面禁止跨用户访问**
- Admin API 独立前缀 `/admin/`，中间件强制校验 `role == admin`
- 数据库查询一律带 `WHERE user_id = :uid`（admin 全局查询除外）

### 2.4 邀请码机制

```
管理员创建邀请码 → 分发给信任的人 → 注册时填写 → 注册成功后 used_count++
```

- 每个邀请码可设 `max_uses`（默认 1）和 `expires_at`
- 用完或过期后自动失效
- 邀请码本身不关联角色，注册后一律为 `user`，提升为 `admin` 需管理员手动操作

---

## 3. 模块边界

### 3.1 系统分层

```
┌─────────────────────────────────────────────────┐
│                   Frontend (Next.js)             │
│  pages: auth / dashboard / tasks / accounts /    │
│         runs / admin                             │
└──────────────────────┬──────────────────────────┘
                       │ HTTP JSON
┌──────────────────────▼──────────────────────────┐
│                   API (FastAPI)                  │
│  modules: auth / invitations / school_accounts / │
│           booking_tasks / booking_runs           │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐  ┌──────────────┐
  │ Database │  │  Redis   │  │ Seat Client  │
  │ (PG)     │  │ (队列/锁)│  │ (外部接口)   │
  └──────────┘  └─────┬────┘  └──────────────┘
                      │
               ┌──────▼──────┐
               │   Worker    │
               │ (独立进程)  │
               └─────────────┘
```

### 3.2 模块职责和边界

| 模块 | 职责 | 不做什么 |
|---|---|---|
| **auth** | 平台用户注册/登录/JWT/session | 不处理学校账号认证 |
| **invitations** | 邀请码 CRUD 和校验 | 不自动分发 |
| **school_accounts** | 学校账号 CRUD、密码加密存储、token 缓存 | 不直接预约 |
| **booking_tasks** | 任务 CRUD、候选策略配置、启用/禁用 | 不执行预约 |
| **booking_runs** | 运行日志查询（只读，由 worker 写入） | 不触发执行 |
| **seat_client** | 封装对"一考即过"小程序的 HTTP 请求 | 不缓存、不重试（重试在 worker 层） |
| **scheduler** | 每日生成预热/预约执行计划 | 不执行任务本身 |
| **worker** | 从队列取任务、执行 seat_client 调用、写日志 | 不暴露 HTTP 接口 |

### 3.3 seat_client 与现有 CLI 的关系

```
seat_reserver.py (CLI)          seat_client/ (平台模块)
─────────────────────          ──────────────────────
独立运行，不依赖平台            独立模块，不依赖 CLI
直接读 .env                    接收参数调用
直接 print 日志                返回结构化结果
可继续用 VPS cron              被 worker 调用
```

- `seat_client/` 复制 `seat_reserver.py` 的核心 HTTP 逻辑（`auth`、`get_user`、`free_book`），但以函数/类形式封装
- **不 import seat_reserver.py** — 避免循环依赖和 CLI 被平台代码污染
- 两套代码可以独立演化，接口协议相同即可

---

## 4. 推荐技术栈和取舍理由

### 4.1 总览

```
前端：  Next.js 14+ (App Router) + TypeScript + shadcn/ui + Tailwind CSS
数据层：TanStack Query + React Hook Form + Zod
后端：  FastAPI + Pydantic v2
ORM：   SQLAlchemy 2.0 + Alembic
数据库：PostgreSQL 16
缓存/锁：Redis 7
调度：  APScheduler (集成在 worker 进程内)
部署：  Docker Compose
```

### 4.2 关键取舍

| 决策 | 选择 | 理由 | 否决的方案 |
|---|---|---|---|
| 后端语言 | Python | 与现有 CLI 同语言，seat_client 逻辑可直接复用 | Node.js — 需重写 HTTP 逻辑 |
| Web 框架 | FastAPI | async 原生、Pydantic 集成好、自动生成 OpenAPI 文档 | Django — 太重，Admin 不需要；Flask — 无 async，无类型校验 |
| 前端框架 | Next.js | SSR/SSG 灵活、shadcn/ui 生态成熟 | 纯 SPA (Vite) — 无 SSR，SEO 无所谓但开发体验差 |
| 数据库 | PostgreSQL | JSON 字段支持好（存候选策略）、够用、成熟 | SQLite — 并发写入锁问题；MySQL — 无特别优势 |
| 队列 | Redis List + Lock | 轻量、够用、无需额外组件 | Celery + RabbitMQ — 太重；Redis Streams — 过度设计 |
| 调度 | APScheduler | Python 原生、可嵌入 worker 进程、Cron 表达式支持 | 系统 cron — 无法感知任务状态；Celery Beat — 依赖链太长 |
| ORM | SQLAlchemy 2.0 | Python 标准、Alembic migration 成熟 | Prisma — Python 支持弱；raw SQL — 维护成本高 |
| 认证 | HttpOnly Cookie + JWT | 安全、简单、前后端同域部署无跨域问题 | Bearer Token — 需前端存 token，XSS 风险；Session — 需服务端状态 |

### 4.3 不引入的东西

| 不引入 | 理由 |
|---|---|
| Kubernetes | 单机部署，Docker Compose 足够 |
| GraphQL | REST 够用，OpenAPI 自动生成文档 |
| Message Queue (RabbitMQ/Kafka) | Redis List 足以处理每日几十个任务 |
| 微服务 | 4 个进程（web/api/scheduler/worker）足够，不需要服务发现 |
| TypeScript 后端 | Python 可复用现有 HTTP 逻辑 |

---

## 5. 数据模型草案

### 5.1 ER 关系

```
users 1──N school_accounts
users 1──N booking_tasks
users 1──N invitations (created_by)
booking_tasks N──1 school_accounts
booking_tasks 1──N booking_runs
invitations 1──N invitation_uses
```

### 5.2 表定义

#### users

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | |
| email | VARCHAR(255) UNIQUE | 登录邮箱 |
| password_hash | VARCHAR(255) | Argon2id 哈希 |
| display_name | VARCHAR(100) | 显示名称 |
| role | ENUM(admin, user) | 默认 user |
| status | ENUM(active, disabled) | 默认 active |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### invitations

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | |
| code | VARCHAR(32) UNIQUE | 邀请码（随机生成） |
| created_by_user_id | UUID FK(users) | 创建者 |
| max_uses | INT | 最大使用次数，默认 1 |
| used_count | INT | 已使用次数，默认 0 |
| expires_at | TIMESTAMP NULL | 过期时间，NULL 表示不过期 |
| status | ENUM(active, disabled, exhausted) | |
| created_at | TIMESTAMP | |

#### invitation_uses

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | |
| invitation_id | UUID FK(invitations) | |
| used_by_user_id | UUID FK(users) | |
| used_at | TIMESTAMP | |

#### school_accounts

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK(users) | 所属用户 |
| label | VARCHAR(100) | 用户自定义标签（如"我的主账号"） |
| school_username | VARCHAR(100) | 学号（明文，非敏感） |
| encrypted_school_password | BYTEA | Fernet 加密后的密码 |
| cached_token | TEXT NULL | 缓存的 API token |
| token_refreshed_at | TIMESTAMP NULL | 上次 token 刷新时间 |
| token_expires_at | TIMESTAMP NULL | token 预估过期时间 |
| last_verified_at | TIMESTAMP NULL | 上次验证成功时间 |
| status | ENUM(active, invalid_credentials, disabled) | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### booking_tasks

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK(users) | 所属用户 |
| school_account_id | UUID FK(school_accounts) | 关联学校账号 |
| name | VARCHAR(100) | 任务名称（如"44号下午"） |
| primary_seat_id | VARCHAR(20) | 主座位 ID |
| backup_seat_ids | JSON | 备选座位 ID 列表，如 `["211"]` |
| time_candidates | JSON | 候选时间段，如 `[{"start":840,"end":1320}]` |
| max_attempts | INT | 最大尝试次数，默认 6 |
| attempt_delay_seconds | FLOAT | 每次尝试间隔秒数，默认 1.2 |
| prewarm_offset_seconds | INT | 相对于 05:59:45 的偏移（错峰用） |
| run_offset_seconds | INT | 相对于 06:00:01 的偏移（错峰用） |
| target_date_override | DATE NULL | NULL 表示每天执行，非 NULL 表示只执行指定日期 |
| enabled | BOOLEAN | 是否启用 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### booking_runs

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | |
| task_id | UUID FK(booking_tasks) | |
| user_id | UUID FK(users) | 冗余，方便查询 |
| run_type | ENUM(prewarm, booking) | 预热 or 预约 |
| target_date | DATE | 预约目标日期 |
| status | ENUM(pending, running, success, failed, skipped) | |
| started_at | TIMESTAMP NULL | |
| finished_at | TIMESTAMP NULL | |
| message | TEXT | 结果消息（脱敏） |
| receipt | VARCHAR(100) NULL | 成功时的回执号 |
| location | VARCHAR(200) NULL | 座位位置 |
| reserved_begin | VARCHAR(20) NULL | 预约开始时间 |
| reserved_end | VARCHAR(20) NULL | 预约结束时间 |
| http_status | INT NULL | 原始 HTTP 状态码 |
| response_code | VARCHAR(20) NULL | 原始响应 code |
| attempts_used | INT | 实际尝试次数 |
| created_at | TIMESTAMP | |

### 5.3 索引建议

```sql
-- 高频查询路径
CREATE INDEX idx_booking_tasks_user_enabled ON booking_tasks(user_id, enabled);
CREATE INDEX idx_booking_runs_task_date ON booking_runs(task_id, target_date);
CREATE INDEX idx_booking_runs_user_date ON booking_runs(user_id, created_at DESC);
CREATE INDEX idx_school_accounts_user ON school_accounts(user_id);
CREATE INDEX idx_invitations_code ON invitations(code) WHERE status = 'active';
```

---

## 6. API 草案

### 6.1 设计原则

- RESTful，资源名复数
- 统一前缀 `/api/v1/`
- 认证：HttpOnly cookie 中的 JWT
- 错误格式：`{ "error": { "code": "...", "message": "..." } }`
- 分页：`?page=1&per_page=20`，响应含 `total`、`page`、`per_page`
- OpenAPI 文档自动生成于 `/api/v1/docs`

### 6.2 端点列表

#### Auth

```
POST   /api/v1/auth/register       注册（需要 invitation_code）
POST   /api/v1/auth/login          登录，设置 HttpOnly cookie
POST   /api/v1/auth/logout         清除 cookie
GET    /api/v1/auth/me             当前用户信息
```

#### Invitations（admin only）

```
GET    /api/v1/admin/invitations            列表（含使用记录）
POST   /api/v1/admin/invitations            创建邀请码
PATCH  /api/v1/admin/invitations/{id}       更新（禁用/修改 max_uses）
DELETE /api/v1/admin/invitations/{id}       删除
```

#### School Accounts

```
GET    /api/v1/school-accounts              列表（自己的）
POST   /api/v1/school-accounts              添加
POST   /api/v1/school-accounts/{id}/verify  验证（调 /rest/auth + /rest/v2/user）
PATCH  /api/v1/school-accounts/{id}         更新（label 等）
DELETE /api/v1/school-accounts/{id}         删除
```

#### Booking Tasks

```
GET    /api/v1/booking-tasks                列表（自己的）
POST   /api/v1/booking-tasks                创建
GET    /api/v1/booking-tasks/{id}           详情
PATCH  /api/v1/booking-tasks/{id}           更新
POST   /api/v1/booking-tasks/{id}/enable    启用
POST   /api/v1/booking-tasks/{id}/disable   禁用
POST   /api/v1/booking-tasks/{id}/prewarm   手动触发 token 预热
POST   /api/v1/booking-tasks/{id}/dry-run   检查候选策略（不实际预约）
DELETE /api/v1/booking-tasks/{id}           删除
```

#### Booking Runs

```
GET    /api/v1/booking-runs                 列表（自己的，支持 ?task_id=&date=&status= 过滤）
GET    /api/v1/booking-runs/{id}            详情
GET    /api/v1/booking-runs/latest          各任务最近一次运行
```

#### Admin（admin only）

```
GET    /api/v1/admin/users                  用户列表
PATCH  /api/v1/admin/users/{id}             更新用户状态/角色
GET    /api/v1/admin/stats                  全局统计（今日成功/失败/总任务数）
GET    /api/v1/admin/booking-runs           全局运行日志
```

#### Health

```
GET    /api/v1/health                       健康检查（DB + Redis 连通性）
```

### 6.3 关键请求/响应示例

#### POST /api/v1/booking-tasks

```json
{
  "school_account_id": "uuid",
  "name": "44号下午",
  "primary_seat_id": "197",
  "backup_seat_ids": ["211"],
  "time_candidates": [
    {"start": 840, "end": 1320},
    {"start": 780, "end": 1260}
  ],
  "max_attempts": 6,
  "attempt_delay_seconds": 1.2
}
```

#### GET /api/v1/booking-runs/latest 响应

```json
{
  "items": [
    {
      "task_id": "uuid",
      "task_name": "44号下午",
      "latest_run": {
        "id": "uuid",
        "run_type": "booking",
        "target_date": "2026-06-04",
        "status": "success",
        "receipt": "R20260604001",
        "location": "4楼 44号",
        "reserved_begin": "14:00",
        "reserved_end": "22:00",
        "finished_at": "2026-06-04T06:00:03+08:00"
      }
    }
  ]
}
```

---

## 7. 调度和 Worker 设计

### 7.1 调度模型

```
                    ┌─────────────────┐
                    │   Scheduler     │
                    │  (APScheduler)  │
                    │                 │
                    │  每天 05:30     │
                    │  生成当日任务   │
                    └────────┬────────┘
                             │ 写入 Redis Queue
                             ▼
                    ┌─────────────────┐
                    │   Redis Queues  │
                    │                 │
                    │ prewarm:{date}  │
                    │ booking:{date}  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Worker 1 │  │ Worker 2 │  │ Worker N │
        └──────────┘  └──────────┘  └──────────┘
```

### 7.2 每日流程

```
05:30:00  Scheduler 生成当日 prewarm + booking 任务
          - 遍历所有 enabled=true 的 booking_tasks
          - 每个任务生成 2 条记录：run_type=prewarm, run_type=booking
          - 写入 booking_runs (status=pending)
          - 推入 Redis List

05:59:45  Worker 开始消费 prewarm 队列（按 prewarm_offset_seconds 错峰）
          - 获取 Redis 锁：lock:prewarm:{task_id}:{date}
          - 解密学校密码 → 调用 /rest/auth → 更新 cached_token
          - 写 booking_runs 结果

06:00:01  Worker 开始消费 booking 队列（按 run_offset_seconds 错峰）
          - 获取 Redis 锁：lock:booking:{task_id}:{date}
          - 用 cached_token 按候选列表依次调用 freeBook
          - 成功立即停止，写 booking_runs (status=success)
          - 全部失败写 booking_runs (status=failed)
```

### 7.3 锁设计

```
锁 key:    lock:{run_type}:{task_id}:{date}
锁 TTL:    prewarm 60s / booking 120s
获取方式:  Redis SET NX EX
释放方式:  任务完成后 DEL（异常时靠 TTL 自动释放）
```

防止同一任务被多个 worker 重复执行，也防止 Scheduler 重复生成。

### 7.4 Worker 执行逻辑（伪代码）

```python
def execute_booking_run(run_id):
    run = db.get(booking_runs, run_id)
    task = run.task

    # 1. 获取锁
    lock_key = f"lock:{run.run_type}:{run.task_id}:{run.target_date}"
    if not redis.set(lock_key, "1", nx=True, ex=120):
        run.status = "skipped"
        run.message = "Already running"
        return

    try:
        run.status = "running"
        run.started_at = now()

        # 2. 解密密码
        password = fernet.decrypt(task.school_account.encrypted_school_password)

        # 3. 验证/刷新 token
        token = task.school_account.cached_token
        if not seat_client.get_user(token).ok:
            token = seat_client.auth(task.school_account.school_username, password)
            task.school_account.cached_token = token

        if run.run_type == "prewarm":
            run.status = "success"
            return

        # 4. 按候选列表预约
        for candidate in task.candidates[:task.max_attempts]:
            result = seat_client.free_book(token, candidate.seat_id, run.target_date, ...)
            if result.success:
                run.status = "success"
                run.receipt = result.receipt
                # ...
                return
            time.sleep(task.attempt_delay_seconds)

        run.status = "failed"
        run.message = "All candidates exhausted"

    finally:
        run.finished_at = now()
        redis.delete(lock_key)
```

### 7.5 错峰策略

```
任务按 created_at 排序，每个任务的偏移 = 排序位置 × 1 秒

第 1 个任务: prewarm 05:59:45, booking 06:00:01
第 2 个任务: prewarm 05:59:46, booking 06:00:02
第 3 个任务: prewarm 05:59:47, booking 06:00:03
...
```

避免所有任务在同一秒并发请求，降低被风控的概率。

---

## 8. 凭据加密和日志脱敏方案

### 8.1 凭据加密

#### 加密算法

```
cryptography.Fernet (AES-128-CBC + HMAC-SHA256)
密钥来源：环境变量 CREDENTIAL_ENCRYPTION_KEY
密钥格式：Fernet.generate_key() 生成的 base64 字符串
```

#### 加密流程

```
用户提交学校密码
  → API 层接收明文（HTTPS 传输）
  → Fernet.encrypt(password.encode())
  → 存入 school_accounts.encrypted_school_password (BYTEA)
  → 内存中的明文变量离开作用域后自动释放
```

#### 解密流程

```
Worker 需要调用学校 API
  → 从 DB 读取 encrypted_school_password
  → Fernet.decrypt() 得到明文
  → 用完后不缓存明文
```

#### 密钥管理

```
CREDENTIAL_ENCRYPTION_KEY 生成方式：
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

存放：
  - Docker Compose .env 文件（不提交到 Git）
  - VPS 上 chmod 600

轮换：
  - MVP 阶段不自动轮换
  - 手动轮换时：生成新 key → 用旧 key 解密所有密码 → 用新 key 重新加密 → 更新 .env → 重启服务
```

### 8.2 日志脱敏

#### 脱敏规则

| 字段 | 处理方式 |
|---|---|
| 学校密码 | **永不打印**，内存中用完即弃 |
| API Token | 日志中显示前 6 位 + `***`，如 `abc123***` |
| 邀请码 | 创建时显示完整，其他场景显示前 4 位 + `***` |
| 学号 | 不脱敏（非敏感） |
| 邮箱 | 不脱敏 |
| 回执号/座位号 | 不脱敏 |

#### 实现方式

```python
# 结构化日志，字段级脱敏
logger.info("token_refreshed",
    user_id=user_id,
    school_account_id=account_id,
    token_prefix=token[:6] + "***" if token else None,  # 只记前缀
    # password=...  ← 禁止出现
)

# booking_runs 表中的 message 字段也是脱敏后的
run.message = f"Token refreshed: {token[:6]}***"
```

#### 代码层防护

```python
# pydantic 模型中密码字段标记为敏感
class SchoolAccountCreate(BaseModel):
    school_username: str
    school_password: str = Field(..., repr=False)  # repr=False 防止 __repr__ 泄漏

# 日志中间件自动过滤敏感字段
SENSITIVE_KEYS = {"password", "token", "school_password", "encrypted_school_password", "invitation_code"}
```

---

## 9. Docker Compose 部署拓扑

### 9.1 服务拓扑

```
┌─────────────────────────────────────────────────────────┐
│                    VPS (Debian 12)                      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Docker Compose                     │   │
│  │                                                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │   │
│  │  │   web    │  │   api    │  │ scheduler│     │   │
│  │  │ :3000    │  │ :8000    │  │ (内嵌)   │     │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘     │   │
│  │       │              │              │           │   │
│  │       │         ┌────┴────┐         │           │   │
│  │       │         │ postgres│         │           │   │
│  │       │         │ :5432   │         │           │   │
│  │       │         └─────────┘         │           │   │
│  │       │                             │           │   │
│  │       │         ┌─────────┐         │           │   │
│  │       └────────►│  redis  │◄────────┘           │   │
│  │                 │ :6379   │                     │   │
│  │                 └────┬────┘                     │   │
│  │                      │                          │   │
│  │                 ┌────┴────┐                     │   │
│  │                 │ worker  │ ×N                  │   │
│  │                 └─────────┘                     │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Nginx / Caddy (反向代理)                               │
│  ├─ your-domain.com      → web:3000                    │
│  └─ your-domain.com/api  → api:8000                    │
│                                                         │
│  现有 CLI (不受影响)                                    │
│  ├─ seat_reserver.py                                     │
│  └─ .env + cron                                          │
└─────────────────────────────────────────────────────────┘
```

### 9.2 docker-compose.yml 结构

```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: seat_platform
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: pg_isready -U ${DB_USER}

  redis:
    image: redis:7-alpine
    volumes: [redisdata:/data]
    command: redis-server --requirepass ${REDIS_PASSWORD}
    healthcheck:
      test: redis-cli -a ${REDIS_PASSWORD} ping

  api:
    build: ./api
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/seat_platform
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      CREDENTIAL_ENCRYPTION_KEY: ${CREDENTIAL_ENCRYPTION_KEY}
      JWT_SECRET: ${JWT_SECRET}
    ports: ["8000:8000"]

  web:
    build: ./web
    depends_on: [api]
    environment:
      NEXT_PUBLIC_API_URL: /api
    ports: ["3000:3000"]

  worker:
    build: ./api
    command: python -m worker.main
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/seat_platform
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      CREDENTIAL_ENCRYPTION_KEY: ${CREDENTIAL_ENCRYPTION_KEY}

  scheduler:
    build: ./api
    command: python -m scheduler.main
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/seat_platform
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0

volumes:
  pgdata:
  redisdata:
```

### 9.3 反向代理（Caddy 示例）

```
your-domain.com {
    handle /api/* {
        reverse_proxy api:8000
    }
    handle {
        reverse_proxy web:3000
    }
}
```

### 9.4 资源估算

| 服务 | 内存 | CPU | 说明 |
|---|---|---|---|
| postgres | 256MB | 0.25 | 小规模够用 |
| redis | 64MB | 0.1 | 仅锁和队列 |
| api | 256MB | 0.25 | FastAPI async |
| web | 256MB | 0.25 | Next.js |
| worker | 128MB | 0.1 | 按需运行 |
| scheduler | 64MB | 0.1 | 几乎空闲 |
| **合计** | **~1GB** | **~1 CPU** | 1 核 2G VPS 足够 |

---

## 10. MVP 分阶段计划

### Phase 1: 项目骨架（1-2 天）

**目标**：所有服务能 `docker compose up` 启动

- [ ] 创建 `web/` Next.js 项目，初始化 shadcn/ui
- [ ] 创建 `api/` FastAPI 项目
- [ ] 配置 Docker Compose：web + api + postgres + redis
- [ ] `GET /api/v1/health` 返回 `{"status": "ok", "db": "ok", "redis": "ok"}`
- [ ] 项目 `.gitignore` 和 `.env.example`

**验收**：`docker compose up` 后所有容器健康，浏览器能打开 web 和 /api/v1/docs

### Phase 2: 认证和邀请码（2-3 天）

**目标**：用户能注册和登录

- [ ] SQLAlchemy models: users, invitations, invitation_uses
- [ ] Alembic migration
- [ ] POST /auth/register（需邀请码）
- [ ] POST /auth/login（HttpOnly cookie + JWT）
- [ ] GET /auth/me
- [ ] Admin: 邀请码 CRUD
- [ ] 管理员种子账号（首次启动自动创建）
- [ ] 后端测试：注册、登录、权限、邀请码校验

**验收**：无邀请码不能注册；有效邀请码可注册并登录；/auth/me 返回当前用户

### Phase 3: 学校账号管理（2 天）

**目标**：用户能添加和验证学校账号

- [ ] SQLAlchemy model: school_accounts
- [ ] Fernet 加密/解密工具
- [ ] POST /school-accounts（加密存储密码）
- [ ] POST /school-accounts/{id}/verify（调 /rest/auth + /rest/v2/user）
- [ ] seat_client 模块：auth(), get_user()
- [ ] 日志脱敏：token 只记前缀，密码永不打印
- [ ] 测试：加密存储、verify 成功/失败、脱敏

**验收**：正确密码 verify 成功；错误密码失败；DB 中无明文密码；日志中无明文 token

### Phase 4: 预约任务管理（2 天）

**目标**：用户能创建和管理预约任务

- [ ] SQLAlchemy model: booking_tasks
- [ ] 任务 CRUD API
- [ ] 候选策略校验（seat_id、time_candidates 格式）
- [ ] 启用/禁用任务
- [ ] dry-run（只检查 token + 生成候选列表，不调 freeBook）
- [ ] 用户最多 N 个启用任务的限制
- [ ] 测试：CRUD、权限隔离、候选校验

**验收**：用户只能看到自己的任务；dry-run 不发送 freeBook

### Phase 5: Worker 和调度（3 天）

**目标**：系统每天自动执行预热和预约

- [ ] seat_client 模块：free_book()
- [ ] Scheduler：每天 05:30 生成当日任务
- [ ] Worker：消费 prewarm 队列
- [ ] Worker：消费 booking 队列
- [ ] Redis 锁：防重复执行
- [ ] booking_runs 日志写入
- [ ] 错峰偏移逻辑
- [ ] 手动触发 prewarm / booking 的 API
- [ ] 测试：幂等锁、日志写入、成功/失败路径

**验收**：手动触发 prewarm 能刷新 token；booking 成功/失败都写日志；同一任务不重复执行

### Phase 6: 前端面板（3-5 天）

**目标**：完整的 Web 管理界面

- [ ] 登录/注册页
- [ ] Dashboard：今日状态卡片、最近成功/失败
- [ ] 学校账号页：添加、验证、列表
- [ ] 预约任务页：创建、编辑、启禁用、dry-run
- [ ] 运行日志页：按任务筛选、详情展示
- [ ] 管理员页：邀请码管理、用户列表、全局概览

**验收**：从注册到创建任务全流程可用；管理员可创建邀请码

### Phase 7: 打磨和文档（1-2 天）

- [ ] 错误处理和用户提示优化
- [ ] 加载状态和空状态设计
- [ ] 部署文档
- [ ] .env.example 完善
- [ ] README 更新

**总计预估**：15-20 天（单人开发）

---

## 11. 风险清单和回滚方案

### 11.1 风险矩阵

| # | 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|---|
| R1 | 学校改接口导致预约失败 | 中 | 高 | seat_client 模块独立，改一处即可；接口变更时先在 CLI 验证再更新平台 |
| R2 | Token 刷新失败率升高 | 中 | 中 | prewarm 提前到 05:59，失败重试 2 次；booking 失败后标记状态，不阻塞其他任务 |
| R3 | 多用户同时请求被风控 | 低 | 高 | 错峰执行（每任务间隔 1s）；限制总任务数；不突破正常请求频率 |
| R4 | 凭据加密密钥泄露 | 低 | 致命 | .env chmod 600；密钥不进 Git；VPS 限制 SSH 访问 |
| R5 | 数据库磁盘满 | 低 | 中 | booking_runs 定期归档（保留 30 天）；监控磁盘 |
| R6 | Redis 宕机导致任务丢失 | 低 | 中 | booking_runs 是持久化状态源，Redis 只是临时锁/队列；Redis 恢复后可从 DB 重建队列 |
| R7 | 用户滥用（高频请求） | 低 | 中 | 每用户最多 N 个启用任务；max_attempts 上限；rate limit |
| R8 | 前端 XSS 泄漏 token | 低 | 高 | HttpOnly cookie；CSP header；不存 token 到 localStorage |

### 11.2 回滚方案

#### 场景 1：平台部署后想回退到纯 CLI

```
1. docker compose down  （停止所有平台服务）
2. VPS 上的 seat_reserver.py + .env + cron 完全不受影响，继续正常运行
3. 平台数据库数据保留，随时可以 docker compose up 恢复
```

**关键保障**：平台和 CLI 是完全独立的两套系统，互不干扰。

#### 场景 2：平台某次更新导致预约失败

```
1. git revert <commit> 或 git checkout <上一个稳定 tag>
2. docker compose build && docker compose up -d
3. 检查 booking_runs 日志确认恢复
```

#### 场景 3：数据库需要回滚 migration

```
1. alembic downgrade <target_revision>
2. 重启 api 和 worker
3. 确认功能正常
```

#### 场景 4：加密密钥需要轮换

```
1. 生成新密钥
2. 用旧密钥解密所有 school_accounts.encrypted_school_password
3. 用新密钥重新加密
4. 更新 .env 中的 CREDENTIAL_ENCRYPTION_KEY
5. docker compose restart api worker
6. 验证 verify 和 booking 功能正常
```

### 11.3 监控建议（MVP 后期）

```
- Docker healthcheck（已在 compose 中配置）
- booking_runs 失败率告警（可通过简单脚本每天检查）
- 磁盘使用率告警
- VPS 可用性监控（UptimeRobot 等免费方案）
```

---

## 附录：与现有 CLI 的关系总结

```
                    现有方案                    平台方案
                    ────────                    ────────
配置方式            .env 文件                   Web 面板
执行方式            VPS cron + seat_reserver.py  Docker worker
用户数              1                           N（邀请制）
Token 刷新          --refresh-token-only        自动 prewarm
日志查看            tail seat_reserver.log       Web 面板
凭据存储            .env 明文                   Fernet 加密 + PostgreSQL

共存方式：
- 两套系统完全独立，不共享代码路径
- 可以同时运行（只要不用同一个学校账号同时预约）
- CLI 可以随时恢复为唯一方案（docker compose down 即可）
```
