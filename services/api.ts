import axios from 'axios';
import { UserData } from './types';

const API_URL = 'https://www.bukonzounitedteacherscooperativesociety.com';
const MUTATING_METHODS = ['post', 'put', 'patch', 'delete'];

// The session itself lives in the platform's real cookie jar (native
// networking on iOS/Android, or the browser in the Expo web preview) - both
// honor Set-Cookie automatically when requests are made with credentials
// included, which is far more reliable than trying to read the Set-Cookie
// response header from JS (it's a forbidden header in fetch/XHR and native
// RN often can't see it either). We only need to separately track the CSRF
// token, since the backend requires it as an explicit request header
// (x-csrf-token) for any mutating call that isn't a same-origin browser
// request - see lib/csrf.ts on the backend.
let csrfTokenCache: string | null = null;

const getCsrfToken = async (): Promise<string> => {
  if (csrfTokenCache) return csrfTokenCache;
  const res = await fetch(`${API_URL}/api/csrf-token`, { credentials: 'include' });
  const data = await res.json();
  csrfTokenCache = data.csrfToken;
  return csrfTokenCache as string;
};

// ---- MTN MoMo helpers -------------------------------------------------------

export type MomoStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';

export type MomoInitiation = {
  referenceId: string | null;   // MTN's UUID - the handle used for polling
  transactionId: string | null; // internal Transaction.id
  reference: string | null;     // internal transactionRef (MOMO-...)
  status: MomoStatus;
  message: string;
};

export type MomoStatusResult = {
  // Effective status: 'SUCCESSFUL' ONLY once the backend has actually posted the
  // deposit to the ledger. MTN reporting the payment as SUCCESSFUL is not enough.
  status: MomoStatus;
  // Raw status MTN's GetStatus reported, before we cross-check the posting.
  mtnStatus: MomoStatus;
  // The backend confirmed the ledger entry + balance update (and, for deposits,
  // the in-app notification) actually happened.
  posted: boolean;
  reason: string | null;
  raw: any;
};

// The initiation endpoints wrap the useful bits under `data`. Pull them up and
// give callers a stable shape regardless of minor backend response drift.
const normalizeMomoInitiation = (body: any): MomoInitiation => {
  const d = body?.data || body || {};
  return {
    referenceId: d.referenceId ?? null,
    transactionId: d.transactionId ?? null,
    reference: d.reference ?? null,
    status: (d.status || 'PENDING') as MomoStatus,
    message: d.message || 'Please approve the payment request on your phone',
  };
};

// Member self-service withdrawals go out over Relworx (MTN MoMo Disbursements
// aren't provisioned for this SACCO — see the web repo's
// docs/momo-mobile-integration-guide.md §"Withdrawals"). Relworx's initiation
// response nests `internal_reference` (the handle used to poll /relworx/verify)
// rather than MTN's `referenceId`. Map it onto the same shape so the UI can
// treat deposit / repayment / withdrawal identically.
const normalizeRelworxInitiation = (body: any): MomoInitiation => {
  const d = body?.data || body || {};
  const pollHandle = d.internal_reference ?? d.internalReference ?? d.transactionId ?? null;
  return {
    referenceId: pollHandle,
    transactionId: d.transactionId ?? null,
    reference: d.reference ?? null,
    status: (String(d.status || 'PENDING').toUpperCase() as MomoStatus),
    message: d.message || 'Your withdrawal is being sent to your phone',
  };
};

// ---- Transaction source ("how did this money move?") -----------------------

export type TxnSourceKey = 'MOBILE_MONEY' | 'TELLER' | 'AGENT' | 'INTERNAL' | 'OTHER';

export type TxnSource = {
  key: TxnSourceKey;
  label: string;          // "Mobile Money" | "Teller" | "Agent" | "Internal Transfer"
  handledBy?: string | null; // staff/agent name, when a person processed it
  reference?: string | null; // MoMo ref / provider payment reference
};

const STAFF_ROLES = [
  'TELLER', 'CASHIER', 'AGENT', 'BRANCHMANAGER', 'BRANCH_MANAGER',
  'ACCOUNTANT', 'ADMIN', 'MANAGER', 'LOANOFFICER', 'LOAN_OFFICER',
];

// The /api/v1/transactions rows carry channel / paymentMethod / processedByUser
// / deposit.handler etc. Collapse all of that into one "where did this come
// from" descriptor so the app can show whether a transaction was done over
// mobile money or handled by a teller/agent at a branch.
export const deriveTransactionSource = (t: any): TxnSource => {
  const pm = String(t?.paymentMethod || '').toUpperCase();
  const channel = String(
    t?.channel || t?.deposit?.channel || t?.withdrawal?.channel || '',
  ).toUpperCase();
  const momoRef =
    t?.deposit?.mobileMoneyRef || t?.withdrawal?.mobileMoneyRef || t?.externalReference || null;
  const handler = t?.processedByUser || t?.deposit?.handler || t?.withdrawal?.handler || null;
  const handlerRole = String(handler?.role || '').toUpperCase();
  // A member processing their own self-service MoMo payment shows up as
  // processedByUser with role MEMBER - that is NOT a teller transaction.
  const handledByStaff = !!handler && handlerRole !== '' && handlerRole !== 'MEMBER';

  const isMobileMoney =
    channel === 'MOBILE_MONEY' ||
    ['MOMO', 'RELWORX', 'MOBILE_MONEY', 'MOBILE', 'MTN', 'AIRTEL'].includes(pm) ||
    !!momoRef;

  if (isMobileMoney) {
    return {
      key: 'MOBILE_MONEY',
      label: 'Mobile Money',
      handledBy: null,
      reference: momoRef || t?.paymentReference || null,
    };
  }

  if (handledByStaff || channel === 'CASH' || pm === 'CASH' || STAFF_ROLES.includes(handlerRole)) {
    const isAgent = handlerRole === 'AGENT';
    return {
      key: isAgent ? 'AGENT' : 'TELLER',
      label: isAgent ? 'Agent' : 'Teller',
      handledBy:
        handler?.name ||
        t?.deposit?.depositorName ||
        t?.withdrawal?.withdrawnByName ||
        null,
      reference: t?.paymentReference || null,
    };
  }

  if (['INTERNAL', 'TRANSFER', 'INTERNAL_TRANSFER'].includes(channel) || pm === 'INTERNAL') {
    return { key: 'INTERNAL', label: 'Internal Transfer' };
  }

  return { key: 'OTHER', label: 'Transaction' };
};

// ---- Transaction direction & totals ---------------------------------------
//
// Backend TransactionType enum (prisma/schema.prisma):
//   DEPOSIT, WITHDRAWAL, LOAN_DISBURSEMENT, LOAN_REPAYMENT, FLOAT_ALLOCATION,
//   FLOAT_PURCHASE, FLOAT_RECONCILIATION, FEE, OTHER, TRANSFER, SHARES_PURCHASE,
//   INSURANCE_PREMIUM, LOAN_FEE
// Status enum: PENDING, COMPLETED, FAILED, REVERSED, APPROVED
//
// The mapped `type` field is collapsed to DEPOSIT/WITHDRAWAL for icon logic -
// use `rawType` (the untouched enum value) for any money-direction maths.

export type TxnDirection = 'IN' | 'OUT' | 'NEUTRAL';

// Money the member received / that grew their holdings.
export const TXN_IN_TYPES = ['DEPOSIT', 'LOAN_DISBURSEMENT'];
// Money the member paid out / that reduced their holdings.
export const TXN_OUT_TYPES = [
  'WITHDRAWAL', 'LOAN_REPAYMENT', 'FEE', 'LOAN_FEE', 'INSURANCE_PREMIUM', 'SHARES_PURCHASE',
];
// TRANSFER / OTHER / FLOAT_* have no reliable member-facing direction - left
// out of both totals rather than guessed.

export const transactionDirection = (rawType?: string): TxnDirection => {
  const t = String(rawType || '').toUpperCase();
  if (TXN_IN_TYPES.includes(t)) return 'IN';
  if (TXN_OUT_TYPES.includes(t)) return 'OUT';
  return 'NEUTRAL';
};

// Member-facing label for a transaction. The backend enum has no MONTHLY_FEE
// type - recurring charges arrive as FEE (or OTHER) with a description - so
// generic FEE entries are disambiguated via the description before we ever
// fall back to a hard-coded "Withdrawal Fee".
export const transactionLabel = (rawType?: string, description?: string): string => {
  const rt = String(rawType || '').toUpperCase();
  const desc = String(description || '').toLowerCase();
  if (rt === 'DEPOSIT') return 'Deposit';
  if (rt === 'WITHDRAWAL') return 'Withdrawal';
  if (rt === 'LOAN_REPAYMENT') return 'Loan Repayment';
  if (rt === 'LOAN_DISBURSEMENT') return 'Loan Disbursement';
  if (rt === 'LOAN_FEE') return 'Loan Fee';
  if (rt === 'SHARES_PURCHASE') return 'Shares Purchase';
  if (rt === 'INSURANCE_PREMIUM') return 'Insurance Premium';
  if (rt === 'TRANSFER' || rt === 'INTERNAL_TRANSFER') return 'Transfer';
  if (rt.includes('INTEREST')) return 'Interest Credit';
  if (rt === 'FEE' || rt === 'WITHDRAWAL_FEE' || rt === 'OTHER') {
    if (desc.includes('monthly') || desc.includes('month-end') || desc.includes('maintenance') || desc.includes('subscription')) return 'Monthly Charge';
    if (desc.includes('withdraw')) return 'Withdrawal Fee';
    if (desc.includes('deposit')) return 'Deposit Fee';
    if (desc.includes('loan')) return 'Loan Fee';
    if (desc.includes('insurance')) return 'Insurance Premium';
    if (rt === 'WITHDRAWAL_FEE') return 'Withdrawal Fee';
    if (rt === 'FEE') return 'Fee';
    return 'Transaction';
  }
  return String(rawType || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || 'Transaction';
};

// Only settled transactions represent money that actually moved. A PENDING or
// FAILED MoMo deposit, or a REVERSED entry, must not count toward totals - this
// mirrors the backend's own "summary counts COMPLETED only" rule.
export const isRealizedTransaction = (status?: string): boolean =>
  ['COMPLETED', 'APPROVED'].includes(String(status || '').toUpperCase());

// One shape for a transaction everywhere in the app. Both the ledger list and
// the dashboard "recent" list run rows through this so the detail popup can
// rely on the fields being present.
export const mapTransaction = (t: any) => {
  const rawType = t?.type;
  const when = t?.transactionDate || t?.valueDate || t?.createdAt || null;
  const acct = t?.account || {};
  const ownerUser = t?.member?.user || t?.institution?.user || {};
  return {
    id: t?.id,
    type: rawType === 'DEPOSIT' ? 'DEPOSIT' : 'WITHDRAWAL', // legacy icon logic
    rawType,
    amount: Number(t?.amount) || 0,
    fee: Number(t?.fee ?? t?.withdrawal?.fee ?? 0) || 0,
    currency: t?.currency || 'UGX',
    status: t?.status,
    description: t?.description || t?.notes || 'Transaction',
    note: t?.notes || null,
    // Human strings
    date: when ? new Date(when).toLocaleDateString() : '',
    dateISO: when ? new Date(when).toISOString() : null,
    // Where it hit
    accountId: t?.accountId || acct?.id || null,
    accountName: acct?.accountType?.name || acct?.accountType || null,
    accountNumber: acct?.accountNumber || null,
    branchName: acct?.branch?.name || null,
    // References
    reference: t?.transactionRef || null,
    providerRef:
      t?.paymentReference ||
      t?.deposit?.mobileMoneyRef ||
      t?.withdrawal?.mobileMoneyRef ||
      t?.externalReference ||
      null,
    loanId: t?.loanId || null,
    // Parties
    ownerName: t?.member?.name || ownerUser?.name || null,
    ownerPhone: ownerUser?.phone || null,
    ownerImage: t?.member?.image || t?.member?.user?.image || null,
    memberNumber: t?.member?.memberNumber || null,
    counterpartyName:
      t?.processedByUser?.name ||
      t?.deposit?.handler?.name ||
      t?.withdrawal?.handler?.name ||
      t?.deposit?.depositorName ||
      t?.withdrawal?.withdrawnByName ||
      null,
    counterpartyRole:
      t?.processedByUser?.role ||
      t?.deposit?.handler?.role ||
      t?.withdrawal?.handler?.role ||
      null,
    handledById:
      t?.processedByUser?.id ||
      t?.deposit?.handler?.id ||
      t?.withdrawal?.handler?.id ||
      null,
    handlerName:
      t?.processedByUser?.name ||
      t?.deposit?.handler?.name ||
      t?.withdrawal?.handler?.name ||
      null,
    source: deriveTransactionSource(t),
  };
};

// True when a ledger row was actually handled by this agent. `getTransactions()`
// returns the backend's session-scoped ledger, so the commission and the agent
// ledger must NOT credit/display rows the logged-in agent did not process -
// otherwise an agent sees (and is paid for) work another agent/teller did.
export const isAgentProcessedTxn = (
  t: any,
  agent?: { id?: string | null; name?: string | null } | null,
): boolean => {
  if (String(t?.counterpartyRole || '').toUpperCase() !== 'AGENT') return false;
  const handledByName =
    t?.handlerName || t?.counterpartyName || t?.source?.handledBy || null;
  if (agent?.id && t?.handledById) {
    return String(t.handledById) === String(agent.id);
  }
  if (agent?.name && handledByName) {
    return String(handledByName).toLowerCase() === String(agent.name).toLowerCase();
  }
  // Marked as agent-processed but can't be tied to this specific agent.
  return false;
};

// How a transaction changed the balance of *its own account*. Only DEPOSIT /
// WITHDRAWAL and a few unambiguous types move a savings-account balance; a MoMo
// loan repayment, for instance, is paid from the phone and never touches the
// savings account. `null` = we can't say, so the running-balance walk stops.
const accountEffect = (t: any): number | null => {
  const rt = String(t?.rawType || '').toUpperCase();
  const amt = Math.abs(Number(t?.amount) || 0);
  if (rt === 'DEPOSIT' || rt === 'LOAN_DISBURSEMENT') return amt;
  if (['WITHDRAWAL', 'FEE', 'LOAN_FEE', 'SHARES_PURCHASE', 'INSURANCE_PREMIUM'].includes(rt)) return -amt;
  if (rt === 'LOAN_REPAYMENT') return t?.source?.key === 'MOBILE_MONEY' ? 0 : -amt;
  return null;
};

// Attach `balanceBefore` / `balanceAfter` to each transaction by walking each
// account's history backward from its *current* balance. Exact for every step
// we can account for; leaves the fields undefined once a step is ambiguous or
// the account's current balance is unknown.
export const attachRunningBalances = (
  txns: any[],
  accounts: { id: string; balance: number }[],
) => {
  const balByAccount = new Map(accounts.map(a => [a.id, Number(a.balance) || 0]));
  const byAccount = new Map<string, any[]>();
  for (const t of txns) {
    if (!t.accountId || !isRealizedTransaction(t.status)) continue;
    if (!byAccount.has(t.accountId)) byAccount.set(t.accountId, []);
    byAccount.get(t.accountId)!.push(t);
  }
  for (const [accountId, list] of byAccount) {
    if (!balByAccount.has(accountId)) continue;
    // newest first
    list.sort((a, b) => new Date(b.dateISO || 0).getTime() - new Date(a.dateISO || 0).getTime());
    let running = balByAccount.get(accountId)!;
    let broken = false;
    for (const t of list) {
      if (broken) continue;
      const effect = accountEffect(t);
      if (effect === null) { broken = true; continue; }
      t.balanceAfter = running;
      t.balanceBefore = running - effect;
      running = t.balanceBefore;
    }
  }
  return txns;
};

// Sum realized inflow / outflow over a list of mapped transactions.
export const sumTransactionFlows = (txns: any[]) => {
  let totalIn = 0;
  let totalOut = 0;
  for (const t of txns || []) {
    if (!isRealizedTransaction(t?.status)) continue;
    const dir = transactionDirection(t?.rawType);
    const amt = Math.abs(Number(t?.amount) || 0);
    if (dir === 'IN') totalIn += amt;
    else if (dir === 'OUT') totalOut += amt;
  }
  return { totalIn, totalOut };
};

// Client-side sanity check only - fast feedback before we bother the backend.
// The server does the authoritative normalization/validation.
export const isPlausibleUgandaMsisdn = (raw: string): boolean => {
  const digits = (raw || '').replace(/[^\d]/g, '');
  // 07XXXXXXXX (10) | 2567XXXXXXXX (12) | 7XXXXXXXX (9)
  if (/^0\d{9}$/.test(digits)) return true;
  if (/^256\d{9}$/.test(digits)) return true;
  if (/^\d{9}$/.test(digits)) return true;
  return false;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  // Fail fast on flaky mobile networks instead of hanging forever; React
  // Query then serves the persisted cache and retries in the background.
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  if (MUTATING_METHODS.includes((config.method || '').toLowerCase())) {
    config.headers['x-csrf-token'] = await getCsrfToken();
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // The CSRF cookie expires after an hour; if we hit that, grab a fresh
    // token and retry the request once rather than surfacing a spurious
    // auth failure to the user.
    const isStaleCsrf = error.response?.status === 403
      && error.response?.data?.error === 'CSRF token missing or invalid'
      && !error.config?._csrfRetried;
    if (isStaleCsrf) {
      csrfTokenCache = null;
      error.config._csrfRetried = true;
      error.config.headers['x-csrf-token'] = await getCsrfToken();
      return api.request(error.config);
    }

    if (error.response?.status !== 403 && error.response?.status !== 401) {
        if (!error.response) {
          // No response at all: offline, DNS failure, timeout or server blip.
          // Environmental, not a code bug - warn quietly; the UI keeps showing
          // cached data and React Query retries.
          console.warn(`API unreachable (${error.config?.url}): ${error.message}`);
        } else {
          console.error('API Error:', {
            url: error.config?.url,
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
          });
        }
    } else {
        console.warn(`Auth ${error.response?.status} for ${error.config?.url}`);
    }
    return Promise.reject(error);
  }
);

export const DataService = {
  login: async (email: string, password: string) => {
      try {
        // 1. Get CSRF Token - credentials included so the pairing csrf-token
        // cookie the server sets is stored in the real cookie jar.
        const csrfRes = await fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include' });
        const csrfData = await csrfRes.json();
        const csrfToken = csrfData.csrfToken;

        // 2. Login (form-urlencoded, matching NextAuth's credentials flow).
        // credentials: 'include' is what makes the resulting session cookie
        // actually get stored by the platform cookie jar.
        const params = new URLSearchParams();
        params.append('identifier', email);
        params.append('password', password);
        params.append('redirect', 'false');
        params.append('json', 'true');
        params.append('csrfToken', csrfToken);

        const loginRes = await fetch(`${API_URL}/api/auth/callback/credentials`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        const loginData = await loginRes.json();

        if (loginData?.url && loginData.url.includes('csrf=true')) {
          throw new Error('Session expired. Please try again.');
        }
        if (loginData?.url && loginData.url.includes('error=')) {
          const errorMatch = loginData.url.match(/error=([^&]+)/);
          const errorMsg = errorMatch ? decodeURIComponent(errorMatch[1]) : 'Login failed';
          throw new Error(errorMsg);
        }

        // 3. Fetch session to confirm login and get the user profile.
        const sessionRes = await fetch(`${API_URL}/api/auth/session`, { credentials: 'include' });
        const sessionData = await sessionRes.json();
        const user = sessionData?.user;

        if (!user) {
          throw new Error('Login succeeded but could not load user profile. Please try again.');
        }

        // Reset the CSRF cache so the next mutating request fetches a fresh
        // token tied to this new session.
        csrfTokenCache = null;

        return { user, token: 'session-active' };
      } catch (error: any) {
        if (error.response?.data?.url?.includes('error=')) {
          const errorMatch = error.response.data.url.match(/error=([^&]+)/);
          const errorMsg = errorMatch ? decodeURIComponent(errorMatch[1]) : 'Login failed';
          throw new Error(errorMsg);
        }
        console.warn('Detailed Login Error:', error.message || error);
        throw error;
      }
  },

  logout: async () => {
    try {
      const csrfRes = await fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include' });
      const { csrfToken } = await csrfRes.json();
      await fetch(`${API_URL}/api/auth/signout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrfToken, json: 'true' }).toString(),
      });
    } catch (e) {
      console.warn('Signout request failed (clearing local session anyway):', e);
    } finally {
      csrfTokenCache = null;
    }
  },

  getUserProfile: async () => {
    try {
        // Fire all four sub-requests in parallel instead of chaining them in
        // series. Each is resilient on its own, so a single slow endpoint can
        // no longer hold up the whole dashboard - we wait for the slowest one
        // (~1 round-trip) rather than the sum of four.
        const [meRes, accountsRes, loansRes] = await Promise.all([
          api.get('/api/v1/members/me').catch((e: any) => {
            if (e.response?.status !== 403) console.warn("Member Profile Fetch Failed:", e);
            else console.warn("Member profile restricted (403)");
            return null;
          }),
          api.get('/api/v1/accounts/my-account').catch((e: any) => {
            console.warn("Accounts Fetch Failed (likely role issue):", e.response?.status);
            return null;
          }),
          api.get('/api/v1/loans/my-loans?limit=5').catch((e: any) => {
            console.warn("Loans Fetch Failed (likely role issue):", e.response?.status);
            return null;
          }),
        ]);

        const me = meRes?.data?.data || meRes?.data || null;

        // Accounts (resilient)
        let accounts = [];
        try {
            const accountsData = accountsRes?.data?.data || accountsRes?.data;
            const maybeAccounts = accountsData?.accounts || accountsData;
            accounts = Array.isArray(maybeAccounts) ? maybeAccounts : [];
        } catch { /* already null-guarded */ }

        // Loans (resilient)
        let loans = [];
        try {
            const loansData = loansRes?.data?.data || loansRes?.data;
            const maybeLoans = loansData?.loans || loansData;
            loans = Array.isArray(maybeLoans) ? maybeLoans : [];
        } catch { /* already null-guarded */ }

        // Transactions depend on the member id (only known after /members/me).
        const memberId = me?.member?.id;
        let transactions = [];
        if (memberId) {
            try {
                const tRes = await api.get(`/api/v1/transactions?limit=30&memberId=${memberId}`);
                transactions = (tRes.data?.data || [])
                    .filter((t: any) => isRealizedTransaction(t.status))
                    .map(mapTransaction);
            } catch (e) {
                console.warn("Transactions Fetch Failed:", e);
            }
        }

        // Derive balance-before / balance-after per transaction from the known
        // current account balances.
        try {
            attachRunningBalances(transactions, accounts as any);
        } catch (e) {
            console.warn("Running balance calc failed:", e);
        }

        // Shape into UserData. `/api/v1/members/me` returns the KYC fields under
        // `data.member` - surface them so the profile screen shows real values
        // (or an honest "Not set"), never invented placeholders.
        const m = me?.member || {};
        const profileData: UserData = {
            name: m.name || 'Sacco Member',
            email: m.email || '',
            memberId: m.id,
            memberNumber: m.memberNumber ?? null,
            membershipStatus: m.membershipStatus ?? null,
            phone: m.phone ?? null,
            address: m.address ?? null,
            dateOfBirth: m.dateOfBirth ?? null,
            nin: m.nationalId ?? null,
            branchName: m.branch?.name ?? null,
            totalBalance: me?.totalBalance || 0,
            accounts: accounts.map((a: any) => ({
                id: a.id,
                title: a.accountType || 'Savings Account',
                accNo: a.accountNumber,
                balance: a.balance,
                type: a.accountType || 'SAVINGS'
            })),
            transactions,
            activeLoan: loans.length > 0 ? {
                type: loans[0].loanProduct?.name || 'Loan',
                amount: loans[0].amountGranted || 0,
                outstanding: loans[0].outstandingBalance || 0,
                nextPaymentDate: loans[0].nextPaymentDate || 'N/A',
                nextPaymentAmount: loans[0].installments?.[0]?.amount || 0,
                progress: loans[0].amountGranted > 0 ? (1 - (loans[0].outstandingBalance / loans[0].amountGranted)) : 0
            } : undefined,
            image: m.image || me?.image,
            joinedDate: m.joinDate || m.createdAt || m.joinedDate,
            loanStats: {
                repaidCount: loans.filter((l: any) => ['PAID_OFF', 'CLOSED', 'REPAID'].includes(l.status)).length,
            }
        };

        return { data: profileData };

    } catch (error: any) {
        if (error.response?.status !== 403) {
            console.warn("Critical Aggregation Failure:", error);
        }
        throw error;
    }
  },

  getTransactions: async (memberId?: string, limit: number = 50) => {
    // Use the member ID if passed, or allow backend to infer from session
    // Agents/Tellers should only see their own transactions by default if no memberId is provided
    const res = await api.get(`/api/v1/transactions?limit=${limit}${memberId ? `&memberId=${memberId}` : ''}`);
    const rawData = res.data.data || [];

    return { data: rawData.map(mapTransaction) };
  },

  // MTN MoMo deposit. Returns a normalized initiation result - a success here
  // only means the approval prompt was pushed to the member's phone; the money
  // has NOT moved until pollMomoStatus() reports SUCCESSFUL. See
  // docs/momo-mobile-implementation-plan.md.
  depositFunds: async (amount: number, phone: string, accountId?: string, description?: string): Promise<MomoInitiation> => {
    const res = await api.post('/api/v1/members/me/mobile-money/deposit', {
        amount: Number(amount),
        phoneNumber: phone,
        ...(accountId ? { accountId } : {}),
        description: description || 'SACCO Savings Deposit',
    });
    return normalizeMomoInitiation(res.data);
  },

  // MTN MoMo loan repayment. Same PENDING/poll contract as depositFunds.
  repayLoanMomo: async (params: { loanId: string; amount: number; phoneNumber: string; description?: string }) => {
    const res = await api.post('/api/v1/members/me/mobile-money/loan-repayment', {
        loanId: params.loanId,
        amount: Number(params.amount),
        phoneNumber: params.phoneNumber,
        description: params.description || `Loan Repayment #${params.loanId}`,
    });
    return normalizeMomoInitiation(res.data);
  },

  // Forces a live MTN status check for one transaction and resolves the ledger
  // server-side if MTN reports SUCCESSFUL. Safe to call repeatedly (idempotent).
  pollMomoStatus: async (referenceId: string): Promise<MomoStatusResult> => {
    const res = await api.post('/api/v1/momo/verify', { referenceId });
    const d = res.data || {};
    const mtnStatus = (d.status || 'PENDING') as MomoStatus;

    // `d.processed` is the result of the backend actually posting the deposit
    // (ledger entry + balance increment + "Deposit Successful" notification).
    // handleWebhook can return { ok:false, ignored:true } WITHOUT throwing -
    // missing externalId on MTN's echo, amount mismatch, txn not found - in
    // which case MTN says SUCCESSFUL but nothing has landed. Only trust a
    // success once `processed` confirms it.
    const p = d.processed || {};
    const processedState = String(p.status || '').toUpperCase();
    const posted =
      p.ok === true &&
      (p.alreadyProcessed === true ||
        processedState === 'SUCCESS' ||
        processedState === 'COMPLETED' ||
        processedState === 'APPROVED');
    const processedFailed =
      processedState === 'FAILED' || processedState === 'REVERSED';

    const reason =
      d.momo?.reason?.message || d.momo?.reason || p.message || d.error || null;

    let status: MomoStatus;
    if (mtnStatus === 'FAILED' || processedFailed) {
      status = 'FAILED';
    } else if (mtnStatus === 'SUCCESSFUL' && posted) {
      status = 'SUCCESSFUL';
    } else {
      // MTN still PENDING, or SUCCESSFUL-but-not-yet-posted: keep waiting.
      status = 'PENDING';
    }

    return { status, mtnStatus, posted, reason, raw: d };
  },

  // Member self-service mobile-money withdrawal (Relworx disbursement). Like a
  // deposit this is async: `success` only means Relworx accepted the payout
  // request — the money isn't in the member's wallet until pollRelworxStatus()
  // reports SUCCESSFUL. No phone approval/PIN step (it's a disbursement, not a
  // collection). `accountId` is ignored server-side — the backend always debits
  // the member's Voluntary Savings account.
  withdrawFunds: async (amount: number, phone: string, description?: string): Promise<MomoInitiation> => {
    const res = await api.post('/api/v1/members/me/mobile-money/withdrawal', {
        amount: Number(amount),
        phoneNumber: phone,
        description: description || 'SACCO Savings Withdrawal',
    });
    return normalizeRelworxInitiation(res.data);
  },

  // Agent/teller cash withdrawal — records a disbursement in the ledger directly
  // (no mobile money leg). Kept separate from the member flow above.
  // (see tellerWithdraw below for the agent-assisted path)

  // Forces a live Relworx status check for one withdrawal and resolves the
  // ledger server-side once Relworx confirms the payout. Safe to call
  // repeatedly. Normalized to the same {status} contract as pollMomoStatus.
  pollRelworxStatus: async (internalReference: string): Promise<MomoStatusResult> => {
    const res = await api.post('/api/v1/relworx/verify', { internalReference });
    const d = res.data || {};
    // Relworx reports lowercase: "success" | "failed" | "pending".
    const raw = String(d.status || d.relworx?.status || 'pending').toLowerCase();
    const processedState = String(d.processed?.status || '').toLowerCase();
    const failed = raw === 'failed' || processedState === 'failed';
    const succeeded =
      raw === 'success' &&
      (d.processed?.ok === true ||
        processedState === 'success' ||
        processedState === 'completed');

    let status: MomoStatus;
    if (failed) status = 'FAILED';
    else if (succeeded) status = 'SUCCESSFUL';
    else status = 'PENDING';

    const reason =
      d.relworx?.message || d.processed?.message || d.error || d.message || null;

    return {
      status,
      mtnStatus: status, // no separate provider/ledger split for Relworx
      posted: status === 'SUCCESSFUL',
      reason,
      raw: d,
    };
  },

  applyLoan: async (data: any) => {
      return api.post('/api/v1/loans/applications', data);
  },

  getMyLoans: async () => {
      return api.get('/api/v1/loans/my-loans');
  },

  getMemberLoans: async (memberId: string) => {
      return api.get(`/api/v1/loans?memberId=${memberId}`);
  },

  getLoanSchedule: async (loanId: string) => {
      return api.get(`/api/v1/loans/${loanId}/schedule`);
  },

  repayLoan: async (data: { loanId: string; amount: number; accountId: string }) => {
      return api.post('/api/v1/loans/repay', data);
  },

  updateProfile: async (profileData: {
    email: string;
    nin: string;
    surname: string;
    otherNames: string;
    dateOfBirth: string;
    gender: string;
    maritalStatus: string;
    occupation?: string;
    citizenship?: string;
    address: string;
    phone: string;
    nokName: string;
    nokRelationship?: string;
    nokPhone: string;
    image?: string;
  }) => {
    return api.post('/api/profile/update', profileData);
  },

  getProfileStatus: async () => {
    return api.get('/api/profile/status');
  },

  forgotPassword: async (email: string) => {
    return api.post('/api/v1/mobile/auth/forgot-password', { email });
  },

  verifyOtp: async (email: string, otp: string) => {
    return api.post('/api/v1/mobile/auth/verify-otp', { email, otp });
  },

  resetPassword: async (email: string, otp: string, newPassword: string) => {
    return api.post('/api/v1/mobile/auth/reset-password', { email, otp, newPassword });
  },

  // Agent / Teller Specific
  getFloatBalance: async () => {
    return api.get('/api/v1/user-float');
  },

  getFloatTransactions: async () => {
    return api.get('/api/v1/user-float');
  },

  // Resolve the agent float balance out of whatever the backend nests back.
  // Returns numeric balance or null (e.g. no /api/v1/user-float route).
  fetchFloatBalance: async (): Promise<number | null> => {
    try {
      const res = await api.get('/api/v1/user-float');
      const raw = res.data?.data || res.data;
      const findVal = (obj: any, keys: string[]): any => {
        if (!obj) return null;
        for (const k of keys) { if (obj[k] !== undefined) return obj[k]; }
        for (const k in obj) { if (typeof obj[k] === 'object') { const r = findVal(obj[k], keys); if (r !== null) return r; } }
        return null;
      };
      const v = findVal(raw, ['balance', 'float_balance', 'amount', 'available_balance', 'floatBalance']);
      return v !== null ? Number(v) : null;
    } catch {
      return null;
    }
  },

  searchMembers: async (query: string) => {
    // Official member lookup endpoint for agents
    return api.get(`/api/v1/lookups/members?query=${encodeURIComponent(query)}`);
  },

  getAllUsers: async () => {
    return api.get('/api/v1/users');
  },

  getFeeSettings: async (key?: string) => {
    const url = key ? `/api/v1/settings/fees?key=${key}` : '/api/v1/settings/fees';
    return api.get(url);
  },

  getAccountTypes: async () => {
    return api.get('/api/v1/account-types');
  },

  // Return a member's actual owned accounts. The old implementation called
  // GET /api/v1/accounts?memberId= which is a BALANCE-SHEET listing that
  // ignores memberId and was returning the whole chart of accounts
  // (assets/equity/liabilities) as if they were the member's accounts.
  // We now use GET /api/v1/members/{id} and pick out accounts[] + shareAccounts[],
  // normalizing each to a flat { accountType/type } string for the pickers.
  getMemberAccounts: async (memberId: string): Promise<{ data: any[] }> => {
    try {
      const res = await api.get(`/api/v1/members/${memberId}`);
      const member = res.data?.data || res.data || {};
      const owned = Array.isArray(member.accounts) ? member.accounts : [];
      const shares = Array.isArray(member.shareAccounts)
        ? member.shareAccounts.map((s: any) => ({ ...s, isShareAccount: true }))
        : [];
      const combined = [...owned, ...shares];
      const normalized = combined.map((a: any) => {
        const rawType = a?.accountType && typeof a.accountType === 'object' ? a.accountType.name : (a?.accountType || a?.type);
        const label = typeof rawType === 'string' && rawType ? rawType : 'Savings';
        return { ...a, accountType: label, type: label };
      });
      return { data: normalized };
    } catch (e) {
      throw e;
    }
  },

  getMemberByUserId: async (userId: string) => {
    // If the backend allows searching for a member by their user ID
    return api.get(`/api/v1/members/search?userId=${userId}`);
  },

  tellerDeposit: async (params: { accountId: string; amount: number; channel?: string; description?: string; reference?: string; memberId?: string; }) => {
    return api.post('/api/v1/deposits', params);
  },

  tellerWithdraw: async (params: { accountId: string; amount: number; channel?: string; description?: string; reference?: string; memberId?: string; }) => {
    return api.post('/api/v1/withdrawals', params);
  },

  // Notifications (Role-Agnostic)
  //
  // The backend wraps the payload twice: { success, data: { data: [...],
  // pagination, unreadCount } }. Unwrap it here so callers get a flat,
  // predictable shape. Each item is { id, type, subject, message, isRead, sentAt }.
  // Deposit-success notifications are created server-side automatically the
  // moment /api/v1/momo/verify resolves a deposit as SUCCESSFUL - see
  // docs/momo-mobile-implementation-plan.md.
  getNotifications: async (params?: { unreadOnly?: boolean; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.unreadOnly) query.append('unreadOnly', 'true');
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const res = await api.get(`/api/v1/notifications?${query.toString()}`);
    const payload = res.data?.data ?? res.data ?? {};
    const items = Array.isArray(payload) ? payload : (payload.items || payload.data || []);
    return {
      items: items as any[],
      unreadCount: Number(payload.unreadCount ?? 0),
      pagination: payload.pagination ?? null,
    };
  },

  getUnreadNotificationCount: async (): Promise<number> => {
    try {
      const { unreadCount } = await DataService.getNotifications({ unreadOnly: true, limit: 1 });
      return unreadCount;
    } catch {
      return 0;
    }
  },

  markNotificationRead: async (notificationId: string) => {
    return api.put('/api/v1/notifications', { notificationId });
  },

  markAllNotificationsRead: async () => {
    return api.put('/api/v1/notifications/mark-all-read');
  },

  deleteNotification: async (id: string) => {
    return api.delete(`/api/v1/notifications?id=${id}`);
  },

  getLoanProducts: async () => {
    return api.get('/api/v1/loan-products');
  },

  // Identity & Dashboard
  getMyProfile: async () => {
    return api.get('/api/v1/users/me');
  },

  getDashboardSummary: async () => {
    return api.get('/api/v1/dashboard/summary');
  },

  getAgentFees: async () => {
    return api.get('/api/v1/agent/fees');
  }
};

export default api;
