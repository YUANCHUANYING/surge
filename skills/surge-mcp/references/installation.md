# 可信部署

## 前提与边界

- 推荐 Node.js 22，需 Git 和 npm；Surge 已运行，并由用户在自身配置流程中启用带密钥的 HTTP API。不要将含密钥的 Surge 配置提交到仓库。
- 服务来自 [DLYZZT/surge-mcp-server](https://github.com/DLYZZT/surge-mcp-server)，固定已验证提交 `f1106016499da00ab24009e4c9294a9130b1bdf5`。固定版本用于可复现，不代表没有漏洞；运行前自行审查源码、锁文件及依赖风险。
- 本仓库不分发上游源码或依赖，不改变上游自身许可；本技能仍受本仓库 LICENSE 约束，不以第三方 MIT 许可覆盖本仓库内容。
- 不使用 `npx` 自动下载运行、不自动更新、不执行不明安装脚本。下面命令只在用户认可该可信源及风险后手动执行。安装需联网下载源码及锁定依赖；CLI 自身不联网安装。

## 固定版本安装

从本仓库根目录运行，目标目录必须尚不存在；若已有部署先独立检查，不覆盖。`.local/` 已在本仓库忽略列表中，不提交服务、node_modules、审计原始输出或密钥。

```sh
mkdir -p .local
git clone https://github.com/DLYZZT/surge-mcp-server.git .local/surge-mcp-server
git -C .local/surge-mcp-server checkout --detach f1106016499da00ab24009e4c9294a9130b1bdf5
git -C .local/surge-mcp-server rev-parse HEAD
(
  cd .local/surge-mcp-server
  npm ci --ignore-scripts --no-bin-links
  node node_modules/typescript/bin/tsc
  node --input-type=module -e 'import {createRequire} from "node:module"; const r=createRequire(process.cwd()+"/package.json"); for (const p of ["@modelcontextprotocol/sdk/client/index.js","@modelcontextprotocol/sdk/client/stdio.js","ajv"]) r.resolve(p); console.log("SDK/AJV resolution OK");'
)
```

逐条检查退出码，任何失败立即停止；HEAD 必须等于固定提交。`--ignore-scripts` 禁止 npm 生命周期脚本（包含上游 prepare），故随后显式执行已安装 TypeScript 编译器，不使用 npm 自动构建钩子。AJV 由该版本锁文件的依赖树提供；解析失败应检查锁定安装，不临时下载其他版本补齐。

默认服务根由技能脚本位置推导为仓库根 `.local/surge-mcp-server`。复制到其他技能目录后，建议明确设置可信部署绝对路径：

```sh
export SURGE_MCP_ROOT=/absolute/path/to/trusted/surge-mcp-server
# 可选：只有入口确实不在默认 dist/index.js 时设置。
export SURGE_MCP_ENTRY=/absolute/path/to/trusted/surge-mcp-server/dist/index.js
export SURGE_HOST=127.0.0.1
export SURGE_PORT=6171
```

不要把示例占位路径直接执行为实际部署；保留默认入口时不设置 `SURGE_MCP_ENTRY`。

## 密钥与只读验证

使用宿主的安全环境变量管理器提供 `SURGE_API_KEY`；也可在支持 `read -s` 的交互 shell 安全输入后 export，不将明文写进命令历史、.env、JSON、仓库或聊天。只检测存在性，不打印值：

```sh
[ -n "$SURGE_API_KEY" ] && echo 'SURGE_API_KEY=set' || echo 'SURGE_API_KEY=not set'
node skills/surge-mcp/scripts/self-test.mjs
node skills/surge-mcp/scripts/surge.mjs tools
node skills/surge-mcp/scripts/surge.mjs status
```

最后两条会启动真实 MCP stdio 服务；`status` 仅读取模式与四个功能开关。输出只供当前本地核验，不提交任何个人状态或测试结果文件。上游使用明文 HTTP，不自行对公网开放；设备管理仅限 Mac，且所有写入需要具体用户授权。完整限制见 [测试与风险](verification.md)。
