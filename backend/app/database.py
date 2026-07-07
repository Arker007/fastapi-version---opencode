import sqlite3
from backend.app.config import DB_PATH

# connect to database
def connect_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

# get one row from database
def fetch_one(query, params=()):
    with connect_db() as conn:
        row = conn.execute(query, params).fetchone()
        return dict(row) if row else None

# get all rows from database
def fetch_all(query, params=()):
    with connect_db() as conn:
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

# execute database write queries
def execute_write(query, params=()):
    with connect_db() as conn:
        cursor = conn.execute(query, params)
        conn.commit()
        return cursor.lastrowid

# execute database write query with active connection
def execute_write_conn(conn, query, params=()):
    cursor = conn.execute(query, params)
    return cursor.lastrowid

# insert log details into database
def add_log(user_id, action, details=""):
    try:
        execute_write(
            "INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)",
            (user_id, action, details),
        )
    except Exception:
        pass  # Non-critical — don't break main flow

# create tables and initial data
def init_database():
    from backend.app.auth import hash_password

    with connect_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                password_plaintext TEXT,
                fullname TEXT NOT NULL,
                role TEXT CHECK(role IN ('admin', 'staff')) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                sku TEXT UNIQUE NOT NULL,
                category_id INTEGER,
                price REAL NOT NULL,
                stock INTEGER NOT NULL DEFAULT 0,
                min_stock INTEGER NOT NULL DEFAULT 5,
                gst_rate REAL NOT NULL DEFAULT 18.0,
                location TEXT CHECK(location IN ('storefront', 'warehouse')) NOT NULL DEFAULT 'storefront',
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                email TEXT,
                address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_number TEXT UNIQUE NOT NULL,
                customer_id INTEGER,
                user_id INTEGER,
                subtotal REAL NOT NULL,
                discount REAL DEFAULT 0,
                gst REAL DEFAULT 0,
                total REAL NOT NULL,
                payment_status TEXT CHECK(payment_status IN ('paid','pending','unpaid')) NOT NULL DEFAULT 'paid',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS invoice_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER NOT NULL,
                product_id INTEGER,
                product_name TEXT,
                product_sku TEXT,
                quantity INTEGER NOT NULL,
                unit_price REAL NOT NULL,
                total_price REAL NOT NULL,
                gst_rate REAL NOT NULL DEFAULT 18.0,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                payment_method TEXT CHECK(payment_method IN ('cash','card','upi')) NOT NULL,
                transaction_reference TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER UNIQUE NOT NULL,
                stock INTEGER NOT NULL DEFAULT 0,
                min_stock INTEGER NOT NULL DEFAULT 5,
                location TEXT CHECK(location IN ('storefront', 'warehouse')) NOT NULL DEFAULT 'storefront',
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS stock_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                transaction_type TEXT CHECK(transaction_type IN ('restock', 'sale', 'adjustment')) NOT NULL,
                user_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TRIGGER IF NOT EXISTS auto_create_inventory_row
            AFTER INSERT ON products
            BEGIN
                INSERT INTO inventory (product_id, stock, min_stock, location)
                VALUES (new.id, new.stock, new.min_stock, new.location);
            END;

            CREATE TRIGGER IF NOT EXISTS sync_product_stock_after_update
            AFTER UPDATE OF stock, min_stock, location ON inventory
            BEGIN
                UPDATE products 
                SET stock = new.stock, min_stock = new.min_stock, location = new.location 
                WHERE id = new.product_id;
            END;
            """
        )
        
        # add location column to products table if missing
        try:
            conn.execute("ALTER TABLE products ADD COLUMN location TEXT CHECK(location IN ('storefront', 'warehouse')) NOT NULL DEFAULT 'storefront'")
            conn.commit()
            print("Added 'location' column to 'products' table.")
        except sqlite3.OperationalError:
            pass

        # copy stock to inventory if empty
        try:
            inv_count = conn.execute("SELECT COUNT(*) as count FROM inventory").fetchone()
            if inv_count and inv_count["count"] == 0:
                conn.execute(
                    """
                    INSERT INTO inventory (product_id, stock, min_stock, location)
                    SELECT id, stock, min_stock, location FROM products
                    """
                )
                conn.commit()
                print("Migrated existing product stocks to the inventory table.")
        except Exception as e:
            print(f"Error migrating stock to inventory: {e}")

    # add default users
    user_count = fetch_one("SELECT COUNT(*) as count FROM users")
    if user_count and user_count["count"] == 0:
        for username, password, fullname, role in [
            ("admin", "admin123", "System Administrator", "admin"),
            ("staff", "staff123", "Sales Staff", "staff"),
        ]:
            salt, digest = hash_password(password)
            execute_write(
                "INSERT INTO users (username, password_salt, password_hash, password_plaintext, fullname, role) VALUES (?, ?, ?, ?, ?, ?)",
                (username, salt, digest, password, fullname, role),
            )

    # add default categories
    cat_count = fetch_one("SELECT COUNT(*) as count FROM categories")
    if cat_count and cat_count["count"] == 0:
        for name, desc in [
            ("Electronics", "Gadgets, appliances, and accessories"),
            ("Groceries", "Daily food items and pantry stock"),
            ("Apparel", "Clothing, footwear, and accessories"),
            ("Stationery", "Office and school supplies"),
        ]:
            execute_write("INSERT INTO categories (name, description) VALUES (?, ?)", (name, desc))

    # add default products
    prod_count = fetch_one("SELECT COUNT(*) as count FROM products")
    if prod_count and prod_count["count"] == 0:
        for name, cat_id, sku, price, stock, min_stock, gst_rate, desc in [
            ("Wireless Mouse", 1, "SKU-ELEC-001", 499.00, 25, 5, 18.0, "2.4GHz wireless mouse with USB receiver"),
            ("Mechanical Keyboard", 1, "SKU-ELEC-002", 2499.00, 12, 3, 18.0, "Blue switch RGB mechanical keyboard"),
            ("Instant Coffee 100g", 2, "SKU-GROC-001", 280.00, 50, 10, 5.0, "Premium roasted coffee granules"),
            ("A4 Notebook 5-Pack", 4, "SKU-STAT-001", 180.00, 30, 8, 12.0, "200-page ruled notebook set"),
            ("Cotton T-Shirt (M)", 3, "SKU-APPA-001", 599.00, 4, 5, 5.0, "100% breathable organic cotton black shirt"),
        ]:
            execute_write(
                "INSERT INTO products (name, category_id, sku, price, stock, min_stock, gst_rate, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (name, cat_id, sku, price, stock, min_stock, gst_rate, desc),
            )

    # add default customers
    cust_count = fetch_one("SELECT COUNT(*) as count FROM customers")
    if cust_count and cust_count["count"] == 0:
        for name, phone, email, addr in [
            ("John Doe", "9876543210", "john@example.com", "123 Baker Street, Cityville"),
            ("Aarav Mehta", "9898989898", "aarav@example.com", "45 Green Park, Dehradun"),
            ("Sneha Sharma", "9123456789", "sneha@example.com", "78 Nehru Colony, Dehradun"),
        ]:
            execute_write(
                "INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)",
                (name, phone, email, addr),
            )

    # add default settings
    settings_count = fetch_one("SELECT COUNT(*) as count FROM settings")
    if settings_count and settings_count["count"] == 0:
        for key, value in [
            ("company_name", "InvoiceFlow Ltd"),
            ("company_address", "102 Rajpur Road, Dehradun, Uttarakhand, India"),
            ("company_phone", "+91 9876543210"),
            ("company_email", "billing@invoiceflow.com"),
            ("default_gst", "18"),
            ("company_logo", ""),
            ("invoice_prefix", "INV"),
            ("invoice_terms", "Thank you for your business!"),
        ]:
            execute_write("INSERT INTO settings (key, value) VALUES (?, ?)", (key, value))

    print(f"Database initialized at {DB_PATH}")
