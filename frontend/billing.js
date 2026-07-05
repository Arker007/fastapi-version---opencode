(() => {
  'use strict';

  const { api, formatCurrency, showToast, esc } = window.APP;

  // Page level state
  const STATE = {
    products: [],
    customers: [],
    cart: JSON.parse(sessionStorage.getItem('invoiceflow-draft-cart')) || [],
    currentPaymentMethod: 'cash',
  };

  document.addEventListener('page-ready', () => {
    initBillingView();
    bindBillingEvents();
  });

  async function initBillingView() {
    try {
      const [products, customers] = await Promise.all([
        api('/api/products'),
        api('/api/customers'),
      ]);

      STATE.products = products;
      STATE.customers = customers;

      // Populate product select dropdown
      const prodSelect = document.getElementById('billing-product-select');
      if (prodSelect) {
        prodSelect.innerHTML = '<option value="">-- Choose Product --</option>' +
          products.map(p =>
            `<option value="${p.id}">${esc(p.name)} (${esc(p.sku)})</option>`
          ).join('');
      }

      // Populate customer select dropdown
      const custSelect = document.getElementById('billing-customer-select');
      if (custSelect) {
        custSelect.innerHTML = '<option value="">-- Guest Customer --</option>' +
          customers.map(c =>
            `<option value="${c.id}">${esc(c.name)} (${esc(c.phone)})</option>`
          ).join('');
      }

      renderCart();
    } catch (err) {
      console.error('Billing load error:', err);
    }
  }

  function bindBillingEvents() {
    // Product select change
    const productSelect = document.getElementById('billing-product-select');
    if (productSelect) {
      productSelect.addEventListener('change', () => {
        const product = STATE.products.find(p => p.id == productSelect.value);
        document.getElementById('billing-stock-display').textContent = product ? product.stock : '-';
        document.getElementById('billing-price-display').textContent = product ? formatCurrency(product.price) : '₹0.00';
      });
    }

    // Add item click
    const addItemBtn = document.getElementById('btn-add-item');
    if (addItemBtn) addItemBtn.addEventListener('click', addItemToCart);

    // Checkout click
    const checkoutBtn = document.getElementById('btn-checkout');
    if (checkoutBtn) checkoutBtn.addEventListener('click', handleCheckout);

    // Discount change
    const discountInput = document.getElementById('bill-discount');
    if (discountInput) discountInput.addEventListener('input', updateCartSummary);

    // Quick add customer button
    const quickAddCustomerBtn = document.getElementById('btn-quick-add-customer');
    if (quickAddCustomerBtn) {
      quickAddCustomerBtn.addEventListener('click', () => openCustomerModal());
    }

    // Customer Save Form
    const customerForm = document.getElementById('customer-form');
    if (customerForm) customerForm.addEventListener('submit', handleSaveCustomer);

    // Expose removeFromCart helper globally
    window._removeFromCart = (idx) => {
      STATE.cart.splice(idx, 1);
      sessionStorage.setItem('invoiceflow-draft-cart', JSON.stringify(STATE.cart));
      renderCart();
    };

    // Setup custom dropdown handlers for Payment Method
    setupLocalDropdown('payment-dropdown-toggle', 'payment-dropdown-menu', (item) => {
      STATE.currentPaymentMethod = item.dataset.payment;
      document.getElementById('active-payment-label').textContent = item.textContent.trim();
      const refGroup = document.getElementById('transaction-ref-group');
      if (refGroup) refGroup.classList.toggle('hidden', STATE.currentPaymentMethod === 'cash');
      
      const icons = { cash: 'fa-money-bill-wave', upi: 'fa-qrcode', card: 'fa-credit-card' };
      const indicator = document.getElementById('btn-payment-indicator');
      if (indicator) {
        indicator.innerHTML = `<i class="fa-solid ${icons[STATE.currentPaymentMethod]}"></i> <span id="active-payment-label">${item.textContent.trim()}</span>`;
      }
    });
  }

  function addItemToCart() {
    const productSelect = document.getElementById('billing-product-select');
    const qtyInput = document.getElementById('billing-qty');
    const productId = parseInt(productSelect?.value);
    const qty = parseInt(qtyInput?.value) || 1;

    if (!productId) return showToast('Please select a product', 'error');

    const product = STATE.products.find(p => p.id === productId);
    if (!product) return;

    // Check if already in cart
    const existing = STATE.cart.find(c => c.product_id === productId);
    const currentCartQty = existing ? existing.quantity : 0;

    if (currentCartQty + qty > product.stock) {
      return showToast(`Insufficient stock. Available: ${product.stock - currentCartQty}`, 'error');
    }

    if (existing) {
      existing.quantity += qty;
      existing.total_price = existing.unit_price * existing.quantity;
    } else {
      STATE.cart.push({
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        unit_price: product.price,
        quantity: qty,
        total_price: product.price * qty,
        gst_rate: product.gst_rate || 18,
      });
    }

    if (qtyInput) qtyInput.value = 1;
    if (productSelect) productSelect.value = '';
    
    // Clear displays
    document.getElementById('billing-stock-display').textContent = '-';
    document.getElementById('billing-price-display').textContent = '₹0.00';

    sessionStorage.setItem('invoiceflow-draft-cart', JSON.stringify(STATE.cart));
    renderCart();
  }

  function renderCart() {
    const tbody = document.getElementById('cart-tbody');
    if (!tbody) return;

    if (!STATE.cart.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Cart is empty</td></tr>';
      updateCartSummary();
      return;
    }

    tbody.innerHTML = STATE.cart.map((item, idx) => `
      <tr>
        <td><strong>${esc(item.name)}</strong><br><small style="color:var(--text-muted)">${esc(item.sku)}</small></td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.unit_price)}</td>
        <td>${formatCurrency(item.total_price)}</td>
        <td>
          <button class="btn btn-action delete-action btn-sm" onclick="window._removeFromCart(${idx})">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `).join('');

    updateCartSummary();
  }

  function updateCartSummary() {
    let subtotal = 0;
    let totalGst = 0;

    STATE.cart.forEach(item => {
      const itemGst = item.total_price * (item.gst_rate / 100);
      subtotal += item.total_price;
      totalGst += itemGst;
    });

    const discount = parseFloat(document.getElementById('bill-discount')?.value) || 0;
    const total = Math.max(0, subtotal + totalGst - discount);

    document.getElementById('bill-subtotal').textContent = formatCurrency(subtotal);
    const gstInput = document.getElementById('bill-gst');
    if (gstInput) gstInput.value = formatCurrency(totalGst);
    document.getElementById('bill-total').textContent = formatCurrency(total);
  }

  async function handleCheckout() {
    if (!STATE.cart.length) return showToast('Please add items to the invoice', 'error');

    const customerId = document.getElementById('billing-customer-select')?.value || null;
    const discount = parseFloat(document.getElementById('bill-discount')?.value) || 0;
    const transRef = document.getElementById('bill-ref')?.value || '';

    try {
      const result = await api('/api/invoices', {
        method: 'POST',
        body: {
          customer_id: customerId ? parseInt(customerId) : null,
          items: STATE.cart.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            gst_rate: item.gst_rate,
          })),
          discount,
          payment_method: STATE.currentPaymentMethod,
          transaction_reference: transRef,
        },
      });

      showToast(`Invoice ${result.invoice_number} created successfully!`);

      // Reset cart and clear cache
      STATE.cart = [];
      sessionStorage.removeItem('invoiceflow-draft-cart');
      if (document.getElementById('bill-discount')) document.getElementById('bill-discount').value = 0;
      if (document.getElementById('bill-ref')) document.getElementById('bill-ref').value = '';
      renderCart();

      // Redirect to invoices list and pass parameter to view this invoice
      window.location.href = `/invoices?view=${result.id}`;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function openCustomerModal() {
    document.getElementById('customer-modal-title').textContent = 'Register Customer';
    document.getElementById('customer-form').reset();
    document.getElementById('customer-id').value = '';
    document.getElementById('customer-modal')?.classList.remove('hidden');
  }

  async function handleSaveCustomer(e) {
    e.preventDefault();
    const body = {
      name: document.getElementById('cust-name').value.trim(),
      phone: document.getElementById('cust-phone').value.trim(),
      email: document.getElementById('cust-email').value.trim() || null,
      address: document.getElementById('cust-address').value.trim() || null,
    };

    try {
      const newCust = await api('/api/customers', { method: 'POST', body });
      document.getElementById('customer-modal')?.classList.add('hidden');
      showToast('Customer registered successfully!');
      
      // Reload customers and select the newly registered one
      const freshCustomers = await api('/api/customers');
      STATE.customers = freshCustomers;
      const custSelect = document.getElementById('billing-customer-select');
      if (custSelect) {
        custSelect.innerHTML = '<option value="">-- Guest Customer --</option>' +
          freshCustomers.map(c =>
            `<option value="${c.id}">${esc(c.name)} (${c.phone})</option>`
          ).join('');
        // Auto-select the newly created customer
        custSelect.value = newCust.id;
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Dropdown helper specific to this module
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
