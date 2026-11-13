import { searchEvents } from "@/lib/kalshi/server";

export const dynamic = "force-dynamic";

// Forwards only the public search words and category. Nothing about the caller's business is accepted or logged.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").slice(0, 80), category = u.searchParams.get("category")?.slice(0, 60) || null;
  const r = await searchEvents(q, category);
  return Response.json(r, { headers: { "cache-control": r.status === "ok" ? "public, s-maxage=60, stale-while-revalidate=30" : "no-store" } });
}
