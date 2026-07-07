# Facade Module forwarding app and schemas for backwards compatibility
from backend.app.main import app, startup
from backend.app.database import (
    init_database,
    connect_db,
    fetch_one,
    fetch_all,
    execute_write,
    execute_write_conn
)
from backend.app.schemas import (
    ProductCreate,
    ProductUpdate,
    CustomerCreate,
    CustomerUpdate,
    InvoiceCreate,
    InvoiceItemInput,
    RecordPaymentRequest
)
from backend.app.routes.products import create_product, update_product
from backend.app.routes.customers import create_customer, update_customer
from backend.app.routes.invoices import create_bill as create_invoice, process_payment as record_late_payment
from backend.app.routes.reports import get_report