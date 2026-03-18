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
 * TEMPORARY: Shoes-only mode — reduced queries to lower Vinted API load.
 * Full config list is in git history (commit before this change).
 *
 * `priority: true` = scanned every cycle (hype models).
 * Others = scanned every 2nd cycle (full scan).
 */
export const scanConfigs: ScanConfig[] = [
  // ============================================================
  // High-volume brands — shoes only (categoryIds: SHOES)
  // ============================================================
  { searchText: "nike", brandIds: [53], categoryIds: SHOES },
  { searchText: "jordan", brandIds: [2703], categoryIds: SHOES },
  { searchText: "adidas", brandIds: [14], categoryIds: SHOES },
  { searchText: "new balance", brandIds: [1775], categoryIds: SHOES },
  { searchText: "under armour", brandIds: [52035], categoryIds: SHOES },
  { searchText: "asics", brandIds: [1195], categoryIds: SHOES },
  { searchText: "vans", brandIds: [139], categoryIds: SHOES },
  { searchText: "converse", brandIds: [11445], categoryIds: SHOES },
  { searchText: "the north face", brandIds: [2319], categoryIds: SHOES },
  { searchText: "salomon", brandIds: [15457], categoryIds: SHOES },

  // ============================================================
  // Priority hype models — scanned every cycle (ALL with categoryIds: SHOES)
  // ============================================================
  // Jordan
  { searchText: "jordan 1", priority: true, categoryIds: SHOES },
  { searchText: "jordan 4", priority: true, categoryIds: SHOES },
  // New Balance
  { searchText: "new balance 550", priority: true, categoryIds: SHOES },
  { searchText: "new balance 574", priority: true, categoryIds: SHOES },
  { searchText: "new balance 530", priority: true, categoryIds: SHOES },
  // Nike
  { searchText: "nike air max", priority: true, categoryIds: SHOES },
  { searchText: "nike dunk", priority: true, categoryIds: SHOES },
  { searchText: "nike air force", priority: true, categoryIds: SHOES },
  { searchText: "nike sb", priority: true, categoryIds: SHOES },
  // Adidas
  { searchText: "adidas samba", priority: true, categoryIds: SHOES },
  { searchText: "adidas gazelle", priority: true, categoryIds: SHOES },
  { searchText: "adidas yeezy", priority: true, categoryIds: SHOES },
  { searchText: "adidas spezial", priority: true, categoryIds: SHOES },
  // Salomon
  { searchText: "salomon xt-6", priority: true, categoryIds: SHOES },
  { searchText: "salomon speedcross", priority: true, categoryIds: SHOES },
  // On Running
  { searchText: "on cloudmonster", priority: true, categoryIds: SHOES },

  // ============================================================
  // Standard shoe queries — scanned every 2nd cycle (ALL with categoryIds: SHOES)
  // ============================================================
  { searchText: "asics gel lyte", categoryIds: SHOES },
  { searchText: "asics gel kayano", categoryIds: SHOES },
  { searchText: "onitsuka tiger", categoryIds: SHOES },
  { searchText: "nike cortez", categoryIds: SHOES },
  { searchText: "nike blazer", categoryIds: SHOES },
  { searchText: "nike vapormax", categoryIds: SHOES },
  { searchText: "adidas superstar", categoryIds: SHOES },
  { searchText: "adidas ultraboost", categoryIds: SHOES },
  { searchText: "adidas forum", categoryIds: SHOES },
  { searchText: "adidas terrex", categoryIds: SHOES },
  { searchText: "converse chuck 70", categoryIds: SHOES },
  { searchText: "reebok", categoryIds: SHOES },
  { searchText: "on running", brandIds: [267947], categoryIds: SHOES },

  // Outdoor shoe brands
  { searchText: "la sportiva", categoryIds: SHOES },
  { searchText: "scarpa", categoryIds: SHOES },
  { searchText: "merrell", categoryIds: SHOES },
  { searchText: "meindl", categoryIds: SHOES },
  { searchText: "lowa", categoryIds: SHOES },
  { searchText: "crocs", categoryIds: SHOES },
];
