import { fetchSnapshot } from "@/lib/kalshi/client";

// Always evaluated per request; the CDN caches the whole response for 60s so `fetchedAt` is the true fetch time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await fetchSnapshot();
    return Response.json(snap, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=30" } });
  } catch {
    return Response.json(
      { fetchedAt: new Date().toISOString(), status: "unavailable", items: [], source: "https://external-api.kalshi.com/trade-api/v2/markets" },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
