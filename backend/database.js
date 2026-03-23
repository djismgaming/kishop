const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || '/data/shopping.db';

let db;

/**
 * Initialize the SQLite database connection and create required tables
 * @returns {Promise<void>} Promise that resolves when database is initialized
 */
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
             name TEXT DEFAULT '',
             position INTEGER NOT NULL,
             completed INTEGER DEFAULT 0,
             updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
           )
`, (err) => {
           if (err) {
             reject(err);
           } else {
             migrateAddMissingColumns().then(() => {
               ensureInitialData().then(resolve).catch(reject);
             }).catch(reject);
           }
         });
      });
    });
  });
}

/**
 * Migrate shopping_items table to add missing columns (name, completed)
 * @returns {Promise<void>} Promise that resolves when migration is complete
 */
function migrateAddMissingColumns() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get('PRAGMA table_info(shopping_items)', (err, info) => {
        if (err) {
          reject(err);
          return;
        }
        
        const columns = info.map(row => row.name);
        let migrationsNeeded = [];
        
        if (!columns.includes('name')) {
          migrationsNeeded.push('ALTER TABLE shopping_items ADD COLUMN name TEXT DEFAULT \'\'');
        }
        if (!columns.includes('completed')) {
          migrationsNeeded.push('ALTER TABLE shopping_items ADD COLUMN completed INTEGER DEFAULT 0');
        }
        
        if (migrationsNeeded.length === 0) {
          resolve();
          return;
        }
        
        let pending = migrationsNeeded.length;
        let migrationError = null;
        
        migrationsNeeded.forEach(migration => {
          db.run(migration, (err) => {
            if (err) {
              migrationError = err;
            }
            pending--;
            if (pending === 0) {
              if (migrationError) {
                reject(migrationError);
              } else {
                resolve();
              }
            }
          });
        });
      });
    });
  });
}

/**
 * Ensure initial data exists in the shopping_data table
 * @returns {Promise<void>} Promise that resolves when initial data is ensured
 */
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

/**
 * Retrieve the maximum budget value from the database
 * @param {Function} callback - Callback function with error and budget parameters
 * @returns {void}
 */
function getBudget(callback) {
  db.get('SELECT max_budget FROM shopping_data WHERE id = 1', (err, row) => {
    if (err) callback(err);
    else callback(null, row ? row.max_budget : 0);
  });
}

/**
 * Update the maximum budget value in the database
 * @param {number} maxBudget - The new maximum budget value
 * @param {Function} callback - Callback function with error parameter
 * @returns {void}
 */
function updateBudget(maxBudget, callback) {
  db.run('UPDATE shopping_data SET max_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [maxBudget], function(err) {
    if (err) callback(err);
    else callback(null, this.lastID);
  });
}

/**
 * Retrieve all shopping items from the database
 * @param {Function} callback - Callback function with error and items array parameters
 * @returns {void}
 */
function getItems(callback) {
  db.all('SELECT id, quantity, price, name, position, completed FROM shopping_items ORDER BY position ASC', (err, rows) => {
    if (err) callback(err);
    else callback(null, rows || []);
  });
}

/**
 * Add a new shopping item to the database
 * @param {Object} item - Item object with quantity and price properties
 * @param {Function} callback - Callback function with error and lastID parameters
 * @returns {void}
 */
function addItem(item, callback) {
  const stmt = db.prepare('INSERT INTO shopping_items (quantity, price, position) SELECT ?, ?, COALESCE(MAX(position), -1) + 1 FROM shopping_items');
  stmt.run([item.quantity, item.price], function(err) {
    if (err) callback(err);
    else callback(null, this.lastID);
  });
  stmt.finalize();
}

/**
 * Update an existing shopping item in the database
 * @param {number} id - The ID of the item to update
 * @param {Object} item - Object with optional quantity, price, name, completed properties
 * @param {Function} callback - Callback function with error and changes count parameters
 * @returns {void}
 */
function updateItem(id, item, callback) {
  const updates = [];
  const values = [];
  
  if (item.quantity !== undefined) {
    updates.push('quantity = ?');
    values.push(item.quantity);
  }
  if (item.price !== undefined) {
    updates.push('price = ?');
    values.push(item.price);
  }
  if (item.name !== undefined) {
    updates.push('name = ?');
    values.push(item.name);
  }
  if (item.completed !== undefined) {
    updates.push('completed = ?');
    values.push(item.completed ? 1 : 0);
  }
  
  if (updates.length === 0) {
    callback(null, 0);
    return;
  }
  
  values.push(id);
  db.run(`UPDATE shopping_items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values, function(err) {
    if (err) callback(err);
    else callback(null, this.changes);
  });
}

/**
 * Delete a shopping item from the database by ID
 * @param {number} id - The ID of the item to delete
 * @param {Function} callback - Callback function with error parameter
 * @returns {void}
 */
function deleteItem(id, callback) {
  db.run('DELETE FROM shopping_items WHERE id = ?', [id], function(err) {
    if (err) callback(err);
    else callback(null, this.changes);
  });
}

/**
 * Bulk update all shopping items by replacing existing items with new ones
 * @param {Array} items - Array of item objects with quantity, price, name, position, completed properties
 * @param {Function} callback - Callback function with error parameter
 * @returns {void}
 */
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

      const stmt = db.prepare('INSERT INTO shopping_items (quantity, price, position, name, completed) VALUES (?, ?, ?, ?, ?)');
      items.forEach((item, index) => {
        stmt.run([item.quantity, item.price, index, item.name || '', item.completed ? 1 : 0], (err) => {
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

/**
 * Bulk update positions for shopping items
 * @param {Array} positions - Array of objects with id and position properties
 * @param {Function} callback - Callback function with error parameter
 * @returns {void}
 */
function bulkUpdatePositions(positions, callback) {
  db.run('BEGIN', (err) => {
    if (err) {
      callback(err);
      return;
    }
    
    db.serialize(() => {
      const stmt = db.prepare('UPDATE shopping_items SET position = ? WHERE id = ?');
      let error = null;
      let remaining = positions.length;
      
      if (remaining === 0) {
        stmt.finalize((finalizeErr) => {
          db.run('COMMIT', (commitErr) => {
            callback(error || finalizeErr || commitErr || null);
          });
        });
        return;
      }
      
      positions.forEach(({id, position}) => {
        stmt.run([position, id], (runErr) => {
          if (runErr && !error) {
            error = runErr;
          }
          remaining--;
          if (remaining === 0) {
            stmt.finalize((finalizeErr) => {
              const finalizeError = finalizeErr || error;
              db.run('COMMIT', (commitErr) => {
                if (finalizeError || commitErr) {
                  callback(finalizeError || commitErr);
                } else {
                  callback(null);
                }
              });
            });
          }
        });
      });
    });
  });
}
    
    positions.forEach(({id, position}) => {
      stmt.run([position, id], (err) => {
        if (err && !error) {
          error = err;
        }
        remaining--;
        if (remaining === 0) {
          stmt.finalize((finalizeErr) => {
            callback(error || finalizeErr || null);
          });
        }
      });
    });
  });
}

module.exports = {
  initDatabase,
  migrateAddMissingColumns,
  getBudget,
  updateBudget,
  getItems,
  addItem,
  updateItem,
  deleteItem,
  bulkUpdateItems,
  bulkUpdatePositions
};
