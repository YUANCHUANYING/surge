# Surge 自用规则集

> **仅个人使用，未经允许禁止转载。**

## 模块

| 模块 | 说明 |
|---|---|
| `caixin-adblock.sgmodule` | 财新 App 去广告 |

**安装地址**

```
https://raw.githubusercontent.com/YUANCHUANYING/surge/main/caixin-adblock.sgmodule
```

启用模块并确认 MITM 已开启即可，脚本自动远程加载。首次使用建议卸载重装财新 App 清除广告缓存。

## Skill / MCP

- [Surge MCP Skill](skills/surge-mcp/SKILL.md)：真实 MCP stdio 调用，覆盖 19 项工具；默认只读，写入需具体授权并显式启用门禁，结果仅输出隐私摘要。
- [可信部署](skills/surge-mcp/references/installation.md)：固定上游版本、本地安装与环境变量配置；[验证及风险](skills/surge-mcp/references/verification.md)。

需自行准备 Node.js、可信服务部署及 Surge HTTP API 密钥。无自动下载执行、无通用配置编辑、无原始响应导出；设备管理仅限 Mac。依赖存在已知审计风险，CLI 并非沙箱；不要提交密钥、配置、个人测试快照或向不可信客户端开放服务。新增 Skill 同样仅限个人自用、学习研究，未经允许禁止转载，不另行引入 MIT 授权。

详细条款见 [LICENSE](LICENSE)。
