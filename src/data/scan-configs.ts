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
 * Model-focused queries — each query targets a specific resale-worthy model.
 * All have categoryIds: SHOES to filter accessories.
 *
 * `priority: true` = scanned every cycle (2 pages, 192 items).
 * Others = scanned every 2nd cycle (1 page, 96 items).
 */
export const scanConfigs: ScanConfig[] = [
  // ============================================================
  // Priority — hype models (fast-moving, high resale value)
  // ============================================================
  { searchText: "adidas samba", brandIds: [14], priority: true, categoryIds: SHOES },
  { searchText: "adidas gazelle", brandIds: [14], priority: true, categoryIds: SHOES },
  { searchText: "adidas spezial", brandIds: [14], priority: true, categoryIds: SHOES },
  { searchText: "adidas bold", brandIds: [14], priority: true, categoryIds: SHOES },
  { searchText: "nike air max", brandIds: [53], priority: true, categoryIds: SHOES },
  { searchText: "nike air force", brandIds: [53], priority: true, categoryIds: SHOES },
  { searchText: "nike metcon", brandIds: [53], priority: true, categoryIds: SHOES },
  { searchText: "asics gel", brandIds: [1195], priority: true, categoryIds: SHOES },
  { searchText: "onitsuka tiger", brandIds: [33863], priority: true, categoryIds: SHOES },
  { searchText: "new balance 574", brandIds: [1775], priority: true, categoryIds: SHOES },
  { searchText: "new balance 530", brandIds: [1775], priority: true, categoryIds: SHOES },
  { searchText: "new balance 550", brandIds: [1775], priority: true, categoryIds: SHOES },
  { searchText: "under armour", brandIds: [52035], priority: true, categoryIds: SHOES },

  // ============================================================
  // Priority — outdoor premium (high margin)
  // ============================================================
  { searchText: "la sportiva", brandIds: [201320], priority: true, categoryIds: SHOES },
  { searchText: "scarpa", brandIds: [23853], priority: true, categoryIds: SHOES },
  { searchText: "zamberlan", brandIds: [465062], categoryIds: SHOES },
  { searchText: "dolomite", brandIds: [103034], categoryIds: SHOES },
  { searchText: "lowa", brandIds: [233698], categoryIds: SHOES },
  { searchText: "meindl", brandIds: [283168], categoryIds: SHOES },
  { searchText: "dachstein", brandIds: [468642], categoryIds: SHOES },
  { searchText: "dynafit", brandIds: [348408], categoryIds: SHOES },
  { searchText: "salomon", brandIds: [15457], priority: true, categoryIds: SHOES },
  { searchText: "merrell", brandIds: [98860], priority: true, categoryIds: SHOES },
  { searchText: "salewa", brandIds: [60412], priority: true, categoryIds: SHOES },
  { searchText: "black diamond", brandIds: [279381], priority: true },
  { searchText: "the north face", brandIds: [2319], priority: true, categoryIds: SHOES },
  { searchText: "gore-tex", priority: true, categoryIds: SHOES },
  { searchText: "goretex", priority: true, categoryIds: SHOES },

  // ============================================================
  // High — streetwear / other models (every 2nd cycle)
  // ============================================================
  { searchText: "jordan", brandIds: [2703], categoryIds: SHOES },
  { searchText: "nike cortez", brandIds: [53], categoryIds: SHOES },
  { searchText: "nike vapormax", brandIds: [53], categoryIds: SHOES },
  { searchText: "adidas superstar", brandIds: [14], categoryIds: SHOES },
  { searchText: "adidas ultraboost", brandIds: [14], categoryIds: SHOES },
  { searchText: "adidas terrex", brandIds: [14], categoryIds: SHOES },
  { searchText: "converse run star", brandIds: [11445], categoryIds: SHOES },

  // ============================================================
  // Catch-all — brandId-only, no searchText (every 2nd cycle)
  // Catches generic listings like "adidasy", "conversy", "sko asics"
  // that model-specific queries miss.
  // ============================================================
  { brandIds: [14], categoryIds: SHOES },      // adidas
  { brandIds: [53], categoryIds: SHOES },      // nike
  { brandIds: [1195], categoryIds: SHOES },    // asics
  { brandIds: [11445], categoryIds: SHOES },   // converse
  { brandIds: [2319], categoryIds: SHOES },    // the north face
  { brandIds: [2703], categoryIds: SHOES },    // jordan
  { brandIds: [1775], categoryIds: SHOES },    // new balance
  { brandIds: [60412], categoryIds: SHOES },   // salewa
  { brandIds: [15457], categoryIds: SHOES },   // salomon
  { brandIds: [201320], categoryIds: SHOES },  // la sportiva
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
  { searchText: "gore-tex", order: "relevance", categoryIds: SHOES },
];
