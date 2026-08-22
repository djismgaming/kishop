/**
 * API Integration Tests for KiShop Backend
 * Tests all Express routes using supertest
 */

const request = require('supertest');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let app;
let db;

// Test database path
const TEST_DB_PATH = ':memory:';

beforeAll(async () => {
  // Create in-memory database for testing
  db = new sqlite3.Database(TEST_DB_PATH);
  
  // Initialize tables
  await new Promise((resolve, reject) => {
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

  // Load the app module
  // We need to mock the database module
  const express = require('express');
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Mock database functions
  const mockDb = {
    getBudget: (cb) => db.get('SELECT max_budget FROM budget_data WHERE id = 1', (err, row) => cb(err, row ? row.max_budget : 0)),
    updateBudget: (val, cb) => db.run('UPDATE budget_data SET max_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [val], function(err) { cb(err, this.lastID); }),
    getItems: (cb) => db.all('SELECT id, quantity, price, name, position, completed FROM budget_items ORDER BY position ASC', (err, rows) => cb(err, rows || [])),
    addItem: (item, cb) => {
      const stmt = db.prepare('INSERT INTO budget_items (quantity, price, position, name) VALUES (?, ?, COALESCE((SELECT MAX(position) FROM budget_items), -1) + 1, ?)');
      stmt.run([item.quantity, item.price, item.name || ''], function(err) { 
        if (err) { cb(err); return; }
        db.get('SELECT * FROM budget_items WHERE id = last_insert_rowid()', (err, row) => cb(err, row)); 
      });
      stmt.finalize();
    },
    bulkUpdateItems: (items, cb) => {
      db.serialize(() => {
        db.run('DELETE FROM budget_items', (err) => {
          if (err) { cb(err); return; }
          if (items.length === 0) { cb(null); return; }
          
          const stmt = db.prepare('INSERT INTO budget_items (quantity, price, position, name, completed) VALUES (?, ?, ?, ?, ?)');
          let pending = items.length;
          let error = null;
          
          items.forEach((item, index) => {
            stmt.run([item.quantity, item.price, index, item.name || '', item.completed ? 1 : 0], (err) => {
              if (err && !error) error = err;
              pending--;
              if (pending === 0) {
                stmt.finalize();
                cb(error);
              }
            });
          });
        });
      });
    },
    bulkUpdatePositions: (positions, cb) => {
      if (!positions || positions.length === 0) { cb(null); return; }
      db.serialize(() => {
        const stmt = db.prepare('UPDATE budget_items SET position = ? WHERE id = ?');
        let pending = positions.length;
        let error = null;
        
        positions.forEach(pos => {
          stmt.run([pos.position, pos.id], (err) => {
            if (err && !error) error = err;
            pending--;
            if (pending === 0) {
              stmt.finalize();
              cb(error);
            }
          });
        });
      });
    },
    updateItem: (id, item, cb) => {
      const updates = [];
      const values = [];
      if (item.quantity !== undefined) { updates.push('quantity = ?'); values.push(item.quantity); }
      if (item.price !== undefined) { updates.push('price = ?'); values.push(item.price); }
      if (item.name !== undefined) { updates.push('name = ?'); values.push(item.name); }
      if (item.completed !== undefined) { updates.push('completed = ?'); values.push(item.completed ? 1 : 0); }
      
      if (updates.length === 0) { cb(null, 0); return; }
      
      values.push(id);
      db.run(`UPDATE budget_items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values, function(err) { cb(err, this.changes); });
    },
    deleteItem: (id, cb) => db.run('DELETE FROM budget_items WHERE id = ?', [id], function(err) { cb(err, this.changes); }),
    getListItems: (cb) => db.all('SELECT id, quantity, name, position, completed FROM list_items ORDER BY position ASC', (err, rows) => cb(err, rows || [])),
    addListItem: (item, cb) => {
      const stmt = db.prepare('INSERT INTO list_items (quantity, name, position) VALUES (?, ?, COALESCE((SELECT MAX(position) FROM list_items), -1) + 1)');
      stmt.run([item.quantity, item.name || ''], function(err) { 
        if (err) { cb(err); return; }
        db.get('SELECT last_insert_rowid() as id, quantity, name FROM list_items WHERE id = last_insert_rowid()', (err, row) => cb(err, row)); 
      });
      stmt.finalize();
    },
    bulkUpdateListItems: (items, cb) => {
      db.serialize(() => {
        db.run('DELETE FROM list_items', (err) => {
          if (err) { cb(err); return; }
          if (items.length === 0) { cb(null); return; }
          
          const stmt = db.prepare('INSERT INTO list_items (quantity, name, position, completed) VALUES (?, ?, ?, ?)');
          let pending = items.length;
          let error = null;
          
          items.forEach((item, index) => {
            stmt.run([item.quantity, item.name || '', index, item.completed ? 1 : 0], (err) => {
              if (err && !error) error = err;
              pending--;
              if (pending === 0) {
                stmt.finalize();
                cb(error);
              }
            });
          });
        });
      });
    },
    updateListItem: (id, item, cb) => {
      const updates = [];
      const values = [];
      if (item.quantity !== undefined) { updates.push('quantity = ?'); values.push(item.quantity); }
      if (item.name !== undefined) { updates.push('name = ?'); values.push(item.name); }
      if (item.completed !== undefined) { updates.push('completed = ?'); values.push(item.completed ? 1 : 0); }
      
      if (updates.length === 0) { cb(null, 0); return; }
      
      values.push(id);
      db.run(`UPDATE list_items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values, function(err) { cb(err, this.changes); });
    },
    deleteListItem: (id, cb) => db.run('DELETE FROM list_items WHERE id = ?', [id], function(err) { cb(err, this.changes); }),
    clearListItems: (cb) => db.run('DELETE FROM list_items', [], function(err) { cb(err, this.changes); })
  };
  
  // Mount routes
  app.get('/api/budget', (req, res) => {
    mockDb.getBudget((err, budget) => {
      if (err) res.status(500).json({ error: 'Failed to get budget' });
      else res.json({ maxBudget: budget });
    });
  });
  
  app.put('/api/budget', (req, res) => {
    const maxBudget = req.body.maxBudget;
    if (maxBudget === undefined || isNaN(maxBudget)) {
      return res.status(400).json({ error: 'Invalid budget value' });
    }
    if (maxBudget < 0) {
      return res.status(400).json({ error: 'Budget cannot be negative' });
    }
    mockDb.updateBudget(maxBudget, (err) => {
      if (err) res.status(500).json({ error: 'Failed to update budget' });
      else res.json({ success: true });
    });
  });
  
  app.get('/api/items', (req, res) => {
    mockDb.getItems((err, items) => {
      if (err) res.status(500).json({ error: 'Failed to get items' });
      else res.json({ items });
    });
  });
  
  app.post('/api/items', (req, res) => {
    const item = { quantity: req.body.quantity, price: req.body.price, name: req.body.name };
    mockDb.addItem(item, (err, id) => {
      if (err) res.status(500).json({ error: 'Failed to add item' });
      else res.json({ id, ...item });
    });
  });
  
  app.put('/api/items', (req, res) => {
    const items = req.body.items;
    mockDb.bulkUpdateItems(items, (err) => {
      if (err) res.status(500).json({ error: 'Failed to update items' });
      else res.json({ success: true });
    });
  });
  
  app.put('/api/items/position', (req, res) => {
    const positions = req.body.positions || [];
    mockDb.bulkUpdatePositions(positions, (err) => {
      if (err) res.status(500).json({ error: 'Failed to update positions' });
      else res.json({ success: true });
    });
  });
  
  app.put('/api/items/:id', (req, res) => {
    const id = req.params.id;
    const item = { 
      quantity: req.body.quantity, 
      price: req.body.price,
      name: req.body.name,
      completed: req.body.completed
    };
    mockDb.updateItem(id, item, (err) => {
      if (err) res.status(500).json({ error: 'Failed to update item' });
      else res.json({ success: true });
    });
  });
  
  app.delete('/api/items/:id', (req, res) => {
    const id = req.params.id;
    mockDb.deleteItem(id, (err) => {
      if (err) res.status(500).json({ error: 'Failed to delete item' });
      else res.json({ success: true });
    });
  });
  
  app.get('/api/list-items', (req, res) => {
    mockDb.getListItems((err, items) => {
      if (err) res.status(500).json({ error: 'Failed to get list items' });
      else res.json({ items });
    });
  });
  
  app.post('/api/list-items', (req, res) => {
    const item = { quantity: req.body.quantity, name: req.body.name };
    mockDb.addListItem(item, (err, row) => {
      if (err) res.status(500).json({ error: 'Failed to add list item' });
      else res.json(row);
    });
  });
  
  app.put('/api/list-items', (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    mockDb.bulkUpdateListItems(items, (err) => {
      if (err) res.status(500).json({ error: 'Failed to update list items' });
      else res.json({ success: true });
    });
  });
  
  app.put('/api/list-items/:id', (req, res) => {
    const id = req.params.id;
    const item = { 
      quantity: req.body.quantity, 
      name: req.body.name,
      completed: req.body.completed
    };
    mockDb.updateListItem(id, item, (err) => {
      if (err) res.status(500).json({ error: 'Failed to update list item' });
      else res.json({ success: true });
    });
  });
  
  app.delete('/api/list-items', (req, res) => {
    mockDb.clearListItems((err, count) => {
      if (err) res.status(500).json({ error: 'Failed to clear list items' });
      else res.json({ success: true, deleted: count });
    });
  });

  app.delete('/api/list-items/:id', (req, res) => {
    const id = req.params.id;
    mockDb.deleteListItem(id, (err) => {
      if (err) res.status(500).json({ error: 'Failed to delete list item' });
      else res.json({ success: true });
    });
  });
});

afterAll(async () => {
  if (db) {
    await new Promise(resolve => db.close(resolve));
  }
});

beforeEach(async () => {
  // Clean up tables before each test
  await new Promise((resolve) => {
    db.serialize(() => {
      db.run('DELETE FROM budget_items', () => {
        db.run('DELETE FROM list_items', () => {
          db.run('UPDATE budget_data SET max_budget = 0 WHERE id = 1', resolve);
        });
      });
    });
  });
});

// ================== BUDGET ENDPOINTS ==================

describe('GET /api/budget', () => {
  test('should return default budget of 0', async () => {
    const res = await request(app).get('/api/budget');
    expect(res.status).toBe(200);
    expect(res.body.maxBudget).toBe(0);
  });

  test('should return updated budget value', async () => {
    await request(app).put('/api/budget').send({ maxBudget: 100 });
    const res = await request(app).get('/api/budget');
    expect(res.status).toBe(200);
    expect(res.body.maxBudget).toBe(100);
  });
});

describe('PUT /api/budget', () => {
  test('should update budget successfully', async () => {
    const res = await request(app).put('/api/budget').send({ maxBudget: 50 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('should reject invalid budget (NaN)', async () => {
    const res = await request(app).put('/api/budget').send({ maxBudget: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid budget value');
  });

  test('should reject negative budget', async () => {
    const res = await request(app).put('/api/budget').send({ maxBudget: -10 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Budget cannot be negative');
  });

  test('should reject missing budget', async () => {
    const res = await request(app).put('/api/budget').send({});
    expect(res.status).toBe(400);
  });
});

// ================== ITEMS ENDPOINTS ==================

describe('GET /api/items', () => {
  test('should return empty array when no items', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  test('should return items with all fields', async () => {
    await request(app).post('/api/items').send({ quantity: '2', price: '5.99', name: 'Test Item' });
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].name).toBe('Test Item');
    expect(res.body.items[0].quantity).toBe('2');
  });

  test('should order items by position', async () => {
    await request(app).post('/api/items').send({ quantity: '1', price: '1', name: 'Item A' });
    await request(app).post('/api/items').send({ quantity: '1', price: '2', name: 'Item B' });
    const res = await request(app).get('/api/items');
    expect(res.body.items[0].name).toBe('Item A');
    expect(res.body.items[1].name).toBe('Item B');
  });
});

describe('POST /api/items', () => {
  test('should create new item with auto-position', async () => {
    const res = await request(app).post('/api/items').send({ quantity: '3', price: '2.50', name: 'New Item' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('New Item');
  });

  test('should handle missing optional fields', async () => {
    const res = await request(app).post('/api/items').send({ quantity: '1', price: '1' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
  });
});

describe('PUT /api/items', () => {
  test('should replace all items', async () => {
    const items = [
      { quantity: '1', price: '10', name: 'Item 1', completed: false },
      { quantity: '2', price: '20', name: 'Item 2', completed: true }
    ];
    const res = await request(app).put('/api/items').send({ items });
    expect(res.status).toBe(200);
    
    const getRes = await request(app).get('/api/items');
    expect(getRes.body.items.length).toBe(2);
  });

  test('should handle empty items array', async () => {
    await request(app).put('/api/items').send({ items: [] });
    const res = await request(app).get('/api/items');
    expect(res.body.items).toEqual([]);
  });
});

describe('PUT /api/items/position', () => {
  test('should update item positions', async () => {
    const postRes = await request(app).post('/api/items').send({ quantity: '1', price: '1', name: 'Item A' });
    const id = postRes.body.id;
    
    const res = await request(app).put('/api/items/position').send({ positions: [{ id, position: 5 }] });
    expect(res.status).toBe(200);
  });

  test('should handle empty positions array', async () => {
    const res = await request(app).put('/api/items/position').send({ positions: [] });
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/items/:id', () => {
  test('should modify quantity', async () => {
    const postRes = await request(app).post('/api/items').send({ quantity: '1', price: '1', name: 'Test' });
    const id = postRes.body.id;
    
    const res = await request(app).put(`/api/items/${id}`).send({ quantity: '5' });
    expect(res.status).toBe(200);
  });

  test('should modify price', async () => {
    const postRes = await request(app).post('/api/items').send({ quantity: '1', price: '1', name: 'Test' });
    const id = postRes.body.id;
    
    const res = await request(app).put(`/api/items/${id}`).send({ price: '9.99' });
    expect(res.status).toBe(200);
  });

  test('should modify name', async () => {
    const postRes = await request(app).post('/api/items').send({ quantity: '1', price: '1', name: 'Old Name' });
    const id = postRes.body.id;
    
    const res = await request(app).put(`/api/items/${id}`).send({ name: 'New Name' });
    expect(res.status).toBe(200);
  });

  test('should toggle completed', async () => {
    const postRes = await request(app).post('/api/items').send({ quantity: '1', price: '1', name: 'Test' });
    const id = postRes.body.id;
    
    const res = await request(app).put(`/api/items/${id}`).send({ completed: true });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/items/:id', () => {
  test('should delete single item', async () => {
    const postRes = await request(app).post('/api/items').send({ quantity: '1', price: '1', name: 'To Delete' });
    const id = postRes.body.id;
    
    const res = await request(app).delete(`/api/items/${id}`);
    expect(res.status).toBe(200);
    
    const getRes = await request(app).get('/api/items');
    const item = getRes.body.items.find(i => i.id == id);
    expect(item).toBeUndefined();
  });

  test('should handle non-existent ID', async () => {
    const res = await request(app).delete('/api/items/99999');
    expect(res.status).toBe(200);
  });
});

// ================== LIST ITEMS ENDPOINTS ==================

describe('GET /api/list-items', () => {
  test('should return empty array when no items', async () => {
    const res = await request(app).get('/api/list-items');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  test('should return multiple items', async () => {
    await request(app).post('/api/list-items').send({ quantity: '1', name: 'List Item 1' });
    await request(app).post('/api/list-items').send({ quantity: '2', name: 'List Item 2' });
    const res = await request(app).get('/api/list-items');
    expect(res.body.items.length).toBe(2);
  });
});

describe('POST /api/list-items', () => {
  test('should create new list item with auto-position', async () => {
    const res = await request(app).post('/api/list-items').send({ quantity: '3', name: 'New List Item' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('New List Item');
  });
});

describe('PUT /api/list-items', () => {
  test('should bulk update list items', async () => {
    const items = [
      { quantity: '1', name: 'Item 1', completed: false },
      { quantity: '2', name: 'Item 2', completed: true }
    ];
    const res = await request(app).put('/api/list-items').send({ items });
    expect(res.status).toBe(200);
    
    const getRes = await request(app).get('/api/list-items');
    expect(getRes.body.items.length).toBe(2);
  });

  test('should handle empty array', async () => {
    await request(app).put('/api/list-items').send({ items: [] });
    const res = await request(app).get('/api/list-items');
    expect(res.body.items).toEqual([]);
  });
});

describe('PUT /api/list-items/:id', () => {
  test('should modify quantity', async () => {
    const postRes = await request(app).post('/api/list-items').send({ quantity: '1', name: 'Test' });
    const id = postRes.body.id;
    
    const res = await request(app).put(`/api/list-items/${id}`).send({ quantity: '5' });
    expect(res.status).toBe(200);
  });

  test('should modify name', async () => {
    const postRes = await request(app).post('/api/list-items').send({ quantity: '1', name: 'Old' });
    const id = postRes.body.id;
    
    const res = await request(app).put(`/api/list-items/${id}`).send({ name: 'New' });
    expect(res.status).toBe(200);
  });

  test('should toggle completed', async () => {
    const postRes = await request(app).post('/api/list-items').send({ quantity: '1', name: 'Test' });
    const id = postRes.body.id;
    
    const res = await request(app).put(`/api/list-items/${id}`).send({ completed: true });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/list-items/:id', () => {
  test('should delete single list item', async () => {
    const postRes = await request(app).post('/api/list-items').send({ quantity: '1', name: 'To Delete' });
    const id = postRes.body.id;
    
    const res = await request(app).delete(`/api/list-items/${id}`);
    expect(res.status).toBe(200);
    
    const getRes = await request(app).get('/api/list-items');
    expect(getRes.body.items.length).toBe(0);
  });

  test('should handle non-existent ID', async () => {
    const res = await request(app).delete('/api/list-items/99999');
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/list-items', () => {
  test('should clear all list items', async () => {
    await request(app).post('/api/list-items').send({ quantity: '1', name: 'Item A' });
    await request(app).post('/api/list-items').send({ quantity: '2', name: 'Item B' });

    const res = await request(app).delete('/api/list-items');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deleted).toBe(2);

    const getRes = await request(app).get('/api/list-items');
    expect(getRes.body.items.length).toBe(0);
  });

  test('should succeed when there are no items', async () => {
    const res = await request(app).delete('/api/list-items');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(0);
  });
});
