from __future__ import annotations
from pydantic import BaseModel, Field

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
    phone: str | None = Field(default=None, min_length=10)
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

class PasswordResetRequest(BaseModel):
    new_password: str = Field(min_length=4)


class SettingsUpdate(BaseModel):
    settings: dict[str, str]

class RecordPaymentRequest(BaseModel):
    amount: float = Field(gt=0)
    payment_method: str = Field(min_length=1)
    transaction_reference: str | None = None
