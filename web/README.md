# 一考即过预约控制台

基于 [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) 改造的现代化预约控制台。

## 当前状态

当前版本完成了前端工作台第一版：

- 总览：明早执行窗口、任务概览、账号状态和最近运行。
- 预约任务：搜索、启用/暂停、新建任务和演示运行。
- 账号与授权：脱敏账号信息、Token 状态和演示刷新。
- 运行记录：状态筛选、搜索和运行详情。
- 通知中心：预约和授权相关提醒。
- 登录/注册：本地演示入口，后续接入正式认证服务。

页面当前使用本地 mock 数据。点击“立即运行”或“刷新 Token”只改变演示状态，不会调用真实预约接口。

## 开发

要求 Node.js 22+ 和 Bun。

```bash
bun install
bun run dev
```

打开 <http://localhost:3000/dashboard/overview>。

常用检查：

```bash
bun run typecheck
bun run lint
bun run build
```

## 目录

```text
src/app/dashboard/       页面路由
src/features/booking/    预约控制台业务模块
src/components/          Kiranism UI 和布局组件
src/config/nav-config.ts 侧边栏和命令菜单导航
```

## 后端接入边界

页面数据通过 `src/features/booking/api/service.ts` 读取。接入真实后端时，优先替换这个 service 层，不要让页面直接调用接口。

现有仓库根目录的 `seat_reserver.py` 仍然是稳定的 Python 抢座 CLI，VPS cron 不由本前端开发服务器替代。后续后端需要负责用户认证、任务持久化、账号加密和运行日志，再通过 API 或队列调用抢座 worker。

## 设计来源

UI 基于 Kiranism starter 的 Next.js 16、Tailwind CSS 4、shadcn/ui、TanStack Query、TanStack Table、Motion 和 Tabler Icons 体系。业务文案、导航和页面结构已替换为座位预约场景。
