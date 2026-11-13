import { fetchContract } from "@/lib/kalshi/server";

export const dynamic = "force-dynamic";

// Forwards only a public market ticker. CDN caches 30s so fetchedAt reflects the true fetch time.
export async function GET(req: Request) {
  const ticker = (new URL(req.url).searchParams.get("ticker") ?? "").trim().toUpperCase();
  const r = await fetchContract(ticker);
  return Response.json(r, { status: r.status === "invalid" ? 400 : 200, headers: { "cache-control": r.status === "ok" || r.status === "not_found" ? "public, s-maxage=30, stale-while-revalidate=15" : "no-store" } });
}
