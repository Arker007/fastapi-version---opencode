# TODO
- [x] Patch `frontend/js/views/dashboard.js` to dynamically load Chart.js if `window.Chart` is missing.
- [x] Make KPI element updates null-safe to prevent `Cannot set properties of null`.
- [x] Guard chart rendering so it only runs after Chart.js is available.
- [ ] Quick manual test: navigate to Dashboard and verify charts + KPIs render without console errors (ensure charts display).
