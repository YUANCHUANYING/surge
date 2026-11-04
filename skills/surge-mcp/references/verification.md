# 验证方法、覆盖范围与已知风险

本文仅描述可复现方法和边界，不发布任何个人模式、功能开关值、设备信息、运行时间或本机状态快照。

## 离线验证

从仓库根目录运行（无需密钥、Surge 或上游部署）：

```sh
node --check skills/surge-mcp/scripts/surge.mjs
node --check skills/surge-mcp/scripts/self-test.mjs
node skills/surge-mcp/scripts/self-test.mjs
git diff --check
```

`self-test.mjs` 覆盖 10 项：未授权写入、非法枚举、错误布尔类型、额外字段、缺失必填字段、未知工具、脚本 evaluate 写门禁、策略探测写门禁、URL 路径注入、非法 JSON。预期 `passed=10`、`total=10`、`realWriteCalls=0`。测试子进程无凭据、使用不存在的部署路径；所有用例应在 preflight 拒绝，验证不启动 MCP、不发送调用。错误类型的写参数即使带 `--allow-write` 也必须被本地拒绝。

这些测试不是完整安全证明，不覆盖所有输入、恶意服务端或实际网络。`realWriteCalls=0` 表示测试设计及前置拒绝结果，不是 Surge 服务端审计。

## 真实只读核验（可选）

按 [可信部署](installation.md) 安装并设置环境后，可运行 `tools` 验证真实 initialize/tools/list，预期固定目录 19 项（9 只读、10 写门禁）；运行 `status` 核验模式及四个开关聚合读取。按需另行读取 `surge_list_modules` 和 `surge_get_profile`，只检查摘要结构、不得输出或保存原始响应。

不把个人输出提交为报告，不因读成功声称写工具全部验证。自测不向真实 Surge 发送任何写入，也不以历史写入结果代表新授权。

超时可用独立本地 Node 夹具验证：仅等待 initialize、不执行 HTTP，指定 `SURGE_MCP_ENTRY`，设置 `--timeout-ms 1000`，预期单条 `DEADLINE_EXCEEDED`、退出码 1、`writeMayHaveApplied=false`；检查子进程清理并删除夹具。该步骤不是内置 self-test 的覆盖项，不把方法描述当成已自动通过的断言。

## 审计和边界

上游固定提交的既有 audit 风险记录包含运行时依赖 8 项漏洞（2 moderate、5 high、1 critical）；其中直接依赖 MCP SDK 为 high、间接 proxy-addr 为 critical。这是历史风险提示，非当前实时审计结果；本发布不运行自动修复、不升级锁文件、不附带可能含本机路径的原始审计 JSON。需要独立在隔离环境评估新审计及升级回归；stdio 模式不能消除依赖风险，也不能直接断言所有漏洞可远程利用。

上游没有 HTTP 请求超时，且成功响应一律按 JSON 解析：写请求即使已生效也可能因空响应报错。CLI 的总超时/子进程终止仅限制客户端等待，不能撤销服务端执行；写失败一律读后核验，不盲目重试。

摘要策略故意不展示任意字符串、动态键或配置结构；因此节点名、模块名、请求 ID、原始配置差异必须由用户在 Surge UI 确认。未覆盖全部只读工具、Mac-only 能力、所有 Surge 版本、真实写入、自动回滚或恶意服务端。没有保存原始结果选项，也没有任意配置编辑功能。

安全 CLI 不是沙箱，无法阻止本机用户直接运行上游。部署路径必须可信，不向不可信客户端暴露上游工具。每次调用短生命周期启动/关闭服务，不原生注册、不常驻、不修改宿主设置。
