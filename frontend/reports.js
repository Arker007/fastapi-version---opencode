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


    const reportSearch = document.getElementById('report-search');
    if (reportSearch) reportSearch.addEventListener('input', filterReportTable);

    const exportCsvBtn = document.getElementById('btn-export-report');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportReportCSV);

    const printReportBtn = document.getElementById('btn-print-report');
    if (printReportBtn) {
      printReportBtn.addEventListener('click', () => {
        const area = document.getElementById('report-print-area');
        if (!area) return;
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>Report</title>
          <link rel="stylesheet" href="style.css">
          <style>body{background:#fff;color:#000;padding:40px;font-family:'Inter',sans-serif}
          table{width:100%;border-collapse:collapse}th,td{padding:8px 12px;border:1px solid #ddd;text-align:left;font-size:12px}
          th{background:#f5f5f5} @media print{body{padding:0}}</style>
          </head><body><h2>${document.getElementById('report-table-title')?.textContent || 'Report'}</h2>${area.outerHTML}
          <script>setTimeout(()=>window.print(),400)<\/script></body></html>`);
        w.document.close();
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

  function filterReportTable() {
    const query = document.getElementById('report-search')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#reports-tbody tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query) ? '' : 'none';
    });
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
