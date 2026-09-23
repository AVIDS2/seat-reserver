# 文档地图

| 文档 | 用途 | 状态 |
|---|---|---|
| [planning/platform-mvp.md](planning/platform-mvp.md) | 平台范围、技术栈、阶段任务和验收标准 | 自习室生产可用，图书馆实时目录、会员邀请权益与席定自习室已接入 |
| [planning/architecture-proposal.md](planning/architecture-proposal.md) | 平台架构、数据模型、接口和部署取舍 | 多服务连接、实时座位图与 Pro/积分/邀请域已落地 |
| [planning/account-binding-research.md](planning/account-binding-research.md) | 登录、绑定和授权链路的协议结论与安全边界 | 自习室自动链路投产，图书馆连接与验证码边界已确认；南京工业大学 GraphQL 适配器已完成生产预约/取消验收 |
| [deployment/platform.md](deployment/platform.md) | 平台生产部署、使用、自动执行、连接自动恢复和 Reqable 采集 | 当前部署说明 |
| [planning/ai-module.md](planning/ai-module.md) | 席定领航 AI 模块定位、复用方案、任务和安全边界 | P0 实施中 |
| [web/THIRD_PARTY_NOTICES.md](../web/THIRD_PARTY_NOTICES.md) | 前端引入的第三方组件与许可证文本 | Trophy Gamification UI（MIT） |
| [superpowers/specs/2026-06-09-vps-telegram-bot-design.md](superpowers/specs/2026-06-09-vps-telegram-bot-design.md) | VPS Telegram bot V1 设计 | 设计稿 |

当前前端控制台位于仓库的 `web/`，产品名为“席定”，其局部开发说明见 [web/README.md](../web/README.md)；NestJS 平台后端位于 `api/`，生产编排入口为根目录的 `docker-compose.platform.yml`。根目录的 Python CLI 和 VPS cron 仍是独立的现行生产抢座链路。

Reqable 自动化入口见 [tools/binding_discovery/reqable_report_server.py](../tools/binding_discovery/reqable_report_server.py)：接收 Reqable Report Server 的 HAR，先脱敏再保存；`freeBook` 会被标记为危险请求，不用于登录/绑定分析。
