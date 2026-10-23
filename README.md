# BUKONZO SACCO — Mobile App

Member & Agent mobile app for Bukonzo United Teachers Cooperative Society.
Built with **Expo (React Native)** + **expo-router** + **NativeWind**.

The backend is a separate **Next.js** application serving the API at
`https://www.bukonzounitedteacherscooperativesociety.com`. This app is a pure
client — it holds no database and no business logic beyond input validation and
display.

---

## Prerequisites

- Node.js 20+
- `npm`
- An [Expo](https://expo.dev) account with access to the EAS project
  (`extra.eas.projectId` in `app.json`)
- For native builds: [EAS CLI](https://docs.expo.dev/eas/) — `npm i -g eas-cli`

## Local development

```bash
npm install
npx expo start          # then press "a" (Android) / "i" (iOS) / "w" (web)
```

There is no `.env` needed for the app to run — the API base URL is a constant in
`services/api.ts` (`API_URL`). See **Configuration** below if it must change.

## Configuration

| What | Where | Notes |
|---|---|---|
| API base URL | `services/api.ts` → `API_URL`, `services/uploadthing.ts` → `API_URL` | Same value in both. Change together. |
| App identifiers | `app.json` → `ios.bundleIdentifier`, `android.package` | `com.bukonzosacco.app` |
| Display name | `app.json` → `name` | "BUKONZO SACCO" |
| Version | `app.json` → `version`; build numbers auto-increment via EAS (`eas.json` → `appVersionSource: "remote"`) | |

### `.env`

`.env` is **git-ignored** and holds only the UploadThing token used by tooling.
The running app does **not** read it (the mobile UploadThing client only needs
the public endpoint URL). If you rotate the UploadThing key, update it in the
backend repo — not here.

## Auth model

- Login posts to the backend's NextAuth credentials endpoint. The **session
  cookie lives in the native cookie jar**, not in JS/SecureStore.
- Every mutating request also sends an `x-csrf-token` header, fetched from
  `/api/csrf-token` and refreshed automatically on a 403 (1-hour lifetime).
- On cold start the app calls `/api/auth/session` to check whether the cookie is
  still valid. **If members report being logged out on every launch, the native
  cookie jar is not persisting the session cookie** — that's the first thing to
  check on a device (see `HANDOVER.md`).
- Only `MEMBER` and `AGENT` roles can sign in.

## Payments

| Flow | Endpoint | Provider | Confirmation |
|---|---|---|---|
| Deposit | `POST /api/v1/members/me/mobile-money/deposit` | MTN MoMo | poll `POST /api/v1/momo/verify` |
| Loan repayment | `POST /api/v1/members/me/mobile-money/loan-repayment` | MTN MoMo | poll `POST /api/v1/momo/verify` |
| Withdrawal | `POST /api/v1/members/me/mobile-money/withdrawal` | Relworx (disbursement) | poll `POST /api/v1/relworx/verify` |

All three are **asynchronous** — a `success` on initiation only means the
request was accepted. `hooks/usePaymentPolling.ts` + `components/PaymentStatusSheet.tsx`
drive the wait-for-confirmation UX. This is **live production money** — no
sandbox. Test with small amounts on a phone you control.

See `docs/momo-mobile-implementation-plan.md` for the full contract.

## Builds

```bash
# Internal test APK
npm run build:android          # eas build -p android --profile preview

# Store builds (AAB / IPA)
eas build -p android --profile production
eas build -p ios --profile production
```

`eas.json` → `submit.production` has placeholder credentials — fill them in from
the client's Play Console and App Store Connect before `eas submit`.

## Project layout

```
app/                 expo-router screens (file = route)
  (tabs)/            member bottom-tab screens
  (agent-tabs)/      agent/teller bottom-tab screens
context/             AuthContext, ThemeContext
services/            api.ts (all backend calls), uploadthing.ts, types.ts
hooks/               usePaymentPolling, use-color-scheme
components/          shared UI
docs/                integration notes, privacy policy
```

## Handover

See **`HANDOVER.md`** for the outstanding items, required device testing, and
account/ownership transfers.
