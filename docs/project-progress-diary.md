# Academic Project Progress Log Book

**Project Title**: Billing and Inventory Management System
**Student Name**: BCA 6th Semester Student
**Academic Year**: 2026

This document serves as the project progress diary recording the weekly development tasks, database design stages, coding challenges, and solutions implemented during the 4-week project timeline.

---

## Weekly Progress Log

### **Week 1: Requirements Gathering, Database Design & User Login System**
*   **Tasks Completed**:
    *   Collected requirements for retail store billing systems with GST tax rates.
    *   Designed SQLite database schema containing tables: `users`, `products`, `categories`, `customers`, `invoices`, `invoice_items`, `payments`, `logs`, and `settings`.
    *   Created `database.py` with SQL helpers to run select queries and insert records.
    *   Implemented user login auth code in `auth.py` using password hashing (PBKDF2 sha256) and JWT tokens.
*   **Problem & Solution**:
    *   *SQLite Foreign Keys*: SQLite does not check foreign key constraints by default. Fixed by executing `PRAGMA foreign_keys = ON;` in `connect_db()`.

---

### **Week 2: Product Categories, Inventory Catalog & Customer CRM**
*   **Tasks Completed**:
    *   Developed backend route files for products (`products.py`) and categories.
    *   Created customer database CRUD routes with validation checks.
    *   Designed HTML frontend pages for product listings and customer directories.
    *   Created CSS styling classes for active drop-down selectors in products layout.
    *   Wrote database seeds to insert initial products (Wireless Mouse, Keyboard, Coffee) and settings keys.
*   **Problem & Solution**:
    *   *SKU Code Collision*: Duplicate SKU codes caused database errors. Solved by generating random SKU strings (`SKU-[HEX]`) when the SKU field is left empty.

---

### **Week 3: Billing Checkout, Stock Deduction & Invoice Printing**
*   **Tasks Completed**:
    *   Programmed the main invoice creation route (`create_bill` in `invoices.py`). It calculates bill subtotal, computes GST amount, applies discounts, and saves invoice items.
    *   Wrapped the checkout sequence in database transactions: if any item runs out of stock, the transaction rolls back to prevent half-saved invoices.
    *   Implemented SQLite database triggers (`auto_create_inventory_row`) to automatically handle stock mappings.
    *   Created printable bill templates with standard layout structures.
*   **Problem & Solution**:
    *   *Print CSS Styling*: When opening `window.print()`, custom colors and spacing vanished. Solved by creating `print-invoice.html` which clones elements and styles directly.

---

### **Week 4: Business Reports, Refactoring & Viva Testing**
*   **Tasks Completed**:
    *   Coded reports queries in `reports.py` to compile Daily Sales, Monthly Sales, GST Report (CGST/SGST split), and Low Stock Alerts.
    *   Mapped student variables like `user`, `bill_no`, `bill_id`, `qty`, `price`, and `gst` inside python routes.
    *   Removed unused code fragments to make the application neat.
    *   Simplified comments to plain student language (e.g. `# connect database`, `# update stock`).
    *   Tested the entire project flow using python test script `verify_fixes.py`.
*   **Problem & Solution**:
    *   *Dropdown Z-Index overlap*: Drop-down select boxes rendered behind form inputs. Fixed by dynamically applying high z-index values (`200`) to the active selector elements in CSS.

---

## Viva Project Defence Guide (Q&A)

**Q1: Why did you choose SQLite instead of MySQL or Oracle?**
*   *Answer*: SQLite is a file-based, serverless database. It is highly lightweight, requires no database installation configuration on local computers, and stores all records in a single local file (`billing_inventory.db`), making it ideal for standard desktop applications in local retail shops.

**Q2: How are stock levels updated when a customer purchases items?**
*   *Answer*: When an invoice is saved, the checkout query updates the `inventory` table by subtracting the purchased quantity (`UPDATE inventory SET stock = stock - ?`). The trigger `sync_product_stock_after_update` then automatically matches the stock value on the main `products` table.

**Q3: How does your application split GST into CGST and SGST?**
*   *Answer*: The GST Tax Report query (`reports.py`) fetches the total GST collected from invoices, divides it by `2.0` to split it into CGST (Central GST) and SGST (State GST) sections, and displays them in separate columns as required by local retail regulations.
