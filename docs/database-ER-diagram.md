# Database Entity-Relationship Diagram (Textual)

```
┌────────────────────────┐
│         users          │
├────────────────────────┤
│ PK │ id               │
│    │ username          │
│    │ password_salt     │
│    │ password_hash     │
│    │ fullname          │
│    │ role (admin/staff)│
│    │ created_at        │
└──────────┬─────────────┘
           │
           │ 1:N (user creates invoices)
           ▼
┌────────────────────────┐      ┌─────────────────────────────┐
│       invoices         │      │       invoice_items          │
├────────────────────────┤      ├─────────────────────────────┤
│ PK │ id               │──1:N─│ PK │ id                      │
│    │ invoice_number   │      │ FK │ invoice_id              │
│    │ customer_id (FK) │      │ FK │ product_id              │
│    │ user_id (FK)     │      │    │ product_name (denormal) │
│    │ subtotal         │      │    │ product_sku (denormal)  │
│    │ discount         │      │    │ quantity                │
│    │ gst              │      │    │ unit_price              │
│    │ total            │      │    │ total_price             │
│    │ payment_status   │      │    │ gst_rate                │
│    │ created_at       │      └─────────────────────────────┘
└──────────┬────────────┘
           │
           │ 1:1 (invoice has one payment)
           ▼
┌────────────────────────┐      ┌────────────────────────┐
│       payments         │      │       products          │
├────────────────────────┤      ├────────────────────────┤
│ PK │ id               │      │ PK │ id               │
│ FK │ invoice_id       │      │ FK │ category_id      │
│    │ amount           │      │    │ name              │
│    │ payment_method   │      │    │ sku (UNIQUE)      │
│    │ transaction_ref  │      │    │ price             │
│    │ created_at       │      │    │ stock             │
└────────────────────────┘      │    │ min_stock         │
                                │    │ gst_rate          │
┌────────────────────────┐      │    │ location         │
│      customers         │      │    │ description      │
├────────────────────────┤      │    │ created_at        │
│ PK │ id               │──1:N─┘    └────────┬───────────┘
│    │ name              │                   │
│    │ phone (UNIQUE)    │                   │
│    │ email             │               N:1 │
│    │ address           │                   ▼
│    │ created_at        │      ┌────────────────────────┐
└────────────────────────┘      │      categories        │
                                ├────────────────────────┤
┌────────────────────────┐      │ PK │ id               │
│         logs           │      │    │ name (UNIQUE)     │
├────────────────────────┤      │    │ description       │
│ PK │ id               │      └────────────────────────┘
│ FK │ user_id          │
│    │ action            │      ┌────────────────────────┐
│    │ details           │      │       settings         │
│    │ created_at        │      ├────────────────────────┤
└────────────────────────┘      │ PK │ key (UNIQUE)     │
                                │    │ value             │
                                └────────────────────────┘

Relationships:
- users 1:N invoices (user_id FK)
- customers 1:N invoices (customer_id FK)
- invoices 1:N invoice_items (invoice_id FK, CASCADE)
- products 1:N invoice_items (product_id FK, SET NULL)
- categories 1:N products (category_id FK, SET NULL)
- invoices 1:1 payments (invoice_id FK, CASCADE)
- users 1:N logs (user_id FK, SET NULL)
```

## Foreign Key Constraints

| FK | From | To | On Delete |
|----|------|----|-----------|
| products.category_id | products | categories.id | SET NULL |
| invoices.customer_id | invoices | customers.id | SET NULL |
| invoices.user_id | invoices | users.id | SET NULL |
| invoice_items.invoice_id | invoice_items | invoices.id | CASCADE |
| invoice_items.product_id | invoice_items | products.id | SET NULL |
| payments.invoice_id | payments | invoices.id | CASCADE |
| logs.user_id | logs | users.id | SET NULL |

## Indexes
- users.username (UNIQUE)
- products.sku (UNIQUE)
- customers.phone (UNIQUE)
- categories.name (UNIQUE)
- invoices.invoice_number (UNIQUE)
- settings.key (UNIQUE)
