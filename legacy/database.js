const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'billing_inventory.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
      if (pragmaErr) {
        console.error('Failed to enable foreign keys:', pragmaErr.message);
      } else {
        console.log('Foreign key constraints enabled.');
      }
    });
  }
});

// Promisified DB execution helpers
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Initialize schema and seed data
async function initDatabase() {
  try {
    // 1. Users Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        password_plaintext TEXT,
        role TEXT CHECK(role IN ('admin', 'staff')) NOT NULL,
        fullname TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrate existing database to include password_plaintext
    try {
      await dbRun('ALTER TABLE users ADD COLUMN password_plaintext TEXT');
      console.log('Added password_plaintext column to users table.');
    } catch (err) {
      // Ignore if column already exists
    }

    // 2. Categories Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT
      )
    `);

    // 3. Products Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category_id INTEGER,
        sku TEXT UNIQUE NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        min_stock INTEGER NOT NULL DEFAULT 5,
        gst_rate REAL NOT NULL DEFAULT 18.0,
        description TEXT,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `);

    // Migrate existing database to include products gst_rate
    try {
      await dbRun('ALTER TABLE products ADD COLUMN gst_rate REAL DEFAULT 18.0');
      console.log('Added gst_rate column to products table.');
    } catch (err) {
      // Ignore if column already exists
    }

    // 4. Customers Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        email TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Invoices Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        customer_id INTEGER,
        user_id INTEGER,
        subtotal REAL NOT NULL,
        discount REAL DEFAULT 0,
        gst REAL DEFAULT 0,
        total REAL NOT NULL,
        payment_status TEXT CHECK(payment_status IN ('paid', 'pending', 'unpaid')) NOT NULL DEFAULT 'paid',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // 6. Invoice Items Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        gst_rate REAL NOT NULL DEFAULT 18.0,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      )
    `);

    // Migrate existing database to include invoice_items gst_rate
    try {
      await dbRun('ALTER TABLE invoice_items ADD COLUMN gst_rate REAL DEFAULT 18.0');
      console.log('Added gst_rate column to invoice_items table.');
    } catch (err) {
      // Ignore if column already exists
    }

    // 7. Payments Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'upi')) NOT NULL,
        transaction_reference TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      )
    `);

    // 8. Logs Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // 9. Settings Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL
      )
    `);

    console.log('Database tables verified/created successfully.');

    // Seeding Default Data
    // Seed Users
    const userCount = await dbGet('SELECT COUNT(*) as count FROM users');
    if (userCount.count === 0) {
      const adminHash = await bcrypt.hash('admin123', 10);
      const staffHash = await bcrypt.hash('staff123', 10);

      await dbRun('INSERT INTO users (username, password_hash, password_plaintext, role, fullname) VALUES (?, ?, ?, ?, ?)', [
        'admin',
        adminHash,
        'admin123',
        'admin',
        'System Administrator'
      ]);
      await dbRun('INSERT INTO users (username, password_hash, password_plaintext, role, fullname) VALUES (?, ?, ?, ?, ?)', [
        'staff',
        staffHash,
        'staff123',
        'staff',
        'Sales Staff'
      ]);
      console.log('Default users seeded (admin/admin123, staff/staff123).');
    } else {
      // Migrate existing seeded users to ensure their plaintext passwords are set
      await dbRun("UPDATE users SET password_plaintext = 'admin123' WHERE username = 'admin' AND (password_plaintext IS NULL OR password_plaintext = '')");
      await dbRun("UPDATE users SET password_plaintext = 'staff123' WHERE username = 'staff' AND (password_plaintext IS NULL OR password_plaintext = '')");
    }

    // Seed Categories
    const categoryCount = await dbGet('SELECT COUNT(*) as count FROM categories');
    if (categoryCount.count === 0) {
      const categories = [
        ['Electronics', 'Gadgets, appliances, and accessories'],
        ['Groceries', 'Daily food items and pantry stock'],
        ['Apparel', 'Clothing, footwear, and accessories'],
        ['Stationery', 'Office and school supplies']
      ];
      for (const [name, desc] of categories) {
        await dbRun('INSERT INTO categories (name, description) VALUES (?, ?)', [name, desc]);
      }
      console.log('Default categories seeded.');
    }

    // Seed Products
    const productCount = await dbGet('SELECT COUNT(*) as count FROM products');
    if (productCount.count === 0) {
      const products = [
        ['Wireless Mouse', 1, 'SKU-ELEC-001', 499.00, 25, 5, '2.4GHz wireless mouse with USB receiver'],
        ['Mechanical Keyboard', 1, 'SKU-ELEC-002', 2499.00, 12, 3, 'Blue switch RGB mechanical keyboard'],
        ['Instant Coffee 100g', 2, 'SKU-GROC-001', 280.00, 50, 10, 'Premium roasted coffee granules'],
        ['A4 Notebook 5-Pack', 4, 'SKU-STAT-001', 180.00, 30, 8, '200-page ruled notebook set'],
        ['Cotton T-Shirt (M)', 3, 'SKU-APPA-001', 599.00, 4, 5, '100% breathable organic cotton black shirt'] // Low stock item
      ];
      for (const [name, catId, sku, price, stock, minStock, desc] of products) {
        await dbRun('INSERT INTO products (name, category_id, sku, price, stock, min_stock, description) VALUES (?, ?, ?, ?, ?, ?, ?)', [
          name, catId, sku, price, stock, minStock, desc
        ]);
      }
      console.log('Default products seeded.');
    }

    // Seed Customers
    const customerCount = await dbGet('SELECT COUNT(*) as count FROM customers');
    if (customerCount.count === 0) {
      const customers = [
        ['John Doe', '9876543210', 'john@example.com', '123 Baker Street, Cityville'],
        ['Aarav Mehta', '9898989898', 'aarav@example.com', '45 Green Park, Dehradun'],
        ['Sneha Sharma', '9123456789', 'sneha@example.com', '78 Nehru Colony, Dehradun']
      ];
      for (const [name, phone, email, addr] of customers) {
        await dbRun('INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)', [
          name, phone, email, addr
        ]);
      }
      console.log('Default customers seeded.');
    }

    // Seed Settings
    const settingsCount = await dbGet('SELECT COUNT(*) as count FROM settings');
    if (settingsCount.count === 0) {
      const defaultSettings = [
        ['company_name', 'InvoiceFlow Ltd'],
        ['company_address', '102 Rajpur Road, Dehradun, Uttarakhand, India'],
        ['company_phone', '+91 9876543210'],
        ['company_email', 'billing@invoiceflow.com'],
        ['default_gst', '18']
      ];
      for (const [key, value] of defaultSettings) {
        await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
      }
      console.log('Default settings seeded.');
    }

  } catch (error) {
    console.error('Database initialization/seeding failed:', error);
  }
}

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  initDatabase
};
