from datetime import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException

from backend.app.schemas import InvoiceCreate, RecordPaymentRequest
from backend.app.database import connect_db, fetch_all, fetch_one, execute_write, execute_write_conn, add_log
from backend.app.auth import get_current_user

router = APIRouter(tags=["Invoices"])

def create_bill_no():
    prefix_row = fetch_one("SELECT value FROM settings WHERE key = 'invoice_prefix'")
    prefix = prefix_row["value"].strip() if (prefix_row and prefix_row["value"]) else "INV"
    today = datetime.now().strftime("%Y%m%d")
    count = fetch_one(
        "SELECT COUNT(*) as c FROM invoices WHERE invoice_number LIKE ?",
        (f"{prefix}-{today}%",),
    )
    seq = (count["c"] if count else 0) + 1
    return f"{prefix}-{today}-{seq:04d}"

@router.get("/api/invoices")
def list_bills(current_user = Depends(get_current_user)):
    # get all bills
    user = current_user
    return fetch_all(
        """
        SELECT i.*, COALESCE(c.name, 'Guest') as customer_name, COALESCE(u.fullname, 'System') as billed_by
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        LEFT JOIN users u ON u.id = i.user_id
        ORDER BY i.created_at DESC
        """
    )

@router.post("/api/invoices")
def create_bill(data: InvoiceCreate, current_user = Depends(get_current_user)):
    # calculate and save bill
    user = current_user
    bill_no = create_bill_no()

    if data.payment_method not in ("cash", "credit"):
        raise HTTPException(status_code=400, detail="Invalid payment method")

    with connect_db() as conn:
        subtotal = 0.0
        total_gst = 0.0
        items_data = []

        for item in data.items:
            product_row = conn.execute(
                """
                SELECT p.id, p.name, p.sku, p.price, i.stock, i.min_stock, i.location
                FROM products p
                LEFT JOIN inventory i ON i.product_id = p.id
                WHERE p.id = ?
                """,
                (item.product_id,)
            ).fetchone()
            if not product_row:
                raise HTTPException(status_code=400, detail=f"Product ID {item.product_id} not found")
            product = dict(product_row)

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
                "qty": item.quantity,
                "price": item.unit_price,
                "total": item_total,
                "gst": item.gst_rate,
            })

        discount = min(data.discount, round(subtotal + total_gst, 2))
        grand_total = round(subtotal + total_gst - discount, 2)
        
        is_credit = (data.payment_method == "credit")
        payment_status = "unpaid" if is_credit else "paid"

        bill_id = execute_write_conn(
            conn,
            """INSERT INTO invoices (invoice_number, customer_id, user_id, subtotal, discount, gst, total, payment_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (bill_no, data.customer_id, user["id"], round(subtotal, 2), round(discount, 2), round(total_gst, 2), grand_total, payment_status),
        )

        for item_data in items_data:
            execute_write_conn(
                conn,
                """INSERT INTO invoice_items (invoice_id, product_id, product_name, product_sku, quantity, unit_price, total_price, gst_rate)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (bill_id, item_data["product_id"], item_data["product_name"], item_data["product_sku"],
                 item_data["qty"], item_data["price"], item_data["total"], item_data["gst"]),
            )
            
            conn.execute(
                "UPDATE inventory SET stock = stock - ?, last_updated = CURRENT_TIMESTAMP WHERE product_id = ?",
                (item_data["qty"], item_data["product_id"]),
            )

            conn.execute(
                """INSERT INTO stock_transactions (product_id, quantity, transaction_type, user_id, notes)
                   VALUES (?, ?, 'sale', ?, ?)""",
                (item_data["product_id"], -item_data["qty"], user["id"], f"Invoice {bill_no}")
            )

        if not is_credit:
            execute_write_conn(
                conn,
                "INSERT INTO payments (invoice_id, amount, payment_method, transaction_reference) VALUES (?, ?, ?, ?)",
                (bill_id, grand_total, data.payment_method, data.transaction_reference or ""),
            )

        conn.commit()

    add_log(user["id"], "INVOICE_CREATE", f"Generated invoice {bill_no} — ₹{grand_total} ({payment_status.upper()})")
    return {"message": "Invoice created", "invoice_number": bill_no, "id": bill_id, "total": grand_total}

@router.get("/api/invoices/{bill_id}")
def get_bill(bill_id: int, current_user = Depends(get_current_user)):
    # get single bill details
    user = current_user
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
        (bill_id,),
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    items = fetch_all(
        "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC",
        (bill_id,),
    )

    payment = fetch_one(
        "SELECT * FROM payments WHERE invoice_id = ? LIMIT 1",
        (bill_id,),
    )

    return {"invoice": invoice, "items": items, "payment": payment}

@router.post("/api/invoices/{bill_id}/pay")
def process_payment(bill_id: int, data: RecordPaymentRequest, current_user = Depends(get_current_user)):
    # check payment and save
    user = current_user
    bill = fetch_one("SELECT * FROM invoices WHERE id = ?", (bill_id,))
    if not bill:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if bill["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Invoice is already fully paid")
        
    if data.payment_method not in ("cash", "card", "upi"):
        raise HTTPException(status_code=400, detail="Invalid payment method")
        
    execute_write(
        "INSERT INTO payments (invoice_id, amount, payment_method, transaction_reference) VALUES (?, ?, ?, ?)",
        (bill_id, data.amount, data.payment_method, data.transaction_reference or "")
    )
    
    execute_write(
        "UPDATE invoices SET payment_status = 'paid' WHERE id = ?",
        (bill_id,)
    )
    
    add_log(user["id"], "PAYMENT_RECORD", f"Recorded payment of ₹{data.amount} for Invoice {bill['invoice_number']}")
    return {"message": "Payment recorded successfully", "invoice_number": bill["invoice_number"]}
