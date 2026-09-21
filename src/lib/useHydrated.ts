"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * False for the server render and the hydration render, true immediately
 * after. Lets browser-only state (localStorage, matchMedia) drive the UI
 * without a hydration mismatch and without a setState inside an effect.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, onClient, onServer);
}
