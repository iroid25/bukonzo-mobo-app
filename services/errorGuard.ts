/**
 * Last-resort guard for JavaScript errors thrown OUTSIDE a React component
 * render (async callbacks, timers, event handlers). React Native's default
 * behaviour for an uncaught JS error in a release build is to kill the app
 * process - which is exactly what "the profile screen crashes the whole app"
 * looks like on Android.
 *
 * We keep the platform's original handler (so dev LogBox / reporting still
 * works) but make sure the process is never torn down because of one JS
 * exception. The component-level safety net lives in
 * `components/AppErrorBoundary.tsx`.
 */
export function installGlobalErrorGuard(): void {
  const g = globalThis as {
    ErrorUtils?: {
      getGlobalHandler?: () => (e: unknown, isFatal?: boolean) => void;
      setGlobalHandler?: (h: (e: unknown, isFatal?: boolean) => void) => void;
    };
  };

  const current = g.ErrorUtils?.getGlobalHandler?.();

  g.ErrorUtils?.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
    try {
      console.error('[errorGuard] Uncaught JS error:', error, isFatal);
      // TODO(eliot): swap console.error for a walled error reporter later.
    } catch {
      // Never let the guard itself throw.
    }
    // In DEV, delegate to whatever Expo/RN had installed so the redbox still
    // shows and we can see the stack while iterating.
    if (__DEV__) {
      current?.(error, isFatal);
      return;
    }
    // In PRODUCTION we do NOT delegate: RN's default global handler ends the
    // process on Android release builds ("the app just died"). Swallow so a
    // single uncaught JS exception can never take the whole app down.
  });
}