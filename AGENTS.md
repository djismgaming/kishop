# Agent Guidelines for KiShop

KiShop is a mobile-first shopping list web app built with vanilla HTML/CSS/JavaScript.

## Build, Test, and Lint Commands

This project uses pure HTML/CSS/JavaScript with no build step. To run:

```bash
# Serve locally (any HTTP server)
python -m http.server 8000
# or
npx serve .

# Or open index.html directly in a browser
```

No linting or test commands are configured.

## Project Structure

- `index.html` - Main HTML structure
- `app.js` - Application logic (DOM manipulation, data handling)
- `styles.css` - All styling
- `manifest.json` - PWA manifest
- `docker-compose.yml` - Docker deployment configuration
- `nginx.conf` - Nginx configuration

## Code Style Guidelines

### JavaScript (app.js)

**Naming Conventions:**
- Functions: camelCase (e.g., `loadData`, `formatCurrency`)
- Variables: camelCase (e.g., `appData`, `maxBudget`)
- Constants: UPPER_SNAKE_CASE (e.g., `TAX_RATE`, `STORAGE_KEY`)
- DOM elements by ID: kebab-case (e.g., `shopping-list`, `max-budget`)

**Variable Declarations:**
- Use `const` for constants and values that don't change
- Use `let` for variables that need reassignment
- Never use `var`

**Code Organization:**
- Define constants at top of file
- Global state object: `appData` with `maxBudget` and `items` array
- Functions grouped by purpose: data operations → calculations → DOM manipulation → event handlers
- `init()` function called on `DOMContentLoaded`

**Error Handling:**
- Wrap `localStorage` operations in try-catch blocks
- Log errors to console: `console.error('Error description:', e)`
- Provide fallback values: `parseFloat(item.quantity) || 0`

**DOM Manipulation:**
- Use `document.getElementById()` for single elements
- Use `document.querySelector()` and `querySelectorAll()` for complex selectors
- Use `createElement()` for new elements
- Use template literals for HTML strings with proper escaping
- Avoid direct `innerHTML` assignment with user input

**Event Handling:**
- Use `addEventListener()` for all event handlers
- Use `blur` for input validation/processing
- Use `input` for real-time updates
- Use `focus` for UX improvements (selecting text)
- Use `e.relatedTarget` to detect focus direction

**Data Persistence:**
- Key: `STORAGE_KEY = 'kishop_data'`
- Structure: `JSON.stringify({ maxBudget, items: [] })`
- Always call `saveData()` after modifying `appData`

**Input Handling:**
- Use `inputmode="decimal"` for numeric inputs on mobile
- Parse numbers with `parseFloat(value) || 0`
- Use `min`, `step` attributes for numeric constraints
- Format currency with helper: `'$' + amount.toFixed(2)`

**CSS Styles (styles.css)**

**Naming Conventions:**
- Classes: kebab-case (e.g., `.shopping-list-container`, `.delete-btn`)
- IDs: kebab-case (e.g., `#shopping-list`, `#max-budget`)
- Modifiers: BEM-style (e.g., `.totals-panel.warning`, `.totals-panel.danger`)

**CSS Architecture:**
- Mobile-first with `@media` for larger screens
- Reset at top (`* { margin: 0; padding: 0; box-sizing: border-box; }`)
- Global styles first, then component-specific styles
- Use `:focus-within` for parent focus states
- Transitions for interactive elements (e.g., `background 0.2s`)

**Layout:**
- Use flexbox for simple alignments (`.shopping-list`, `.budget-input-wrapper`)
- Use grid for structured layouts (`.list-item`, `.totals-grid`)
- Sticky positioning for headers/footers
- Fixed positioning for footer panel

**Responsive Design:**
- Breakpoint: `@media (max-width: 480px)`
- Adjust grid columns and padding for small screens
- Minimum touch target: 40px×40px (36px×36px on mobile)

**Colors:**
- Primary: `#4a90e2` (blue)
- Success: `#d4edda` (green background)
- Warning: `#fff3cd` (yellow background)
- Danger: `#f8d7da` (red background)
- Delete button: `#ff6b6b`

**Typography:**
- System fonts: `-apple-system, BlinkMacSystemFont, 'Segoe UI', ...`
- Base size: 16px
- Monospace for price inputs: `'Courier New', monospace`
- Uppercase with letter-spacing for labels

**Key Implementation Patterns**

**Adding Items:**
- New items pushed to `appData.items` array
- Use `addEmptyRow()` to add `{ quantity: '1', price: '' }`
- Use `ensureEmptyRow()` to auto-add row after user input
- Focus new row's quantity input
- Items maintain insertion order (no automatic sorting)

**Item Deletion:**
- Use `splice(index, 1)` on `appData.items`
- Save and re-render immediately
- Confirm with `confirm()` for destructive actions

**Budget Tracking:**
- Percentage calculation: `(subtotal / maxBudget) * 100`
- Warning class at 75%, danger at 100%
- Update classList on footer element

**PWA Features:**
- Manifest: `manifest.json`
- Icons: Multiple sizes for Apple devices
- Meta tags for iOS web app capability
- Service worker: Not implemented (add if needed for offline support)

**Deployment:**
- Docker with nginx: `docker compose up -d`
- Environment file: `.env` for port configuration
- Static files served directly (no build step)
