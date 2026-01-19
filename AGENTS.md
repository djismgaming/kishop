# Agent Guidelines for KiShop

KiShop is a mobile-first shopping list web app with vanilla HTML/CSS/JavaScript frontend and Node.js/Express backend with SQLite database.

## Build, Test, and Lint Commands

**Backend (Node.js/Express):**
```bash
cd backend
npm install          # Install dependencies
npm start            # Start backend server (PORT=3001 by default)
npm run dev          # Start with nodemon (if added)
```

**Frontend:**
```bash
# Serve locally (any HTTP server)
python -m http.server 8000
# or
npx serve .

# Or open index.html directly in a browser
```

**Docker Deployment:**
```bash
docker compose up -d    # Start backend and frontend
docker compose down     # Stop and remove containers
```

No linting or test commands are currently configured.

## Architecture Overview

**Frontend:**
- `index.html` - Main HTML structure
- `app.js` - Application logic (fetch API calls, DOM manipulation)
- `styles.css` - All styling
- `manifest.json` - PWA manifest

**Backend:**
- `backend/server.js` - Express API server with CORS
- `backend/database.js` - SQLite database operations
- `backend/package.json` - Node dependencies

## Database Schema

**Tables:**
- `shopping_data`: Singleton table (id=1) with `max_budget` column
- `shopping_items`: Auto-increment `id`, `quantity` (TEXT), `price` (TEXT), `position` (INTEGER)

**Environment Variables:**
- `PORT`: Backend server port (default: 3001)
- `DB_PATH`: SQLite database file path (default: /data/shopping.db)

## API Endpoints

All endpoints prefixed with `/api`:

- `GET /api/budget` - Get current max budget
- `PUT /api/budget` - Update max budget
- `GET /api/items` - Get all shopping items (ordered by position)
- `POST /api/items` - Create new item
- `PUT /api/items/:id` - Update item by ID
- `DELETE /api/items/:id` - Delete item by ID

## Frontend Code Style (app.js)

**Naming Conventions:**
- Functions: camelCase (e.g., `loadData`, `formatCurrency`)
- Variables: camelCase (e.g., `appData`, `maxBudget`)
- Constants: UPPER_SNAKE_CASE (e.g., `TAX_RATE`, `API_BASE`)
- DOM elements by ID: kebab-case (e.g., `shopping-list`, `max-budget`)

**Constants:**
```javascript
const API_BASE = '/api';
const TAX_RATE = 0.115; // 11.5%
```

**Variable Declarations:**
- Use `const` for constants and values that don't change
- Use `let` for variables that need reassignment
- Never use `var`

**Code Organization:**
- Define constants at top of file
- Global state object: `appData` with `maxBudget` and `items` array
- Functions grouped: API calls → calculations → DOM manipulation → event handlers
- `init()` function called on `DOMContentLoaded`

**API/Fetch Calls:**
- Use `fetch()` with `API_BASE` for all backend communication
- Parse responses with `await response.json()`
- Handle HTTP errors: `if (!response.ok) throw new Error()`
- Log errors: `console.error('Error description:', e)`
- Use try-catch for all async operations

**DOM Manipulation:**
- Use `document.getElementById()` for single elements
- Use `querySelector()` and `querySelectorAll()` for complex selectors
- Use `createElement()` for new elements
- Use template literals for HTML strings with proper escaping
- Avoid direct `innerHTML` assignment with user input

**Event Handling:**
- Use `addEventListener()` for all event handlers
- Use `blur` for input validation/processing
- Use `input` for real-time updates
- Use `focus` for UX improvements (selecting text)
- Use `e.relatedTarget` to detect focus direction

**Input Handling:**
- Use `inputmode="decimal"` for numeric inputs on mobile
- Parse numbers with `parseFloat(value) || 0`
- Use `min`, `step` attributes for numeric constraints
- Format currency with helper: `'$' + amount.toFixed(2)`

**localStorage Migration:**
- `migrateFromLocalStorage()` function transfers old localStorage data to backend API
- Call only if API returns no data

## Backend Code Style (backend/)

**Naming Conventions:**
- Functions: camelCase (e.g., `getBudget`, `updateItem`)
- Variables: camelCase (e.g., `db`, `req`, `res`)
- Constants: UPPER_SNAKE_CASE (e.g., `DB_PATH`)

**Express Patterns:**
- Use `app.get/post/put/delete()` for route handlers
- Async handlers: use `async/await` with try-catch
- Send JSON responses: `res.json({ data })`
- Send error responses: `res.status(500).json({ error })`
- Log errors: `console.error('Error:', e)`

**Database Operations (database.js):**
- Use parameterized queries to prevent SQL injection
- Use callback pattern: `db.run(query, params, (err) => { ... })`
- Close connections: `db.close()` on shutdown
- Initialize database on server start

**Error Handling:**
- Wrap database operations in try-catch or use error callbacks
- Return 500 status codes for server errors
- Include error messages in response JSON

## CSS Styles (styles.css)

**Naming Conventions:**
- Classes: kebab-case (e.g., `.shopping-list-container`, `.delete-btn`)
- IDs: kebab-case (e.g., `#shopping-list`, `#max-budget`)
- Modifiers: BEM-style (e.g., `.totals-panel.warning`, `.totals-panel.danger`)

**CSS Architecture:**
- Mobile-first with `@media` for larger screens
- Reset at top
- Global styles first, then component-specific styles
- Use `:focus-within` for parent focus states
- Transitions for interactive elements

**Layout:**
- Use flexbox for simple alignments
- Use grid for structured layouts
- Sticky positioning for headers/footers
- Fixed positioning for footer panel

**Responsive Design:**
- Breakpoint: `@media (max-width: 480px)`
- Minimum touch target: 40px×40px (36px×36px on mobile)

**Colors:**
- Primary: `#4a90e2` (blue)
- Success: `#d4edda` (green background)
- Warning: `#fff3cd` (yellow background)
- Danger: `#f8d7da` (red background)
- Delete button: `#ff6b6b`

## Key Implementation Patterns

**Adding Items:**
- Frontend: POST to `/api/items` with `{ quantity, price }`
- Backend: Insert with position calculated from existing items
- Focus new row's quantity input
- Items maintain insertion order (sorted by position)

**Item Deletion:**
- Frontend: DELETE to `/api/items/:id`
- Backend: Delete by ID from database
- Frontend re-renders immediately
- Confirm with `confirm()` for destructive actions

**Budget Tracking:**
- GET from `/api/budget` to load max budget
- PUT to `/api/budget` to update
- Percentage calculation: `(subtotal / maxBudget) * 100`
- Warning class at 75%, danger at 100%

**Total Calculations:**
- `totalQty` only includes items with a price > 0
- `subtotal` and `grandTotal` include all items regardless of price
- Tax rate: `TAX_RATE = 0.115` (11.5%)

**PWA Features:**
- Manifest: `manifest.json`
- Icons: Multiple sizes for Apple devices
- Meta tags for iOS web app capability
- Service worker: Not implemented

## Deployment

**Docker:**
- Backend and frontend served together
- Backend on port 3001 (internal), exposed via nginx
- Frontend static files served by nginx
- Environment file: `.env` for configuration
