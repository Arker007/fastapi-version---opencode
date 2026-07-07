# Project Title: Billing and Inventory Management System

## Project Synopsis
This project is developed using **FastAPI** and **SQLite** for managing billing and inventory operations in retail shops. The system is designed to automate the process of stock tracking, billing checkout, GST tax calculations, customer management, and generating business reports.

It is created as a final year BCA project submission to replace manual record-keeping with a digital software solution.

---

## Objective of the Project
The main objectives of this software project are:
1.  **To Automate Billing**: Generate printed bills with sequential bill numbers and calculate GST (CGST/SGST) dynamically.
2.  **To Manage Inventory**: Maintain real-time stock levels of products and log stock adjustments.
3.  **To Track Customers**: Store customer records and view their past invoice history.
4.  **To Generate Reports**: Provide the administrator with visual charts and detailed logs of sales, taxes, and stock levels.
5.  **To Secure Access**: Protect the application using Role-Based Access Control (Admin and Staff) with secure login passwords.

---

## System Specification

### Hardware Requirements
-   **Processor**: Intel Core i3 or equivalent (minimum 2.0 GHz)
-   **Memory**: 4 GB RAM (minimum)
-   **Hard Disk**: 500 MB free space

### Software Requirements
-   **Operating System**: Windows 10 / 11
-   **Programming Language**: Python (Version 3.10 or higher)
-   **Database**: SQLite3
-   **Web Technologies**: HTML5, CSS3, JavaScript (ES6)
-   **Backend Framework**: FastAPI (Uvicorn server)
-   **Frontend Runtime**: Node.js (for static page server)

---

## Project Modules

### 1. User Management (Auth)
Provides secure login workspace sessions. Users are categorized as:
-   **Administrator**: Full access to all screens, admin settings, adding staff users, and viewing logs.
-   **Staff**: Access to inventory lists, billing checkouts, and customer profiles.

### 2. Product and Category Module (Stock)
Allows the administrator to create product categories, register new items with custom SKU codes, and set initial stock levels.

### 3. Customer Module (CRM)
Maintains lists of customer names, phone numbers, and addresses. Integrates historical invoice tracking directly.

### 4. Billing Module
Atomic transaction-backed checkout interface. Computes unit prices, applies custom discounts, and adds local GST rates (CGST & SGST). Deducts product stocks automatically upon successful sales.

### 5. Reports Module
Queries the database to generate:
-   Daily Sales Log
-   Monthly Revenue Chart
-   GST Tax Liability breakdown (CGST, SGST, IGST)
-   Current Stock Availability values
-   Low Stock alert notifications

---

## Directory Structure

```text
Billing-Inventory-System/
├── backend/                  # REST API Python Code
│   ├── app/                  # Application Modules
│   │   ├── routes/           # Routing controllers
│   │   ├── auth.py           # Login security
│   │   ├── config.py         # Config paths
│   │   ├── database.py       # SQL queries
│   │   ├── main.py           # FastAPI startup
│   │   └── schemas.py        # Pydantic schemas
│   └── main.py               # Main API facade
├── frontend/                 # Client Webpage Files
│   ├── css/                  # Custom CSS styles
│   ├── js/                   # JS controllers
│   ├── pages/                # Clean HTML pages
│   └── index.html            # Main entry page
├── docs/                     # University Project Logs
│   └── project-progress-diary.md
├── server.js                 # Node.js Static Server
├── requirements.txt          # Python Packages Manifest
└── package.json              # Node.js Project Manifest
```

---

## Installation and Execution Guide

### Step 1: Backend Setup (Python FastAPI)
1.  Open Command Prompt or Terminal and navigate to the project root folder.
2.  Create a virtual environment:
    ```bash
    python -m venv venv
    ```
3.  Activate the environment:
    -   **Windows**: `venv\Scripts\activate`
    -   **macOS/Linux**: `source venv/bin/activate`
4.  Install required packages:
    ```bash
    pip install -r requirements.txt
    ```
5.  Start the backend API server:
    ```bash
    python -m uvicorn backend.main:app --reload --port 8000
    ```

### Step 2: Frontend Setup (Node.js Static Web Server)
1.  Open a second terminal window.
2.  Install Express static server dependencies:
    ```bash
    npm install
    ```
3.  Start the Express web server:
    ```bash
    node server.js
    ```
4.  Open your browser and navigate to `http://localhost:3000`.

### Step 3: Default Admin & Staff Accounts
-   **Administrator Login**:
    -   Username: `admin`
    -   Password: `admin123`
-   **Staff Login**:
    -   Username: `staff`
    -   Password: `staff123`
