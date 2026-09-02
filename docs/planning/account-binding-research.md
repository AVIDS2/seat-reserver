# 账号绑定自动化研究

目标：确认新用户能否使用学校身份完成座位系统首次绑定，并拿到后续可在对应认证模式下验证和预约的业务 token。

截至 2026-09-02，两条认证链路均已真实验证：已有账号可在公网 VPS 上调用 `/cczukaoyan/rest/auth` 刷新 token；新账号可通过 `zmvpn.cczu.edu.cn → 常大 CAS → 图书馆座位预约 → /rest/ssoAuth` 获取业务 token，并在 WebVPN 代理内调用 `/rest/v2/user` 验证。平台会先尝试 direct，凭据不被接受时自动切换为 webvpn，并持久化认证模式。

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

新账号首次接入链路：

```text
学校 WebVPN / CAS 统一身份认证
→ 门户动态返回“图书馆座位预约”代理地址
→ 座位系统 CAS 回跳生成 30 秒临时 JWT
→ `/rest/ssoAuth` 换取业务 token
→ 经 WebVPN 代理调用 `/rest/v2/user` 验证
```

不要把校园统一身份认证密码默认等同于 `/cczukaoyan/rest/auth` 的 `password`。webvpn 模式的业务 token 也只能在 WebVPN 代理内使用，不能交给 cczukaoyan 公网租户验证。

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

## 已确认结论

1. direct 模式继续使用 `/cczukaoyan/rest/auth`，适配现有一考即过凭据。
2. webvpn 模式使用校园账号密码完成 CAS，不需要 SwordAgent、Windows VM 或校园网出口。
3. WebVPN 门户动态返回代理地址和座位系统配置；不硬编码代理哈希或签名种子。
4. WebVPN Cookie 只保存在单次进程内存会话中；数据库只加密保存学校密码、业务 token 和认证模式。
5. 05:59:50 预热会重建 WebVPN 会话，06:00 预约复用该会话；API 重启后会自动重新登录恢复。

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
