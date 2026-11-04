# 19 项工具目录

以下均为 `surge_` 前缀的完整名称；`!` 表示必填。`tools` 会实时发现 MCP 工具，但仅允许本地固定目录中的工具。服务端参数还会按其 inputSchema 经 AJV 校验。字符串非空、最长 4096 字符、不含控制字符；不接受额外字段。

| 完整工具名 | 分类 | 参数与用途 |
|---|---|---|
| surge_get_feature_status | 只读 | feature!：mitm/capture/rewrite/scripting；返回安全开关 |
| surge_get_outbound_mode | 只读 | 无；返回 direct/proxy/rule |
| surge_list_policies | 只读 | 无；策略数量摘要，不暴露节点内容 |
| surge_get_policy_group | 只读 | group_name!：字符串；结果仅摘要 |
| surge_list_requests | 只读敏感 | type：recent/active，默认 recent；不输出 URL/请求 ID/headers |
| surge_get_profile | 只读高度敏感 | 无；仅说明收到结果，配置/订阅内容隐藏 |
| surge_list_modules | 只读 | 无；可识别结构时提供数量/启用数量，不输出名称及配置 |
| surge_list_scripts | 只读敏感 | 无；数量摘要，不输出源码/URL/名称 |
| surge_list_devices | 只读敏感、Mac-only | 无；不输出设备身份/IP/MAC |
| surge_toggle_feature | 写、高风险 | feature!、enabled!：布尔值；MITM/抓包/Rewrite/脚本开关 |
| surge_set_outbound_mode | 写 | mode!：direct/proxy/rule |
| surge_test_policy | 网络探测，按写门禁 | url!：仅 http/https，不接受 userinfo/query/hash；须批准目标 |
| surge_set_policy_group | 写 | group_name!、policy!：字符串；改变策略选择 |
| surge_kill_request | 写、不可恢复原连接 | request_id!：字符串 |
| surge_reload_profile | 写、高风险 | 无；重载当前配置，不是任意编辑配置 |
| surge_flush_dns | 写、不可恢复缓存 | 无 |
| surge_toggle_module | 写、高风险 | module_name!：字符串、enabled!：布尔值 |
| surge_evaluate_script | 写、高风险，即使 mock | script_name!；type!：http-request/http-response/cron/event/rule/dns；timeout：数字，0 < 值 <= 20 秒，默认 5 |
| surge_modify_device | 写、Mac-only | physical_address!：冒号分隔 MAC；可选 name、address：有效 IP、should_handled_by_surge：布尔值；至少一个修改项 |

共 9 项只读、10 项受写门禁约束。Mac-only 需 Surge 4.0.6+；不在 iOS 上测试设备修改。状态聚合仅依次读取模式和四个 feature，不写入、不读取完整配置。

## 通用命令

从仓库根目录运行：

```sh
node skills/surge-mcp/scripts/surge.mjs call TOOL --args '{"key":"value"}'
node skills/surge-mcp/scripts/surge.mjs call TOOL --args-file /absolute/path/nonsecret.json
```

两种参数源互斥；默认 `{}`。参数源最多 64 KiB（文件读取后检查），不要用巨大文件。明确授权后才可为写工具增加 `--allow-write`；技术标志不能证明授权。无自动重试、无后台常驻、无原始结果输出。

## 错误处理

- `INVALID_*` / `MISSING_ARGUMENT` / `UNKNOWN_ARGUMENT` / `UNSAFE_PATH_ARGUMENT`：本地参数校验失败，未启动服务。
- `WRITE_REQUIRES_ALLOW_WRITE`：本地拒绝，未启动服务。没有用户授权时停在此处，不自动补标志。
- `MISSING_SURGE_API_KEY`：设置凭据后再运行，不索取聊天明文。
- `DEPLOYMENT_MISSING_REBUILD_REQUIRED` / `SDK_OR_AJV_MISSING_REBUILD_REQUIRED`：检查本地绝对路径；经用户批准后按 [可信部署](installation.md) 重建，不自动安装或修复依赖。
- `SERVER_TOOL_MISSING` / `SERVER_SCHEMA_REJECTED`：服务目录或 schema 与预期不符；停止，不猜参数、不绕过校验。
- `DEADLINE_EXCEEDED` / `TOOL_FAILED` / `MCP_OR_LOCAL_FAILURE`：不输出原始异常；写入发送后 `writeMayHaveApplied:true`，必须读取状态/UI 核验，不盲目重试。即使 JSON 空响应解析失败也可能已写入。
