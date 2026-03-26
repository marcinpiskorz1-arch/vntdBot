// ============================================================
// Item type classification from title/description keywords.
// Used to separate pricing groups — shoes vs jackets vs shirts vs accessories.
// ============================================================

// Order matters — check more specific patterns first, broadest last.
// Languages: PL EN FR DE IT ES NL CZ SK

const SHOES_PATTERN = /(?:^|[\s,;(\/-])(buty|but[iy]|shoe|shoes|sneaker|sneakers|boot|boots|chukka|trampk[iy]|adidasy|runner|trainers?|loafer|mokasyn|boty|topánk[yia]|scarpe|chaussure|Schuh|zapato|schoen|sapato|sko|kenk[äa]|kengät|cipő|patike|speedcross|supercross|gel[- ]lyte|gel[- ]kayano|air max|air force|dunk|blazer|pegasus|vapormax|samba|gazelle|superstar|ultraboost|campus|forum|spezial|stan smith|chuck 70|cloudmonster|xt-6|xt-4|metcon)/i;

const JACKET_PATTERN = /(?:^|[\s,;(\/-])(kurtk[aięy]|jacket|jackets|parka|parki|coat|p[łl]aszcz|anorak|windbreaker|wiatr[oó]wk|puchówk|puffer|down jacket|softshell|hardshell|bundy?|bunda|veste|Jacke|giacca|chaqueta|jas|jacka|takki|doudoune)/i;

const TOP_PATTERN = /(?:^|[\s,;(\/-])(top[y]?(?:\s|$)|tank(?:\s|$)|koszulk[aięy]|t-?shirt|tshirt|tee(?:\s|$)|bluz[aęky]|blouse|hoodie|sweatshirt|bluza|polar|fleece|longsleeve|long sleeve|sweater|sweter|jumper|pullover|polo|tank top|kamizelk[aięy]|vest|crop top|crewneck|crew neck|triko|tričko|mikina|maglia|camiseta|camisa|chemise|Hemd|overhemd|tröja|paita|shirt)/i;

const PANTS_PATTERN = /(?:^|[\s,;(\/-])(spodnie|spodni|spodenk[iy]|pants|trousers|jeans|dżinsy|shorts|szorty|kr[oó]tkie|legginsy|leggings|jogger|cargo|chinosy|chinos|kalhoty|nohavice|pantalon|Hose|pantaloni|pantalones|broek|byxor|housut)/i;

const BAG_PATTERN = /(?:^|[\s,;(\/-])(plecak|backpack|torb[aęy]|bag|duffel|tote|saszetk|fanny pack|nerka|bum bag|worek|sack|black hole|rucksack|batoh|sac|Tasche|borsa|bolsa|mochila|väska|ryggsäck|reppu|laukku)/i;

const HEADWEAR_PATTERN = /(?:^|[\s,;(\/-])(czapk[aięy]|cap|hat|beanie|kapelusz|beret|headband|opask[aię]|bandana|šiltovk|čepice|klobouk|cappello|gorra|sombrero|hoed|keps|mössa|hattu|kepurė)/i;

const ACCESSORY_PATTERN = /(?:^|[\s,;(\/-])(r[ęe]kawiczk|gloves|szalik|scarf|pasek|belt|portfel|wallet|okulary|sunglasses|gogle|goggles|zegarek|watch|bielizn|underwear|stopk|skarpet|socks|gaitr|gaiter|stuptuty|getry)/i;

// Unambiguous top-clothing words that MUST take priority over shoe model names.
// Prevents "Bluza Nike Air Max" from being classified as shoes.
const STRONG_TOP_PATTERN = /(?:^|[\s,;(\/-])(bluz[aęky]|koszulk[aięy]|koszul[aęiy]|hoodie|sweatshirt|pullover|crewneck|crew neck|longsleeve|long sleeve|mikina|tričko|triko)/i;

export type ItemType = "shoes" | "jacket" | "top" | "pants" | "bag" | "headwear" | "accessory" | "";

// ============================================================
// Vinted catalog_id → ItemType mapping.
// Vinted API returns numeric subcategory IDs; we map them to our types
// so pricing pools aren't fragmented across dozens of numeric IDs.
// ============================================================

const VINTED_CATEGORY_MAP: Record<string, ItemType> = {
  // Shoes — men's, women's, sport, outdoor, sneakers
  "2684": "shoes", // espadryle/sneakers
  "2955": "shoes", // buty sportowe (Jordan, Samba, ASICS)
  "2711": "shoes", // buty męskie (Nike AF1, adidas)
  "2961": "shoes", // buty sportowe (Air Max, Dunk, Shox)
  "2691": "shoes", // mokasyny (Nike, Timberland)
  "2706": "shoes", // buty męskie mokasyny (NB, Nike)
  "2695": "shoes", // trampki (Converse, adidas, Vans)
  "2952": "shoes", // damskie sneakersy (Nike, NB, Puma)
  "2713": "shoes", // męskie sneakersy (Nike, adidas)
  "2954": "shoes", // buty do biegania (Asics, Nike, Salomon)
  "2960": "shoes", // buty trekkingowe/outdoor (Salomon, Lowa, TNF)
  "2697": "shoes", // buty damskie (Nike, Converse, NB)
  "734":  "shoes", // buty dziecięce (filtered by kids filter separately)
  // Tops — t-shirts, hoodies, sport jerseys
  "2632": "top",   // koszulki/t-shirty męskie
  "2586": "top",   // bluzy/hoodies męskie
  "2936": "top",   // koszulki sportowe/jerseys
  // Jackets
  "1929": "jacket", // odzież narciarska (kurtki)
  // Accessories — watches, electronics
  "2845": "accessory", // zegarki
};

/**
 * Map Vinted numeric catalog_id to our ItemType.
 * Returns empty string for unknown/unmapped categories.
 */
export function vintedCategoryToItemType(catalogId: string): ItemType {
  return VINTED_CATEGORY_MAP[catalogId] ?? "";
}

/**
 * Classify an item into a broad type from its title.
 * Returns empty string if no confident match — keeps current behavior.
 * Pure function, no side effects.
 */
export function classifyItemType(title: string): ItemType {
  // Strong top words first — "Bluza Nike Air Max" is a top, not shoes
  if (STRONG_TOP_PATTERN.test(title)) return "top";
  if (SHOES_PATTERN.test(title)) return "shoes";
  if (JACKET_PATTERN.test(title)) return "jacket";
  if (PANTS_PATTERN.test(title)) return "pants";
  if (BAG_PATTERN.test(title)) return "bag";
  if (HEADWEAR_PATTERN.test(title)) return "headwear";
  if (ACCESSORY_PATTERN.test(title)) return "accessory";
  // Weak top last — "shirt" appears in brand model names
  if (TOP_PATTERN.test(title)) return "top";
  return "";
}

/**
 * Resolve item type using title keywords first, then Vinted catalog_id fallback.
 * Use this wherever you need a normalized category — never raw numeric IDs.
 */
export function resolveItemType(title: string, vintedCategoryId: string): ItemType {
  return classifyItemType(title) || vintedCategoryToItemType(vintedCategoryId);
}

// ============================================================
// Brand-specific item type restrictions.
// Only these item types are worth notifying for each brand group.
// ============================================================

/** All tracked brands — only shoes are worth notifying */
const KNOWN_BRANDS = new Set([
  // Streetwear / sport
  "nike", "nike air", "nike sb", "adidas", "jordan", "air jordan",
  "asics", "new balance", "under armour", "onitsuka tiger",
  "converse", "vans", "on running", "hoka", "saucony", "brooks",
  "dc shoes", "crocs", "puma",
  // Outdoor
  "the north face", "salomon", "salewa", "la sportiva", "scarpa",
  "merrell", "lowa", "meindl", "dynafit", "dachstein",
  "zamberlan", "dolomite", "black diamond", "mammut",
  "arc'teryx", "arcteryx", "norrøna", "haglöfs",
  "canada goose", "fjallraven", "fjällräven",
]);

/**
 * Check if a brand + item type combination is worth notifying.
 * Returns true if the item should pass through, false if it should be blocked.
 * Brands not in any restriction set always pass.
 */
export function isBrandTypeWorthNotifying(brand: string, itemType: ItemType): boolean {
  const b = brand.toLowerCase().trim();
  if (!b) return true; // unknown brand — let through

  if (KNOWN_BRANDS.has(b)) {
    return itemType === "shoes";
  }

  return true;
}
