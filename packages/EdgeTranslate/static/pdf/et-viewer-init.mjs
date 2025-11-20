import { applyEarlyThemeFromStorageAndSystem, applyEarlyPageTheme, setupThemeToggle } from './et-viewer-theme.mjs';

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
