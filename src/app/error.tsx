"use client";
import { Eyebrow } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-[1320px] flex-col justify-center px-5 pt-32 sm:px-8">
      <Eyebrow tone="copper">500 · Unexpected error</Eyebrow>
      <h1 className="font-display mt-4 max-w-3xl text-5xl leading-tight md:text-7xl">Something broke on our side.</h1>
      <p className="mt-6 max-w-xl text-chalk/70">The research files are unaffected. Try again; if it persists, reload the page.</p>
      <button type="button" onClick={reset} className="mt-10 w-fit border border-mint px-6 py-3 font-mono text-xs uppercase tracking-[0.2em] text-mint hover:bg-mint hover:text-ink">Try again</button>
    </div>
  );
}
