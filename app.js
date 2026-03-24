const TAX_RATE = 0.115;
const API_BASE = '/api';

let appData = {
  maxBudget: 0,
  items: [],
  listItems: [],
  currentView: 'shopping',
  itemsPendingUpdates: new Map(),
  listItemsPendingUpdates: new Map()
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

async function loadData() {
  await Promise.all([loadBudget(), loadItems(), loadListItems()]);
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
  } else {
    if (!appData.itemsPendingUpdates.has(item)) {
      appData.itemsPendingUpdates.set(item, {});
    }
    appData.itemsPendingUpdates.get(item)[field] = value;
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
        
        const pending = appData.itemsPendingUpdates.get(lastItem);
        if (pending) {
          Object.entries(pending).forEach(([field, value]) => {
            lastItem[field] = value;
          });
          fetch(`${API_BASE}/items/${lastItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lastItem)
          }).catch(e => console.error('Error saving item:', e));
          appData.itemsPendingUpdates.delete(lastItem);
        }
      }
    }
  }).catch(e => console.error('Error adding item:', e));
}

function deleteItem(id) {
  fetch(`${API_BASE}/items/${id}`, {
    method: 'DELETE'
  }).catch(e => console.error('Error deleting item:', e));
}

function saveNewListItem(item) {
  fetch(`${API_BASE}/list-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  }).then(async response => {
    if (response.ok) {
      const data = await response.json();
      const lastItem = appData.listItems[appData.listItems.length - 1];
      if (lastItem) {
        lastItem.id = data.id;
        
        const pending = appData.listItemsPendingUpdates.get(lastItem);
        if (pending) {
          Object.entries(pending).forEach(([field, value]) => {
            lastItem[field] = value;
          });
          fetch(`${API_BASE}/list-items/${lastItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lastItem)
          }).catch(e => console.error('Error saving list item:', e));
          appData.listItemsPendingUpdates.delete(lastItem);
        }
      }
    }
  }).catch(e => console.error('Error adding list item:', e));
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
  } else {
    if (!appData.listItemsPendingUpdates.has(item)) {
      appData.listItemsPendingUpdates.set(item, {});
    }
    appData.listItemsPendingUpdates.get(item)[field] = value;
  }
}

function deleteListItem(id) {
  fetch(`${API_BASE}/list-items/${id}`, {
    method: 'DELETE'
  }).catch(e => console.error('Error deleting list item:', e));
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
  footer.classList.remove('warning', 'danger', 'success');

  if (maxBudget > 0) {
    const percentage = (totals.subtotal / maxBudget) * 100;
    if (percentage >= 100) {
      footer.classList.add('danger');
    } else if (percentage >= 75) {
      footer.classList.add('warning');
    } else {
      footer.classList.add('success');
    }
  } else {
    footer.classList.add('success');
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
      <button class="delete-btn" aria-label="Delete item">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="1" x2="10" y2="2"></line>
          <line x1="14" y1="1" x2="14" y2="2"></line>
        </svg>
      </button>
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
        <button id="add-item-btn" style="margin-top: 16px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Add Item</button>
      </div>
    `;
    return;
  }

  appData.items.forEach((item, index) => {
    const itemElement = createItemElement(item, index);
    listContainer.appendChild(itemElement);
  });
}

function toggleView(view) {
  appData.currentView = view;
  
  const shoppingView = document.getElementById('shopping-view');
  const listView = document.getElementById('list-view');
  const toggleShopping = document.getElementById('toggle-shopping');
  const toggleList = document.getElementById('toggle-list');
  
  if (view === 'shopping') {
    shoppingView.classList.remove('hidden');
    listView.classList.add('hidden');
    toggleShopping.classList.add('active');
    toggleList.classList.remove('active');
  } else {
    shoppingView.classList.add('hidden');
    listView.classList.remove('hidden');
    toggleShopping.classList.remove('active');
    toggleList.classList.add('active');
    
    renderActiveItems();
    renderCompletedItems();
  }
}

function createListItemElement(item, index) {
  const div = document.createElement('div');
  div.className = `list-item ${item.completed ? 'completed' : ''}`;
  div.dataset.index = index;
  div.dataset.id = item.id;
  
  div.innerHTML = `
    <div class="col-check">
      <button class="check-btn" aria-label="Toggle complete">✓</button>
    </div>
    <div class="col-qty">
      <input type="number" value="${item.quantity || ''}" placeholder="0" min="0" step="1">
    </div>
    <div class="col-name">
      <input type="text" value="${item.name || ''}" placeholder="Item name">
    </div>
    <div class="col-action">
      <button class="delete-btn" aria-label="Delete item">&times;</button>
    </div>
    <div class="col-drag">
      <span class="drag-handle" aria-label="Drag to reorder">☰</span>
    </div>
  `;
  
  const checkBtn = div.querySelector('.check-btn');
  const qtyInput = div.querySelector('.col-qty input');
  const nameInput = div.querySelector('.col-name input');
  const deleteBtn = div.querySelector('.delete-btn');
  
  checkBtn.addEventListener('click', () => {
    toggleListItemComplete(item.id);
  });
  
  qtyInput.addEventListener('input', () => {
    saveListItem(index, 'quantity', qtyInput.value);
  });
  
  nameInput.addEventListener('input', () => {
    saveListItem(index, 'name', nameInput.value);
  });
  
  deleteBtn.addEventListener('click', () => {
    const itemId = item.id;
    appData.listItems.splice(index, 1);
    if (itemId) {
      deleteListItem(itemId);
    }
    renderActiveItems();
    renderCompletedItems();
  });
  
  const dragHandle = div.querySelector('.drag-handle');
  if (dragHandle) {
    dragHandle.addEventListener('mousedown', handleDragStart, { passive: false });
    dragHandle.addEventListener('touchstart', handleDragStart, { passive: false });
  }
  
  return div;
}

let dragItem = null;
let dragClone = null;
let isDragging = false;

function handleDragStart(e) {
  const handle = e.target.closest('.drag-handle');
  if (!handle) return;
  
  const item = handle.closest('.list-item');
  if (!item || item.classList.contains('completed')) return;
  
  e.preventDefault();
  isDragging = true;
  dragItem = item;
  
  item.classList.add('dragging');
  
  dragClone = item.cloneNode(true);
  dragClone.style.position = 'fixed';
  dragClone.style.width = item.offsetWidth + 'px';
  dragClone.style.zIndex = '9999';
  dragClone.style.opacity = '0.8';
  dragClone.style.pointerEvents = 'none';
  document.body.appendChild(dragClone);
  
  if (e.type === 'touchstart') {
    updateClonePosition(e.touches[0]);
  } else {
    updateClonePosition(e);
  }
  
  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('touchmove', handleDragMove, { passive: false });
  document.addEventListener('mouseup', handleDragEnd);
  document.addEventListener('touchend', handleDragEnd);
}

function handleDragMove(e) {
  if (!dragItem || !dragClone || !isDragging) return;
  e.preventDefault();
  
  let clientX, clientY;
  if (e.type === 'touchmove') {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  
  dragClone.style.left = (clientX - 50) + 'px';
  dragClone.style.top = (clientY - 25) + 'px';
  
  const container = document.getElementById('active-items');
  const items = Array.from(container.querySelectorAll('.list-item:not(.dragging)'));
  
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    
    if (clientY < midY) {
      container.insertBefore(dragItem, item);
      break;
    } else if (item === items[items.length - 1]) {
      container.appendChild(dragItem);
    }
  }
}

function handleDragEnd(e) {
  if (!dragItem) return;
  
  dragItem.classList.remove('dragging');
  if (dragClone) {
    dragClone.remove();
    dragClone = null;
  }
  
  isDragging = false;
  dragItem = null;
  
  document.removeEventListener('mousemove', handleDragMove);
  document.removeEventListener('touchmove', handleDragMove);
  document.removeEventListener('mouseup', handleDragEnd);
  document.removeEventListener('touchend', handleDragEnd);
  
  handleListDragEnd(e);
}

function renderActiveItems() {
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
  renderActiveItems();
  renderCompletedItems();
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
  renderActiveItems();
  renderCompletedItems();
  updateTotalsDisplay();
  ensureEmptyRow();
  
  document.getElementById('toggle-shopping').addEventListener('click', () => toggleView('shopping'));
  document.getElementById('toggle-list').addEventListener('click', () => toggleView('list'));
  document.getElementById('add-item-btn').addEventListener('click', () => {
    if (appData.currentView === 'list') {
      addItemToList();
    } else {
      addEmptyRow();
    }
  });
}

let listPositionsToUpdate = [];

function handleListDragEnd(e) {
  const container = document.getElementById('active-items');
  const currentItems = Array.from(container.querySelectorAll('.list-item:not(.completed)'));
  
  listPositionsToUpdate = currentItems.map((item, index) => ({
    id: parseInt(item.dataset.id, 10),
    position: index
  }));
  
  if (listPositionsToUpdate.length > 0) {
    fetch(`${API_BASE}/list-items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: listPositionsToUpdate.map((p, i) => ({
        ...p,
        id: p.id,
        quantity: currentItems[i].querySelector('.col-qty input')?.value || '1',
        name: currentItems[i].querySelector('.col-name input')?.value || '',
        completed: false
      })) })
    }).then(async response => {
      if (response.ok) {
        appData.listItems.forEach(item => {
          const pos = listPositionsToUpdate.find(p => p.id === item.id);
          if (pos) {
            item.position = pos.position;
          }
        });
        appData.listItems.sort((a, b) => a.position - b.position);
      }
    }).catch(e => console.error('Error updating list positions:', e));
  }
}

function renderActiveItems() {
  const container = document.getElementById('active-items');
  const active = appData.listItems.filter(item => !item.completed);
  
  if (active.length === 0) {
    container.innerHTML = '<div class="empty-state">No active items</div>';
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
  const container = document.getElementById('completed-items');
  const completed = appData.listItems.filter(item => item.completed);
  
  const section = document.getElementById('completed-section');
  
  if (completed.length === 0) {
    section.classList.add('hidden');
    return;
  }
  
  section.classList.remove('hidden');
  container.innerHTML = '';
  completed.forEach((item, index) => {
    const originalIndex = appData.listItems.findIndex(it => it.id === item.id);
    const el = createListItemElement(item, originalIndex);
    el.classList.add('completed');
    container.appendChild(el);
  });
}

function toggleItemComplete(id) {
  const item = appData.items.find(i => i.id == id);
  if (!item) return;
  
  item.completed = !item.completed;
  
  renderActiveItems();
  renderCompletedItems();
  
  fetch(`${API_BASE}/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: item.completed })
  }).catch(e => console.error('Error updating complete:', e));
}

function addItemToList() {
  const item = { quantity: '1', name: '', completed: false };
  appData.listItems.push(item);
  renderActiveItems();
  renderCompletedItems();
  saveNewListItem(item);
  
  const container = document.getElementById('active-items');
  const lastItem = container.lastElementChild;
  if (lastItem) {
    const qtyInput = lastItem.querySelector('.col-qty input');
    if (qtyInput) {
      qtyInput.focus();
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
