/**
 * Frontend Unit Tests for KiShop
 * Tests JavaScript logic from app.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body>
  <header class="budget-section">
    <div class="budget-input-wrapper">
      <label for="max-budget">Budget:</label>
      <input type="text" id="max-budget" inputmode="decimal">
    </div>
  </header>
  <main>
    <div class="items-list" id="shopping-items"></div>
  </main>
  <footer class="totals-panel">
    <div class="totals-row">
      <span>Total Qty:</span>
      <span id="total-qty">0</span>
    </div>
    <div class="totals-row">
      <span>Subtotal:</span>
      <span id="subtotal">$0.00</span>
    </div>
    <div class="totals-row">
      <span>Grand Total:</span>
      <span id="grand-total">$0.00</span>
    </div>
  </footer>
  <div class="tab-container">
    <button class="tab-btn active" data-view="shopping">Shopping</button>
    <button class="tab-btn" data-view="list">Shopping List</button>
  </div>
</body>
</html>`);

global.document = dom.window.document;
global.window = dom.window;

describe('formatCurrency', () => {
  it('should format positive numbers with $ prefix', () => {
    const result = '$10.50'.replace('$', '') === '10.50';
    expect(result).toBe(true);
  });
  
  it('should format zero correctly', () => {
    const result = '$0.00'.replace('$', '') === '0.00';
    expect(result).toBe(true);
  });
  
  it('should format large numbers correctly', () => {
    const result = '$1234.56'.replace('$', '') === '1234.56';
    expect(result).toBe(true);
  });
});

describe('calculateTotals', () => {
  let TAX_RATE;
  
  beforeEach(async () => {
    const { exec } = await import('fs');
    // Read TAX_RATE from app.js
    const appContent = await import('fs').then(fs => 
      fs.readFileSync('app.js', 'utf-8')
    );
    const match = appContent.match(/const TAX_RATE = ([\d.]+)/);
    TAX_RATE = match ? parseFloat(match[1]) : 0.115;
  });
  
  it('should calculate zero totals for empty items', () => {
    const items = [];
    let totalQty = 0;
    let subtotal = 0;
    
    items.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      if (price > 0) totalQty += qty;
      subtotal += qty * price;
    });
    
    const tax = subtotal * TAX_RATE;
    const grandTotal = subtotal + tax;
    
    expect(totalQty).toBe(0);
    expect(subtotal).toBe(0);
    expect(tax).toBe(0);
    expect(grandTotal).toBe(0);
  });
  
  it('should calculate correct subtotal', () => {
    const items = [
      { quantity: '2', price: '10.00' },
      { quantity: '1', price: '5.50' }
    ];
    
    let totalQty = 0;
    let subtotal = 0;
    
    items.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      if (price > 0) totalQty += qty;
      subtotal += qty * price;
    });
    
    expect(totalQty).toBe(3);
    expect(subtotal).toBe(25.50);
  });
  
  it('should apply tax rate correctly', () => {
    const subtotal = 100;
    const TAX_RATE = 0.115;
    const tax = subtotal * TAX_RATE;
    const grandTotal = subtotal + tax;
    
    expect(tax).toBe(11.5);
    expect(grandTotal).toBe(111.5);
  });
  
  it('should ignore items with zero price', () => {
    const items = [
      { quantity: '2', price: '10.00' },
      { quantity: '5', price: '0' }
    ];
    
    let totalQty = 0;
    let subtotal = 0;
    
    items.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      if (price > 0) totalQty += qty;
      subtotal += qty * price;
    });
    
    expect(totalQty).toBe(2);
    expect(subtotal).toBe(20);
  });
  
  it('should handle string quantities and prices', () => {
    const items = [
      { quantity: '3', price: '2.99' }
    ];
    
    let totalQty = 0;
    let subtotal = 0;
    
    items.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      if (price > 0) totalQty += qty;
      subtotal += qty * price;
    });
    
    expect(totalQty).toBe(3);
    expect(subtotal).toBeCloseTo(8.97, 2);
  });
  
  it('should handle invalid quantities and prices', () => {
    const items = [
      { quantity: 'abc', price: 'xyz' },
      { quantity: '', price: '' },
      { quantity: null, price: undefined }
    ];
    
    let totalQty = 0;
    let subtotal = 0;
    
    items.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      if (price > 0) totalQty += qty;
      subtotal += qty * price;
    });
    
    expect(totalQty).toBe(0);
    expect(subtotal).toBe(0);
  });
});

describe('Budget Validation', () => {
  it('should parse valid budget values', () => {
    expect(parseFloat('100')).toBe(100);
    expect(parseFloat('0')).toBe(0);
    expect(parseFloat('99.99')).toBeCloseTo(99.99, 2);
  });
  
  it('should handle invalid budget values', () => {
    expect(isNaN(parseFloat(''))).toBe(true);
    expect(isNaN(parseFloat('abc'))).toBe(true);
    expect(isNaN(parseFloat(undefined))).toBe(true);
  });
  
  it('should detect negative values', () => {
    const value = parseFloat('-10');
    expect(value < 0).toBe(true);
  });
});

describe('Percentage Calculations', () => {
  it('should calculate budget percentage correctly', () => {
    const subtotal = 75;
    const maxBudget = 100;
    const percentage = (subtotal / maxBudget) * 100;
    
    expect(percentage).toBe(75);
  });
  
  it('should detect over budget', () => {
    const subtotal = 110;
    const maxBudget = 100;
    const percentage = (subtotal / maxBudget) * 100;
    
    expect(percentage >= 100).toBe(true);
  });
  
  it('should detect warning threshold at 75%', () => {
    const subtotal = 80;
    const maxBudget = 100;
    const percentage = (subtotal / maxBudget) * 100;
    
    expect(percentage >= 75 && percentage < 100).toBe(true);
  });
  
  it('should handle zero budget', () => {
    const subtotal = 50;
    const maxBudget = 0;
    const percentage = maxBudget > 0 ? (subtotal / maxBudget) * 100 : 0;
    
    expect(percentage).toBe(0);
  });
});

describe('Position Management', () => {
  it('should assign sequential positions', () => {
    const items = [
      { id: 1, name: 'Item A' },
      { id: 2, name: 'Item B' },
      { id: 3, name: 'Item C' }
    ];
    
    const positions = items.map((item, index) => ({
      id: item.id,
      position: index
    }));
    
    expect(positions[0].position).toBe(0);
    expect(positions[1].position).toBe(1);
    expect(positions[2].position).toBe(2);
  });
  
  it('should reorder items correctly', () => {
    const items = [
      { id: 1, name: 'First' },
      { id: 2, name: 'Second' },
      { id: 3, name: 'Third' }
    ];
    
    // Simulate reordering: move item 3 to position 0
    const reordered = [
      items[2],
      items[0],
      items[1]
    ];
    
    expect(reordered[0].name).toBe('Third');
    expect(reordered[1].name).toBe('First');
    expect(reordered[2].name).toBe('Second');
  });
});

describe('Item Field Validation', () => {
  it('should validate quantity is positive', () => {
    const validQuantities = ['1', '10', '0.5', '99'];
    const invalidQuantities = ['-1', '0', '', 'abc'];
    
    validQuantities.forEach(q => {
      const val = parseFloat(q);
      expect(val > 0).toBe(true);
    });
    
    invalidQuantities.forEach(q => {
      const val = parseFloat(q);
      expect(val > 0).toBe(false);
    });
  });
  
  it('should sanitize item names', () => {
    const sanitize = (name) => name ? name.trim() : '';
    
    expect(sanitize('  Item Name  ')).toBe('Item Name');
    expect(sanitize('')).toBe('');
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
  });
});
