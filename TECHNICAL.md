# 🚀 EZE Ledger - Technical Documentation

This document provides a deep dive into the technical architecture, services, API endpoints, and implementation details of the EZE Ledger application.

---

## 🏗️ **SYSTEM ARCHITECTURE**

The application follows a modern full-stack architecture with a React/Vite frontend, a Node.js/Express backend, and a Prisma/SQLite database.

### **Frontend Stack**
- **Framework**: React 18.3.1 + TypeScript 5.9.2
- **Build Tool**: Vite 7.1.0
- **Styling**: Tailwind CSS 3.4.0
- **Animation**: Framer Motion 12.23.12
- **3D Graphics**: Three.js 0.179.1
- **Data Fetching**: TanStack Query (React Query)
- **OCR**: Tesseract.js 6.0.1

### **Backend Stack**
- **Runtime**: Node.js
- **Framework**: Express 5.1.0
- **ORM**: Prisma 6.13.0
- **Database**: SQLite
- **Real-time**: WebSocket (ws)
- **File Uploads**: Multer 2.0.2

---

## 🗄️ **DATABASE SCHEMA (Prisma)**

The schema is designed for double-entry bookkeeping with strong data integrity.

```prisma
// Core Accounting Models
model Account {
  id            String @id @default(cuid())
  code          String @unique  // 1xxx-6xxx GAAP codes
  name          String
  type          AccountType
  normalBalance NormalBalance
  entries       TransactionEntry[]
  // ... other relations
}

model Transaction {
  id            String @id @default(cuid())
  reference     String @unique  // Idempotency field
  date          DateTime
  description   String
  amount        Decimal        // Precise money handling
  entries       TransactionEntry[]
  expenses      Expense[]
  // ... other relations
}

model TransactionEntry {
  id            String @id @default(cuid())
  transactionId String
  accountId     String
  type          DebitCredit
  amount        Decimal
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  account       Account     @relation(fields: [accountId], references: [id])
}

model Expense {
  id            String @id @default(cuid())
  transactionId String @unique
  categoryId    String?
  categoryKey   String?
  amount        Decimal
  vendorName    String
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  // ... other fields
}

model Customer {
  id      String @id @default(cuid())
  name    String
  company String?
  email   String @unique
  phone   String?
  // ... other fields
}

enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
}

enum NormalBalance {
  DEBIT
  CREDIT
}
```

---

## 🏭 **CORE SERVICES ARCHITECTURE**

### **1. `PostingService` (Backend)**
Handles all transaction creation and ensures adherence to double-entry bookkeeping rules.

#### **Key Methods:**
-   `postTransaction(expenseData)`: Main entry point for creating an expense.
-   `postInvoiceTransaction(invoiceData)`: Main entry point for creating a revenue/invoice transaction.
-   `validateExpensePayload(payload)`: Ensures incoming expense data has the correct schema.
-   `validateInvoicePayload(payload)`: Ensures incoming invoice data has the correct schema.
-   `resolveExpenseAccounts(category)`: Maps a business category (e.g., "SOFTWARE") to a GL account code (e.g., "6040").
-   `createEntries(transactionData)`: Creates the corresponding debit and credit `TransactionEntry` records.

#### **Features:**
-   **Atomic Operations**: All database writes are wrapped in a `prisma.$transaction` to ensure all-or-nothing commits.
-   **Idempotency**: A unique `reference` field prevents duplicate transactions.
-   **Balance Validation**: Ensures `sum(debits) === sum(credits)` for every transaction.
-   **Overpayment Logic**: Correctly handles invoice overpayments by crediting a "Customer Credits" liability account.

### **2. `ReportingService` (Backend)**
Responsible for all financial calculations and report generation directly from the database.

#### **Key Methods:**
-   `getDashboard()`: Calculates all KPI metrics for the main dashboard.
-   `getTrialBalance()`: Generates a complete trial balance, ensuring debits equal credits.
-   `getPnl()`: Calculates the Profit & Loss statement (Revenue - Expenses).
-   `getBalanceSheet()`: Generates the Balance Sheet, ensuring `Assets = Liabilities + Equity`.
-   `healthCheck()`: Performs an accounting integrity check on the database.

### **3. `ExpenseAccountResolver` (Backend)**
Provides AI-powered and keyword-based expense categorization.

#### **Features:**
-   **Keyword Matching**: Maps over 200+ common US business keywords (e.g., "adobe", "uber") to expense categories.
-   **AI Suggestions**: Integrates with Gemini 2.0 to suggest a category for unknown descriptions.
-   **System Prompt**: Uses `SystemPrompt_Gemini_2.0_Flash.md` to provide CPA-level expertise.

### **4. `FinancialDataService` (Frontend)**
A service wrapper on the frontend to handle all API communication with the backend.

#### **Key Methods:**
-   `addExpenseTransaction(payload)`
-   `addInvoiceTransaction(payload)`
-   `getDashboardData()`
-   `getTrialBalance()`
-   `getCustomers()`
-   `updateCustomer(id, data)`

---

## 🔌 **API ENDPOINTS**

All endpoints are prefixed with `/api`.

### **Expenses**
-   **`POST /api/expenses`**: Creates a new expense transaction.
    -   **Body**: Canonical expense schema.
    -   **Returns**: `201 Created` with transaction details or `200 OK` if idempotent.
-   **`GET /api/expenses`**: Retrieves a list of all expenses.

### **Invoices**
-   **`POST /api/invoices`**: Creates a new invoice transaction.
    -   **Body**: Canonical invoice schema.
    -   **Returns**: `201 Created` with transaction details.

### **Customers**
-   **`GET /api/customers`**: Fetches all active customers.
-   **`POST /api/customers`**: Creates a new customer.
-   **`PUT /api/customers/:id`**: Updates an existing customer.

### **Financial Reports**
-   **`GET /api/dashboard`**: Retrieves all KPIs and data for the main dashboard.
-   **`GET /api/reports/trial-balance`**: Returns a fully calculated trial balance.
-   **`GET /api/reports/pnl`**: Returns a fully calculated Profit & Loss statement.
-   **`GET /api/reports/balance-sheet`**: Returns a fully calculated Balance Sheet.
-   **`GET /api/reports/chart-of-accounts`**: Returns the list of all accounts and their balances.

### **System**
-   **`GET /api/health`**: Runs an accounting integrity check and returns the system's financial health.
-   **`POST /api/reset-data`**: (Dev) Resets the database to its initial seeded state.

---

## 💻 **CODE IMPLEMENTATION EXAMPLES**

### **Frontend: Posting an Invoice (`AiInvoiceModal.tsx`)**
```typescript
// Real integration for sending an invoice from the frontend
const handleSendInvoice = async () => {
  const invoicePayload = {
    customerName: selectedClient?.company || selectedClient?.name,
    amountPaid: total,
    date: invoiceData.date,
    description: invoiceData.notes,
    invoiceNumber: invoiceData.invoiceNumber,
    dueDate: invoiceData.dueDate,
    category: 'PROFESSIONAL_SERVICES',
    lineItems: lineItems.map(item => ({
      description: item.description,
      amount: item.amount,
      quantity: item.quantity,
      rate: item.rate,
      category: 'PROFESSIONAL_SERVICES'
    }))
  };
  
  // Calls the frontend service, which hits the POST /api/invoices endpoint
  const result = await FinancialDataService.addInvoiceTransaction(invoicePayload);
  
  // Refreshes UI data after successful post
  queryClient.invalidateQueries({ queryKey: ['reports'] });
};
```

### **Backend: Server Endpoint for Invoices (`server.js`)**
```javascript
// Express endpoint to handle incoming invoice requests
app.post('/api/invoices', async (req, res) => {
  try {
    // 1. Validate payload shape and data types
    const validation = PostingService.validateInvoicePayload(req.body);
    if (!validation.isValid) {
      return res.status(422).json({
        code: 'VALIDATION_FAILED',
        details: validation.errors
      });
    }

    const invoiceData = validation.normalizedData;

    // 2. Call the PostingService to handle all business logic
    const result = await PostingService.postInvoiceTransaction(invoiceData);
    
    // 3. Return a success response
    return res.status(result.isExisting ? 200 : 201).json({
      ...result,
      success: true,
      message: 'Invoice posted successfully'
    });

  } catch (error) {
    console.error(`❌ POST /api/invoices failed:`, error);
    return res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }
});
```

---

## 🧪 **DETAILED TESTING PROCEDURES**

### **1. Database & Posting Engine Test**
1.  **Navigate** to `Reports > Chart of Accounts`.
2.  **Verify**: At least 37 accounts are listed with proper GAAP codes (1xxx-6xxx).
3.  **Navigate** to `Reports > Trial Balance`.
4.  **Verify**: The trial balance is perfectly balanced ($250,101 = $250,101).
5.  **Action**: Click "Add Expense", fill in:
    *   Vendor: "Test Vendor"
    *   Amount: 100
    *   Category: "Software & Technology"
6.  **Verify**: After saving, the Trial Balance should still be balanced, with the "Software & Technology" and "Cash" accounts updated. The total debit/credit should be $250,201.

### **2. Invoice System Test**
1.  **Action**: Press 'C' or click "Create Invoice".
2.  **Step 1**: Select "TechCorp Solutions" as the client.
3.  **Step 2**: Add "Web Development Services" ($2,500). Add another line item for "SEO Optimization" ($800).
4.  **Verify**: The total is calculated correctly.
5.  **Step 3**: Generate the preview and send the invoice.
6.  **Verify**: In the database, a new `Transaction` is created, with corresponding `TransactionEntry` records for Accounts Receivable (Debit $3,300) and Revenue accounts (Credit $2,500 and Credit $800).