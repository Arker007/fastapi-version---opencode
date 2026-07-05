(() => {
  'use strict';

  const { api, showToast, esc, setupLocalDropdown } = window.APP;

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

    // Dropdown for Default GST slab select
    setupLocalDropdown('settings-default-gst-toggle', 'settings-default-gst-menu', (item) => {
      const select = document.getElementById('settings-default-gst');
      if (select) {
        select.value = item.dataset.gst;
        select.dispatchEvent(new Event('change'));
      }
      const label = document.getElementById('active-default-gst-label');
      if (label) {
        label.textContent = item.textContent.trim();
      }
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

    // Close action dropdowns on clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.actions-dropdown-wrapper')) {
        document.querySelectorAll('.actions-dropdown-menu').forEach(m => m.classList.add('hidden'));
      }
    });

    // Expose helpers globally
    window._deleteUser = (id) => deleteUser(id);
    window._resetPassword = (id, username) => resetPassword(id, username);
  }


  function renderAdminUsers(users) {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${esc(u.fullname)}</td>
        <td><code>${esc(u.username)}</code></td>
        <td><span class="status-badge ${u.role === 'admin' ? 'paid' : 'pending'}">${u.role}</span></td>
        <td>
          <div class="actions-dropdown-wrapper">
            <button type="button" class="btn-dots" onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('hidden')">
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
            <div class="actions-dropdown-menu hidden">
              <button class="actions-dropdown-item" onclick="window._resetPassword(${u.id}, '${esc(u.username)}')">
                <i class="fa-solid fa-key"></i> Reset Password
              </button>
              ${u.id !== window.APP.STATE.user?.id ? `
                <button class="actions-dropdown-item text-danger" onclick="window._deleteUser(${u.id})">
                  <i class="fa-solid fa-trash-can"></i> Delete
                </button>
              ` : ''}
            </div>
          </div>
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
      document.getElementById('active-admin-role-label').textContent = 'Staff';

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
    
    const defaultGst = settings.default_gst || '18';
    setVal('settings-default-gst', 'default_gst');
    const label = document.getElementById('active-default-gst-label');
    if (label) {
      const slabLabels = { '0': '0% (Exempted)', '5': '5%', '12': '12%', '18': '18%', '28': '28%' };
      label.textContent = slabLabels[defaultGst] || `${defaultGst}%`;
    }
    const menu = document.getElementById('settings-default-gst-menu');
    if (menu) {
      menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
      const activeItem = menu.querySelector(`[data-gst="${defaultGst}"]`);
      if (activeItem) activeItem.classList.add('active');
    }


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

  async function resetPassword(userId, username) {
    const newPass = prompt(`Enter new password for user '${username}':`);
    if (newPass === null) return;
    if (newPass.trim().length < 4) {
      return showToast('Password must be at least 4 characters long', 'error');
    }
    
    try {
      await api(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        body: { new_password: newPass.trim() }
      });
      showToast(`Password for '${username}' reset successfully!`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
})();
