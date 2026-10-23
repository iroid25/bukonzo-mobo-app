import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { DataService, MomoStatus, MomoStatusResult } from '@/services/api';

export type PaymentPhase = 'idle' | 'waiting' | 'success' | 'failed' | 'timeout';

// Back-compat alias - a lot of the app still refers to this as a "momo" phase.
export type MomoPhase = PaymentPhase;

type PollFn = (handle: string) => Promise<MomoStatusResult>;

type Options = {
  // Tight polling cadence for the first `tightWindowMs`.
  tightIntervalMs?: number;
  tightWindowMs?: number;
  // Slower cadence after the tight window, until `giveUpMs`.
  slowIntervalMs?: number;
  giveUpMs?: number;
  // Which backend status check to run. Defaults to the MTN MoMo verify used by
  // deposits and loan repayments; withdrawals pass DataService.pollRelworxStatus.
  poll?: PollFn;
};

const DEFAULTS = {
  tightIntervalMs: 2000,
  tightWindowMs: 30_000,
  slowIntervalMs: 8000,
  giveUpMs: 120_000,
};

/**
 * Drives the "waiting for payment confirmation" UX. After initiating a deposit,
 * loan repayment (MoMo) or withdrawal (Relworx), call `start(referenceId)`.
 * The hook polls the relevant verify endpoint and resolves to `success` /
 * `failed`, or `timeout` if the provider never reports a terminal status in
 * time.
 *
 * The mobile app can't receive the provider's server-to-server callback, so
 * polling is the only way it learns the outcome - this is not optional.
 */
export function usePaymentPolling(options: Options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const poll: PollFn = options.poll || DataService.pollMomoStatus;
  const [phase, setPhase] = useState<PaymentPhase>('idle');
  const [reason, setReason] = useState<string | null>(null);

  const refIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef<boolean>(true);
  const lastResultRef = useRef<MomoStatusResult | null>(null);
  const pollRef = useRef<PollFn>(poll);
  pollRef.current = poll;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const reset = useCallback(() => {
    stoppedRef.current = true;
    clearTimer();
    refIdRef.current = null;
    lastResultRef.current = null;
    setPhase('idle');
    setReason(null);
  }, []);

  const finish = (next: Exclude<PaymentPhase, 'idle' | 'waiting'>, why: string | null) => {
    stoppedRef.current = true;
    clearTimer();
    setReason(why);
    setPhase(next);
  };

  const tick = useCallback(async () => {
    if (stoppedRef.current) return;
    const referenceId = refIdRef.current;
    if (!referenceId) return;

    const elapsed = Date.now() - startedAtRef.current;

    try {
      const res = await pollRef.current(referenceId);
      if (stoppedRef.current) return;
      lastResultRef.current = res;

      const status: MomoStatus = res.status;
      if (status === 'SUCCESSFUL') {
        finish('success', null);
        return;
      }
      if (status === 'FAILED') {
        finish('failed', res.reason || 'The payment was declined or failed.');
        return;
      }
      // still PENDING - either the provider hasn't settled, or it has but the
      // backend hasn't posted it to the ledger yet. Keep polling.
    } catch (e: any) {
      // A 404 means the transaction isn't visible to this member - treat as
      // terminal so we don't spin forever. Anything else: swallow and retry.
      if (e?.response?.status === 404) {
        finish('failed', 'Transaction could not be found.');
        return;
      }
    }

    if (stoppedRef.current) return;

    if (elapsed >= cfg.giveUpMs) {
      // If the provider already took/sent the money but the ledger posting is
      // still catching up, say so - it's not the member's problem to retry.
      const paidButNotPosted =
        lastResultRef.current?.mtnStatus === 'SUCCESSFUL' && !lastResultRef.current?.posted;
      finish(
        'timeout',
        paidButNotPosted
          ? 'Your payment went through. It is still being posted to your account and will appear shortly.'
          : null,
      );
      return;
    }

    const delay = elapsed < cfg.tightWindowMs ? cfg.tightIntervalMs : cfg.slowIntervalMs;
    timerRef.current = setTimeout(tick, delay);
  }, [cfg.giveUpMs, cfg.slowIntervalMs, cfg.tightIntervalMs, cfg.tightWindowMs]);

  const start = useCallback((referenceId: string) => {
    clearTimer();
    refIdRef.current = referenceId;
    startedAtRef.current = Date.now();
    stoppedRef.current = false;
    setReason(null);
    setPhase('waiting');
    // first check after the tight interval - gives the member a moment to see
    // the prompt on their phone before we start asking.
    timerRef.current = setTimeout(tick, cfg.tightIntervalMs);
  }, [cfg.tightIntervalMs, tick]);

  // If the app is backgrounded and comes back while still waiting, poll once
  // immediately rather than waiting out the scheduled delay.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && !stoppedRef.current && refIdRef.current) {
        clearTimer();
        tick();
      }
    });
    return () => sub.remove();
  }, [tick]);

  useEffect(() => () => {
    stoppedRef.current = true;
    clearTimer();
  }, []);

  return { phase, reason, start, reset };
}
