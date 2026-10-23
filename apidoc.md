SACCO SYSTEM – API ENDPOINTS (Markdown Version)

Below is a fully organized and clean Markdown version of your endpoint list for Web, Desktop, and Mobile apps.

🌐 WEB APP ENDPOINTS
(Complete Management System)
Authentication & User Management
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/register
POST /api/v1/auth/reset-password

GET /api/v1/users
POST /api/v1/users
PUT /api/v1/users
GET /api/v1/users/:id
DELETE /api/v1/users/:id

POST /api/profile/update (Mandatory Profile Completion)

Branch Management
GET /api/v1/branches
POST /api/v1/branches
PUT /api/v1/branches/:id
DELETE /api/v1/branches/:id
GET /api/v1/branches/:id/statistics

Member Management
GET /api/v1/members
POST /api/v1/members
PUT /api/v1/members/:id
GET /api/v1/members/:id

POST /api/v1/members/:id/approve
POST /api/v1/members/:id/reject

GET /api/v1/members/:id/accounts
GET /api/v1/members/:id/loans
GET /api/v1/members/:id/transactions

Institution Management
GET /api/v1/institutions
POST /api/v1/institutions
PUT /api/v1/institutions/:id
GET /api/v1/institutions/:id

POST /api/v1/institutions/:id/approve
POST /api/v1/institutions/:id/reject

Account Management
GET /api/v1/accounts
POST /api/v1/accounts
PUT /api/v1/accounts/:id
GET /api/v1/accounts/:id

GET /api/v1/accounts/:id/balance
GET /api/v1/accounts/:id/transactions

POST /api/v1/accounts/:id/close
POST /api/v1/accounts/:id/suspend

GET /api/v1/account-types
POST /api/v1/account-types

Transaction Management
GET /api/v1/transactions
POST /api/v1/transactions/deposit
POST /api/v1/transactions/withdrawal
POST /api/v1/transactions/verify-withdrawal

GET /api/v1/transactions/:id
POST /api/v1/transactions/:id/reverse

GET /api/v1/transactions/recent

Loan Management
GET /api/v1/loans (List all loans)
POST /api/v1/loans/applications (Apply for a loan)
GET /api/v1/loans/active (Active loans)
GET /api/v1/loans/my-loans (Member's loans)
GET /api/v1/loans/:id

POST /api/v1/loans/:id/approve
POST /api/v1/loans/:id/reject
POST /api/v1/loans/disburse
POST /api/v1/loans/repay

GET /api/v1/loans/products (List products)
GET /api/v1/loans/statistics (Loan Portfolio Stats)
GET /api/v1/loans/repayments (Repayment History)
GET /api/v1/loans/reschedules (Reschedule Requests)

Float Management
GET /api/v1/float/balance
POST /api/v1/float/allocate
POST /api/v1/float/reconcile
POST /api/v1/float/start-day
POST /api/v1/float/end-day

GET /api/v1/float/reconciliations
POST /api/v1/float/reconciliations/:id/approve

GET /api/v1/float/transactions

Vault Management (Accountant Node)
GET /api/v1/vault (Get Vault & Recent Transactions)
POST /api/v1/vault (Initialize Vault for current user)
GET /api/v1/vault/balance
GET /api/v1/vault/statistics
POST /api/v1/vault/add-funds
POST /api/v1/vault/withdraw-funds
POST /api/v1/vault/reconcile

Organisational Reserve (Admin Node)
GET /api/v1/reserve (Fetch Main Office Reserve)
POST /api/v1/reserve/allocate (Allocate Float to Teller/Vault)
POST /api/v1/reserve/return (Return Excess Float)

Legacy Vault Endpoints (Deprecated)
GET /api/v1/vaults/:id/transactions

Income & Expenditure Management
GET /api/v1/income
POST /api/v1/income
GET /api/v1/income/statistics
GET /api/v1/income/categories
GET /api/v1/income/branches
PUT /api/v1/income/:id
DELETE /api/v1/income/:id

GET /api/v1/expenditure
POST /api/v1/expenditure
GET /api/v1/expenditure/statistics
GET /api/v1/expenditure/categories
GET /api/v1/expenditure/branches
PUT /api/v1/expenditure/:id
POST /api/v1/expenditure/:id/approve

Fixed Asset Management
GET /api/v1/fixed-assets
POST /api/v1/fixed-assets
PUT /api/v1/fixed-assets/:id
DELETE /api/v1/fixed-assets/:id
GET /api/v1/fixed-assets/:id

Reports & Analytics

### Financial Reports
GET /api/v1/reports/financial
GET /api/v1/reports/cash-flow
GET /api/v1/reports/trial-balance
GET /api/v1/reports/profit-loss

### Loan Reports (Dynamic Route)
**Base Route:** `GET /api/v1/reports/loans/[reportType]`

All loan reports support the following **query parameters**:
- `branchId` - Filter by specific branch (UUID)
- `officerId` - Filter by loan officer (UUID)
- `startDate` - Filter by start date (YYYY-MM-DD)
- `endDate` - Filter by end date (YYYY-MM-DD)
- `loanProductId` - Filter by loan product (UUID)
- `status` - Filter by loan status (DISBURSED, OVERDUE, etc.)

#### Available Report Types:

**Core Reports:**
- `GET /api/v1/reports/loans/disbursement` - Loan disbursement report with date/product/officer breakdown
- `GET /api/v1/reports/loans/outstanding` - Outstanding balance with P/I/Penalty breakdown
- `GET /api/v1/reports/loans/dues-vs-repayment` - Dues vs repayment comparison with performance rate
- `GET /api/v1/reports/loans/portfolio` - Portfolio at Risk (PAR) analysis with RBAC filtering
- `GET /api/v1/reports/loans/arrears` - Loans in arrears with Principal/Interest/Penalty breakdown
- `GET /api/v1/reports/loans/arrears-by-age` - Arrears aging analysis (6 brackets: 1-30, 31-60, 61-90, 91-180, 181-365, 365+ days)

**Additional Reports:**
- `GET /api/v1/reports/loans/summary` - Loan portfolio summary
- `GET /api/v1/reports/loans/product-performance` - Performance by loan product
- `GET /api/v1/reports/loans/monthly-trends` - Monthly loan trends
- `GET /api/v1/reports/loans/overdue` - Overdue loans report
- `GET /api/v1/reports/loans/written-off` - Written-off loans
- `GET /api/v1/reports/loans/paid-off` - Fully paid loans
- `GET /api/v1/reports/loans/guarantors` - Loan guarantors report
- `GET /api/v1/reports/loans/applications` - Application approval/rejection stats
- `GET /api/v1/reports/loans/daily-demand` - Daily demand sheet
- `GET /api/v1/reports/loans/officer-analysis` - Loan officer performance

**Example:**
```
GET /api/v1/reports/loans/arrears?branchId=xyz&startDate=2023-01-01&endDate=2023-12-31
```

### Legacy Report Endpoints (Deprecated - Use dynamic route above)
GET /api/v1/reports/loan-portfolio
GET /api/v1/reports/member-savings
GET /api/v1/reports/daily-summary
GET /api/v1/reports/monthly-summary


Dashboard Endpoints
GET /api/v1/admin/dashboard
GET /api/v1/branch-manager/dashboard
GET /api/v1/branch-manager/statistics
GET /api/v1/branch-manager/trends

GET /api/v1/teller/dashboard
GET /api/v1/accountant/dashboard

Notifications
GET /api/v1/notifications
POST /api/v1/notifications/mark-read
DELETE /api/v1/notifications/:id

💻 DESKTOP APP ENDPOINTS (Teller / Agent)
Core Teller Operations
POST /api/v1/auth/login
GET /api/v1/teller/dashboard
GET /api/v1/teller/float-balance
POST /api/v1/teller/start-day
POST /api/v1/teller/end-day

Quick Member Search
GET /api/v1/members/search?query=
GET /api/v1/members/:id/quick-info
GET /api/v1/accounts/:accountNumber

Transactions (Optimized)
POST /api/v1/transactions/deposit
POST /api/v1/transactions/withdrawal
POST /api/v1/transactions/verify-withdrawal
GET /api/v1/transactions/recent
POST /api/v1/transactions/receipt/:id

Loan Operations
POST /api/v1/loans/:id/repay
GET /api/v1/loans/:id/balance
POST /api/v1/loans/:id/disburse

Float Management
GET /api/v1/float/balance
POST /api/v1/float/reconcile
GET /api/v1/float/transactions/today

Offline Sync
POST /api/v1/sync/transactions
GET /api/v1/sync/pending
POST /api/v1/sync/upload

📱 MOBILE APP ENDPOINTS (Member Self-Service)
Authentication
POST /api/v1/mobile/auth/login
POST /api/v1/mobile/auth/register
POST /api/v1/mobile/auth/verify-otp
POST /api/v1/mobile/auth/forgot-password
POST /api/v1/mobile/auth/reset-password

Member Dashboard
GET /api/v1/mobile/dashboard
GET /api/v1/mobile/profile
PUT /api/v1/mobile/profile

Account Operations
GET /api/v1/mobile/accounts
GET /api/v1/mobile/accounts/:id/balance
GET /api/v1/mobile/accounts/:id/transactions
GET /api/v1/mobile/accounts/:id/statement

Loan Operations
GET /api/v1/mobile/loans
POST /api/v1/mobile/loans/apply
GET /api/v1/mobile/loans/:id
GET /api/v1/mobile/loans/:id/schedule
POST /api/v1/mobile/loans/:id/request-repayment

GET /api/v1/mobile/loan-products
POST /api/v1/mobile/loans/:id/calculate

Mobile Money Integration
POST /api/v1/mobile/deposit
POST /api/v1/mobile/withdraw
GET /api/v1/mobile/transaction-status/:id

Notifications
GET /api/v1/mobile/notifications
POST /api/v1/mobile/notifications/:id/read
POST /api/v1/mobile/notifications/settings

Support
POST /api/v1/mobile/support/ticket
GET /api/v1/mobile/support/tickets
GET /api/v1/mobile/faqs

System & Administration
POST /api/migration/members (Admin: Bulk Member Import/Migration)

🎯 PRIORITY ENDPOINTS TO BUILD FIRST
Phase 1: Core Banking (MVP)

✅ /api/v1/auth/\*

✅ /api/v1/users

✅ /api/v1/branches

/api/v1/members

/api/v1/accounts

/api/v1/transactions/deposit

/api/v1/transactions/withdrawal

Phase 2: Loan System

/api/v1/loan-products

/api/v1/loans/apply

/api/v1/loans/:id/approve

/api/v1/loans/:id/disburse

/api/v1/loans/:id/repay

Phase 3: Float & Vault

/api/v1/float/\*

/api/v1/vaults/\*

Phase 4: Reports & Analytics

/api/v1/branch-manager/dashboard

/api/v1/reports/\*

Phase 5: Mobile Money & Mobile App

/api/v1/mobile/\*

Mobile money integration

📊 SUMMARY BY PLATFORM
Platform Core Endpoints Optional
Web App ~80–100 Full management system
Desktop App ~30–40 Teller operations
Mobile App ~20–25 Member self-service

If you'd like, I can also:
✅ Generate OpenAPI/Swagger documentation
✅ Create folder structure + controllers for each module
✅ Implement actual endpoint code (Node.js, Laravel, Django, Go, etc.)

Just tell me which platform or module you want to build first! 🚀

---

## 👥 Member Onboarding & Migration Workflows

### 1. Migrated/Seeded Members (Legacy Data)
Members imported from the legacy system have specific login requirements and a mandatory profile update step.

#### **Step 1: First-Time Login**
- **Username:** Registered **Phone Number** (e.g., `0771234567` or `+256771234567`)
- **Default Password:** `Member@2026`
- **Action:** Call `POST /api/v1/auth/login` (Web) or `POST /api/v1/mobile/auth/login` (Mobile).

#### **Step 2: Mandatory Profile Update (Access Block)**
Upon successful login, the system checks for **Email** and **NIN**. Since legacy data lacks these fields, the user's dashboard access is **blocked** until they complete their profile.

- **Check:** If `user.email` is null OR `member.nin` is null -> Redirect to Profile Completion.
- **Mobile App Logic:**
    1. Login User.
    2. Check `user.email` in login response.
    3. If missing, navigate to `CompleteProfileScreen`.

#### **Step 3: Submitting Profile Details**
Use the **Profile Update Endpoint** to submit the missing information.

**Endpoint:** `POST /api/profile/update`  
**Headers:** `Authorization: Bearer <token>`  
**Body:**
```json
{
  "email": "john.doe@example.com",
  "nin": "CM12345678ABCD",
  "surname": "DOE",
  "otherNames": "JOHN",
  "dateOfBirth": "1990-01-01",
  "gender": "MALE",
  "maritalStatus": "MARRIED",
  "town": "Kasese",
  "address": "Bwera, Kasese",
  "phone": "+256771234567",
  "nokName": "JANE DOE",
  "nokRelationship": "SPOUSE",
  "nokPhone": "+256700000000"
}
```

#### **Step 4: Completion**
- On HTTP 200 OK, the user is fully active.
- Redirect them to the main Dashboard.
- Future logins will no longer prompt for this update.

---

## 📱 Mobile Implementation Guide: Complete Profile

This section details the implementation of the **Mandatory Profile Completion** screen for the mobile app.

### **When to Show**
1.  **After Login:** Inspect the login response `user` object.
    *   If `user.email` is `null` OR `user.isVerified` is `false` (legacy users), redirect to `CompleteProfileScreen`.
    *   **Do not** allow navigation to the Dashboard until this step is completed.

### **Form Fields & Validation**
The following fields are **mandatory**. Validate them on the client side before submission.

| Field | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| **email** | String (Email) | Yes | Valid email format. Unique in system. |
| **nin** | String | Yes | National ID Number (min 5 chars). Unique. |
| **surname** | String | Yes | Family name. |
| **otherNames** | String | Yes | Given names. |
| **dateOfBirth** | Date (YYYY-MM-DD) | Yes | User must be 18+. |
| **gender** | Enum | Yes | Options: `MALE`, `FEMALE`, `OTHER`. |
| **maritalStatus** | Enum | Yes | Options: `SINGLE`, `MARRIED`, `DIVORCED`, `WIDOWED`, `SEPARATED`, `OTHER`. |
| **occupation** | String | No | Current job/profession. |
| **citizenship** | String | No | e.g., "Ugandan". |
| **address** | String | Yes | Physical residential address. |
| **phone** | String | Yes | Mobile number (e.g., `+256...`). |
| **nokName** | String | Yes | Next of Kin full name. |
| **nokRelationship** | String | No | e.g., "Spouse", "Father". |
| **nokPhone** | String | Yes | Next of Kin phone number. |

### **API Interaction**
- **Method:** `POST`
- **URL:** `/api/profile/update`
- **Auth:** Bearer Token (from login response)

#### **Success Response (HTTP 200)**
```json
{
  "success": true
}
```
*Action:* Show success message ("Profile Updated"), then navigate to **Dashboard**.

#### **Error Respons (HTTP 400)**
```json
{
  "fieldErrors": {
    "email": ["Email already in use."],
    "nin": ["NIN already registered."]
  }
}
```
*Action:* Display error messages under the respective form fields.

### **UI/UX Tips**
- **Pre-fill:** If the login response contains any partial data (e.g., `phone`), pre-fill the form.
- **Date Picker:** Use a native date picker for `dateOfBirth`.
- **Dropdowns:** Use bottom sheets or pickers for `gender` and `maritalStatus`.
- **Keyboard:** Use `email-address` keyboard for email, `phone-pad` for phone numbers.


