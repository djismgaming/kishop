# Backend Testing Guide

This directory contains tests for the KiShop backend API.

## Test Structure

```
backend/tests/
├── unit/
│   ├── database.test.js      # Database function tests
│   └── database-test-utils.js # Test utilities
└── integration/
    └── server.test.js        # API endpoint tests
```

## Running Tests

```bash
# Run all backend tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

### Unit Tests (`database.test.js`)

Tests all database functions:
- `initTables()` - Table creation
- `ensureInitialData()` - Initial data setup
- `getBudget()` / `updateBudget()` - Budget CRUD
- `getItems()` / `addItem()` / `updateItem()` / `deleteItem()` - Item CRUD
- `bulkUpdateItems()` / `bulkUpdatePositions()` - Batch operations
- List item operations: `getListItems()`, `addListItem()`, etc.

### Integration Tests (`server.test.js`)

Tests all API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/budget` | GET | Get budget |
| `/api/budget` | PUT | Update budget |
| `/api/items` | GET | Get all items |
| `/api/items` | POST | Add new item |
| `/api/items` | PUT | Bulk update items |
| `/api/items/position` | PUT | Update positions |
| `/api/items/:id` | PUT | Update single item |
| `/api/items/:id` | DELETE | Delete item |
| `/api/list-items` | GET | Get list items |
| `/api/list-items` | POST | Add list item |
| `/api/list-items` | PUT | Bulk update list items |
| `/api/list-items/:id` | PUT | Update list item |
| `/api/list-items/:id` | DELETE | Delete list item |

## Test Database

Tests use an in-memory SQLite database (`:memory:`) for isolation. Each test gets a fresh database instance.

## Adding Tests

1. **Unit tests**: Add to `tests/unit/database.test.js`
   - Follow the `describe()` blocks for each function
   - Use the helper functions from `database-test-utils.js`

2. **Integration tests**: Add to `tests/integration/server.test.js`
   - Add mock implementations for any new database functions
   - Follow the existing `describe()` blocks for each endpoint
