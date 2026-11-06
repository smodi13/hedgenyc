import Link from "next/link";
import { Eyebrow } from "@/components/ui";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-[1320px] flex-col justify-center px-5 pt-32 sm:px-8">
      <Eyebrow tone="copper">404 · No such exposure</Eyebrow>
      <h1 className="font-display mt-4 max-w-3xl text-5xl leading-tight md:text-7xl">That page is not in the research.</h1>
      <p className="mt-6 max-w-xl text-chalk/70">Nothing was fabricated to fill this gap. The business screen, hedge lab and evidence library are on the home page.</p>
      <Link href="/" className="mt-10 w-fit border border-mint px-6 py-3 font-mono text-xs uppercase tracking-[0.2em] text-mint hover:bg-mint hover:text-ink">Back to HedgeNYC</Link>
    </div>
  );
}
