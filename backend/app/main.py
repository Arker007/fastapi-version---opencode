from typing import Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import DB_PATH
from backend.app.database import init_database
from backend.app.routes import auth, admin, products, customers, invoices, reports, dashboard

app = FastAPI(title="Billing & Inventory Management API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(products.router)
app.include_router(customers.router)
app.include_router(invoices.router)
app.include_router(reports.router)
app.include_router(dashboard.router)

@app.on_event("startup")
def startup() -> None:
    init_database()

@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "billing-inventory-api", "database": DB_PATH.name}
