import Database from "better-sqlite3";
const db = new Database("./data/vintedbot.db");

const rows = db.prepare(`
  SELECT brand, COUNT(*) as cnt, MAX(discovered_at) as latest 
  FROM items 
  WHERE discovered_at > datetime('now', '-1 day')
  GROUP BY brand 
  ORDER BY cnt DESC 
  LIMIT 20
`).all() as any[];

console.log("Top brands by volume (last 24h):");
for (const r of rows) {
  console.log(`  ${r.brand.padEnd(20)} ${String(r.cnt).padStart(5)} items | latest: ${r.latest}`);
}

// Check how many pages worth of data we get per brand
console.log("\n--- Volume vs capacity (2 pages = 192 items per scan) ---");
const bigBrands = rows.filter((r: any) => r.cnt > 150);
for (const r of bigBrands) {
  const pagesNeeded = Math.ceil(r.cnt / 96);
  console.log(`  ${r.brand.padEnd(20)} needs ~${pagesNeeded} pages/day, bot fetches 2 → ${pagesNeeded > 2 ? "⚠️ MISSING ITEMS" : "OK"}`);
}

db.close();
