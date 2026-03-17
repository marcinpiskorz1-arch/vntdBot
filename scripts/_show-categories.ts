import { scanConfigs } from "../src/data/scan-configs.js";

const SHOES = [2961, 2711, 2952, 2955, 2695, 2713, 2706, 2960, 2945, 2954, 2694, 2682, 2710, 2697, 2951, 2691];
const JACKETS = [2616, 2563, 2611, 2937, 2534, 1335];
const BAGS = [2758];

function classifyCatIds(catIds: number[] | undefined): string {
  if (!catIds || catIds.length === 0) return "🌐 BEZ FILTRA (wszystko)";
  
  const hasShoes = catIds.some(id => SHOES.includes(id));
  const hasJackets = catIds.some(id => JACKETS.includes(id));
  const hasBags = catIds.some(id => BAGS.includes(id));
  const otherIds = catIds.filter(id => !SHOES.includes(id) && !JACKETS.includes(id) && !BAGS.includes(id));
  
  const parts: string[] = [];
  if (hasShoes) parts.push("👟 buty");
  if (hasJackets) parts.push("🧥 kurtki");
  if (hasBags) parts.push("🎒 torby");
  if (otherIds.length > 0) parts.push(`📦 inne(${otherIds.join(",")})`);
  
  return parts.join(" + ");
}

// Group by type
const shoesOnly: string[] = [];
const jacketsOnly: string[] = [];
const shoesJacketsBags: string[] = [];
const specificCat: string[] = [];
const noFilter: string[] = [];

for (const c of scanConfigs) {
  const label = `${c.searchText || ""}${c.priority ? " ⚡" : ""}`;
  const catLabel = classifyCatIds(c.categoryIds);
  
  if (!c.categoryIds || c.categoryIds.length === 0) {
    noFilter.push(label);
  } else {
    const hasShoes = c.categoryIds.some(id => SHOES.includes(id));
    const hasJackets = c.categoryIds.some(id => JACKETS.includes(id));
    const hasBags = c.categoryIds.some(id => BAGS.includes(id));
    const hasOther = c.categoryIds.some(id => !SHOES.includes(id) && !JACKETS.includes(id) && !BAGS.includes(id));
    
    if (hasShoes && !hasJackets && !hasBags && !hasOther) {
      shoesOnly.push(label);
    } else if (hasJackets && !hasShoes && !hasOther) {
      jacketsOnly.push(`${label}${hasBags ? " +torby" : ""}`);
    } else if (hasShoes && hasJackets) {
      shoesJacketsBags.push(`${label}${hasBags ? " +torby" : ""}`);
    } else {
      specificCat.push(`${label} → ${catLabel}`);
    }
  }
}

console.log("=== 👟 TYLKO BUTY ===");
for (const s of shoesOnly) console.log(`  ${s}`);

console.log(`\n=== 🧥 TYLKO KURTKI (+torby) ===`);
for (const s of jacketsOnly) console.log(`  ${s}`);

console.log(`\n=== 👟🧥🎒 BUTY + KURTKI + TORBY ===`);
for (const s of shoesJacketsBags) console.log(`  ${s}`);

console.log(`\n=== 📦 SPECYFICZNE KATEGORIE ===`);
for (const s of specificCat) console.log(`  ${s}`);

console.log(`\n=== 🌐 BEZ FILTRA (łapie wszystko — koszulki, spodenki, czapki...) ===`);
for (const s of noFilter) console.log(`  ${s}`);

console.log(`\n--- PODSUMOWANIE ---`);
console.log(`Tylko buty:           ${shoesOnly.length} queries`);
console.log(`Tylko kurtki/torby:   ${jacketsOnly.length} queries`);
console.log(`Buty+kurtki+torby:    ${shoesJacketsBags.length} queries`);
console.log(`Specyficzne:          ${specificCat.length} queries`);
console.log(`Bez filtra:           ${noFilter.length} queries`);
console.log(`RAZEM:                ${scanConfigs.length} queries`);
