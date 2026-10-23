# Mobile API Integration Guide

This guide details the endpoints required for the mobile application to interact with the backend, covering authentication, payments (Mobile Money), and file uploads.

## Base URL
The backend is live and ready for mobile integration.

```
Production: https://bukonzemergency.vercel.app/api
```
*(Use this URL for all mobile app requests)*

---

## 1. Authentication (NextAuth)

 The backend uses JWT-based sessions. The mobile app needs to authenticate using the credentials provider and store the session cookie or token.

### Login
**Endpoint:** `POST /auth/callback/credentials`

**Headers:**
- `Content-Type: application/x-www-form-urlencoded` OR `application/json` (NextAuth handles both, but form-data is standard for the callback)

**Body (JSON example):**
```json
{
  "identifier": "user@example.com", 
  "password": "yourpassword",
  "redirect": "false",
  "csrfToken": "extracted-csrf-token" // *See note below
}
```

> **Note on CSRF:** NextAuth requires a CSRF token. 
> 1. Call `GET /auth/csrf` to get the token.
> 2. Include it in the login body.
> 3. Store the `next-auth.session-token` cookie from the response for subsequent requests.

**Response (Success):**
- Status: 200 OK
- Body: JSON object with `url` (login redirect).
- **Important:** The actual session token is set in the `next-auth.session-token` cookie. The mobile app **must** preserve this cookie for all authenticated requests.

### Get Session / User Profile
To verify login and get user details:

**Endpoint:** `GET /auth/session`
**Headers:** `Cookie: next-auth.session-token=...`

**Response:**
```json
{
  "user": {
    "name": "John Doe",
    "email": "user@example.com",
    "image": "https://...",
    "role": "MEMBER",
    "branchId": "..."
  },
  "expires": "2026-02-10T..."
}
```

---

## 2. Mobile Money Integration (Pesapal)

Use this endpoint to initiate Mobile Money deposits or repayments.

### Initiate Payment
**Endpoint:** `POST /api/payment/initiate`
**Auth:** Required (Session Cookie)

**Body:**
```json
{
  "phoneNumber": "0700123456",
  "amount": 50000,
  "transactionType": "deposit", // or "repayment"
  "accountId": "uuid-account-id", // Required for deposit
  "loanId": "uuid-loan-id",       // Required for repayment
  "description": "Optional note"
}
```

**Response:**
```json
{
  "success": true,
  "checkoutUrl": "https://pay.pesapal.com/iframe/...",
  "transactionId": "aa-bb-cc-dd",
  "merchantReference": "DEPOSIT-1736...",
  "message": "Payment initiated successfully. Redirecting to Pesapal..."
}
```

**Mobile Flow:**
1. Call `initiate`.
2. Open the returned `checkoutUrl` in a **WebView**.
3. User completes payment in WebView.
4. Pesapal redirects to your callback URL (handled by backend).
5. Poll your backend (e.g., `GET /api/v1/transactions/{merchantReference}`) to check status updates.

---

## 3. Photo & File Uploads (UploadThing)

The backend uses **UploadThing**. For mobile apps (React Native), it is highly recommended to use the `@uploadthing/react-native` SDK (or `uploadthing` client package) rather than manual HTTP calls, as the protocol involves signing and multipart headers.

### Option A: Using SDK (Recommended for React Native)
1. Install: `npm install @uploadthing/react @uploadthing/react-native`
2. Usage:
```javascript
import { generateReactHelpers } from "@uploadthing/react-native";

const { useUploadThing } = generateReactHelpers({
  url: "https://your-domain.com/api/uploadthing", // Point to your API route
});

// Inside component
const { startUpload } = useUploadThing("userProfileImage");

const handeUpload = async () => {
  await startUpload([selectedFileRequest]);
};
```

### Option B: Manual HTTP Upload (If SDK is not an option)
*Warning: This is complex and subject to change by UploadThing.*

**1. Get Presigned URL**
**Endpoint:** `POST /api/uploadthing?slug=userProfileImage`
**Body:**
```json
{
  "files": [
    { "name": "profile.jpg", "size": 102400, "type": "image/jpeg" }
  ]
}
```

**Response:**
```json
[
  {
    "fileUrl": "https://utfs.io/f/key.jpg",
    "presignedUrl": "https://bucket.s3.region.amazonaws.com/...",
    "fields": { ...aws-form-fields... }
  }
]
```

**2. Upload to S3**
Perform a `POST` to the `presignedUrl` using `FormData`, including all fields from the response + the file itself.

**Available Upload Routes (Slugs):**
- `userProfileImage` (Max 2MB)
- `fileUploads` (Generic files, PDF/Docs, Max 1MB)
- `institutionDocuments` (Max 2MB)
- `migrationFile` (Large files, up to 16MB)

---

## 4. Error Handling

Standard error format for all API endpoints:

```json
{
  "success": false,
  "error": "Error description message",
  "code": "ERROR_CODE" // Optional
}
```
HTTP Status codes:
- `401 Unauthorized`: Session expired or missing.
- `400 Bad Request`: Validation error.
- `500 Server Error`: Internal issue.

---

## 5. Member Operations

These endpoints allow logged-in members to view their own data.

### Get My Profile
Returns the member's profile details and summary statistics.

**Endpoint:** `GET /api/v1/members/me`
**Auth:** Required (Member)

**Response:**
```json
{
  "success": true,
  "data": {
    "member": {
      "id": "uuid",
      "memberNumber": "MEM001",
      "name": "John Doe",
      "membershipStatus": "ACTIVE",
      "branch": { "name": "Main Branch" }
    },
    "totalBalance": 500000,
    "activeLoansCount": 1,
    "totalLoanOutstanding": 200000,
    "savingsGoal": { "target": 1000000, "current": 500000, "percentage": 50 }
  }
}
```

### Get My Accounts
Returns all accounts belonging to the logged-in member.

**Endpoint:** `GET /api/v1/accounts/my-account`
**Auth:** Required (Member)

**Response:**
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "uuid",
        "accountNumber": "ACC001",
        "accountType": "Savings",
        "balance": 150000,
        "status": "ACTIVE",
        "interestRate": 5
      }
    ],
    "totalBalance": 150000
  }
}
```

### Get My Loans
Returns all loans for the logged-in member with pagination.

**Endpoint:** `GET /api/v1/loans/my-loans?limit=20&offset=0&status=ACTIVE`
**Auth:** Required (Member)

**Response:**
```json
{
  "success": true,
  "data": {
    "loans": [
      {
        "id": "uuid",
        "amountGranted": 1000000,
        "outstandingBalance": 500000,
        "status": "DISBURSED",
        "nextPaymentDate": "2026-02-01"
      }
    ],
    "stats": {
      "activeLoans": 1,
      "totalOutstanding": 500000
    }
  }
}
```

### Get My Transactions
Search transaction history.

**Endpoint:** `GET /api/v1/transactions?limit=20&memberId={your-member-id}`
**Auth:** Required
*(Note: You can get your `memberId` from `members/me` first)*

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "DEPOSIT",
      "amount": 50000,
      "status": "COMPLETED",
      "description": "Mobile Money Deposit",
      "transactionDate": "2026-01-10T..."
    }
  ]
}
```

---

## 6. Institutional Operations

### Institutional Loan Application
**Endpoint:** 
**Auth:** Required (Institution Role)

**Body:**
```json
{
  "institutionId": "uuid",
  "loanProductId": "uuid",
  "amountApplied": 5000000,
  "purpose": "Business expansion",
  "repaymentPeriodMonths": 12,
  "collateralOffered": "Vehicle Logbook"
}
```

**Response:**
- Status: 201 Created
- Body: The created loan application object.

---

## 7. Email Notifications & Alerts
The following operations now automatically trigger email alerts to the member/institution:
- **Loan Application:** Confirmation of submission.
- **Loan Approval:** Confirmation and next steps.
- **Loan Disbursement:** Confirmation of funds credited.
- **Withdrawal:** OTP for verification and final confirmation alert.
- **Deposit:** Confirmation of funds received.
- **Repayment:** Confirmation of loan repayment.
