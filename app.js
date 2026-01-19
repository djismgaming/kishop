const TAX_RATE = 0.115;
const API_BASE = '/api';

let appData = {
  maxBudget: 0,
  items: []
};

async function loadBudget() {
  try {
    const response = await fetch(`${API_BASE}/budget`);
    if (response.ok) {
      const data = await response.json();
      appData.maxBudget = data.maxBudget;
    }
  } catch (e) {
    console.error('Error loading budget:', e);
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

async function loadData() {
  await Promise.all([loadBudget(), loadItems()]);
}

function saveBudget(value) {
  appData.maxBudget = value;
  updateTotalsDisplay();
  fetch(`${API_BASE}/budget`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxBudget: value })
  }).catch(e => console.error('Error saving budget:', e));
}

function saveItem(index, field, value) {
  appData.items[index][field] = value;
  updateTotalsDisplay();
  const item = appData.items[index];
  if (item.id) {
    fetch(`${API_BASE}/items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    }).catch(e => console.error('Error saving item:', e));
  }
}

function saveNewItem(item) {
  fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  }).then(async response => {
    if (response.ok) {
      const data = await response.json();
      const lastItem = appData.items[appData.items.length - 1];
      if (lastItem) {
        lastItem.id = data.id;
      }
    }
  }).catch(e => console.error('Error adding item:', e));
}

function deleteItem(id) {
  fetch(`${API_BASE}/items/${id}`, {
    method: 'DELETE'
  }).catch(e => console.error('Error deleting item:', e));
}

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

function updateTotalsDisplay() {
  const totals = calculateTotals();
  const maxBudget = parseFloat(appData.maxBudget) || 0;

  document.getElementById('total-qty').textContent = totals.totalQty;
  document.getElementById('subtotal').textContent = formatCurrency(totals.subtotal);
  document.getElementById('grand-total').textContent = formatCurrency(totals.grandTotal);

  const footer = document.querySelector('footer.totals-panel');
  footer.classList.remove('warning', 'danger');

  if (maxBudget > 0) {
    const percentage = (totals.subtotal / maxBudget) * 100;
    if (percentage >= 100) {
      footer.classList.add('danger');
    } else if (percentage >= 75) {
      footer.classList.add('warning');
    }
  }
}

function createItemElement(item, index) {
  const div = document.createElement('div');
  div.className = 'list-item';
  div.dataset.index = index;

  div.innerHTML = `
    <div class="col-qty">
      <input 
        type="number" 
        inputmode="decimal" 
        class="quantity-input" 
        value="${item.quantity || ''}" 
        placeholder="0"
        min="0"
        step="1"
      >
    </div>
    <div class="col-price">
      <input 
        type="number" 
        inputmode="decimal" 
        class="price-input" 
        value="${item.price || ''}" 
        placeholder="0.00"
        min="0"
        step="0.01"
      >
    </div>
    <div class="col-action">
      <button class="delete-btn" aria-label="Delete item">&times;</button>
    </div>
  `;

  const qtyInput = div.querySelector('.quantity-input');
  const priceInput = div.querySelector('.price-input');
  const deleteBtn = div.querySelector('.delete-btn');

  qtyInput.addEventListener('input', () => {
    saveItem(index, 'quantity', qtyInput.value);
  });

  priceInput.addEventListener('input', () => {
    saveItem(index, 'price', priceInput.value);
  });

  priceInput.addEventListener('blur', () => {
    renderList();
  });

  qtyInput.addEventListener('focus', (e) => {
    if (e.relatedTarget !== null) {
      qtyInput.select();
    }
  });

  priceInput.addEventListener('focus', (e) => {
    if (e.relatedTarget !== null) {
      priceInput.select();
    }
  });

  deleteBtn.addEventListener('click', () => {
    const item = appData.items[index];
    appData.items.splice(index, 1);
    if (item.id) {
      deleteItem(item.id);
    }
    renderList();
    updateTotalsDisplay();
  });

  return div;
}

function renderList() {
  const listContainer = document.getElementById('shopping-list');
  listContainer.innerHTML = '';

  if (appData.items.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 32px;">🛒</div>
        <p>Start adding items to your shopping list</p>
      </div>
    `;
    return;
  }

  appData.items.forEach((item, index) => {
    const itemElement = createItemElement(item, index);
    listContainer.appendChild(itemElement);
  });
}

function addEmptyRow() {
  const item = { quantity: '1', price: '' };
  appData.items.push(item);
  renderList();
  updateTotalsDisplay();
  saveNewItem(item);

  const listContainer = document.getElementById('shopping-list');
  const lastItem = listContainer.lastElementChild;
  if (lastItem) {
    const qtyInput = lastItem.querySelector('.quantity-input');
    if (qtyInput) {
      qtyInput.focus();
    }
  }
}

function ensureEmptyRow() {
  const lastItem = appData.items[appData.items.length - 1];
  if (!lastItem || (lastItem.quantity && lastItem.price)) {
    addEmptyRow();
  }
}

function handleListClick(e) {
  const target = e.target;
  const listContainer = document.getElementById('shopping-list');

  if (target.classList.contains('quantity-input') || target.classList.contains('price-input')) {
    const itemElement = target.closest('.list-item');
    const index = parseInt(itemElement.dataset.index);
    
    target.addEventListener('blur', () => {
      setTimeout(ensureEmptyRow, 100);
    });
  }
}

function handleKeyPress(e) {
  if (e.key === 'Enter') {
    const activeElement = document.activeElement;
    if (activeElement.classList.contains('quantity-input') || activeElement.classList.contains('price-input')) {
      const itemElement = activeElement.closest('.list-item');
      const qtyInput = itemElement.querySelector('.quantity-input');
      const priceInput = itemElement.querySelector('.price-input');

      if (activeElement === qtyInput) {
        priceInput.focus();
      } else {
        ensureEmptyRow();
      }
    }
  }
}

function clearAll() {
  if (confirm('Are you sure you want to clear all items?')) {
    const itemIds = appData.items.filter(item => item.id).map(item => item.id);
    appData.items = [];
    itemIds.forEach(id => deleteItem(id));
    renderList();
    updateTotalsDisplay();
    addEmptyRow();
  }
}

async function refreshData() {
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.classList.add('pulsing');
  
  await loadData();
  renderList();
  updateTotalsDisplay();
  ensureEmptyRow();
  
  setTimeout(() => {
    refreshBtn.classList.remove('pulsing');
  }, 1000);
}

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
  await migrateFromLocalStorage();
  await loadData();

  const maxBudgetInput = document.getElementById('max-budget');
  maxBudgetInput.value = appData.maxBudget || '';

  maxBudgetInput.addEventListener('input', () => {
    saveBudget(maxBudgetInput.value);
  });

  document.addEventListener('click', handleListClick);
  document.addEventListener('keydown', handleKeyPress);

  document.getElementById('clear-all').addEventListener('click', clearAll);
  document.getElementById('refresh-btn').addEventListener('click', refreshData);

  renderList();
  updateTotalsDisplay();
  ensureEmptyRow();
}

document.addEventListener('DOMContentLoaded', init);
