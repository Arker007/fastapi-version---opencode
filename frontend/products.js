(() => {
  'use strict';

  const { api, formatCurrency, showToast, esc } = window.APP;

  const STATE = {
    products: [],
    categories: [],
  };

  document.addEventListener('page-ready', () => {
    initProductsView();
    bindProductsEvents();
  });

  async function initProductsView() {
    await loadProducts();
  }

  function bindProductsEvents() {
    // Tab switching inside products view
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        const target = document.getElementById(btn.dataset.tab);
        if (target) target.classList.remove('hidden');
      });
    });

    // New Product modal trigger
    const addProductBtn = document.getElementById('btn-add-product-modal');
    if (addProductBtn) addProductBtn.addEventListener('click', () => openProductModal());

    // Product Form Submit
    const productForm = document.getElementById('product-form');
    if (productForm) productForm.addEventListener('submit', handleSaveProduct);

    // Location filter dropdown
    setupLocalDropdown('location-dropdown-toggle', 'location-dropdown-menu', (item) => {
      document.getElementById('active-location-label').textContent = item.textContent.trim();
      document.getElementById('location-dropdown-toggle').dataset.filter = item.dataset.filter;
      renderProductsTable();
    });

    // Hide out of stock toggle
    const oosToggle = document.getElementById('btn-toggle-out-of-stock');
    if (oosToggle) {
      oosToggle.addEventListener('click', () => {
        const active = oosToggle.dataset.active === 'true';
        oosToggle.dataset.active = (!active).toString();
        oosToggle.innerHTML = active
          ? '<i class="fa-solid fa-eye-slash"></i> Hide Out of Stock'
          : '<i class="fa-solid fa-eye"></i> Show Out of Stock';
        renderProductsTable();
      });
    }

    // Category Add Form Submit
    const categoryForm = document.getElementById('category-form');
    if (categoryForm) categoryForm.addEventListener('submit', handleCreateCategory);

    // Category Edit Form Submit
    const categoryEditForm = document.getElementById('category-edit-form');
    if (categoryEditForm) categoryEditForm.addEventListener('submit', handleUpdateCategory);

    // Dynamic product category selection dropdown
    setupLocalDropdown('category-dropdown-toggle', 'category-dropdown-menu', (item) => {
      document.getElementById('active-category-label').textContent = item.textContent.trim();
      document.getElementById('prod-category-id').value = item.dataset.catId || '';
    });

    // Actions dropdown toggler helper
    window._toggleActionsMenu = (btn) => {
      document.querySelectorAll('.actions-dropdown-menu').forEach(m => {
        if (m !== btn.nextElementSibling) m.classList.add('hidden');
      });
      const menu = btn.nextElementSibling;
      if (menu) menu.classList.toggle('hidden');
    };

    // Close actions menus when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.actions-dropdown-wrapper')) {
        document.querySelectorAll('.actions-dropdown-menu').forEach(m => m.classList.add('hidden'));
      }
    });

    // Expose helpers globally for buttons
    window._editProduct = (id) => editProduct(id);
    window._deleteProduct = (id) => deleteProduct(id);
    window._deleteCategory = (id) => deleteCategory(id);
  }

  async function loadProducts() {
    try {
      const [products, categories] = await Promise.all([
        api('/api/products'),
        api('/api/categories'),
      ]);

      STATE.products = products;
      STATE.categories = categories;

      renderProductsTable();
      renderCategoriesTable();
      populateCategorySelector();
    } catch (err) {
      console.error('Failed to load products/categories:', err);
    }
  }

  function renderProductsTable() {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;
    const isAdmin = window.APP.STATE.user?.role === 'admin';

    // Get active location filter
    const activeLocation = document.getElementById('location-dropdown-toggle')?.dataset.filter || 'all';

    // Get active out-of-stock visibility toggle
    const hideOos = document.getElementById('btn-toggle-out-of-stock')?.dataset.active === 'true';

    // Filter products
    let filtered = STATE.products;
    if (activeLocation !== 'all') {
      filtered = filtered.filter(p => p.location === activeLocation);
    }
    if (hideOos) {
      filtered = filtered.filter(p => p.stock > 0);
    }

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="${isAdmin ? 8 : 7}" style="text-align:center;color:var(--text-muted)">No products found</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const isLowStock = p.stock <= p.min_stock;
      const stockStatusHtml = isLowStock
        ? `<span class="stock-badge low-stock">${p.stock} (Low)</span>`
        : `<span class="stock-badge in-stock">${p.stock} In Stock</span>`;

      // Render location tag in category column
      const locationLabels = { storefront: 'Storefront', warehouse: 'Warehouse' };
      const locText = locationLabels[p.location] || 'Storefront';
      const locBadge = `<span class="stock-badge" style="margin-left: 8px; font-size: 0.68rem; padding: 2px 6px; border: 0; background: var(--secondary); color: var(--text-muted); font-weight:600;">${locText}</span>`;

      return `
        <tr>
          <td><code>${esc(p.sku)}</code></td>
          <td><strong>${esc(p.name)}</strong></td>
          <td>${esc(p.category_name || '-')}${locBadge}</td>
          <td>${formatCurrency(p.price)}</td>
          <td>${p.gst_rate}%</td>
          <td>${stockStatusHtml}</td>
          <td>${p.min_stock}</td>
          ${isAdmin ? `
            <td>
              <div class="actions-dropdown-wrapper">
                <button class="btn-dots" onclick="window._toggleActionsMenu(this)"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                <div class="actions-dropdown-menu hidden">
                  <button class="actions-dropdown-item" onclick="window._editProduct(${p.id})">
                    <i class="fa-solid fa-pen-to-square"></i> Edit
                  </button>
                  <button class="actions-dropdown-item text-danger" onclick="window._deleteProduct(${p.id})">
                    <i class="fa-solid fa-trash-can"></i> Delete
                  </button>
                </div>
              </div>
            </td>
          ` : ''}
        </tr>
      `;
    }).join('');
  }

  function renderCategoriesTable() {
    const tbody = document.getElementById('categories-tbody');
    if (!tbody) return;
    const isAdmin = window.APP.STATE.user?.role === 'admin';

    if (!STATE.categories.length) {
      tbody.innerHTML = `<tr><td colspan="${isAdmin ? 3 : 2}" style="text-align:center;color:var(--text-muted)">No categories</td></tr>`;
      return;
    }

    tbody.innerHTML = STATE.categories.map(c => `
      <tr>
        <td><strong>${esc(c.name)}</strong></td>
        <td>${esc(c.description || '-')}</td>
        ${isAdmin ? `
          <td>
            <div class="actions-dropdown-wrapper">
              <button class="btn-dots" onclick="window._toggleActionsMenu(this)"><i class="fa-solid fa-ellipsis-vertical"></i></button>
              <div class="actions-dropdown-menu hidden">
                <button class="actions-dropdown-item" data-edit-cat-id="${c.id}">
                  <i class="fa-solid fa-pen-to-square"></i> Edit
                </button>
                <button class="actions-dropdown-item text-danger" onclick="window._deleteCategory(${c.id})">
                  <i class="fa-solid fa-trash-can"></i> Delete
                </button>
              </div>
            </div>
          </td>
        ` : ''}
      </tr>
    `).join('');

    // Bind edit buttons dynamically
    tbody.querySelectorAll('[data-edit-cat-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = parseInt(btn.dataset.editCatId);
        const cat = STATE.categories.find(c => c.id === catId);
        if (cat) editCategory(catId, cat.name, cat.description || '');
      });
    });
  }

  function populateCategorySelector() {
    const menu = document.getElementById('category-dropdown-menu');
    if (!menu) return;

    menu.innerHTML = '<button type="button" class="dropdown-item active" data-cat-id="">-- No Category --</button>' +
      STATE.categories.map(c =>
        `<button type="button" class="dropdown-item" data-cat-id="${c.id}">${esc(c.name)}</button>`
      ).join('');
  }

  function openProductModal(product = null) {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    if (!modal) return;

    if (product) {
      title.textContent = 'Edit Product';
      document.getElementById('product-id').value = product.id;
      document.getElementById('prod-name').value = product.name;
      document.getElementById('prod-sku').value = product.sku;
      document.getElementById('prod-price').value = product.price;
      document.getElementById('prod-gst-rate').value = product.gst_rate;
      document.getElementById('prod-stock').value = product.stock;
      document.getElementById('prod-min-stock').value = product.min_stock;
      document.getElementById('prod-location').value = product.location || 'storefront';
      document.getElementById('prod-desc').value = product.description || '';

      const cat = STATE.categories.find(c => c.id === product.category_id);
      document.getElementById('active-category-label').textContent = cat ? cat.name : '-- No Category --';
      document.getElementById('prod-category-id').value = product.category_id || '';
    } else {
      title.textContent = 'Add New Product';
      document.getElementById('product-form').reset();
      document.getElementById('product-id').value = '';
      document.getElementById('active-category-label').textContent = '-- No Category --';
      document.getElementById('prod-category-id').value = '';
      document.getElementById('prod-location').value = 'storefront';
    }

    modal.classList.remove('hidden');
  }

  async function handleSaveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const body = {
      name: document.getElementById('prod-name').value.trim(),
      sku: document.getElementById('prod-sku').value.trim() || null,
      category_id: parseInt(document.getElementById('prod-category-id').value) || null,
      price: parseFloat(document.getElementById('prod-price').value) || 0,
      gst_rate: parseInt(document.getElementById('prod-gst-rate').value) || 18,
      stock: parseInt(document.getElementById('prod-stock').value) || 0,
      min_stock: parseInt(document.getElementById('prod-min-stock').value) || 0,
      location: document.getElementById('prod-location').value || 'storefront',
      description: document.getElementById('prod-desc').value.trim(),
    };

    try {
      if (id) {
        await api(`/api/products/${id}`, { method: 'PUT', body });
      } else {
        await api('/api/products', { method: 'POST', body });
      }
      document.getElementById('product-modal')?.classList.add('hidden');
      loadProducts();
      showToast(id ? 'Product updated successfully!' : 'Product created successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function editProduct(productId) {
    const product = STATE.products.find(p => p.id === productId);
    if (product) openProductModal(product);
  }

  async function deleteProduct(productId) {
    if (!confirm('Delete this product permanently?')) return;
    try {
      await api(`/api/products/${productId}`, { method: 'DELETE' });
      loadProducts();
      showToast('Product deleted successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleCreateCategory(e) {
    e.preventDefault();
    const name = document.getElementById('cat-name')?.value.trim();
    const desc = document.getElementById('cat-desc')?.value.trim();
    if (!name) return;

    try {
      await api('/api/categories', { method: 'POST', body: { name, description: desc } });
      document.getElementById('category-form')?.reset();
      loadProducts();
      showToast('Category created successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function editCategory(id, name, desc) {
    document.getElementById('edit-cat-id').value = id;
    document.getElementById('edit-cat-name').value = name;
    document.getElementById('edit-cat-desc').value = desc;
    document.getElementById('category-modal')?.classList.remove('hidden');
  }

  async function handleUpdateCategory(e) {
    e.preventDefault();
    const id = document.getElementById('edit-cat-id').value;
    const name = document.getElementById('edit-cat-name')?.value.trim();
    const desc = document.getElementById('edit-cat-desc')?.value.trim();

    try {
      await api(`/api/categories/${id}`, { method: 'PUT', body: { name, description: desc } });
      document.getElementById('category-modal')?.classList.add('hidden');
      loadProducts();
      showToast('Category updated successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    try {
      await api(`/api/categories/${id}`, { method: 'DELETE' });
      loadProducts();
      showToast('Category deleted successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Local Dropdown Helper
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
