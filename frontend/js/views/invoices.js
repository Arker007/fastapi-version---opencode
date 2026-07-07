(() => {
  'use strict';

  const { api, formatCurrency, formatDate, showToast, esc } = window.APP;

  document.addEventListener('page-ready', () => {
    initInvoicesView();
    bindInvoicesEvents();
  });

  async function initInvoicesView() {
    await loadInvoicesList();
    const params = new URLSearchParams(window.location.search);
    const invoiceId = params.get('view');
    if (invoiceId) viewInvoice(invoiceId);
  }

  function bindInvoicesEvents() {
    window.APP.setupTableSearch('invoice-search', 'invoices-list-tbody');
    document.getElementById('btn-print-invoice')?.addEventListener('click', printInvoice);
    document.getElementById('btn-collect-payment')?.addEventListener('click', handleCollectPayment);
    window._viewInvoice = (id) => viewInvoice(id);
  }

  async function handleCollectPayment() {


    const btn = document.getElementById('btn-collect-payment');
    const invoiceId = btn.dataset.invoiceId;
    const total = parseFloat(btn.dataset.total) || 0;

    const method = prompt(`Collect payment of ${formatCurrency(total)}. Enter payment method (cash):`, "cash");
    if (!method) return;

    const cleanMethod = method.trim().toLowerCase();
    if (!['cash'].includes(cleanMethod)) {
      alert("Invalid payment method! Please enter cash.");
      return;
    }

    const ref = prompt("Enter transaction reference (Optional):", "");

    try {
      await api(`/api/invoices/${invoiceId}/pay`, {
        method: 'POST',
        body: {
          amount: total,
          payment_method: cleanMethod,
          transaction_reference: ref || null
        }
      });
      showToast("Payment recorded successfully!");
      document.getElementById('invoice-modal')?.classList.add('hidden');
      loadInvoicesList();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }


  async function loadInvoicesList() {
    try {
      const invoices = await api('/api/invoices');
      renderInvoicesTable(invoices);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    }
  }

  function renderInvoicesTable(invoices) {
    const tbody = document.getElementById('invoices-list-tbody');
    if (!tbody) return;

    if (!invoices.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">No invoices found</td></tr>';
      return;
    }

    tbody.innerHTML = invoices.map(inv => `
      <tr>
        <td><strong>${esc(inv.invoice_number)}</strong></td>
        <td>${esc(inv.customer_name || 'Guest Customer')}</td>
        <td>${formatCurrency(inv.subtotal)}</td>
        <td>${formatCurrency(inv.discount)}</td>
        <td>${formatCurrency(inv.gst)}</td>
        <td><strong>${formatCurrency(inv.total)}</strong></td>
        <td>${esc(inv.billed_by)}</td>
        <td>${formatDate(inv.created_at)}</td>
        <td>
          <button class="btn btn-action btn-sm" onclick="window._viewInvoice(${inv.id})" title="View Invoice">
            <i class="fa-solid fa-eye"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }


  async function viewInvoice(invoiceId) {
    try {
      const data = await api(`/api/invoices/${invoiceId}`);
      const inv = data.invoice;
      const items = data.items || [];
      const payment = data.payment || null;

      const settings = window.APP.STATE.settings || {};

      setText('p-invoice-num', inv.invoice_number);
      setText('p-invoice-date', formatDate(inv.created_at));
      const statusEl = document.getElementById('p-invoice-status');
      if (statusEl) {
        statusEl.textContent = inv.payment_status.toUpperCase();
        statusEl.className = `status-badge ${inv.payment_status}`;
      }

      // Show or hide the Collect Payment button based on invoice status
      const collectBtn = document.getElementById('btn-collect-payment');
      if (collectBtn) {
        if (inv.payment_status === 'unpaid' || inv.payment_status === 'pending') {
          collectBtn.classList.remove('hidden');
          collectBtn.dataset.invoiceId = invoiceId;
          collectBtn.dataset.total = inv.total;
        } else {
          collectBtn.classList.add('hidden');
        }
      }


      setText('p-customer-name', inv.customer_name || 'Guest Customer');
      setText('p-customer-phone', inv.customer_phone || '-');
      setText('p-customer-email', inv.customer_email || '-');
      setText('p-customer-address', inv.customer_address || '-');
      setText('p-billed-by', inv.billed_by);
      setText('p-billing-terminal', settings.billing_terminal || 'Dehradun Main Store');
      setText('p-tax-label', settings.tax_label || 'GST');

      const companyH2 = document.querySelector('.print-company h2');
      const companyPs = document.querySelectorAll('.print-company p');
      if (companyH2) companyH2.textContent = (settings.company_name || 'INVOICEFLOW').toUpperCase();
      if (companyPs[0]) companyPs[0].textContent = 'Billing and Inventory Management Solutions';
      if (companyPs[1]) companyPs[1].textContent = settings.company_address || '';

      const logoContainer = document.getElementById('print-logo-container');
      if (logoContainer && settings.company_logo) {
        logoContainer.classList.remove('hidden');
        logoContainer.innerHTML = `<img src="${settings.company_logo}" alt="Logo" style="max-height:60px;max-width:120px;">`;
      } else if (logoContainer) {
        logoContainer.classList.add('hidden');
      }

      const itemsTbody = document.getElementById('p-items-tbody');
      if (itemsTbody) {
        itemsTbody.innerHTML = items.map(item => `
          <tr>
            <td>${esc(item.product_sku || '-')}</td>
            <td>${esc(item.product_name || 'Unknown')}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.unit_price)}</td>
            <td>${formatCurrency(item.total_price)}</td>
          </tr>
        `).join('');
      }

      const paymentMethod = payment?.payment_method ? payment.payment_method.toUpperCase() : '-';
      setText('p-payment-method', paymentMethod);
      setText('p-payment-ref', payment?.transaction_reference || '-');

      setText('p-subtotal', formatCurrency(inv.subtotal));
      setText('p-discount', formatCurrency(inv.discount));
      setText('p-gst', formatCurrency(inv.gst));
      setText('p-total', formatCurrency(inv.total));

      const footerPs = document.querySelectorAll('.print-footer p');
      if (footerPs[0]) footerPs[0].textContent = settings.invoice_terms || 'Thank you for your business!';
      if (footerPs[1]) footerPs[1].textContent = `For support, contact ${settings.company_email || 'support@invoiceflow.com'}`;

      document.getElementById('invoice-modal')?.classList.remove('hidden');
    } catch (err) {
      showToast('Error loading invoice: ' + err.message, 'error');
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '-';
  }

  function printInvoice() {
    const content = document.getElementById('printable-invoice-content');
    if (!content) return;
    const w = window.open('/print-invoice', '_blank');
    w.addEventListener('load', () => {
      w.document.getElementById('invoice-slot').innerHTML = content.outerHTML;
      setTimeout(() => w.print(), 500);
    });
  }
})();