(() => {
  'use strict';

  const { api, showToast, esc } = window.APP;

  document.addEventListener('page-ready', () => {
    initAdminPanel();
    bindAdminEvents();
  });

  async function initAdminPanel() {
    try {
      const [users, settings] = await Promise.all([
        api('/api/admin/users'),
        api('/api/settings'),
      ]);
      renderAdminUsers(users);
      populateSettingsForm(settings);
    } catch (err) {
      console.error('Failed to load admin panel data:', err);
    }
  }

  function bindAdminEvents() {
    // Create user form
    const adminUserForm = document.getElementById('admin-create-user-form');
    if (adminUserForm) adminUserForm.addEventListener('submit', handleCreateUser);

    // Settings form
    const settingsForm = document.getElementById('admin-settings-form');
    if (settingsForm) settingsForm.addEventListener('submit', handleSaveSettings);

    // Dropdown for Role select
    setupLocalDropdown('admin-role-dropdown-toggle', 'admin-role-dropdown-menu', (item) => {
      document.getElementById('active-admin-role-label').textContent = item.textContent.trim();
      document.getElementById('admin-user-role-id').value = item.dataset.role;
    });

    // Password visibility toggle
    const togglePwBtn = document.getElementById('toggle-create-password');
    if (togglePwBtn) {
      togglePwBtn.addEventListener('click', () => {
        const input = document.getElementById('admin-user-password');
        if (input.type === 'password') {
          input.type = 'text';
          togglePwBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
        } else {
          input.type = 'password';
          togglePwBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
        }
      });
    }

    // Logo upload
    const logoTrigger = document.getElementById('btn-upload-logo-trigger');
    const logoInput = document.getElementById('settings-company-logo-input');
    if (logoTrigger && logoInput) {
      logoTrigger.addEventListener('click', () => logoInput.click());
      logoInput.addEventListener('change', handleLogoUpload);
    }

    // Remove logo
    const removeLogoBtn = document.getElementById('btn-remove-logo');
    if (removeLogoBtn) {
      removeLogoBtn.addEventListener('click', () => {
        document.getElementById('settings-company-logo-base64').value = '';
        document.getElementById('settings-logo-preview').innerHTML =
          '<i class="fa-solid fa-cloud-arrow-up uploader-icon"></i><span class="uploader-text">Upload</span>';
        removeLogoBtn.classList.add('hidden');
      });
    }

    // Expose helpers globally
    window._deleteUser = (id) => deleteUser(id);
  }

  function renderAdminUsers(users) {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${esc(u.fullname)}</td>
        <td><code>${esc(u.username)}</code></td>
        <td><span class="status-badge ${u.role === 'admin' ? 'paid' : 'pending'}">${u.role}</span></td>
        <td>${u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '-'}</td>
        <td>
          ${u.id !== window.APP.STATE.user?.id ? `
            <button class="btn btn-action delete-action btn-sm" onclick="window._deleteUser(${u.id})" title="Delete">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : '<span style="color:var(--text-muted);font-size:0.8rem">Current</span>'}
        </td>
      </tr>
    `).join('');
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    const body = {
      fullname: document.getElementById('admin-user-fullname').value.trim(),
      username: document.getElementById('admin-user-username').value.trim(),
      password: document.getElementById('admin-user-password').value,
      role: document.getElementById('admin-user-role-id').value || 'staff',
    };

    try {
      await api('/api/admin/users', { method: 'POST', body });
      document.getElementById('admin-create-user-form')?.reset();
      document.getElementById('admin-user-role-id').value = 'staff';
      document.getElementById('active-admin-role-label').textContent = 'Sales Staff';
      initAdminPanel();
      showToast('User created successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteUser(userId) {
    if (!confirm('Delete this user account?')) return;
    try {
      await api(`/api/admin/users/${userId}`, { method: 'DELETE' });
      initAdminPanel();
      showToast('User deleted successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function populateSettingsForm(settings) {
    const setVal = (id, key) => {
      const el = document.getElementById(id);
      if (el) el.value = settings[key] || '';
    };
    setVal('settings-company-name', 'company_name');
    setVal('settings-company-address', 'company_address');
    setVal('settings-company-phone', 'company_phone');
    setVal('settings-company-email', 'company_email');
    setVal('settings-default-gst', 'default_gst');

    // Logo preview
    if (settings.company_logo) {
      const preview = document.getElementById('settings-logo-preview');
      if (preview) {
        preview.innerHTML = `<img src="${settings.company_logo}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:4px;">`;
      }
      document.getElementById('settings-company-logo-base64').value = settings.company_logo;
      document.getElementById('btn-remove-logo')?.classList.remove('hidden');
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    const settingsObj = {
      company_name: document.getElementById('settings-company-name')?.value.trim() || '',
      company_address: document.getElementById('settings-company-address')?.value.trim() || '',
      company_phone: document.getElementById('settings-company-phone')?.value.trim() || '',
      company_email: document.getElementById('settings-company-email')?.value.trim() || '',
      default_gst: document.getElementById('settings-default-gst')?.value || '18',
      company_logo: document.getElementById('settings-company-logo-base64')?.value || '',
    };

    try {
      await api('/api/settings', { method: 'PUT', body: { settings: settingsObj } });
      window.APP.STATE.settings = settingsObj;
      showToast('Settings saved successfully!');

      // Update brand title locally
      const brandTitle = document.getElementById('sidebar-brand-title');
      if (brandTitle && settingsObj.company_name) {
        brandTitle.textContent = settingsObj.company_name.split(' ')[0] || 'InvoiceFlow';
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) return showToast('Logo must be under 500KB', 'error');

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      document.getElementById('settings-company-logo-base64').value = base64;
      const preview = document.getElementById('settings-logo-preview');
      if (preview) {
        preview.innerHTML = `<img src="${base64}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:4px;">`;
      }
      document.getElementById('btn-remove-logo')?.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  // Local Dropdown Helper
  function setupLocalDropdown(toggleId, menuId, onSelect) {
    const toggle = document.getElementById(toggleId);
    const menu = document.getElementById(menuId);
    if (!toggle || !menu) return;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item) return;
      menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      menu.classList.add('hidden');
      if (onSelect) onSelect(item);
    });

    document.addEventListener('click', () => menu.classList.add('hidden'));
  }

})();
