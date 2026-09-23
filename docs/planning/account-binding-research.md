# 账号绑定自动化研究

目标：确认新用户能否使用学校身份完成座位系统首次绑定，并拿到后续可在对应认证模式下验证和预约的业务 token。

截至 2026-09-04，自习室公网直连和 WebVPN/SSO 两条路线都在 VPS 完成过真实预约验证；平台按账号保存实际成功模式，图书馆固定使用 WebVPN/SSO。新账号自动探测，用户端只填写学号和密码。

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

平台现已把校园凭据与预约服务连接拆开：同一个校园账号下，`study_room/cczukaoyan` 与 `library/cczu` 分别保存加密业务 Token、认证模式和验证时间，避免跨服务误用凭证。图书馆只读目录、空间布局、座位状态和可选时间已接通；`/rest/v2/settings` 当前返回 `isCaptchaOpen=true`。2026-09-04 的生产探测进一步确认 `/cap/captcha/<业务Token>` 能返回挑战底图、文字提示图、点击数量和挑战 Token，空 `authid` 的真实预约会被学校明确拒绝为“验证码错误”。图书馆预约必须先完成官方页面同款的人工点选校验，再将已验证的挑战 Token 作为 `authid` 提交，不能沿用自习室空 `authid` 的完全无人值守流程。

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

需要更深的协议结构分析时，优先使用官方 Reqable MCP 或 mitmproxy addon。已有绑定账号不需要为了每日预约重复抓包；只有要自动化“首次激活码绑定”时，才需要单独分析该一次性流程。

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

1. 平台和脚本都使用 `/cczukaoyan/rest/auth` 处理 direct 自习室账号；另有自习室 WebVPN/SSO 账号路线，二者都已在 VPS 真实预约验证。图书馆单独使用 WebVPN 路线。
2. webvpn 模式使用校园账号密码完成网关登录和校园 SSO；direct 模式不需要 SwordAgent、Windows VM、TUN 或修改 VPS 路由。
3. 图书馆目标需要经 WebVPN 访问；其代理入口和签名种子由 CAS 最终回跳动态提取，不硬编码代理哈希或签名种子。自习室直连不经过该代理。
4. WebVPN Cookie、代理上下文和签名上下文以加密快照保存到服务连接；内存会话只作为运行时缓存，API 重启后先尝试恢复未过期快照。
5. 05:59:50 预热会按账号保存的模式恢复或刷新认证：direct 刷新公网 Token，webvpn 恢复或重建 WebVPN 会话；学校主动注销、会话过期或网络不可达时仍需要重新认证。
6. 2026-09-03 生产测试账号通过该路线在第一次尝试成功预约 5 号楼智能自习室 148 号，学校接口返回 HTTP 200、业务码 `0` 和真实回执。

## 南京工业大学图书馆接入研究（2026-09-21）

### 官方入口与空间范围

南京工业大学图书馆官网的“空间预约”页面明确写明：座位或空间预约通过“南京工业大学图书馆”微信公众号进入。目前公开列出的空间分为三类：阅览座位、朗读亭、面试亭。官网同时公开了“我的图书馆” WebVPN 入口，入口域名为 `vpnlib.njtech.edu.cn`，但这只能证明学校存在图书馆 WebVPN 入口，不能据此推断空间预约接口与常州大学图书馆使用同一套协议。

官网 2026 年 9 月更新的“本馆简介”写明，南京工业大学图书馆目前由“逸夫图书馆”和“浦江图书馆”组成；其中逸夫图书馆于 2006 年在江浦校区落成。因此，江浦校区的逸夫馆属于本次南工大图书馆接入范围。这里的“浦江图书馆”不能与独立站点 `lib.njpji.edu.cn` 的“南京工业大学浦江学院图书馆”混同，后者应视为另一所学校/租户的预约系统。

官方规则页当前更新时间为 2026-03-25，规则页地址为 `https://lib.njtech.edu.cn/info/1016/3534.htm`。

### 已核实规则

| 空间 | 开放/预约窗口 | 预约对象 | 签到与释放 |
|---|---|---|---|
| 阅览座位，正常开馆 | 8:00-22:00；7:00-8:00 可预选当日座位 | 当天 | 预选后 8:30 前到馆；开馆后实时选座需在 30 分钟内签到 |
| 阅览座位，考研季 | 7:30-22:00；7:00-7:30 可预选当日座位 | 当天 | 预选后 8:30 前到馆；开馆后实时选座需在 30 分钟内签到 |
| 朗读亭 | 08:00-12:59、13:00-17:59、18:00-22:00；每个时段前 30 分钟可预选 | 当天单独预约时段 | 预约后 30 分钟内签到；离馆会暂保 30 分钟，午餐/晚餐规则以官方页为准 |
| 面试亭 | 每天 08:00-22:00，按场地和时段预约 | 具体时段 | 通过“e 面试”微信小程序预约，成功后获取电子锁密码；不属于阅览座位接口 |

普通座位暂离默认保留 30 分钟，11:00-13:00 和 17:00-19:00 保留 90 分钟；未按时返回或离馆不退座会记违规。15 日内累计 3 次违规会被列入黑名单 7 日。官方规则只写明“预选当日座位”，当前没有公开证据支持预约次日或连续周期预约。

### 接入判断

- 南京工业大学不能复用当前 `cczu` 图书馆 WebVPN/`freeBook` 适配器；它使用自己的 WebVPN/OAuth/CAS 会话和 GraphQL 座位服务。
- 已建立独立 `njtech` 学校适配器，第一阶段覆盖“阅览座位当天抢座”，并映射逸夫图书馆、浦江图书馆两组空间。任务触发时间默认为 07:00。
- “朗读亭”和“面试亭”另建服务类型。面试亭需要处理“e 面试”小程序和电子锁密码，不能先混入座位图任务。
- HAR 已确认登录、目录、座位图、预约 mutation 和取消 mutation。2026-09-23 已在生产环境用真实账号完成一次南工大预约与取消：预约 mutation 返回成功后，平台回读首页记录取得学校真实预约 ID、实际时段和座位，再使用短时 `getSToken` 完成取消；测试结束后没有残留可取消预约。

### 待补证据

1. 7:00 预选窗口与考研季窗口是否由服务端动态返回，当前适配器以规则页和 GraphQL 目录为准。
2. 预约、取消、暂离、退座和个人记录的更多状态字段；尤其是“自动签到”是否由门禁刷卡/扫码完成，平台不能凭预约成功自行伪造签到。
3. 逸夫图书馆与浦江图书馆是否存在不同的 GraphQL 规则参数，目前两馆已在同一 `list` 响应的官方分组中出现。

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
