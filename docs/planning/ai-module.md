# 席定领航 AI 模块

## 定位

席定领航不是一个孤立的通用聊天页，而是席定自习室的智能学习层：把房间、预约、专注记录、排行榜和奖励串成“计划 - 专注 - 复盘”的闭环。

产品机制参考番茄土豆的自习室与专注数据共享、Focusmate 的短时段目标仪式、Study Together 的房间目标与统计、Forest 的可见成长反馈和 Habitica 的任务奖励。实现层优先复用仓库已有的 AI SDK、shadcn/ui、消息滚动组件和席定自习室 API；只有平台特有的上下文拼装与权限边界需要新增代码。

## 方案决策

| 能力 | 复用方案 | 决策 |
|---|---|---|
| 模型调用 | Vercel AI SDK + `@ai-sdk/openai-compatible` | 采用，兼容 OpenAI Chat Completions 和现有兼容协议模型 |
| 消息交互 | AI SDK `useChat`、`DefaultChatTransport` | 采用，替换模板的固定脚本 transport |
| 消息视觉 | 现有 shadcn `Message`、`Bubble`、`Marker`、`MessageScroller` | 采用，不另造聊天 UI |
| AI 上下文 | 平台已脱敏的 dashboard、focus room、rewards 数据 | 采用服务端只读快照，不把密码、Token、Cookie 传给模型 |
| 工作流引擎 | LangGraph / Pi | P0 不引入；当前是短对话和只读建议，没有跨天审批图 |
| AI 云端存储 | assistant-ui cloud 等托管服务 | P0 不引入，避免新增账号、费用和数据出境边界 |

## P0 任务

- [x] 调研同类产品、开源项目和许可证边界。
- [x] 安装并验证 OpenAI-compatible provider。
- [x] 设计“席定领航”页面入口和产品文案。
- [x] 用现有 AI SDK 接入服务端流式对话。
- [x] 给模型提供脱敏的今日预约、运行、奖励和自习室上下文。
- [x] 实现四个快捷场景：开始专注、规划一周、看看节奏、选个位置。
- [x] AI 输出学习计划草稿、空间建议和复盘建议；不直接保存或执行预约任务。
- [x] 没有配置模型时显示明确的未启用状态，不伪装成真实 AI。
- [x] 添加错误、取消、重试、空状态和移动端布局。
- [x] 更新环境变量示例、根文档和部署文档。
- [x] 运行 Web 类型检查、lint、构建，并完成未登录路由冒烟。
- [ ] 使用真实登录会话完成桌面端和移动端视觉回归。

## P1 任务

- [ ] 结构化 `StudyPlanDraft` 卡片，可一键把计划带入任务编辑器，但仍需用户确认。
- [ ] 座位图中的 AI 推荐：按用户偏好、历史成功率、空间设施和时间段排序。
- [ ] 专注开始前目标卡、结束后的三问复盘和席定币奖励说明。
- [ ] 周报：专注时长、预约成功率、爽约/取消、连续天数和下周建议。
- [ ] AI 房间主持人：房间开始、休息、结束时的低打扰提示。

## P2 任务

- [ ] 记忆用户明确保存的偏好，提供删除入口。
- [ ] 多高校规则检索与适配器诊断。
- [ ] 管理员侧模型用量、失败率、延迟和成本观测。
- [ ] 可选的本地模型 provider；默认不把个人学习数据发送到第三方。

## 安全边界

- 模型只接收平台已经脱敏的昵称、场馆名称、任务摘要、运行状态、专注统计和奖励统计。
- 学号、密码、Token、Cookie、HMAC、验证码图片和支付密钥不进入模型上下文。
- P0 所有工具均为只读；创建、编辑、启用、暂停、取消预约必须由用户在原页面明确确认。
- AI 建议必须标注为建议，学校实时规则和预约结果以平台 API 返回为准。
- 服务端保存 provider 密钥；浏览器只能请求同源 `/api/assistant`，不能读取密钥。
- provider 超时、限流或未配置时，页面保留普通自习室和预约功能，不影响现有队列。

## 验收标准

1. 登录用户打开“席定领航”能看到真实的今日摘要和席定自习室状态。
2. 配置兼容协议模型后，快捷场景和自由提问都通过 `/api/assistant` 流式返回。
3. 模型不可用时，页面显示“AI 尚未启用”和配置提示，不显示固定假回复。
4. 对话上下文不包含校园账号密码、业务 Token、Cookie 或验证码内容。
5. AI 不能通过对话直接创建或执行预约任务。
6. 320px、768px、1024px 和桌面宽度下无横向溢出；键盘可操作；错误和重试可见。

## 调研来源

- [番茄土豆](https://www.tomatotodo.com/)
- [Focusmate](https://www.focusmate.com/)
- [Study Together](https://www.studytogether.com/)
- [Forest](https://www.forestapp.cc/)
- [Habitica](https://github.com/HabitRPG/habitica)
- [Super Productivity](https://github.com/super-productivity/super-productivity)
- [assistant-ui](https://github.com/assistant-ui/assistant-ui)
- [CopilotKit](https://github.com/CopilotKit/CopilotKit)
- [Vercel AI SDK OpenAI-compatible provider](https://github.com/vercel/ai/tree/main/packages/openai-compatible)
