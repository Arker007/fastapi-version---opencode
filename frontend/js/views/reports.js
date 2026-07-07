(() => {
  'use strict';

  const { api, formatCurrency, showToast, esc, setupLocalDropdown } = window.APP;

  const STATE = {
    currentReportType: 'daily_sales',
    _lastReport: null,
  };

  document.addEventListener('page-ready', () => {
    initReportsView();
    bindReportsEvents();
  });

  function initReportsView() {
    loadReport(STATE.currentReportType);
  }

  function bindReportsEvents() {
    // Dropdown selection trigger
    setupLocalDropdown('reports-dropdown-toggle', 'reports-dropdown-menu', (item) => {
      STATE.currentReportType = item.dataset.report;
      const label = document.getElementById('active-report-label');
      if (label) {
        label.textContent = item.textContent.trim();
      }
      
      loadReport(STATE.currentReportType);
    });


    window.APP.setupTableSearch('report-search', 'reports-tbody');

    const exportCsvBtn = document.getElementById('btn-export-report');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportReportCSV);

    const printReportBtn = document.getElementById('btn-print-report');
    if (printReportBtn) {
      printReportBtn.addEventListener('click', () => {
        const area = document.getElementById('report-print-area');
        if (!area) return;
        const titleText = document.getElementById('report-table-title')?.textContent || 'Report';
        const w = window.open('/print-invoice', '_blank');
        w.addEventListener('load', () => {
          w.document.getElementById('invoice-slot').innerHTML = `
            <div class="print-area">
              <div class="print-header" style="margin-bottom: 20px;">
                <div class="print-company">
                  <h2>${titleText}</h2>
                  <p>Generated on ${new Date().toLocaleDateString('en-IN')}</p>
                </div>
              </div>
              <hr class="print-divider" style="margin: 20px 0;">
              ${area.innerHTML}
            </div>
          `;
          setTimeout(() => w.print(), 500);
        });
      });
    }
  }

  async function loadReport(reportType) {
    try {
      const data = await api(`/api/reports/${reportType}`);

      // Update title
      document.getElementById('report-table-title').textContent = data.title;

      // Render headers
      const thead = document.getElementById('reports-thead');
      if (thead) {
        thead.innerHTML = '<tr>' + data.headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
      }

      // Determine which columns are monetary or counts based on header names
      const moneyHeaders = new Set();
      const pctHeaders = new Set();
      data.headers.forEach((h, i) => {
        const hl = h.toLowerCase();
        if (hl.includes('rate') || hl.includes('%')) {
          pctHeaders.add(i);
        } else if (hl.includes('count') || hl.includes('invoices') || hl.includes('purchases') || hl.includes('qty') || hl.includes('quantity')) {
          // Keep count columns as plain integers (do not format as currency)
        } else if (hl.includes('total') || hl.includes('amount') || hl.includes('revenue') ||
                   hl.includes('subtotal') || hl.includes('discount') || hl.includes('gst') ||
                   hl.includes('spent') || hl.includes('price') || hl.includes('net') ||
                   hl.includes('taxable') || hl.includes('tax')) {
          moneyHeaders.add(i);
        }
      });

      // Render rows
      const tbody = document.getElementById('reports-tbody');
      if (tbody) {
        if (!data.rows.length) {
          tbody.innerHTML = `<tr><td colspan="${data.headers.length}" style="text-align:center;color:var(--text-muted)">No data available</td></tr>`;
        } else {
          tbody.innerHTML = data.rows.map(row => {
            const values = Object.values(row);
            return '<tr>' + values.map((v, i) => {
              const displayVal = (v === null || v === undefined || v === '') ? '-' : v;
              if (moneyHeaders.has(i) && typeof v === 'number') {
                return `<td>${formatCurrency(v)}</td>`;
              }
              if (pctHeaders.has(i) && typeof v === 'number') {
                return `<td>${v}%</td>`;
              }
              if (typeof v === 'number') {
                return `<td>${v}</td>`;
              }
              return `<td>${esc(String(displayVal))}</td>`;
            }).join('') + '</tr>';
          }).join('');
        }
      }

      STATE._lastReport = data;
    } catch (err) {
      console.error('Report load error:', err);
    }
  }


  function exportReportCSV() {
    const report = STATE._lastReport;
    if (!report || !report.rows.length) return showToast('No data to export', 'error');

    const headers = report.headers;
    const rows = report.rows.map(r => Object.values(r));

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }



})();
