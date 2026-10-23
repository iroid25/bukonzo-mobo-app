import { focusManager } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

/**
 * Teaches React Query that "window focus" means "this navigator came back to
 * the foreground".
 *
 * React Query ships a focusManager that drives `refetchOnWindowFocus`, but on
 * React Native it defaults to `navigator.onLine`, which is permanently true and
 * therefore never fires. Wiring React Navigation's real focus lifecycle into it
 * is what turns revalidation into stale-while-revalidate: coming back to a tab
 * re-fetches only the queries whose freshness window has already lapsed, in the
 * background, while the cached value stays painted.
 *
 * The payoff is that screens no longer hand-roll `useFocusEffect(() => refetch())`.
 * Those calls always went to the network and bypassed staleTime entirely, which
 * is why the cache never actually saved a request.
 *
 * Must be rendered inside a navigator, so it is mounted by the tab layouts.
 */
export function useQueryFocusSync() {
  useFocusEffect(
    useCallback(() => {
      focusManager.setFocused(true);
      return () => focusManager.setFocused(false);
    }, []),
  );
}