import { scanConfigs } from "../src/data/scan-configs.js";

console.log("Total configs:", scanConfigs.length);

const withCat = scanConfigs.filter(c => c.categoryIds && c.categoryIds.length > 0);
console.log("With categoryIds:", withCat.length);

const dupes = new Map<string, number>();
for (const c of scanConfigs) {
  const k = c.searchText || "";
  dupes.set(k, (dupes.get(k) || 0) + 1);
}
const multi = [...dupes.entries()].filter(([, v]) => v > 1);
console.log("\nDuplicate searchTexts (split by category):");
for (const [k, v] of multi) {
  console.log(`  "${k}" → ${v} queries`);
}
console.log("\nUnique searchTexts:", dupes.size);

// Simulate OLX dedup
const olxSeen = new Set<string>();
let olxCount = 0;
for (const { searchText } of scanConfigs) {
  if (searchText && !olxSeen.has(searchText)) {
    olxSeen.add(searchText);
    olxCount++;
  }
}
console.log(`\nOLX queries (after dedup): ${olxCount}`);
console.log(`Vinted queries: ${scanConfigs.length}`);
