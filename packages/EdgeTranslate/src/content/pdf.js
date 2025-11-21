// ==========================================
// FIX START: 插件兼容性补丁区域
// ==========================================

// [FIX 1] 解决 styled-components 的 "REACT_APP_SC_ATTR" 报错
// 原因：浏览器插件环境缺少 Node.js 的 process 对象
// 注意：这个补丁是为了支持插件的 UI 代码（如翻译面板），而非 PDF.js 本身
if (typeof window !== "undefined" && typeof process === "undefined") {
  window.process = {
    env: {
      REACT_APP_SC_ATTR: "data-styled",
      SC_ATTR: "data-styled",
      NODE_ENV: "production"
    }
  };
}

// [FIX 2] 确保 document 和 window 对象可访问（解决某些样式库的访问问题）
// 这可以防止 "Cannot set properties of undefined" 错误
if (typeof window !== "undefined") {
  // 确保 document 可以从 window 访问
  if (!window.document && typeof document !== "undefined") {
    window.document = document;
  }
}

import { isChromePDFViewer } from "./common.js"; // judge if this page is a pdf file
import Channel from "common/scripts/channel.js";
import { DEFAULT_SETTINGS, getOrSetDefaultSettings } from "common/scripts/settings.js";

const channel = new Channel();
/**
 * 处理PDF文件链接
 *
 * 1. 如果是使用浏览器打开PDF文件，根据用户设定决定是否跳转到插件内置PDF阅读器。
 *
 * 2. 如果是在浏览器内置的PDF阅读器中点刷新，根据用户设定决定是否跳转到插件内置PDF阅读器。
 *
 * 3. 如果是从插件内置PDF阅读器中返回，不再自动跳转到插件内置PDF阅读器。
 */
window.addEventListener("load", () => {
    if (isChromePDFViewer()) {
        let state = history.state;

        /**
         * Issue: https://github.com/EdgeTranslate/EdgeTranslate/issues/261
         *
         * Some websites imitate the structure of Chrome built-in PDF viewer page
         * but use a separated pdf source instead of window.location.href, like
         * https://www.yuque.com/.
         */
        let pdfSrc = window.location.href;
        if (document.body.children[0].src && document.body.children[0].src !== "about:blank") {
            pdfSrc = document.body.children[0].src;
        }

        if (state === null) {
            // 第一次打开页面，直接跳转到PDF.js阅读器，并将ET_visited设为真
            state = { ET_visited: true };
            history.replaceState(state, document.title, window.location.href);
            redirect(pdfSrc);
        } else if (!state.ET_visited) {
            // 没设置过ET_visited，或者ET_visited为假，需要跳转到PDF.js阅读器，并将ET_visited设为真
            state.ET_visited = true;
            history.replaceState(state, document.title, window.location.href);
            redirect(pdfSrc);
        } else {
            // ET_visited为真，说明是从PDF.js阅读器返回，不再跳转到PDF.js阅读器，并将ET_visited设为假
            state.ET_visited = false;
            history.replaceState(state, document.title, window.location.href);
        }
    }
});

/**
 * 向background.js发送消息实现跳转。
 *
 * @param {String} pdfSrc PDF file source.
 */
function redirect(pdfSrc) {
    getOrSetDefaultSettings("OtherSettings", DEFAULT_SETTINGS).then((result) => {
        let OtherSettings = result.OtherSettings;
        if (OtherSettings && OtherSettings["UsePDFjs"]) {
            channel.emit("redirect", {
                url: chrome.runtime.getURL(`pdf/viewer.html?file=${encodeURIComponent(pdfSrc)}`),
            });
        }
    });
}
