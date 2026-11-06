"use client";
import { useMarketSnapshot } from "@/lib/useMarketSnapshot";
import { fmtTime } from "@/lib/format";

/** Hero live label. Never implies a live price; reports only whether the public API answered, and when. */
export function MarketStatusLabel() {
  const { state } = useMarketSnapshot();
  let dot = "bg-steel", text: string;
  if (state.phase === "loading") text = "Public market data · checking status…";
  else if (state.phase === "ready") { dot = "bg-mint"; text = `Public market data · status checked at ${fmtTime(state.snap.fetchedAt)}`; }
  else { dot = "bg-copper"; text = "Market feed unavailable. Research remains accessible."; }
  return (
    <p className="flex items-start gap-3 font-mono text-[0.66rem] uppercase leading-relaxed tracking-[0.12em] text-chalk/75" aria-live="polite">
      <span className={`mt-[5px] inline-block size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
      {text}
    </p>
  );
}
