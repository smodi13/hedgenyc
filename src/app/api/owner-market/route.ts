import { fetchOwnerMarket } from "@/lib/kalshi/owner-market";

export const dynamic = "force-dynamic";

// Read-only, no parameters, no request data forwarded. CDN caches for 30s so fetchedAt is the true fetch time.
export async function GET() {
  const m = await fetchOwnerMarket();
  return Response.json(m, { headers: { "cache-control": m.status === "unavailable" ? "no-store" : "public, s-maxage=30, stale-while-revalidate=15" } });
}
