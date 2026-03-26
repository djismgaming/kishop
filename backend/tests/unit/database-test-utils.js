/**
 * Test utilities for database unit tests
 * Provides isolated in-memory SQLite connections for testing
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let testDbPath = '/tmp/kishop_test.db';

/**
 * Create a new in-memory or temporary file database connection
 * @param {boolean} inMemory - Use :memory: for truly isolated tests (default false)
 * @returns {Promise<object>} Promise resolving to db object and close function
 */
async function createTestDatabase(inMemory = true) {
  const dbPath = inMemory ? ':memory:' : testDbPath;
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening test database:', err);
        reject(err);
        return;
      }
      
      // Create tables for testing
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
              else resolve(db);
            });
          });
        });
      });
    });
  });
}

/**
 * Initialize shopping_data table with default values
 * @param {object} db - SQLite database connection
 * @returns {Promise<void>} Promise that resolves when initialized
 */
async function initializeTestData(db) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM budget_data WHERE id = 1', (err, row) => {
      if (err) {
        reject(err);
        return;
      }
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

/**
 * Reset all test data to empty state
 * @param {object} db - SQLite database connection
 * @returns {Promise<void>} Promise that resolves when reset complete
 */
async function resetTestData(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM budget_items', (err) => {
        if (err) reject(err);
        
        db.run('DELETE FROM list_items', (err2) => {
          if (err2) reject(err2);
          else resolve();
        });
      });
    });
  });
}

module.exports = {
  createTestDatabase,
  initializeTestData,
  resetTestData
};
