from typing import Any
from fastapi import APIRouter, Depends, HTTPException

from backend.app.database import fetch_all
from backend.app.auth import get_current_user

router = APIRouter(tags=["Reports"])

@router.get("/api/reports/{report_type}")
def get_report(report_type: str, current_user = Depends(get_current_user)):
    # generate sales, stock, and tax reports based on report type
    user = current_user
    if report_type == "daily_sales":
        rows = fetch_all(
            """
            SELECT i.invoice_number, COALESCE(c.name, 'Guest') as customer_name,
                   DATE(i.created_at) as date, i.total as total_amount, i.gst, i.payment_status
            FROM invoices i
            LEFT JOIN customers c ON c.id = i.customer_id
            ORDER BY i.created_at DESC
            """
        )
        return {"title": "Daily Sales Report", "headers": ["Invoice No.", "Customer Name", "Date", "Total Amount", "GST", "Payment Status"], "rows": rows}

    elif report_type == "monthly_sales":
        rows = fetch_all(
            """
            SELECT strftime('%Y-%m', i.created_at) as month,
                   SUM(i.subtotal) as total_sales,
                   SUM(i.gst) as total_gst,
                   COUNT(i.id) as invoice_count,
                   SUM(i.total) as revenue
            FROM invoices i
            GROUP BY strftime('%Y-%m', i.created_at)
            ORDER BY month DESC
            """
        )
        return {"title": "Monthly Sales Report", "headers": ["Month", "Total Sales", "Total GST", "Number of Invoices", "Revenue"], "rows": rows}

    elif report_type == "gst_report":
        rows = fetch_all(
            """
            SELECT i.invoice_number, i.subtotal - i.discount as taxable_amount,
                   ROUND(i.gst / 2.0, 2) as cgst,
                   ROUND(i.gst / 2.0, 2) as sgst,
                   0.0 as igst,
                   i.gst as total_gst
            FROM invoices i
            ORDER BY i.created_at DESC
            """
        )
        return {"title": "GST Tax Report", "headers": ["Invoice No.", "Taxable Amount", "CGST", "SGST", "IGST", "Total GST"], "rows": rows}

    elif report_type == "stock_availability":
        rows = fetch_all(
            """
            SELECT p.name as product_name, COALESCE(c.name, 'Uncategorized') as category,
                   i.stock, p.price, ROUND(i.stock * p.price, 2) as stock_value
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN inventory i ON i.product_id = p.id
            ORDER BY p.name ASC
            """
        )
        return {"title": "Stock Availability Report", "headers": ["Product Name", "Category", "Current Stock", "Price", "Stock Value"], "rows": rows}

    elif report_type == "low_stock_alert":
        rows = fetch_all(
            """
            SELECT p.name as product, i.stock as current_quantity,
                   i.min_stock as minimum_quantity,
                   CASE WHEN i.stock = 0 THEN 'Out of Stock' ELSE 'Low Stock' END as alert_status
            FROM products p
            LEFT JOIN inventory i ON i.product_id = p.id
            WHERE i.stock <= i.min_stock
            ORDER BY i.stock ASC
            """
        )
        return {"title": "Low Stock Alert Report", "headers": ["Product", "Current Quantity", "Minimum Quantity", "Alert Status"], "rows": rows}

    elif report_type == "invoice_report":
        rows = fetch_all(
            """
            SELECT i.invoice_number, COALESCE(c.name, 'Guest') as customer,
                   DATE(i.created_at) as date, i.total as amount, i.payment_status
            FROM invoices i
            LEFT JOIN customers c ON c.id = i.customer_id
            ORDER BY i.created_at DESC
            """
        )
        return {"title": "Invoice Report", "headers": ["Invoice Number", "Customer", "Date", "Amount", "Payment Status"], "rows": rows}

    else:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {report_type}")
