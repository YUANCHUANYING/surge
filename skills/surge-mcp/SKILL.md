---
name: surge-mcp
description: 通过真实 MCP stdio 安全调用本机 Surge，查询和排障节点策略、分流模式、模块、抓包、MITM、Rewrite、脚本及连接。用户提及 Surge/MCP、切换节点、分流异常、模块启停、财新去广告排障时使用；默认只读，任何写操作必须先获得用户对应授权。
---

# Surge MCP

## 使用入口

先阅读 [可信部署](references/installation.md)，准备固定版本的本地服务。以下命令从本仓库根目录运行；移植至其他技能宿主时相应调整脚本路径。不下载执行未知代码，不自动升级依赖：

```sh
node skills/surge-mcp/scripts/surge.mjs tools
node skills/surge-mcp/scripts/surge.mjs status
node skills/surge-mcp/scripts/surge.mjs call surge_get_outbound_mode --args '{}'
node skills/surge-mcp/scripts/surge.mjs call surge_get_feature_status --args '{"feature":"capture"}'
node skills/surge-mcp/scripts/surge.mjs call surge_list_modules --args '{}'
node skills/surge-mcp/scripts/self-test.mjs
```

- 推荐 Node 22。默认服务目录是仓库根 `.local/surge-mcp-server`（由脚本位置定位，与当前工作目录无关），入口 `dist/index.js`；CLI 从该服务目录解析 MCP SDK 和 AJV，真正进行 initialize、tools/list、tools/call。
- 使用 `SURGE_MCP_ROOT` 覆盖部署目录，`SURGE_MCP_ENTRY` 覆盖入口，均须为可信本机绝对路径。入口缺失或 SDK/AJV 不可用时停止并建议重建可信部署，不从网络自动拉取执行。
- 后端参数 `SURGE_HOST` 默认 `127.0.0.1`、`SURGE_PORT` 默认 `6171`、`SURGE_API_KEY` 必填；不加载 .env。通过宿主环境变量管理器或安全交互输入设置密钥，不打印、不复制进参数、不保存至仓库文件或聊天。
- 只将 Surge 参数和必要系统环境传给子进程；SDK 另合并 HOME/PATH/USER 等标准系统变量，不传递其他 API keys、NODE_OPTIONS 或代理环境。
- 默认整个 MCP 阶段限时 15 秒，可设 `--timeout-ms 1000..60000`；不是每个 status 子调用各享 15 秒。完成即关闭客户端和子进程，不常驻、不改宿主配置、不声称原生 MCP 注册。
- 当前上游使用明文 HTTP；非回环主机只有在可信安全网络且用户明确指定时使用，不能自行扫描主机。CLI 暂不接受 IPv6 主机字面量。

## 安全调用规则

1. 先 `tools`/`status`，读取对应状态，再规划修改。全 19 工具分类和参数见 [工具参考](references/tools.md)。未知工具一律不可调用；本地严格校验对象/必填/类型/枚举/额外字段，再按发现的 JSON Schema 用 AJV 校验。
2. 默认只允许 9 项只读工具。10 项有副作用或高风险工具必须加 `--allow-write`。**该开关不是用户确认**：仅当用户明确请求该项具体修改，或 `user_ask` 明确批准目标、参数及影响，才可加。没有 `user_ask` 时用普通对话取得批准，不假造工具或确认。泛泛“排障/优化/测试”不构成授权；同值写入也必须授权。
3. `surge_evaluate_script` 即使标注 mock/模拟也视为高风险写；`surge_test_policy` 会产生网络探测，同样需要明确授权。不得在自测中向真实 Surge 发送写调用。
4. 超时、取消、写工具报错或空响应解析失败，均可能已产生副作用。**不自动重试，不宣称未修改或已回滚**。先读后检查或让用户在 Surge 中核对，再决定恢复；终止 MCP 子进程无法撤销 Surge 已接收的请求。
5. 结果采用强制白名单摘要：模式、开关、可识别数组数量；动态名称、设备标识、请求 URL（包含 query/userinfo）、headers/cookies/token/password/API key、订阅、配置内容均不输出。`get_profile` 仅说明收到结果，绝不全量返回。工具发现只显示本地安全参数定义，不回显服务器描述。没有 raw 输出或原始结果保存选项；不要为绕过摘要改用 curl、调试日志或原测试客户端。
6. 摘要不支持识别具体节点、模块名、请求 ID 或配置差异；需要这些值时请用户在 Surge UI 中确认最小非敏感目标，勿声称完整内容已检查。`--args-file` 只读既有 JSON 文件，不能在文件或命令行中放秘密，CLI 不创建参数文件或结果文件。

## 经授权的写入示例

下列命令**只有获得对应授权后**才能执行，不把示例当作授权：

```sh
# 用户明确要求切换到规则模式；先记录原模式，之后再次读取核验。
node skills/surge-mcp/scripts/surge.mjs call surge_set_outbound_mode --args '{"mode":"rule"}' --allow-write
# 仅当用户明确要求关闭抓包。
node skills/surge-mcp/scripts/surge.mjs call surge_toggle_feature --args '{"feature":"capture","enabled":false}' --allow-write
# 复杂但不含秘密的参数可从现有文件读取；工具名按实际需要替换。
node skills/surge-mcp/scripts/surge.mjs call surge_get_feature_status --args-file /absolute/path/nonsecret-args.json
```

模块使用 `module_name`，策略组使用 `group_name` 和 `policy`，须由用户确认准确名称。不接受含 `/ ? # % \\ & =` 的组名/模块名/请求 ID，因当前上游直接拼接 URL；遇到此类目标停止，不尝试绕过。

## 备份与回滚

- 修改前只记录必要的非敏感基线：mode、feature 开关；涉及模块/策略/设备时让用户在 UI 确认原值。配置修改前由用户在 Surge UI 导出/备份至其安全位置；本技能不将配置/订阅/密钥落盘。
- 明确变更范围和恢复计划后一次只改一项。成功后用对应只读工具/UI 核验；`ok:true`/`verificationRequired:true` 仅表示工具应答，不代替状态核验。
- 回滚也是写入：只有原授权明确涵盖恢复原值，或另行批准后才能执行。请求终止、DNS 清理、脚本执行、配置重载可能无法回滚；先说明影响，失败时勿反复调用。
- `get_profile`/`reload_profile` 不代表任意配置文本编辑。本 MCP 没有通用配置编辑工具；如需编辑配置，用 Surge 自身配置流程另行授权、备份、验证，不能伪造 MCP 能力。

## 财新去广告排障（先只读）

1. 读 mode、rewrite/scripting/mitm/capture 状态；读模块是否可访问。查询状态不等于证明规则命中。
2. 请用户在 Surge UI 核对去广告模块启用、目标域名和规则命中、Rewrite/脚本日志、证书信任及应用版本；只索取脱敏现象，不导出请求头、cookie、订阅或完整配置。
3. 区分 DNS/路由、规则未匹配、脚本失效与证书问题。若确需短时抓包，先明确授权和数据范围，结束后在授权范围内恢复原开关。
4. 不盲目开关 MITM、Rewrite、脚本或模块，不自行安装证书、增加 hostname 或重载配置。无证据时报告待核验项，不保证去广告一定有效。

## 平台与现有限制

`surge_list_devices`/`surge_modify_device` 为 **Mac-only，需 Surge 4.0.6+**；iOS 不以调用失败推断所有连接异常，不尝试设备写入。其余 API 是否可用仍取决于 Surge 平台、版本、授权与配置。

上游既有 audit 风险记录含 8 项运行时依赖漏洞（2 moderate、5 high、1 critical），未修复、未升级，非实时审计结论；stdio 不等于漏洞全部可远程触发，也不等于安全沙箱。CLI 是受信代理的安全门禁，无法防止本机用户绕过、恶意服务端或既有依赖缺陷；不得向不可信客户端开放此上游服务。详见 [测试与风险](references/verification.md)。本技能遵循仓库 [使用许可](../../LICENSE)，不引入 MIT 授权覆盖仓库条款。
