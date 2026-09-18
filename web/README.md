# 一考即过预约控制台

基于 [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) 改造的现代化预约控制台。

## 当前状态

当前版本完成了可连接 NestJS 平台 API 的预约控制台：

- 总览：明早执行窗口、任务概览、账号状态和最近运行。
- 预约任务：搜索、启用/暂停、新建、编辑、删除、预热、dry-run 和手动运行。
- 账号与授权：脱敏账号信息、Token 状态、刷新和移除。
- 运行记录：状态筛选、搜索和运行详情。
- 通知中心：从 API 读取预约/预热结果并持久化已读状态。
- 管理员工作台：用户状态、邀请码和全局运行统计。
- 管理员全局视图：脱敏查看所有账号、任务和运行记录。
- 登录/注册：NestJS JWT + HttpOnly Cookie，支持 refresh token 轮换。
- 席定领航：复用 AI SDK 的流式消息 UI，读取脱敏的平台摘要提供专注计划、节奏洞察和空间建议；未配置模型时显示未启用状态。

本地默认仍可使用 mock 数据。生产环境由 `NEXT_PUBLIC_DEMO_MODE=false` 开启真实 API；真实预约请求只在后端 BullMQ worker 执行。

## 开发

要求 Node.js 22+ 和 Bun。

```bash
bun install
bun run dev
```

打开 <http://localhost:3000/auth/sign-in>。

常用检查：

```bash
bun run typecheck
bun run lint
bun run build
bun run prepare:runtime
```

生产 Compose 使用 `Dockerfile.platform-runtime`，它只打包 `runtime/` 中的 standalone 产物；发布前先执行上面两条命令。

席定领航使用 `PLATFORM_AI_BASE_URL`、`PLATFORM_AI_API_KEY` 和 `PLATFORM_AI_MODEL` 接入 OpenAI-compatible Chat Completions。未设置 `PLATFORM_AI_*` 时可以复用 `PLATFORM_VLM_*`；密钥只存在 Web 服务端环境，不会进入浏览器。产品边界和任务清单见 [`../docs/planning/ai-module.md`](../docs/planning/ai-module.md)。

## 目录

```text
src/app/dashboard/       页面路由
src/features/booking/    预约控制台业务模块
src/components/          Kiranism UI 和布局组件
src/config/nav-config.ts 侧边栏和命令菜单导航
```

## 后端接入边界

页面数据和动作统一通过 `src/features/booking/api/service.ts` 读取，服务端首屏通过 `server-service.ts` 传入数据，不让页面直接拼接后端逻辑。

生产路由只保留预约平台页面；Kiranism 的表格、表单、Kanban、聊天和示例 API 源码作为可复用 UI 资产保留，但不再作为用户可访问的演示页面或 mock 后端。

现有仓库根目录的 `seat_reserver.py` 仍然是稳定的 Python 抢座 CLI，VPS cron 不由本前端开发服务器替代。生产平台通过 NestJS API、PostgreSQL、Redis/BullMQ 和内置 scheduler/worker 完成用户认证、任务持久化、账号加密、Token 预热和运行日志。

## 设计来源

UI 基于 Kiranism starter 的 Next.js 16、Tailwind CSS 4、shadcn/ui、TanStack Query、TanStack Table、Motion 和 Tabler Icons 体系。学习排行与资料徽章复用 MIT 许可的 Trophy Gamification UI registry 组件，并适配项目 Tabler 图标；许可文本见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。业务文案、导航和页面结构已替换为座位预约场景。
