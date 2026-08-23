/* ==========================================================================
   THE FLUID LEDGER - Application JavaScript
   ========================================================================== */

const TAX_RATE = 0.115;
const API_BASE = '/api';

/**
 * Sanitize string for safe HTML output by escaping special characters
 * @param {string} str - User input to sanitize
 * @returns {string} - Sanitized string safe for use in HTML attributes
 */
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Application State
let appData = {
  maxBudget: 0,
  items: [],
  listItems: [],
  currentView: 'budget-tracker',
  currentSort: 'recent',
  itemsPendingUpdates: new Map(),
  listItemsPendingUpdates: new Map(),
  budgetLoaded: false,
  budgetLoadingError: null
};

let budgetDebounceTimer = null;

// Authentication state
let currentUser = null;

/**
 * Handle a fetch response that came back 401 by forcing a re-login
 */
function handleUnauthorized() {
  currentUser = null;
  showLoginView();
}

// ==========================================================================
// API Functions
// ==========================================================================

async function loadBudget() {
  try {
    const response = await fetch(`${API_BASE}/budget`);
    if (response.ok) {
      const data = await response.json();
      appData.maxBudget = data.maxBudget;
      appData.budgetLoaded = true;
      appData.budgetLoadedViaAPI = true;
      return true;
    } else {
      console.error('Failed to load budget: HTTP', response.status);
      appData.budgetLoadingError = 'Failed to load budget';
      appData.budgetLoadedViaAPI = false;
      return false;
    }
  } catch (e) {
    console.error('Error loading budget:', e);
    appData.budgetLoadingError = 'Network error';
    appData.budgetLoadedViaAPI = false;
    return false;
  }
}

async function loadItems() {
  try {
    const response = await fetch(`${API_BASE}/items`);
    if (response.ok) {
      const data = await response.json();
      appData.items = data.items;
    }
  } catch (e) {
    console.error('Error loading items:', e);
  }
}

async function loadListItems() {
  try {
    const response = await fetch(`${API_BASE}/list-items`);
    if (response.ok) {
      const data = await response.json();
      appData.listItems = data.items;
    }
  } catch (e) {
    console.error('Error loading list items:', e);
  }
}

async function loadData(skipBudgetLoad = false) {
  if (skipBudgetLoad) {
    await Promise.all([loadItems(), loadListItems()]);
  } else {
    await Promise.all([loadBudget(), loadItems(), loadListItems()]);
  }
}

function saveBudget(value) {
  const parsed = parseFloat(value);
  if (value === '' || isNaN(parsed)) {
    appData.maxBudget = 0;
  } else {
    appData.maxBudget = value;
  }

  updateBudgetHero();

  fetch(`${API_BASE}/budget`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxBudget: value })
  })
    .then(async response => {
      if (!response.ok) {
        const errorText = response.headers.get('content-type')?.includes('application/json')
          ? (await response.json()).error || response.statusText
          : await response.text();
        console.error(`Error saving budget (${response.status}):`, errorText);
      }
    })
    .catch(e => console.error('Error saving budget:', e));
}

function saveItem(index, field, value) {
  appData.items[index][field] = value;
  updateBudgetHero();

  const item = appData.items[index];
  if (item.id) {
    fetch(`${API_BASE}/items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    })
      .then(async response => {
        if (!response.ok) {
          const errorText = response.headers.get('content-type')?.includes('application/json')
            ? (await response.json()).error || response.statusText
            : await response.text();
          console.error(`Error saving item (${response.status}):`, errorText);
        }
      })
      .catch(e => console.error('Error saving item:', e));
  }
}

function deleteItem(id) {
  fetch(`${API_BASE}/items/${id}`, {
    method: 'DELETE'
  }).catch(e => console.error('Error deleting item:', e));
}

function saveNewListItem(item) {
  const itemKey = item;
  itemKey.saving = true;
  renderActiveItems();

  fetch(`${API_BASE}/list-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  }).then(async response => {
    if (response.ok) {
      const data = await response.json();
      itemKey.id = data.id;
      itemKey.saving = false;
      renderActiveItems();
      renderCompletedItems();
    }
  }).catch(e => {
    itemKey.saving = false;
    renderActiveItems();
    console.error('Error adding list item:', e);
  });
}

function saveListItem(index, field, value) {
  appData.listItems[index][field] = value;
  const item = appData.listItems[index];
  if (item.id) {
    fetch(`${API_BASE}/list-items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    }).catch(e => console.error('Error saving list item:', e));
  }
}

function deleteListItem(id) {
  fetch(`${API_BASE}/list-items/${id}`, {
    method: 'DELETE'
  }).catch(e => console.error('Error deleting list item:', e));
}

function clearListItems() {
  fetch(`${API_BASE}/list-items`, {
    method: 'DELETE'
  }).catch(e => console.error('Error clearing list items:', e));
}

function clearItems() {
  fetch(`${API_BASE}/items`, {
    method: 'DELETE'
  }).catch(e => console.error('Error clearing items:', e));
}

function toggleListItemComplete(id) {
  const index = appData.listItems.findIndex(item => item.id === id);
  if (index === -1) return;

  const item = appData.listItems[index];
  item.completed = !item.completed;

  renderActiveItems();
  renderCompletedItems();

  if (item.id) {
    fetch(`${API_BASE}/list-items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: item.completed })
    }).catch(e => console.error('Error updating complete:', e));
  }
}

// ==========================================================================
// Authentication & User Management
// ==========================================================================

async function login(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }
  return data.user;
}

async function logout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
  } catch (e) {
    console.error('Error logging out:', e);
  }
  currentUser = null;
  showLoginView();
}

function showLoginView() {
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('budget-tracker-view').classList.add('hidden');
  document.getElementById('shopping-list-view').classList.add('hidden');
  document.getElementById('admin-view').classList.add('hidden');
  document.getElementById('quick-add-bar').classList.add('hidden');
  document.querySelector('.bottom-nav').style.display = 'none';
  document.getElementById('user-menu').style.display = 'none';

  const errorEl = document.getElementById('login-error');
  errorEl.classList.add('hidden');
  const form = document.getElementById('login-form');
  form.reset();
  document.getElementById('login-username').focus();
}

function showAppView(user) {
  currentUser = user;
  document.getElementById('login-view').classList.add('hidden');
  document.querySelector('.bottom-nav').style.display = '';

  const userMenu = document.getElementById('user-menu');
  userMenu.style.display = '';
  document.getElementById('user-menu-username').textContent = user.username;

  const adminBtn = document.getElementById('admin-panel-btn');
  adminBtn.classList.toggle('hidden', user.role !== 'admin');

  switchView(localStorage.getItem(VIEW_STORAGE_KEY) || 'budget-tracker');
}

async function attemptLogin(event) {
  event.preventDefault();
  const submitBtn = document.getElementById('login-submit');
  const errorEl = document.getElementById('login-error');
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  errorEl.classList.add('hidden');
  submitBtn.disabled = true;
  try {
    const user = await login(username, password);
    showAppView(user);
    await loadData();
    updateBudgetHero();
    renderRecentItems();
    renderActiveItems();
    renderCompletedItems();
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
  }
}

function toggleUserMenu(forceState) {
  const dropdown = document.getElementById('user-menu-dropdown');
  const show = forceState !== undefined ? forceState : dropdown.classList.contains('hidden');
  dropdown.classList.toggle('hidden', !show);
}

// --------------------------------------------------------------------------
// Admin panel
// --------------------------------------------------------------------------

async function openAdminPanel() {
  toggleUserMenu(false);
  switchAdminView(true);
  await loadUsers();
}

function switchAdminView(showAdmin) {
  const views = ['budget-tracker-view', 'shopping-list-view', 'admin-view'];
  views.forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('quick-add-bar').classList.toggle('hidden', true);
  if (!showAdmin) {
    switchView(appData.currentView || 'budget-tracker');
    return;
  }
  document.getElementById('admin-view').classList.remove('hidden');
  document.querySelectorAll('.bottom-nav__item').forEach(item => {
    item.classList.remove('bottom-nav__item--active');
  });
}

async function apiCall(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Not authenticated');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

async function loadUsers() {
  const listError = document.getElementById('admin-list-error');
  listError.classList.add('hidden');
  try {
    const data = await apiCall(`${API_BASE}/users`);
    renderUserList(data.users);
  } catch (e) {
    if (e.message !== 'Not authenticated') {
      listError.textContent = e.message;
      listError.classList.remove('hidden');
    }
  }
}

function renderUserList(users) {
  const container = document.getElementById('admin-users-list');
  document.getElementById('admin-user-count').textContent = users.length + ' USERS';
  container.innerHTML = '';

  users.forEach(user => {
    const row = document.createElement('div');
    row.className = 'admin-user-row';
    row.innerHTML = `
      <div class="admin-user-row__info">
        <span class="material-symbols-outlined admin-user-row__icon">${user.role === 'admin' ? 'shield_person' : 'person'}</span>
        <div>
          <div class="admin-user-row__name">${escapeHTML(user.username)}</div>
          <div class="admin-user-row__role">${user.role}</div>
        </div>
      </div>
      <div class="admin-user-row__actions">
        <button class="admin-user-row__btn" data-action="reset-password" aria-label="Reset password">
          <span class="material-symbols-outlined">key</span>
        </button>
        <button class="admin-user-row__btn admin-user-row__btn--danger" data-action="delete" aria-label="Delete user">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    `;

    row.querySelector('[data-action="reset-password"]').addEventListener('click', () => {
      openResetPasswordDialog(user);
    });

    row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (!confirm(`Delete user "${user.username}" and all their data?`)) return;
      try {
        await apiCall(`${API_BASE}/users/${user.id}`, { method: 'DELETE' });
        await loadUsers();
      } catch (e) {
        if (e.message !== 'Not authenticated') {
          alert(e.message);
        }
      }
    });

    container.appendChild(row);
  });
}

async function createUserFromForm(event) {
  event.preventDefault();
  const formError = document.getElementById('admin-form-error');
  formError.classList.add('hidden');

  const username = document.getElementById('admin-new-username').value.trim();
  const password = document.getElementById('admin-new-password').value;
  const role = document.getElementById('admin-new-role').value;

  try {
    await apiCall(`${API_BASE}/users`, {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });
    document.getElementById('admin-add-user-form').reset();
    await loadUsers();
  } catch (e) {
    if (e.message !== 'Not authenticated') {
      formError.textContent = e.message;
      formError.classList.remove('hidden');
    }
  }
}

let resetPasswordTargetId = null;

function openResetPasswordDialog(user) {
  resetPasswordTargetId = user.id;
  document.getElementById('reset-password-username').textContent = `Set a new password for "${user.username}"`;
  document.getElementById('reset-password-input').value = '';
  document.getElementById('reset-password-error').classList.add('hidden');
  document.getElementById('reset-password-overlay').classList.remove('hidden');
  document.getElementById('reset-password-input').focus();
}

function closeResetPasswordDialog() {
  document.getElementById('reset-password-overlay').classList.add('hidden');
  resetPasswordTargetId = null;
}

async function submitResetPassword(event) {
  event.preventDefault();
  const errorEl = document.getElementById('reset-password-error');
  const password = document.getElementById('reset-password-input').value;

  try {
    await apiCall(`${API_BASE}/users/${resetPasswordTargetId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password })
    });
    closeResetPasswordDialog();
  } catch (e) {
    if (e.message !== 'Not authenticated') {
      errorEl.textContent = e.message;
      errorEl.classList.remove('hidden');
    }
  }
}

function setupAuthEventListeners() {
  document.getElementById('login-form').addEventListener('submit', attemptLogin);
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('admin-panel-btn').addEventListener('click', openAdminPanel);

  document.getElementById('user-menu-trigger').addEventListener('click', () => toggleUserMenu());
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#user-menu')) {
      toggleUserMenu(false);
    }
  });

  document.getElementById('admin-add-user-form').addEventListener('submit', createUserFromForm);
  document.getElementById('reset-password-form').addEventListener('submit', submitResetPassword);
  document.getElementById('reset-password-cancel').addEventListener('click', closeResetPasswordDialog);
  document.getElementById('reset-password-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeResetPasswordDialog();
  });
}

// ==========================================================================
// Utility Functions
// ==========================================================================

function formatCurrency(amount) {
  return '$' + amount.toFixed(2);
}

function calculateTotals() {
  let totalQty = 0;
  let subtotal = 0;

  appData.items.forEach(item => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    if (price > 0) {
      totalQty += qty;
    }
    subtotal += qty * price;
  });

  const tax = subtotal * TAX_RATE;
  const grandTotal = subtotal + tax;

  return { totalQty, subtotal, tax, grandTotal };
}

function getItemImpact(price) {
  const numericPrice = parseFloat(price) || 0;
  if (numericPrice >= 30) return 'high';
  if (numericPrice >= 10) return 'medium';
  return 'low';
}

function getItemImpactClass(impact) {
  switch (impact) {
    case 'high': return 'list-item-card__indicator--high';
    case 'medium': return 'list-item-card__indicator--medium';
    case 'low': return 'list-item-card__indicator--low';
    default: return 'list-item-card__indicator--low';
  }
}

function getPriceColorClass(impact) {
  switch (impact) {
    case 'high': return 'list-item-card__price--high';
    case 'medium': return 'list-item-card__price--medium';
    case 'low': return 'list-item-card__price--low';
    default: return 'list-item-card__price--low';
  }
}

function getBudgetStatusClass(percentage) {
  if (percentage >= 100) return 'danger';
  if (percentage >= 75) return 'warning';
  return 'success';
}

function getBudgetProgressClass(percentage) {
  if (percentage >= 100) return 'budget-progress__fill--danger';
  if (percentage >= 75) return 'budget-progress__fill--warning';
  return '';
}

// ==========================================================================
// Render Functions - Budget Tracker
// ==========================================================================

function updateBudgetHero() {
  const totals = calculateTotals();
  const maxBudget = parseFloat(appData.maxBudget) || 0;

  // Update spent amount
  const heroSpentEl = document.getElementById('hero-spent');
  if (heroSpentEl) {
    heroSpentEl.textContent = totals.subtotal.toFixed(2);
  }

  // Update budget input field
  const heroBudgetInput = document.getElementById('hero-budget-input');
  if (heroBudgetInput && document.activeElement !== heroBudgetInput) {
    // Only update if not currently focused (to avoid disrupting user typing)
    heroBudgetInput.value = maxBudget > 0 ? maxBudget.toFixed(2) : '';
  }

  // Calculate percentage
  let percentage = 0;
  if (maxBudget > 0) {
    percentage = (totals.subtotal / maxBudget) * 100;
  }

  // Update progress bar
  const progressFill = document.getElementById('budget-progress-fill');
  if (progressFill) {
    progressFill.style.width = Math.min(percentage, 100) + '%';

    // Remove old status classes
    progressFill.classList.remove('budget-progress__fill--warning', 'budget-progress__fill--danger');

    // Add new status class
    const progressClass = getBudgetProgressClass(percentage);
    if (progressClass) {
      progressFill.classList.add(progressClass);
    }
  }

  // Update status badge
  const statusEl = document.getElementById('budget-status');
  const percentageEl = document.getElementById('budget-percentage');

  if (statusEl) {
    if (percentage >= 100) {
      statusEl.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">error</span><span class="budget-hero__status-label">Over Budget</span>';
      statusEl.style.background = 'var(--tertiary-fixed)';
      statusEl.style.color = 'var(--on-tertiary-fixed-variant)';
    } else if (percentage >= 75) {
      statusEl.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">warning</span><span class="budget-hero__status-label">Warning</span>';
      statusEl.style.background = 'var(--secondary-fixed)';
      statusEl.style.color = 'var(--on-secondary-fixed-variant)';
    } else {
      statusEl.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span><span class="budget-hero__status-label">Healthy Status</span>';
      statusEl.style.background = 'var(--primary-fixed)';
      statusEl.style.color = 'var(--on-primary-fixed-variant)';
    }
  }

  if (percentageEl) {
    percentageEl.textContent = (100 - Math.min(percentage, 100)).toFixed(1) + '% REMAINING';
  }
}

function createRecentItemElement(item, index) {
  const impact = getItemImpact(item.price);

  const div = document.createElement('div');
  div.className = 'list-item-card fade-in';
  div.dataset.index = index;

  const price = parseFloat(item.price) || 0;
  const quantity = parseInt(item.quantity) || 1;
  const subtotal = price * quantity;

  div.innerHTML = `
    <div class="list-item-card__indicator ${getItemImpactClass(impact)}"></div>
    <div class="list-item-card__content">
      <div class="list-item-card__header">
        <span class="list-item-card__name">Item #${String(index + 1).padStart(2, '0')}</span>
      </div>
      <div class="list-item-card__price-row">
        <div class="list-item-card__qty-controls">
          <button class="list-item-card__qty-btn" data-action="decrease" aria-label="Decrease quantity">
            <span class="material-symbols-outlined">remove</span>
          </button>
          <span class="list-item-card__qty-value">${quantity}</span>
          <button class="list-item-card__qty-btn" data-action="increase" aria-label="Increase quantity">
            <span class="material-symbols-outlined">add</span>
          </button>
        </div>
        <span class="list-item-card__price-label">Price:</span>
        <input type="number" class="list-item-card__price-input ${getPriceColorClass(impact)}" value="${price.toFixed(2)}" step="0.01" min="0"/>
        <span class="list-item-card__separator">|</span>
        <span class="list-item-card__subtotal-label">Subtotal:</span>
        <span class="list-item-card__price ${getPriceColorClass(impact)}">${formatCurrency(subtotal)}</span>
      </div>
    </div>
    <button class="list-item-card__delete" aria-label="Delete item">
      <span class="material-symbols-outlined">delete</span>
    </button>
  `;

  const priceInput = div.querySelector('.list-item-card__price-input');
  priceInput.addEventListener('change', (e) => {
    const newPrice = parseFloat(e.target.value) || 0;
    item.price = newPrice.toFixed(2);
    saveItem(index, 'price', item.price);
    renderRecentItems();
    updateBudgetHero();
  });

  // Quantity buttons
  const qtyButtons = div.querySelectorAll('.list-item-card__qty-btn');
  qtyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      let newQty = quantity;

      if (action === 'increase') {
        newQty = quantity + 1;
      } else if (action === 'decrease' && quantity > 1) {
        newQty = quantity - 1;
      }

      item.quantity = newQty.toString();
      saveItem(index, 'quantity', item.quantity);
      renderRecentItems();
      updateBudgetHero();
    });
  });

  const deleteBtn = div.querySelector('.list-item-card__delete');
  deleteBtn.addEventListener('click', () => {
    const itemId = item.id;
    appData.items.splice(index, 1);
    if (itemId) {
      deleteItem(itemId);
    }
    renderRecentItems();
    updateBudgetHero();
  });

  return div;
}

function renderRecentItems() {
  const container = document.getElementById('recent-items-list');
  
  if (appData.items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 40px 20px; color: var(--on-surface-variant);">
        <div style="font-size: 48px; margin-bottom: 16px;">🛒</div>
        <p class="body-md">Start adding items to your shopping list</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  // Show last 5 items
  const recentItems = appData.items.slice(-5).reverse();
  recentItems.forEach((item, index) => {
    const originalIndex = appData.items.length - 1 - index;
    const itemElement = createRecentItemElement(item, originalIndex);
    container.appendChild(itemElement);
  });
}

// ==========================================================================
// Render Functions - Shopping List
// ==========================================================================

function createListItemElement(item, index) {
  const impact = getItemImpact(item.price);
  const div = document.createElement('div');
  div.className = `list-item-card fade-in ${item.completed ? 'list-item-card--completed' : ''}`;
  div.dataset.index = index;
  div.dataset.id = item.id;

  const name = item.name || 'Item name';
  const quantity = parseInt(item.quantity) || 1;

  div.innerHTML = `
    <div class="list-item-card__indicator ${getItemImpactClass(impact)}"></div>
    <div class="col-check">
      <input type="checkbox" class="list-item-card__checkbox" aria-label="Toggle complete" ${item.completed ? 'checked' : ''}>
    </div>
    <div class="list-item-card__content">
      <div class="list-item-card__header">
        <input type="text" class="list-item-card__name-input" value="${escapeHTML(name)}" placeholder="Item name"/>
      </div>
    </div>
    <div class="list-item-card__qty-controls">
      <button class="list-item-card__qty-btn" data-action="decrease" aria-label="Decrease quantity">
        <span class="material-symbols-outlined">remove</span>
      </button>
      <span class="list-item-card__qty-value">${quantity}</span>
      <button class="list-item-card__qty-btn" data-action="increase" aria-label="Increase quantity">
        <span class="material-symbols-outlined">add</span>
      </button>
    </div>
    <button class="list-item-card__delete" aria-label="Delete item" ${item.completed ? 'disabled' : ''}>
      <span class="material-symbols-outlined">delete</span>
    </button>
  `;

  const checkbox = div.querySelector('.list-item-card__checkbox');
  checkbox.addEventListener('change', () => {
    if (item.saving) return;
    toggleListItemComplete(item.id);
  });

  const nameInput = div.querySelector('.list-item-card__name-input');
  nameInput.addEventListener('change', (e) => {
    item.name = e.target.value;
    saveListItem(index, 'name', item.name);
  });


  // Quantity buttons
  const qtyButtons = div.querySelectorAll('.list-item-card__qty-btn');
  qtyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (item.saving) return;
      const action = btn.dataset.action;
      let newQty = quantity;
      
      if (action === 'increase') {
        newQty = quantity + 1;
      } else if (action === 'decrease' && quantity > 1) {
        newQty = quantity - 1;
      }
      
      item.quantity = newQty.toString();
      saveListItem(index, 'quantity', item.quantity);
      renderActiveItems();
      renderCompletedItems();
    });
  });

  const deleteBtn = div.querySelector('.list-item-card__delete');
  deleteBtn.addEventListener('click', () => {
    if (item.saving) return;
    const itemId = item.id;
    appData.listItems.splice(index, 1);
    if (itemId) {
      deleteListItem(itemId);
    }
    renderActiveItems();
    renderCompletedItems();
  });

  return div;
}

function renderActiveItems() {
  const container = document.getElementById('active-items-list');
  const active = appData.listItems.filter(item => !item.completed);
  
  // Update count
  document.getElementById('active-count').textContent = active.length + ' ITEMS';
  
  if (active.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 40px 20px; color: var(--on-surface-variant);">
        <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
        <p class="body-md">No active items</p>
        <p class="body-sm" style="margin-top: 8px;">Add items to your shopping list</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  active.forEach((item, index) => {
    const originalIndex = appData.listItems.findIndex(it => it.id === item.id);
    const el = createListItemElement(item, originalIndex);
    container.appendChild(el);
  });
}

function renderCompletedItems() {
  const container = document.getElementById('completed-items-list');
  const completed = appData.listItems.filter(item => item.completed);
  
  const section = document.getElementById('completed-section');
  document.getElementById('completed-count').textContent = completed.length + ' ITEMS';
  
  if (completed.length === 0) {
    section.classList.add('hidden');
    return;
  }
  
  section.classList.remove('hidden');
  container.innerHTML = '';
  completed.forEach((item, index) => {
    const originalIndex = appData.listItems.findIndex(it => it.id === item.id);
    const el = createListItemElement(item, originalIndex);
    container.appendChild(el);
  });
}

function toggleItemComplete(id) {
  const item = appData.items.find(i => i.id == id);
  if (!item) return;

  item.completed = !item.completed;

  renderRecentItems();

  fetch(`${API_BASE}/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: item.completed })
  }).catch(e => console.error('Error updating complete:', e));
}

function addItemToList() {
  const item = { quantity: '1', name: '', completed: false, price: '' };
  appData.listItems.push(item);
  renderActiveItems();
  renderCompletedItems();
  saveNewListItem(item);
}

// ==========================================================================
// View Management
// ==========================================================================

const VIEW_STORAGE_KEY = 'kishop-view';

function persistCurrentView(viewName) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, viewName);
  } catch (e) {
    console.error('Error saving current view:', e);
  }
}

function switchView(viewName) {
  appData.currentView = viewName;
  persistCurrentView(viewName);

  const budgetView = document.getElementById('budget-tracker-view');
  const listView = document.getElementById('shopping-list-view');
  const quickAddBar = document.getElementById('quick-add-bar');
  const adminView = document.getElementById('admin-view');

  // Leaving the admin panel hides it regardless of the target view
  if (adminView) {
    adminView.classList.add('hidden');
  }

  const navItems = document.querySelectorAll('.bottom-nav__item');

  if (viewName === 'budget-tracker') {
    budgetView.classList.remove('hidden');
    listView.classList.add('hidden');
    quickAddBar.classList.add('hidden');

    navItems.forEach(item => {
      item.classList.toggle('bottom-nav__item--active', item.dataset.view === 'budget-tracker');
    });

    renderRecentItems();
  } else if (viewName === 'shopping-list') {
    budgetView.classList.add('hidden');
    listView.classList.remove('hidden');
    quickAddBar.classList.remove('hidden');

    navItems.forEach(item => {
      item.classList.toggle('bottom-nav__item--active', item.dataset.view === 'shopping-list');
    });

    renderActiveItems();
    renderCompletedItems();
  }
}

// ==========================================================================
// Filter Chips
// ==========================================================================

function setupFilterChips() {
  const chips = document.querySelectorAll('.filter-chip');
  
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      // Remove active class from all chips
      chips.forEach(c => c.classList.remove('filter-chip--active'));
      // Add active class to clicked chip
      chip.classList.add('filter-chip--active');
      
      // Set current sort
      appData.currentSort = chip.dataset.sort;
      
      // Sort and render items
      sortAndRenderItems(appData.currentSort);
    });
  });
}

function sortAndRenderItems(sortType) {
  switch (sortType) {
    case 'recent':
      // Keep original order (most recent first)
      appData.listItems.sort((a, b) => b.position - a.position);
      break;
    case 'az':
      // Sort alphabetically by name
      appData.listItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
    case 'quantity':
      // Sort by quantity (highest first)
      appData.listItems.sort((a, b) => (parseInt(b.quantity) || 0) - (parseInt(a.quantity) || 0));
      break;
  }

  renderActiveItems();
  renderCompletedItems();
}

// ==========================================================================
// Event Handlers
// ==========================================================================

function setupEventListeners() {
  // Theme Toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Budget Input in Hero Section
  const heroBudgetInput = document.getElementById('hero-budget-input');
  if (heroBudgetInput) {
    heroBudgetInput.addEventListener('blur', () => {
      const value = heroBudgetInput.value.trim();
      if (value === '' || parseFloat(value) < 0) {
        appData.maxBudget = 0;
        heroBudgetInput.value = '';
      } else {
        appData.maxBudget = parseFloat(value);
        heroBudgetInput.value = parseFloat(value).toFixed(2);
      }
      saveBudget(appData.maxBudget);
    });

    heroBudgetInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        heroBudgetInput.blur();
      }
    });
  }

  // Bottom Navigation
  const navItems = document.querySelectorAll('.bottom-nav__item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(item.dataset.view);
    });
  });

  // Rapid Entry (Budget Tracker)
  const rapidPrice = document.getElementById('rapid-price');
  const rapidQuantity = document.getElementById('rapid-quantity');
  const rapidAddBtn = document.getElementById('rapid-add-btn');

  if (rapidPrice && rapidQuantity && rapidAddBtn) {
    rapidPrice.addEventListener('input', () => {
      if (budgetDebounceTimer) clearTimeout(budgetDebounceTimer);
      budgetDebounceTimer = setTimeout(() => {
        // Could save to API if needed
      }, 300);
    });

    // Rapid Add Button
    rapidAddBtn.addEventListener('click', () => {
      const price = rapidPrice.value;
      const quantity = rapidQuantity.value || '1';

      if (price) {
        const item = { quantity, price, completed: false };
        appData.items.push(item);
        renderRecentItems();
        updateBudgetHero();
        saveNewItemToItems(item);

        // Clear inputs
        rapidPrice.value = '';
        rapidQuantity.value = '1';
        rapidPrice.focus();
      }
    });
  }

  // Quick Add
  // Quick Add (Shopping List)
  const quickAddInput = document.getElementById('quick-add-input');
  const quickAddSubmit = document.getElementById('quick-add-submit');
  const clearRecentBtn = document.getElementById('clear-recent-btn');

  if (quickAddInput && quickAddSubmit) {
    quickAddSubmit.addEventListener('click', () => {
      const name = quickAddInput.value.trim();
      if (name) {
        const item = { name, quantity: '1', completed: false, price: '' };
        appData.listItems.push(item);
        renderActiveItems();
        saveNewListItem(item);
        quickAddInput.value = '';
        quickAddInput.focus();
      }
    });

    quickAddInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        quickAddSubmit.click();
      }
    });
  }

  // Clear Recent Button
  if (clearRecentBtn) {
    clearRecentBtn.addEventListener('click', () => {
      if (confirm('Clear all recent items?')) {
        appData.items = [];
        clearItems();
        renderRecentItems();
        updateBudgetHero();
      }
    });
  }

  // Clear All Button (Shopping List)
  const clearListBtn = document.getElementById('clear-list-btn');
  if (clearListBtn) {
    clearListBtn.addEventListener('click', () => {
      if (confirm('Clear all shopping list items?')) {
        appData.listItems = [];
        clearListItems();
        renderActiveItems();
        renderCompletedItems();
      }
    });
  }

  // Filter Chips
  setupFilterChips();
}

function saveNewItemToItems(item) {
  const itemKey = item;
  itemKey.saving = true;

  fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  }).then(async response => {
    if (response.ok) {
      const data = await response.json();
      itemKey.id = data.id;
      itemKey.saving = false;
    }
  }).catch(e => {
    itemKey.saving = false;
    console.error('Error adding item:', e);
  });
}

// ==========================================================================
// Theme Management
// ==========================================================================

const THEME_STORAGE_KEY = 'fluid-ledger-theme';

function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme) {
    // Explicit user choice wins
    applyTheme(savedTheme);
  } else {
    // No explicit choice: follow the system preference without persisting it,
    // and keep following live OS changes until the user picks a theme.
    applyTheme(systemTheme());
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}

// Applies a theme to the UI without persisting it.
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  // Update theme icon
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
  }

  // Update theme color meta tag
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute('content', theme === 'dark' ? '#191c19' : '#006e1c');
  }
}

// Persists an explicit user choice and applies it.
function setTheme(theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

// ==========================================================================
// Initialization
// ==========================================================================

async function migrateFromLocalStorage() {
  try {
    const saved = localStorage.getItem('kishop_data');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.items && data.items.length > 0) {
        console.log('Migrating data from localStorage...');
        await fetch(`${API_BASE}/items`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: data.items })
        });
        if (data.maxBudget !== undefined) {
          await fetch(`${API_BASE}/budget`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maxBudget: data.maxBudget })
          });
        }
        localStorage.removeItem('kishop_data');
        console.log('Migration complete');
      }
    }
  } catch (e) {
    console.error('Error migrating data:', e);
  }
}

async function init() {
  // Initialize theme first
  initTheme();

  setupEventListeners();
  setupAuthEventListeners();

  // Check whether the visitor already has a valid session
  let me = null;
  try {
    const response = await fetch(`${API_BASE}/auth/me`);
    if (response.ok) {
      me = (await response.json()).user;
    }
  } catch (e) {
    console.error('Error checking session:', e);
  }

  if (!me) {
    showLoginView();
    return;
  }

  showAppView(me);

  await migrateFromLocalStorage();
  await loadData();

  // Initialize budget input field
  const heroBudgetInput = document.getElementById('hero-budget-input');
  if (heroBudgetInput && appData.maxBudget) {
    heroBudgetInput.value = parseFloat(appData.maxBudget).toFixed(2);
  }

  // Initialize budget display
  updateBudgetHero();

  // Initial renders
  renderRecentItems();
  renderActiveItems();
  renderCompletedItems();

  console.log('The Fluid Ledger initialized');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
