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
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS budgets (
            user_id INTEGER PRIMARY KEY,
            max_budget REAL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

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
            if (err) {
              reject(err);
            } else {
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
                if (err) {
                  console.error('Error creating list_items table:', err);
                  reject(err);
                } else {
                  hasOldTables().then((needsMigration) => {
                    if (needsMigration) {
                      console.log('Found old shopping_* tables - migration framework ready');
                    }
                  }).then(() => {
                    migrateToPerUserSchema()
                      .then(ensureDefaultAdmin)
                      .then(resolve)
                      .catch(reject);
                  }).catch(reject);
                }
              });
            }
          });
      });
    });
  });
}

/**
 * Migrate single-user schema to per-user schema.
 *
 * Legacy databases kept items in global tables and stored the budget in a
 * singleton budget_data row. This migration adds a user_id column to each
 * data table and copies any existing budget into the per-user budgets table,
 * assigning pre-existing data to the first admin so nothing is orphaned or
 * wiped after an upgrade.
 * @returns {Promise<void>} Promise that resolves when migration is complete
 */
function migrateToPerUserSchema() {
  const columns = {
    budget_items: 'user_id INTEGER NOT NULL DEFAULT 1',
    list_items: 'user_id INTEGER NOT NULL DEFAULT 1'
  };

  let chain = Promise.resolve();
  for (const [table, columnDef] of Object.entries(columns)) {
    chain = chain.then(() => new Promise((resolveColumn, rejectColumn) => {
      db.all(`PRAGMA table_info(${table})`, [], (err, cols) => {
        if (err) {
          rejectColumn(err);
          return;
        }
        if (!cols.some(c => c.name === 'user_id')) {
          db.run(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`, (alterErr) => {
            if (alterErr) rejectColumn(alterErr); else resolveColumn();
          });
        } else {
          resolveColumn();
        }
      });
    }));
  }

  return chain.then(() => new Promise((resolve, reject) => {
    // Copy legacy singleton budget into the per-user budgets table
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='budget_data'", [], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (!row) {
        resolve();
        return;
      }
      db.get('SELECT max_budget FROM budget_data WHERE id = 1', [], (err2, budgetRow) => {
        if (err2) {
          reject(err2);
          return;
        }
        if (!budgetRow) {
          resolve();
          return;
        }
        ensureDefaultAdminId().then((adminId) => {
          db.get('SELECT user_id FROM budgets WHERE user_id = ?', [adminId], (err3, existing) => {
            if (err3) {
              reject(err3);
              return;
            }
            if (existing) {
              resolve();
              return;
            }
            db.run(
              'INSERT INTO budgets (user_id, max_budget) VALUES (?, ?)',
              [adminId, budgetRow.max_budget],
              (insertErr) => {
                if (insertErr) reject(insertErr);
                else {
                  console.log(`Migrated legacy budget (${budgetRow.max_budget}) to admin user`);
                  resolve();
                }
              }
            );
          });
        }).catch(reject);
      });
    });
  }));
}

/**
 * Get the id of the first admin user, creating one if none exists.
 * @returns {Promise<number>} Promise resolving to the admin's user id
 */
function ensureDefaultAdminId() {
  return ensureDefaultAdmin().then(() => new Promise((resolve, reject) => {
    db.get("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1", [], (err, row) => {
      if (err) reject(err);
      else if (row) resolve(row.id);
      else reject(new Error('No admin user found after ensureDefaultAdmin'));
    });
  }));
}

/**
 * Ensure at least one admin user exists so the app is always usable.
 * Creates a default "admin" account with password "kishop" when no admin
 * exists yet (first run of a fresh database).
 * @returns {Promise<void>} Promise that resolves when an admin is ensured
 */
function ensureDefaultAdmin() {
  return new Promise((resolve, reject) => {
    db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1", [], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (row) {
        resolve();
        return;
      }
      const { hashPassword } = require('./auth');
      db.run(
        "INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')",
        [hashPassword('kishop')],
        (insertErr) => {
          if (insertErr) {
            console.error('Error creating default admin:', insertErr);
            reject(insertErr);
          } else {
            console.log('Created default admin user (username: admin, password: kishop) - change this password!');
            resolve();
          }
        }
      );
    });
  });
}

// ==========================================================================
// Users & Sessions
// ==========================================================================

/**
 * Create a new user
 * @param {Object} params - Object with username, passwordHash and optional role ('user'|'admin')
 * @param {Function} callback - Callback with error and created user (id, username, role)
 * @returns {void}
 */
function createUser(params, callback) {
  const { username, passwordHash, role } = params;
  db.run(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    [username, passwordHash, role === 'admin' ? 'admin' : 'user'],
    function(err) {
      if (err) {
        callback(err);
      } else {
        callback(null, { id: this.lastID, username, role: role === 'admin' ? 'admin' : 'user' });
      }
    }
  );
}

/**
 * Look up a user by username
 * @param {string} username - Username to find
 * @param {Function} callback - Callback with error and full user row (or null)
 * @returns {void}
 */
function getUserByUsername(username, callback) {
  db.get('SELECT id, username, password_hash, role FROM users WHERE username = ?', [username], (err, row) => {
    if (err) callback(err);
    else callback(null, row || null);
  });
}

/**
 * Look up a user by id
 * @param {number} id - User id
 * @param {Function} callback - Callback with error and user row (id, username, role) or null
 * @returns {void}
 */
function getUserById(id, callback) {
  db.get('SELECT id, username, role FROM users WHERE id = ?', [id], (err, row) => {
    if (err) callback(err);
    else callback(null, row || null);
  });
}

/**
 * List all users
 * @param {Function} callback - Callback with error and array of users
 * @returns {void}
 */
function listUsers(callback) {
  db.all('SELECT id, username, role, created_at FROM users ORDER BY id ASC', [], (err, rows) => {
    if (err) callback(err);
    else callback(null, rows || []);
  });
}

/**
 * Update a user's password hash
 * @param {number} id - User id
 * @param {string} passwordHash - New password hash
 * @param {Function} callback - Callback with error
 * @returns {void}
 */
function updateUserPassword(id, passwordHash, callback) {
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id], function(err) {
    if (err) callback(err);
    else callback(null, this.changes > 0);
  });
}

/**
 * Delete a user. The last remaining admin cannot be deleted.
 * @param {number} id - User id
 * @param {Function} callback - Callback with error
 * @returns {void}
 */
function deleteUser(id, callback) {
  db.get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'", [], (err, row) => {
    if (err) {
      callback(err);
      return;
    }
    db.get('SELECT role FROM users WHERE id = ?', [id], (err2, target) => {
      if (err2) {
        callback(err2);
        return;
      }
      if (!target) {
        callback(null, false);
        return;
      }
      if (target.role === 'admin' && row.count <= 1) {
        const lastAdminError = new Error('Cannot delete the last admin user');
        lastAdminError.code = 'LAST_ADMIN';
        callback(lastAdminError);
        return;
      }
      db.serialize(() => {
        db.run('DELETE FROM sessions WHERE user_id = ?', [id]);
        db.run('DELETE FROM budgets WHERE user_id = ?', [id]);
        db.run('DELETE FROM budget_items WHERE user_id = ?', [id]);
        db.run('DELETE FROM list_items WHERE user_id = ?', [id], function(err3) {
          if (err3) {
            callback(err3);
            return;
          }
          db.run('DELETE FROM users WHERE id = ?', [id], function(err4) {
            if (err4) callback(err4);
            else callback(null, true);
          });
        });
      });
    });
  });
}

/**
 * Create a session token for a user
 * @param {string} token - Session token
 * @param {number} userId - User id
 * @param {Function} callback - Callback with error
 * @returns {void}
 */
function createSession(token, userId, callback) {
  db.run('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, userId], (err) => {
    callback(err);
  });
}

/**
 * Resolve a session token to its user
 * @param {string} token - Session token
 * @param {Function} callback - Callback with error and user row (id, username, role) or null
 * @returns {void}
 */
function getSessionUser(token, callback) {
  db.get(
    `SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?`,
    [token],
    (err, row) => {
      if (err) callback(err);
      else callback(null, row || null);
    }
  );
}

/**
 * Delete a session token (logout)
 * @param {string} token - Session token
 * @param {Function} callback - Callback with error
 * @returns {void}
 */
function deleteSession(token, callback) {
  db.run('DELETE FROM sessions WHERE token = ?', [token], (err) => {
    callback(err);
  });
}

/**
 * Invalidate all sessions belonging to a user (e.g. after a password reset)
 * @param {number} userId - User id
 * @param {Function} callback - Callback with error
 * @returns {void}
 */
function deleteSessionsForUser(userId, callback) {
  db.run('DELETE FROM sessions WHERE user_id = ?', [userId], (err) => {
    callback(err);
  });
}

// ==========================================================================
// Budget (per user)
// ==========================================================================

/**
 * Retrieve the maximum budget value for a user
 * @param {number} userId - Owning user's id
 * @param {Function} callback - Callback function with error and budget parameters
 * @returns {void}
 */
function getBudget(userId, callback) {
  db.get('SELECT max_budget FROM budgets WHERE user_id = ?', [userId], (err, row) => {
    if (err) callback(err);
    else callback(null, row ? row.max_budget : 0);
  });
}

/**
 * Update the maximum budget value for a user
 * @param {number} userId - Owning user's id
 * @param {number} maxBudget - The new maximum budget value
 * @param {Function} callback - Callback function with error parameter
 * @returns {void}
 */
function updateBudget(userId, maxBudget, callback) {
  db.run(
    `INSERT INTO budgets (user_id, max_budget, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET max_budget = excluded.max_budget, updated_at = CURRENT_TIMESTAMP`,
    [userId, maxBudget],
    (err) => {
      callback(err);
    }
  );
}

// ==========================================================================
// Budget items (per user)
// ==========================================================================

/**
 * Retrieve all budget items for a user
 * @param {number} userId - Owning user's id
 * @param {Function} callback - Callback function with error and items array parameters
 * @returns {void}
 */
function getItems(userId, callback) {
  db.all('SELECT id, quantity, price, name, position, completed FROM budget_items WHERE user_id = ? ORDER BY position ASC', [userId], (err, rows) => {
    if (err) callback(err);
    else callback(null, rows || []);
  });
}

/**
 * Add a new budget item for a user
 * @param {number} userId - Owning user's id
 * @param {Object} item - Item object with quantity, price and name properties
 * @param {Function} callback - Callback function with error and lastID parameters
 * @returns {void}
 */
function addItem(userId, item, callback) {
  const stmt = db.prepare(`INSERT INTO budget_items (quantity, price, position, name, user_id)
    SELECT ?, ?, COALESCE(MAX(position), -1) + 1, ?, ? FROM budget_items WHERE user_id = ?`);
  stmt.run([item.quantity, item.price, item.name || '', userId, userId], function(err) {
    if (err) callback(err);
    else callback(null, this.lastID);
  });
  stmt.finalize();
}

/**
 * Update an existing budget item owned by a user
 * @param {number} userId - Owning user's id
 * @param {number} id - The ID of the item to update
 * @param {Object} item - Object with optional quantity, price, name, completed properties
 * @param {Function} callback - Callback function with error and changes count parameters
 * @returns {void}
 */
function updateItem(userId, id, item, callback) {
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

  values.push(userId, id);
  db.run(`UPDATE budget_items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?`, values, function(err) {
    if (err) callback(err);
    else callback(null, this.changes);
  });
}

/**
 * Delete a budget item owned by a user by ID
 * @param {number} userId - Owning user's id
 * @param {number} id - The ID of the item to delete
 * @param {Function} callback - Callback function with error parameter
 * @returns {void}
 */
function deleteItem(userId, id, callback) {
  db.run('DELETE FROM budget_items WHERE user_id = ? AND id = ?', [userId, id], function(err) {
    if (err) callback(err);
    else callback(null, this.changes);
  });
}

/**
 * Clear all budget items belonging to a user
 * @param {number} userId - Owning user's id
 * @param {Function} callback - Callback function with error and deleted count parameters
 * @returns {void}
 */
function clearItems(userId, callback) {
  db.run('DELETE FROM budget_items WHERE user_id = ?', [userId], function(err) {
    if (err) callback(err);
    else callback(null, this.changes);
  });
}

/**
 * Bulk replace all budget items for a user
 * @param {number} userId - Owning user's id
 * @param {Array} items - Array of item objects with quantity, price, name, completed properties
 * @param {Function} callback - Callback function with error parameter
 * @returns {void}
 */
function bulkUpdateItems(userId, items, callback) {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) {
        callback(beginErr);
        return;
      }

      db.run('DELETE FROM budget_items WHERE user_id = ?', [userId], (err) => {
        if (err) {
          db.run('ROLLBACK', () => callback(err));
          return;
        }

        if (items.length === 0) {
          db.run('COMMIT', (commitErr) => callback(commitErr));
          return;
        }

        const stmt = db.prepare('INSERT INTO budget_items (quantity, price, position, name, completed, user_id) VALUES (?, ?, ?, ?, ?, ?)');
        let error = null;
        let remaining = items.length;
        items.forEach((item, index) => {
          stmt.run([item.quantity, item.price, index, item.name || '', item.completed ? 1 : 0, userId], (runErr) => {
            if (runErr && !error) error = runErr;
            remaining--;
            if (remaining === 0) {
              stmt.finalize((finalizeErr) => {
                const finalError = finalizeErr || error;
                if (finalError) {
                  db.run('ROLLBACK', () => callback(finalError));
                } else {
                  db.run('COMMIT', (commitErr) => callback(commitErr));
                }
              });
            }
          });
        });
      });
    });
  });
}

/**
 * Bulk update positions for a user's budget items
 * @param {number} userId - Owning user's id
 * @param {Array} positions - Array of objects with id and position properties
 * @param {Function} callback - Callback function with error parameter
 * @returns {void}
 */
function bulkUpdatePositions(userId, positions, callback) {
  db.run('BEGIN', (err) => {
    if (err) {
      callback(err);
      return;
    }

    db.serialize(() => {
      const stmt = db.prepare('UPDATE budget_items SET position = ? WHERE user_id = ? AND id = ?');
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
        stmt.run([position, userId, id], (runErr) => {
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

// ==========================================================================
// List items (per user)
// ==========================================================================

/**
 * Retrieve all list items for a user
 * @param {number} userId - Owning user's id
 * @param {Function} callback - Callback function with error and items array parameters
 * @returns {void}
 */
function getListItems(userId, callback) {
  db.all('SELECT id, quantity, name, position, completed FROM list_items WHERE user_id = ? ORDER BY position ASC', [userId], (err, rows) => {
    if (err) callback(err);
    else callback(null, rows || []);
  });
}

/**
 * Add a new list item for a user
 * @param {number} userId - Owning user's id
 * @param {Object} item - Item object with quantity and name properties
 * @param {Function} callback - Callback function with error and created row parameters
 * @returns {void}
 */
function addListItem(userId, item, callback) {
  const stmt = db.prepare(`INSERT INTO list_items (quantity, name, position, user_id)
    SELECT ?, ?, COALESCE(MAX(position), -1) + 1, ? FROM list_items WHERE user_id = ?`);
  stmt.run([item.quantity, item.name || '', userId, userId], function(err) {
    if (err) callback(err);
    else {
      const lastID = this.lastID;
      db.get('SELECT id, quantity, name, position, completed FROM list_items WHERE id = ? AND user_id = ?', [lastID, userId], (err, row) => {
        if (err) callback(err);
        else callback(null, row);
      });
    }
  });
  stmt.finalize();
}

/**
 * Update an existing list item owned by a user
 * @param {number} userId - Owning user's id
 * @param {number} id - The ID of the item to update
 * @param {Object} item - Object with optional quantity, name, completed properties
 * @param {Function} callback - Callback function with error and changes count parameters
 * @returns {void}
 */
function updateListItem(userId, id, item, callback) {
  const updates = [];
  const values = [];

  if (item.quantity !== undefined) {
    updates.push('quantity = ?');
    values.push(item.quantity);
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

  values.push(userId, id);
  const sql = `UPDATE list_items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?`;
  db.run(sql, values, function(err) {
    if (err) callback(err);
    else callback(null, this.changes);
  });
}

/**
 * Delete a list item owned by a user by ID
 * @param {number} userId - Owning user's id
 * @param {number} id - The ID of the item to delete
 * @param {Function} callback - Callback function with error parameter
 * @returns {void}
 */
function deleteListItem(userId, id, callback) {
  db.run('DELETE FROM list_items WHERE user_id = ? AND id = ?', [userId, id], function(err) {
    if (err) callback(err);
    else callback(null, this.changes);
  });
}

/**
 * Clear all list items belonging to a user
 * @param {number} userId - Owning user's id
 * @param {Function} callback - Callback function with error and deleted count parameters
 * @returns {void}
 */
function clearListItems(userId, callback) {
  db.run('DELETE FROM list_items WHERE user_id = ?', [userId], function(err) {
    if (err) callback(err);
    else callback(null, this.changes);
  });
}

/**
 * Bulk update a user's list items
 * @param {number} userId - Owning user's id
 * @param {Array} items - Array of item objects with id, quantity, name, position, completed properties
 * @param {Function} callback - Callback function with error parameter
 * @returns {void}
 */
function bulkUpdateListItems(userId, items, callback) {
  db.run('BEGIN TRANSACTION', (beginErr) => {
    if (beginErr) {
      callback(beginErr);
      return;
    }

    const stmt = db.prepare(`UPDATE list_items SET quantity = ?, name = ?, position = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?`);
    let error = null;
    let remaining = items.length;

    if (remaining === 0) {
      stmt.finalize((finalizeErr) => {
        db.run('COMMIT', (commitErr) => {
          callback(finalizeErr || commitErr || null);
        });
      });
      return;
    }

    items.forEach(item => {
      stmt.run([item.quantity, item.name || '', item.position, item.completed ? 1 : 0, item.id, userId], (runErr) => {
        if (runErr && !error) {
          error = runErr;
        }
        remaining--;
        if (remaining === 0) {
          stmt.finalize((finalizeError) => {
            const finalError = finalizeError || error;
            if (finalError) {
              db.run('ROLLBACK', (rbErr) => {
                callback(finalError || rbErr);
              });
            } else {
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  callback(commitErr);
                } else {
                  callback(null);
                }
              });
            }
          });
        }
      });
    });
  });
}

function hasOldTables() {
  return new Promise((resolve) => {
    db.run('SELECT name FROM sqlite_master WHERE type="table" AND name LIKE "shopping_%"', [], (err, rows) => {
      if (err || !rows || rows.length === 0) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

module.exports = {
  initDatabase,
  hasOldTables,
  createUser,
  getUserByUsername,
  getUserById,
  listUsers,
  updateUserPassword,
  deleteUser,
  createSession,
  getSessionUser,
  deleteSession,
  deleteSessionsForUser,
  getBudget,
  updateBudget,
  getItems,
  addItem,
  updateItem,
  deleteItem,
  clearItems,
  bulkUpdateItems,
  bulkUpdatePositions,
  getListItems,
  addListItem,
  updateListItem,
  deleteListItem,
  clearListItems,
  bulkUpdateListItems
};
