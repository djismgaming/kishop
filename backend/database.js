const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || '/data/shopping.db';

let db;

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');

      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS shopping_data (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            max_budget REAL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS shopping_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quantity TEXT NOT NULL DEFAULT '1',
            price TEXT DEFAULT '',
            position INTEGER NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            reject(err);
          } else {
            ensureInitialData().then(resolve).catch(reject);
          }
        });
      });
    });
  });
}

function ensureInitialData() {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM shopping_data WHERE id = 1', (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (!row) {
        db.run('INSERT INTO shopping_data (id, max_budget) VALUES (1, 0)', (err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

function getBudget(callback) {
  db.get('SELECT max_budget FROM shopping_data WHERE id = 1', (err, row) => {
    if (err) callback(err);
    else callback(null, row ? row.max_budget : 0);
  });
}

function updateBudget(maxBudget, callback) {
  db.run('UPDATE shopping_data SET max_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [maxBudget], function(err) {
    if (err) callback(err);
    else callback(null, this.lastID);
  });
}

function getItems(callback) {
  db.all('SELECT id, quantity, price, position FROM shopping_items ORDER BY position ASC', (err, rows) => {
    if (err) callback(err);
    else callback(null, rows || []);
  });
}

function addItem(item, callback) {
  const stmt = db.prepare('INSERT INTO shopping_items (quantity, price, position) SELECT ?, ?, COALESCE(MAX(position), -1) + 1 FROM shopping_items');
  stmt.run([item.quantity, item.price], function(err) {
    if (err) callback(err);
    else callback(null, this.lastID);
  });
  stmt.finalize();
}

function updateItem(id, item, callback) {
  db.run('UPDATE shopping_items SET quantity = ?, price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.price, id], function(err) {
    if (err) callback(err);
    else callback(null, this.changes);
  });
}

function deleteItem(id, callback) {
  db.run('DELETE FROM shopping_items WHERE id = ?', [id], function(err) {
    if (err) callback(err);
    else callback(null, this.changes);
  });
}

function bulkUpdateItems(items, callback) {
  db.serialize(() => {
    db.run('DELETE FROM shopping_items', (err) => {
      if (err) {
        callback(err);
        return;
      }

      if (items.length === 0) {
        callback(null);
        return;
      }

      const stmt = db.prepare('INSERT INTO shopping_items (quantity, price, position) VALUES (?, ?, ?)');
      items.forEach((item, index) => {
        stmt.run([item.quantity, item.price, index], (err) => {
          if (err && !stmt.err) {
            stmt.err = err;
          }
        });
      });
      stmt.finalize((err) => {
        if (err || stmt.err) {
          callback(err || stmt.err);
        } else {
          callback(null);
        }
      });
    });
  });
}

module.exports = {
  initDatabase,
  getBudget,
  updateBudget,
  getItems,
  addItem,
  updateItem,
  deleteItem,
  bulkUpdateItems
};
