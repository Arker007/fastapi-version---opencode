# InvoiceFlow — Billing & Inventory Management System
## Comprehensive Technical Documentation for Project Report

---

# 1. PROJECT OVERVIEW

**Project Name:** InvoiceFlow — Billing & Inventory Management System  
**Purpose:** A full-stack web application for small-to-medium businesses to manage billing, inventory, customers, and reporting.  
**Target Users:** Retail shop owners, sales staff, inventory managers, business administrators.  
**Version:** 2.0.0  
**Repository:** GitHub (private)  
**Development Period:** 6th Semester, 2026  

### Core Business Problems Solved:
1. Manual billing is slow and error-prone — InvoiceFlow automates invoice generation with real-time price/GST calculations
2. Inventory tracking is scattered across spreadsheets — centralized product/stock database with low-stock alerts
3. Customer relationship management is ad-hoc — structured CRM with purchase history tracking
4. Business insights are hard to extract — 6 types of analytical reports with CSV export
5. Multi-user access without proper controls — role-based authentication (admin/staff) with audit logging

### Key Metrics:
- Backend: Single-file FastAPI application (1066 lines)
- Frontend: 9 HTML pages + 9 JavaScript modules + 1 CSS design system (2124 lines)
- Database: SQLite with 8 tables, auto-initialized with demo data
- API Endpoints: ~25 REST endpoints
- External Dependencies: 4 Python packages, 2 Node.js packages

---

# 2. PROBLEM STATEMENT & NEED ANALYSIS

### 2.1 Current Challenges in Small Business Billing

**Manual Invoicing:**
- Handwritten bills are illegible and unprofessional
- Manual arithmetic leads to calculation errors in subtotals, discounts, and GST
- No systematic record-keeping makes financial audits difficult
- Duplicate billing and revenue leakage are common

**Inventory Management Issues:**
- Stock levels are tracked in physical ledgers or spreadsheets
- No automated alerts when stock reaches minimum threshold
- Difficulty in identifying slow-moving vs fast-moving products
- No location-based tracking (storefront vs warehouse)

**Customer Relationship Gaps:**
- No centralized customer database
- Purchase history is not tracked systematically
- Repeated customers are not identified or rewarded
- Contact information is scattered across notebooks

**Reporting & Compliance:**
- GST calculations are done manually, prone to errors
- No historical sales data for trend analysis
- Tax filing requires laborious manual compilation
- Business decisions are made without data support

**Access Control & Security:**
- Any staff member can access all business data
- No accountability for who made what changes
- Sensitive operations (delete product, create user) are not restricted
- No audit trail for security incidents

### 2.2 Proposed Solution

InvoiceFlow addresses all these challenges through:
1. A digital point-of-sale interface with real-time calculations
2. Centralized inventory database with low-stock alerts
3. Customer CRM with purchase history
4. 6 report types for business analytics
5. Role-based access control with audit logging
6. Dark/light themed professional UI

---

# 3. TECHNOLOGY STACK & JUSTIFICATION

### 3.1 Backend: Python FastAPI

| Aspect | Detail |
|--------|--------|
| **Language** | Python 3.10+ |
| **Framework** | FastAPI 0.115+ |
| **Server** | Uvicorn 0.30+ (ASGI) |
| **Authentication** | PyJWT (HS256, 12hr expiry) |
| **Password Hashing** | PBKDF2-HMAC-SHA256 (120,000 iterations) |
| **Configuration** | python-dotenv |

**Why FastAPI?**
- Automatic OpenAPI/Swagger documentation generation
- Pydantic models for request/response validation
- Async support for concurrent request handling
- Type hints enable IDE autocomplete and static analysis
- Lightweight — single file deployment possible
- Built-in dependency injection system

**Why Uvicorn?**
- ASGI server with high performance
- Hot-reload support for development
- Production-grade with worker support

**Why SQLite?**
- Zero-configuration database — no server setup needed
- File-based storage simplifies backup and deployment
- Sufficient for small business scale (single-user/single-store)
- ACID compliant with transaction support
- Supported directly by Python's standard library

**Why JWT (JSON Web Tokens)?**
- Stateless authentication — no server-side sessions needed
- Token contains user identity and role claims
- Frontend stores token in localStorage, sends via Bearer header
- Token expiry forces periodic re-authentication

**Why PBKDF2?**
- NIST-recommended password hashing algorithm
- Configurable iteration count makes brute-force expensive
- Salt prevents rainbow table attacks
- Built into Python's hashlib — no extra dependencies

### 3.2 Frontend: Vanilla JavaScript + HTML/CSS

| Aspect | Detail |
|--------|--------|
| **UI Framework** | None (vanilla) |
| **CSS Design System** | Custom Shadcn-inspired (dark/light) |
| **Charts** | Chart.js (CDN-loaded) |
| **Icons** | Font Awesome 6.4 |
| **Fonts** | Inter (body), Outfit (headings) — Google Fonts |
| **Architecture** | Multi-Page Application (MPA) |

**Why Vanilla JS (No Framework)?**
- Zero build step — files served directly as static assets
- Maximum simplicity — no webpack, Vite, or transpilation needed
- Each HTML page is independently loadable and readable
- Lower learning curve for maintenance
- Faster initial page load (no framework bundle)
- The proxy server (Express) serves files directly from the filesystem

**Why MPA over SPA?**
- No client-side routing complexity
- Each page is a separate concern with isolated JS scope
- Browser back/forward buttons work naturally
- Simpler deployment — each HTML page is a standalone entry point

**Why Chart.js?**
- Lightweight (60KB minified)
- Simple JavaScript API
- Supports line, doughnut, bar, pie, radar charts
- Responsive by default with canvas-based rendering

### 3.3 Proxy Server: Node.js Express

| Aspect | Detail |
|--------|--------|
| **Runtime** | Node.js |
| **Framework** | Express 4.19 |
| **Purpose** | Static file server + API reverse proxy |
| **Port** | 3000 (configurable via .env) |

**Why an Express Proxy?**
- Avoids CORS complexities in development
- Single origin for both frontend assets and API calls
- Can add caching, rate limiting, logging at proxy level
- Enables future middleware additions without touching the backend

### 3.4 Architecture Diagram

```
[User Browser]
      |
      | HTTP (localhost:3000)
      v
[Express Proxy (Node.js)] -----> [Static Files: frontend/]
      |
      | /api/* proxy to localhost:8000
      v
[FastAPI Backend (Python)]
      |
      | SQLite connection
      v
[SQLite Database File]
```

### 3.5 Package Dependencies

**Python (requirements.txt):**
```
fastapi>=0.115,<1.0        # Web framework with OpenAPI
uvicorn[standard]>=0.30,<1.0  # ASGI server
PyJWT>=2.9,<3.0            # JWT encode/decode
python-dotenv>=1.0,<2.0    # Environment variable loading
```

**Node.js (package.json):**
```json
{
  "dependencies": {
    "express": "^4.19.2",    // HTTP server + routing
    "dotenv": "^17.4.2"      // .env file loading
  },
  "devDependencies": {
    "nodemon": "^3.1.14"     // Auto-restart on file changes
  }
}
```

---

# 4. SYSTEM ARCHITECTURE

### 4.1 Architecture Style

Three-tier architecture:
1. **Presentation Tier:** Browser-based frontend (HTML/CSS/JS)
2. **Application Tier:** FastAPI backend (business logic, auth, data access)
3. **Data Tier:** SQLite database file

### 4.2 Request Flow

1. User navigates to `http://localhost:3000/dashboard`
2. Express serves `frontend/dashboard.html` as a static file
3. `common.js` executes on page load:
   - Reads JWT token from localStorage
   - Calls `GET /api/auth/me` to validate session
   - Injects sidebar/navbar layout into the page
   - Dispatches `page-ready` custom event
4. Page-specific JS (e.g., `dashboard.js`) listens for `page-ready`
5. Makes parallel API calls to fetch data
6. Renders data into DOM elements

### 4.3 Authentication Flow

```
Login:
  1. User submits username + password
  2. POST /api/auth/login -> FastAPI
  3. Backend looks up user in SQLite
  4. Verifies password using PBKDF2
  5. Creates JWT with {sub, username, role, fullname, exp}
  6. Returns token + user object
  7. Frontend stores token in localStorage('invoiceflow-token')
  8. Redirects to /dashboard

Subsequent Requests:
  1. Frontend attaches Authorization: Bearer <token>
  2. Express proxy forwards the header
  3. FastAPI get_current_user dependency:
     a. Extracts token from header
     b. Decodes JWT using HS256 + secret
     c. Looks up user by ID from payload
     d. Returns user dict or raises 401
  4. require_admin dependency checks role === 'admin'

Session Expiry:
  - Token expires after 12 hours
  - On 401/403 response, frontend clears token, redirects to /login
  - No refresh token mechanism (simplicity)
```

### 4.4 File Structure

```
project-root/
├── backend/
│   └── main.py              # FastAPI app (1066 lines)
├── frontend/
│   ├── common.js             # Core: auth, layout, API, theme, components
│   ├── style.css            # Design system (2124 lines)
│   ├── login.html / .js     # Authentication page
│   ├── dashboard.html / .js # Analytics dashboard
│   ├── billing.html / .js   # POS/invoice creation
│   ├── invoices.html / .js  # Invoice history + print
│   ├── products.html / .js  # Product & category management
│   ├── customers.html / .js # Customer CRM
│   ├── reports.html / .js   # Reports directory
│   ├── admin-panel.html / .js # User mgmt + settings
│   ├── logs.html / .js      # Audit log viewer
│   └── index.html           # Root redirect -> /login
├── server.js                # Express proxy (51 lines)
├── docs/                    # Documentation directory
├── package.json
├── requirements.txt
└── .env                     # JWT_SECRET, PORT, API_BASE_URL
```

---

# 5. DATABASE DESIGN

### 5.1 Entity-Relationship Diagram (Textual)

```
users ────┬── invoices ────┬── invoice_items ──── products
          │                │
          │                └── payments
          │
          └── logs

customers ──── invoices

categories ──── products

settings (standalone key-value store)
```

### 5.2 Table Definitions

#### users
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | Unique user identifier |
| username | TEXT | UNIQUE NOT NULL | Login username |
| password_salt | TEXT | NOT NULL | PBKDF2 salt (hex) |
| password_hash | TEXT | NOT NULL | PBKDF2 digest (hex) |
| password_plaintext | TEXT | nullable | Demo convenience field |
| fullname | TEXT | NOT NULL | Display name |
| role | TEXT | CHECK IN ('admin','staff') | Access level |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Account creation |

#### categories
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | Unique category ID |
| name | TEXT | UNIQUE NOT NULL | Category name |
| description | TEXT | nullable | Category description |

#### products
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | Unique product ID |
| name | TEXT | NOT NULL | Product name |
| sku | TEXT | UNIQUE NOT NULL | Stock Keeping Unit |
| category_id | INTEGER | FK -> categories.id ON DELETE SET NULL | Product category |
| price | REAL | NOT NULL | Selling price (INR) |
| stock | INTEGER | NOT NULL DEFAULT 0 | Current stock level |
| min_stock | INTEGER | NOT NULL DEFAULT 5 | Low stock threshold |
| gst_rate | REAL | NOT NULL DEFAULT 18.0 | GST percentage |
| location | TEXT | DEFAULT 'storefront' CHECK IN ('storefront','warehouse') | Stock location |
| description | TEXT | nullable | Product description |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Product creation date |

#### customers
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | Unique customer ID |
| name | TEXT | NOT NULL | Customer full name |
| phone | TEXT | UNIQUE NOT NULL | Phone number |
| email | TEXT | nullable | Email address |
| address | TEXT | nullable | Billing address |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Registration date |

#### invoices
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | Unique invoice ID |
| invoice_number | TEXT | UNIQUE NOT NULL | Formatted: INV-YYYYMMDD-SEQ |
| customer_id | INTEGER | FK -> customers.id ON DELETE SET NULL | Customer reference |
| user_id | INTEGER | FK -> users.id ON DELETE SET NULL | Staff who created |
| subtotal | REAL | NOT NULL | Sum of line items (excl GST) |
| discount | REAL | DEFAULT 0 | Discount amount (INR) |
| gst | REAL | DEFAULT 0 | Total GST amount |
| total | REAL | NOT NULL | Final total (subtotal - discount + gst) |
| payment_status | TEXT | DEFAULT 'paid' CHECK IN ('paid','pending','unpaid') | Payment status |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Invoice creation time |

#### invoice_items
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | Unique line item ID |
| invoice_id | INTEGER | FK -> invoices.id ON DELETE CASCADE | Parent invoice |
| product_id | INTEGER | FK -> products.id ON DELETE SET NULL | Product reference |
| product_name | TEXT | nullable | Denormalized product name |
| product_sku | TEXT | nullable | Denormalized SKU |
| quantity | INTEGER | NOT NULL | Quantity sold |
| unit_price | REAL | NOT NULL | Price per unit at time of sale |
| total_price | REAL | NOT NULL | quantity * unit_price |
| gst_rate | REAL | NOT NULL DEFAULT 18.0 | GST rate applied |

#### payments
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | Unique payment ID |
| invoice_id | INTEGER | FK -> invoices.id ON DELETE CASCADE | Associated invoice |
| amount | REAL | NOT NULL | Payment amount |
| payment_method | TEXT | CHECK IN ('cash','card','upi') | Payment mode |
| transaction_reference | TEXT | nullable | UPI/card transaction ID |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Payment timestamp |

#### logs
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | Unique log entry ID |
| user_id | INTEGER | FK -> users.id ON DELETE SET NULL | User who performed action |
| action | TEXT | NOT NULL | Action type (e.g., LOGIN, INVOICE_CREATE, PRODUCT_DELETE) |
| details | TEXT | nullable | Human-readable description |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Event timestamp |

#### settings
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| key | TEXT | UNIQUE NOT NULL | Setting identifier |
| value | TEXT | NOT NULL | Setting value (string) |

### 5.3 Seed Data

**Default Users:**
- admin / admin123 (role: admin)
- staff / staff123 (role: staff)

**Default Categories:** Electronics, Groceries, Apparel, Stationery

**Default Products:**
1. Wireless Mouse (Electronics, ₹499, 18% GST, stock: 25)
2. Mechanical Keyboard (Electronics, ₹2499, 18% GST, stock: 12)
3. Instant Coffee 100g (Groceries, ₹280, 5% GST, stock: 50)
4. A4 Notebook 5-Pack (Stationery, ₹180, 12% GST, stock: 30)
5. Cotton T-Shirt (Apparel, ₹599, 5% GST, stock: 4 — LOW STOCK)

**Default Customers:**
1. John Doe (9876543210)
2. Aarav Mehta (9898989898)
3. Sneha Sharma (9123456789)

**Default Settings:**
- company_name: InvoiceFlow Ltd
- company_address: 102 Rajpur Road, Dehradun, Uttarakhand, India
- company_phone: +91 9876543210
- company_email: billing@invoiceflow.com
- default_gst: 18

### 5.4 Invoice Number Generation

Format: `INV-YYYYMMDD-SEQ` where SEQ is padded to 4 digits, incremented per day.

Examples: `INV-20260705-0001`, `INV-20260705-0002`, `INV-20260706-0001`

---

# 6. API DESIGN

### 6.1 Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | None | Authenticate user, return JWT |
| GET | /api/auth/me | JWT | Return current user info |

### 6.2 Dashboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/dashboard/summary | JWT | KPI aggregates (total sales, invoice count, product count, low stock count) |
| GET | /api/dashboard/sales-chart | JWT | Last 7 days daily sales (fills missing dates with 0) |
| GET | /api/dashboard/category-chart | JWT | Sales breakdown by product category |
| GET | /api/dashboard/top-products | JWT | Top 5 products by quantity sold |
| GET | /api/dashboard/recent-invoices | JWT | Last 5 invoices |

### 6.3 Products

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/products | JWT | List all products with category names |
| POST | /api/products | Admin | Create product (auto-generates SKU if not provided) |
| PUT | /api/products/{id} | Admin | Update product fields |
| DELETE | /api/products/{id} | Admin | Delete product |

### 6.4 Categories

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/categories | JWT | List all categories |
| POST | /api/categories | Admin | Create category |
| PUT | /api/categories/{id} | Admin | Update category |
| DELETE | /api/categories/{id} | Admin | Delete category |

### 6.5 Customers

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/customers | JWT | List all customers |
| POST | /api/customers | JWT | Register customer (phone must be unique) |
| PUT | /api/customers/{id} | JWT | Update customer |
| DELETE | /api/customers/{id} | Admin | Delete customer |
| GET | /api/customers/{id}/history | JWT | Get customer's purchase history |

### 6.6 Invoices & Billing

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/invoices | JWT | List all invoices with customer/biller info |
| POST | /api/invoices | JWT | Create invoice (validates stock, deducts inventory, creates payment record) |
| GET | /api/invoices/{id} | JWT | Get invoice with items and payment details |

### 6.7 Reports

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/reports/{type} | JWT | Generate report by type |

**Report Types:**
1. `daily_sales` — Last 30 days aggregated by date
2. `monthly_sales` — All months aggregated
3. `gst_report` — Taxable amount and GST by rate slab
4. `stock_availability` — All products with stock status
5. `low_stock_alert` — Products where stock <= min_stock
6. `invoice_report` — All invoices with full details

### 6.8 Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/admin/users | Admin | List all users |
| POST | /api/admin/users | Admin | Create new user |
| DELETE | /api/admin/users/{id} | Admin | Delete user (cannot delete self) |
| GET | /api/admin/logs | Admin | Last 200 audit log entries |

### 6.9 Settings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/settings | JWT | Get all settings as key-value map |
| PUT | /api/settings | Admin | Update settings |

### 6.10 Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/health | None | Service health check |

---

# 7. FRONTEND ARCHITECTURE

### 7.1 Application Shell (common.js)

**Session Management:**
- Token stored in `localStorage.getItem('invoiceflow-token')`
- On every page except login, token presence is checked
- If missing, redirect to `/login`
- If present, `GET /api/auth/me` validates session

**Page Decoration System:**
- Each HTML page has a `<div id="page-content" class="hidden">` container
- `common.js` wraps this content in a full layout with:
  - Sidebar navigation (260px, collapsible to 80px)
  - Top header bar with view title, date badge, theme toggle
  - Main content viewport
- Sidebar auto-detects which view is active by URL path
- Admin-only menu items are hidden for staff users

**Theme System:**
- CSS custom properties define dark/light color schemes
- Default: dark mode (`data-theme` attribute absent)
- Light mode: `document.documentElement.setAttribute('data-theme', 'light')`
- User preference persisted in `localStorage('invoiceflow-theme')`

**Web Components (Custom Elements):**
1. `<kpi-card>` — Dashboard KPI display with icon, label, value
2. `<modal-dialog>` — Slide-in modal with header, body, close button
3. `<search-bar>` — Search input with magnifying glass icon

**API Wrapper:**
- `window.APP.api(path, options)` function
- Auto-attaches `Authorization: Bearer <token>` header
- Auto-stringifies JSON body
- On 401/403 response: clears session, redirects to login
- Parses JSON or text based on Content-Type

**Toast Notification System:**
- Slide-in toasts from top-right
- Types: success (green), error (red), info (blue)
- Auto-dismiss after 3.5 seconds with fade-out animation

**Utility Functions:**
- `formatCurrency(amount)` — INR formatting with `Intl.NumberFormat('en-IN')`
- `formatDate(isoStr)` — Formats to "MMM DD, YYYY"
- `formatDateTime(isoStr)` — Full date + time
- `esc(str)` — XSS-safe HTML escaping

### 7.2 Page-Specific Modules

**login.js (56 lines):**
- Listens for form submit
- Calls `POST /api/auth/login` with username/password
- Stores JWT in localStorage
- Redirects to `/dashboard` on success
- Shows error message on failure

**dashboard.js (158 lines):**
- Fires 5 parallel API calls on page-ready
- Populates 4 KPI cards (total sales, invoice count, product count, low stock)
- Renders Chart.js line chart for 7-day sales
- Renders Chart.js doughnut chart for sales by category
- Renders top 5 products table
- Renders 5 recent invoices table
- Low stock KPI card is clickable (links to /products)

**billing.js (300 lines):**
- Cart state maintained in module-level STATE object
- Draft cart persisted to `sessionStorage('invoiceflow-draft-cart')`
- Product selection updates stock/price display
- Category dropdown for payment method selection (cash/UPI/card)
- Transaction reference field shows/hides based on payment method
- Checkout: validates stock deducts on server, creates invoice + payment record
- Quick customer registration via modal without leaving billing page

**products.js (381 lines):**
- Tab-based UI: Products List | Category Management
- Location filter dropdown (All / Storefront / Warehouse)
- Hide out-of-stock toggle
- Product edit/delete via action dropdown menus (admin only)
- Category create/edit/delete support
- Dynamic category selector dropdown

**customers.js (190 lines):**
- Customer registry with edit/delete actions
- Purchase history modal shows all invoices per customer
- Delete restricted to admin role

**invoices.js (174 lines):**
- Searchable invoice list
- Click row to open detailed invoice view in modal
- Print button opens new window with formatted invoice
- Company branding from settings (logo, name, address)
- Billing details, items table, totals, payment info

**reports.js (172 lines):**
- Report type selector dropdown (6 report types)
- Dynamic column detection: currency columns auto-formatted with `formatCurrency`
- Client-side search/filter on report table
- CSV export (generates downloadable .csv file)
- Print report in formatted layout

**admin-panel.js (219 lines):**
- User management: list users, create (fullname/username/password/role), delete
- Cannot delete self (self-deletion blocked by frontend AND backend)
- Settings editor: company info, default GST, logo upload
- Logo upload converts to base64 data URL (500KB limit)
- Logo preview and removal

**logs.js (38 lines):**
- Displays audit log table: timestamp, user, action, details
- Constrained to last 200 entries

### 7.3 CSS Design System (style.css)

**Theming (Shadcn-inspired):**
- Dark mode default with `:root` variables
- Light mode override via `[data-theme="light"]`
- Both modes define: background, text, border, input, badge, button colors
- Consistent use of CSS custom properties throughout

**Layout Components:**
- Login card (centered, max-width 420px)
- App wrapper (flex row: sidebar + main content)
- Sidebar (fixed, 260px, collapsible to 80px with tooltips)
- Main content area (responsive padding, min-height 100vh)

**Interactive Components:**
- Button variants: primary, secondary, outline, danger, action, ghost
- Input fields with icon support and focus ring
- Badges: status (paid/pending/unpaid), stock, category
- Tables: striped rows, scrollable containers
- Modals: slide-in from right, overlay backdrop
- Dropdown menus: glassmorphic with blur backdrop
- Toast notifications: slide-in, stacked, auto-dismiss

**Dashboard Components:**
- KPI grid (auto-fit, min 220px columns)
- Chart containers (canvas-based, responsive)
- Dashboard grid (1.8fr + 1.2fr two-column layout)

**Responsive Breakpoints:**
- 1024px: auto-collapse sidebar, stack dashboard grid
- 900px: stack billing grid, admin grid, inventory row
- 768px: stack reports selector
- 576px: full-width modals

**Print Styles:**
- Invoice modal hidden except content
- Report print: black text, white background, visible headers
- CSS `@media print` rules for both invoice and report printing

### 7.4 HTML Pages Overview

| Page | Key Elements |
|------|--------------|
| login.html | Centered card, brand logo, form inputs, error message area |
| dashboard.html | KPI grid, chart containers, recent invoices table, top products table |
| billing.html | Two-column grid: product selection (left) + cart/invoice preview (right), payment dropdown, customer quick-add modal |
| invoices.html | Search bar, full-width invoices table, print modal |
| products.html | Tabs (Products/Categories), location filter, out-of-stock toggle, product/category modals |
| customers.html | Customers table, modals for edit + history view |
| reports.html | Report selector dropdown, action buttons (CSV, Print, Search), dynamic table |
| admin-panel.html | Two-column grid: user creation form (left) + user list (right), settings form with logo upload |
| logs.html | Timestamped log entries table |
| index.html | Meta refresh redirect to /login |

---

# 8. SECURITY IMPLEMENTATION

### 8.1 Authentication & Authorization

**Password Storage (PBKDF2):**
```
hash_password(password):
    salt = random 16 bytes hex
    digest = PBKDF2-HMAC-SHA256(password, salt, 120_000 iterations)
    return (salt, digest)

verify_password(password, salt, expected_hash):
    candidate = PBKDF2-HMAC-SHA256(password, salt, 120_000 iterations)
    return constant_time_compare(candidate, expected_hash)
```

**JWT Token:**
- Algorithm: HS256 (HMAC with SHA-256)
- Secret: configured via JWT_SECRET environment variable
- Payload: sub (user_id), username, role, fullname, exp (12 hours)
- No refresh token mechanism

**Access Control:**
- `get_current_user` dependency: validates token, checks user exists in DB
- `require_admin` dependency: checks role === 'admin' (used for destructive operations)
- Frontend also checks role to determine UI visibility (admin-only menu items)

### 8.2 Input Validation

- Pydantic models enforce: min_length, gt (greater than), ge (greater or equal), regex patterns
- Login: both fields required with `Field(min_length=1)`
- Products: price > 0, stock >= 0, gst_rate >= 0
- Invoice: at least 1 item, discount >= 0
- Phone numbers: validated as strings with minimum 10 characters
- SKU uniqueness enforced at database level (UNIQUE constraint)

### 8.3 XSS Prevention

- `esc()` function in common.js escapes: &, <, >, ", '
- All dynamic content rendered via `esc()` when displayed as text
- Template literals use `esc()` for user-provided data

### 8.4 SQL Injection Prevention

- All queries use parameterized statements with `?` placeholders
- Values passed as tuple parameters, never concatenated into SQL strings
- SQLite `conn.execute(query, params)` pattern used universally

### 8.5 Additional Security Measures

- CORS: currently allows all origins (`allow_origins=["*"]`) for development
- Self-deletion prevention: backend checks `user_id == current_user["id"]`
- Password_plaintext field exists in DB but is only for demo convenience
- Audit logging tracks all CRUD operations and logins

---

# 9. KEY FEATURES — MODULE-WISE BREAKDOWN

### 9.1 Dashboard Module
- 4 KPI cards: Total Sales, Invoice Count, Product Count, Low Stock Items
- 7-day sales line chart (Chart.js)
- Sales by category doughnut chart
- Top 5 selling products table
- 5 recent invoices with view links
- Low stock KPI clickable -> redirects to products page

### 9.2 Billing Module
- Product selector with instant stock/price display
- Cart management: add, adjust quantity, remove items
- Draft persistence via sessionStorage (survives page refresh)
- Real-time subtotal, GST, and total calculation
- Discount input field
- Payment method selector: Cash, UPI/QR, Debit/Credit Card
- Transaction reference field for non-cash payments
- Quick customer registration modal
- Server-side stock validation and deduction
- Automatic invoice numbering

### 9.3 Invoice Management
- Search/filter invoice list by any field
- Detailed invoice view with company branding
- Print-formatted invoice output
- Shows: invoice number, date, status, customer info, items table, totals, payment info, company logo

### 9.4 Inventory Management
- Products table with: SKU, name, category, price, GST%, stock level, min stock, location
- Location filter: All / Storefront / Warehouse
- Hide out-of-stock products toggle
- Category management: CRUD with inline edit modal
- Product CRUD with modal forms
- Action dropdown menus with edit/delete

### 9.5 Customer CRM
- Customer registry: name, phone, email, address, registration date
- Customer CRUD with modal forms
- Purchase history modal showing all invoices per customer
- Delete restricted to admin role

### 9.6 Reports Module
- 6 report types with dynamic column rendering
- Automatic currency formatting based on column header keywords
- Client-side search/filter within report data
- CSV export with proper escaping
- Print report in clean black-and-white format

### 9.7 Admin Panel
- User management: list, create (with role selection), delete
- Cannot delete own account
- System settings editor: company name, address, phone, email, default GST
- Logo upload (base64, 500KB limit) with preview and removal

### 9.8 Audit Logs
- Timestamped entries: user, action, details
- 200 most recent entries
- Actions tracked: LOGIN, PRODUCT_CREATE/UPDATE/DELETE, CATEGORY_CREATE/UPDATE/DELETE, CUSTOMER_CREATE/UPDATE/DELETE, INVOICE_CREATE, SETTINGS_UPDATE, USER_CREATE/DELETE

---

# 10. TRANSACTION HANDLING (Invoice Creation)

The invoice creation endpoint (`POST /api/invoices`) is the most critical business operation. It follows a strict transaction pattern:

1. Open a single database connection
2. For each item in the invoice:
   - Verify product exists
   - Verify sufficient stock (`product.stock >= item.quantity`)
   - Calculate item total and GST
3. Calculate subtotal, discount (capped at subtotal), total GST, grand total
4. INSERT into invoices table
5. For each item:
   - INSERT into invoice_items table
   - UPDATE products SET stock = stock - quantity
6. INSERT into payments table
7. COMMIT the transaction

If any step fails before commit, SQLite rolls back all changes, preventing partial invoice creation or phantom stock deductions.

---

# 11. SETUP & DEPLOYMENT

### 11.1 Development Setup

**Prerequisites:**
- Python 3.10+
- Node.js 18+
- npm

**Installation:**
```bash
# Clone the repository
git clone <repo-url>
cd fastapi version - opencode

# Python backend dependencies
pip install -r requirements.txt

# Node.js proxy dependencies
npm install
```

**Running the Application:**
```bash
# Terminal 1: Start FastAPI backend
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2: Start Express proxy
npm start
# Or: node server.js
# Or with auto-reload: npm run web
```

**Access:**
- Frontend: http://localhost:3000
- API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs

**Default Credentials:**
- Admin: admin / admin123
- Staff: staff / staff123

### 11.2 Environment Configuration (.env)

```
JWT_SECRET=inventory-flow-demo-secret-key-2026
PORT=3000
API_BASE_URL=http://127.0.0.1:8000
```

### 11.3 Deployment Considerations

For production deployment, the following changes are recommended:

1. **Database:** Migrate from SQLite to PostgreSQL for concurrent user support
2. **Security:** 
   - Change JWT_SECRET to a strong, randomly generated secret
   - Restrict CORS origins to specific domains
   - Remove password_plaintext field from users table
   - Use HTTPS in production
3. **Proxy:** Replace Express with Nginx for production serving
4. **Backend:** Run Uvicorn with multiple workers: `uvicorn backend.main:app --workers 4`
5. **Frontend:** Add asset caching headers and minification

---

# 12. TESTING STRATEGY

### Current Testing Status
No automated tests are currently implemented. The application has been manually tested.

### Recommended Testing Approach

**Unit Tests (Python/pytest):**
- Test password hashing and verification
- Test JWT token creation and validation
- Test invoice number generation format
- Test Pydantic model validation rules

**Integration Tests:**
- Test API endpoints with sample data
- Test stock deduction during invoice creation
- Test authorization (staff cannot access admin endpoints)
- Test duplicate SKU and phone validation

**Frontend Tests:**
- Manual UI testing across all pages
- Test form validation
- Test responsive layout at breakpoints
- Test dark/light theme toggle
- Test invoice print output format

**Suggested test command (future):**
```bash
pip install pytest httpx
pytest backend/tests/
```

---

# 13. FUTURE ENHANCEMENTS

1. **Multi-tenancy:** Support multiple stores/branches with isolated data
2. **Email Integration:** Send invoices via email directly from the application
3. **Barcode Scanning:** Product lookup via barcode scanner
4. **Purchase Orders:** Manage supplier orders and purchase inventory
5. **Expense Tracking:** Record business expenses alongside sales
6. **Dashboard Customization:** User-configurable dashboard widgets
7. **Data Export:** Excel/PDF export for reports
8. **Backup & Restore:** Automated database backup to cloud storage
9. **Multi-currency:** Support for international customers
10. **Offline Mode:** Progressive Web App with offline billing capability

---

# 14. API REQUEST/RESPONSE EXAMPLES

### Login
```
POST /api/auth/login
Body: {"username": "admin", "password": "admin123"}
Response: {
  "token": "eyJhbGciOi...",
  "user": {"id": 1, "username": "admin", "fullname": "System Administrator", "role": "admin"}
}
```

### Create Invoice
```
POST /api/invoices
Headers: Authorization: Bearer <token>
Body: {
  "customer_id": 1,
  "items": [
    {"product_id": 1, "quantity": 2, "unit_price": 499, "gst_rate": 18},
    {"product_id": 3, "quantity": 1, "unit_price": 280, "gst_rate": 5}
  ],
  "discount": 50,
  "payment_method": "upi",
  "transaction_reference": "UPI-REF-123456"
}
Response: {
  "message": "Invoice created",
  "invoice_number": "INV-20260705-0001",
  "id": 1,
  "total": 1272.14
}
```

### Get Report
```
GET /api/reports/low_stock_alert
Response: {
  "title": "Low Stock Alert Report",
  "headers": ["SKU", "Product", "Category", "Current Stock", "Min Stock"],
  "rows": [
    {"sku": "SKU-APPA-001", "name": "Cotton T-Shirt (M)", "category": "Apparel", "stock": 4, "min_stock": 5}
  ]
}
```

---

# 15. FILE METRICS SUMMARY

| File | Lines | Purpose |
|------|-------|---------|
| backend/main.py | 1066 | FastAPI backend (database, auth, API routes) |
| frontend/common.js | 518 | Core application logic (auth, layout, API, theme) |
| frontend/style.css | 2124 | Complete design system (dark/light themes, components) |
| frontend/login.js | 56 | Login form handler |
| frontend/dashboard.js | 158 | Dashboard analytics and charts |
| frontend/billing.js | 300 | POS billing and cart management |
| frontend/products.js | 381 | Product/category CRUD management |
| frontend/customers.js | 190 | Customer CRM |
| frontend/invoices.js | 174 | Invoice listing and print |
| frontend/reports.js | 172 | Reports generation and export |
| frontend/admin-panel.js | 219 | Admin user/settings management |
| frontend/logs.js | 38 | Audit log viewer |
| server.js | 51 | Express proxy server |
| **Total** | **~4447** | |
