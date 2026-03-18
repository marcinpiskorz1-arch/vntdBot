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
  // Priority hype models — scanned every cycle
  // ============================================================
  // Jordan
  { searchText: "jordan 1", priority: true },
  { searchText: "jordan 4", priority: true },
  // New Balance
  { searchText: "new balance 550", priority: true },
  { searchText: "new balance 574", priority: true },
  { searchText: "new balance 530", priority: true },
  // Nike
  { searchText: "nike air max", priority: true },
  { searchText: "nike dunk", priority: true },
  { searchText: "nike air force", priority: true },
  { searchText: "nike sb", priority: true },
  // Adidas
  { searchText: "adidas samba", priority: true },
  { searchText: "adidas gazelle", priority: true },
  { searchText: "adidas yeezy", priority: true },
  { searchText: "adidas spezial", priority: true },
  // Salomon
  { searchText: "salomon xt-6", priority: true },
  { searchText: "salomon speedcross", priority: true },
  // On Running
  { searchText: "on cloudmonster", priority: true },

  // ============================================================
  // Standard shoe queries — scanned every 2nd cycle
  // ============================================================
  { searchText: "asics gel lyte" },
  { searchText: "asics gel kayano" },
  { searchText: "onitsuka tiger" },
  { searchText: "nike cortez" },
  { searchText: "nike blazer" },
  { searchText: "nike vapormax" },
  { searchText: "adidas superstar" },
  { searchText: "adidas ultraboost" },
  { searchText: "adidas forum" },
  { searchText: "adidas terrex" },
  { searchText: "converse chuck 70" },
  { searchText: "reebok", categoryIds: SHOES },
  { searchText: "puma", categoryIds: SHOES },
  { searchText: "on running", brandIds: [267947], categoryIds: SHOES },

  // Outdoor shoe brands
  { searchText: "la sportiva" },
  { searchText: "scarpa" },
  { searchText: "merrell" },
  { searchText: "meindl" },
  { searchText: "lowa" },
  { searchText: "crocs" },
];
