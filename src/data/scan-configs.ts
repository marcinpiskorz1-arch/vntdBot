import type { ScanConfig } from "../types.js";

// ============================================================
// Vinted catalog category IDs — used to narrow API results
// ============================================================

/** All shoe sub-categories on Vinted (men + women + sport + outdoor) */
const SHOES = [2961, 2711, 2952, 2955, 2695, 2713, 2706, 2960, 2945, 2954, 2694, 2682, 2710, 2697, 2951, 2691];

// TEMP: JACKETS, BAGS, SHOES_JACKETS_BAGS disabled — shoes-only mode
// const JACKETS = [2616, 2563, 2611, 2937, 2534, 1335];
// const BAGS = [2758];
// const SHOES_JACKETS_BAGS = [...SHOES, ...JACKETS, ...BAGS];

/**
 * Brand-level catch-all queries — one API call per brand catches ALL shoe listings.
 * No searchText = Vinted filters by brandId + categoryIds only.
 *
 * `priority: true` = scanned every cycle (1 page, 96 items).
 * Others = scanned every 2nd cycle (1 page, 96 items).
 */
export const scanConfigs: ScanConfig[] = [
  // ============================================================
  // Priority — high-volume brands (many listings, fast-moving)
  // ============================================================
  { brandIds: [14], priority: true, categoryIds: SHOES },      // adidas
  { brandIds: [53], priority: true, categoryIds: SHOES },      // nike
  { brandIds: [1195], priority: true, categoryIds: SHOES },    // asics
  { brandIds: [1775], priority: true, categoryIds: SHOES },    // new balance
  { brandIds: [2703], priority: true, categoryIds: SHOES },    // jordan
  { brandIds: [15457], priority: true, categoryIds: SHOES },   // salomon
  { brandIds: [201320], priority: true, categoryIds: SHOES },  // la sportiva
  { brandIds: [2319], priority: true, categoryIds: SHOES },    // the north face
  { searchText: "reebok", priority: true, categoryIds: SHOES },  // reebok
  { searchText: "gore-tex", priority: true, categoryIds: SHOES },
  { searchText: "goretex", priority: true, categoryIds: SHOES },

  // ============================================================
  // Non-priority — lower volume brands (every 2nd cycle)
  // ============================================================
  { brandIds: [11445], categoryIds: SHOES },   // converse
  { brandIds: [52035], categoryIds: SHOES },   // under armour
  { brandIds: [33863], categoryIds: SHOES },   // onitsuka tiger
  { brandIds: [23853], categoryIds: SHOES },   // scarpa
  { brandIds: [98860], categoryIds: SHOES },   // merrell
  { brandIds: [60412], categoryIds: SHOES },   // salewa
  { brandIds: [279381] },                      // black diamond
  { brandIds: [11943], categoryIds: SHOES },   // crocs
  { brandIds: [465062], categoryIds: SHOES },  // zamberlan
  { brandIds: [103034], categoryIds: SHOES },  // dolomite
  { brandIds: [233698], categoryIds: SHOES },  // lowa
  { brandIds: [283168], categoryIds: SHOES },  // meindl
  { brandIds: [468642], categoryIds: SHOES },  // dachstein
  { brandIds: [348408], categoryIds: SHOES },  // dynafit
  { searchText: "hoka", categoryIds: SHOES },  // hoka
  { searchText: "vans", categoryIds: SHOES },   // vans
];

// ============================================================
// Popularity sweep — order: "relevance" (Vinted algorithmic sort)
// Brand-level queries, 1 page, every 3rd cycle.
// Catches popular items with many favourites that sell fast.
// ============================================================
export const popularityConfigs: ScanConfig[] = [
  { searchText: "adidas", brandIds: [14], order: "relevance", categoryIds: SHOES },
  { searchText: "nike", brandIds: [53], order: "relevance", categoryIds: SHOES },
  { searchText: "asics", brandIds: [1195], order: "relevance", categoryIds: SHOES },
  { searchText: "new balance", brandIds: [1775], order: "relevance", categoryIds: SHOES },
  { searchText: "salomon", brandIds: [15457], order: "relevance", categoryIds: SHOES },
  { searchText: "jordan", brandIds: [2703], order: "relevance", categoryIds: SHOES },
  { searchText: "under armour", brandIds: [52035], order: "relevance", categoryIds: SHOES },
  { searchText: "onitsuka tiger", brandIds: [33863], order: "relevance", categoryIds: SHOES },
  { searchText: "la sportiva", brandIds: [201320], order: "relevance", categoryIds: SHOES },
  { searchText: "scarpa", brandIds: [23853], order: "relevance", categoryIds: SHOES },
  { searchText: "the north face", brandIds: [2319], order: "relevance", categoryIds: SHOES },
  { searchText: "merrell", brandIds: [98860], order: "relevance", categoryIds: SHOES },
  { searchText: "lowa", brandIds: [233698], order: "relevance", categoryIds: SHOES },
  { searchText: "salewa", brandIds: [60412], order: "relevance", categoryIds: SHOES },
  { searchText: "converse", brandIds: [11445], order: "relevance", categoryIds: SHOES },
  { searchText: "reebok", order: "relevance", categoryIds: SHOES },
  { searchText: "hoka", order: "relevance", categoryIds: SHOES },
  { searchText: "vans", order: "relevance", categoryIds: SHOES },
  { searchText: "gore-tex", order: "relevance", categoryIds: SHOES },
];
