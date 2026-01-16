const TAX_RATE = 0.115;
const STORAGE_KEY = 'kishop_data';

let appData = {
  maxBudget: 0,
  items: []
};

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      appData = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading data:', e);
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (e) {
    console.error('Error saving data:', e);
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
    totalQty += qty;
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

function sortItems() {
  appData.items.sort((a, b) => {
    const aHasPrice = a.price && parseFloat(a.price) > 0;
    const bHasPrice = b.price && parseFloat(b.price) > 0;
    
    if (!aHasPrice && bHasPrice) return -1;
    if (aHasPrice && !bHasPrice) return 1;
    
    const aQty = parseFloat(a.quantity) || 0;
    const bQty = parseFloat(b.quantity) || 0;
    if (aQty !== bQty) return bQty - aQty;
    
    const aPrice = parseFloat(a.price) || 0;
    const bPrice = parseFloat(b.price) || 0;
    return bPrice - aPrice;
  });
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
    appData.items[index].quantity = qtyInput.value;
    saveData();
    updateTotalsDisplay();
  });

  priceInput.addEventListener('input', () => {
    appData.items[index].price = priceInput.value;
    saveData();
    updateTotalsDisplay();
  });

  priceInput.addEventListener('blur', () => {
    sortItems();
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
    appData.items.splice(index, 1);
    saveData();
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
  appData.items.push({ quantity: '1', price: '' });
  saveData();
  renderList();
  updateTotalsDisplay();

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
    appData.items = [];
    saveData();
    renderList();
    updateTotalsDisplay();
    addEmptyRow();
  }
}

function init() {
  loadData();

  const maxBudgetInput = document.getElementById('max-budget');
  maxBudgetInput.value = appData.maxBudget || '';

  maxBudgetInput.addEventListener('input', () => {
    appData.maxBudget = maxBudgetInput.value;
    saveData();
    updateTotalsDisplay();
  });

  document.addEventListener('click', handleListClick);
  document.addEventListener('keydown', handleKeyPress);

  document.getElementById('clear-all').addEventListener('click', clearAll);

  renderList();
  updateTotalsDisplay();
  ensureEmptyRow();
}

document.addEventListener('DOMContentLoaded', init);
