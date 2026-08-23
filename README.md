# KiShop — Mobile Shopping Lists & Budget Tracker

A mobile-first web app for managing shopping lists with tax-aware totals and tracking spending against a configurable budget.

## Features

- **Budget Management**: Set a maximum subtotal amount at the top with real-time progress tracking
- **Two Views**: Budget Tracker for expense monitoring and Shopping List for item management
- **Rapid Entry**: Quickly add items by price and quantity in the Budget Tracker
- **Shopping List**: Add items with names and quantities; mark items as completed
- **Filter Chips**: Sort shopping list items by Recently Added, A-Z, or By Quantity
- **Quick Add Bar**: Floating input bar for fast item entry in the Shopping List view
- **Dark/Light Theme**: Toggle between light and dark modes (preference saved locally)
- **Mobile Optimized**: Numeric inputs trigger numpad keyboard on mobile devices (`inputmode="decimal"` / `inputmode="numeric"`)
- **Real-time Calculations**: Automatic subtotals, tax (11.5%), and grand totals
- **Visual Warnings**: Progress bar changes color when approaching budget (orange at 75%, red at 100%)
- **Persistent Data**: All data saved to a SQLite database via the backend API
- **User Accounts**: Each user has their own budget, budget items and shopping list
- **Admin Panel**: Admins can create users (regular or admin), reset passwords, and delete users
- **Auto-add Rows**: New rows are added automatically; Enter key navigation supported

## Usage

### Budget Tracker View
1. Open the app in a web browser
2. Set your maximum budget at the top (optional)
3. Use **Rapid Entry** to add items by entering price and quantity
4. View real-time totals, tax, and remaining budget percentage in the hero section
5. Click the delete button (🗑️) to remove items
6. Use "Clear All" to reset the recent items list

### Shopping List View
1. Switch to the Shopping List tab using the bottom navigation
2. Use the **Quick Add** bar to add items by name
3. Edit item names and quantities inline
4. Check items off as you shop (they move to the Completed section)
5. Filter items using the chip bar (Recently Added, A-Z, By Quantity)

## User Accounts & Authentication

- The app requires signing in; all data is scoped to the logged-in user
- On first run a default admin account is created: username `admin`, password `kishop` — **change this immediately** via the Admin Panel
- Admins can open the **Admin Panel** from the avatar menu in the top bar to:
  - Create new users (with a password and `user`/`admin` role)
  - Reset any user's password (this signs that user out everywhere)
  - Delete users along with their data (the last remaining admin cannot be deleted)
- Passwords are stored as salted scrypt hashes; sessions use HttpOnly cookies
- Upgrading from an older single-user install: existing data is automatically migrated to the default admin account on startup

## Technical Details

- **Frontend**: Pure HTML/CSS/JavaScript (no build step required)
- **Backend**: Node.js/Express with SQLite database (`backend/server.js`, `backend/database.js`)
- **Responsive design** with mobile-first approach
- Uses `inputmode="decimal"` and `inputmode="numeric"` for numeric inputs on mobile
- **SQLite database** for persistent data storage (mounted as a Docker volume)
- Theme preference saved to localStorage (data is server-side)
- Fixed 11.5% tax rate
- One-time migration from localStorage to SQLite for existing users

## Docker Deployment

### Quick Start

```bash
# Build and run (exposes app on port 3000)
docker compose up -d

# Stop
docker compose down
```

The app will be available at `http://localhost:3000`. Database data is persisted in the `kishop` Docker volume.

## Browser Support

Works on all modern browsers (Chrome, Firefox, Safari, Edge)
