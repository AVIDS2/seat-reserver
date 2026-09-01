# 账号绑定自动化研究

目标：确认新用户能否使用学校身份完成“一考即过”自习室模式的首次绑定，并拿到后续 `/cczukaoyan/rest/v2/user` 可验证的 token。

截至 2026-09-01，已经真实验证的是：已配置账号可在公网 VPS 上调用 `/cczukaoyan/rest/auth` 刷新 token，并继续完成预约。尚未验证的是：全新账号如何从学校 SSO、验证码或激活流程换取 `/cczukaoyan/rest/auth` 实际接受的凭据。平台当前把用户输入的学校密码直接传给该接口，这只是兼容已有账号的实现，不能视为新账号首次绑定已经闭环。

## 边界

- 只研究登录、绑定、token、用户校验。
- 禁止调用 `/freeBook`，不做真实预约。
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

待抓包确认的新账号首次接入链路：

```text
学校统一身份认证 / SSO
→ 可能的短信或图形验证码
→ 选择学校与自习室系统
→ 可能的激活码绑定
→ 生成或换取一考即过内部凭据 / token
→ `GET /cczukaoyan/rest/v2/user` 验证
```

不要把校园统一身份认证密码默认等同于 `/cczukaoyan/rest/auth` 的 `password`。必须以一次完整、脱敏的首次登录抓包为准。

MVP 只研究并实现 `self_study` 自习室模式。图书馆模式先不做，但数据模型后续应保留 `service_type`。

## 工具

### 推荐自动化路径

Reqable 官方支持 Report Server、Python capture script、HAR 和 MCP。当前推荐使用 Report Server：Reqable 把会话以 HAR POST 到本地接收器，接收器自动转换、脱敏并保存，后续所有账号使用同一套分析规则，不需要重复人工整理请求。

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

需要更深的协议结构分析时，优先使用官方 Reqable MCP 或 mitmproxy addon；本项目不引入 SSL pinning 绕过、验证码绕过、签名伪造或风控绕过脚本。

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

## 需要确认的问题

1. `/cczukaoyan/rest/auth` 的 `password` 来源是什么：
   - 接口响应返回；
   - 前端 JavaScript 生成；
   - 客户端缓存携带；
   - 其他链路。
2. 激活码绑定后是否可以直接拿到可用 token。
3. 网页系统和小程序自习室接口的 token 是否完全互通。
4. 用户后续是否只需保存加密后的学校账号密码，还是必须保存一考即过 auth password。
5. 学校 SSO 首次登录是否只能从校园网或 WEBVPN 访问；如果是，能否只把首次凭据换取放到校内网络，后续 token 刷新和预约继续留在公网 VPS。

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
