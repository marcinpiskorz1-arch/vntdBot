import Database from "better-sqlite3";
import { config } from "../src/config.js";
const db = new Database(config.dbPath, { readonly: true });

const vid = process.argv[2] || "8403991361";

console.log(`=== Looking for vinted_id: ${vid} ===\n`);

const item = db.prepare(`SELECT * FROM items WHERE vinted_id = @vid`).get({ vid }) as Record<string, unknown> | undefined;
console.log("ITEM:", item ? JSON.stringify(item, null, 2) : "NOT FOUND");

const dec = db.prepare(`SELECT * FROM decisions WHERE vinted_id = @vid`).get({ vid });
console.log("\nDECISION:", dec ? JSON.stringify(dec, null, 2) : "NOT FOUND");

if (item) {
  const brand = item.brand as string;
  const title = item.title as string;
  const size = (item.size as string) || "";

  // Simulate normalizeSizeGroup
  const sizeMatch = size.trim().toUpperCase().match(/(\d{2,3}(?:[.,]\d)?)/);
  const sizeGroup = sizeMatch ? String(Math.floor(parseFloat(sizeMatch[1].replace(",", ".")))) : "";

  console.log(`\nBrand: ${brand}, Size: ${size}, SizeGroup: ${sizeGroup}, Title: ${title}`);

  // Check size-specific price history
  const phSize = db.prepare(`SELECT * FROM price_history WHERE brand = @brand AND size_group = @sg ORDER BY updated_at DESC LIMIT 3`).all({ brand, sg: sizeGroup });
  console.log(`\nPRICE HISTORY (brand=${brand}, size_group=${sizeGroup}):`, JSON.stringify(phSize, null, 2));

  // Check fallback (no size)
  const phNoSize = db.prepare(`SELECT * FROM price_history WHERE brand = @brand AND size_group = '' ORDER BY updated_at DESC LIMIT 5`).all({ brand });
  console.log(`\nPRICE HISTORY FALLBACK (brand=${brand}, size_group=''):`, JSON.stringify(phNoSize, null, 2));

  // Check what raw prices exist for this brand in last 14 days
  const rawCount = db.prepare(`SELECT COUNT(*) as cnt FROM items WHERE brand = @brand AND discovered_at >= datetime('now', '-14 days')`).get({ brand });
  console.log(`\nRAW ITEMS (brand=${brand}, last 14d):`, rawCount);

  // Check dealThreshold
  const dealThreshold = 0.35;
  const requiredDiscount = (1 - dealThreshold) * 100;
  console.log(`\nDEAL THRESHOLD: ${dealThreshold} → requires ${requiredDiscount}% discount`);

  // Try to compute what pricing agent would see
  for (const ph of [...phSize, ...phNoSize] as Array<Record<string, unknown>>) {
    const median = ph.median_price as number;
    const price = item.price as number;
    const discount = median > 0 ? ((1 - price / median) * 100) : 0;
    console.log(`  Median ${median.toFixed(1)}, Price ${price}, Discount ${discount.toFixed(1)}%, Underpriced: ${discount >= requiredDiscount} (cat=${ph.category}, sg=${ph.size_group}, samples=${ph.sample_count})`);
  }
}

db.close();
