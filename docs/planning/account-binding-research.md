# 账号绑定自动化研究

目标：确认新用户能否使用学校身份完成座位系统首次绑定，并拿到后续可在对应认证模式下验证和预约的业务 token。

截至 2026-09-03，自习室公网直连路线已在 VPS 完成真实预约验证；WebVPN 仅作为历史兼容和图书馆路线。平台自习室新增、修改、刷新和预约前刷新均使用 `cczukaoyan/rest/auth` 获取直连 Token，图书馆连接才通过 WebVPN 和校园 SSO；用户端只填写学号和密码。

## 边界

- 只研究登录、绑定、token、用户校验和请求结构。
- 日常抓包分析不主动调用 `/freeBook`；真实预约只在用户明确授权的测试任务中执行。
- 不修改 `seat_reserver.py`。
- 捕获文件只保存在本地 `tools/binding_discovery/captures/`，该目录已被 `.gitignore` 忽略。
- 捕获结果会脱敏 password、token、cookie、authorization 等字段。

## 已验证与待验证链路

已验证的老账号运行链路：

```text
已配置的一考即过登录凭据
→ `GET /cczukaoyan/rest/auth`
→ `GET /cczukaoyan/rest/v2/user` 验证 token
→ 加密保存凭据和 token
→ 每日预热/预约自动复用或刷新 token
```

2026-09-02 的生产验证确认：平台账号 1 通过脚本账号密码获得 `direct` token，并通过 `/rest/v2/user` 校验；真实 `freeBook` 请求收到 HTTP 200、业务码 `1`、“已有1个有效预约，请在使用结束后再次进行选择”。该业务响应说明请求已到达预约接口；它不是交互式验证码失败，也没有产生新的预约回执，因为账号当时已有有效预约。

图书馆（以及历史 WebVPN 兼容链路）接入流程：

```text
学校 WebVPN 网关动态 AES 登录
→ 通过门户入口触发校园 SSO
→ CAS 回跳到学校座位服务并由 WebVPN 动态生成代理入口
→ 座位系统生成短期 SSO 授权票据
→ `/rest/ssoAuth` 换取业务 token
→ 经 WebVPN 代理调用 `/rest/v2/user` 验证
→ 使用七字段 `multipart/form-data` 调用 `/rest/v2/freeBook`
```

不要把校园统一身份认证密码默认等同于 `/cczukaoyan/rest/auth` 的 `password`。webvpn 模式的业务 Token 只能在 `202.195.100.14` 对应的 WebVPN 代理入口使用；实测将它交给 `leosys.cn/cczukaoyan` 的 PC 或 APPLET 请求都会返回业务码 `12`。

平台现已把校园凭据与预约服务连接拆开：同一个校园账号下，`study_room/cczukaoyan` 与 `library/cczu` 分别保存加密业务 Token、认证模式和验证时间，避免跨服务误用凭证。图书馆只读目录、空间布局、座位状态和可选时间已接通；`/rest/v2/settings` 当前返回 `isCaptchaOpen=true`，因此预约提交必须先完成人工验证码验证，不能沿用自习室的完全无人值守承诺。

图书馆协议覆盖参考了校友项目 [CCZU-OSSA/CCZU-Lib-Book](https://github.com/CCZU-OSSA/CCZU-Lib-Book) 的公开接口清单与归一化思路。该仓库使用 AGPL-3.0；本项目本次实现没有复制其源码或引入其运行时，避免在当前仓库许可证未统一前形成代码级衍生依赖。

## 工具

### 推荐自动化路径

Reqable 官方支持 Report Server、Python capture script、HAR 和 MCP。当前推荐使用 Report Server：Reqable 把会话以 HAR POST 到本地接收器，接收器自动转换、脱敏并保存，后续所有账号使用同一套分析规则，不需要重复人工整理请求。

GitHub 上的 [CCZU-OSSA/cczu-vpn-proto](https://github.com/CCZU-OSSA/cczu-vpn-proto) 提供常州大学 WebVPN 的 Linux TUN 客户端，可作为代理规则变化时的备用方案。当前平台不引入常驻隧道：座位系统的 WebVPN HTTPS 代理已经能覆盖认证和业务请求，直接使用网关可以减少 TUN 路由、`CAP_NET_ADMIN` 和额外资源占用。

Reqable 官方内置 MCP 要求 Reqable 3.2.0 或更高版本。MCP 可以直接筛选和读取实时抓包记录，但不能代替用户完成学校验证码、校园统一身份认证或其他需要本人交互的步骤。

启动接收器：

```powershell
python tools/binding_discovery/reqable_report_server.py --bind 0.0.0.0 --port 8788 --path /reqable/report
```

在 Reqable 的 Report Server 中填写：

```text
http://<本机局域网地址>:8788/reqable/report
```

只完成“完全退出或清理会话后，学校登录/验证码、选择学校或系统、可能的激活码绑定，直到进入座位列表”，不点击预约提交。接收器会自动屏蔽敏感字段；如报告中出现 `freeBook`，分析器会把它标为不适合作为绑定捕获结果。

需要更深的协议结构分析时，优先使用官方 Reqable MCP 或 mitmproxy addon；本项目不引入 SSL pinning 绕过、验证码绕过、签名伪造或风控绕过脚本。已有绑定账号不需要为了每日预约重复抓包；只有要自动化“首次激活码绑定”时，才需要单独分析该一次性流程。

### 安装依赖

```powershell
python -m pip install playwright
python -m playwright install chromium
```

### 捕获网页登录/绑定流程

```powershell
python tools/binding_discovery/capture_web.py
```

脚本会打开浏览器。你只需要完成正常登录、选择学校/系统、激活码绑定、进入用户页这类动作。不要点击预约提交。脚本会阻断 `/freeBook` 请求。

完成后回到终端按 Enter，捕获文件会保存到：

```text
tools/binding_discovery/captures/capture-YYYYMMDD-HHMMSS.json
```

### 分析捕获文件

```powershell
python tools/binding_discovery/analyze_capture.py tools/binding_discovery/captures/<文件名>.json
```

分析重点：

- 是否出现 `/rest/ssoAuth`
- 是否出现 `actCodeBind`
- 是否出现 `/cczukaoyan/rest/auth`
- 是否出现 `/cczukaoyan/rest/v2/user`
- 是否误触发 `/freeBook`

## 已确认结论

1. 平台和脚本都使用 `/cczukaoyan/rest/auth` 处理自习室；现有一考即过凭据在 VPS 上已验证 direct 刷新和预约请求。图书馆单独使用 WebVPN 路线。
2. webvpn 模式使用校园账号密码完成网关登录和校园 SSO；图书馆依赖这条路线，自习室不需要 SwordAgent、Windows VM、TUN 或修改 VPS 路由。
3. 图书馆目标需要经 WebVPN 访问；其代理入口和签名种子由 CAS 最终回跳动态提取，不硬编码代理哈希或签名种子。自习室直连不经过该代理。
4. WebVPN Cookie、代理上下文和签名上下文以加密快照保存到服务连接；内存会话只作为运行时缓存，API 重启后先尝试恢复未过期快照。
5. 05:59:50 预热会按服务恢复或刷新认证：自习室刷新直连 Token，图书馆恢复或重建 WebVPN 会话；学校主动注销、会话过期或网络不可达时仍需要重新认证。
6. 2026-09-03 生产测试账号通过该路线在第一次尝试成功预约 5 号楼智能自习室 148 号，学校接口返回 HTTP 200、业务码 `0` 和真实回执。

## 后续实现目标

如果研究确认能自动化，后端实现：

```text
AccountBinder.bind(
  school_username,
  school_password,
  seat_activation_code,
  service_type="self_study"
) -> {
  auth_username,
  auth_password,
  token,
  user_info
}
```

绑定成功后，平台只保存加密后的必要凭据和 token，不保存任何明文密码。
