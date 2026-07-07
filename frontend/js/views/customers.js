(() => {
  'use strict';

  const { api, formatDate, formatCurrency, showToast, esc } = window.APP;

  const STATE = {
    customers: [],
  };

  document.addEventListener('page-ready', () => {
    initCustomersView();
    bindCustomersEvents();
  });

  async function initCustomersView() {
    await loadCustomers();
  }

  function bindCustomersEvents() {
    window.APP.setupTableSearch('customer-search', 'customers-tbody');

    // Register Customer modal trigger
    const addCustomerBtn = document.getElementById('btn-add-customer-modal');
    if (addCustomerBtn) addCustomerBtn.addEventListener('click', () => openCustomerModal());

    // Customer Form Submit
    const customerForm = document.getElementById('customer-form');
    if (customerForm) customerForm.addEventListener('submit', handleSaveCustomer);

    // Expose helpers globally for buttons
    window._editCustomer = (id) => editCustomer(id);
    window._deleteCustomer = (id) => deleteCustomer(id);
    window._viewCustomerHistory = (id) => viewCustomerHistory(id);
  }

  async function loadCustomers() {
    try {
      const customers = await api('/api/customers');
      STATE.customers = customers;
      renderCustomersTable();
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  }

  function renderCustomersTable() {
    const tbody = document.getElementById('customers-tbody');
    if (!tbody) return;
    const isAdmin = window.APP.STATE.user?.role === 'admin';

    if (!STATE.customers.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No customers registered</td></tr>';
      return;
    }

    tbody.innerHTML = STATE.customers.map(c => `
      <tr>
        <td><strong>${esc(c.name)}</strong></td>
        <td>${esc(c.phone)}</td>
        <td>${esc(c.email || '-')}</td>
        <td>${esc(c.address || '-')}</td>
        <td>${formatDate(c.created_at)}</td>
        <td>
          <div class="actions-dropdown-wrapper">
            <button class="btn-dots" onclick="window._toggleActionsMenu(this)"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            <div class="actions-dropdown-menu hidden">
              <button class="actions-dropdown-item" onclick="window._editCustomer(${c.id})">
                <i class="fa-solid fa-pen-to-square"></i> Edit
              </button>
              <button class="actions-dropdown-item" onclick="window._viewCustomerHistory(${c.id})">
                <i class="fa-solid fa-clock-rotate-left"></i> History
              </button>
              ${isAdmin ? `
                <button class="actions-dropdown-item text-danger" onclick="window._deleteCustomer(${c.id})">
                  <i class="fa-solid fa-trash-can"></i> Delete
                </button>
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function openCustomerModal(customer = null) {
    const modal = document.getElementById('customer-modal');
    const title = document.getElementById('customer-modal-title');
    if (!modal) return;

    if (customer) {
      title.textContent = 'Edit Customer';
      document.getElementById('customer-id').value = customer.id;
      document.getElementById('cust-name').value = customer.name;
      document.getElementById('cust-phone').value = customer.phone;
      document.getElementById('cust-email').value = customer.email || '';
      document.getElementById('cust-address').value = customer.address || '';
    } else {
      title.textContent = 'Register Customer';
      document.getElementById('customer-form').reset();
      document.getElementById('customer-id').value = '';
    }

    modal.classList.remove('hidden');
  }

  async function handleSaveCustomer(e) {
    e.preventDefault();
    const id = document.getElementById('customer-id').value;
    const body = {
      name: document.getElementById('cust-name').value.trim(),
      phone: document.getElementById('cust-phone').value.trim(),
      email: document.getElementById('cust-email').value.trim() || null,
      address: document.getElementById('cust-address').value.trim() || null,
    };

    try {
      if (id) {
        await api(`/api/customers/${id}`, { method: 'PUT', body });
      } else {
        await api('/api/customers', { method: 'POST', body });
      }
      document.getElementById('customer-modal')?.classList.add('hidden');
      loadCustomers();
      showToast(id ? 'Customer updated successfully!' : 'Customer registered successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function editCustomer(customerId) {
    const customer = STATE.customers.find(c => c.id === customerId);
    if (customer) openCustomerModal(customer);
  }

  async function deleteCustomer(customerId) {
    if (!confirm('Delete this customer?')) return;
    try {
      await api(`/api/customers/${customerId}`, { method: 'DELETE' });
      loadCustomers();
      showToast('Customer deleted successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function viewCustomerHistory(customerId) {
    try {
      const data = await api(`/api/customers/${customerId}/history`);
      const customer = data.customer;
      const invoices = data.invoices;

      document.getElementById('history-customer-name').textContent = `Customer: ${customer.name}`;

      const tbody = document.getElementById('history-tbody');
      if (tbody) {
        if (!invoices.length) {
          tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No purchase history</td></tr>';
        } else {
          tbody.innerHTML = invoices.map(inv => `
            <tr>
              <td><strong>${esc(inv.invoice_number)}</strong></td>
              <td>${formatDate(inv.created_at)}</td>
              <td>${formatCurrency(inv.total)}</td>
              <td><span class="status-badge ${inv.payment_status}">${inv.payment_status}</span></td>
            </tr>
          `).join('');
        }
      }

      document.getElementById('customer-history-modal')?.classList.remove('hidden');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

})();
