# Frontend Testing Guide

This directory contains tests for the KiShop frontend JavaScript.

## Test Structure

```
frontend/tests/
└── unit/
    └── app.test.js        # Frontend logic tests
```

## Running Tests

```bash
# Run all frontend tests
npm run test:run

# Run tests in watch mode
npm test

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

### Current Tests (`app.test.js`)

- **Tax Calculations**: Verify 11.5% tax rate application
- **Subtotal Calculation**: Quantity × Price
- **Grand Total**: Subtotal + Tax
- **Budget Validation**: Positive numbers only, zero handling
- **Budget Percentage**: Warning (75%) and danger (100%) thresholds
- **Position Management**: Sequential positioning, reordering
- **Item Field Validation**: Quantity/price parsing, name sanitization

### Test Categories

1. **Calculation Logic**
   - Subtotal calculation (quantity × price)
   - Tax calculation (11.5% fixed rate)
   - Total with tax display
   - Budget comparison warnings

2. **Budget Validation**
   - Valid budget values (positive numbers)
   - Invalid budget values (NaN, negative)
   - Zero budget handling
   - Percentage calculations

3. **Position Management**
   - Sequential position assignment
   - Item reordering

4. **Item Field Validation**
   - Quantity validation (positive values)
   - Name sanitization (trimming, null handling)

## Adding Tests

1. Add test file to `frontend/tests/unit/`
2. Follow existing pattern with `describe()` and `it()` blocks
3. Use JSDOM for DOM manipulation tests
4. Mock `fetch` and `localStorage` for API/storage tests

## Configuration

See `vitest.config.js` for test runner configuration.
