const express = require('express');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

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
  const item = { quantity: req.body.quantity, price: req.body.price };
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
  const items = req.body.items;
  db.bulkUpdateItems(items, (err) => {
    if (err) {
      console.error('Error bulk updating items:', err);
      res.status(500).json({ error: 'Failed to update items' });
    } else {
      res.json({ success: true });
    }
  });
});

app.put('/api/items/:id', (req, res) => {
  const id = req.params.id;
  const item = { quantity: req.body.quantity, price: req.body.price };
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

db.initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to start database:', err);
  process.exit(1);
});
