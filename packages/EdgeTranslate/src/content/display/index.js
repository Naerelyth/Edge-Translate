/** @jsx h */
import { h, render } from "preact";
import Panel from "./Panel.jsx";
import { wrapConsoleForFiltering } from "common/scripts/logger.js";

/**
 * Content Script 오류 필터링
 */
const FILTERED_ERROR_PATTERNS = [
    "Unable to download",
    "Unable to download all specified images",
    "Cannot access",
    "before initialization",
    "Extension context invalidated",
    "Canvas error",
    "Network error",
];

function shouldFilterError(message) {
    return (
        FILTERED_ERROR_PATTERNS.some((pattern) => message.includes(pattern)) ||
        /Cannot access '.*' before initialization/.test(message) ||
        /ReferenceError.*before initialization/.test(message) ||
        /Unable to download.*images/.test(message) ||
        /Unable to download all specified images/.test(message)
    );
}

wrapConsoleForFiltering();

// 전역 오류 핸들러 추가
window.addEventListener("error", (event) => {
    if (event.error && event.error.message && shouldFilterError(event.error.message)) {
        event.preventDefault();
        return false;
    }
});

window.addEventListener("unhandledrejection", (event) => {
    if (event.reason) {
        const message =
            typeof event.reason === "string" ? event.reason : event.reason.message || "";
        if (shouldFilterError(message)) {
            event.preventDefault();
            return false;
        }
    }
});

(async function initialize() {
    try {
        render(<Panel />, document.documentElement);
        // Prepare this polyfill for the useMeasure hook of "react-use".
        if (!window.ResizeObserver) {
            window.ResizeObserver = (await import("resize-observer-polyfill")).default;
        }
    } catch (error) {
        if (
            error.message &&
            (error.message.includes("Cannot access 'H' before initialization") ||
                error.message.includes("Cannot access") ||
                error.message.includes("before initialization") ||
                /Cannot access '.*' before initialization/.test(error.message))
        ) {
            console.warn("[EdgeTranslate] JSX 초기화 오류 - 재시도 중...");
            setTimeout(() => {
                try {
                    render(<Panel />, document.documentElement);
                } catch (retryError) {
                    console.warn("[EdgeTranslate] JSX 재시도 실패:", retryError.message);
                }
            }, 100);
        } else {
            console.error("[EdgeTranslate] 초기화 오류:", error);
        }
    }
})();
