(() => {
  'use strict';

  const { api } = window.APP;

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    // Check settings for company logo if available in local cache (optional settings fallback)
    try {
      api('/api/settings')
        .then(settings => {
          if (settings && settings.company_logo) {
            const loginLogo = document.getElementById('login-logo-container');
            if (loginLogo) {
              loginLogo.classList.remove('hidden');
              loginLogo.innerHTML = `<img src="${settings.company_logo}" alt="Logo" style="max-height:50px;max-width:120px;object-fit:contain;">`;
            }
          }
        }).catch(() => {});
    } catch (_) {}
  });

  async function handleLogin(e) {
    e.preventDefault();
    hideLoginError();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      localStorage.setItem('invoiceflow-token', data.token);
      window.location.href = '/dashboard';
    } catch (err) {
      showLoginError(err.message);
    }
  }

  function showLoginError(msg) {
    const el = document.getElementById('login-error');
    const txt = document.getElementById('error-text');
    if (el) el.classList.remove('hidden');
    if (txt) txt.textContent = msg;
  }

  function hideLoginError() {
    const el = document.getElementById('login-error');
    if (el) el.classList.add('hidden');
  }

})();
