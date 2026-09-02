# 文档地图

| 文档 | 用途 | 状态 |
|---|---|---|
| [planning/platform-mvp.md](planning/platform-mvp.md) | 平台 MVP 范围、技术栈、阶段任务和验收标准 | direct 与 WebVPN 绑定链路均已验证 |
| [planning/architecture-proposal.md](planning/architecture-proposal.md) | 平台架构、数据模型、接口和部署取舍 | 已确定，持续更新 |
| [planning/account-binding-research.md](planning/account-binding-research.md) | 登录、绑定和授权链路的协议结论与安全边界 | WebVPN/CAS 链路已落地 |
| [deployment/platform.md](deployment/platform.md) | 平台生产部署、使用、自动执行和 Reqable 采集 | 当前部署说明 |
| [superpowers/specs/2026-06-09-vps-telegram-bot-design.md](superpowers/specs/2026-06-09-vps-telegram-bot-design.md) | VPS Telegram bot V1 设计 | 设计稿 |

当前前端控制台位于仓库的 `web/`，其局部开发说明见 [web/README.md](../web/README.md)；NestJS 平台后端位于 `api/`，生产编排入口为根目录的 `docker-compose.platform.yml`。根目录的 Python CLI 和 VPS cron 仍是独立的现行生产抢座链路。

Reqable 自动化入口见 [tools/binding_discovery/reqable_report_server.py](../tools/binding_discovery/reqable_report_server.py)：接收 Reqable Report Server 的 HAR，先脱敏再保存；`freeBook` 会被标记为危险请求，不用于登录/绑定分析。
