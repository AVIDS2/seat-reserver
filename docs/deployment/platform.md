# 平台部署与使用

## 生产位置

- 域名：`https://seat.rglens.com`
- VPS 项目：`/app/seat-reservation-platform/repo`
- 环境变量：`/app/seat-reservation-platform/platform.env`，权限 `600`
- Web：仅绑定 VPS `127.0.0.1:3200`
- API：仅绑定 VPS `127.0.0.1:3201`
- 数据库和 Redis：只加入 Docker 内部网络，不暴露公网

平台资源归属以 `user.id` 为租户根：学校账号、预约任务、运行记录、通知均带 `userId`，普通用户的每个查询和写操作都必须带当前用户条件；数据库额外用复合外键阻止任务或运行记录跨账号归属。管理员接口只提供脱敏的全局只读视图和成员/邀请码管理。

公网入口由 VPS 上已有 OpenResty 提供，配置文件为 `/opt/1panel/www/conf.d/seat.rglens.com.conf`。

## 首次使用

首页 `https://seat.rglens.com/` 是席定面向用户的产品入口：未登录时提供产品说明、登录和注册入口；登录后显示进入控制台和退出登录。登录/注册页面左上角 Logo 始终返回首页，控制台退出后也返回首页。落地页直接迁移 `wasp-lang/open-saas` 的 `template/app/src/landing-page` 组件结构和交互模式，按其 MIT License 在 Next.js 中适配；没有引入 Wasp 运行时、支付模块或远程 Roadmap 查询，业务内容、资产和入口均替换为本平台实现。

落地页只展示通用产品能力、实时状态和相对时间，不展示任何个人脚本的开放时刻、错峰参数或真实预约回执；具体调度时刻只属于任务配置和运维说明。

落地页默认使用 `Claude` 主题：它保留 OpenSaaS 需要的高对比黑字、暖白底和单一橙色行动色，同时在控制台里仍可切换其它模板主题。页面动效只服务于状态反馈和内容导航：Orbit/SVG 展示执行状态，轮播展示真实功能界面，FAQ 使用网格行过渡收展；开启系统减少动态效果后会自动降级。

1. 打开 `https://seat.rglens.com/auth/sign-up`。
2. 第一个注册账号自动成为管理员。
3. 管理员进入“管理员工作台”，创建邀请码并复制给朋友。
4. 朋友在注册页面填写邀请码，注册后是普通用户。
5. 用户在“账号与授权”添加校园统一身份认证账号；自习室连接会随账号验证建立，图书馆是独立服务，用户可以在对应账号卡片上主动点击“连接图书馆”。
6. 后端按服务分别保存加密业务凭证，任何服务都不会复用另一套系统的 Token。
7. “座位图”页面可单独查看实时馆区/楼栋、空间、日期和座位状态；每个真实座位都可被选中，首个座位为主座位，其余为有序备选。选中后可以跳转到任务编辑器，也可以按学校返回的时段直接预约。
8. 在“执行频率”选择每天、工作日或自定义星期。座位图会使用学校当前可预约日期读取实时布局，日期不是任务配置项，任务按频率持续执行。
9. “我的预约”从每个已接入账号的学校接口读取历史记录；待使用或使用中的记录可以在线取消，取消动作仍由学校系统最终确认。

学校座位服务通常每天 `00:00-05:00` 维护。维护期间目录、Token 验证和座位查询可能返回 `422` 或“系统维护中”；平台会把这类状态显示为维护提示，不会据此判定学校账号失效。`06:00` 是学校开放预约和平台提交自动任务的窗口，任务实际目标使用时段默认限制在 `08:00-22:00`；两者不是同一个时间概念。实时座位图返回的当前状态只代表当前时刻，不能据此否定后续时段的预约资格。

登录会话由 API 写入 `HttpOnly` 的 `access_token` 和 `refresh_token` Cookie。生产 Web
保护层只拦截完全没有会话 Cookie 的请求，工作台布局再通过 JWT 做最终鉴权；这样不会让
重复的身份探测触发限流后把已登录用户误跳回登录页。`/auth/me` 是已认证的只读探测，
不参与限流；登录、注册和刷新仍保留限流保护。

平台按账号保存实际成功的认证路线：自习室可以使用公网 `cczukaoyan` 直连 Token，也可以使用 `zmvpn` 网关、校园 SSO 和座位系统代理 Token；图书馆固定使用后者。新账号自动探测，成功后持久化 `direct` 或 `webvpn` 模式；已有账号恢复时优先复用已保存模式。用户端始终只需填写学号和密码。

WebVPN 网关登录会先读取当前登录页下发的会话密钥，再按网关页面的 AES 参数提交账号密码；登录后的 `clientInfo` Cookie 按 `/enlink/` 路径读取，以兼容网关更新后的 Cookie 作用域。

WebVPN 代理 API 必须保留裸查询标志 `enlink-vpn`；平台在追加业务 Token 时保留原有分页等查询参数，并生成 `...?page=1&token=...&enlink-vpn`，不能序列化为 `enlink-vpn=`。

已有学校账号恢复连接时沿用账号服务连接中最后一次成功的模式：`direct` 只刷新公网 Token，`webvpn` 恢复或重建网关会话；首次添加账号才执行 direct 优先、失败后 WebVPN 回退的自动探测。

2026-09-04 的故障排查确认：伯乐和董自创此前曾通过 WebVPN/SSO 真实预约自习室；后续把自习室强制改为 direct，导致已有 WebVPN 账号被错误切断。现已恢复按账号模式路由。API 重启会清空 WebVPN 的进程内运行对象，但会把加密后的 Cookie、代理上下文和过期时间保存到服务连接，并在重启后按需恢复；恢复失败才重新登录。VPS 当前到 `sso.cczu.edu.cn` 的公网连接超时，因此 WebVPN 路线仍依赖学校统一认证链路可达且凭据有效；direct 路线不依赖它。

自习室成功链路的 `/rest/v2/settings` 返回 `isCaptchaOpen=false`，不需要预约图形验证码。此前“验证码错误”来自平台错误使用 `zuowei.cczu.edu.cn` 图书馆代理入口并发送不完整请求体，不代表账号未绑定。正确的自习室预约体是七字段 `multipart/form-data`：`startTime`、`endTime`、`seat`、`date`、`userId`、`username` 和空 `authid`。

任务里的座位号用于人类可读展示，系统座位 ID 只在后端提交预约时使用。控制台已经接入学校实时目录与布局，用户不再手填系统 ID；馆区/楼栋、空间、日期和占用状态随服务实时刷新。任务支持“每天、工作日、自定义星期”；数据库仍兼容历史单次任务，但新建和编辑界面不再暴露单次日期。候选时间使用学校服务的半小时刻度，默认 `08:00-22:00`；实时起始时段只用于直接预约和提示，不会改写自动任务的配置。

预约记录接口为 `GET /api/v1/platform/reservations?accountId=<id>&serviceType=<study_room|library>`；取消使用 `POST /api/v1/platform/reservations/<reservationId>/cancel`，直接预约使用 `POST /api/v1/platform/reservations/book`。这些接口都先按当前平台用户校验学校账号归属，再使用对应服务连接，不能跨用户或跨账号操作。

座位图性能：同一浏览器会话按“账号 + 预约系统 + 空间 + 日期”缓存目录、布局和时段，并合并相同参数的并发请求；API 进程也做同样的用户隔离短缓存。目录缓存 5 分钟、布局缓存 15 秒、时段缓存 10 秒；“刷新座位状态”会带 `refresh=1` 同时清除对应 API 缓存并重新读取学校数据。缓存只包含学校公开的只读目录/状态，不包含密码、Token 或预约写请求。

任务编辑器在桌面端使用最多 `1040px` 的内容宽度并按内容自适应高度，在手机端使用稳定的 `svh` 高度、标题固定区、独立滚动区和底部固定操作区；任务编辑拆为“选择位置”和“设置策略”两步，座位图不再与表单并排挤压。Select/Popover 的内容限制在视口宽度内并使用 `overscroll-contain`，非模态选择器不会锁定页面滚动，移动端账号、楼栋和空间菜单使用紧凑内容宽，防止打开控件时页面横向或纵向跳动。管理员工作台的标签栏在手机端局部吸顶，运行记录、账号编辑和邀请码弹窗也遵循同一容器规则。

图书馆服务使用独立的 `cczu` 连接，可读取科教城校区馆、西太湖校区馆和无门禁空间的楼层、房间、座位布局与时段。学校当前返回 `isCaptchaOpen=true`，图书馆任务会保持暂停并提示先完成验证码确认；在该流程完成前，系统不会把图书馆任务加入真实预约队列。

## 自动执行

API 容器内的 Nest Schedule 使用北京时间：

- `05:59:50`：为所有启用任务加入 Token 预热队列。
- `06:00:00`：为所有启用任务加入预约队列，按任务的错峰秒数延迟执行。
- `08:00-22:00`：任务候选时段的业务边界；不是 scheduler 的启动时间，也不会阻止学校接口返回更细的直接预约选项。
- Worker 先按账号服务连接中最后一次成功的认证模式验证缓存 Token；WebVPN 模式先恢复加密的网关 Cookie、校园 SSO、代理入口和签名上下文，失效时再用已加密保存的学校账号密码重新登录，direct 模式只访问公网接口。当前实现不创建系统级 VPN，也不改变 VPS 全局路由。
- 预约成功立即停止候选尝试；成功、失败、跳过和异常都会写入运行记录并生成通知。

2026-09-02 的生产验证先复现了旧 WebVPN 路径的 HTTP 200、业务码 `1`、“验证码错误”。修复为脚本同款直连优先并同步脚本账号后，账号 1 的认证和 `/rest/v2/user` 校验均返回 HTTP 200、业务码 `0`；随后真实调用 `freeBook` 返回 HTTP 200、业务码 `1`、“已有1个有效预约，请在使用结束后再次进行选择”。这证明平台已经打通到真实预约接口，失败原因是该账号已有预约，不是验证码或请求头缺失；仍需以真实可用目标返回成功状态和回执作为最终抢座成功标准。

2026-09-03 曾使用生产测试账号完成 WebVPN 兼容链路验收：平台自动登录、交换和验证 Token，从实时布局筛出可用座位，并在第一次尝试成功预约 5 号楼 1 层智能自习室 148 号，时间 16:00-17:00。2026-09-04 伯乐账号再次通过平台成功预约 5 号楼 1 层智能自习室 044，时间 10:01-14:00。两次均由学校返回 HTTP 200、业务码 `0` 和真实回执；临时平台任务随后删除，学校预约保留。

“检查 / dry-run”只调用 Token 验证并生成候选列表，不调用 `freeBook`；“立即运行”会进入真实预约队列。

管理员工作台还提供全局运行记录、任务和学校账号的脱敏查看；不会返回学校密码、缓存 Token 或原始敏感请求。

## Reqable 自动化采集

Reqable 官方支持 Report Server、HAR、Python Script 和 MCP。项目提供本地接收器：

```powershell
python tools/binding_discovery/reqable_report_server.py --bind 0.0.0.0 --port 8788 --path /reqable/report
```

在 Reqable Report Server 填入本机局域网地址：

```text
http://<本机局域网IP>:8788/reqable/report
```

只完成登录、选择学校/系统、激活码绑定和进入用户页，不提交预约。接收器会把 HAR 转换成项目分析格式，自动脱敏密码、Token、Cookie 和敏感查询参数，并标记 `freeBook` 请求。

抓包分析：

```powershell
python tools/binding_discovery/analyze_capture.py tools/binding_discovery/captures/<文件名>.json
```

当前平台已经固化按账号保存的认证路由：自习室支持 direct 和 webvpn，图书馆使用 webvpn。WebVPN 登录字段、CAS 票据、代理地址、业务 Token 和签名种子均在运行时动态获取。不要把真实 HAR、学校密码、Token 或 HMAC key 提交到 Git。

## 更新服务

部署新版本前先构建并验证 API/Web，再把仓库包上传到新目录。生产更新使用：

```bash
# 本地 web/ 发布前先执行 bun run build && bun run prepare:runtime，
# 将生成的 web/runtime 一并放入发布包。
cd /app/seat-reservation-platform/repo
docker compose -p seat-platform -f docker-compose.platform.yml --env-file /app/seat-reservation-platform/platform.env up -d --build
docker compose -p seat-platform -f docker-compose.platform.yml --env-file /app/seat-reservation-platform/platform.env ps
```

`prepare:runtime` 会为 standalone 产物中 Turbopack 生成的 OpenTelemetry external 别名补齐轻量兼容模块；Web 构建阶段通过 `NEXT_PUBLIC_SENTRY_DISABLED=true` 关闭未配置的 Sentry。

API 容器启动时自动执行 migration 和 platform seed。不要执行 `down -v`，否则会删除平台数据库卷。

生产 Compose 为 Postgres、Redis、API 和 Web 设置了运行时资源上限；发布阶段应在本地生成 `web/runtime`，避免在小规格 VPS 上执行 Next.js 编译。

## 健康检查

```text
GET https://seat.rglens.com/api/v1/platform/health
```

期望返回：

```json
{"status":"ok","database":"ok","redis":"ok"}
```

证书续期脚本 `/app/renew-rglens-certs.sh` 已纳入现有每日 cron，并包含 `seat.rglens.com` 证书续期和 OpenResty reload。
