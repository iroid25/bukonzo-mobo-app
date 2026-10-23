import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';

import { DataService } from '@/services/api';

// ---------------------------------------------------------------------------
// TanStack Query setup.
//
// Unlike the old hand-rolled hooks, React Query gives us:
//   - query deduplication (N screens using the same key => ONE network request),
//     which is the single biggest win for this app since Member Home, Profile,
//     Accounts, Transactions and Deposit all read the same profile/transactions
//   - stale-while-revalidate: cached data paints instantly, background refetch
//     replaces it once the per-query freshness window below is exceeded
//   - in-memory + disk (AsyncStorage) cache so cold-start restores last data
//   - targeted invalidation instead of a global event bus
//
// The rule for any new query: pick the narrowest sensible `staleTime` and never
// call refetch() from a useFocusEffect. Focus revalidation is handled once,
// centrally, by hooks/useQueryFocusSync.ts, and it already respects staleTime.
// ---------------------------------------------------------------------------

/**
 * Freshness windows. A query is served straight from cache while it is fresher
 * than its `staleTime`; once past it the cached value is still painted
 * immediately and refreshed in the background (stale-while-revalidate). So the
 * number below controls *when we go to the network*, not whether the user ever
 * waits for it.
 *
 * These are deliberately per-query because the endpoints have very different
 * volatility: KYC/identity fields change a few times a year, loan products
 * change when an admin publishes them, but balances and notifications need to
 * be reasonably current.
 */
const STALE = {
  /** KYC + member records: changes a handful of times per year. */
  profile: 5 * 60 * 1000,
  /** Dashboard aggregates: balances move on every deposit/withdrawal. */
  summary: 60 * 1000,
  /** Money movement: the most volatile read in the app. */
  transactions: 60 * 1000,
  /** Agent float: changes on every teller cash movement. */
  float: 60 * 1000,
  /** Alerts: short window so an unread badge is not missed. */
  notifications: 30 * 1000,
  /** KYC checklist state; only moves while the member is editing. */
  profileStatus: 5 * 60 * 1000,
  /** Reference data an admin publishes; effectively immutable per deploy. */
  reference: 60 * 60 * 1000,
  /** Agent member lookups: short window so retyping a name is instant but
   *  new members / changed phone numbers still sync within a minute. */
  memberSearch: 60 * 1000,
} as const;

/**
 * How long inactive queries are kept in memory, and (via QUERY_PERSIST_OPTIONS)
 * how long the disk copy survives between sessions. 24 hours: a relaunch any
 * time the same day still paints instantly from storage, the copy rolls off
 * daily, and sign-out wipes it immediately via queryClient.clear().
 */
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Quasi-static reference data (loan products) stays warm far longer - these
 *  entries are small, non-financial and only change when an admin republishes. */
const REFERENCE_GC_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.summary,
      gcTime: CACHE_MAX_AGE_MS,
      retry: 2, // resilient to flaky mobile networks
      // React Navigation focus is wired into React Query's focusManager by
      // hooks/useQueryFocusSync.ts. Because this is true, returning to a tab
      // revalidates *only* queries that have actually gone stale — and it does
      // so in the background, while the cached value stays on screen. Previously
      // every screen hand-rolled a useFocusEffect + refetch(), which always hit
      // the network and made this option unobservable.
      refetchOnWindowFocus: true,
      // A remount (tab switch that actually remounts, deep link, navigate back)
      // likewise only refetches when stale.
      refetchOnMount: true,
      // Serving a stale value instantly and repairing it behind the UI is the
      // whole point; never blank the screen while a background refetch runs.
      placeholderData: keepPreviousData,
    },
  },
});

// Disk cache for cold-start: the app paints real data from the last session on
// the very first frame instead of showing a spinner for a full round-trip.
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'buko.react-query.v1',
});

/**
 * Mark every money-touching query stale and refetch it now. Used after a
 * deposit / withdrawal / teller movement, and by pull-to-refresh where the user
 * has explicitly asked for fresh data.
 *
 * Returns a promise that settles when the revalidation finishes, so a
 * RefreshControl can keep its spinner up for exactly as long as it takes. The
 * old code discarded these promises with `void`, which left pull-to-refresh
 * dismissing its spinner before the data had actually changed.
 */
export function invalidateWallet() {
  // Because this is keyed invalidation, unrelated screens (e.g. loan products)
  // are left alone, unlike the old notify-all event bus.
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['profile'] }),
    queryClient.invalidateQueries({ queryKey: ['summary'] }),
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['float'] }),
    queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    queryClient.invalidateQueries({ queryKey: ['loans'] }),
    // Member lookup results may carry names/phones/statuses that a teller op
    // just proved stale — drop them so the next search re-fetches.
    queryClient.invalidateQueries({ queryKey: ['memberSearch'] }),
  ]);
}

export const QUERY_PERSIST_OPTIONS = {
  persister: asyncStoragePersister,
  maxAge: CACHE_MAX_AGE_MS,
};

// ---------------------------------------------------------------------------
// Hooks. Each returns the exact shape consumed by the existing screens
// ({ data, isLoading, isRefetching, error, refetch }) so screens stay unchanged.
// ---------------------------------------------------------------------------

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await DataService.getUserProfile()).data as any,
    staleTime: STALE.profile,
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: async () => {
      const res = await DataService.getDashboardSummary();
      return (res.data?.data || res.data) as any;
    },
    staleTime: STALE.summary,
  });
}

export function useProfileStatus() {
  return useQuery({
    queryKey: ['profileStatus'],
    queryFn: async () => (await DataService.getProfileStatus()).data as any,
    staleTime: STALE.profileStatus,
  });
}

export function useTransactions(memberId?: string, limit?: number) {
  return useQuery({
    queryKey: ['transactions', memberId ?? 'all', limit ?? 'all'],
    queryFn: async () => (await DataService.getTransactions(memberId, limit)) as any,
    staleTime: STALE.transactions,
  });
}

export function useNotifications(limit = 10) {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: async () => (await DataService.getNotifications({ limit })) as any,
    staleTime: STALE.notifications,
  });
}

export function useFloatBalance() {
  return useQuery({
    queryKey: ['float'],
    queryFn: async () => {
      const res = await DataService.getFloatBalance();
      return (res.data?.data || res.data) as any;
    },
    staleTime: STALE.float,
  });
}

/**
 * Loan products are catalogue data an admin publishes; they only change when a
 * product is created or retired. The long window means the Loans tab and the
 * Apply Loan flow share a single fetch instead of each pulling the catalogue on
 * every visit.
 */
export function useLoanProducts() {
  return useQuery({
    queryKey: ['loan-products'],
    queryFn: async () => {
      const res = await DataService.getLoanProducts();
      const raw = res.data?.data || res.data || [];
      return (Array.isArray(raw) ? raw : raw.products || []) as any[];
    },
    staleTime: STALE.reference,
    gcTime: REFERENCE_GC_AGE_MS,
  });
}

export function useMyLoans() {
  return useQuery({
    queryKey: ['loans'],
    queryFn: async () => {
      const res = await DataService.getMyLoans();
      const raw = res.data?.data || res.data || [];
      return (Array.isArray(raw) ? raw : raw.loans || []) as any[];
    },
    staleTime: STALE.transactions,
  });
}

/**
 * Agent member lookup. Cached per query string so re-typing a name the agent
 * already searched renders instantly from memory/disk, while the 60s staleTime
 * keeps new members and changed phone numbers syncing shortly after they
 * happen. `keepPreviousData` means the previous result stays on screen while
 * the next letter is being fetched instead of flashing an empty state.
 */
export function useMemberSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['memberSearch', q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const res = await DataService.searchMembers(q);
      const data = res.data?.data || res.data || [];
      return (Array.isArray(data) ? data : []) as any[];
    },
    staleTime: STALE.memberSearch,
    placeholderData: keepPreviousData,
  });
}

// ---------------------------------------------------------------------------
// Optimistic teller mutations: deposit / withdraw feel instant because the
// member's balance and the agent float are updated in the cache before the
// server responds, then rolled back if the request fails.
// ---------------------------------------------------------------------------

export function useTellerDeposit() {
  return useMutation({
    mutationFn: (params: {
      accountId: string;
      amount: number;
      channel?: string;
      description?: string;
      reference?: string;
      memberId?: string;
    }) => DataService.tellerDeposit(params),
    onMutate: async (newDeposit) => {
      await queryClient.cancelQueries({ queryKey: ['profile'] });
      await queryClient.cancelQueries({ queryKey: ['summary'] });
      await queryClient.cancelQueries({ queryKey: ['float'] });

      const previousProfile = queryClient.getQueryData(['profile']);
      const previousSummary = queryClient.getQueryData(['summary']);
      const previousFloat = queryClient.getQueryData(['float']);

      // Optimistically credit the member account being deposited into.
      queryClient.setQueryData(['profile'], (old: any) => {
        if (!old) return old;
        const updated = { ...old };
        if (updated.accounts) {
          updated.accounts = updated.accounts.map((acc: any) =>
            String(acc.id) === String(newDeposit.accountId)
              ? { ...acc, balance: Number(acc.balance || 0) + newDeposit.amount }
              : acc
          );
        }
        updated.totalBalance = (updated.totalBalance || 0) + newDeposit.amount;
        return updated;
      });

      // Optimistically debit the agent float.
      queryClient.setQueryData(['float'], (old: any) => {
        if (!old) return old;
        const raw = old?.data?.data || old?.data || old;
        const current = Number(raw?.balance || raw?.float_balance || raw?.amount || 0);
        const next = { ...old };
        if (next.data) {
          if (next.data.data) next.data.data.balance = current - newDeposit.amount;
          else next.data.balance = current - newDeposit.amount;
        } else {
          next.balance = current - newDeposit.amount;
        }
        return next;
      });

      return { previousProfile, previousSummary, previousFloat };
    },
    onError: (_err, _newDeposit, context) => {
      if (context?.previousProfile !== undefined)
        queryClient.setQueryData(['profile'], context.previousProfile);
      if (context?.previousSummary !== undefined)
        queryClient.setQueryData(['summary'], context.previousSummary);
      if (context?.previousFloat !== undefined)
        queryClient.setQueryData(['float'], context.previousFloat);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['float'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useTellerWithdraw() {
  return useMutation({
    mutationFn: (params: {
      accountId: string;
      amount: number;
      channel?: string;
      description?: string;
      reference?: string;
      memberId?: string;
    }) => DataService.tellerWithdraw(params),
    onMutate: async (newWithdraw) => {
      await queryClient.cancelQueries({ queryKey: ['profile'] });
      await queryClient.cancelQueries({ queryKey: ['summary'] });
      await queryClient.cancelQueries({ queryKey: ['float'] });

      const previousProfile = queryClient.getQueryData(['profile']);
      const previousSummary = queryClient.getQueryData(['summary']);
      const previousFloat = queryClient.getQueryData(['float']);

      // Optimistically debit the member account being withdrawn from.
      queryClient.setQueryData(['profile'], (old: any) => {
        if (!old) return old;
        const updated = { ...old };
        if (updated.accounts) {
          updated.accounts = updated.accounts.map((acc: any) =>
            String(acc.id) === String(newWithdraw.accountId)
              ? { ...acc, balance: Number(acc.balance || 0) - newWithdraw.amount }
              : acc
          );
        }
        updated.totalBalance = Math.max(0, (updated.totalBalance || 0) - newWithdraw.amount);
        return updated;
      });

      // Optimistically credit the agent float (cash handed out).
      queryClient.setQueryData(['float'], (old: any) => {
        if (!old) return old;
        const raw = old?.data?.data || old?.data || old;
        const current = Number(raw?.balance || raw?.float_balance || raw?.amount || 0);
        const next = { ...old };
        if (next.data) {
          if (next.data.data) next.data.data.balance = current + newWithdraw.amount;
          else next.data.balance = current + newWithdraw.amount;
        } else {
          next.balance = current + newWithdraw.amount;
        }
        return next;
      });

      return { previousProfile, previousSummary, previousFloat };
    },
    onError: (_err, _newWithdraw, context) => {
      if (context?.previousProfile !== undefined)
        queryClient.setQueryData(['profile'], context.previousProfile);
      if (context?.previousSummary !== undefined)
        queryClient.setQueryData(['summary'], context.previousSummary);
      if (context?.previousFloat !== undefined)
        queryClient.setQueryData(['float'], context.previousFloat);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['float'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
