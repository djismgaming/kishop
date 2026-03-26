/**
 * Database Unit Tests for KiShop Backend
 * Tests all exported functions from database.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const TEST_DB_PATH = ':memory:';

function createTestDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(TEST_DB_PATH, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function initTables(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS budget_data (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          max_budget REAL DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        db.run(`
          CREATE TABLE IF NOT EXISTS budget_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quantity TEXT NOT NULL DEFAULT '1',
            price TEXT DEFAULT '',
            name TEXT DEFAULT '',
            position INTEGER NOT NULL,
            completed INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          db.run(`
            CREATE TABLE IF NOT EXISTS list_items (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              quantity TEXT NOT NULL DEFAULT '1',
              name TEXT DEFAULT '',
              position INTEGER NOT NULL,
              completed INTEGER DEFAULT 0,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) reject(err);
            db.run('INSERT INTO budget_data (id, max_budget) VALUES (1, 0)', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });
      });
    });
  });
}

function ensureInitialData(db) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM budget_data WHERE id = 1', (err, row) => {
      if (err) { reject(err); return; }
      if (!row) {
        db.run('INSERT INTO budget_data (id, max_budget) VALUES (1, 0)', (err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

function getBudget(db) {
  return new Promise((resolve, reject) => {
    db.get('SELECT max_budget FROM budget_data WHERE id = 1', (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.max_budget : 0);
    });
  });
}

function updateBudget(db, maxBudget) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE budget_data SET max_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [maxBudget], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

function getItems(db) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, quantity, price, name, position, completed FROM budget_items ORDER BY position ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function addItem(db, item) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO budget_items (quantity, price, position, name) VALUES (?, ?, COALESCE((SELECT MAX(position) FROM budget_items), -1) + 1, ?)');
    stmt.run([item.quantity, item.price, item.name || ''], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
    stmt.finalize();
  });
}

function updateItem(db, id, item) {
  return new Promise((resolve, reject) => {
    const updates = [];
    const values = [];
    if (item.quantity !== undefined) { updates.push('quantity = ?'); values.push(item.quantity); }
    if (item.price !== undefined) { updates.push('price = ?'); values.push(item.price); }
    if (item.name !== undefined) { updates.push('name = ?'); values.push(item.name); }
    if (item.completed !== undefined) { updates.push('completed = ?'); values.push(item.completed ? 1 : 0); }
    
    if (updates.length === 0) { resolve(0); return; }
    
    values.push(id);
    db.run(`UPDATE budget_items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values, function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

function deleteItem(db, id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM budget_items WHERE id = ?', [id], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

function bulkUpdateItems(db, items) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM budget_items', (err) => {
        if (err) { reject(err); return; }
        if (items.length === 0) { resolve(); return; }
        
        const stmt = db.prepare('INSERT INTO budget_items (quantity, price, position, name, completed) VALUES (?, ?, ?, ?, ?)');
        let pending = items.length;
        
        items.forEach((item, index) => {
          stmt.run([item.quantity, item.price, index, item.name || '', item.completed ? 1 : 0], (err) => {
            if (err) { reject(err); pending = 0; return; }
            pending--;
            if (pending === 0) {
              stmt.finalize();
              resolve();
            }
          });
        });
      });
    });
  });
}

function bulkUpdatePositions(db, positions) {
  return new Promise((resolve, reject) => {
    if (!positions || positions.length === 0) { resolve(); return; }
    db.serialize(() => {
      const stmt = db.prepare('UPDATE budget_items SET position = ? WHERE id = ?');
      let pending = positions.length;
      
      positions.forEach(pos => {
        stmt.run([pos.position, pos.id], (err) => {
          if (err) { reject(err); pending = 0; return; }
          pending--;
          if (pending === 0) {
            stmt.finalize();
            resolve();
          }
        });
      });
    });
  });
}

function getListItems(db) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, quantity, name, position, completed FROM list_items ORDER BY position ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function addListItem(db, item) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO list_items (quantity, name, position) VALUES (?, ?, COALESCE((SELECT MAX(position) FROM list_items), -1) + 1)');
    stmt.run([item.quantity, item.name || ''], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
    stmt.finalize();
  });
}

function updateListItem(db, id, item) {
  return new Promise((resolve, reject) => {
    const updates = [];
    const values = [];
    if (item.quantity !== undefined) { updates.push('quantity = ?'); values.push(item.quantity); }
    if (item.name !== undefined) { updates.push('name = ?'); values.push(item.name); }
    if (item.completed !== undefined) { updates.push('completed = ?'); values.push(item.completed ? 1 : 0); }
    
    if (updates.length === 0) { resolve(0); return; }
    
    values.push(id);
    db.run(`UPDATE list_items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values, function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

function deleteListItem(db, id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM list_items WHERE id = ?', [id], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

function bulkUpdateListItems(db, items) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM list_items', (err) => {
        if (err) { reject(err); return; }
        if (items.length === 0) { resolve(); return; }
        
        const stmt = db.prepare('INSERT INTO list_items (quantity, name, position, completed) VALUES (?, ?, ?, ?)');
        let pending = items.length;
        
        items.forEach((item, index) => {
          stmt.run([item.quantity, item.name || '', index, item.completed ? 1 : 0], (err) => {
            if (err) { reject(err); pending = 0; return; }
            pending--;
            if (pending === 0) {
              stmt.finalize();
              resolve();
            }
          });
        });
      });
    });
  });
}

describe('Database Module', () => {
  let db;

  beforeEach(async () => {
    db = await createTestDb();
    await initTables(db);
  });

  afterEach(async () => {
    await new Promise(resolve => db.close(resolve));
  });

  describe('initTables', () => {
    test('should create all required tables', async () => {
      const tables = await new Promise((resolve, reject) => {
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(r => r.name));
        });
      });
      
      expect(tables).toContain('budget_data');
      expect(tables).toContain('budget_items');
      expect(tables).toContain('list_items');
    });

    test('should initialize budget_data with default budget of 0', async () => {
      const budget = await getBudget(db);
      expect(budget).toBe(0);
    });
  });

  describe('ensureInitialData', () => {
    test('should insert default budget row if it does not exist', async () => {
      await new Promise(resolve => db.run('DELETE FROM budget_data WHERE id = 1', resolve));
      await ensureInitialData(db);
      const budget = await getBudget(db);
      expect(budget).toBe(0);
    });

    test('should not duplicate existing budget row', async () => {
      await ensureInitialData(db);
      await ensureInitialData(db);
      const budget = await getBudget(db);
      expect(budget).toBe(0);
    });
  });

  describe('getBudget', () => {
    test('should return default budget of 0 when no data exists', async () => {
      const budget = await getBudget(db);
      expect(budget).toBe(0);
    });

    test('should return updated budget value', async () => {
      await updateBudget(db, 100);
      const budget = await getBudget(db);
      expect(budget).toBe(100);
    });
  });

  describe('updateBudget', () => {
    test('should update budget successfully', async () => {
      const changes = await updateBudget(db, 50);
      expect(changes).toBe(1);
      const budget = await getBudget(db);
      expect(budget).toBe(50);
    });
  });

  describe('getItems', () => {
    test('should return empty array when no items', async () => {
      const items = await getItems(db);
      expect(items).toEqual([]);
    });

    test('should return items with all fields', async () => {
      await addItem(db, { quantity: '2', price: '5.99', name: 'Test Item' });
      const items = await getItems(db);
      expect(items.length).toBe(1);
      expect(items[0].name).toBe('Test Item');
      expect(items[0].quantity).toBe('2');
    });

    test('should order items by position', async () => {
      await addItem(db, { quantity: '1', price: '1', name: 'Item A' });
      await addItem(db, { quantity: '1', price: '2', name: 'Item B' });
      const items = await getItems(db);
      expect(items[0].name).toBe('Item A');
      expect(items[1].name).toBe('Item B');
    });
  });

  describe('addItem', () => {
    test('should create new item with auto-position', async () => {
      const id = await addItem(db, { quantity: '3', price: '2.50', name: 'New Item' });
      expect(id).toBeDefined();
      const items = await getItems(db);
      expect(items[0].name).toBe('New Item');
    });

    test('should handle missing optional fields', async () => {
      const id = await addItem(db, { quantity: '1', price: '1' });
      expect(id).toBeDefined();
    });
  });

  describe('updateItem', () => {
    test('should modify quantity', async () => {
      const id = await addItem(db, { quantity: '1', price: '1', name: 'Test' });
      await updateItem(db, id, { quantity: '5' });
      const items = await getItems(db);
      expect(items[0].quantity).toBe('5');
    });

    test('should modify price', async () => {
      const id = await addItem(db, { quantity: '1', price: '1', name: 'Test' });
      await updateItem(db, id, { price: '9.99' });
      const items = await getItems(db);
      expect(items[0].price).toBe('9.99');
    });

    test('should modify name', async () => {
      const id = await addItem(db, { quantity: '1', price: '1', name: 'Old Name' });
      await updateItem(db, id, { name: 'New Name' });
      const items = await getItems(db);
      expect(items[0].name).toBe('New Name');
    });

    test('should toggle completed', async () => {
      const id = await addItem(db, { quantity: '1', price: '1', name: 'Test' });
      await updateItem(db, id, { completed: true });
      const items = await getItems(db);
      expect(items[0].completed).toBe(1);
    });

    test('should do nothing when no fields provided', async () => {
      const id = await addItem(db, { quantity: '1', price: '1', name: 'Test' });
      const changes = await updateItem(db, id, {});
      expect(changes).toBe(0);
    });
  });

  describe('deleteItem', () => {
    test('should delete single item', async () => {
      const id = await addItem(db, { quantity: '1', price: '1', name: 'To Delete' });
      const changes = await deleteItem(db, id);
      expect(changes).toBe(1);
      const items = await getItems(db);
      expect(items.length).toBe(0);
    });

    test('should return 0 for non-existent id', async () => {
      const changes = await deleteItem(db, 99999);
      expect(changes).toBe(0);
    });
  });

  describe('bulkUpdateItems', () => {
    test('should replace all items', async () => {
      const items = [
        { quantity: '1', price: '10', name: 'Item 1', completed: false },
        { quantity: '2', price: '20', name: 'Item 2', completed: true }
      ];
      await bulkUpdateItems(db, items);
      const result = await getItems(db);
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Item 1');
    });

    test('should handle empty items array', async () => {
      await bulkUpdateItems(db, []);
      const result = await getItems(db);
      expect(result).toEqual([]);
    });
  });

  describe('bulkUpdatePositions', () => {
    test('should update item positions', async () => {
      const id = await addItem(db, { quantity: '1', price: '1', name: 'Item A' });
      await bulkUpdatePositions(db, [{ id, position: 5 }]);
      const items = await getItems(db);
      expect(items[0].position).toBe(5);
    });

    test('should handle empty positions array', async () => {
      await bulkUpdatePositions(db, []);
      // Should not throw
    });
  });

  describe('getListItems', () => {
    test('should return empty array when no items', async () => {
      const items = await getListItems(db);
      expect(items).toEqual([]);
    });

    test('should return multiple items', async () => {
      await addListItem(db, { quantity: '1', name: 'List Item 1' });
      await addListItem(db, { quantity: '2', name: 'List Item 2' });
      const items = await getListItems(db);
      expect(items.length).toBe(2);
    });
  });

  describe('addListItem', () => {
    test('should create new list item with auto-position', async () => {
      const id = await addListItem(db, { quantity: '3', name: 'New List Item' });
      expect(id).toBeDefined();
      const items = await getListItems(db);
      expect(items[0].name).toBe('New List Item');
    });
  });

  describe('updateListItem', () => {
    test('should modify quantity', async () => {
      const id = await addListItem(db, { quantity: '1', name: 'Test' });
      await updateListItem(db, id, { quantity: '5' });
      const items = await getListItems(db);
      expect(items[0].quantity).toBe('5');
    });

    test('should modify name', async () => {
      const id = await addListItem(db, { quantity: '1', name: 'Old' });
      await updateListItem(db, id, { name: 'New' });
      const items = await getListItems(db);
      expect(items[0].name).toBe('New');
    });

    test('should toggle completed', async () => {
      const id = await addListItem(db, { quantity: '1', name: 'Test' });
      await updateListItem(db, id, { completed: true });
      const items = await getListItems(db);
      expect(items[0].completed).toBe(1);
    });
  });

  describe('deleteListItem', () => {
    test('should delete single list item', async () => {
      const id = await addListItem(db, { quantity: '1', name: 'To Delete' });
      const changes = await deleteListItem(db, id);
      expect(changes).toBe(1);
      const items = await getListItems(db);
      expect(items.length).toBe(0);
    });
  });

  describe('bulkUpdateListItems', () => {
    test('should replace all list items', async () => {
      const items = [
        { quantity: '1', name: 'Item 1', completed: false },
        { quantity: '2', name: 'Item 2', completed: true }
      ];
      await bulkUpdateListItems(db, items);
      const result = await getListItems(db);
      expect(result.length).toBe(2);
    });
  });
});
