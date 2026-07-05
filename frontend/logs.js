(() => {
  'use strict';

  const { api, formatDateTime, esc } = window.APP;

  document.addEventListener('page-ready', () => {
    initLogsView();
  });

  async function initLogsView() {
    await loadLogs();
  }

  async function loadLogs() {
    try {
      const logs = await api('/api/admin/logs');
      const tbody = document.getElementById('logs-tbody');
      if (!tbody) return;

      if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No logs recorded</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map(l => `
        <tr>
          <td>${formatDateTime(l.created_at)}</td>
          <td>${esc(l.username)}</td>
          <td><span class="status-badge paid">${esc(l.action)}</span></td>
          <td>${esc(l.details || '-')}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  }

})();
