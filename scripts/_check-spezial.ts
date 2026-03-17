import Database from "better-sqlite3";
import { classifyItemType } from "../src/item-classifier.js";
import { isBrandTypeWorthNotifying } from "../src/item-classifier.js";
import { extractModel } from "../src/model-extractor.js";

const db = new Database("data/vintedbot.db");

const IDS = ["8416492265", "8409901980", "8416542632"];

for (const id of IDS) {
const item = db.prepare("SELECT * FROM items WHERE vinted_id = @id").get({ id }) as Record<string, unknown> | undefined;
if (!item) { console.log(`\n=== ${id}: NOT IN DATABASE ===\n`); continue; }

console.log("=== ITEM ===");
console.log("Title:", item.title);
console.log("Brand:", item.brand);
console.log("Price:", item.price, item.currency);
console.log("Size:", item.size);
console.log("Category:", item.category);
console.log("Condition:", item.condition);
console.log("Discovered:", item.discovered_at);

const classified = classifyItemType(item.title as string);
console.log("\nclassifyItemType:", JSON.stringify(classified));

const rawItem = {
  vintedId: item.vinted_id as string,
  title: item.title as string,
  brand: item.brand as string,
  price: item.price as number,
  currency: item.currency as string,
  size: item.size as string,
  category: item.category as string,
  condition: item.condition as string,
  description: item.description as string,
  photoUrls: JSON.parse(item.photo_urls as string) as string[],
  sellerRating: item.seller_rating as number,
  sellerTransactions: item.seller_transactions as number,
  listedAt: item.listed_at as string,
  url: item.url as string,
};

console.log("\n=== FILTERS ===");
const filters = [
  ["minPrice(15)", isAboveMinPrice(rawItem, 15)],
  ["notKids", isNotKidsItem(rawItem)],
  ["notHat", isNotHat(rawItem)],
  ["goodCondition", isGoodCondition(rawItem)],
  ["shippable", isShippable(rawItem)],
  ["notJunk", isNotJunk(rawItem)],
  ["notBlockedBrand", isNotBlockedBrand(rawItem)],
  ["notWomensBag", isNotWomensBag(rawItem)],
  ["notVehiclePart", isNotVehiclePart(rawItem)],
  ["notSingleBroken", isNotSingleOrBroken(rawItem)],
  ["notHardwareJunk", isNotHardwareJunk(rawItem)],
  ["inSizeRange", isInSizeRange(rawItem)],
] as const;

for (const [name, result] of filters) {
  console.log(`  ${result ? "PASS" : "FAIL"} ${name}`);
}

// Check decisions table schema
const decCols = db.prepare("SELECT name FROM pragma_table_info('decisions')").all() as Array<{name: string}>;
console.log("\ndecisions columns:", decCols.map(c => c.name).join(", "));

// Try looking up decision by vinted_id or item_id
for (const col of decCols.map(c => c.name)) {
  if (col === "vinted_id" || col === "item_id") {
    const dec = db.prepare(`SELECT * FROM decisions WHERE ${col} = @id`).get({ id: item.vinted_id ?? item.id });
    if (dec) {
      console.log(`\nDECISION (by ${col}):`, JSON.stringify(dec, null, 2));
    }
  }
}

db.close();
