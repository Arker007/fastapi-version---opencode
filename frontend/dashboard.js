(() => {
  'use strict';

  const { api, formatCurrency, esc } = window.APP;

  // Local chart instances
  let salesChart = null;
  let categoryChart = null;

  document.addEventListener('page-ready', () => {
    loadDashboard();
  });

  async function loadDashboard() {
    try {
      const [summary, salesData, categoryData, topProducts, recentInvoices] = await Promise.all([
        api('/api/dashboard/summary'),
        api('/api/dashboard/sales-chart'),
        api('/api/dashboard/category-chart'),
        api('/api/dashboard/top-products'),
        api('/api/dashboard/recent-invoices'),
      ]);

      // KPIs
      document.getElementById('kpi-sales').textContent = formatCurrency(summary.totalSales);
      document.getElementById('kpi-bills').textContent = summary.invoiceCount;
      document.getElementById('kpi-products').textContent = summary.productCount;
      document.getElementById('kpi-low-stock').textContent = summary.lowStockCount;

      // Low stock warning card
      const lowCard = document.getElementById('kpi-low-stock-card');
      if (lowCard) {
        lowCard.classList.toggle('warning-card', summary.lowStockCount > 0);
        // Clicking low stock KPI redirects to products tab/page
        lowCard.style.cursor = 'pointer';
        lowCard.onclick = () => window.location.href = '/products';
      }

      // Render charts
      renderSalesChart(salesData);
      renderCategoryChart(categoryData);
      renderTopProducts(topProducts);
      renderRecentInvoices(recentInvoices);
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  }

  function renderSalesChart(data) {
    const ctx = document.getElementById('salesChart')?.getContext('2d');
    if (!ctx) return;
    if (salesChart) salesChart.destroy();

    const labels = data.map(d => {
      const dt = new Date(d.date);
      return dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    });
    const values = data.map(d => d.total);

    salesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Sales (₹)',
          data: values,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#0ea5e9',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#a1a1aa', font: { size: 11 } } },
          y: { grid: { color: 'rgba(39,39,42,0.3)' }, ticks: { color: '#a1a1aa', font: { size: 11 } } },
        },
      },
    });
  }

  function renderCategoryChart(data) {
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx) return;
    if (categoryChart) categoryChart.destroy();

    if (!data.length) {
      categoryChart = null;
      return;
    }

    const colors = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.category),
        datasets: [{
          data: data.map(d => d.total),
          backgroundColor: colors.slice(0, data.length),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#a1a1aa', font: { size: 12 }, padding: 16 } },
        },
      },
    });
  }

  function renderTopProducts(data) {
    const tbody = document.getElementById('top-products-tbody');
    if (!tbody) return;
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No sales data yet</td></tr>';
      return;
    }
    // Fixed columns alignment matching header: Product, Category, Sold Qty, Revenue
    tbody.innerHTML = data.map(p => `
      <tr>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.category_name || '-')}</td>
        <td>${p.qty_sold}</td>
        <td>${formatCurrency(p.revenue)}</td>
      </tr>
    `).join('');
  }

  function renderRecentInvoices(data) {
    const tbody = document.getElementById('recent-invoices-tbody');
    if (!tbody) return;
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No invoices yet</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(inv => `
      <tr>
        <td><strong>${esc(inv.invoice_number)}</strong></td>
        <td>${esc(inv.customer_name || 'Guest Customer')}</td>
        <td>${formatCurrency(inv.total)}</td>
        <td>
          <button class="btn btn-action btn-sm" onclick="window.location.href='/invoices?view=${inv.id}'" title="View Invoice">
            <i class="fa-solid fa-eye"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

})();
