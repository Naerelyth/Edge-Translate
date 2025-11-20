// Optimized theme management for PDF.js viewer

// === Utility Functions ===
const prefersDark = () => {
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

const getStorageItem = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setStorageItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

const removeStorageItem = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {}
};

// === PDF.js Preferences Management ===
const updatePdfjsTheme = (mode) => {
  try {
    const prefsRaw = getStorageItem('pdfjs.preferences');
    const prefs = prefsRaw ? JSON.parse(prefsRaw) : {};
    prefs.viewerCssTheme = mode === 'dark' ? 2 : 1;
    setStorageItem('pdfjs.preferences', JSON.stringify(prefs));
  } catch {}
};

// === Theme Application ===
const applyThemeToDOM = (mode) => {
  const html = document.documentElement;
  
  // Batch DOM updates for better performance
  html.style.colorScheme = mode;
  html.setAttribute('data-theme', mode);
  
  // Required for PDF.js native styles
  if (mode === 'dark') {
    html.classList.add('is-dark');
    html.classList.remove('is-light');
  } else {
    html.classList.add('is-light');
    html.classList.remove('is-dark');
  }
};

// === Early Theme Initialization (Before Render) ===
export function applyEarlyThemeFromStorageAndSystem() {
  const explicit = getStorageItem('et_viewer_theme');
  const mode = (explicit === 'dark' || explicit === 'light') ? explicit : (prefersDark() ? 'dark' : 'light');
  
  // Apply theme immediately
  applyThemeToDOM(mode);
  updatePdfjsTheme(mode);
  
  // Note: System theme listener is registered in setupThemeToggle() to avoid duplicate listeners
}

// === Early Page Theme (PDF Content Inversion) ===
export function applyEarlyPageTheme() {
  const saved = getStorageItem('et_page_theme');
  const shouldInvert = saved === 'dark' || (saved !== 'light' && prefersDark());
  
  if (shouldInvert) {
    document.documentElement.setAttribute('data-page-theme', 'dark');
  }
}

// === Theme Toggle Setup ===
export function setupThemeToggle() {
  const elements = {
    btn: document.getElementById('etThemeToggle'),
    menu: document.getElementById('etThemeMenu'),
    themeAuto: document.getElementById('etThemeAutoIcon'),
    themeLight: document.getElementById('etThemeLightIcon'),
    themeDark: document.getElementById('etThemeDarkIcon'),
    pageAuto: document.getElementById('etPageAutoIcon'),
    pageLight: document.getElementById('etPageLightIcon'),
    pageDark: document.getElementById('etPageDarkIcon')
  };
  
  // Check if all required elements exist
  if (!elements.btn || !elements.menu || !elements.themeAuto || !elements.themeLight || !elements.themeDark) {
    return false;
  }
  
  // === UI Theme Management ===
  const setUITheme = (mode) => {
    applyThemeToDOM(mode);
    updatePdfjsTheme(mode);
    elements.btn.setAttribute('aria-pressed', String(mode === 'dark'));
  };
  
  const markActiveTheme = (mode) => {
    const buttons = [elements.themeAuto, elements.themeLight, elements.themeDark];
    buttons.forEach(btn => btn.classList.remove('toggled'));
    
    if (mode === 'auto') {
      elements.themeAuto.classList.add('toggled');
    } else {
      (mode === 'light' ? elements.themeLight : elements.themeDark).classList.add('toggled');
    }
  };
  
  const syncThemeFromStorage = () => {
    const explicit = getStorageItem('et_viewer_theme');
    if (explicit === 'dark' || explicit === 'light') {
      setUITheme(explicit);
      markActiveTheme(explicit);
    } else {
      const sys = prefersDark() ? 'dark' : 'light';
      setUITheme(sys);
      markActiveTheme('auto');
    }
  };
  
  const setExplicitTheme = (mode) => {
    const current = getStorageItem('et_viewer_theme');
    
    // 总是更新storage（如果需要）
    if (mode === null) {
      if (current === 'dark' || current === 'light') {
        removeStorageItem('et_viewer_theme');
      }
    } else {
      if (current !== mode) {
        setStorageItem('et_viewer_theme', mode);
      }
    }
	  
    syncThemeFromStorage();
  };
  
  // === Page Theme (PDF Content) Management ===
  const applyPageTheme = (mode) => {
    const html = document.documentElement;
    const shouldInvert = mode === 'dark' || (mode === 'auto' && prefersDark());
    
    if (shouldInvert) {
      html.setAttribute('data-page-theme', 'dark');
    } else {
      html.removeAttribute('data-page-theme');
    }
  };
  
  const markActivePageTheme = (mode) => {
    const buttons = [elements.pageAuto, elements.pageLight, elements.pageDark];
    buttons.forEach(btn => btn && btn.classList.remove('toggled'));
    
    if (mode === 'auto' && elements.pageAuto) {
      elements.pageAuto.classList.add('toggled');
    } else if (mode === 'light' && elements.pageLight) {
      elements.pageLight.classList.add('toggled');
    } else if (mode === 'dark' && elements.pageDark) {
      elements.pageDark.classList.add('toggled');
    }
  };
  
  const setPageTheme = (mode) => {
    const current = getStorageItem('et_page_theme') || 'auto';
    
    if (current !== mode) {
      setStorageItem('et_page_theme', mode);
    }
    
    applyPageTheme(mode);
    markActivePageTheme(mode);
  };
  
  // === Menu Management ===
  const closeOtherMenus = () => {
    try {
      const menus = document.querySelectorAll('.doorHanger, .doorHangerRight, .menu');
      menus.forEach(el => {
        if (el === elements.menu) return;
        el.classList.add('hidden');
        const id = el.id;
        if (id) {
          const controller = document.querySelector(`[aria-controls="${CSS.escape(id)}"]`);
          if (controller) {
            if (controller.getAttribute('aria-expanded') === 'true') {
              controller.setAttribute('aria-expanded', 'false');
            }
            // 取消按钮的 toggled 状态
            controller.classList.remove('toggled');
          }
        }
      });

      // 关键:通过 PDF.js 的 eventBus 禁用编辑模式
      // 这会真正地关闭编辑功能,而不仅仅是视觉状态
      if (window.PDFViewerApplication?.eventBus) {
        try {
          const eventBus = window.PDFViewerApplication.eventBus;
          // mode: 0 表示 AnnotationEditorType.DISABLE
          eventBus.dispatch('switchannotationeditormode', {
            mode: 0
          });
        } catch {
          // 如果 API 不可用,静默失败
        }
      }
    } catch {}
  };
  
  const toggleMenu = () => {
    const isHidden = elements.menu.classList.contains('hidden');
    if (isHidden) {
      closeOtherMenus();
      elements.menu.classList.remove('hidden');
      elements.btn.setAttribute('aria-expanded', 'true');
    } else {
      elements.menu.classList.add('hidden');
      elements.btn.setAttribute('aria-expanded', 'false');
    }
  };
  
  const closeMenu = () => {
    elements.menu.classList.add('hidden');
    elements.btn.setAttribute('aria-expanded', 'false');
  };
  
  // === Event Listeners ===
  // UI Theme buttons
  elements.btn.addEventListener('click', toggleMenu);
  elements.themeAuto.addEventListener('click', () => setExplicitTheme(null));
  elements.themeLight.addEventListener('click', () => setExplicitTheme('light'));
  elements.themeDark.addEventListener('click', () => setExplicitTheme('dark'));
  
  // Page Theme buttons
  if (elements.pageAuto) elements.pageAuto.addEventListener('click', () => setPageTheme('auto'));
  if (elements.pageLight) elements.pageLight.addEventListener('click', () => setPageTheme('light'));
  if (elements.pageDark) elements.pageDark.addEventListener('click', () => setPageTheme('dark'));
  
  // System theme change listener
  // CRITICAL: Always check current explicit preference in the callback
  // to handle cases where user changes from auto to explicit mode
  const onSchemeChange = () => {
    const explicit = getStorageItem('et_viewer_theme');
    // Only sync if currently in auto mode
    if (explicit !== 'dark' && explicit !== 'light') {
      syncThemeFromStorage();
    }
    
    const pagePref = getStorageItem('et_page_theme');
    // Only update page theme if currently in auto mode
    if (pagePref !== 'dark' && pagePref !== 'light') {
      setPageTheme('auto');
    }
  };
  
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onSchemeChange);
  } catch {}
  
  // Close menu on outside click
  const handleOutsideClick = (e) => {
    const root = document.getElementById('etTheme');
    if (root && !root.contains(e.target)) {
      closeMenu();
    }
  };
  
  document.addEventListener('click', handleOutsideClick, true);
  document.addEventListener('pointerdown', handleOutsideClick, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
  
  // Close menu when other menus open (using MutationObserver)
  try {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const t = m.target;
        if (t === elements.menu || !t.classList) continue;
        if ((t.classList.contains('menu') || t.classList.contains('doorHanger') || 
             t.classList.contains('doorHangerRight')) && !t.classList.contains('hidden')) {
          closeMenu();
          break;
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  } catch {}
  
  // === Initialize State ===
  syncThemeFromStorage();
  
  // Initialize page theme state (ensure UI reflects stored preference)
  const initPageMode = getStorageItem('et_page_theme') || 'auto';
  applyPageTheme(initPageMode);
  markActivePageTheme(initPageMode);
  
  return true;
}
