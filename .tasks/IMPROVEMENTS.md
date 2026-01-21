# KiShop - Improvement Tasks

## High Priority (Must Fix)

### 1. Security Improvements
- **Task**: Fix CORS configuration in backend - replace wildcard with specific origins
- **Location**: [`backend/server.js`](backend/server.js:11)
- **Issue**: Current CORS policy allows all origins (*), which is a security risk

- **Task**: Add input validation and sanitization to backend API
- **Location**: [`backend/server.js`](backend/server.js)
- **Issue**: No validation for incoming API requests, potential for malicious input

### 2. Error Handling
- **Task**: Add error handling for API failures in frontend with user feedback
- **Location**: [`app.js`](app.js)
- **Issue**: Current error handling only logs to console, user sees no feedback

### 3. Performance
- **Task**: Implement proper database connection management in backend
- **Location**: [`backend/database.js`](backend/database.js)
- **Issue**: No connection closing logic, potential resource leaks

### 4. Data Integrity
- **Task**: Store numeric values (quantity, price, budget) as numbers instead of strings in database
- **Location**: [`backend/database.js`](backend/database.js:30-31), [`app.js`](app.js)
- **Issue**: Currently storing numeric data as strings, causing parsing overhead

## Medium Priority (Should Improve)

### 1. Testing & Code Quality
- **Task**: Add npm scripts for linting and testing in backend
- **Location**: [`backend/package.json`](backend/package.json)
- **Issue**: No linting or test commands configured

- **Task**: Add frontend testing setup with basic test cases
- **Files**: New files (e.g., `tests/`)
- **Issue**: No test coverage for frontend logic

### 2. API Enhancements
- **Task**: Add pagination or filtering for shopping items
- **Location**: [`backend/server.js`](backend/server.js:44), [`app.js`](app.js:21)
- **Issue**: No limits on items returned, potential performance issues with large lists

- **Task**: Implement bulk delete endpoint for clearing all items
- **Location**: [`backend/server.js`](backend/server.js), [`app.js`](app.js:275)
- **Issue**: Current "Clear All" sends multiple individual DELETE requests

### 3. User Experience
- **Task**: Add loading states for API operations
- **Location**: [`app.js`](app.js)
- **Issue**: User sees no feedback when data is being loaded or saved

- **Task**: Implement item reordering functionality
- **Location**: [`app.js`](app.js), [`backend/server.js`](backend/server.js), [`backend/database.js`](backend/database.js)
- **Issue**: Items are only ordered by position, no drag-and-drop

### 4. Configuration
- **Task**: Make tax rate configurable via environment variable
- **Location**: [`app.js`](app.js:1), [`backend/server.js`](backend/server.js)
- **Issue**: Tax rate is hardcoded at 11.5%, not customizable

## Low Priority (Nice to Have)

### 1. PWA Features
- **Task**: Implement service worker for offline functionality
- **Files**: New file (e.g., `sw.js`)
- **Issue**: App doesn't work offline currently

- **Task**: Add push notification support for budget alerts
- **Location**: [`backend/server.js`](backend/server.js), [`app.js`](app.js)
- **Issue**: No notifications when approaching budget limits

### 2. UI/UX Improvements
- **Task**: Add item categories or tags
- **Location**: [`app.js`](app.js), [`backend/server.js`](backend/server.js), [`backend/database.js`](backend/database.js)
- **Issue**: No organization for shopping items

- **Task**: Implement dark/light theme toggle
- **Location**: [`styles.css`](styles.css), [`app.js`](app.js)
- **Issue**: Only dark theme available

### 3. Analytics
- **Task**: Add basic analytics for user interactions
- **Location**: [`app.js`](app.js)
- **Issue**: No tracking of user behavior or app usage

### 4. Documentation
- **Task**: Update README with API documentation
- **Location**: [`README.md`](README.md)
- **Issue**: API endpoints not documented for developers

## Technical Debt

### 1. Code Structure
- **Task**: Refactor frontend code into modules
- **Location**: [`app.js`](app.js)
- **Issue**: Single monolithic file, hard to maintain

- **Task**: Implement async/await pattern for all database operations
- **Location**: [`backend/database.js`](backend/database.js)
- **Issue**: Current callback pattern leads to nested code

### 2. Dependencies
- **Task**: Update dependencies to latest versions
- **Location**: [`backend/package.json`](backend/package.json)
- **Issue**: Dependencies may be outdated, potential security vulnerabilities

### 3. Build Process
- **Task**: Add build process for frontend assets
- **Files**: New files (e.g., `webpack.config.js`)
- **Issue**: No minification or bundling for production

### 4. Environment Configuration
- **Task**: Add more detailed environment variable documentation
- **Location**: [`.env.example`](.env.example)
- **Issue**: Limited configuration options documented

## Notes

- Tasks are ordered by priority, with High Priority tasks addressing critical issues
- Each task includes location references to relevant files
- Some tasks may require changes across multiple files
- Consider using feature branches for each improvement to maintain code quality
