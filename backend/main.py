from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "billing_inventory.db"
JWT_SECRET = os.getenv("JWT_SECRET", "inventory-flow-demo-secret-key-2026")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 12
PBKDF2_ITERATIONS = 120_000

# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------
app = FastAPI(title="Billing & Inventory Management API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class ProductCreate(BaseModel):
    name: str = Field(min_length=1)
    sku: str | None = None
    category_id: int | None = None
    price: float = Field(gt=0)
    stock: int = Field(ge=0)
    min_stock: int = Field(default=5, ge=0)
    gst_rate: float = Field(default=18.0, ge=0)
    location: str = Field(default="storefront")
    description: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    category_id: int | None = None
    price: float | None = None
    stock: int | None = None
    min_stock: int | None = None
    gst_rate: float | None = None
    location: str | None = None
    description: str | None = None


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1)
    phone: str = Field(min_length=10)
    email: str | None = None
    address: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None


class InvoiceItemInput(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    unit_price: float
    gst_rate: float = Field(default=18.0)


class InvoiceCreate(BaseModel):
    customer_id: int | None = None
    items: list[InvoiceItemInput] = Field(min_length=1)
    discount: float = Field(default=0.0, ge=0)
    payment_method: str = Field(default="cash")
    transaction_reference: str | None = None


class UserCreate(BaseModel):
    fullname: str = Field(min_length=1)
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    role: str = Field(default="staff")


class SettingsUpdate(BaseModel):
    settings: dict[str, str]


# ---------------------------------------------------------------------------
# Database Helpers
# ---------------------------------------------------------------------------

def connect_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def fetch_one(query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    with connect_db() as conn:
        row = conn.execute(query, params).fetchone()
        return dict(row) if row else None


def fetch_all(query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with connect_db() as conn:
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def execute_write(query: str, params: tuple[Any, ...] = ()) -> int:
    with connect_db() as conn:
        cursor = conn.execute(query, params)
        conn.commit()
        return cursor.lastrowid  # type: ignore[return-value]


def execute_write_conn(conn: sqlite3.Connection, query: str, params: tuple[Any, ...] = ()) -> int:
    cursor = conn.execute(query, params)
    return cursor.lastrowid  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Password Hashing (PBKDF2)
# ---------------------------------------------------------------------------

def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    pw_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        pw_salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    ).hex()
    return pw_salt, digest


def verify_password(password: str, pw_salt: str, expected_hash: str) -> bool:
    _, candidate = hash_password(password, pw_salt)
    return hmac.compare_digest(candidate, expected_hash)


# ---------------------------------------------------------------------------
# JWT Helpers
# ---------------------------------------------------------------------------

def create_access_token(user: dict[str, Any]) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "role": user["role"],
        "fullname": user["fullname"],
        "exp": exp,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token required")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = fetch_one("SELECT id, username, fullname, role, created_at FROM users WHERE id = ?", (user_id,))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return user


def require_admin(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


# ---------------------------------------------------------------------------
# Logging Helper
# ---------------------------------------------------------------------------

def add_log(user_id: int | None, action: str, details: str = "") -> None:
    try:
        execute_write(
            "INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)",
            (user_id, action, details),
        )
    except Exception:
        pass  # Non-critical — don't break main flow


# ---------------------------------------------------------------------------
# Invoice Number Generator
# ---------------------------------------------------------------------------

def generate_invoice_number() -> str:
    today = datetime.now().strftime("%Y%m%d")
    count = fetch_one(
        "SELECT COUNT(*) as c FROM invoices WHERE invoice_number LIKE ?",
        (f"INV-{today}%",),
    )
    seq = (count["c"] if count else 0) + 1
    return f"INV-{today}-{seq:04d}"


# ---------------------------------------------------------------------------
# Database Initialization
# ---------------------------------------------------------------------------

def init_database() -> None:
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
            """
        )
        
        # Upgrade schema if products table exists but lacks location column
        try:
            conn.execute("ALTER TABLE products ADD COLUMN location TEXT CHECK(location IN ('storefront', 'warehouse')) NOT NULL DEFAULT 'storefront'")
            conn.commit()
            print("Added 'location' column to 'products' table.")
        except sqlite3.OperationalError:
            # Column already exists, ignore
            pass

    # Seed Users
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

    # Seed Categories
    cat_count = fetch_one("SELECT COUNT(*) as count FROM categories")
    if cat_count and cat_count["count"] == 0:
        for name, desc in [
            ("Electronics", "Gadgets, appliances, and accessories"),
            ("Groceries", "Daily food items and pantry stock"),
            ("Apparel", "Clothing, footwear, and accessories"),
            ("Stationery", "Office and school supplies"),
        ]:
            execute_write("INSERT INTO categories (name, description) VALUES (?, ?)", (name, desc))

    # Seed Products
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

    # Seed Customers
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

    # Seed Settings
    settings_count = fetch_one("SELECT COUNT(*) as count FROM settings")
    if settings_count and settings_count["count"] == 0:
        for key, value in [
            ("company_name", "InvoiceFlow Ltd"),
            ("company_address", "102 Rajpur Road, Dehradun, Uttarakhand, India"),
            ("company_phone", "+91 9876543210"),
            ("company_email", "billing@invoiceflow.com"),
            ("default_gst", "18"),
            ("company_logo", ""),
        ]:
            execute_write("INSERT INTO settings (key, value) VALUES (?, ?)", (key, value))

    print(f"Database initialized at {DB_PATH}")


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def startup() -> None:
    init_database()


# ===================== API ROUTES =====================

# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "billing-inventory-api", "database": DB_PATH.name}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.post("/api/auth/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    user = fetch_one("SELECT * FROM users WHERE username = ?", (payload.username.strip(),))
    if user is None or not verify_password(payload.password, user["password_salt"], user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid username or password")

    token = create_access_token(user)
    add_log(user["id"], "LOGIN", f"User '{user['username']}' logged in")
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "fullname": user["fullname"],
            "role": user["role"],
        },
    }


@app.get("/api/auth/me")
def me(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return current_user


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.get("/api/dashboard/summary")
def dashboard_summary(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    total_sales = fetch_one("SELECT COALESCE(SUM(total), 0) as total FROM invoices") or {"total": 0}
    invoice_count = fetch_one("SELECT COUNT(*) as count FROM invoices") or {"count": 0}
    product_count = fetch_one("SELECT COUNT(*) as count FROM products") or {"count": 0}
    low_stock = fetch_one("SELECT COUNT(*) as count FROM products WHERE stock <= min_stock") or {"count": 0}

    return {
        "totalSales": total_sales["total"],
        "invoiceCount": invoice_count["count"],
        "productCount": product_count["count"],
        "lowStockCount": low_stock["count"],
    }


@app.get("/api/dashboard/sales-chart")
def dashboard_sales_chart(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT DATE(created_at) as date, SUM(total) as total
        FROM invoices
        WHERE created_at >= DATE('now', '-7 days')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
        """
    )
    # Fill in missing dates
    result = []
    for i in range(6, -1, -1):
        d = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        found = next((r for r in rows if r["date"] == d), None)
        result.append({"date": d, "total": found["total"] if found else 0})
    return result


@app.get("/api/dashboard/category-chart")
def dashboard_category_chart(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT COALESCE(c.name, 'Uncategorized') as category, SUM(ii.total_price) as total
        FROM invoice_items ii
        LEFT JOIN products p ON p.id = ii.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        GROUP BY c.name
        ORDER BY total DESC
        """
    )


@app.get("/api/dashboard/top-products")
def dashboard_top_products(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT COALESCE(p.name, ii.product_name) as name, SUM(ii.quantity) as qty_sold, SUM(ii.total_price) as revenue
        FROM invoice_items ii
        LEFT JOIN products p ON p.id = ii.product_id
        GROUP BY COALESCE(p.name, ii.product_name)
        ORDER BY qty_sold DESC
        LIMIT 5
        """
    )


@app.get("/api/dashboard/recent-invoices")
def dashboard_recent_invoices(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT i.id, i.invoice_number, COALESCE(c.name, 'Guest') as customer_name, i.total, i.created_at
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        ORDER BY i.created_at DESC
        LIMIT 5
        """
    )


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

@app.get("/api/products")
def list_products(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT p.id, p.name, p.sku, p.price, p.stock, p.min_stock, p.gst_rate, p.location, p.description, p.created_at,
               c.name AS category_name, p.category_id
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.name ASC
        """
    )


@app.post("/api/products")
def create_product(payload: ProductCreate, current_user: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    sku = payload.sku.strip() if payload.sku else f"SKU-{secrets.token_hex(4).upper()}"
    # Check duplicate SKU
    existing = fetch_one("SELECT id FROM products WHERE sku = ?", (sku,))
    if existing:
        raise HTTPException(status_code=400, detail=f"SKU '{sku}' already exists")

    product_id = execute_write(
        """INSERT INTO products (name, sku, category_id, price, stock, min_stock, gst_rate, location, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (payload.name.strip(), sku, payload.category_id, payload.price, payload.stock, payload.min_stock, payload.gst_rate, payload.location, payload.description or ""),
    )
    add_log(current_user["id"], "PRODUCT_CREATE", f"Created product '{payload.name}' (SKU: {sku})")
    return {"message": "Product created", "id": product_id}


@app.put("/api/products/{product_id}")
def update_product(product_id: int, payload: ProductUpdate, current_user: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    product = fetch_one("SELECT * FROM products WHERE id = ?", (product_id,))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.sku is not None:
        existing = fetch_one("SELECT id FROM products WHERE sku = ? AND id != ?", (payload.sku, product_id))
        if existing:
            raise HTTPException(status_code=400, detail=f"SKU '{payload.sku}' already exists")
        updates["sku"] = payload.sku.strip()
    if payload.category_id is not None:
        updates["category_id"] = payload.category_id
    if payload.price is not None:
        updates["price"] = payload.price
    if payload.stock is not None:
        updates["stock"] = payload.stock
    if payload.min_stock is not None:
        updates["min_stock"] = payload.min_stock
    if payload.gst_rate is not None:
        updates["gst_rate"] = payload.gst_rate
    if payload.location is not None:
        updates["location"] = payload.location
    if payload.description is not None:
        updates["description"] = payload.description

    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [product_id]
        execute_write(f"UPDATE products SET {set_clause} WHERE id = ?", tuple(values))

    add_log(current_user["id"], "PRODUCT_UPDATE", f"Updated product ID {product_id}")
    return {"message": "Product updated"}


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, current_user: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    product = fetch_one("SELECT id, name FROM products WHERE id = ?", (product_id,))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    execute_write("DELETE FROM products WHERE id = ?", (product_id,))
    add_log(current_user["id"], "PRODUCT_DELETE", f"Deleted product '{product['name']}'")
    return {"message": f"Deleted {product['name']}"}


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

@app.get("/api/categories")
def list_categories(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    return fetch_all("SELECT id, name, description FROM categories ORDER BY name ASC")


@app.post("/api/categories")
def create_category(payload: CategoryCreate, current_user: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    existing = fetch_one("SELECT id FROM categories WHERE name = ?", (payload.name.strip(),))
    if existing:
        raise HTTPException(status_code=400, detail=f"Category '{payload.name}' already exists")
    cat_id = execute_write(
        "INSERT INTO categories (name, description) VALUES (?, ?)",
        (payload.name.strip(), payload.description or ""),
    )
    add_log(current_user["id"], "CATEGORY_CREATE", f"Created category '{payload.name}'")
    return {"message": "Category created", "id": cat_id}


@app.put("/api/categories/{category_id}")
def update_category(category_id: int, payload: CategoryUpdate, current_user: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    cat = fetch_one("SELECT * FROM categories WHERE id = ?", (category_id,))
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    updates = {}
    if payload.name is not None:
        existing = fetch_one("SELECT id FROM categories WHERE name = ? AND id != ?", (payload.name.strip(), category_id))
        if existing:
            raise HTTPException(status_code=400, detail=f"Category '{payload.name}' already exists")
        updates["name"] = payload.name.strip()
    if payload.description is not None:
        updates["description"] = payload.description

    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [category_id]
        execute_write(f"UPDATE categories SET {set_clause} WHERE id = ?", tuple(values))

    add_log(current_user["id"], "CATEGORY_UPDATE", f"Updated category ID {category_id}")
    return {"message": "Category updated"}


@app.delete("/api/categories/{category_id}")
def delete_category(category_id: int, current_user: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    cat = fetch_one("SELECT id, name FROM categories WHERE id = ?", (category_id,))
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    execute_write("DELETE FROM categories WHERE id = ?", (category_id,))
    add_log(current_user["id"], "CATEGORY_DELETE", f"Deleted category '{cat['name']}'")
    return {"message": f"Deleted category '{cat['name']}'"}


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

@app.get("/api/customers")
def list_customers(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    return fetch_all("SELECT * FROM customers ORDER BY name ASC")


@app.post("/api/customers")
def create_customer(payload: CustomerCreate, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    existing = fetch_one("SELECT id FROM customers WHERE phone = ?", (payload.phone.strip(),))
    if existing:
        raise HTTPException(status_code=400, detail=f"Customer with phone '{payload.phone}' already exists")
    cust_id = execute_write(
        "INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)",
        (payload.name.strip(), payload.phone.strip(), payload.email or "", payload.address or ""),
    )
    add_log(current_user["id"], "CUSTOMER_CREATE", f"Registered customer '{payload.name}'")
    return {"message": "Customer registered", "id": cust_id}


@app.put("/api/customers/{customer_id}")
def update_customer(customer_id: int, payload: CustomerUpdate, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    cust = fetch_one("SELECT * FROM customers WHERE id = ?", (customer_id,))
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.phone is not None:
        existing = fetch_one("SELECT id FROM customers WHERE phone = ? AND id != ?", (payload.phone.strip(), customer_id))
        if existing:
            raise HTTPException(status_code=400, detail="Phone number already registered")
        updates["phone"] = payload.phone.strip()
    if payload.email is not None:
        updates["email"] = payload.email
    if payload.address is not None:
        updates["address"] = payload.address

    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [customer_id]
        execute_write(f"UPDATE customers SET {set_clause} WHERE id = ?", tuple(values))

    add_log(current_user["id"], "CUSTOMER_UPDATE", f"Updated customer ID {customer_id}")
    return {"message": "Customer updated"}


@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int, current_user: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    cust = fetch_one("SELECT id, name FROM customers WHERE id = ?", (customer_id,))
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    execute_write("DELETE FROM customers WHERE id = ?", (customer_id,))
    add_log(current_user["id"], "CUSTOMER_DELETE", f"Deleted customer '{cust['name']}'")
    return {"message": f"Deleted customer '{cust['name']}'"}


@app.get("/api/customers/{customer_id}/history")
def customer_history(customer_id: int, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    cust = fetch_one("SELECT * FROM customers WHERE id = ?", (customer_id,))
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    invoices = fetch_all(
        """
        SELECT i.id, i.invoice_number, i.total, i.payment_status, i.created_at
        FROM invoices i
        WHERE i.customer_id = ?
        ORDER BY i.created_at DESC
        """,
        (customer_id,),
    )
    return {"customer": cust, "invoices": invoices}


# ---------------------------------------------------------------------------
# Invoices & Billing
# ---------------------------------------------------------------------------

@app.get("/api/invoices")
def list_invoices(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT i.*, COALESCE(c.name, 'Guest') as customer_name, COALESCE(u.fullname, 'System') as billed_by
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        LEFT JOIN users u ON u.id = i.user_id
        ORDER BY i.created_at DESC
        """
    )


@app.post("/api/invoices")
def create_invoice(payload: InvoiceCreate, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    invoice_number = generate_invoice_number()

    # Validate payment method
    if payload.payment_method not in ("cash", "card", "upi"):
        raise HTTPException(status_code=400, detail="Invalid payment method")

    with connect_db() as conn:
        subtotal = 0.0
        total_gst = 0.0
        items_data = []

        for item in payload.items:
            product = conn.execute("SELECT * FROM products WHERE id = ?", (item.product_id,)).fetchone()
            if not product:
                raise HTTPException(status_code=400, detail=f"Product ID {item.product_id} not found")
            product = dict(product)

            if product["stock"] < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for '{product['name']}'. Available: {product['stock']}, Requested: {item.quantity}",
                )

            item_total = item.unit_price * item.quantity
            item_gst = item_total * (item.gst_rate / 100.0)
            subtotal += item_total
            total_gst += item_gst

            items_data.append({
                "product_id": item.product_id,
                "product_name": product["name"],
                "product_sku": product["sku"],
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item_total,
                "gst_rate": item.gst_rate,
            })

        discount = min(payload.discount, subtotal)
        grand_total = round(subtotal - discount + total_gst, 2)

        # Create invoice
        invoice_id = execute_write_conn(
            conn,
            """INSERT INTO invoices (invoice_number, customer_id, user_id, subtotal, discount, gst, total, payment_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')""",
            (invoice_number, payload.customer_id, current_user["id"], round(subtotal, 2), round(discount, 2), round(total_gst, 2), grand_total),
        )

        # Create invoice items & deduct stock
        for item_data in items_data:
            execute_write_conn(
                conn,
                """INSERT INTO invoice_items (invoice_id, product_id, product_name, product_sku, quantity, unit_price, total_price, gst_rate)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (invoice_id, item_data["product_id"], item_data["product_name"], item_data["product_sku"],
                 item_data["quantity"], item_data["unit_price"], item_data["total_price"], item_data["gst_rate"]),
            )
            conn.execute(
                "UPDATE products SET stock = stock - ? WHERE id = ?",
                (item_data["quantity"], item_data["product_id"]),
            )

        # Create payment record
        execute_write_conn(
            conn,
            "INSERT INTO payments (invoice_id, amount, payment_method, transaction_reference) VALUES (?, ?, ?, ?)",
            (invoice_id, grand_total, payload.payment_method, payload.transaction_reference or ""),
        )

        conn.commit()

    add_log(current_user["id"], "INVOICE_CREATE", f"Generated invoice {invoice_number} — ₹{grand_total}")
    return {"message": "Invoice created", "invoice_number": invoice_number, "id": invoice_id, "total": grand_total}


@app.get("/api/invoices/{invoice_id}")
def get_invoice(invoice_id: int, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    invoice = fetch_one(
        """
        SELECT i.*, COALESCE(c.name, 'Guest') as customer_name,
               COALESCE(c.phone, '-') as customer_phone,
               COALESCE(c.email, '-') as customer_email,
               COALESCE(c.address, '-') as customer_address,
               COALESCE(u.fullname, 'System') as billed_by
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        LEFT JOIN users u ON u.id = i.user_id
        WHERE i.id = ?
        """,
        (invoice_id,),
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    items = fetch_all(
        "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC",
        (invoice_id,),
    )

    payment = fetch_one(
        "SELECT * FROM payments WHERE invoice_id = ? LIMIT 1",
        (invoice_id,),
    )

    return {"invoice": invoice, "items": items, "payment": payment}


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

@app.get("/api/reports/{report_type}")
def get_report(report_type: str, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if report_type == "daily_sales":
        rows = fetch_all(
            """
            SELECT DATE(i.created_at) as date, COUNT(*) as invoice_count,
                   SUM(i.subtotal) as subtotal, SUM(i.discount) as discount,
                   SUM(i.gst) as gst, SUM(i.total) as total
            FROM invoices i
            GROUP BY DATE(i.created_at)
            ORDER BY date DESC
            LIMIT 30
            """
        )
        return {"title": "Daily Sales Report", "headers": ["Date", "Invoices", "Subtotal", "Discount", "GST", "Total"], "rows": rows}

    elif report_type == "monthly_sales":
        rows = fetch_all(
            """
            SELECT strftime('%Y-%m', i.created_at) as month, COUNT(*) as invoice_count,
                   SUM(i.subtotal) as subtotal, SUM(i.discount) as discount,
                   SUM(i.gst) as gst, SUM(i.total) as total
            FROM invoices i
            GROUP BY strftime('%Y-%m', i.created_at)
            ORDER BY month DESC
            """
        )
        return {"title": "Monthly Sales Report", "headers": ["Month", "Invoices", "Subtotal", "Discount", "GST", "Total"], "rows": rows}

    elif report_type == "gst_report":
        rows = fetch_all(
            """
            SELECT ii.gst_rate as gst_rate,
                   SUM(ii.total_price) as taxable_amount,
                   SUM(ii.total_price * ii.gst_rate / 100.0) as gst_amount,
                   COUNT(DISTINCT ii.invoice_id) as invoice_count
            FROM invoice_items ii
            GROUP BY ii.gst_rate
            ORDER BY ii.gst_rate ASC
            """
        )
        return {"title": "GST Tax Report", "headers": ["GST Rate (%)", "Taxable Amount", "GST Amount", "Invoices"], "rows": rows}

    elif report_type == "stock_availability":
        rows = fetch_all(
            """
            SELECT p.sku, p.name, COALESCE(c.name, 'Uncategorized') as category,
                   p.stock, p.min_stock, p.price,
                   CASE WHEN p.stock = 0 THEN 'Out of Stock'
                        WHEN p.stock <= p.min_stock THEN 'Low Stock'
                        ELSE 'In Stock' END as status
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            ORDER BY p.stock ASC
            """
        )
        return {"title": "Stock Availability Report", "headers": ["SKU", "Product", "Category", "Stock", "Min Stock", "Price", "Status"], "rows": rows}

    elif report_type == "low_stock_alert":
        rows = fetch_all(
            """
            SELECT p.sku, p.name, COALESCE(c.name, 'Uncategorized') as category,
                   p.stock, p.min_stock
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.stock <= p.min_stock
            ORDER BY p.stock ASC
            """
        )
        return {"title": "Low Stock Alert Report", "headers": ["SKU", "Product", "Category", "Current Stock", "Min Stock"], "rows": rows}

    elif report_type == "invoice_report":
        rows = fetch_all(
            """
            SELECT i.invoice_number, COALESCE(c.name, 'Guest') as customer,
                   i.subtotal, i.discount, i.gst, i.total,
                   i.payment_status, COALESCE(u.fullname, 'System') as billed_by, i.created_at
            FROM invoices i
            LEFT JOIN customers c ON c.id = i.customer_id
            LEFT JOIN users u ON u.id = i.user_id
            ORDER BY i.created_at DESC
            """
        )
        return {"title": "Invoice Report", "headers": ["Invoice #", "Customer", "Subtotal", "Discount", "GST", "Total", "Status", "Billed By", "Date"], "rows": rows}

    else:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {report_type}")


# ---------------------------------------------------------------------------
# Admin — Users
# ---------------------------------------------------------------------------

@app.get("/api/admin/users")
def list_users(current_user: dict[str, Any] = Depends(require_admin)) -> list[dict[str, Any]]:
    return fetch_all("SELECT id, username, fullname, role, created_at FROM users ORDER BY id ASC")


@app.post("/api/admin/users")
def create_user(payload: UserCreate, current_user: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    if payload.role not in ("admin", "staff"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'staff'")
    existing = fetch_one("SELECT id FROM users WHERE username = ?", (payload.username.strip(),))
    if existing:
        raise HTTPException(status_code=400, detail=f"Username '{payload.username}' already exists")
    salt, digest = hash_password(payload.password)
    user_id = execute_write(
        "INSERT INTO users (username, password_salt, password_hash, password_plaintext, fullname, role) VALUES (?, ?, ?, ?, ?, ?)",
        (payload.username.strip(), salt, digest, payload.password, payload.fullname.strip(), payload.role),
    )
    add_log(current_user["id"], "USER_CREATE", f"Created user '{payload.username}' ({payload.role})")
    return {"message": "User created", "id": user_id}


@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, current_user: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = fetch_one("SELECT id, username FROM users WHERE id = ?", (user_id,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    execute_write("DELETE FROM users WHERE id = ?", (user_id,))
    add_log(current_user["id"], "USER_DELETE", f"Deleted user '{user['username']}'")
    return {"message": f"Deleted user '{user['username']}'"}


# ---------------------------------------------------------------------------
# Admin — Logs
# ---------------------------------------------------------------------------

@app.get("/api/admin/logs")
def list_logs(current_user: dict[str, Any] = Depends(require_admin)) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT l.id, l.action, l.details, l.created_at, COALESCE(u.fullname, 'System') as username
        FROM logs l
        LEFT JOIN users u ON u.id = l.user_id
        ORDER BY l.created_at DESC
        LIMIT 200
        """
    )


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

@app.get("/api/settings")
def get_settings(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, str]:
    rows = fetch_all("SELECT key, value FROM settings")
    return {r["key"]: r["value"] for r in rows}


@app.put("/api/settings")
def update_settings(payload: SettingsUpdate, current_user: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    for key, value in payload.settings.items():
        existing = fetch_one("SELECT key FROM settings WHERE key = ?", (key,))
        if existing:
            execute_write("UPDATE settings SET value = ? WHERE key = ?", (value, key))
        else:
            execute_write("INSERT INTO settings (key, value) VALUES (?, ?)", (key, value))
    add_log(current_user["id"], "SETTINGS_UPDATE", f"Updated settings: {', '.join(payload.settings.keys())}")
    return {"message": "Settings updated"}