(() => {
  'use strict';

  const { api, formatCurrency, showToast, esc, setupLocalDropdown } = window.APP;

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
      populateProductSelect();
      populateCustomerSelect();
      renderCart();
    } catch (err) {
      console.error('Billing load error:', err);
      showToast('Failed to load billing data', 'error');
    }
  }

  function populateProductSelect() {
    const prodSelect = document.getElementById('billing-product-select');
    if (!prodSelect) return;
    prodSelect.innerHTML = '<option value="">-- Choose Product --</option>' +
      STATE.products.map(p =>
        `<option value="${p.id}">${esc(p.name)} (${esc(p.sku)})</option>`
      ).join('');

    // Also populate custom dropdown menu
    const menu = document.getElementById('billing-product-dropdown-menu');
    if (menu) {
      menu.innerHTML = '<button type="button" class="dropdown-item active" data-product="">-- Choose Product --</button>' +
        STATE.products.map(p =>
          `<button type="button" class="dropdown-item" data-product="${p.id}">${esc(p.name)} (${esc(p.sku)})</button>`
        ).join('');
      
      // Bind click events on custom dropdown items
      menu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          menu.classList.add('hidden');

          // Sync back to hidden native select
          const productId = item.dataset.product;
          prodSelect.value = productId;
          
          // Trigger change event programmatically so that billing.js event listener fires
          prodSelect.dispatchEvent(new Event('change'));

          // Update active dropdown label
          const label = document.getElementById('active-product-label');
          if (label) label.textContent = item.textContent.trim();
        });
      });
    }
  }


  function populateCustomerSelect() {
    const custSelect = document.getElementById('billing-customer-select');
    if (!custSelect) return;
    custSelect.innerHTML = '<option value="">-- Guest Customer --</option>' +
      STATE.customers.map(c =>
        `<option value="${c.id}">${esc(c.name)} (${esc(c.phone)})</option>`
      ).join('');

    // Also populate custom dropdown menu
    const menu = document.getElementById('billing-customer-dropdown-menu');
    if (menu) {
      menu.innerHTML = '<button type="button" class="dropdown-item active" data-customer="">-- Guest Customer --</button>' +
        STATE.customers.map(c =>
          `<button type="button" class="dropdown-item" data-customer="${c.id}">${esc(c.name)} (${esc(c.phone)})</button>`
        ).join('');
      
      // Bind click events on custom dropdown items
      menu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          menu.classList.add('hidden');

          // Sync back to hidden native select
          const customerId = item.dataset.customer;
          custSelect.value = customerId;
          
          // Trigger change event programmatically
          custSelect.dispatchEvent(new Event('change'));

          // Update active dropdown label
          const label = document.getElementById('active-customer-label');
          if (label) label.textContent = item.textContent.trim();
        });
      });
    }
  }


  function bindBillingEvents() {
    setupLocalDropdown('billing-product-dropdown-toggle', 'billing-product-dropdown-menu');
    setupLocalDropdown('billing-customer-dropdown-toggle', 'billing-customer-dropdown-menu');

    const productSelect = document.getElementById('billing-product-select');
    if (productSelect) {
      productSelect.addEventListener('change', () => {
        const product = STATE.products.find(p => p.id == productSelect.value);
        document.getElementById('billing-stock-display').textContent = product ? product.stock : '-';
        document.getElementById('billing-price-display').textContent = product ? formatCurrency(product.price) : '₹0.00';
      });
    }



    document.getElementById('btn-add-item')?.addEventListener('click', addItemToCart);
    document.getElementById('btn-checkout')?.addEventListener('click', handleCheckout);

    const discountInput = document.getElementById('bill-discount');
    if (discountInput) discountInput.addEventListener('input', updateCartSummary);

    document.getElementById('btn-quick-add-customer')?.addEventListener('click', () => openCustomerModal());
    document.getElementById('customer-form')?.addEventListener('submit', handleSaveCustomer);

    window._removeFromCart = (idx) => {
      STATE.cart.splice(idx, 1);
      sessionStorage.setItem('invoiceflow-draft-cart', JSON.stringify(STATE.cart));
      renderCart();
    };

    setupLocalDropdown('payment-dropdown-toggle', 'payment-dropdown-menu', (item) => {
      STATE.currentPaymentMethod = item.dataset.payment;
      document.getElementById('active-payment-label').textContent = item.textContent.trim();
      const refGroup = document.getElementById('transaction-ref-group');
      if (refGroup) {
        refGroup.classList.toggle('hidden', ['cash', 'credit'].includes(STATE.currentPaymentMethod));
      }
      const icons = { cash: 'fa-money-bill-wave', upi: 'fa-qrcode', card: 'fa-credit-card', credit: 'fa-handshake' };
      const indicator = document.getElementById('btn-payment-indicator');
      if (indicator) {
        indicator.innerHTML = `<i class="fa-solid ${icons[STATE.currentPaymentMethod] || 'fa-circle-question'}"></i> <span id="active-payment-label">${item.textContent.trim()}</span>`;
      }
    });

  }

  async function addItemToCart() {
    const productSelect = document.getElementById('billing-product-select');
    const qtyInput = document.getElementById('billing-qty');
    const productId = parseInt(productSelect?.value);
    const qty = parseInt(qtyInput?.value) || 1;

    if (!productId) return showToast('Please select a product', 'error');

    // Refresh product stock from server to avoid stale data
    try {
      const freshProducts = await api('/api/products');
      STATE.products = freshProducts;
      populateProductSelect(); // update dropdown options (optional)
    } catch (err) {
      showToast('Failed to verify stock, please try again', 'error');
      return;
    }

    const product = STATE.products.find(p => p.id === productId);
    if (!product) return showToast('Product not found', 'error');

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

    qtyInput.value = 1;
    productSelect.value = '';
    const activeLabel = document.getElementById('active-product-label');
    if (activeLabel) activeLabel.textContent = '-- Choose Product --';
    const menu = document.getElementById('billing-product-dropdown-menu');
    if (menu) {
      menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
      const def = menu.querySelector('[data-product=""]');
      if (def) def.classList.add('active');
    }
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
    let subtotal = 0, totalGst = 0;
    STATE.cart.forEach(item => {
      subtotal += item.total_price;
      totalGst += item.total_price * (item.gst_rate / 100);
    });
    const discount = parseFloat(document.getElementById('bill-discount')?.value) || 0;
    const total = Math.max(0, subtotal + totalGst - discount);
    document.getElementById('bill-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('bill-gst').value = formatCurrency(totalGst);
    document.getElementById('bill-total').textContent = formatCurrency(total);
  }

  async function handleCheckout() {
    if (!STATE.cart.length) return showToast('Please add items to the invoice', 'error');

    const subtotal = STATE.cart.reduce((acc, item) => acc + item.total_price, 0);
    const gst = STATE.cart.reduce((acc, item) => acc + (item.total_price * (item.gst_rate / 100)), 0);
    const discount = parseFloat(document.getElementById('bill-discount')?.value) || 0;
    const maxDiscount = subtotal + gst;

    // Validate discount
    if (discount < 0 || discount > maxDiscount) {
      return showToast(`Discount must be between 0 and ${formatCurrency(maxDiscount)}`, 'error');
    }

    const customerId = document.getElementById('billing-customer-select')?.value || null;
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
      STATE.cart = [];
      sessionStorage.removeItem('invoiceflow-draft-cart');
      document.getElementById('bill-discount').value = 0;
      document.getElementById('bill-ref').value = '';
      renderCart();
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

      const freshCustomers = await api('/api/customers');
      STATE.customers = freshCustomers;
      
      // Update select options and dropdown items
      populateCustomerSelect();

      // Automatically select the newly created customer
      const custSelect = document.getElementById('billing-customer-select');
      if (custSelect) {
        custSelect.value = newCust.id;
        custSelect.dispatchEvent(new Event('change'));
      }

      // Sync active styling on custom dropdown
      const menu = document.getElementById('billing-customer-dropdown-menu');
      if (menu) {
        menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
        const activeItem = menu.querySelector(`[data-customer="${newCust.id}"]`);
        if (activeItem) {
          activeItem.classList.add('active');
          const label = document.getElementById('active-customer-label');
          if (label) label.textContent = activeItem.textContent.trim();
        }
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }



})();