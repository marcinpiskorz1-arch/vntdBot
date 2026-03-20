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
 * Shoes-only mode — all queries have categoryIds: SHOES.
 *
 * `priority: true` = scanned every cycle (2 pages, 192 items).
 * Others = scanned every 2nd cycle (1 page, 96 items).
 */
export const scanConfigs: ScanConfig[] = [
  // ============================================================
  // Priority — scanned every cycle (high-value / fast-moving)
  // ============================================================
  { searchText: "adidas samba", brandIds: [14], priority: true, categoryIds: SHOES },
  { searchText: "adidas gazelle", brandIds: [14], priority: true, categoryIds: SHOES },
  { searchText: "adidas spezial", brandIds: [14], priority: true, categoryIds: SHOES },
  { searchText: "salomon speedcross", brandIds: [15457], priority: true, categoryIds: SHOES },
  { searchText: "nike air max", brandIds: [53], priority: true, categoryIds: SHOES },
  { searchText: "nike metcon", brandIds: [53], priority: true, categoryIds: SHOES },
  { searchText: "asics", brandIds: [1195], priority: true, categoryIds: SHOES },
  { searchText: "onitsuka tiger", brandIds: [33863], priority: true, categoryIds: SHOES },
  { searchText: "la sportiva", brandIds: [201320], priority: true, categoryIds: SHOES },
  { searchText: "scarpa", brandIds: [23853], priority: true, categoryIds: SHOES },
  { searchText: "dynafit", brandIds: [348408], priority: true, categoryIds: SHOES },
  { searchText: "salomon", brandIds: [15457], priority: true, categoryIds: SHOES },
  { searchText: "lowa", brandIds: [233698], priority: true, categoryIds: SHOES },
  { searchText: "dachstein", brandIds: [468642], priority: true, categoryIds: SHOES },

  // ============================================================
  // High — scanned every 2nd cycle (broad brand queries)
  // ============================================================
  { searchText: "nike", brandIds: [53], categoryIds: SHOES },
  { searchText: "jordan", brandIds: [2703], categoryIds: SHOES },
  { searchText: "new balance", brandIds: [1775], categoryIds: SHOES },
  { searchText: "adidas yeezy", brandIds: [14], categoryIds: SHOES },
  { searchText: "adidas", brandIds: [14], categoryIds: SHOES },
  { searchText: "under armour", brandIds: [52035], categoryIds: SHOES },
  { searchText: "the north face", brandIds: [2319], categoryIds: SHOES },
  { searchText: "merrell", brandIds: [98860], categoryIds: SHOES },
  { searchText: "meindl", brandIds: [283168], categoryIds: SHOES },
  { searchText: "salomon xt-6", brandIds: [15457], categoryIds: SHOES },
  { searchText: "nike cortez", brandIds: [53], categoryIds: SHOES },
  { searchText: "adidas superstar", brandIds: [14], categoryIds: SHOES },
  { searchText: "adidas terrex", brandIds: [14], categoryIds: SHOES },
  { searchText: "adidas ultraboost", brandIds: [14], categoryIds: SHOES },
  { searchText: "nike vapormax", brandIds: [53], categoryIds: SHOES },
  { searchText: "crank brothers", categoryIds: SHOES }, // no Vinted brand registry

  // ============================================================
  // Standard — scanned every 2nd cycle (lower volume)
  // ============================================================
  { searchText: "converse", brandIds: [11445], categoryIds: SHOES },
  { searchText: "reebok", brandIds: [162], categoryIds: SHOES },
  { searchText: "on running", brandIds: [267947], categoryIds: SHOES },
  { searchText: "vans", brandIds: [139], categoryIds: SHOES },
];
