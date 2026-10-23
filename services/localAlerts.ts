import * as SecureStore from 'expo-secure-store';

/**
 * Minimal in-app alert journal, stored locally on the device.
 *
 * The backend only creates notifications for transactional events it knows
 * about (deposit success, payouts...). "Your float went down" is an agent-only,
 * device-side concern the backend has no endpoint for, so we persist those
 * alerts here and let the notifications screen + dashboard surface them.
 */

export type LocalAlert = {
  id: string;
  subject: string;
  message: string;
  kind: 'warning' | 'success' | 'info';
  createdAt: string; // ISO
  isRead: boolean;
  origin: 'float' | 'system';
};

const STORAGE_KEY = 'app-local-alerts';
const MAX_ALERTS = 30;

const readAll = async (): Promise<LocalAlert[]> => {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = async (alerts: LocalAlert[]): Promise<void> => {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(alerts.slice(0, MAX_ALERTS)));
  } catch {
    // Storage unavailable (e.g. some Android emulators) - lose the alert, never crash.
  }
};

export const getLocalAlerts = async (): Promise<LocalAlert[]> => readAll();

export const addLocalAlert = async (
  subject: string,
  message: string,
  kind: LocalAlert['kind'] = 'info',
  origin: LocalAlert['origin'] = 'system',
): Promise<void> => {
  const existing = await readAll();
  const alert: LocalAlert = {
    id: `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    subject,
    message,
    kind,
    origin,
    createdAt: new Date().toISOString(),
    isRead: false,
  };
  await writeAll([alert, ...existing]);
};

export const markLocalAlertRead = async (id: string): Promise<void> => {
  const existing = await readAll();
  await writeAll(
    existing.map((a) => (a.id === id ? { ...a, isRead: true } : a)),
  );
};

export const clearLocalAlerts = async (): Promise<void> => {
  await writeAll([]);
};

export const deleteLocalAlert = async (id: string): Promise<void> => {
  const existing = await readAll();
  await writeAll(existing.filter((a) => a.id !== id));
};

export const fmtUgx = (n: number): string =>
  new Intl.NumberFormat('en-UG', { style: 'decimal', maximumFractionDigits: 0 }).format(
    Math.round(n || 0),
  );

/**
 * Record a float movement alert for an agent.
 * `prev` / `next` are the agent float balances before and after a transaction
 * or top-up. Only a decrease is worth a user-facing warning - a top-up (increase)
 * is expected and doesn't need an alert.
 *
 * Returns the alert that was created (or null when nothing worth alerting).
 */
export const maybeRecordFloatAlert = async (
  prev: number | null | undefined,
  next: number | null | undefined,
): Promise<LocalAlert | null> => {
  const before = Number(prev ?? 0);
  const after = Number(next ?? 0);
  const delta = after - before;

  if (delta >= -0.001) return null; // no change / increase - nothing to warn about

  const dropped = Math.round(Math.abs(delta));
  const alert: LocalAlert = {
    id: `float-${Date.now()}`,
    kind: 'warning',
    origin: 'float',
    subject: 'Float Reduced',
    message:
      `Your float dropped by UGX ${fmtUgx(dropped)} (${fmtUgx(before)} → ${fmtUgx(after)}). ` +
      `Reconcile with your most recent ${dropped >= 50000 ? 'withdrawal' : 'transaction'} to keep your cash in balance.`,
    createdAt: new Date().toISOString(),
    isRead: false,
  };

  const existing = await readAll();
  await writeAll([alert, ...existing]);
  return alert;
};