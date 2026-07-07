# InvoiceFlow: Backend & Billing Engine Reference Documentation

This document serves as the master technical reference for the **InvoiceFlow** core billing and database engine. It excludes user interface (UI) details and focuses strictly on database schemas, mathematical calculation models, state management, transaction auditing, and reporting queries.

Use this document as context for generating a comprehensive, backend-focused academic thesis or report.

---

## 1. System Architecture & Component Mapping

InvoiceFlow is structured around a backend API server communicating with a local relational database:

*   **FastAPI REST Engine (Python)**:
    *   Implements the core business logic, Pydantic data schemas, security checks, and database connection pooling.
    *   Exposes endpoints to process invoices, manage users, and generate report records.
*   **Relational Database (SQLite3)**:
    *   Local relational file database.
    *   Enforces relational integrity via `PRAGMA foreign_keys = ON`.
*   **Reverse Proxy Layer (Express Node.js)**:
    *   Funnels incoming connection streams to the FastAPI engine, handling CORS policies and secure request forwarding.

---

## 2. Relational Database Design & Schema

The database consists of 9 normalized tables. Relational links are strictly managed via foreign key constraints, with cascade deletions defined on invoice items and payments.

```mermaid
erDiagram
    USERS ||--o{ INVOICES : "creates"
    USERS ||--o{ STOCK-TRANSACTIONS : "audits"
    CATEGORIES ||--o{ PRODUCTS : "groups"
    PRODUCTS ||--o|| INVENTORY : "monitors"
    PRODUCTS ||--o{ INVOICE-ITEMS : "listed-in"
    PRODUCTS ||--o{ STOCK-TRANSACTIONS : "logs"
    CUSTOMERS ||--o{ INVOICES : "purchases"
    INVOICES ||--o{ INVOICE-ITEMS : "contains"
    INVOICES ||--o{ PAYMENTS : "tracks"
```

### Table Definitions (DDL)

```sql
-- 1. Users & Credentials
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_plaintext TEXT, -- Stored for project defense validation
    fullname TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'staff')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Product Categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Products Master Table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL CHECK(price >= 0),
    gst_rate REAL NOT NULL CHECK(gst_rate >= 0),
    stock INTEGER NOT NULL DEFAULT 0, -- Synced with inventory.stock
    min_stock INTEGER NOT NULL DEFAULT 5,
    location TEXT, -- Synced with inventory.location
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

-- 4. Inventory Stock Ledger
CREATE TABLE IF NOT EXISTS inventory (
    product_id INTEGER PRIMARY KEY,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 5,
    location TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 5. Stock Audit Transactions
CREATE TABLE IF NOT EXISTS stock_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL, -- Positive for restocks, negative for sales/adjustments
    transaction_type TEXT CHECK(transaction_type IN ('restock', 'sale', 'adjustment')),
    user_id INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 6. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER, -- Nullable to allow Guest checkout
    user_id INTEGER NOT NULL,
    invoice_date DATE DEFAULT (DATE('now')),
    subtotal REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    cgst REAL NOT NULL,
    sgst REAL NOT NULL,
    igst REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    payment_status TEXT CHECK(payment_status IN ('paid', 'unpaid', 'pending')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 8. Invoice Line Items
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    gst_rate REAL NOT NULL,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- 9. Payments Ledger
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'upi')),
    transaction_reference TEXT,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
```

---

## 3. Core Billing Engine & Mathematical Models

The billing engine calculates taxes, discounts, and totals using exact mathematical formulas to maintain accounting accuracy.

### A. Capped Discount Capping
To prevent negative totals, requested discounts are strictly capped against the pre-tax subtotal:
$$\text{Actual Discount} = \min(\text{Requested Discount}, \text{Subtotal})$$

### B. Proportional Discount Distribution
To calculate item-level tax under Indian GST rules, the global invoice discount is distributed proportionally across all line items to determine their unique taxable values:
$$\text{Taxable Value}_i = \text{Line Total}_i - \left( \frac{\text{Line Total}_i}{\text{Subtotal}} \times \text{Actual Discount} \right)$$
*Where $\text{Line Total}_i = \text{Quantity}_i \times \text{Unit Price}_i$*

### C. Split GST Calculation (CGST & SGST)
Since transactions occur locally, tax is split equally into Central GST (CGST) and State/Union Territory GST (SGST) per line item:
$$\text{CGST}_i = \text{SGST}_i = \frac{\text{Taxable Value}_i \times \text{GST Rate}_i}{2 \times 100}$$
$$\text{Total Invoice CGST} = \sum_{i=1}^{n} \text{CGST}_i, \quad \text{Total Invoice SGST} = \sum_{i=1}^{n} \text{SGST}_i$$
$$\text{Total GST} = \text{Total Invoice CGST} + \text{Total Invoice SGST}$$

### D. Final Grand Total
The grand total is calculated by adding the split taxes back to the post-discount subtotal:
$$\text{Grand Total} = \text{Subtotal} - \text{Actual Discount} + \text{Total Invoice CGST} + \text{Total Invoice SGST}$$

---

## 4. State Flows & Audit Systems

### A. Credit Sales and Delayed Payments
The system manages credit sales through a two-stage transaction lifecycle:
1. **Checkout (Credit status)**:
   - When an invoice is created with `payment_method = "credit"`, the invoice is marked as `payment_status = 'unpaid'` (or `pending`).
   - No payment record is created in the `payments` table at this time.
   - The customer's credit ledger balance increases.
2. **Collection (Late Payment API)**:
   - When the cash/payment is later collected, the endpoint `POST /api/invoices/{invoice_id}/pay` is called.
   - An entry is inserted into the `payments` table referencing the `invoice_id` with the collected amount.
   - The invoice's `payment_status` is updated to `'paid'`.

### B. Inventory Auditing Layer
*   **Double-Write Syncing**: Changes to stock levels in the modern `inventory` table automatically trigger synchronizing queries updating the legacy `products` table stock columns.
*   **Transaction Logging**: Every stock modification (whether by sales checkout or initial restock) generates a ledger log in the `stock_transactions` table capturing:
    *   Adjusted Quantity (positive/negative)
    *   Transaction Type (`sale`, `restock`)
    *   Author (User ID of the cashier/admin)
    *   Audit Notes (e.g., "Sold via invoice #INV-1002" or "Initial stock seeding")

---

## 5. Reports Engine SQL Queries

The reporting engine calculates key business performance indicators directly in SQL. Below are the exact queries executed for the 6 core reports:

### 1. Daily Sales Report
Displays all invoices generated on a chosen day:
```sql
SELECT i.invoice_number, COALESCE(c.name, 'Guest Customer') AS customer_name,
       i.invoice_date, i.total, (i.cgst + i.sgst) AS total_gst, i.payment_status
FROM invoices i
LEFT JOIN customers c ON c.id = i.customer_id
WHERE i.invoice_date = :selected_date
ORDER BY i.id DESC;
```

### 2. Monthly Sales Report
Summarizes monthly revenue, taxes, and transaction volume:
```sql
SELECT strftime('%Y-%m', i.invoice_date) AS month,
       SUM(i.subtotal - i.discount) AS taxable_sales,
       SUM(i.cgst + i.sgst) AS total_gst,
       COUNT(i.id) AS number_of_invoices,
       SUM(i.total) AS revenue
FROM invoices i
GROUP BY month
ORDER BY month DESC;
```

### 3. GST Report
Calculates tax distributions for accounting audits:
```sql
SELECT i.invoice_number, (i.subtotal - i.discount) AS taxable_amount,
       i.cgst, i.sgst, i.igst, (i.cgst + i.sgst) AS total_gst
FROM invoices i
ORDER BY i.id DESC;
```

### 4. Stock Availability Report
Monitors current asset values based on stock levels:
```sql
SELECT p.name AS product_name, cat.name AS category_name,
       inv.stock AS current_stock, p.price,
       (inv.stock * p.price) AS stock_value
FROM products p
JOIN categories cat ON cat.id = p.category_id
JOIN inventory inv ON inv.product_id = p.id
ORDER BY p.name ASC;
```

### 5. Low Stock Alert Report
Flags products that fall below their safety threshold:
```sql
SELECT p.name AS product_name, inv.stock AS current_stock,
       inv.min_stock AS minimum_stock,
       CASE WHEN inv.stock <= inv.min_stock THEN 'CRITICAL ALERT' ELSE 'OK' END AS alert_status
FROM products p
JOIN inventory inv ON inv.product_id = p.id
WHERE inv.stock <= inv.min_stock
ORDER BY inv.stock ASC;
```

### 6. Invoice List Report
Comprehensive billing log:
```sql
SELECT i.invoice_number, COALESCE(c.name, 'Guest Customer') AS customer_name,
       i.invoice_date, i.total, i.payment_status
FROM invoices i
LEFT JOIN customers c ON c.id = i.customer_id
ORDER BY i.id DESC;
```
