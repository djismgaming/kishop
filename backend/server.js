const express = require('express');
const db = require('./database');
const auth = require('./auth');

const PORT = process.env.PORT || 3001;
const SESSION_COOKIE = 'kishop_session';

/**
 * Create the Express app.
 * @param {Object} database - Database module (injectable for testing)
 * @returns {Express app} Configured Express application
 */
function createApp(database) {
  const app = express();
  const d = database || db;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // ==========================================================================
  // Session helpers & middleware
  // ==========================================================================

  function parseCookies(req) {
    const header = req.headers.cookie;
    const cookies = {};
    if (!header) return cookies;
    for (const part of header.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (key) cookies[key] = decodeURIComponent(value);
    }
    return cookies;
  }

  function setSessionCookie(res, token) {
    res.header('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax`);
  }

  function clearSessionCookie(res) {
    res.header('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }

  function requireAuth(req, res, next) {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    next();
  }

  function requireAdmin(req, res, next) {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  }

  // Attach the logged-in user (if any) to every request
  app.use((req, res, next) => {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) {
      next();
      return;
    }
    d.getSessionUser(token, (err, user) => {
      if (!err && user) {
        req.user = user;
        req.sessionToken = token;
      }
      next();
    });
  });

  // ==========================================================================
  // Auth routes
  // ==========================================================================

  /**
   * POST /api/auth/login - Log in with username and password
   */
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    d.getUserByUsername(username.trim(), (err, user) => {
      if (err) {
        console.error('Error looking up user:', err);
        return res.status(500).json({ error: 'Login failed' });
      }
      if (!user || !auth.verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const token = auth.generateToken();
      d.createSession(token, user.id, (sessionErr) => {
        if (sessionErr) {
          console.error('Error creating session:', sessionErr);
          return res.status(500).json({ error: 'Login failed' });
        }
        setSessionCookie(res, token);
        res.json({ user: { id: user.id, username: user.username, role: user.role } });
      });
    });
  });

  /**
   * POST /api/auth/logout - Invalidate the current session
   */
  app.post('/api/auth/logout', (req, res) => {
    if (req.sessionToken) {
      d.deleteSession(req.sessionToken, () => {
        clearSessionCookie(res);
        res.json({ success: true });
      });
      return;
    }
    clearSessionCookie(res);
    res.json({ success: true });
  });

  /**
   * GET /api/auth/me - Get the currently logged-in user
   */
  app.get('/api/auth/me', (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user: { id: req.user.id, username: req.user.username, role: req.user.role } });
  });

  // ==========================================================================
  // Admin routes - user management
  // ==========================================================================

  function validateNewUser(body) {
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const role = body.role === undefined ? 'user' : body.role;

    if (!username || username.length > 50) {
      return { error: 'Username must be 1-50 characters' };
    }
    if (password.length < 4) {
      return { error: 'Password must be at least 4 characters' };
    }
    if (role !== 'user' && role !== 'admin') {
      return { error: "Role must be 'user' or 'admin'" };
    }
    return { username, password, role };
  }

  /**
   * GET /api/users - List all users (admin only)
   */
  app.get('/api/users', requireAdmin, (req, res) => {
    d.listUsers((err, users) => {
      if (err) {
        console.error('Error listing users:', err);
        res.status(500).json({ error: 'Failed to list users' });
      } else {
        res.json({ users });
      }
    });
  });

  /**
   * POST /api/users - Create a new user (admin only)
   */
  app.post('/api/users', requireAdmin, (req, res) => {
    const validation = validateNewUser(req.body);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    d.createUser(
      { username: validation.username, passwordHash: auth.hashPassword(validation.password), role: validation.role },
      (err, user) => {
        if (err) {
          if (err.code && String(err.code).startsWith('SQLITE_CONSTRAINT')) {
            return res.status(409).json({ error: 'Username already exists' });
          }
          console.error('Error creating user:', err);
          return res.status(500).json({ error: 'Failed to create user' });
        }
        res.json(user);
      }
    );
  });

  /**
   * PUT /api/users/:id/password - Change a user's password (admin only)
   */
  app.put('/api/users/:id/password', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    d.getUserById(id, (err, target) => {
      if (err) {
        console.error('Error finding user:', err);
        return res.status(500).json({ error: 'Failed to change password' });
      }
      if (!target) {
        return res.status(404).json({ error: 'User not found' });
      }

      d.updateUserPassword(id, auth.hashPassword(password), (updateErr) => {
        if (updateErr) {
          console.error('Error changing password:', updateErr);
          return res.status(500).json({ error: 'Failed to change password' });
        }
        // Force re-login everywhere this account is signed in
        d.deleteSessionsForUser(id, () => {
          res.json({ success: true });
        });
      });
    });
  });

  /**
   * DELETE /api/users/:id - Delete a user and their data (admin only)
   */
  app.delete('/api/users/:id', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    d.deleteUser(id, (err, deleted) => {
      if (err) {
        if (err.code === 'LAST_ADMIN') {
          return res.status(409).json({ error: err.message });
        }
        console.error('Error deleting user:', err);
        return res.status(500).json({ error: 'Failed to delete user' });
      }
      if (!deleted) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ success: true });
    });
  });

  // ==========================================================================
  // Budget (scoped to the logged-in user)
  // ==========================================================================

  app.get('/api/budget', requireAuth, (req, res) => {
    d.getBudget(req.user.id, (err, budget) => {
      if (err) {
        console.error('Error getting budget:', err);
        res.status(500).json({ error: 'Failed to get budget' });
      } else {
        res.json({ maxBudget: budget });
      }
    });
  });

  app.put('/api/budget', requireAuth, (req, res) => {
    const maxBudget = req.body.maxBudget;

    if (maxBudget === undefined || isNaN(maxBudget)) {
      return res.status(400).json({ error: 'Invalid budget value' });
    }

    if (maxBudget < 0) {
      return res.status(400).json({ error: 'Budget cannot be negative' });
    }

    d.updateBudget(req.user.id, maxBudget, (err) => {
      if (err) {
        console.error('Error updating budget:', err);
        res.status(500).json({ error: 'Failed to update budget' });
      } else {
        res.json({ success: true });
      }
    });
  });

  // ==========================================================================
  // Budget items (scoped to the logged-in user)
  // ==========================================================================

  app.get('/api/items', requireAuth, (req, res) => {
    d.getItems(req.user.id, (err, items) => {
      if (err) {
        console.error('Error getting items:', err);
        res.status(500).json({ error: 'Failed to get items' });
      } else {
        res.json({ items });
      }
    });
  });

  app.post('/api/items', requireAuth, (req, res) => {
    const item = { quantity: req.body.quantity, price: req.body.price, name: req.body.name };
    d.addItem(req.user.id, item, (err, id) => {
      if (err) {
        console.error('Error adding item:', err);
        res.status(500).json({ error: 'Failed to add item' });
      } else {
        res.json({ id, ...item });
      }
    });
  });

  app.put('/api/items', requireAuth, (req, res) => {
    const items = req.body.items;
    d.bulkUpdateItems(req.user.id, items, (err) => {
      if (err) {
        console.error('Error bulk updating items:', err);
        res.status(500).json({ error: 'Failed to update items' });
      } else {
        res.json({ success: true });
      }
    });
  });

  app.put('/api/items/position', requireAuth, (req, res) => {
    const positions = req.body.positions || [];
    d.bulkUpdatePositions(req.user.id, positions, (err) => {
      if (err) {
        console.error('Error updating positions:', err);
        res.status(500).json({ error: 'Failed to update positions' });
      } else {
        res.json({ success: true });
      }
    });
  });

  app.put('/api/items/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    const item = {
      quantity: req.body.quantity,
      price: req.body.price,
      name: req.body.name,
      completed: req.body.completed
    };
    d.updateItem(req.user.id, id, item, (err) => {
      if (err) {
        console.error('Error updating item:', err);
        res.status(500).json({ error: 'Failed to update item' });
      } else {
        res.json({ success: true });
      }
    });
  });

  app.delete('/api/items', requireAuth, (req, res) => {
    d.clearItems(req.user.id, (err, count) => {
      if (err) {
        console.error('Error clearing items:', err);
        res.status(500).json({ error: 'Failed to clear items' });
      } else {
        res.json({ success: true, deleted: count });
      }
    });
  });

  app.delete('/api/items/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    d.deleteItem(req.user.id, id, (err) => {
      if (err) {
        console.error('Error deleting item:', err);
        res.status(500).json({ error: 'Failed to delete item' });
      } else {
        res.json({ success: true });
      }
    });
  });

  // ==========================================================================
  // List items (scoped to the logged-in user)
  // ==========================================================================

  app.get('/api/list-items', requireAuth, (req, res) => {
    d.getListItems(req.user.id, (err, items) => {
      if (err) {
        console.error('Error getting list items:', err);
        res.status(500).json({ error: 'Failed to get list items' });
      } else {
        res.json({ items });
      }
    });
  });

  app.post('/api/list-items', requireAuth, (req, res) => {
    const item = { quantity: req.body.quantity, name: req.body.name };
    d.addListItem(req.user.id, item, (err, row) => {
      if (err) {
        console.error('Error adding list item:', err);
        res.status(500).json({ error: 'Failed to add list item' });
      } else {
        res.json(row);
      }
    });
  });

  app.put('/api/list-items', requireAuth, (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    d.bulkUpdateListItems(req.user.id, items, (err) => {
      if (err) {
        console.error('Error bulk updating list items:', err);
        res.status(500).json({ error: 'Failed to update list items' });
      } else {
        res.json({ success: true });
      }
    });
  });

  app.put('/api/list-items/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    const item = {
      quantity: req.body.quantity,
      name: req.body.name,
      completed: req.body.completed
    };
    d.updateListItem(req.user.id, id, item, (err) => {
      if (err) {
        console.error('Error updating list item:', err);
        res.status(500).json({ error: 'Failed to update list item' });
      } else {
        res.json({ success: true });
      }
    });
  });

  app.delete('/api/list-items', requireAuth, (req, res) => {
    d.clearListItems(req.user.id, (err, count) => {
      if (err) {
        console.error('Error clearing list items:', err);
        res.status(500).json({ error: 'Failed to clear list items' });
      } else {
        res.json({ success: true, deleted: count });
      }
    });
  });

  app.delete('/api/list-items/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    d.deleteListItem(req.user.id, id, (err) => {
      if (err) {
        console.error('Error deleting list item:', err);
        res.status(500).json({ error: 'Failed to delete list item' });
      } else {
        res.json({ success: true });
      }
    });
  });

  return app;
}

module.exports = { createApp, PORT };

// Start the server when run directly (not when imported by tests)
if (require.main === module) {
  db.initDatabase().then(() => {
    const app = createApp();
    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
      console.log(`Access on http://localhost:${PORT}`);
    });
  }).catch((err) => {
    console.error('Failed to start database:', err);
    process.exit(1);
  });
}
