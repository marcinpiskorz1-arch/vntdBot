import type { ScanConfig } from "../types.js";

// ============================================================
// Vinted catalog category IDs — used to narrow API results
// ============================================================

/** All shoe sub-categories on Vinted (men + women + sport + outdoor) */
const SHOES = [2961, 2711, 2952, 2955, 2695, 2713, 2706, 2960, 2945, 2954, 2694, 2682, 2710, 2697, 2951, 2691];

/** Jacket / coat sub-categories */
const JACKETS = [2616, 2563, 2611, 2937, 2534, 1335];

/** Bags / backpacks */
const BAGS = [2758];

/** Shoes + jackets + bags combined */
const SHOES_JACKETS_BAGS = [...SHOES, ...JACKETS, ...BAGS];

/**
 * Hardcoded scan configs — what the bot searches for on Vinted/OLX.
 * `priority: true` = scanned every cycle (hype models).
 * Others = scanned every 2nd cycle (full scan).
 *
 * High-volume brands (Nike, Adidas, Jordan, etc.) are split into
 * shoes-only and jackets+bags queries with categoryIds to reduce
 * noise from t-shirts/pants/accessories that flood the API results.
 */
export const scanConfigs: ScanConfig[] = [
  // ============================================================
  // High-volume brands — split by category to catch more items
  // ============================================================
  // Nike — tylko buty
  { searchText: "nike", brandIds: [53], categoryIds: SHOES },
  // Jordan — buty only (Jordan = almost exclusively shoes)
  { searchText: "jordan", brandIds: [2703], categoryIds: SHOES },
  // Adidas — buty
  { searchText: "adidas", brandIds: [14], categoryIds: SHOES },
  // Adidas — dresy (tracksuit pants)
  { searchText: "adidas dresy", brandIds: [14] },
  // New Balance — buty
  { searchText: "new balance", brandIds: [1775], categoryIds: SHOES },
  // Under Armour — buty
  { searchText: "under armour", brandIds: [52035], categoryIds: SHOES },
  // Asics — buty
  { searchText: "asics", brandIds: [1195], categoryIds: SHOES },
  // Vans — buty
  { searchText: "vans", brandIds: [139], categoryIds: SHOES },
  // Converse — buty
  { searchText: "converse", brandIds: [11445], categoryIds: SHOES },
  // The North Face — kurtki + torby (main resale value)
  { searchText: "the north face", brandIds: [2319], categoryIds: [...JACKETS, ...BAGS] },
  // The North Face — buty
  { searchText: "the north face", brandIds: [2319], categoryIds: SHOES },
  // Salomon — buty
  { searchText: "salomon", brandIds: [15457], categoryIds: SHOES },
  // Jordan — modele (priority: skanowane co cykl)
  { searchText: "jordan 1", priority: true },
  { searchText: "jordan 3", priority: true },
  { searchText: "jordan 4", priority: true },
  { searchText: "jordan 5", priority: true },
  { searchText: "jordan 11", priority: true },
  // New Balance — modele hype
  { searchText: "new balance 550", priority: true },
  { searchText: "new balance 574", priority: true },
  { searchText: "new balance 990", priority: true },
  { searchText: "new balance 2002r", priority: true },
  { searchText: "new balance 530", priority: true },
  // Asics — modele
  { searchText: "asics gel lyte", priority: true },
  { searchText: "asics gel kayano", priority: true },
  // Onitsuka Tiger
  { searchText: "onitsuka tiger" },
  // Nike — popularne modele (priority: skanowane co cykl)
  { searchText: "nike air max", priority: true },
  { searchText: "nike dunk", priority: true },
  { searchText: "nike cortez", priority: true },
  { searchText: "nike blazer", priority: true },
  { searchText: "nike metcon", priority: true },
  { searchText: "nike air force", priority: true },
  { searchText: "nike vapormax", priority: true },
  { searchText: "nike pegasus", priority: true },
  { searchText: "nike tech fleece", priority: true },
  { searchText: "nike sb", priority: true },
  // Adidas — popularne modele
  { searchText: "adidas samba", priority: true },
  { searchText: "adidas gazelle", priority: true },
  { searchText: "adidas superstar", priority: true },
  { searchText: "adidas ultraboost", priority: true },
  { searchText: "adidas nmd", priority: true },
  { searchText: "adidas yeezy", priority: true },
  { searchText: "adidas spezial", priority: true },
  { searchText: "adidas forum", priority: true },
  { searchText: "adidas terrex", priority: true },
  // Outdoor / góry
  { searchText: "la sportiva" },
  { searchText: "salewa" },
  // Salomon — modele hype
  { searchText: "salomon xt-6", priority: true },
  { searchText: "salomon speedcross", priority: true },
  { searchText: "salomon xt-4", priority: true },
  { searchText: "mammut", brandIds: [209084], categoryIds: SHOES_JACKETS_BAGS },
  { searchText: "scarpa" },
  { searchText: "norrøna" },
  { searchText: "haglöfs" },
  { searchText: "revolutionrace" },
  { searchText: "hunter boots" },

  { searchText: "dynafit" },
  { searchText: "merrell" },
  { searchText: "peak performance" },
  { searchText: "rab", categoryIds: [5] },
  { searchText: "millet" },
  { searchText: "meindl" },
  { searchText: "lowa" },
  { searchText: "osprey" },
  // Streetwear / hype
  // TNF — modele z wysokim resale
  { searchText: "north face nuptse", priority: true },
  { searchText: "north face 1996", priority: true },
  { searchText: "north face denali", priority: true },
  { searchText: "north face duffel", priority: true },
  { searchText: "fjällräven" },
  { searchText: "nervous" },
  { searchText: "carhartt", brandIds: [362], categoryIds: [...JACKETS, ...BAGS, ...SHOES] },
  { searchText: "dickies", brandIds: [65] },
  { searchText: "stüssy" },
  { searchText: "napapijri" },
  { searchText: "bape" },
  { searchText: "ralph lauren" },
  { searchText: "tommy hilfiger" },
  // Workwear / vintage
  { searchText: "levi's" },
  { searchText: "wrangler" },
  // Snow / board
  { searchText: "volcom" },
  { searchText: "quiksilver" },
  { searchText: "burton" },
  { searchText: "dc shoes" },
  { searchText: "crocs" },
  { searchText: "ocun" },
  { searchText: "oakley" },
  { searchText: "helly hansen", categoryIds: [...JACKETS, ...SHOES] },
  { searchText: "dakine" },
  // Moto / sport
  { searchText: "alpinestars" },
  { searchText: "fox racing", categoryIds: [5] },
  { searchText: "dainese" },
  // Inne
  { searchText: "save the duck" },
  { searchText: "superdry" },
  // Technologie / materiały premium
  { searchText: "gore-tex" },
  { searchText: "goretex" },
  { searchText: "gortex" },
  { searchText: "windstopper" },
  { searchText: "pertex" },
  { searchText: "primaloft" },
  { searchText: "cordura" },
  { searchText: "vibram" },
  { searchText: "polartec" },
  // Premium / luxury resell
  { searchText: "canada goose" },
  { searchText: "barbour" },
  // Tier 2 resell
  { searchText: "columbia", brandIds: [17161], categoryIds: SHOES_JACKETS_BAGS },
  { searchText: "converse chuck 70", priority: true },
  { searchText: "on running", brandIds: [267947], categoryIds: SHOES },
  { searchText: "on cloudmonster", priority: true },
  // Skate
  { searchText: "santa cruz" },

  // ============================================================
  // High ROI (shipping-friendly) — Electronics + Collectibles + Premium small goods
  // ============================================================

  // Audio / wearables
  { searchText: "airpods", priority: true, categoryIds: [1973] },
  { searchText: "sony wh-1000xm", priority: true, categoryIds: [1973] },
  { searchText: "bose qc", priority: true, categoryIds: [1973] },
  { searchText: "jbl", categoryIds: [1973] },
  { searchText: "garmin fenix", priority: true, categoryIds: [4925] },
  { searchText: "garmin forerunner", priority: true, categoryIds: [4925] },
  { searchText: "garmin instinct", priority: true, categoryIds: [4925] },
  { searchText: "g-shock", priority: true, categoryIds: [2845] },

  // Small tech / gaming peripherals
  { searchText: "kindle", categoryIds: [2194] },



  // Premium accessories
  { searchText: "ray-ban", priority: true, categoryIds: [2736] },
  { searchText: "michael kors" },
  { searchText: "seiko", priority: true, categoryIds: [2845] },
  { searchText: "swatch", categoryIds: [2845] },
  { searchText: "casio", categoryIds: [2845] },
  { searchText: "orient zegarek", categoryIds: [2845] },

  // Outdoor accessories (małe, wysyłkowe)
  { searchText: "petzl" },
  { searchText: "black diamond" },
  { searchText: "leatherman" },
  { searchText: "nalgene" },
  { searchText: "camelbak" },
  { searchText: "shimano" },

  // Telefony
  { searchText: "samsung galaxy s23", categoryIds: [2310] },
  { searchText: "samsung galaxy s24", priority: true, categoryIds: [2310] },
  { searchText: "google pixel", categoryIds: [4885] },

  // Laptopy / komputery
  { searchText: "thinkpad", priority: true, categoryIds: [3108] },
  { searchText: "dell xps", categoryIds: [3104] },

  // Streetwear & outdoor brands (extra brandIds for matching)
  { searchText: "turbokolor" },
];
