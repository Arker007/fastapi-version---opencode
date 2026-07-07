// =============================================================================
// InvoiceFlow — Common Application Logic (MPA Decorator Layout & Core Utilities)
// =============================================================================

(() => {
  'use strict';

  // Expose global app object
  window.APP = {
    STATE: {
      token: localStorage.getItem('invoiceflow-token') || '',
      user: null,
      settings: {},
      darkMode: localStorage.getItem('invoiceflow-theme') !== 'light',
    },
    api,
    showToast,
    formatCurrency,
    formatDate,
    formatDateTime,
    esc,
    logout,
    showLoader,
    hideLoader,
    closeAllModals, // ← NEW helper to close all open modals
    setupLocalDropdown, // ← Unified reusable dropdown handler
    setupTableSearch, // ← Centralized table search filter
  };


  // Run initial theme configuration
  applyTheme();

  document.addEventListener('DOMContentLoaded', bootstrap);
  window.addEventListener('popstate', handlePopState);

  function handlePopState() {
    const path = window.location.pathname.toLowerCase();
    let targetView = 'dashboard';
    if (path.includes('billing')) targetView = 'billing';
    else if (path.includes('invoices')) targetView = 'invoices';
    else if (path.includes('products')) targetView = 'products';
    else if (path.includes('customers')) targetView = 'customers';
    else if (path.includes('reports')) targetView = 'reports';
    else if (path.includes('admin-panel')) targetView = 'admin-panel';
    else if (path.includes('logs')) targetView = 'logs';

    switchView(targetView, window.location.pathname, false);
  }

  function bootstrap() {
    const path = window.location.pathname.toLowerCase();
    const isLoginPage = path.includes('login');

    if (isLoginPage) {
      if (APP.STATE.token) {
        window.location.href = '/dashboard';
      }
      return;
    }

    if (!APP.STATE.token) {
      window.location.href = '/login';
      return;
    }

    const pageContent = document.getElementById('page-content');
    if (pageContent) pageContent.classList.add('hidden');
    showLoader();

    hydrateSession();
  }

  async function hydrateSession() {
    try {
      APP.STATE.user = await api('/api/auth/me');

      try {
        APP.STATE.settings = await api('/api/settings');
      } catch (_) { /* non-critical */ }

      const path = window.location.pathname.toLowerCase();
      let activeView = 'dashboard';
      if (path.includes('billing')) activeView = 'billing';
      else if (path.includes('invoices')) activeView = 'invoices';
      else if (path.includes('products')) activeView = 'products';
      else if (path.includes('customers')) activeView = 'customers';
      else if (path.includes('reports')) activeView = 'reports';
      else if (path.includes('admin-panel')) activeView = 'admin-panel';
      else if (path.includes('logs')) activeView = 'logs';

      if ((activeView === 'admin-panel' || activeView === 'logs') && APP.STATE.user?.role !== 'admin') {
        window.location.href = '/dashboard';
        return;
      }

      decoratePage(activeView);
      applySettingsToUI();
      renderUserInfo();
      renderDate();
      bindShellEvents();

      hideLoader();
      document.dispatchEvent(new CustomEvent('page-ready'));
    } catch (err) {
      hideLoader();
      logout(true);
    }
  }

  function decoratePage(activeViewName) {
    const content = document.getElementById('page-content');
    if (!content) return;

    const appContainer = document.createElement('div');
    appContainer.id = 'app-container';
    appContainer.className = 'app-wrapper';

    const sidebarHtml = `
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <div id="sidebar-logo-container" class="sidebar-logo-box hidden"></div>
            <span class="brand-title" id="sidebar-brand-title">InvoiceFlow</span>
          </div>
          <button id="sidebar-toggle" class="btn-sidebar-toggle" title="Collapse Sidebar">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
        </div>

        <nav class="sidebar-nav">
          <div class="sidebar-section-title">Main Menu</div>
          <a href="/dashboard" class="nav-item ${activeViewName === 'dashboard' ? 'active' : ''}" data-view="dashboard">
            <i class="fa-solid fa-chart-pie"></i> <span>Dashboard</span>
          </a>
          <a href="/billing" class="nav-item ${activeViewName === 'billing' ? 'active' : ''}" data-view="billing">
            <i class="fa-solid fa-file-invoice"></i> <span>Create Invoice</span>
          </a>
          <a href="/invoices" class="nav-item ${activeViewName === 'invoices' ? 'active' : ''}" data-view="invoices">
            <i class="fa-solid fa-clock-rotate-left"></i> <span>Invoices List</span>
          </a>

          <div class="sidebar-section-title">Inventory & CRM</div>
          <a href="/products" class="nav-item ${activeViewName === 'products' ? 'active' : ''}" data-view="products">
            <i class="fa-solid fa-boxes-stacked"></i> <span>Products & Stock</span>
          </a>
          <a href="/customers" class="nav-item ${activeViewName === 'customers' ? 'active' : ''}" data-view="customers">
            <i class="fa-solid fa-users"></i> <span>Customers</span>
          </a>

          <div class="sidebar-section-title">Analysis</div>
          <a href="/reports" class="nav-item ${activeViewName === 'reports' ? 'active' : ''}" data-view="reports">
            <i class="fa-solid fa-chart-column"></i> <span>Reports Directory</span>
          </a>

          <div class="sidebar-section-title admin-only hidden">Administration</div>
          <a href="/admin-panel" class="nav-item admin-only hidden ${activeViewName === 'admin-panel' ? 'active' : ''}" data-view="admin-panel">
            <i class="fa-solid fa-screwdriver-wrench"></i> <span>Admin Panel</span>
          </a>
          <a href="/logs" class="nav-item admin-only hidden ${activeViewName === 'logs' ? 'active' : ''}" data-view="logs">
            <i class="fa-solid fa-shield-halved"></i> <span>System Logs</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="user-profile">
            <div class="user-avatar">
              <i class="fa-solid fa-circle-user"></i>
            </div>
            <div class="user-details">
              <h4 id="user-fullname">Loading...</h4>
              <p id="user-role">Role</p>
            </div>
          </div>
          <button id="btn-logout" class="btn btn-logout">
            <i class="fa-solid fa-right-from-bracket"></i> <span>Logout</span>
          </button>
        </div>
      </aside>
    `;

    const viewTitles = {
      dashboard: 'Dashboard',
      billing: 'Create Invoice',
      invoices: 'Invoices List',
      products: 'Products & Stock',
      customers: 'Customers',
      reports: 'Reports Directory',
      'admin-panel': 'Admin Panel',
      logs: 'System Logs'
    };

    const headerHtml = `
      <header class="main-header">
        <div class="header-left">
          <h1 id="view-title">${viewTitles[activeViewName] || 'Dashboard'}</h1>
        </div>
        <div class="header-right" style="display: flex; gap: 12px; align-items: center;">
          <button id="theme-toggle" class="btn btn-action" title="Toggle Light/Dark Theme" style="padding: 10px 14px;">
            <i class="fa-solid fa-moon"></i>
          </button>
          <div class="date-badge">
            <i class="fa-regular fa-calendar-days"></i>
            <span id="current-date"></span>
          </div>
        </div>
      </header>
    `;

    appContainer.innerHTML = sidebarHtml;

    const mainWrapper = document.createElement('main');
    mainWrapper.className = 'main-content';
    mainWrapper.innerHTML = headerHtml;

    const viewport = document.createElement('div');
    viewport.className = 'view-viewport';
    viewport.id = 'main-content-viewport';

    content.classList.remove('hidden');
    viewport.appendChild(content);
    mainWrapper.appendChild(viewport);
    appContainer.appendChild(mainWrapper);

    const toastWrapper = document.createElement('div');
    toastWrapper.id = 'toast-container';
    toastWrapper.className = 'toast-wrapper';
    document.body.appendChild(toastWrapper);

    document.body.appendChild(appContainer);

    if (localStorage.getItem('invoiceflow-sidebar-collapsed') === 'true') {
      appContainer.classList.add('sidebar-collapsed');
    }
  }

  function applySettingsToUI() {
    const settings = APP.STATE.settings;
    if (!settings) return;

    const brandTitle = document.getElementById('sidebar-brand-title');
    if (brandTitle && settings.company_name) {
      brandTitle.textContent = settings.company_name.split(' ')[0] || 'InvoiceFlow';
    }

    const sidebarLogo = document.getElementById('sidebar-logo-container');
    if (sidebarLogo && settings.company_logo) {
      sidebarLogo.classList.remove('hidden');
      sidebarLogo.innerHTML = `<img src="${settings.company_logo}" alt="Logo" style="max-height:32px;max-width:32px;object-fit:contain;border-radius:4px;">`;
    }
  }

  function renderUserInfo() {
    const fullnameEl = document.getElementById('user-fullname');
    const roleEl = document.getElementById('user-role');
    if (fullnameEl) fullnameEl.textContent = APP.STATE.user?.fullname || 'User';
    if (roleEl) roleEl.textContent = APP.STATE.user?.role === 'admin' ? 'Administrator' : 'Staff';


    const isAdmin = APP.STATE.user?.role === 'admin';
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', !isAdmin);
    });
  }

  function renderDate() {
    const el = document.getElementById('current-date');
    if (el) {
      el.textContent = new Date().toLocaleDateString('en-IN', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    }
  }

  function bindShellEvents() {
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => logout(false));

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        const container = document.getElementById('app-container');
        container.classList.toggle('sidebar-collapsed');
        localStorage.setItem('invoiceflow-sidebar-collapsed', container.classList.contains('sidebar-collapsed'));
      });
    }

    // Intercept sidebar navigation for SPA routing
    document.addEventListener('click', (e) => {
      const navLink = e.target.closest('.sidebar-nav .nav-item');
      if (navLink) {
        e.preventDefault();
        const targetView = navLink.dataset.view;
        const href = navLink.getAttribute('href');
        switchView(targetView, href);
      }
    });

    // Modal close listeners – using closest() to handle nested clicks
    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('.btn-close-modal');
      if (closeBtn) {
        const overlay = closeBtn.closest('.modal-overlay');
        if (overlay) overlay.classList.add('hidden');
        return;
      }

      const overlay = e.target.closest('.modal-overlay');
      if (overlay && e.target === overlay) {
        overlay.classList.add('hidden');
      }
    });

    // Global actions menu toggler helper
    window._toggleActionsMenu = (btn) => {
      document.querySelectorAll('.actions-dropdown-menu').forEach(m => {
        if (m !== btn.nextElementSibling) m.classList.add('hidden');
      });
      const menu = btn.nextElementSibling;
      if (menu) menu.classList.toggle('hidden');
    };

    // Close actions menus when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.actions-dropdown-wrapper')) {
        document.querySelectorAll('.actions-dropdown-menu').forEach(m => m.classList.add('hidden'));
      }
    });

    // Close modals when pressing Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllModals();
      }
    });
  }

  // Theme Management
  function applyTheme() {
    if (APP.STATE.darkMode) {
      document.documentElement.removeAttribute('data-theme');
      updateThemeIcon(true);
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      updateThemeIcon(false);
    }
  }

  function updateThemeIcon(isDark) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.innerHTML = isDark
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
  }

  function toggleTheme() {
    APP.STATE.darkMode = !APP.STATE.darkMode;
    localStorage.setItem('invoiceflow-theme', APP.STATE.darkMode ? 'dark' : 'light');
    applyTheme();
  }

  // Loader Overlay
  function showLoader(title = "Verifying Session...", subtitle = "Connecting to billing & inventory portal") {
    let loader = document.getElementById('app-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'app-loader';
      loader.className = 'login-wrapper';
      loader.style.zIndex = '9999';
      document.body.appendChild(loader);
    }
    loader.innerHTML = `
      <div style="text-align: center; color: var(--text-main);">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 3rem; color: var(--primary); margin-bottom: 16px;"></i>
        <h3 style="font-family: var(--font-header); font-weight: 600; font-size: 1.25rem;">${esc(title)}</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;">${esc(subtitle)}</p>
      </div>
    `;
  }

  // SPA Routing view switcher
  async function switchView(targetView, href, pushToHistory = true) {
    showLoader("Loading view...", "Preparing workspace");
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(`Failed to load page: ${res.statusText}`);
      const htmlText = await res.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      const newContent = doc.getElementById('page-content');

      const viewport = document.getElementById('main-content-viewport');
      if (viewport && newContent) {
        viewport.innerHTML = '';
        newContent.classList.remove('hidden');
        viewport.appendChild(newContent);
      }

      // Update active navigation item in sidebar
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === targetView);
      });

      // Update header title
      const viewTitles = {
        dashboard: 'Dashboard',
        billing: 'Create Invoice',
        invoices: 'Invoices List',
        products: 'Products & Stock',
        customers: 'Customers',
        reports: 'Reports Directory',
        'admin-panel': 'Admin Panel',
        logs: 'System Logs'
      };
      const titleEl = document.getElementById('view-title');
      if (titleEl) titleEl.textContent = viewTitles[targetView] || 'Dashboard';

      if (pushToHistory) {
        window.history.pushState(null, '', href);
      }

      // Find and load the view script
      const scripts = doc.querySelectorAll('script');
      let viewScriptSrc = '';
      scripts.forEach(script => {
        const src = script.getAttribute('src');
        if (src && src.includes('/js/views/')) {
          viewScriptSrc = src;
        }
      });

      if (viewScriptSrc) {
        // Remove existing script tag to reload/re-run it cleanly
        const cleanSrc = viewScriptSrc.split('?')[0];
        const existingScript = document.querySelector(`script[src^="${cleanSrc}"]`);
        if (existingScript) existingScript.remove();

        const newScript = document.createElement('script');
        newScript.src = viewScriptSrc;
        newScript.onload = () => {
          hideLoader();
          document.dispatchEvent(new CustomEvent('page-ready'));
        };
        document.body.appendChild(newScript);
      } else {
        hideLoader();
        document.dispatchEvent(new CustomEvent('page-ready'));
      }
    } catch (err) {
      hideLoader();
      console.error('SPA Navigation error:', err);
      // Fallback: full reload if fetch/parsing fails
      window.location.href = href;
    }
  }

  function hideLoader() {
    const loader = document.getElementById('app-loader');
    if (loader) loader.remove();
  }

  function logout(silent = false) {
    localStorage.removeItem('invoiceflow-token');
    localStorage.removeItem('invoiceflow-activeView');
    const isLoginPage = window.location.pathname.toLowerCase().includes('login');
    if (!isLoginPage) {
      window.location.href = '/login';
    }
  }

  // ===========================================================================
  // API Request Wrapper (handles non-JSON errors)
  // ===========================================================================
  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (APP.STATE.token) headers.Authorization = `Bearer ${APP.STATE.token}`;

    const reqOpts = { ...options, headers };
    if (reqOpts.body && typeof reqOpts.body === 'object') {
      reqOpts.body = JSON.stringify(reqOpts.body);
    }

    const res = await fetch(path, reqOpts);

    if (res.status === 401 || res.status === 403) {
      const isLoginPage = window.location.pathname.toLowerCase().includes('login');
      if (!isLoginPage) {
        logout(true);
      }
      throw new Error('Session expired');
    }

    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch (e) {
        const text = await res.text();
        throw new Error(text || 'Request failed with invalid response');
      }
    } else {
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || 'Request failed');
      }
      return text;
    }

    if (!res.ok) {
      throw new Error(data?.detail || data?.error || 'Request failed');
    }
    return data;
  }

  // ===========================================================================
  // Toast Notifications
  // ===========================================================================
  function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const message = String(msg);

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-exclamation',
      info: 'fa-circle-info',
    };

    toast.innerHTML = `
      <i class="fa-solid ${icons[type] || icons.info}"></i>
      <span class="toast-message">${esc(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 3500);
  }

  // ===========================================================================
  // Formatter helpers
  // ===========================================================================
  function formatCurrency(val) {
    const symbol = (window.APP && window.APP.STATE && window.APP.STATE.settings && window.APP.STATE.settings.currency_symbol) || '₹';
    const num = parseFloat(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${symbol}${num}`;
  }

  function formatDate(isoStr) {
    if (!isoStr) return '-';
    try {
      const cleanStr = isoStr.replace(' ', 'T');
      const date = new Date(cleanStr.endsWith('Z') ? cleanStr : cleanStr + 'Z');
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch (_) {
      return '-';
    }
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '-';
    try {
      const cleanStr = isoStr.replace(' ', 'T');
      const date = new Date(cleanStr.endsWith('Z') ? cleanStr : cleanStr + 'Z');
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
    } catch (_) {
      return '-';
    }
  }

  // ===========================================================================
  // Escaping
  // ===========================================================================
  function esc(str) {
    if (str == null) return '';
    if (typeof str !== 'string') str = String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ===========================================================================
  // Helper: close all open modals (used to prevent duplicates)
  // ===========================================================================
  function closeAllModals() {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
  }

  // Helper: setup local dropdown menu and toggler triggers
  function setupLocalDropdown(toggleId, menuId, onSelect) {
    const toggle = document.getElementById(toggleId);
    const menu = document.getElementById(menuId);
    if (!toggle || !menu) return;

    const wrapper = toggle.closest('.dropdown-wrapper');

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = menu.classList.toggle('hidden');
      if (wrapper) {
        wrapper.classList.toggle('dropdown-open', !isHidden);
      }
      // Close all other dropdown wrappers
      document.querySelectorAll('.dropdown-wrapper').forEach(w => {
        if (w !== wrapper) {
          w.classList.remove('dropdown-open');
          w.querySelector('.dropdown-menu')?.classList.add('hidden');
        }
      });
    });

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item) return;
      menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      menu.classList.add('hidden');
      if (wrapper) {
        wrapper.classList.remove('dropdown-open');
      }
      if (onSelect) onSelect(item);
    });

    document.addEventListener('click', () => {
      menu.classList.add('hidden');
      if (wrapper) {
        wrapper.classList.remove('dropdown-open');
      }
    });
  }

  // Helper: setup client-side search filtering on any table tbody
  function setupTableSearch(inputId, tbodyId) {
    const input = document.getElementById(inputId);
    const tbody = document.getElementById(tbodyId);
    if (!input || !tbody) return;

    input.addEventListener('input', () => {
      const query = input.value.toLowerCase();
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
      });
    });
  }


  // ===========================================================================
  // Reusable Web Components
  // ===========================================================================

  class KpiCard extends HTMLElement {
    connectedCallback() {
      const icon = this.getAttribute('icon') || 'fa-box';
      const label = this.getAttribute('label') || '';
      const valueId = this.getAttribute('value-id') || '';
      const variant = this.getAttribute('variant') || '';

      this.className = `kpi-card ${variant}`;
      this.style.display = 'flex';

      this.innerHTML = `
        <div class="kpi-icon ${variant}"><i class="fa-solid ${icon}"></i></div>
        <div class="kpi-info">
          <h3>${label}</h3>
          <h2 id="${valueId}">0</h2>
        </div>
      `;
    }
  }
  customElements.define('kpi-card', KpiCard);

  class ModalDialog extends HTMLElement {
    connectedCallback() {
      const modalId = this.getAttribute('modal-id') || '';

      // Prevent duplicate modals with the same ID
      const existing = document.getElementById(modalId);
      if (existing && existing !== this) {
        existing.remove();
      }

      // Prevent double-wrapping / double-header bug when detached and re-attached to the DOM
      if (this.querySelector('.modal-card')) {
        return;
      }

      const title = this.getAttribute('title') || '';
      const icon = this.getAttribute('icon') || 'fa-circle-info';
      const cardClass = this.getAttribute('card-class') || '';
      const titleId = this.getAttribute('title-id') || '';

      const bodyContent = this.innerHTML;

      this.className = 'modal-overlay hidden';
      this.id = modalId;

      this.innerHTML = `
        <div class="modal-card ${cardClass}">
          <div class="modal-header">
            <h3><i class="fa-solid ${icon}"></i> <span id="${titleId}">${title}</span></h3>
            <button class="btn-close-modal"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="modal-body">
            ${bodyContent}
          </div>
        </div>
      `;
    }
  }

  customElements.define('modal-dialog', ModalDialog);

  class SearchBar extends HTMLElement {
    connectedCallback() {
      const inputId = this.getAttribute('input-id') || '';
      const placeholder = this.getAttribute('placeholder') || 'Search...';
      const styleAttr = this.getAttribute('style') || '';

      this.className = 'search-bar';
      this.style.display = 'flex';
      if (styleAttr) {
        this.setAttribute('style', this.getAttribute('style') + '; display: flex;');
      }

      this.innerHTML = `
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" id="${inputId}" placeholder="${placeholder}">
      `;
    }
  }
  customElements.define('search-bar', SearchBar);

})();