import secrets
from typing import Any
from fastapi import APIRouter, Depends, HTTPException

from backend.app.schemas import ProductCreate, ProductUpdate, CategoryCreate, CategoryUpdate
from backend.app.database import fetch_all, fetch_one, execute_write, add_log
from backend.app.auth import require_admin, get_current_user

router = APIRouter(tags=["Products"])

# Products Endpoints
@router.get("/api/products")
def list_products(current_user = Depends(get_current_user)):
    # get all products
    user = current_user
    return fetch_all(
        """
        SELECT p.id, p.name, p.sku, p.price, p.gst_rate, p.description, p.created_at,
               c.name AS category_name, p.category_id,
               i.stock, i.min_stock, i.location
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN inventory i ON i.product_id = p.id
        ORDER BY p.name ASC
        """
    )

@router.post("/api/products")
def create_product(data: ProductCreate, current_user = Depends(require_admin)):
    # add product
    user = current_user
    sku = data.sku.strip() if (data.sku and data.sku.strip()) else f"SKU-{secrets.token_hex(4).upper()}"
    existing = fetch_one("SELECT id FROM products WHERE sku = ?", (sku,))
    if existing:
        raise HTTPException(status_code=400, detail=f"SKU '{sku}' already exists")

    id = execute_write(
        """INSERT INTO products (name, sku, category_id, price, stock, min_stock, gst_rate, location, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (data.name.strip(), sku, data.category_id, data.price, data.stock, data.min_stock, data.gst_rate, data.location, data.description or ""),
    )

    if data.stock > 0:
        execute_write(
            """INSERT INTO stock_transactions (product_id, quantity, transaction_type, user_id, notes)
               VALUES (?, ?, 'restock', ?, 'Initial stock import')""",
            (id, data.stock, user["id"])
        )

    add_log(user["id"], "PRODUCT_CREATE", f"Created product '{data.name}' (SKU: {sku})")
    return {"message": "Product created", "id": id}

@router.put("/api/products/{product_id}")
def update_product(product_id: int, data: ProductUpdate, current_user = Depends(require_admin)):
    # update product
    user = current_user
    product = fetch_one("SELECT * FROM products WHERE id = ?", (product_id,))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    updates = {}
    if data.name is not None:
        updates["name"] = data.name.strip()
    if data.sku is not None:
        sku_stripped = data.sku.strip()
        if not sku_stripped:
            raise HTTPException(status_code=400, detail="SKU cannot be empty")
        existing = fetch_one("SELECT id FROM products WHERE sku = ? AND id != ?", (sku_stripped, product_id))
        if existing:
            raise HTTPException(status_code=400, detail=f"SKU '{sku_stripped}' already exists")
        updates["sku"] = sku_stripped
    if data.category_id is not None:
        updates["category_id"] = data.category_id
    if data.price is not None:
        updates["price"] = data.price
    if data.gst_rate is not None:
        updates["gst_rate"] = data.gst_rate
    if data.description is not None:
        updates["description"] = data.description

    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [product_id]
        execute_write(f"UPDATE products SET {set_clause} WHERE id = ?", tuple(values))

    inv_updates = {}
    if data.stock is not None:
        inv_updates["stock"] = data.stock
    if data.min_stock is not None:
        inv_updates["min_stock"] = data.min_stock
    if data.location is not None:
        inv_updates["location"] = data.location

    if inv_updates:
        curr = fetch_one("SELECT stock FROM inventory WHERE product_id = ?", (product_id,))
        curr_stock = curr["stock"] if curr else 0

        set_clause = ", ".join(f"{k} = ?" for k in inv_updates)
        values = list(inv_updates.values()) + [product_id]
        execute_write(f"UPDATE inventory SET {set_clause}, last_updated = CURRENT_TIMESTAMP WHERE product_id = ?", tuple(values))

        if data.stock is not None and data.stock != curr_stock:
            diff = data.stock - curr_stock
            tx_type = "restock" if diff > 0 else "adjustment"
            execute_write(
                """INSERT INTO stock_transactions (product_id, quantity, transaction_type, user_id, notes)
                   VALUES (?, ?, ?, ?, ?)""",
                (product_id, diff, tx_type, user["id"], f"Manual stock adjustment from {curr_stock} to {data.stock}")
            )

    add_log(user["id"], "PRODUCT_UPDATE", f"Updated product ID {product_id}")
    return {"message": "Product updated"}

@router.delete("/api/products/{product_id}")
def delete_product(product_id: int, current_user = Depends(require_admin)):
    # delete product
    user = current_user
    product = fetch_one("SELECT id, name FROM products WHERE id = ?", (product_id,))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    execute_write("DELETE FROM products WHERE id = ?", (product_id,))
    add_log(user["id"], "PRODUCT_DELETE", f"Deleted product '{product['name']}'")
    return {"message": f"Deleted {product['name']}"}

# Categories Endpoints
@router.get("/api/categories")
def list_categories(current_user = Depends(get_current_user)):
    # get all categories
    user = current_user
    return fetch_all("SELECT id, name, description FROM categories ORDER BY name ASC")

@router.post("/api/categories")
def create_category(data: CategoryCreate, current_user = Depends(require_admin)):
    # add category
    user = current_user
    existing = fetch_one("SELECT id FROM categories WHERE name = ?", (data.name.strip(),))
    if existing:
        raise HTTPException(status_code=400, detail=f"Category '{data.name}' already exists")
    cat_id = execute_write(
        "INSERT INTO categories (name, description) VALUES (?, ?)",
        (data.name.strip(), data.description or ""),
    )
    add_log(user["id"], "CATEGORY_CREATE", f"Created category '{data.name}'")
    return {"message": "Category created", "id": cat_id}

@router.put("/api/categories/{category_id}")
def update_category(category_id: int, data: CategoryUpdate, current_user = Depends(require_admin)):
    # update category
    user = current_user
    cat = fetch_one("SELECT * FROM categories WHERE id = ?", (category_id,))
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    updates = {}
    if data.name is not None:
        existing = fetch_one("SELECT id FROM categories WHERE name = ? AND id != ?", (data.name.strip(), category_id))
        if existing:
            raise HTTPException(status_code=400, detail=f"Category '{data.name}' already exists")
        updates["name"] = data.name.strip()
    if data.description is not None:
        updates["description"] = data.description

    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [category_id]
        execute_write(f"UPDATE categories SET {set_clause} WHERE id = ?", tuple(values))

    add_log(user["id"], "CATEGORY_UPDATE", f"Updated category ID {category_id}")
    return {"message": "Category updated"}

@router.delete("/api/categories/{category_id}")
def delete_category(category_id: int, current_user = Depends(require_admin)):
    # delete category
    user = current_user
    cat = fetch_one("SELECT id, name FROM categories WHERE id = ?", (category_id,))
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    execute_write("DELETE FROM categories WHERE id = ?", (category_id,))
    add_log(user["id"], "CATEGORY_DELETE", f"Deleted category '{cat['name']}'")
    return {"message": f"Deleted category '{cat['name']}'"}
