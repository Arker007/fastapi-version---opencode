from datetime import datetime, timedelta, timezone
from typing import Any
from fastapi import APIRouter, Depends

from backend.app.database import fetch_one, fetch_all
from backend.app.auth import get_current_user

router = APIRouter(tags=["Dashboard"])

@router.get("/api/dashboard/summary")
def dashboard_summary(user = Depends(get_current_user)):
    # get counters for sales, bills, products, and low stock
    total_sales = fetch_one("SELECT COALESCE(SUM(total), 0) as total FROM invoices") or {"total": 0}
    invoice_count = fetch_one("SELECT COUNT(*) as count FROM invoices") or {"count": 0}
    product_count = fetch_one("SELECT COUNT(*) as count FROM products") or {"count": 0}
    low_stock = fetch_one("SELECT COUNT(*) as count FROM inventory WHERE stock <= min_stock") or {"count": 0}

    return {
        "totalSales": total_sales["total"],
        "invoiceCount": invoice_count["count"],
        "productCount": product_count["count"],
        "lowStockCount": low_stock["count"],
    }

@router.get("/api/dashboard/sales-chart")
def dashboard_sales_chart(user = Depends(get_current_user)):
    # get sales chart data for last 15 days
    rows = fetch_all(
        """
        SELECT DATE(created_at) as date, SUM(total) as total
        FROM invoices
        WHERE created_at >= DATE('now', '-15 days')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
        """
    )
    result = []
    for i in range(14, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        found = next((r for r in rows if r["date"] == d), None)
        result.append({"date": d, "total": found["total"] if found else 0})
    return result

@router.get("/api/dashboard/category-chart")
def dashboard_category_chart(user = Depends(get_current_user)):
    # get sales total by categories
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

@router.get("/api/dashboard/top-products")
def dashboard_top_products(user = Depends(get_current_user)):
    # get top selling products list
    return fetch_all(
        """
        SELECT COALESCE(p.name, ii.product_name) as name,
               MAX(COALESCE(c.name, 'Uncategorized')) as category_name,
               SUM(ii.quantity) as qty_sold,
               SUM(ii.total_price) as revenue
         FROM invoice_items ii
         LEFT JOIN products p ON p.id = ii.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         GROUP BY COALESCE(p.name, ii.product_name)
         ORDER BY qty_sold DESC
         LIMIT 5
         """
    )

@router.get("/api/dashboard/recent-invoices")
def dashboard_recent_invoices(user = Depends(get_current_user)):
    # get list of recent invoices
    return fetch_all(
        """
        SELECT i.id, i.invoice_number, COALESCE(c.name, 'Guest') as customer_name, i.total, i.created_at
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        ORDER BY i.created_at DESC
        LIMIT 5
        """
    )
