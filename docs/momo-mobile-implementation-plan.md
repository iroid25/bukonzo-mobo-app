# MTN MoMo — Mobile App Implementation

Deposits and loan repayments via MTN Mobile Money, against the web backend at
`bukonzounitedteacherscooperativesociety.com`. Source of truth for the contract:
the web repo's `docs/momo-mobile-integration-guide.md`.

## What the backend already provides

- `POST /api/csrf-token` → `{ csrfToken }` — dedicated endpoint for native clients.
  `services/api.ts` already fetches this and retries once on a 403/expiry.
- `POST /api/v1/members/me/mobile-money/deposit`
  body `{ amount, phoneNumber?, description?, accountId? }`
- `POST /api/v1/members/me/mobile-money/loan-repayment`
  body `{ loanId, amount, phoneNumber?, description? }`
- `POST /api/v1/momo/verify` body `{ referenceId }` →
  `{ success, status: "PENDING"|"SUCCESSFUL"|"FAILED", momo, processed }`

Initiation responses wrap the useful bits under `data`:
`{ success, provider:"MOMO", data:{ reference, referenceId, transactionId, status:"PENDING", message } }`

**`success: true` on initiation only means the approval prompt was pushed to the
phone.** Money has not moved until `verify` returns `SUCCESSFUL`. The app cannot
receive MTN's server-to-server callback, so polling `verify` is the only way it
learns the outcome.

## What was implemented in the app

| File | Change |
|---|---|
| `services/api.ts` | `depositFunds` now hits the real MoMo deposit endpoint and returns a normalized `MomoInitiation`. New `repayLoanMomo()` and `pollMomoStatus()`. New `isPlausibleUgandaMsisdn()` for client-side phone validation. |
| `hooks/useMomoPolling.ts` (new) | Drives the wait-for-approval loop: polls `verify` every 2s for 30s, then every 8s until 2min, then gives up (`timeout`). Re-polls immediately when the app returns to foreground. Exposes `{ phase, reason, start, reset }`. |
| `components/MomoApprovalSheet.tsx` (new) | Bottom-sheet modal rendering the `waiting / success / failed / timeout` states. Reused by deposit and repayment. |
| `app/deposit.tsx` | Member (non-assisted) path: validates phone, initiates, then opens the approval sheet and polls. On success → refresh + back. On failure/timeout → stay. Agent-assisted cash path unchanged. |
| `app/loan-repay.tsx` | New "Mobile Money / From Savings" toggle. MoMo mode shows a phone input and runs the approval sheet. From-Savings mode is the existing pay-from-balance flow. Amount is capped at the outstanding balance. |

## Notifications after a transaction

Per the web guide §2: the backend **automatically creates an in-app
`Notification` row** when a MoMo **deposit** completes (same DB transaction as
the ledger posting). Subject `"Deposit Successful"`, message includes amount,
new balance and ref. It is **not** a push notification — no banner when the app
is closed, just a row read via `GET /api/v1/notifications`.

- `GET /api/v1/notifications` returns `{ success, data: { data:[...], pagination, unreadCount } }`.
  `DataService.getNotifications()` unwraps this to `{ items, unreadCount, pagination }`.
  Each item: `{ id, type, subject, message, isRead, sentAt }`.
- `PUT /api/v1/notifications` `{ notificationId }` — mark one read (needs CSRF).
- `PUT /api/v1/notifications/mark-all-read` — mark all read (needs CSRF).
- The dashboard (`app/(tabs)/index.tsx`) now refreshes notifications + unread
  badge on screen focus, so the deposit notification shows the moment the member
  returns from the approval sheet.

**Gaps:**
- **Loan repayments do not create a notification** server-side
  (`recordLoanRepaymentCompletion` has no `notification.create`). If members
  should get one, the backend needs to add it — mirror the deposit block.
- **No real push notifications** (FCM/APNs). That's a separate, unbuilt feature:
  `expo-notifications` + device-token registration on mobile, plus a delivery
  path on the backend.

## Showing how a transaction was made (mobile money vs teller)

`GET /api/v1/transactions` returns `channel`, `paymentMethod`,
`externalReference`, `processedByUser {name, role}`, plus `deposit`/`withdrawal`
sub-objects with `channel`, `mobileMoneyRef`, `handler {name, role}`,
`depositorName` / `withdrawnByName`.

`deriveTransactionSource(t)` in `services/api.ts` collapses these into
`{ key, label, handledBy, reference }`:
- **Mobile Money** — `channel === "MOBILE_MONEY"`, `paymentMethod` in
  MOMO/RELWORX/…, or a `mobileMoneyRef`/`externalReference` is present.
- **Teller / Agent** — a staff user (`processedByUser.role` ≠ MEMBER) handled it,
  or `channel`/`paymentMethod` is CASH. Shows the handler's name.
  (A member's own self-service MoMo payment has `processedByUser.role === MEMBER`,
  so it is not misclassified as a teller transaction.)
- **Internal Transfer** / **Transaction** otherwise.

Both transaction mappers (`getTransactions`, and the list inside
`getUserProfile`) attach `source`. Shown as a chip in `app/transactions.tsx` and
a short label in the dashboard's recent-activity list.

## Financial Ledger "Money In / Money Out" totals

The old `calculateTotals` in `app/transactions.tsx` was wrong on three counts:
1. It filtered on `t.type` values (`'LOAN'`, `'INTEREST'`, `'REPAYMENT'`,
   `'SERVICE_FEE'`) that **don't exist** — the mapper collapses `type` to only
   `DEPOSIT`/`WITHDRAWAL`, and none of those enum names are real. Net effect:
   "Total In" only ever summed `DEPOSIT` rows and "Total Out" summed *everything
   else* (loan disbursements — money in — included as out).
2. **No status filter** — `PENDING` / `FAILED` / `REVERSED` transactions counted.
   A failed MoMo deposit inflated "Total In".
3. Loan disbursements (money the member receives) were counted as outflow.

Fixed with helpers in `services/api.ts`:
- `transactionDirection(rawType)` → `IN` (`DEPOSIT`, `LOAN_DISBURSEMENT`) /
  `OUT` (`WITHDRAWAL`, `LOAN_REPAYMENT`, `FEE`, `LOAN_FEE`, `INSURANCE_PREMIUM`,
  `SHARES_PURCHASE`) / `NEUTRAL` (`TRANSFER`, `OTHER`, `FLOAT_*`).
- `isRealizedTransaction(status)` → `COMPLETED` or `APPROVED` only (matches the
  backend's own `{ in: [COMPLETED, APPROVED] }` convention for money aggregates).
- `sumTransactionFlows(txns)` → `{ totalIn, totalOut }`.

The mapper now also keeps `rawType` (the untouched enum). Filters and the
row +/- sign use `transactionDirection`. The cards are relabelled **"Money In ·
Recent" / "Money Out · Recent"** because they only cover the loaded page
(now 50 rows, was 20) — they are not lifetime totals. A true lifetime figure
would need a dedicated backend aggregate endpoint.

**Day grouping + detail popup.** The ledger is a `SectionList` grouped by day
(`Today` / `Yesterday` / `12 August`), each row showing the transaction *time*.
Tapping a row opens `components/TransactionDetailSheet.tsx` — amount, type,
date+time, method, account, branch, account holder, handler ("MTN Mobile Money"
for MoMo), fee, reference, provider ref, note, and **balance before / after**.

Balance before/after is not exposed by any member API (`Transaction` has no such
field; `SavingsTransaction.balanceBefore/After` isn't surfaced). It's derived
client-side by `attachRunningBalances(txns, accounts)` in `services/api.ts`:
per account, walk the realized history backward from the *current* balance,
applying `accountEffect` per row (`+amount` deposit/disbursement, `-amount`
withdrawal/fee/shares, `0` for a MoMo loan repayment — phone-funded, savings
untouched, `null` = stop). Rows past an ambiguous step get no balance shown.

**Only settled transactions are shown.** The member Financial Ledger
(`app/transactions.tsx`) and the dashboard "Recent Transactions" list filter to
`isRealizedTransaction` (`COMPLETED` / `APPROVED`) — a `PENDING`, `FAILED` or
`REVERSED` row (e.g. a MoMo prompt the member never approved) is hidden, not
just excluded from totals. Agent/teller screens are unchanged (they still see
in-flight transactions).

## Phone number format

Send whatever the member types — the backend normalizes to `2567XXXXXXXX`.
`isPlausibleUgandaMsisdn` only does a cheap shape check (`07XXXXXXXX`,
`+2567XXXXXXXX`, `2567XXXXXXXX`) for fast feedback.

## Open items / verification

1. **Live MTN production, no sandbox.** Test with small real amounts on an MTN
   phone you control.
2. Loan repayment via MoMo has the identical backend code shape to deposits but,
   per the web team's notes, had not been exercised against a real loan. Confirm
   end-to-end.
3. The old `depositFunds` pointed at `/api/v1/mobile/deposit` and `withdrawFunds`
   at `/api/v1/mobile/withdraw` — neither exists as a route file in the web repo.
   Withdrawals still use the old path; confirm whether that flow currently works.
4. CSRF cookie lifetime is 1h — verify the retry path on a long-lived session.
5. Test backgrounding the app mid-approval and returning.
