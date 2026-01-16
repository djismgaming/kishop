# KICart - Mobile Shopping List

A mobile-first web app for managing shopping lists and calculating totals with tax.

## Features

- **Budget Management**: Set a maximum subtotal amount at the top
- **Shopping List**: Add items with quantity and price
- **Mobile Optimized**: Numeric inputs trigger numpad keyboard on mobile devices
- **Real-time Calculations**: Automatic totals with 11.5% tax
- **Visual Warnings**: Bottom panel changes color when approaching budget (orange at 75%, red at 100%)
- **Persistent Data**: All data saved to localStorage
- **Easy Entry**: Auto-adds new rows, Enter key navigation

## Usage

1. Open `index.html` in a web browser
2. Set your maximum budget at the top (optional)
3. Enter quantity and price for each item
4. View totals in the fixed bottom panel
5. Click the × button to remove items
6. Use "Clear All" to reset the entire list

## Technical Details

- Pure HTML/CSS/JavaScript (no build step required)
- Responsive design with mobile-first approach
- Uses `inputmode="decimal"` for numeric inputs on mobile
- localStorage for data persistence
- Fixed 11.5% tax rate

## Docker Deployment

### Quick Start

```bash
# Copy environment file
cp .env.example .env

# Edit ports in .env if needed (default: HTTP=8080, HTTPS=8443)

# Build and run
docker compose up -d

# Stop
docker compose down
```

### Custom Ports

Edit `.env` file:

```
HTTP_PORT=3000
HTTPS_PORT=3443
```

Then restart:

```bash
docker compose up -d --force-recreate
```

## Browser Support

Works on all modern browsers (Chrome, Firefox, Safari, Edge)
