// ============================================================
// Model extraction from item titles.
// Maps (brand, title) → model name for pricing granularity.
// ============================================================

/** Known model patterns per brand (lowercase). Order: most specific first. */
const BRAND_MODELS: Record<string, RegExp[]> = {
  nike: [
    /air\s*max\s*\d+/i,
    /air\s*force\s*1?/i,
    /dunk\s*(low|high|mid)?/i,
    /blazer\s*(low|mid|high)?/i,
    /pegasus\s*\d*/i,
    /vapormax(\s*plus)?/i,
    /vapor\s*fly/i,
    /react\s*(vision|element|infinity)?/i,
    /metcon\s*\d*/i,
    /cortez/i,
    /huarache/i,
    /waffle\s*(one|racer|trainer)?/i,
    /zoom\s*(fly|vomero|pegasus|structure)?/i,
    /sb\s+dunk/i,
    /tn\b/i,
    /shox/i,
    /air\s*jordan\s*\d*/i,
    /tech\s*fleece/i,
    /acg\b/i,
    /windrunner/i,
  ],
  jordan: [
    /air\s*jordan\s*\d+/i,
    /jordan\s*\d+/i,
    /jordan\s*(retro|mid|low|high)\s*\d*/i,
  ],
  adidas: [
    /handball\s*spezial/i,
    /samba\s*(og|xlg|adv|classic|decon)?/i,
    /gazelle\s*(bold|indoor|platform)?/i,
    /superstar/i,
    /forum\s*(low|mid|high|84)?/i,
    /campus\s*\d+\w*/i,
    /spezial/i,
    /stan\s*smith/i,
    /ultraboost\s*\d*/i,
    /ultra\s*boost\s*\d*/i,
    /nmd\s*(r1|r2|s1|cs|xr1)?/i,
    /yeezy\s*\d*/i,
    /ozweego/i,
    /sambae/i,
    /response\s*cl/i,
    /terrex\s*(swift|ax|free\s*hiker|skychaser|agravic)?/i,
  ],
  "new balance": [
    /\b\d{3,4}[a-z]\w*/i,  // 990v6, 2002r, 574h etc.
    /\b\d{3,4}\b/i,        // 574, 550, 327 (plain numbers)
  ],
  "the north face": [
    /1996\s*(retro)?/i,
    /nuptse\s*\d*/i,
    /denali\s*\d*/i,
    /thermoball/i,
    /mcmurdo/i,
    /himalayan/i,
    /borealis/i,
    /jester/i,
    /recon/i,
    /base\s*camp/i,
  ],
  salomon: [
    /xt[\s-]*6/i,
    /xt[\s-]*4/i,
    /speedcross\s*\d*/i,
    /supercross\s*\d*/i,
    /x[\s-]*ultra\s*\d*/i,
    /sense\s*\w*/i,
    /s[\s/]lab/i,
    /acs\s*(pro)?/i,
    /rx\s*(moc|slide)/i,
  ],

  asics: [
    /gel[\s-]*lyte\s*(iii|v|3|5)?/i,
    /gel[\s-]*kayano\s*\d*/i,
    /gel[\s-]*nimbus\s*\d*/i,
    /gel[\s-]*1130/i,
    /gel[\s-]*nyc/i,
  ],
  converse: [
    /chuck\s*(taylor)?\s*70/i,
    /chuck\s*(taylor)?\s*\d*/i,
    /all\s*star/i,
    /one\s*star/i,
    /run\s*star/i,
  ],
};

/**
 * Extract a model name from an item title given its brand.
 * Returns lowercase normalized model or empty string if no match.
 * Pure function — no side effects.
 */
export function extractModel(brand: string, title: string): string {
  const b = brand.toLowerCase().trim();
  const patterns = BRAND_MODELS[b];
  if (!patterns) return "";

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[0].toLowerCase().replace(/\s+/g, " ").trim();
    }
  }
  return "";
}
