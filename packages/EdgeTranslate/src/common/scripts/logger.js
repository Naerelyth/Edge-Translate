export {
    logInfo,
    logWarn,
    logError,
    shouldFilterError,
    wrapConsoleForFiltering,
    setLogLevel,
    getLogLevel,
};

// Known noisy error patterns to suppress in logs
const FILTERED_ERROR_PATTERNS = [
    "Unable to download",
    "Unable to download all specified images",
    "Cannot access",
    "before initialization",
    "Extension context invalidated",
    "Canvas error",
    "Network error",
];

function joinMessage(args) {
    try {
        return args
            .map((v) => (typeof v === "string" ? v : (v && v.message) || JSON.stringify(v)))
            .join(" ");
    } catch (_) {
        return args.join(" ");
    }
}

function shouldFilterError(message) {
    if (!message) return false;
    try {
        return (
            FILTERED_ERROR_PATTERNS.some((pattern) => message.includes(pattern)) ||
            /Cannot access '.*' before initialization/.test(message) ||
            /ReferenceError.*before initialization/.test(message) ||
            /Unable to download.*images/.test(message)
        );
    } catch (_) {
        return false;
    }
}

// Log level: 'debug' | 'info' | 'warn' | 'error' | 'silent'
const LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40, silent: 90 };
let currentLevel =
    typeof BUILD_ENV !== "undefined" && BUILD_ENV === "development" ? "debug" : "warn";

function setLogLevel(level) {
    if (LEVEL_ORDER[level] != null) currentLevel = level;
}

function getLogLevel() {
    return currentLevel;
}

function shouldEmit(level) {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

function logInfo(...args) {
    if (!shouldEmit("info")) return;
    // eslint-disable-next-line no-console
    console.log("[EdgeTranslate]", ...args);
}

function logWarn(...args) {
    if (!shouldEmit("warn")) return;
    // eslint-disable-next-line no-console
    console.warn("[EdgeTranslate]", ...args);
}

function logError(...args) {
    if (!shouldEmit("error")) return;
    const message = joinMessage(args);
    if (shouldFilterError(message)) return;
    // eslint-disable-next-line no-console
    console.error("[EdgeTranslate]", ...args);
}

// Optional: globally wrap console.error to suppress noisy errors
function wrapConsoleForFiltering() {
    const originalConsoleError = console.error;
    // eslint-disable-next-line no-console
    console.error = function (...args) {
        const message = joinMessage(args);
        if (!shouldFilterError(message)) {
            originalConsoleError.apply(console, args);
        }
    };
}
