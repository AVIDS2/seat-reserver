# 座位预约平台 — 架构提案

> 基于现有 `seat_reserver.py` 单账号 CLI 的平台化扩展方案。
> 前提：现有 CLI + VPS cron 方案必须继续独立运行，平台是平行路径，不是替代。

## 当前决策（2026-09-01）

前端采用 `web/` 中的 Kiranism Next.js Dashboard Starter；后端采用 `api/` 中导入并完成平台业务模块的 brocoders NestJS boilerplate。生产运行时采用 PostgreSQL + TypeORM、JWT/HttpOnly Cookie、Redis + BullMQ 和 Nest Schedule；根目录 `seat_reserver.py` 与 VPS cron 继续独立运行。平台最终审计已关闭模板遗留的公开注册、社交登录和通用用户管理路由，补齐数据库租户复合外键、运行幂等索引、停用任务跳过、管理员脱敏全局视图和服务端 refresh 单飞保护。当前可执行入口是根目录 `docker-compose.platform.yml`，公网域名为 `seat.rglens.com`。

选择这套组合是因为 Kiranism 与 brocoders 的职责边界清晰，避免把两个 Next.js 全栈模板合并；`ixartz/SaaS-Boilerplate` 和 Wasp Open SaaS 作为参考，不作为本项目后端底座。对外产品名确定为“席定”，品牌标志使用 WUD 彩色标志，副标题为“高校座位预约平台”。

2026-09-04 起，校园账号只保存身份凭据，每套预约系统通过 `platform_school_service_connection` 维护独立的业务 Token、认证模式和验证时间。自习室与图书馆共用统一目录适配层，对前端输出馆区/楼栋、空间、日期、座位图和时段；独立座位图页面和任务编辑器都复用这套实时数据，任务保存真实展示名称与内部 ID，并支持每天、工作日、自定义星期和多个指定日期调度，数据库保留历史单次日期字段以兼容旧任务。任务编辑拆成“账号与空间”和“座位与时间”两步，桌面端使用最多 `1040px` 的宽内容区并按内容自适应高度，选择器使用视口内非模态弹层，移动端菜单使用紧凑内容宽，避免打开下拉选项时发生视口跳动；学校 `00:00-05:00` 的维护响应在前端明确显示为维护状态。图书馆当前开启点选验证码：挑战图片与提示经平台 API 转发，挑战 Token 只在 Redis 中按用户和预约参数保存三分钟，用户提交原图坐标后由后端校验并立即预约；浏览器不接触学校业务 Token，挑战一次使用后销毁。图书馆自动任务在服务端配置验证码识别服务后启用，任务配置与座位图、实时连接状态解耦；目录维护时可使用已知座位 ID 保存闹钟，worker 在开放窗口再恢复连接并执行。
2026-09-04 新增增长与权益域：普通用户绑定校园账号上限为 1，Pro 为 3；Pro 价格为人民币 20 元且永久有效。会员、积分钱包、不可变积分流水、邀请关系和 Pro 开通申请均使用独立平台表，不污染模板用户领域；账号新增事务使用 PostgreSQL advisory lock 复核额度。用户通过活动中心每日签到奖励积分，受邀用户完成首次账号验证后才结算邀请奖励，用户兑换的一次性邀请码只在生成响应中返回明文并默认 30 天有效。当前 Pro 采用人工确认开通，站内明码标价和申请状态完整可见，但没有伪造在线支付成功；后续接入支付时只需把支付回调映射到同一授予权益服务。
2026-09-06 新增连接恢复和 UI 稳定性决策：服务连接失败不再只写一个需要重连状态，而是记录重试退避并由 Nest Schedule 每 5 分钟自动恢复；前端只展示恢复进度，不要求用户刷新页面。KBar 使用模板命令面板但关闭其额外 scrollbar margin，配合全局 `scrollbar-gutter: stable` 保证搜索弹层不会改变工作区宽度。总览任务行复用 shadcn `Switch` 作为真实启用/暂停控制，移动端动作区独占一行；开放时间倒计时由局部 React state 驱动，不重新请求 dashboard 数据。落地页能力和评价区域遵循规则化网格，Hero 通过 `react-dom` image preload 与本地低清占位降低首屏黑屏。
2026-09-07 增加签到保护域：`platform_attendance_setting` 按用户保存开关，Nest Schedule 每分钟检查已开启用户的自习室预约，并用 Redis 锁保证同一预约不会重复自动取消。学校返回的预约状态是唯一签到依据；平台不伪造签到，也不对图书馆启用自动取消。充值页面属于可见的商品目录，真实收款仍以 Stripe 配置和 webhook 为准；未配置支付时只能提交现有 Pro 申请，不能在前端制造支付成功。头像沿用模板 `FileEntity`/文件上传链路，气泡颜色仅作为本设备偏好。
2026-09-14 新增线上席定自习室：专注房间与预约任务分域，房间状态和成员专注累计写入 PostgreSQL，服务端保存当前阶段结束时间，前端按时间戳本地倒计时并定期心跳。P0 不新增 WebSocket 服务，避免为安静陪伴场景引入聊天/音视频基础设施；房间规模上限 20 人，Redis 仅继续用于平台既有锁。后续规模需要更低延迟时，可在同一 REST 契约上增加 SSE/WebSocket 推送。

---

## 1. 产品边界和非目标

补充：座位图中的颜色只代表当前实时状态，任何带真实座位 ID 的节点都可以加入自动任务候选；直接预约会根据所选日期再次读取该座位的可用起止时段。候选使用时段按学校实时开放窗口生成，单次时长按服务规则限制，新增预约记录、在线取消、座位图即时预约和座位图到任务编辑器的草稿跳转，均先按当前用户校验账号归属。图书馆目录、布局、记录读取和即时提交按学校实际响应处理；周期任务仍保持暂停，直到验证码验证流程得到真实成功证据。

### 1.1 产品定位

一个面向校园场景的座位预约自动化平台。用户连接自己的校园账号，在实时座位图中配置位置与时间偏好，平台负责准备、执行和结果追踪。

核心价值：把分散在不同入口的登录、选座、定时执行和结果确认整合成一套清晰、可信的产品体验。

### 1.2 边界（做什么）

| 维度 | 范围 |
|---|---|
| 用户规模 | 50 人以内，邀请制，不公开注册 |
| 学校范围 | 首版仅支持当前"一考即过"小程序接口 |
| 预约能力 | 与 CLI 相同 — 按候选座位和时间段自动提交 |
| 部署目标 | 单台 VPS，Docker Compose，不上 K8s |
| 可用性 | 允许短暂中断（VPS 重启），不做高可用 |

### 1.3 非目标（明确不做什么）

- **不做公开注册** — 必须有邀请码才能注册
- **不做多学校通用适配** — 首版硬编码当前接口路径和请求格式
- **不做手机端** — 响应式 Web 即可，不做原生 App
- **不替换现有 CLI** — `seat_reserver.py` 继续可用，VPS cron 继续运行
- **不做高可用/自动扩缩容** — 单机 Docker Compose 足够
- **暂不接入自动支付/第三方收款** — Pro 价格和申请状态在站内透明展示，管理员人工确认后授予永久权益；邀请码仅用于注册和积分兑换，不提供站内直售。

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
│                   API (NestJS)                  │
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
| **invitations** | 邀请码 CRUD、校验和邀请关系 | 管理员创建注册码，用户积分兑换好友码 |
| **growth** | 会员权益、积分钱包/流水、邀请奖励和 Pro 申请 | 不处理第三方收款；服务端强制账号额度 |
| **school_accounts** | 学校账号 CRUD、密码加密存储、token 缓存 | 不直接预约 |
| **booking_tasks** | 任务 CRUD、候选策略配置、启用/禁用 | 不执行预约 |
| **booking_runs** | 运行日志查询（只读，由 worker 写入） | 不触发执行 |
| **seat_client** | 封装对"一考即过"小程序的 HTTP 请求 | 预约请求不缓存；只读目录/座位图由目录适配层做短 TTL 缓存，重试由 worker 层负责 |
| **scheduler** | 每日生成预热/预约执行计划 | 不执行任务本身 |
| **worker** | API 容器内的 BullMQ worker，从队列取任务、执行 seat_client 调用、写日志 | 不暴露 HTTP 接口；后续有规模需求时再单独扩容 |

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
后端：  NestJS 11 + TypeScript
ORM：   TypeORM 0.3+
数据库：PostgreSQL 16
缓存/锁：Redis 7 + BullMQ
调度：  Nest Schedule
部署：  Docker Compose
```

### 4.2 关键取舍

| 决策 | 选择 | 理由 | 否决的方案 |
|---|---|---|---|
| 后端语言 | TypeScript | 与 Kiranism 前端共享类型生态，适合常驻 API/队列进程 | Python — 继续保留为现有 CLI/Worker |
| Web 框架 | NestJS | 模块化、依赖注入、Swagger、守卫和常驻进程支持成熟 | FastAPI — 需要额外维护另一套运行时和类型体系 |
| 前端框架 | Next.js | SSR/SSG 灵活、shadcn/ui 生态成熟 | 纯 SPA (Vite) — 无 SSR，SEO 无所谓但开发体验差 |
| 数据库 | PostgreSQL | JSON 字段支持好（存候选策略）、够用、成熟 | SQLite — 并发写入锁问题；MySQL — 无特别优势 |
| 队列 | Redis + BullMQ | 与 NestJS 集成成熟，支持重试、延迟任务、幂等和队列监控 | Redis List — 需要自己补队列语义 |
| 调度 | Nest Schedule | 与常驻 NestJS 服务同进程，适合每日生成预热/预约任务 | 系统 cron — 无法感知任务状态 |
| ORM | TypeORM 0.3+ | 与 brocoders 基线一致，已有实体、迁移和仓库模式 | Prisma — 需要替换后端基线 |
| 认证 | HttpOnly Cookie + JWT | 安全、简单、前后端同域部署无跨域问题 | Bearer Token — 需前端存 token，XSS 风险；Session — 需服务端状态 |

### 4.3 不引入的东西

| 不引入 | 理由 |
|---|---|
| Kubernetes | 单机部署，Docker Compose 足够 |
| GraphQL | REST 够用，OpenAPI 自动生成文档 |
| Message Queue (RabbitMQ/Kafka) | Redis + BullMQ 足以处理每日几十个任务 |
| 微服务 | 3 个应用进程（web/api/worker）足够，不需要服务发现 |

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
users 1──1 memberships
users 1──1 points_wallets
users 1──N points_ledger
users 1──N referrals (referrer)
users 1──N pro_requests
```

平台不另造 workspace 表：本产品是一人一套预约资源的邀请制工具，`user.id` 就是租户根。所有账号、任务、运行记录和通知都直接归属于用户；管理员仅通过独立守卫访问脱敏的全局读模型。

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
| auth_mode | VARCHAR(20) | `direct` 或 `webvpn` |
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
| venue_type | VARCHAR(20) | `library`、`study_room` 或 `other` |
| building | VARCHAR(50) | 楼栋展示名称 |
| room_name | VARCHAR(120) | 图书馆/自习室名称 |
| primary_seat_label | VARCHAR(30) NULL | 面向用户展示的座位号 |
| primary_seat_id | VARCHAR(20) | 发送给学校接口的系统座位 ID |
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

> 本节前面的 REST 草案保留为设计记录；当前生产实现统一使用 `/api/v1/platform/*` 前缀，实际端点以 `api/src/platform/*controller.ts` 和 Swagger 为准。brocoders 模板原生公开认证/用户控制器未挂载，避免绕过邀请码和平台资源生命周期。

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
GET    /api/v1/platform/admin/users                    用户列表
POST   /api/v1/platform/admin/users/{id}/enable       启用用户
POST   /api/v1/platform/admin/users/{id}/disable      禁用用户
GET    /api/v1/platform/admin/overview                 全局统计
GET    /api/v1/platform/admin/accounts                全局账号（脱敏）
GET    /api/v1/platform/admin/tasks                   全局任务（只读）
GET    /api/v1/platform/admin/runs                    全局运行记录（只读）
GET    /api/v1/platform/invitations                    邀请码列表
POST   /api/v1/platform/invitations                    创建邀请码
DELETE /api/v1/platform/invitations/{id}               停用邀请码
GET    /api/v1/platform/rewards                       会员、积分和邀请概览
POST   /api/v1/platform/rewards/invite-codes           用积分兑换一次性邀请码
POST   /api/v1/platform/rewards/pro-request            提交 Pro 永久开通申请
GET    /api/v1/platform/admin/pro-requests              Pro 开通申请列表
POST   /api/v1/platform/admin/users/{id}/pro             管理员授予永久 Pro
POST   /api/v1/platform/admin/pro-requests/{id}/reject   管理员关闭 Pro 申请
```

#### Health

```
GET    /api/v1/platform/health              健康检查（DB + Redis 连通性）
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
                    │ (Nest Schedule) │
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

> 当前可执行的生产配置是仓库根目录的 `docker-compose.platform.yml`，配套变量模板是 `deploy/platform.env.example`。下面早期的拓扑草图和 Python Compose 片段保留作设计记录，不要直接照抄；实际端口、环境变量和健康检查以根目录 Compose 文件为准。

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

### 9.2 早期 docker-compose.yml 结构（已被生产文件取代）

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

### 9.3 反向代理（当前 VPS 的 OpenResty）

```
seat.rglens.com {
    /api/*  -> 127.0.0.1:3201
    /*      -> 127.0.0.1:3200
}

数据库和 Redis 不映射公网；OpenResty 负责 HTTPS，Next 前端通过同域 `/api/v1` 访问 Nest API。
```

### 9.4 资源估算

| 服务 | 内存 | CPU | 说明 |
|---|---|---|---|
| postgres | 256MB | 0.25 | 小规模够用 |
| redis | 64MB | 0.1 | 仅锁和队列 |
| api | 256MB | 0.25 | NestJS HTTP API |
| web | 256MB | 0.25 | Next.js |
| worker | 128MB | 0.1 | 按需运行 |
| scheduler | 64MB | 0.1 | 几乎空闲 |
| **合计** | **~1GB** | **~1 CPU** | 1 核 2G VPS 足够 |

---

## 10. MVP 分阶段计划

### Phase 1: 项目骨架（1-2 天）

**目标**：所有服务能 `docker compose up` 启动

- [x] 创建 `web/` Next.js 项目，初始化 shadcn/ui
- [x] 导入 `api/` brocoders NestJS 后端基线
- [x] 配置 Docker Compose：web + api + postgres + redis
- [x] `GET /api/v1/platform/health` 返回数据库和 Redis 状态
- [x] 项目 `.gitignore` 和 `.env.example`

**验收**：`docker compose up` 后所有容器健康，浏览器能打开 web 和 /api/v1/docs

### Phase 2: 认证和邀请码（2-3 天）

**目标**：用户能注册和登录

- [x] TypeORM entities: users, invitations, school_accounts, booking_tasks, booking_runs, notifications, memberships, points, referrals, Pro requests
- [x] TypeORM migration
- [x] POST /platform/auth/register（首个账号免邀请码，之后需邀请码）
- [x] POST /platform/auth/login（HttpOnly cookie + JWT）
- [x] GET /platform/auth/me
- [x] Admin: 邀请码、成员状态、Pro 申请和全局概览
- [x] 管理员种子账号（可选环境变量）
- [x] 后端关键单元测试：加密、绑定前验证、用户归属、停用任务跳过、成功预约记录

**验收**：无邀请码不能注册；有效邀请码可注册并登录；/auth/me 返回当前用户

### Phase 3: 学校账号管理（2 天）

**目标**：用户能添加和验证学校账号

- [x] TypeORM entity: school_accounts
- [x] AES-256-GCM 加密/解密工具
- [x] POST /platform/accounts（加密存储已有一考即过登录凭据）
- [x] POST /platform/accounts/{id}/refresh（调 /rest/auth + /rest/v2/user）
- [x] seat_client 模块：auth(), verifyToken()
- [x] 日志脱敏：密码和 token 不写入日志
- [x] 测试：加密存储、verify 成功/失败、脱敏（关键路径用 mock SeatClient 覆盖）
- [x] 图书馆 WebVPN 网关、校园 SSO、动态代理、ssoAuth 和真实链路已验证；自习室 direct 与 WebVPN/SSO 两条真实链路均已在 VPS 验证

**验收**：自习室账号按历史成功模式通过 direct 或 WebVPN verify；图书馆账号通过 WebVPN verify；错误凭据失败；DB 中无明文凭据；日志中无明文 token。校园密码不会被默认视为 `/rest/auth` password。

### Phase 4: 预约任务管理（2 天）

**目标**：用户能创建和管理预约任务

- [x] TypeORM entity: booking_tasks
- [x] 任务 CRUD API
- [x] 候选策略校验（seat_id、time_candidates 格式）
- [x] 启用/禁用任务
- [x] dry-run（只检查 token + 生成候选列表，不调 freeBook）
- [ ] 用户最多 N 个启用任务的限制（当前不设硬上限）
- [x] 测试：用户归属条件和候选校验；数据库复合外键补充第二道隔离保护

**验收**：用户只能看到自己的任务；dry-run 不发送 freeBook

### Phase 5: Worker 和调度（3 天）

**目标**：系统每天自动执行预热和预约

- [x] seat_client 模块：freeBook()
- [x] Scheduler：每天 05:59:50 预热、06:00 生成预约任务
- [x] Worker：消费 prewarm 队列
- [x] Worker：消费 booking 队列
- [x] Redis 锁：防重复执行
- [x] booking_runs 日志写入
- [x] 错峰偏移逻辑
- [x] 手动触发 prewarm / booking 的 API
- [x] 测试：锁、日志写入、成功路径和停用后的排队任务跳过

**验收**：手动触发 prewarm 能刷新 token；booking 成功/失败都写日志；同一任务不重复执行

### Phase 6: 前端面板（3-5 天）

**目标**：完整的 Web 管理界面

- [x] 登录/注册页
- [x] Dashboard：动态状态卡片、最近成功/失败
- [x] 学校账号页：添加、验证、编辑、删除、列表
- [x] 预约任务页：创建、编辑、启禁用、dry-run、预热、手动执行
- [x] 运行日志页：按任务筛选、详情展示
- [x] 管理员页：邀请码管理、用户列表、全局概览

**验收**：平台账号注册到创建任务全流程可用；普通用户只能绑定 1 个校园账号，Pro 用户只能绑定 3 个；管理员可创建邀请码、处理 Pro 申请并授予永久权益；用户可查看积分流水并用积分兑换一次性邀请码。自习室 direct/WebVPN 与图书馆 WebVPN 服务路线分别完成绑定、刷新和真实预约验证。2026-09-03、09-04 的 WebVPN 自习室生产测试均获得学校回执。

### Phase 7: 打磨和文档（1-2 天）

- [x] 错误处理和用户提示优化
- [x] 加载状态和空状态设计
- [x] 部署文档
- [x] .env.example 完善
- [x] README 更新

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
