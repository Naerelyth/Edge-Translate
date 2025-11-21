import { applyEarlyThemeFromStorageAndSystem, applyEarlyPageTheme, setupThemeToggle } from './et-viewer-theme.mjs';

// ==========================================
// FIX START: 插件兼容性补丁区域
// ==========================================

// [FIX 1] 解决 styled-components 的 "REACT_APP_SC_ATTR" 报错
// 原因：浏览器插件环境缺少 Node.js 的 process 对象
if (typeof window !== 'undefined') {
  window.process = window.process || {};
  window.process.env = window.process.env || {};
  window.process.env.REACT_APP_SC_ATTR = 'data-styled';
  window.process.env.NODE_ENV = 'production';
}

// [FIX 2] 解决 WebAssembly CSP 报错 (CompileError: WebAssembly.instantiate)
// 原因：禁止 PDF.js 加载脚本沙箱，从而避免触发浏览器的安全限制
// 注意：这需要 PDF.js 支持从 window 读取配置（大多数版本支持）
window.PDFViewerApplicationOptions = {
  enableScripting: false,
  ...window.PDFViewerApplicationOptions // 保留已有的配置（如果有）
};

// ==========================================
// FIX END
// ==========================================

// 1. Apply themes as early as possible to prevent flash
applyEarlyThemeFromStorageAndSystem();
applyEarlyPageTheme();

// 2. Load official viewer.mjs
const loadViewer = () => {
  if (document.getElementById('et-viewer-loader')) return;
  
  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'viewer.mjs';
  script.id = 'et-viewer-loader';
  document.head.appendChild(script);
};
loadViewer();

// 3. Setup theme toggle after DOM is ready
const initThemeToggle = () => {
  const success = setupThemeToggle();
  
  // If setup failed, retry once on next frame
  if (!success) {
    requestAnimationFrame(() => setupThemeToggle());
  }
  
  // Enable the button
  const btn = document.getElementById('etThemeToggle');
  if (btn) {
    btn.removeAttribute('disabled');
  }
};

// Use appropriate initialization timing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeToggle);
} else {
  // DOM already ready, use idle callback if available
  if ('requestIdleCallback' in window) {
    requestIdleCallback(initThemeToggle, { timeout: 500 });
  } else {
    requestAnimationFrame(initThemeToggle);
  }
}
