# Surge 自用规则集

> **仅个人使用，未经允许禁止转载。**

## 模块

| 模块 | 说明 |
|---|---|
| `caixin-adblock.sgmodule` | 财新 App 去广告 |
| `netease-music-splash-adblock.sgmodule` | 网易云音乐去开屏广告 |
| `netease-music-feed-adblock.sgmodule` | 网易云首页净化（增强，配合上一个使用） |

**安装地址**

```
https://raw.githubusercontent.com/YUANCHUANYING/surge/main/caixin-adblock.sgmodule
https://raw.githubusercontent.com/YUANCHUANYING/surge/main/netease-music-splash-adblock.sgmodule
https://raw.githubusercontent.com/YUANCHUANYING/surge/main/netease-music-feed-adblock.sgmodule
```

启用模块并确认 MITM 已开启即可，脚本自动远程加载。首次使用建议卸载重装财新 App 清除广告缓存。

网易云模块走「广告素材域名 REJECT + `/x?e?api/ad` 全系 URL 重写 reject」，不需要脚本，但**必须开启 MITM**（路径层拦截依赖解密）。实测：`/eapi/ad/get`、`/eapi/sp/flow/popup` 返回 503，普通接口如 `/eapi/song/enhance/player/url` 仍 200。

已下发的开屏素材会被 App 本地缓存并重放，模块只能挡住后续拉取；要立刻验证效果需清一次 App 缓存或重装。切勿整域 REJECT `ipv4.music.163.com`。

首页净化模块（可选）额外拦掉 `/eapi/delivery/{deliver,batch-deliver}`（会员/付费投放卡）、`/eapi/resniche/tspopup/show`（启动弹窗）、`/eapi/link/position/show/resource` 与 `/eapi/link/scene/show/resource`（首页 Banner / 场景投放位）、`/eapi/mlivestream/entrance`（直播入口）。实测这 5 条均返 503，`/eapi/song/enhance/player/url` 等正常接口仍 200，首页三大卡片与推荐流加载正常。若首页某块出现空白，先停用该模块定位具体条目。

> 注：Surge 会**静默丢弃** URL Rewrite 里的 `- reject-dict`（Loon 写法），只保留域名规则且不报错；模块内统一用 `- reject`。自检办法：`curl -H "X-Key: …" http://127.0.0.1:6171/v1/profiles/current` 拉合并配置 grep 自己的 pattern。

## Skill / MCP

- [Surge MCP Skill](skills/surge-mcp/SKILL.md)：真实 MCP stdio 调用，覆盖 19 项工具；默认只读，写入需具体授权并显式启用门禁，结果仅输出隐私摘要。
- [可信部署](skills/surge-mcp/references/installation.md)：固定上游版本、本地安装与环境变量配置；[验证及风险](skills/surge-mcp/references/verification.md)。

需自行准备 Node.js、可信服务部署及 Surge HTTP API 密钥。无自动下载执行、无通用配置编辑、无原始响应导出；设备管理仅限 Mac。依赖存在已知审计风险，CLI 并非沙箱；不要提交密钥、配置、个人测试快照或向不可信客户端开放服务。新增 Skill 同样仅限个人自用、学习研究，未经允许禁止转载，不另行引入 MIT 授权。

详细条款见 [LICENSE](LICENSE)。
