/**
 * Integration tests for the KiShop backend API.
 *
 * Builds an isolated in-memory SQLite database and wires it into the real
 * Express app via createApp(), so routes, auth middleware and per-user data
 * scoping are all exercised end to end.
 */

const request = require('supertest');
const sqlite3 = require('sqlite3').verbose();
const { createApp } = require('../../server');

// ---------------------------------------------------------------------------
// Test database helpers
// ---------------------------------------------------------------------------

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function createTestDatabase() {
  const database = new sqlite3.Database(':memory:');
  await new Promise((resolve, reject) => {
    database.serialize(() => {
      database.run(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      database.run(`
        CREATE TABLE sessions (
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      database.run(`
        CREATE TABLE budgets (
          user_id INTEGER PRIMARY KEY,
          max_budget REAL DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      database.run(`
        CREATE TABLE budget_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quantity TEXT NOT NULL DEFAULT '1',
          price TEXT DEFAULT '',
          name TEXT DEFAULT '',
          position INTEGER NOT NULL,
          completed INTEGER DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      database.run('ALTER TABLE budget_items ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1');
      database.run(`
        CREATE TABLE list_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quantity TEXT NOT NULL DEFAULT '1',
          name TEXT DEFAULT '',
          position INTEGER NOT NULL,
          completed INTEGER DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      database.run('ALTER TABLE list_items ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1', (err) => {
        if (err) reject(err); else resolve();
      });
    });
  });
  return database;
}

function makeDbModule(database) {
  return {
    createUser: (params, cb) => {
      const { username, passwordHash, role } = params;
      database.run(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [username, passwordHash, role === 'admin' ? 'admin' : 'user'],
        function(err) {
          if (err) cb(err);
          else cb(null, { id: this.lastID, username, role: role === 'admin' ? 'admin' : 'user' });
        }
      );
    },
    getUserByUsername: (username, cb) => {
      database.get('SELECT id, username, password_hash, role FROM users WHERE username = ?', [username], (err, row) => cb(err, row || null));
    },
    getUserById: (id, cb) => {
      database.get('SELECT id, username, role FROM users WHERE id = ?', [id], (err, row) => cb(err, row || null));
    },
    listUsers: (cb) => {
      database.all('SELECT id, username, role, created_at FROM users ORDER BY id ASC', [], (err, rows) => cb(err, rows || []));
    },
    updateUserPassword: (id, passwordHash, cb) => {
      database.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id], function(err) { cb(err, this.changes > 0); });
    },
    deleteUser: (id, cb) => {
      database.get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'", [], (err, row) => {
        if (err) return cb(err);
        database.get('SELECT role FROM users WHERE id = ?', [id], (err2, target) => {
          if (err2) return cb(err2);
          if (!target) return cb(null, false);
          if (target.role === 'admin' && row.count <= 1) {
            const lastAdminError = new Error('Cannot delete the last admin user');
            lastAdminError.code = 'LAST_ADMIN';
            return cb(lastAdminError);
          }
          database.serialize(() => {
            database.run('DELETE FROM sessions WHERE user_id = ?', [id]);
            database.run('DELETE FROM budgets WHERE user_id = ?', [id]);
            database.run('DELETE FROM budget_items WHERE user_id = ?', [id]);
            database.run('DELETE FROM list_items WHERE user_id = ?', [id]);
            database.run('DELETE FROM users WHERE id = ?', [id], function(err3) {
              if (err3) cb(err3); else cb(null, true);
            });
          });
        });
      });
    },
    createSession: (token, userId, cb) => {
      database.run('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, userId], (err) => cb(err));
    },
    getSessionUser: (token, cb) => {
      database.get(
        'SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?',
        [token],
        (err, row) => cb(err, row || null)
      );
    },
    deleteSession: (token, cb) => {
      database.run('DELETE FROM sessions WHERE token = ?', [token], (err) => cb(err));
    },
    deleteSessionsForUser: (userId, cb) => {
      database.run('DELETE FROM sessions WHERE user_id = ?', [userId], (err) => cb(err));
    },
    getBudget: (userId, cb) => {
      database.get('SELECT max_budget FROM budgets WHERE user_id = ?', [userId], (err, row) => cb(err, row ? row.max_budget : 0));
    },
    updateBudget: (userId, val, cb) => {
      database.run(
        `INSERT INTO budgets (user_id, max_budget, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET max_budget = excluded.max_budget, updated_at = CURRENT_TIMESTAMP`,
        [userId, val],
        (err) => cb(err)
      );
    },
    getItems: (userId, cb) => {
      database.all('SELECT id, quantity, price, name, position, completed FROM budget_items WHERE user_id = ? ORDER BY position ASC', [userId], (err, rows) => cb(err, rows || []));
    },
    addItem: (userId, item, cb) => {
      const stmt = database.prepare(`INSERT INTO budget_items (quantity, price, position, name, user_id)
        SELECT ?, ?, COALESCE(MAX(position), -1) + 1, ?, ? FROM budget_items WHERE user_id = ?`);
      stmt.run([item.quantity, item.price, item.name || '', userId, userId], function(err) {
        if (err) cb(err); else cb(null, this.lastID);
      });
      stmt.finalize();
    },
    bulkUpdateItems: (userId, items, cb) => {
      database.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) return cb(beginErr);
        database.run('DELETE FROM budget_items WHERE user_id = ?', [userId], (err) => {
          if (err) { database.run('ROLLBACK', () => cb(err)); return; }
          if (items.length === 0) { database.run('COMMIT', (commitErr) => cb(commitErr)); return; }
          const stmt = database.prepare('INSERT INTO budget_items (quantity, price, position, name, completed, user_id) VALUES (?, ?, ?, ?, ?, ?)');
          let error = null;
          let pending = items.length;
          items.forEach((item, index) => {
            stmt.run([item.quantity, item.price, index, item.name || '', item.completed ? 1 : 0, userId], (runErr) => {
              if (runErr && !error) error = runErr;
              pending--;
              if (pending === 0) {
                stmt.finalize((finalizeErr) => {
                  if (finalizeErr || error) database.run('ROLLBACK', () => cb(finalizeErr || error));
                  else database.run('COMMIT', (commitErr) => cb(commitErr));
                });
              }
            });
          });
        });
      });
    },
    bulkUpdatePositions: (userId, positions, cb) => {
      if (!positions || positions.length === 0) { cb(null); return; }
      database.run('BEGIN', (beginErr) => {
        if (beginErr) return cb(beginErr);
        const stmt = database.prepare('UPDATE budget_items SET position = ? WHERE user_id = ? AND id = ?');
        let error = null;
        let pending = positions.length;
        positions.forEach(({ id, position }) => {
          stmt.run([position, userId, id], (runErr) => {
            if (runErr && !error) error = runErr;
            pending--;
            if (pending === 0) {
              stmt.finalize((finalizeErr) => {
                if (finalizeErr || error) database.run('ROLLBACK', () => cb(finalizeErr || error));
                else database.run('COMMIT', (commitErr) => cb(commitErr));
              });
            }
          });
        });
      });
    },
    updateItem: (userId, id, item, cb) => {
      const updates = [];
      const values = [];
      if (item.quantity !== undefined) { updates.push('quantity = ?'); values.push(item.quantity); }
      if (item.price !== undefined) { updates.push('price = ?'); values.push(item.price); }
      if (item.name !== undefined) { updates.push('name = ?'); values.push(item.name); }
      if (item.completed !== undefined) { updates.push('completed = ?'); values.push(item.completed ? 1 : 0); }
      if (updates.length === 0) { cb(null, 0); return; }
      values.push(userId, id);
      database.run(`UPDATE budget_items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?`, values, function(err) { cb(err, this.changes); });
    },
    clearItems: (userId, cb) => {
      database.run('DELETE FROM budget_items WHERE user_id = ?', [userId], function(err) { cb(err, this.changes); });
    },
    deleteItem: (userId, id, cb) => {
      database.run('DELETE FROM budget_items WHERE user_id = ? AND id = ?', [userId, id], function(err) { cb(err, this.changes); });
    },
    getListItems: (userId, cb) => {
      database.all('SELECT id, quantity, name, position, completed FROM list_items WHERE user_id = ? ORDER BY position ASC', [userId], (err, rows) => cb(err, rows || []));
    },
    addListItem: (userId, item, cb) => {
      const stmt = database.prepare(`INSERT INTO list_items (quantity, name, position, user_id)
        SELECT ?, ?, COALESCE(MAX(position), -1) + 1, ? FROM list_items WHERE user_id = ?`);
      stmt.run([item.quantity, item.name || '', userId, userId], function(err) {
        if (err) cb(err);
        else {
          const lastID = this.lastID;
          database.get('SELECT id, quantity, name, position, completed FROM list_items WHERE id = ?', [lastID], (err, row) => cb(err, row));
        }
      });
      stmt.finalize();
    },
    bulkUpdateListItems: (userId, items, cb) => {
      database.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) return cb(beginErr);
        const stmt = database.prepare(`UPDATE list_items SET quantity = ?, name = ?, position = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?`);
        let error = null;
        let pending = items.length;
        if (pending === 0) {
          stmt.finalize(() => database.run('COMMIT', (commitErr) => cb(commitErr)));
          return;
        }
        items.forEach((item) => {
          stmt.run([item.quantity, item.name || '', item.position, item.completed ? 1 : 0, item.id, userId], (runErr) => {
            if (runErr && !error) error = runErr;
            pending--;
            if (pending === 0) {
              stmt.finalize((finalizeErr) => {
                if (finalizeErr || error) database.run('ROLLBACK', () => cb(finalizeErr || error));
                else database.run('COMMIT', (commitErr) => cb(commitErr));
              });
            }
          });
        });
      });
    },
    updateListItem: (userId, id, item, cb) => {
      const updates = [];
      const values = [];
      if (item.quantity !== undefined) { updates.push('quantity = ?'); values.push(item.quantity); }
      if (item.name !== undefined) { updates.push('name = ?'); values.push(item.name); }
      if (item.completed !== undefined) { updates.push('completed = ?'); values.push(item.completed ? 1 : 0); }
      if (updates.length === 0) { cb(null, 0); return; }
      values.push(userId, id);
      database.run(`UPDATE list_items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?`, values, function(err) { cb(err, this.changes); });
    },
    clearListItems: (userId, cb) => {
      database.run('DELETE FROM list_items WHERE user_id = ?', [userId], function(err) { cb(err, this.changes); });
    },
    deleteListItem: (userId, id, cb) => {
      database.run('DELETE FROM list_items WHERE user_id = ? AND id = ?', [userId, id], function(err) { cb(err, this.changes); });
    }
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const auth = require('../../auth');

let app;
let testDatabase;

/** Register a user directly in the DB and log in via the API, returning the cookie */
async function loginAs(username, password, role = 'user') {
  await run(testDatabase, 'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [
    username,
    auth.hashPassword(password),
    role
  ]);
  const res = await request(app).post('/api/auth/login').send({ username, password });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'][0].split(';')[0];
}

beforeEach(async () => {
  testDatabase = await createTestDatabase();
  app = createApp(makeDbModule(testDatabase));
});

afterEach(async () => {
  await new Promise(resolve => testDatabase.close(resolve));
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  test('should reject missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  test('should reject wrong password', async () => {
    await run(testDatabase, "INSERT INTO users (username, password_hash, role) VALUES ('alice', ?, 'user')", [
      auth.hashPassword('secret123')
    ]);
    const res = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('should set a session cookie on success', async () => {
    await run(testDatabase, "INSERT INTO users (username, password_hash, role) VALUES ('alice', ?, 'user')", [
      auth.hashPassword('secret123')
    ]);
    const res = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('alice');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('should not leak whether the username exists', async () => {
    const known = await request(app).post('/api/auth/login').send({ username: 'ghost', password: 'whatever' });
    expect(known.status).toBe(401);
    expect(known.body.error).toMatch(/invalid/i);
  });
});

describe('GET /api/auth/me', () => {
  test('should return 401 without a session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('should return the logged-in user', async () => {
    const cookie = await loginAs('bob', 'pass1234');
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('bob');
  });
});

describe('POST /api/auth/logout', () => {
  test('should invalidate the session', async () => {
    const cookie = await loginAs('carol', 'pass1234');
    const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logoutRes.status).toBe(200);

    const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(meRes.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Per-user data isolation
// ---------------------------------------------------------------------------

describe('per-user data isolation', () => {
  let adminCookie;
  let userACookie;
  let userBCookie;

  beforeEach(async () => {
    adminCookie = await loginAs('root', 'rootpw', 'admin');
    userACookie = await loginAs('alice', 'alicepw');
    userBCookie = await loginAs('bruno', 'brunopw');
  });

  test('unauthenticated requests are rejected', async () => {
    for (const route of ['/api/budget', '/api/items', '/api/list-items']) {
      const res = await request(app).get(route);
      expect(res.status).toBe(401);
    }
  });

  test('budgets are isolated between users', async () => {
    await request(app).put('/api/budget').set('Cookie', userACookie).send({ maxBudget: 111 });
    await request(app).put('/api/budget').set('Cookie', userBCookie).send({ maxBudget: 222 });

    const a = await request(app).get('/api/budget').set('Cookie', userACookie);
    const b = await request(app).get('/api/budget').set('Cookie', userBCookie);
    expect(a.body.maxBudget).toBe(111);
    expect(b.body.maxBudget).toBe(222);
  });

  test('budget validation still applies', async () => {
    const invalid = await request(app).put('/api/budget').set('Cookie', userACookie).send({ maxBudget: 'nope' });
    expect(invalid.status).toBe(400);

    const negative = await request(app).put('/api/budget').set('Cookie', userACookie).send({ maxBudget: -5 });
    expect(negative.status).toBe(400);
    expect(negative.body.error).toBe('Budget cannot be negative');
  });

  test('budget items are isolated between users', async () => {
    const postA = await request(app).post('/api/items').set('Cookie', userACookie)
      .send({ quantity: '1', price: '9.99', name: 'Apple' });
    expect(postA.status).toBe(200);

    await request(app).post('/api/items').set('Cookie', userBCookie)
      .send({ quantity: '2', price: '4.00', name: 'Banana' });

    const a = await request(app).get('/api/items').set('Cookie', userACookie);
    expect(a.body.items.length).toBe(1);
    expect(a.body.items[0].name).toBe('Apple');
    expect(a.body.items[0].user_id).toBeUndefined();

    // Alice cannot modify or delete Bruno's item
    const bItems = (await request(app).get('/api/items').set('Cookie', userBCookie)).body.items;
    const crossUpdate = await request(app).put(`/api/items/${bItems[0].id}`).set('Cookie', userACookie)
      .send({ name: 'Hacked' });
    expect(crossUpdate.status).toBe(200);
    const bAfter = (await request(app).get('/api/items').set('Cookie', userBCookie)).body.items;
    expect(bAfter[0].name).toBe('Banana');

    const crossDelete = await request(app).delete(`/api/items/${bItems[0].id}`).set('Cookie', userACookie);
    expect(crossDelete.status).toBe(200);
    const bFinal = (await request(app).get('/api/items').set('Cookie', userBCookie)).body.items;
    expect(bFinal.length).toBe(1);
  });

  test('clearing items only affects the current user', async () => {
    await request(app).post('/api/items').set('Cookie', userACookie).send({ quantity: '1', price: '1', name: 'A1' });
    await request(app).post('/api/items').set('Cookie', userACookie).send({ quantity: '1', price: '2', name: 'A2' });
    await request(app).post('/api/items').set('Cookie', userBCookie).send({ quantity: '1', price: '3', name: 'B1' });

    const clear = await request(app).delete('/api/items').set('Cookie', userACookie);
    expect(clear.status).toBe(200);
    expect(clear.body.deleted).toBe(2);

    const b = await request(app).get('/api/items').set('Cookie', userBCookie);
    expect(b.body.items.length).toBe(1);
  });

  test('bulk updating items only affects the current user', async () => {
    await request(app).post('/api/items').set('Cookie', userBCookie).send({ quantity: '1', price: '5', name: 'Keep Me' });

    const put = await request(app).put('/api/items').set('Cookie', userACookie).send({
      items: [{ quantity: '3', price: '10', name: 'Bulk A', completed: false }]
    });
    expect(put.status).toBe(200);

    const a = (await request(app).get('/api/items').set('Cookie', userACookie)).body.items;
    expect(a.length).toBe(1);
    expect(a[0].name).toBe('Bulk A');

    const b = (await request(app).get('/api/items').set('Cookie', userBCookie)).body.items;
    expect(b.length).toBe(1);
    expect(b[0].name).toBe('Keep Me');
  });

  test('list items are isolated between users', async () => {
    await request(app).post('/api/list-items').set('Cookie', userACookie).send({ quantity: '1', name: 'Milk' });
    await request(app).post('/api/list-items').set('Cookie', userBCookie).send({ quantity: '2', name: 'Eggs' });

    const a = await request(app).get('/api/list-items').set('Cookie', userACookie);
    expect(a.body.items.length).toBe(1);
    expect(a.body.items[0].name).toBe('Milk');

    // Bruno cannot toggle Alice's item
    const aItemId = a.body.items[0].id;
    await request(app).put(`/api/list-items/${aItemId}`).set('Cookie', userBCookie).send({ completed: true });

    const aAfter = (await request(app).get('/api/list-items').set('Cookie', userACookie)).body.items;
    expect(aAfter[0].completed).toBe(0);
  });

  test('clearing list items only affects the current user', async () => {
    await request(app).post('/api/list-items').set('Cookie', userACookie).send({ quantity: '1', name: 'Milk' });
    await request(app).post('/api/list-items').set('Cookie', userBCookie).send({ quantity: '1', name: 'Eggs' });

    const clear = await request(app).delete('/api/list-items').set('Cookie', userACookie);
    expect(clear.status).toBe(200);
    expect(clear.body.deleted).toBe(1);

    const b = await request(app).get('/api/list-items').set('Cookie', userBCookie);
    expect(b.body.items.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Admin user management
// ---------------------------------------------------------------------------

describe('admin user management', () => {
  let adminCookie;
  let userCookie;

  beforeEach(async () => {
    adminCookie = await loginAs('root', 'rootpw', 'admin');
    userCookie = await loginAs('dave', 'davepw');
  });

  describe('GET /api/users', () => {
    test('is admin-only', async () => {
      const forbidden = await request(app).get('/api/users').set('Cookie', userCookie);
      expect(forbidden.status).toBe(403);

      const unauthed = await request(app).get('/api/users');
      expect(unauthed.status).toBe(401);

      const ok = await request(app).get('/api/users').set('Cookie', adminCookie);
      expect(ok.status).toBe(200);
      expect(ok.body.users.map(u => u.username).sort()).toEqual(['dave', 'root']);
      expect(ok.body.users[0].password_hash).toBeUndefined();
    });
  });

  describe('POST /api/users', () => {
    test('creates a regular user', async () => {
      const res = await request(app).post('/api/users').set('Cookie', adminCookie)
        .send({ username: 'erin', password: 'erinpw' });
      expect(res.status).toBe(200);
      expect(res.body.username).toBe('erin');
      expect(res.body.role).toBe('user');
      expect(res.body.password).toBeUndefined();

      // New user can log in immediately
      const loginRes = await request(app).post('/api/auth/login').send({ username: 'erin', password: 'erinpw' });
      expect(loginRes.status).toBe(200);
    });

    test('creates an admin when role is admin', async () => {
      const res = await request(app).post('/api/users').set('Cookie', adminCookie)
        .send({ username: 'root2', password: 'root2pw', role: 'admin' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('admin');
    });

    test('rejects duplicate usernames case-insensitively', async () => {
      const res = await request(app).post('/api/users').set('Cookie', adminCookie)
        .send({ username: 'DAVE', password: 'whatever' });
      expect(res.status).toBe(409);
    });

    test('rejects short passwords and bad roles', async () => {
      const shortPw = await request(app).post('/api/users').set('Cookie', adminCookie)
        .send({ username: 'frank', password: 'abc' });
      expect(shortPw.status).toBe(400);

      const badRole = await request(app).post('/api/users').set('Cookie', adminCookie)
        .send({ username: 'frank', password: 'goodpw', role: 'superuser' });
      expect(badRole.status).toBe(400);
    });

    test('is admin-only', async () => {
      const res = await request(app).post('/api/users').set('Cookie', userCookie)
        .send({ username: 'mallory', password: 'mallorypw' });
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/users/:id/password', () => {
    test('resets a user password and forces re-login', async () => {
      const daveId = (await request(app).get('/api/users').set('Cookie', adminCookie))
        .body.users.find(u => u.username === 'dave').id;

      const oldSession = await request(app).post('/api/auth/login').send({ username: 'dave', password: 'davepw' });
      expect(oldSession.status).toBe(200);

      const res = await request(app).put(`/api/users/${daveId}/password`).set('Cookie', adminCookie)
        .send({ password: 'newpw123' });
      expect(res.status).toBe(200);

      // Old session invalidated, old password rejected, new password works
      const meOld = await request(app).get('/api/auth/me')
        .set('Cookie', oldSession.headers['set-cookie'][0].split(';')[0]);
      expect(meOld.status).toBe(401);

      const oldLogin = await request(app).post('/api/auth/login').send({ username: 'dave', password: 'davepw' });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app).post('/api/auth/login').send({ username: 'dave', password: 'newpw123' });
      expect(newLogin.status).toBe(200);
    });

    test('rejects short passwords and unknown users', async () => {
      const short = await request(app).put('/api/users/999/password').set('Cookie', adminCookie)
        .send({ password: 'abc' });
      expect(short.status).toBe(400);

      const missing = await request(app).put('/api/users/999/password').set('Cookie', adminCookie)
        .send({ password: 'validpw' });
      expect(missing.status).toBe(404);
    });

    test('is admin-only', async () => {
      const daveId = (await request(app).get('/api/users').set('Cookie', adminCookie))
        .body.users.find(u => u.username === 'dave').id;
      const res = await request(app).put(`/api/users/${daveId}/password`).set('Cookie', userCookie)
        .send({ password: 'hackedpw' });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/users/:id', () => {
    test('deletes a user and their data', async () => {
      await request(app).post('/api/items').set('Cookie', userCookie).send({ quantity: '1', price: '1', name: 'Thing' });
      const daveId = (await request(app).get('/api/users').set('Cookie', adminCookie))
        .body.users.find(u => u.username === 'dave').id;

      const res = await request(app).delete(`/api/users/${daveId}`).set('Cookie', adminCookie);
      expect(res.status).toBe(200);

      const remaining = (await request(app).get('/api/users').set('Cookie', adminCookie)).body.users;
      expect(remaining.map(u => u.username)).toEqual(['root']);

      const orphanItems = await get(testDatabase, 'SELECT COUNT(*) AS count FROM budget_items WHERE user_id = ?', [daveId]);
      expect(orphanItems.count).toBe(0);

      const deletedLogin = await request(app).post('/api/auth/login').send({ username: 'dave', password: 'davepw' });
      expect(deletedLogin.status).toBe(401);
    });

    test('cannot delete the last admin', async () => {
      const rootId = (await request(app).get('/api/users').set('Cookie', adminCookie))
        .body.users.find(u => u.username === 'root').id;
      const res = await request(app).delete(`/api/users/${rootId}`).set('Cookie', adminCookie);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/last admin/i);
    });

    test('returns 404 for unknown users', async () => {
      const res = await request(app).delete('/api/users/99999').set('Cookie', adminCookie);
      expect(res.status).toBe(404);
    });

    test('is admin-only', async () => {
      const daveId = (await request(app).get('/api/users').set('Cookie', adminCookie))
        .body.users.find(u => u.username === 'dave').id;
      const res = await request(app).delete(`/api/users/${daveId}`).set('Cookie', userCookie);
      expect(res.status).toBe(403);
    });
  });
});
