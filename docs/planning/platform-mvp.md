# Seat Reserver Platform MVP 开发计划

> 给 Claude Code 的工程启动说明。当前仓库已有稳定可用的 `seat_reserver.py` 单账号 CLI 和 VPS cron 部署。平台化开发必须保持现有 CLI 兼容，不要破坏当前 VPS 上的 `.env` / `.env.friend` / cron 运行方式。

## 当前进度

2026-09-04 平台加入统一实时场馆目录和可视化座位图：楼栋、空间、日期、座位号、占用状态均来自学校接口，系统 ID 不再暴露给普通用户；控制台新增独立“座位图”页面，可在不创建任务的情况下浏览实时状态。任意真实座位都可作为自动任务候选，颜色只表示当前状态；直接预约会再通过座位时段接口判断所选日期的可用时间。一个校园账号可建立彼此独立的自习室与图书馆服务连接，任务支持每天、工作日、自定义星期和多个指定日期执行，候选时间按学校实时开放窗口生成，单次时长按服务限制，数据库兼容历史单次任务。任务编辑拆为“账号与空间”和“座位与时间”两步，第一步不能触发保存；第二步明确展示可添加的候选时间段与日期规则。桌面端使用宽内容区和自适应高度，移动端弹窗使用稳定小视口和内部滚动，账号/楼栋/空间菜单使用紧凑内容宽，避免选择弹层造成整页回流；学校 `00:00-05:00` 维护响应会被明确显示为维护状态。新增实时预约记录、在线取消和座位图直接预约接口，并保留当前用户到学校账号的归属校验。自习室自动预约链路保持生产可用；图书馆目录、布局和时间数据已经接通，直接预约支持在平台内获取学校点选验证码、由用户完成一次人工点选、服务端校验成功后自动提交预约。图书馆周期任务仍保持暂停，直到确认验证码是否可跨预约复用或接入无需逐次验证的合法业务链路。
2026-09-04 平台新增会员与邀请权益链路：普通用户最多绑定 1 个校园账号，Pro 用户最多绑定 3 个，Pro 定价为人民币 20 元、一次开通永久有效；权益由服务端统一计算，管理员确认开通申请后才写入永久权益。用户通过活动中心每日签到获得可配置积分，受邀用户完成首次账号验证后邀请人获得积分，积分兑换的一次性邀请码默认 30 天有效且仅显示一次。积分使用钱包行锁和不可变流水，邀请关系、Pro 申请和管理员开通记录均保留审计信息；当前不接入第三方自动收款，外部人工确认后由管理员在后台授予 Pro。
2026-09-06 平台连接恢复从一次性手动重连改为持久化自动恢复：连接失败会记录尝试时间、指数退避的下一次重试时间和次数，调度器每 5 分钟处理到期连接；前端账号页每 30 秒同步服务状态，短暂网络失败显示“系统自动恢复中”，只有多次失败后才显示需要处理。总览首页任务卡的开关现在直接控制真实启用/暂停状态，并在手机端把执行信息和开关拆成稳定的上下两行。开放倒计时改为本地局部计时，不触发全局刷新；搜索命令面板关闭 KBar 自带的额外滚动条补偿，避免打开时页面横移。落地页能力区改为 4 列对称网格，评价区使用等高网格，Hero 使用 React preload、低清本地占位和高优先级原图加载。
2026-09-07 平台新增“签到保护”页面和服务端定时监测：用户主动开启后，系统每分钟读取自习室预约历史，在预约开始后仍未显示签到且距离允许迟到窗口结束还剩 1 分钟时，尝试自动取消并发送站内通知；默认关闭，仅作用于自习室，图书馆仍保留手动取消。新增席定币充值展示页，展示价格锚点但支付通道明确标记为未上架；新增个人资料头像上传、AvatarBadge 在线状态和本设备气泡风格选择，头像文件沿用模板文件服务保存。
2026-09-08 积分改为活动中心每日签到 30 席定币，服务端使用唯一流水键保证每日幂等；新增创建任务、连接图书馆、签到保护和首次成功预约等 10–60 席定币支线活动，活动条件在 API 服务端校验。活动中心使用本地接入的 React Bits CountUp/ShinyText 动效，保留减少动态效果降级。

前端底座决策：使用 Next.js 16、Tailwind CSS 4、shadcn/ui、TanStack Query/Table、Motion 和 Tabler Icons。后端底座决策：使用 NestJS 11、TypeORM、PostgreSQL、JWT/HttpOnly Cookie、Swagger 和 Docker；预约执行层使用 Redis + BullMQ，并由 Nest Schedule 生成每日任务。生产模式下前端通过同域 `/api/v1` 访问 API，真实预约请求不会进入浏览器。生产字体使用主题定义的离线系统回退；落地页图片使用预生成 AVIF/WebP 响应式资源，不在运行时处理原始 4K PNG。

## 目标

构建一个邀请制抢座任务管理平台，让用户通过平台账号登录后，配置自己的学校账号、目标座位、时间段和备选策略。系统每天自动预热 token，并在预约开放时间执行任务。

当前支持两套彼此独立的校园座位服务：

```text
GET  /cczukaoyan/rest/auth?username=...&password=...
GET  /cczukaoyan/rest/v2/user
POST /cczukaoyan/rest/v2/freeBook

GET  /cczu/rest/v2/free/filters
GET  /cczu/rest/v2/room/layoutByDate/{room}/{date}
GET  /cczu/rest/v2/startTimesForSeat/{seat}/{date}
```

## 非目标

- 不做验证码绕过、风控绕过、签名逆向或高频刷接口。
- 不做公开注册，必须邀请码注册。
- 不做多学校通用适配，当前先覆盖本校自习室与图书馆两套服务。
- 不替换当前 VPS cron 版，平台先独立开发和部署。

## 推荐技术栈

```text
前端：Next.js + TypeScript + shadcn/ui + Tailwind CSS
数据请求：TanStack Query
表单：React Hook Form + Zod
后端：NestJS + TypeScript
数据库：PostgreSQL
ORM：TypeORM
队列/锁：Redis + BullMQ
调度：Nest Schedule
任务执行：API 容器内的 BullMQ worker（后续可独立扩容）
部署：Docker Compose
```

## 服务拆分

```text
web        Next.js 管理面板
api        NestJS HTTP API
worker     API 内的 NestJS/BullMQ 执行器，处理 token 刷新和预约请求
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
  src/
    auth/
    users/
    database/
    platform/
      entities/
      dto/
      seat-client.service.ts
      platform-scheduler.ts
      platform-processor.ts
  package.json
  env-example-relational

docker-compose.yml
.env.example
```

## 核心安全要求

- 平台用户密码必须 hash，使用 Argon2 或 bcrypt。
- 学校账号密码和缓存 token 必须使用 AES-256-GCM 加密存储，密钥来自环境变量 `CREDENTIAL_ENCRYPTION_KEY`。
- 日志中禁止打印学校密码、token、邀请码明文。
- 普通用户只能访问自己的学校账号、任务和运行日志。
- 管理员才能创建注册邀请码、查看全局任务状态和授予 Pro 权益；普通用户只能用积分兑换自己的单次邀请码。
- 任务数量限制按后续运营需要增加；当前先通过邀请制和管理员权限控制规模。

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

### platform_growth

```text
platform_membership: user_id, plan(free|pro), pro_activated_at, pro_expires_at(NULL=permanent), source, granted_by_user_id
platform_points_wallet: user_id(unique), points_balance
platform_points_ledger: user_id, amount, balance_after, event_type, event_key(unique), metadata, created_at
platform_referral: referrer_user_id, referred_user_id(unique), invitation_id, status, qualified_at
platform_pro_request: user_id, price_cents(2000), status, handled_by_user_id, handled_at
```

### school_accounts

```text
id
user_id
school_username
encrypted_school_password
cached_token
auth_mode: direct | webvpn
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
primary_seat_label
venue_type
building
room_name
building_id
room_id
schedule_mode: daily | weekdays | weekly | dates | once  # once 仅兼容历史任务
schedule_weekdays: 0..6[]  # weekly 自定义星期；0=周日
schedule_dates: date[]  # dates 模式的多个指定执行日期
target_date  # 仅兼容历史单次任务；新任务为空
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

### 座位图规划

前端按“预约系统 → 楼栋 → 空间 → 日期 → 时间段”读取学校实时目录，再在座位图上选择座位。每个座位同时保存展示号和学校系统 ID；展示号用于用户识别，系统 ID 只作为预约请求参数。

座位图至少需要支持 `available`（可选）、`selected`（当前选择）、`reserved`（学校已预约）、`unavailable`（不可用）和 `unknown`（尚未获取状态）五种状态。`reserved` 必须来自指定日期和时间段的学校接口数据，不能用平台自己的运行记录推断；同一座位在不同时间段可以呈现不同状态。用户自己的已预约记录应单独显示“我的预约”，避免与他人占用混淆。

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
- Pro 开通申请和授予记录。
- 用户列表。
- 全局任务运行状态。

### 会员与邀请

- 展示当前方案、校园账号额度、Pro 价格和永久有效状态。
- 展示积分余额、邀请进度、积分流水和已兑换邀请码状态。
- 支持提交 Pro 开通申请和用积分兑换一次性邀请码。

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
- 导入 `api/` brocoders NestJS 后端基线。
- [x] 创建 Docker Compose：web、api、postgres、redis。
- [x] 添加健康检查接口 `/api/v1/platform/health`。

验收：

```text
docker compose up 后 web 和 api 都能启动
GET /api/v1/platform/health 返回 ok
```

### Phase 2: 数据库和认证

- [x] 建 TypeORM entities 和 migration。
- [x] 配置生产启动时自动 migration/seed。
- [x] 实现用户注册/登录和 HttpOnly Cookie。
- [x] 实现邀请码注册和管理员权限。
- [x] 实现可选管理员种子账号。
- [x] 实现永久 Pro 权益、校园账号数量限制、积分流水和邀请奖励。
- [x] 实现 Pro 开通申请、管理员授予和用户会员邀请页面。

验收：

```text
无邀请码不能注册
有效邀请码可以注册
登录后 /auth/me 返回当前用户
```

### Phase 3: 学校账号

- [x] 实现学校账号 AES-256-GCM 加密保存。
- [x] 实现已有一考即过凭据验证：调用 `/rest/auth` 和 `/rest/v2/user`。
- [x] 保存加密 cached_token。
- [x] 完成图书馆账号通过 WebVPN 网关、校园 SSO 和动态代理入口换取业务 Token；自习室支持公网 direct 和 WebVPN/SSO 两条认证路线。

验收：

```text
已有一考即过凭据 verify 成功
错误凭据 verify 失败
全新自习室账号通过 direct 认证并 verify 成功；图书馆账号通过 WebVPN 和校园 SSO 认证并 verify 成功
数据库不出现明文学校密码
日志不出现明文 token/password
```

### Phase 4: 预约任务

- [x] 实现任务创建、更新、启用/禁用和删除。
- [x] 实现候选座位/时间段校验。
- [x] 实现手动队列触发和运行记录。
- [x] dry-run：只验证 Token 和候选列表，不发送 `freeBook`。

验收：

```text
用户只能看到自己的任务
primary seat 和 time candidates 可以保存
dry-run 不发送 freeBook
```

### Phase 5: worker 和 scheduler

- [x] 实现 prewarm job。
- [x] 实现 booking job。
- [x] 实现 Redis lock 和 BullMQ 延迟队列。
- [x] 实现 booking_runs 日志。

验收：

```text
手动触发 prewarm 能刷新 token
booking job 成功/失败都会写 booking_runs
同一 task/date/run_type 不会重复执行
```

### Phase 6: 前端面板

- [x] 登录/注册页。
- [x] Dashboard。
- [x] 学校账号页。
- [x] 任务页。
- [x] 日志页。
- [x] 管理员工作台：用户状态、邀请码和全局运行统计。
- [x] 管理员工作台：Pro 申请、方案状态和运营统计。
- [x] 管理员脱敏查看全局账号、任务和运行记录。
- [x] 关闭 brocoders 模板遗留的公开注册、社交登录和通用用户管理路由，平台统一走邀请制认证。
- [x] 数据库复合外键约束任务/运行记录与账号所属用户一致。
- [x] 运行记录按任务、日期和类型幂等，停用任务不会执行已排队预约。

验收：

```text
可以完成从注册到创建任务的全流程
可以手动 verify 学校账号
可以查看运行日志
管理员可以创建邀请码、查看成员、处理 Pro 申请并启用/禁用用户
```

已有账号的 direct Token 刷新、`/rest/v2/user` 校验和真实预约 POST 已在 VPS 验证；自习室 WebVPN 网关登录、校园 SSO、代理入口、`ssoAuth` 和真实预约 POST 也已验证。账号恢复时沿用历史成功模式。

## 测试要求

后端：

```text
Jest
Nest testing module
PostgreSQL test database or mocked repositories
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
- 外部接口协议变更先用 mock 和只读接口验证；真实预约只在用户明确授权的独立测试任务或启用任务中执行。
- 生产平台启用任务会由 Nest Schedule 在北京时间 05:59:50 预热、06:00 执行；预约页面只读取真实 API 和数据库。

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
