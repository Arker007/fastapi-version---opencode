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
  };

  // Run initial theme configuration
  applyTheme();

  document.addEventListener('DOMContentLoaded', bootstrap);

  function bootstrap() {
    const path = window.location.pathname.toLowerCase();
    const isLoginPage = path.includes('login');

    if (isLoginPage) {
      // Login page doesn't get decorated
      if (APP.STATE.token) {
        window.location.href = '/dashboard';
      }
      return;
    }

    if (!APP.STATE.token) {
      window.location.href = '/login';
      return;
    }

    // Hide page content and show loader during auth verification
    const pageContent = document.getElementById('page-content');
    if (pageContent) pageContent.classList.add('hidden');
    showLoader();

    hydrateSession();
  }

  async function hydrateSession() {
    try {
      APP.STATE.user = await api('/api/auth/me');
      
      // Load settings
      try {
        APP.STATE.settings = await api('/api/settings');
      } catch (_) { /* non-critical */ }

      // Decorate page content
      const path = window.location.pathname.toLowerCase();
      let activeView = 'dashboard';
      if (path.includes('billing')) activeView = 'billing';
      else if (path.includes('invoices')) activeView = 'invoices';
      else if (path.includes('products')) activeView = 'products';
      else if (path.includes('customers')) activeView = 'customers';
      else if (path.includes('reports')) activeView = 'reports';
      else if (path.includes('admin-panel')) activeView = 'admin-panel';
      else if (path.includes('logs')) activeView = 'logs';

      // Ensure staff can't bypass admin pages
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

      // Trigger page-specific JS initialization
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

    // Sidebar brand title
    const brandTitle = document.getElementById('sidebar-brand-title');
    if (brandTitle && settings.company_name) {
      brandTitle.textContent = settings.company_name.split(' ')[0] || 'InvoiceFlow';
    }

    // Sidebar logo
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
    if (roleEl) roleEl.textContent = APP.STATE.user?.role === 'admin' ? 'Administrator' : 'Sales Staff';

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
    // Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => logout(false));

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        const container = document.getElementById('app-container');
        container.classList.toggle('sidebar-collapsed');
        localStorage.setItem('invoiceflow-sidebar-collapsed', container.classList.contains('sidebar-collapsed'));
      });
    }

    // Global Modal Closers
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-close-modal') || e.target.classList.contains('modal-overlay')) {
        const overlay = e.target.closest('.modal-overlay');
        if (overlay) overlay.classList.add('hidden');
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
  function showLoader() {
    let loader = document.getElementById('app-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'app-loader';
      loader.className = 'login-wrapper';
      loader.style.zIndex = '9999';
      loader.innerHTML = `
        <div style="text-align: center; color: var(--text-main);">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 3rem; color: var(--primary); margin-bottom: 16px;"></i>
          <h3 style="font-family: var(--font-header); font-weight: 600; font-size: 1.25rem;">Verifying Session...</h3>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;">Connecting to billing & inventory portal</p>
        </div>
      `;
      document.body.appendChild(loader);
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

  // API Request Wrapper
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

    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) throw new Error(data?.detail || data?.error || 'Request failed');
    return data;
  }

  // Toast Notifications
  function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    
    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-exclamation',
      info: 'fa-circle-info',
    };

    toast.innerHTML = `
      <i class="fa-solid ${icons[type]}"></i>
      <span class="toast-message">${esc(msg)}</span>
    `;

    container.appendChild(toast);

    // Slide in
    setTimeout(() => toast.classList.add('show'), 10);

    // Slide out and remove
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 3500);
  }

  // Formatter helpers
  function formatCurrency(val) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR',
    }).format(val || 0);
  }

  function formatDate(isoStr) {
    if (!isoStr) return '-';
    // Replace space with T to make it ISO compliant for Firefox/Safari
    const cleanStr = isoStr.replace(' ', 'T');
    const date = new Date(cleanStr.endsWith('Z') ? cleanStr : cleanStr + 'Z');
    return date.toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '-';
    const cleanStr = isoStr.replace(' ', 'T');
    const date = new Date(cleanStr.endsWith('Z') ? cleanStr : cleanStr + 'Z');
    return date.toLocaleString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  function esc(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ===========================================================================
  // Reusable Web Components (Custom Elements)
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
