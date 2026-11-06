import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); if (row.some((c) => c !== "")) rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

export interface SourceRow { id: string; document: string; url: string; kind: string; supports: string }

export function loadSources(): SourceRow[] {
  const [, ...rows] = parseCsv(readFileSync(path.join(process.cwd(), "research/sources.csv"), "utf8"));
  return rows.map(([id, document, url, kind, supports]) => ({ id: id!, document: document!, url: url!, kind: kind!, supports: supports! }));
}

export interface DownloadFile { file: string; title: string; kind: string; blurb: string; bytes: number; sha: string }

const DL: [string, string, string, string][] = [
  ["HedgeNYC_Executive_Research_Brief.pdf", "Executive research brief", "PDF · research report", "The full research report. An independent work product, not a Kalshi-approved client document."],
  ["HedgeNYC_Three_Owner_Education_Briefs.pdf", "Three owner education briefs", "PDF · business briefs", "Brooklyn Sail, Xentra Transport and Arborpolitan. Educational, hypothetical, not client advice."],
  ["HedgeNYC_Formula_Driven_Hedging_Model.xlsx", "Formula-driven hedging model", "XLSX · live formulas", "Unchanged analyst workbook. Edit the blue cells; all derived values are formulas."],
  ["prospects.csv", "Prospect database", "CSV · 47 records", "Every business with evidence tier, hypothesis, score and diligence step."],
  ["prospects.json", "Prospect database", "JSON · 47 records", "The same dataset as validated by this site at build time."],
  ["markets.json", "Market discovery records", "JSON · 5 records", "Dated discoveries, not live prices."],
  ["sources.csv", "Source register", "CSV · 36 sources", "Original evidence URLs and what each supports."],
];

export function loadDownloads(): DownloadFile[] {
  return DL.map(([file, title, kind, blurb]) => {
    const p = path.join(process.cwd(), "public/downloads", file);
    const buf = readFileSync(p);
    return { file, title, kind, blurb, bytes: statSync(p).size, sha: createHash("sha256").update(buf).digest("hex") };
  });
}
