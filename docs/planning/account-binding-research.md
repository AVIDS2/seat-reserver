# 账号绑定自动化研究

目标：验证用户只输入学校账号、学校密码、座位系统激活码后，平台能否自动完成“一考即过”自习室模式绑定，并拿到后续 `/cczukaoyan/rest/auth` 可刷新的凭据或 token。

## 边界

- 只研究登录、绑定、token、用户校验。
- 禁止调用 `/freeBook`，不做真实预约。
- 不修改 `seat_reserver.py`。
- 捕获文件只保存在本地 `tools/binding_discovery/captures/`，该目录已被 `.gitignore` 忽略。
- 捕获结果会脱敏 password、token、cookie、authorization 等字段。

## 当前假设

当前系统不是单独注册，而是：

```text
学校统一身份认证 / SSO
→ 选择自习室或图书馆模式
→ 学校/系统识别
→ 激活码绑定
→ leosys 子系统 token
→ 一考即过自习室接口
```

MVP 只研究并实现 `self_study` 自习室模式。图书馆模式先不做，但数据模型后续应保留 `service_type`。

## 工具

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
