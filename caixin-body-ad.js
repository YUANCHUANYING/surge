/**
 * 财新 App 正文页（H5）增强脚本 — 广告隐藏 + AI 卡片移除
 * 目标：mappsv5.caixin.com/articlev5/<栏目>/<文章ID>.html
 *
 * 一、广告隐藏
 * 正文由 file.caixin.com/pkg/cx-app/content/assets/index.js 渲染，广告为运行时插入的空 div：
 *   .wall-ads  文中大图广告（财新峰会 / LSEG 等）
 *   .pip-ads   画中画广告
 *   .long-ads  列表广告
 *   id 形如 aDom_<n>
 *
 * 二、移除「AI 猜你想问」卡片
 * 源码逻辑（已确认）：
 *   if (Zf.isAiEntry()) {
 *     document.getElementById("cx-cons").insertAdjacentHTML("beforebegin", '<div id="cx-ai"></div>');
 *     load("https://www.caixin.com/ai/question/<后4位>/<articleId>.js")
 *   }
 * 因此只要把锚点 #cx-cons 改名，insertAdjacentHTML 就找不到容器，
 * AI 卡片不会插入，也不会去请求 ai/question 数据。
 *
 * 两条规则均可独立开关，见下方 ENABLE_* 常量。
 */

const ENABLE_HIDE_ADS = true;   // 隐藏正文广告位
const ENABLE_REMOVE_AI = true;  // 移除「AI 猜你想问」

const AD_CSS = `
.wall-ads,
.pip-ads,
.long-ads,
[id^="aDom_"] {
  display: none !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}
`;

const AI_CSS = `
#cx-ai,
[class*="AiWidget"],
[class*="aiWidget"] {
  display: none !important;
}
`;

let body = $response.body;

if (!body || typeof body !== "string") {
  $done({});
} else {
  let css = "";
  if (ENABLE_HIDE_ADS) css += AD_CSS;
  if (ENABLE_REMOVE_AI) css += AI_CSS;

  if (css) {
    const style = `<style id="minis-caixin-fix">${css}</style>`;
    if (body.indexOf("</head>") !== -1) {
      body = body.replace("</head>", `${style}</head>`);
    } else if (body.indexOf("</body>") !== -1) {
      body = body.replace("</body>", `${style}</body>`);
    } else {
      body = body + style;
    }
  }

  // 破坏 AI 卡片插入锚点：insertAdjacentHTML 找不到 #cx-cons 时不会插入 #cx-ai
  if (ENABLE_REMOVE_AI) {
    body = body.replace(/id="cx-cons"/g, 'id="cx-cons-disabled"');
  }

  $done({ body });
}
