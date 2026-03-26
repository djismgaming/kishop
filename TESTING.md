# KiShop Testing Documentation

This document describes the testing strategy for the KiShop application.

## Overview

KiShop uses a comprehensive testing approach with:
- **Backend**: Jest + Supertest for API and database tests
- **Frontend**: Vitest + JSDOM for JavaScript logic tests

## Running Tests

### Backend Tests

```bash
cd backend
npm test
```

### Frontend Tests

```bash
npm run test:run
```

### All Tests

Run both backend and frontend tests:

```bash
# Backend
cd backend && npm test

# Frontend
npm run test:run
```

## Test Coverage

### Backend (62 tests)

| Category | Tests | Description |
|----------|-------|-------------|
| Database Unit | 36 | CRUD operations, calculations |
| API Integration | 26 | All 14 API endpoints |

### Frontend (20 tests)

| Category | Tests | Description |
|----------|-------|-------------|
| Calculations | 6 | Tax, subtotal, totals |
| Validation | 5 | Budget, items, percentages |
| Position Management | 2 | Ordering, reordering |
| Field Validation | 3 | Quantities, names |

## Test Files

```
kishop/
├── backend/
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── database.test.js
│   │   │   └── database-test-utils.js
│   │   └── integration/
│   │       └── server.test.js
│   └── package.json
├── frontend/
│   └── tests/
│       └── unit/
│           └── app.test.js
├── tests/
│   └── setup.js
├── package.json
└── vitest.config.js
```

## CI/CD Integration

Tests can be integrated into CI/CD pipelines. See `.github/workflows/test.yml` for configuration (if implemented).

## Adding New Tests

### Backend

1. **Unit Tests**: Add to `backend/tests/unit/database.test.js`
2. **Integration Tests**: Add to `backend/tests/integration/server.test.js`

### Frontend

1. Add test file to `frontend/tests/unit/`
2. Import JSDOM setup from `tests/setup.js`
3. Use `describe()` and `it()` blocks

## Best Practices

1. **Isolation**: Each test should be independent
2. **Naming**: Use descriptive test names (`it('should...')`)
3. **Mock External Dependencies**: Mock API calls and storage
4. **Cleanup**: Reset state between tests
5. **Coverage**: Aim for ≥70% overall coverage
