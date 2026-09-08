"use client";

import { useSyncExternalStore } from "react";

/**
 * SSR-safe access to "today".
 *
 * The server has no meaningful local date for the viewer, so rendering one
 * during SSR would guarantee a hydration mismatch. `useSyncExternalStore`
 * gives us the correct shape for this: a server snapshot (`null`) and a client
 * snapshot (the real date), with React handling the switch — no `setState`
 * inside an effect, and no cascading render.
 */

const noopSubscribe = () => () => {};

/** `null` during server render and the first client render, then YYYY-MM-DD. */
export function useToday(): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    getClientToday,
    () => null,
  );
}

// Memoised so the snapshot is referentially stable across renders, which
// useSyncExternalStore requires.
let cachedToday: string | null = null;
let cachedAt = 0;

function getClientToday(): string {
  const now = Date.now();
  // Re-read at most once a minute; a tutor may leave the app open past
  // midnight and should then see the new day.
  if (cachedToday === null || now - cachedAt > 60_000) {
    const date = new Date();
    cachedToday = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(date.getDate()).padStart(2, "0")}`;
    cachedAt = now;
  }
  return cachedToday;
}

/** True once the component has hydrated on the client. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
