import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KiShop</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="budget-section">
    <div class="budget-input-wrapper">
      <label for="max-budget">Budget:</label>
      <input type="text" id="max-budget" inputmode="decimal" placeholder="0.00">
    </div>
  </header>
  <main class="shopping-list-container">
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
      <span>Tax (11.5%):</span>
      <span id="tax">$0.00</span>
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
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.fetch = vi.fn();
global.console = console;

export default dom;
