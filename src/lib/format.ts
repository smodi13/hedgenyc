export const usd = (n: number, d = 2) =>
  (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const signedUsd = (n: number, d = 2) => (n > 0 ? "+" : "") + usd(n, d);
export const pct = (n: number, d = 0) => (n * 100).toFixed(d) + "%";
export const dollars4 = (n: number | null) => (n === null ? "—" : "$" + n.toFixed(2));
export const fmtTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return (
    d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) +
    " ET · " + d.toISOString().slice(0, 16).replace("T", " ") + " UTC"
  );
};
