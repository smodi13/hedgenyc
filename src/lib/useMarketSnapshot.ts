"use client";
import { useCallback, useSyncExternalStore } from "react";
import type { Snapshot } from "./kalshi/client";

export type FeedState = { phase: "loading" } | { phase: "ready"; snap: Snapshot } | { phase: "unavailable"; at: string };

// One shared request/store for the hero label, Market Fit chapter and Hedge Lab.
let state: FeedState = { phase: "loading" };
let started = false;
const subs = new Set<() => void>();
const emit = (s: FeedState) => { state = s; subs.forEach((f) => f()); };

async function load() {
  try {
    const res = await fetch("/api/market-snapshot", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const snap = (await res.json()) as Snapshot;
    if (!snap || !Array.isArray(snap.items) || snap.status === "unavailable" || !snap.fetchedAt) emit({ phase: "unavailable", at: new Date().toISOString() });
    else emit({ phase: "ready", snap });
  } catch {
    emit({ phase: "unavailable", at: new Date().toISOString() });
  }
}

const subscribe = (cb: () => void) => {
  subs.add(cb);
  if (!started) { started = true; void load(); }
  return () => { subs.delete(cb); };
};
const LOADING: FeedState = { phase: "loading" };

export function useMarketSnapshot() {
  const s = useSyncExternalStore(subscribe, () => state, () => LOADING);
  const refresh = useCallback(() => { emit({ phase: "loading" }); void load(); }, []);
  return { state: s, refresh };
}
