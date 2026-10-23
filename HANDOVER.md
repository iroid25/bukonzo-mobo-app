# Handover Notes — BUKONZO SACCO Mobile App

Status of the app at handover, what was resolved, and what the client / web team
still needs to do.

---

## 1. Resolved in this pass

| Area | Change |
|---|---|
| **Withdrawals** | Repointed from the non-existent `/api/v1/mobile/withdraw` to the real `POST /api/v1/members/me/mobile-money/withdrawal` (Relworx disbursement). Added a phone-number field, `DataService.pollRelworxStatus()`, and the same wait-for-confirmation sheet used by deposits. No more false "funds have been sent" toast. |
| **Payment polling** | `useMomoPolling` → `usePaymentPolling` (provider-agnostic); `MomoApprovalSheet` → `PaymentStatusSheet` with a `withdrawal` variant. |
| **Session boot** | `AuthContext` no longer gates restore on a meaningless SecureStore string — it verifies the real cookie via `/api/auth/session` on every cold start. |
| **Fabricated data removed** | Profile screen: fake phone / NIN / address placeholders, hardcoded "Stanbic Bank ···· 4821", "Gold Member" badge, hardcoded "v2.4.2", non-functional "Change PIN" and always-on "Push Notifications" toggle. Dashboard: fake "Limit UGX 9.7M" and "Dividends". Backend-fabricated "loan score" of 95 dropped. Real fields (`phone`, `address`, `dateOfBirth`, `nationalId`, `memberNumber`, `membershipStatus`, `branch`) now mapped from `/api/v1/members/me`. |
| **App identity** | `app.json`: name → "BUKONZO SACCO", `android.package` / `ios.bundleIdentifier` → `com.bukonzosacco.app`, version codes added. |
| **Build config** | `eas.json`: added `production` profile (AAB + autoincrement) and `submit` placeholders. |
| **Cleanup** | Deleted Expo starter cruft (`modal.tsx`, `hello-wave`, `parallax-scroll-view`, `collapsible`, `themed-*`, `external-link`), removed `services/mockData.ts` + all `USE_MOCK_DATA` branches, gated `console.*` out of production bundles (babel). |
| **Docs** | Rewrote `README.md`; added `docs/privacy-policy.md` (draft) and this file. |
| **Secrets** | `.env` (contained a live UploadThing key) removed from git tracking and added to `.gitignore`; curl `cookies*.txt` dumps deleted. |

## 2. Client / account actions — REQUIRED before store submission

- [ ] **Rotate the UploadThing key.** The old `sk_live_…` key was committed to
      git history (commit `d744e93`) and must be considered compromised. Rotate
      it in the UploadThing dashboard and update the **backend** repo's env.
- [ ] **Transfer the EAS project.** `app.json` → `extra.eas.projectId`
      (`a5026888-915b-411c-ae3a-29bb5c56f284`) currently sits under the
      developer's Expo account. Transfer it to the client's Expo organisation,
      or re-run `eas init` under the client account.
- [ ] **Google Play** — create the app under the client's Play Console with
      package `com.bukonzosacco.app`, generate a service-account JSON, and put
      its path in `eas.json` → `submit.production.android`.
- [ ] **Apple** — create the App ID `com.bukonzosacco.app` and an App Store
      Connect record under the client's Apple Developer account; fill in
      `appleId` / `ascAppId` / `appleTeamId` in `eas.json`.
- [ ] **Host the privacy policy** (`docs/privacy-policy.md`, after legal review)
      at a public URL and update `SUPPORT_URL` / `PRIVACY_URL` in
      `app/(tabs)/profile.tsx`.
- [ ] **Confirm brand assets.** `assets/images/icon.png`, `splash-icon.png`,
      `adaptive-icon` and `favicon.png` — verify these are the final SACCO
      artwork, not placeholders. `sacco-logo.png/.jpg` is used on the splash.

## 3. Device testing — REQUIRED (no sandbox exists)

All mobile-money flows are **live MTN / Relworx production**. Test with small
real amounts on phones you control:

- [ ] **Deposit** end-to-end: initiate → approve on phone → success sheet →
      balance + "Deposit Successful" notification appear on the dashboard.
- [ ] **Loan repayment** end-to-end against a real loan (never exercised before).
- [ ] **Withdrawal** end-to-end (newly wired): initiate → money arrives on the
      phone → success sheet → balance decremented.
- [ ] Background the app mid-approval and return — polling should resume.
- [ ] **Cold-start session persistence** — kill the app fully, reopen. If the
      user is logged out, the native cookie jar is not persisting the NextAuth
      session cookie and needs a fix (e.g. `expo-secure-store`-backed cookie
      persistence, or a longer-lived token strategy from the backend).
- [ ] CSRF retry on a session left open > 1 hour.
- [ ] Profile photo upload on **both** iOS and Android.
- [ ] Agent flows: float balance, member search, assisted deposit/withdrawal,
      commissions.
- [ ] Password-reset OTP flow.

## 4. Backend items (web repo: `bukonzemergencys`)

- [x] **Loan-repayment notification** — added a `Notification` row on
      completion in `recordLoanRepaymentCompletion` for both
      `momo-payment.service.ts` and `relworx-payment.service.ts`, mirroring the
      deposit block. (Committed on a branch in that repo — review & merge.)
- [ ] **Real push notifications (FCM/APNs)** — still unbuilt. The app only
      writes/reads in-app `Notification` rows. A true push feature needs
      `expo-notifications` + device-token registration on mobile **and** a
      delivery path on the backend. Scope separately.
- [ ] **MoMo withdrawals** remain disabled server-side (MTN Disbursements not
      provisioned). Withdrawals go via Relworx. If MoMo disbursement is wanted,
      that's a backend + MTN onboarding task.

## 5. Known lower-priority gaps

- `app/index.tsx` onboarding slides load Lottie animations from remote
  `lottiefiles.com` URLs — bundle them locally or they'll fail offline / if the
  URLs rot.
- `components/ui/{Button,Card,Input}.tsx` are unused (kept as a starter design
  system — remove if not adopted).
- No automated tests.
