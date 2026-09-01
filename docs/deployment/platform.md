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

1. 打开 `https://seat.rglens.com/auth/sign-up`。
2. 第一个注册账号自动成为管理员。
3. 管理员进入“管理员工作台”，创建邀请码并复制给朋友。
4. 朋友在注册页面填写邀请码，注册后是普通用户。
5. 每个用户在“账号与授权”添加自己的学校账号和密码。
6. 后端立即调用学校登录接口，再调用 `/rest/v2/user` 验证 Token；验证成功后才保存账号。
7. 在“预约任务”配置主座位、备选座位、候选时间段和执行参数，并打开任务开关。

## 自动执行

API 容器内的 Nest Schedule 使用北京时间：

- `05:59:50`：为所有启用任务加入 Token 预热队列。
- `06:00:00`：为所有启用任务加入预约队列，按任务的错峰秒数延迟执行。
- Worker 先验证缓存 Token，失效时用已加密保存的学校账号密码重新登录。
- 预约成功立即停止候选尝试；成功、失败、跳过和异常都会写入运行记录并生成通知。

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

当前平台已经固化已验证的正常请求头和接口路径；只有学校接口实际变更时，才需要重新采集并更新 `SEAT_*` 配置。不要把真实 HAR、学校密码、Token 或 HMAC key 提交到 Git。

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
