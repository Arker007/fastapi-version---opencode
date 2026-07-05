(() => {
  'use strict';

  const { api, formatCurrency, formatDate, showToast, esc } = window.APP;

  document.addEventListener('page-ready', () => {
    initInvoicesView();
    bindInvoicesEvents();
  });

  async function initInvoicesView() {
    await loadInvoicesList();

    // Check if query param ?view=ID is present
    const params = new URLSearchParams(window.location.search);
    const invoiceId = params.get('view');
    if (invoiceId) {
      viewInvoice(invoiceId);
    }
  }

  function bindInvoicesEvents() {
    const invoiceSearch = document.getElementById('invoice-search');
    if (invoiceSearch) invoiceSearch.addEventListener('input', filterInvoiceList);

    // Print button
    const printInvoiceBtn = document.getElementById('btn-print-invoice');
    if (printInvoiceBtn) {
      printInvoiceBtn.addEventListener('click', () => {
        const content = document.getElementById('printable-invoice-content');
        if (!content) return;
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>Invoice</title>
          <link rel="stylesheet" href="style.css">
          <style>body{background:#fff;color:#000;padding:40px;font-family:'Inter',sans-serif}
          .print-area{max-width:800px;margin:auto} @media print{body{padding:0}}</style>
          </head><body>${content.outerHTML}<script>setTimeout(()=>window.print(),400)<\/script></body></html>`);
        w.document.close();
      });
    }

    // Expose viewInvoice helper globally so inline buttons can click it
    window._viewInvoice = (id) => {
      viewInvoice(id);
    };
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

  function filterInvoiceList() {
    const query = document.getElementById('invoice-search')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#invoices-list-tbody tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query) ? '' : 'none';
    });
  }

  async function viewInvoice(invoiceId) {
    try {
      const data = await api(`/api/invoices/${invoiceId}`);
      const inv = data.invoice;
      const items = data.items;
      const payment = data.payment;

      const settings = window.APP.STATE.settings || {};

      // Fill print template
      setText('p-invoice-num', inv.invoice_number);
      setText('p-invoice-date', formatDate(inv.created_at));
      const statusEl = document.getElementById('p-invoice-status');
      if (statusEl) {
        statusEl.textContent = inv.payment_status;
        statusEl.className = `status-badge ${inv.payment_status}`;
      }

      setText('p-customer-name', inv.customer_name || 'Guest Customer');
      setText('p-customer-phone', inv.customer_phone || '-');
      setText('p-customer-email', inv.customer_email || '-');
      setText('p-customer-address', inv.customer_address || '-');
      setText('p-billed-by', inv.billed_by);

      // Company info in print header
      const companyH2 = document.querySelector('.print-company h2');
      const companyPs = document.querySelectorAll('.print-company p');
      if (companyH2) companyH2.textContent = (settings.company_name || 'INVOICEFLOW').toUpperCase();
      if (companyPs[0]) companyPs[0].textContent = 'Billing and Inventory Management Solutions';
      if (companyPs[1]) companyPs[1].textContent = settings.company_address || '';

      // Logo
      const logoContainer = document.getElementById('print-logo-container');
      if (logoContainer && settings.company_logo) {
        logoContainer.classList.remove('hidden');
        logoContainer.innerHTML = `<img src="${settings.company_logo}" alt="Logo" style="max-height:60px;max-width:120px;">`;
      } else if (logoContainer) {
        logoContainer.classList.add('hidden');
      }

      // Items table
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

      // Payment info
      setText('p-payment-method', payment?.payment_method?.toUpperCase() || '-');
      setText('p-payment-ref', payment?.transaction_reference || '-');

      // Totals
      setText('p-subtotal', formatCurrency(inv.subtotal));
      setText('p-discount', formatCurrency(inv.discount));
      setText('p-gst', formatCurrency(inv.gst));
      setText('p-total', formatCurrency(inv.total));

      // Print footer
      const footerPs = document.querySelectorAll('.print-footer p');
      if (footerPs[1]) footerPs[1].textContent = `For support, contact ${settings.company_email || 'support@invoiceflow.com'}`;

      // Show modal
      document.getElementById('invoice-modal')?.classList.remove('hidden');
    } catch (err) {
      showToast('Error loading invoice: ' + err.message, 'error');
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '-';
  }

})();
