const express = require('express');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Input validation and sanitization utilities
function validateInput(input) {
  if (typeof input !== 'string') return null;
  
  // Trim whitespace
  input = input.trim();
  
  // Check length limits
  if (input.length === 0 || input.length > 255) {
    return null;
  }
  
  // Check for potentially dangerous characters (basic check)
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:\s*text\/html/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      return null;
    }
  }
  
  return input;
}

function sanitizeName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().substring(0, 100); // Max 100 chars for name
}

function sanitizeDescription(description) {
  if (typeof description !== 'string') return '';
  return description.trim().substring(0, 500); // Max 500 chars for description
}

function validateQuantity(quantity) {
  if (quantity === undefined || quantity === null) return 1;
  const num = Number(quantity);
  if (isNaN(num) || num < 1 || num > 9999) {
    return 1;
  }
  return Math.round(num);
}

function validatePrice(price) {
  if (price === undefined || price === null) return 0;
  const num = Number(price);
  if (isNaN(num) || num < 0 || num > 999999.99) {
    return 0;
  }
  return Math.round(num * 100) / 100; // Round to 2 decimals
}

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

app.get('/api/budget', (req, res) => {
  db.getBudget((err, budget) => {
    if (err) {
      console.error('Error getting budget:', err);
      res.status(500).json({ error: 'Failed to get budget' });
    } else {
      res.json({ maxBudget: budget });
    }
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
  
  db.updateBudget(maxBudget, (err) => {
    if (err) {
      console.error('Error updating budget:', err);
      res.status(500).json({ error: 'Failed to update budget' });
    } else {
      res.json({ success: true });
    }
  });
});

app.get('/api/items', (req, res) => {
  db.getItems((err, items) => {
    if (err) {
      console.error('Error getting items:', err);
      res.status(500).json({ error: 'Failed to get items' });
    } else {
      res.json({ items });
    }
  });
});

app.post('/api/items', (req, res) => {
  // Validate and sanitize input
  const name = sanitizeName(req.body.name || '');
  const quantity = validateQuantity(req.body.quantity);
  const price = validatePrice(req.body.price);
  
  const item = { quantity, price, name };
  db.addItem(item, (err, id) => {
    if (err) {
      console.error('Error adding item:', err);
      res.status(500).json({ error: 'Failed to add item' });
    } else {
      res.json({ id, ...item });
    }
  });
});

app.put('/api/items', (req, res) => {
  const items = req.body.items || [];
  
  const validatedItems = items.map(item => ({
    id: item.id,
    name: sanitizeName(item.name || ''),
    quantity: validateQuantity(item.quantity),
    price: validatePrice(item.price),
    completed: item.completed !== undefined ? item.completed : false
  }));
  
  db.bulkUpdateItems(validatedItems, (err) => {
    if (err) {
      console.error('Error bulk updating items:', err);
      res.status(500).json({ error: 'Failed to update items' });
    } else {
      res.json({ success: true });
    }
  });
});

app.put('/api/items/position', (req, res) => {
  const positions = req.body.positions || [];
  db.bulkUpdatePositions(positions, (err) => {
    if (err) {
      console.error('Error updating positions:', err);
      res.status(500).json({ error: 'Failed to update positions' });
    } else {
      res.json({ success: true });
    }
  });
});

app.put('/api/items/:id', (req, res) => {
  const id = req.params.id;
  
  // Validate and sanitize input
  const name = sanitizeName(req.body.name || '');
  const quantity = validateQuantity(req.body.quantity);
  const price = validatePrice(req.body.price);
  const completed = req.body.completed !== undefined ? req.body.completed : false;
  
  const item = { 
    quantity, 
    price,
    name,
    completed
  };
  db.updateItem(id, item, (err) => {
    if (err) {
      console.error('Error updating item:', err);
      res.status(500).json({ error: 'Failed to update item' });
    } else {
      res.json({ success: true });
    }
  });
});

app.delete('/api/items/:id', (req, res) => {
  const id = req.params.id;
  db.deleteItem(id, (err) => {
    if (err) {
      console.error('Error deleting item:', err);
      res.status(500).json({ error: 'Failed to delete item' });
    } else {
      res.json({ success: true });
    }
  });
});

app.get('/api/list-items', (req, res) => {
  db.getListItems((err, items) => {
    if (err) {
      console.error('Error getting list items:', err);
      res.status(500).json({ error: 'Failed to get list items' });
    } else {
      res.json({ items });
    }
  });
});

app.post('/api/list-items', (req, res) => {
  // Validate and sanitize input
  const name = sanitizeName(req.body.name || '');
  const quantity = validateQuantity(req.body.quantity);
  
  const item = { quantity, name };
  db.addListItem(item, (err, row) => {
    if (err) {
      console.error('Error adding list item:', err);
      res.status(500).json({ error: 'Failed to add list item' });
    } else {
      res.json(row);
    }
  });
});

app.put('/api/list-items', (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  
  const validatedItems = items.map(item => ({
    id: item.id,
    name: sanitizeName(item.name || ''),
    quantity: validateQuantity(item.quantity),
    completed: item.completed !== undefined ? item.completed : false
  }));
  
  db.bulkUpdateListItems(validatedItems, (err) => {
    if (err) {
      console.error('Error bulk updating list items:', err);
      res.status(500).json({ error: 'Failed to update list items' });
    } else {
      res.json({ success: true });
    }
  });
});

app.put('/api/list-items/:id', (req, res) => {
  const id = req.params.id;
  
  // Validate and sanitize input
  const name = sanitizeName(req.body.name || '');
  const quantity = validateQuantity(req.body.quantity);
  const completed = req.body.completed !== undefined ? req.body.completed : false;
  
  const item = { 
    quantity, 
    name,
    completed
  };
  db.updateListItem(id, item, (err) => {
    if (err) {
      console.error('Error updating list item:', err);
      res.status(500).json({ error: 'Failed to update list item' });
    } else {
      res.json({ success: true });
    }
  });
});

app.delete('/api/list-items/:id', (req, res) => {
  const id = req.params.id;
  db.deleteListItem(id, (err) => {
    if (err) {
      console.error('Error deleting list item:', err);
      res.status(500).json({ error: 'Failed to delete list item' });
    } else {
      res.json({ success: true });
    }
  });
});

db.initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Access on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to start database:', err);
  process.exit(1);
});
