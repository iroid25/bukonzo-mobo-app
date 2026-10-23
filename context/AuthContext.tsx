import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '@/services/queries';
import { useRouter, useSegments } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import api, { DataService } from '../services/api';

// Disk-backed agent config. Fee tiers / agent fees are reference data that
// rarely change; caching them means a cold start (or process death) paints the
// last-known fee table immediately while the refresh calls below sync the
// server version in the background. Cleared on sign-out.
const AGENT_FLOAT_KEY = 'buko.auth.floatBalance';
const AGENT_FEE_SETTINGS_KEY = 'buko.auth.feeSettings';
const AGENT_FEES_KEY = 'buko.auth.agentFees';

type User = {
  id: string;
  name: string;
  email: string | null;
  role?: string;
  image?: string | null;
  needsProfileCompletion?: boolean;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  session: string | null;
  floatBalance: number;
  feeSettings: any[];
  agentFees: any;
  refreshFloat: () => Promise<void>;
  refreshFeeSettings: () => Promise<void>;
  refreshAgentFees: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  signIn: async () => ({ id: '', name: '', email: null }),
  signOut: async () => {},
  session: null,
  floatBalance: 0,
  feeSettings: [],
  agentFees: null,
  refreshFloat: async () => {},
  refreshFeeSettings: async () => {},
  refreshAgentFees: async () => {},
});

export const getHomeRouteForUser = (user?: { role?: string | null; needsProfileCompletion?: boolean | null }) => {
  if (user?.needsProfileCompletion) {
    return '/complete-profile';
  }

  return user?.role?.toUpperCase() === 'AGENT' ? '/(agent-tabs)' : '/(tabs)';
};

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [floatBalance, setFloatBalance] = useState<number>(0);
  const [feeSettings, setFeeSettings] = useState<any[]>([]);
  const [agentFees, setAgentFees] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const rootSegment = useSegments()[0];
  const router = useRouter();

  useEffect(() => {
    // The real session is the NextAuth cookie in the platform cookie jar, not
    // anything we store ourselves - so on every cold start ask the backend
    // directly whether that cookie is still valid. (The old code gated this on
    // a SecureStore string that was always the literal "session-active", which
    // could drift out of sync with the actual cookie state.)
    const loadSession = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/api/auth/session');
        const restored = response.data?.user;
        if (restored) {
          const role = restored.role?.toUpperCase();
          if (role === 'MEMBER' || role === 'AGENT') {
            setUser({
              ...restored,
              role,
              needsProfileCompletion: !restored.email || restored.email === null,
            });
            setSession('session-active');
          } else {
            // Session belongs to a role this app doesn't serve - treat as
            // logged out.
            await SecureStore.deleteItemAsync('session-token').catch(() => {});
          }
        }
      } catch (e) {
        // No valid session (401/expired) or the network is down - stay logged
        // out; the router guard will send the user to /login.
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  // Rehydrate the agent's last-known float + fee tables from disk so the
  // first frame after a cold start already has them; the [user] effect below
  // refreshes from the server right after.
  useEffect(() => {
    (async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          AGENT_FLOAT_KEY,
          AGENT_FEE_SETTINGS_KEY,
          AGENT_FEES_KEY,
        ]);
        for (const [key, value] of entries) {
          if (value == null) continue;
          if (key === AGENT_FLOAT_KEY) setFloatBalance(Number(value) || 0);
          if (key === AGENT_FEE_SETTINGS_KEY) {
            try { setFeeSettings(JSON.parse(value)); } catch {}
          }
          if (key === AGENT_FEES_KEY) {
            try { setAgentFees(JSON.parse(value)); } catch {}
          }
        }
      } catch {
        // Storage unavailable - start empty, server refresh will fill it.
      }
    })();
  }, []);

  const persistFloat = (v: number) =>
    AsyncStorage.setItem(AGENT_FLOAT_KEY, String(v)).catch(() => {});
  const persistFeeSettings = (v: any[]) =>
    AsyncStorage.setItem(AGENT_FEE_SETTINGS_KEY, JSON.stringify(v)).catch(() => {});
  const persistAgentFees = (v: any) =>
    AsyncStorage.setItem(AGENT_FEES_KEY, JSON.stringify(v)).catch(() => {});

  const refreshFloat = async () => {
      try {
          const res = await DataService.getFloatBalance();
          const raw = res.data?.data || res.data;
          
          const findVal = (obj: any, keys: string[]): any => {
              if (!obj) return null;
              for (const k of keys) { if (obj[k] !== undefined) return obj[k]; }
              for (const k in obj) { if (typeof obj[k] === 'object') { const r = findVal(obj[k], keys); if (r !== null) return r; } }
              return null;
          };
          
          const balanceValue = findVal(raw, ['balance', 'float_balance', 'amount', 'balance_amount', 'available_balance', 'current_balance', 'floatBalance']) || 0;
          const next = Number(balanceValue);
          setFloatBalance(next);
          persistFloat(next);
      } catch (e) {
          console.warn("Global Float Refresh Failed", e);
      }
  };

  const refreshFeeSettings = async () => {
    try {
        const res = await DataService.getFeeSettings();
        const next = res.data?.data || res.data || [];
        setFeeSettings(next);
        persistFeeSettings(next);
    } catch (e) {
        console.warn("Fee Settings Refresh Failed", e);
    }
  };

  const refreshAgentFees = async () => {
    try {
        const res = await DataService.getAgentFees();
        const next = res.data?.data || res.data || null;
        setAgentFees(next);
        persistAgentFees(next);
    } catch (e) {
        console.warn("Agent Fees Refresh Failed", e);
    }
  };

  useEffect(() => {
      if (user && user.role === 'AGENT') {
          refreshFloat();
          refreshFeeSettings();
          refreshAgentFees();
      }
  }, [user]);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await DataService.login(email, password);
      const { user, token } = data;
      
      const needsProfileCompletion = !user.email || user.email === null;
      
      // Role restriction: only MEMBER and AGENT can login
      const role = user.role?.toUpperCase();
      if (role !== 'MEMBER' && role !== 'AGENT') {
        throw new Error('Access denied. Only Members and Agents can use this app.');
      }

      const updatedUser = { ...user, role, needsProfileCompletion };
      
      await SecureStore.setItemAsync('session-token', token || '');
      setSession(token);
      setUser(updatedUser);
      
      if (role === 'AGENT') {
          await Promise.all([refreshFloat(), refreshFeeSettings(), refreshAgentFees()]);
      }

      return updatedUser;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      console.error('SignIn Error Details:', message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    // Clear local session state FIRST so the router guard can move the user off
    // protected screens immediately - the server-side sign-out below is a
    // best-effort background call and must never block the UI leaving (it can
    // hang indefinitely offline, which made logout feel broken).
    await SecureStore.deleteItemAsync('session-token').catch(() => {});
    // Wipe the query cache too. Without this the persisted AsyncStorage blob
    // (profile, balances, transactions, KYC) survived the sign-out, so the next
    // person to use the device would be served the previous member's data from
    // cache on a cold start. Clearing also guarantees the next login starts from
    // a cold fetch rather than rehydrating someone else's session.
    queryClient.clear();
    // Drop the persisted agent config too - it belongs to this user.
    await AsyncStorage.multiRemove([
      AGENT_FLOAT_KEY,
      AGENT_FEE_SETTINGS_KEY,
      AGENT_FEES_KEY,
    ]).catch(() => {});
    setFloatBalance(0);
    setFeeSettings([]);
    setAgentFees(null);
    setSession(null);
    setUser(null);
    try {
      await DataService.logout();
    } catch (e) {
      console.warn('Server signout failed (local session already cleared)', e);
    }
  };

  useEffect(() => {
    if (isLoading) return;

    // Wait for rootSegment to be available
    if (!rootSegment) return;

    const rootStr = rootSegment as string;
    const isLoginPage = rootStr === 'login' || rootStr === 'forgot-password' || rootStr === 'verify-otp' || rootStr === 'reset-password';
    const isSplash = rootStr === 'index' || rootStr === 'index.tsx' || !rootStr;
    const isCompleteProfile = rootStr === 'complete-profile';
    const inTabs = rootStr === '(tabs)';
    const inAgentTabs = rootStr === '(agent-tabs)';

    // IMPORTANT: Allow the Splash Screen (index.tsx) to handle the initial redirect
    if (isSplash) return;

    // Allow complete-profile screen
    if (isCompleteProfile) return;

    if (!user && !isLoginPage) {
      // Protect (tabs) and other root screens
      router.replace('/login');
    } else if (user && user.needsProfileCompletion && !isCompleteProfile) {
      // Redirect to profile completion if needed
      router.replace('/complete-profile');
    } else if (user && !user.needsProfileCompletion) {
      const userRole = user.role?.toUpperCase();
      const isMember = userRole === 'MEMBER';
      const isAgent = userRole === 'AGENT';

      if (isLoginPage || isSplash) {
        router.replace(getHomeRouteForUser(user));
      } else if (inTabs && isAgent) {
        // Agent tried to enter member tabs
        router.replace('/(agent-tabs)');
      } else if (inAgentTabs && isMember) {
        // Member tried to enter agent tabs
        router.replace('/(tabs)');
      }
    }
  }, [user, rootSegment, isLoading]);

  return (
    <AuthContext.Provider value={{ 
        user, 
        isLoading, 
        signIn, 
        signOut, 
        session, 
        floatBalance, 
        feeSettings,
        agentFees,
        refreshFloat,
        refreshFeeSettings,
        refreshAgentFees
    }}>
      {children}
    </AuthContext.Provider>
  );
};
