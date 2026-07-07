from typing import Any
from fastapi import APIRouter, Depends, HTTPException

from backend.app.schemas import CustomerCreate, CustomerUpdate
from backend.app.database import fetch_all, fetch_one, execute_write, add_log
from backend.app.auth import require_admin, get_current_user

router = APIRouter(tags=["Customers"])

@router.get("/api/customers")
def list_customers(user = Depends(get_current_user)):
    # get all customers
    return fetch_all("SELECT * FROM customers ORDER BY name ASC")

@router.post("/api/customers")
def create_customer(data: CustomerCreate, user = Depends(get_current_user)):
    # add customer
    existing = fetch_one("SELECT id FROM customers WHERE phone = ?", (data.phone.strip(),))
    if existing:
        raise HTTPException(status_code=400, detail=f"Customer with phone '{data.phone}' already exists")
    id = execute_write(
        "INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)",
        (data.name.strip(), data.phone.strip(), data.email or "", data.address or ""),
    )
    add_log(user["id"], "CUSTOMER_CREATE", f"Registered customer '{data.name}'")
    return {"message": "Customer registered", "id": id}

@router.put("/api/customers/{customer_id}")
def update_customer(customer_id: int, data: CustomerUpdate, user = Depends(get_current_user)):
    # update customer info
    cust = fetch_one("SELECT * FROM customers WHERE id = ?", (customer_id,))
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    updates = {}
    if data.name is not None:
        updates["name"] = data.name.strip()
    if data.phone is not None:
        existing = fetch_one("SELECT id FROM customers WHERE phone = ? AND id != ?", (data.phone.strip(), customer_id))
        if existing:
            raise HTTPException(status_code=400, detail="Phone number already registered")
        updates["phone"] = data.phone.strip()
    if data.email is not None:
        updates["email"] = data.email
    if data.address is not None:
        updates["address"] = data.address

    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [customer_id]
        execute_write(f"UPDATE customers SET {set_clause} WHERE id = ?", tuple(values))

    add_log(user["id"], "CUSTOMER_UPDATE", f"Updated customer ID {customer_id}")
    return {"message": "Customer updated"}

@router.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int, user = Depends(require_admin)):
    # delete customer
    cust = fetch_one("SELECT id, name FROM customers WHERE id = ?", (customer_id,))
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    execute_write("DELETE FROM customers WHERE id = ?", (customer_id,))
    add_log(user["id"], "CUSTOMER_DELETE", f"Deleted customer '{cust['name']}'")
    return {"message": f"Deleted customer '{cust['name']}'"}

@router.get("/api/customers/{customer_id}/history")
def customer_history(customer_id: int, user = Depends(get_current_user)):
    # get customer invoices history
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
