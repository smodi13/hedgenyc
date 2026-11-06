// Copies the supplied research assets byte-for-byte into public/downloads (never edits them).
import { copyFileSync, mkdirSync } from "node:fs";
const files = [
  ["research/HedgeNYC_Executive_Research_Brief.pdf"],
  ["research/HedgeNYC_Three_Owner_Education_Briefs.pdf"],
  ["research/prospects.csv"],
  ["research/prospects.json"],
  ["research/markets.json"],
  ["research/sources.csv"],
  ["model/HedgeNYC_Formula_Driven_Hedging_Model.xlsx"],
];
mkdirSync("public/downloads", { recursive: true });
for (const [f] of files) copyFileSync(f, "public/downloads/" + f.split("/").pop());
console.log("synced", files.length, "downloads");
