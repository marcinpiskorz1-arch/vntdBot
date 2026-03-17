// ============================================================
// Item type classification from title/description keywords.
// Used to separate pricing groups — shoes vs jackets vs shirts vs accessories.
// ============================================================

// Order matters — check more specific patterns first, broadest last.
// Languages: PL EN FR DE IT ES NL CZ SK

const SHOES_PATTERN = /(?:^|[\s,;(\/-])(buty|but[iy]|shoe|shoes|sneaker|sneakers|boot|boots|trampk[iy]|adidasy|klapk[iy]|sandal|sandały|sanda[łl]|runner|trainers?|loafer|mokasyn|boty|topánk[yia]|scarpe|chaussure|Schuh|zapato|schoen|sapato|sko|kenkä|trail|speedcross|supercross|gel[- ]lyte|gel[- ]kayano|air max|air force|dunk|blazer|pegasus|vapormax|samba|gazelle|superstar|ultraboost|campus|forum|spezial|stan smith|chuck 70|cloudmonster|xt-6|xt-4|metcon)/i;

const JACKET_PATTERN = /(?:^|[\s,;(\/-])(kurtk[aięy]|jacket|jackets|parka|parki|coat|p[łl]aszcz|anorak|windbreaker|wiatr[oó]wk|puchówk|puffer|down jacket|softshell|hardshell|nuptse|1996|retro-?x|denali|nano puff|bundy?|bunda|veste|Jacke|giacca|chaqueta|jas|jacka|takki|doudoune)/i;

const TOP_PATTERN = /(?:^|[\s,;(\/-])(top[y]?(?:\s|$)|tank(?:\s|$)|koszulk[aięy]|t-?shirt|tshirt|tee(?:\s|$)|bluz[aęky]|blouse|hoodie|sweatshirt|bluza|polar|fleece|longsleeve|long sleeve|sweater|sweter|jumper|pullover|polo|tank top|kamizelk[aięy]|vest|crop top|crewneck|crew neck|triko|tričko|mikina|maglia|camiseta|camisa|chemise|Hemd|overhemd|tröja|paita|shirt)/i;

const PANTS_PATTERN = /(?:^|[\s,;(\/-])(spodnie|spodni|pants|trousers|jeans|dżinsy|shorts|szorty|kr[oó]tkie|legginsy|leggings|jogger|cargo|chinosy|chinos|kalhoty|nohavice|pantalon|Hose|pantaloni|pantalones|broek|byxor|housut)/i;

const BAG_PATTERN = /(?:^|[\s,;(\/-])(plecak|backpack|torb[aęy]|bag|duffel|tote|saszetk|fanny pack|nerka|bum bag|worek|sack|black hole|rucksack|batoh|sac|Tasche|borsa|bolsa|mochila|väska|ryggsäck|reppu|laukku)/i;

const HEADWEAR_PATTERN = /(?:^|[\s,;(\/-])(czapk[aięy]|cap|hat|beanie|kapelusz|beret|headband|opask[aię]|bandana|šiltovk|čepice|klobouk|cappello|gorra|sombrero|hoed|keps|mössa|hattu|kepurė)/i;

const ACCESSORY_PATTERN = /(?:^|[\s,;(\/-])(r[ęe]kawiczk|gloves|szalik|scarf|pasek|belt|portfel|wallet|okulary|sunglasses|gogle|goggles|zegarek|watch|bielizn|underwear|skarpet|socks|gaitr|gaiter|stuptuty|getry)/i;

export type ItemType = "shoes" | "jacket" | "top" | "pants" | "bag" | "headwear" | "accessory" | "";

/**
 * Classify an item into a broad type from its title.
 * Returns empty string if no confident match — keeps current behavior.
 * Pure function, no side effects.
 */
export function classifyItemType(title: string): ItemType {
  if (SHOES_PATTERN.test(title)) return "shoes";
  if (JACKET_PATTERN.test(title)) return "jacket";
  if (PANTS_PATTERN.test(title)) return "pants";
  if (BAG_PATTERN.test(title)) return "bag";
  if (HEADWEAR_PATTERN.test(title)) return "headwear";
  if (ACCESSORY_PATTERN.test(title)) return "accessory";
  // Top last — many vague titles contain "shirt" in brand model names
  if (TOP_PATTERN.test(title)) return "top";
  return "";
}

// ============================================================
// Brand-specific item type restrictions.
// Only these item types are worth notifying for each brand group.
// ============================================================

/** Brands where ONLY shoes have real resale value */
const SHOES_ONLY_BRANDS = new Set([
  "jordan", "air jordan", "nike sb", "asics", "new balance",
  "vans", "converse", "on running", "hoka", "saucony", "brooks",
  "dc shoes", "merrell", "lowa", "meindl", "scarpa", "la sportiva",
  "crocs", "dr. martens", "dr martens",
]);

/** Brands where only shoes + jackets + bags have resale value */
const SHOES_JACKETS_BAGS_BRANDS = new Set([
  "the north face",
  "mammut", "salewa", "salomon", "norrøna", "haglöfs",
  "canada goose", "fjallraven", "fjällräven",
]);

/**
 * Check if a brand + item type combination is worth notifying.
 * Returns true if the item should pass through, false if it should be blocked.
 * Brands not in any restriction set always pass.
 */
export function isBrandTypeWorthNotifying(brand: string, itemType: ItemType): boolean {
  const b = brand.toLowerCase().trim();
  if (!b || !itemType) return true; // unknown brand or type — let through

  if (SHOES_ONLY_BRANDS.has(b)) {
    return itemType === "shoes";
  }

  if (SHOES_JACKETS_BAGS_BRANDS.has(b)) {
    return itemType === "shoes" || itemType === "jacket" || itemType === "bag";
  }

  return true;
}
