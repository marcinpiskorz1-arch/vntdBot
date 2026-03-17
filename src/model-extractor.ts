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
    /vapormax\s*\w*/i,
    /vapor\s*fly/i,
    /react\s*\w*/i,
    /metcon\s*\d*/i,
    /cortez/i,
    /huarache/i,
    /waffle\s*(one|racer|trainer)?/i,
    /zoom\s*\w*/i,
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
    /samba\s*\w*/i,
    /gazelle\s*\w*/i,
    /superstar/i,
    /forum\s*(low|mid|high|84)?/i,
    /campus\s*\d+\w*/i,
    /spezial\s*\w*/i,
    /stan\s*smith/i,
    /ultraboost\s*\w*/i,
    /ultra\s*boost\s*\w*/i,
    /nmd\s*\w*/i,
    /yeezy\s*\d*/i,
    /ozweego/i,
    /sambae/i,
    /response\s*cl/i,
    /terrex\s*\w*/i,
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

  sony: [
    /wh[\s-]*1000\s*xm\s*\d/i,
    /wf[\s-]*1000\s*xm\s*\d/i,
    /playstation\s*\d/i,
    /ps\s*[345]/i,
    /dualsense/i,
    /xperia\s*\w*/i,
  ],
  nintendo: [
    /switch\s*(oled|lite)?/i,
    /3ds\s*(xl)?/i,
    /game\s*boy/i,
    /wii\s*(u)?/i,
  ],
  lego: [
    /\b\d{4,5}\b/i,  // LEGO set numbers
    /technic/i,
    /creator\s*(expert)?/i,
    /star\s*wars/i,
    /city/i,
    /architecture/i,
    /icons?/i,
  ],
  samsung: [
    /galaxy\s*(s|a|z|note|buds|watch|tab|fold|flip)\s*\d*/i,
    /buds\s*(pro|plus|live|fe)?\s*\d*/i,
  ],
  asics: [
    /gel[\s-]*lyte\s*(iii|v|3|5)?/i,
    /gel[\s-]*kayano\s*\d*/i,
    /gel[\s-]*nimbus\s*\d*/i,
    /gel[\s-]*1130/i,
    /gel[\s-]*nyc/i,
  ],
  vans: [
    /old\s*skool/i,
    /sk8[\s-]*hi/i,
    /era\b/i,
    /authentic/i,
    /slip[\s-]*on/i,
    /ultrarange/i,
  ],
  converse: [
    /chuck\s*(taylor)?\s*70/i,
    /chuck\s*(taylor)?\s*\d*/i,
    /all\s*star/i,
    /one\s*star/i,
    /run\s*star/i,
  ],
  hoka: [
    /clifton\s*\d*/i,
    /bondi\s*\d*/i,
    /speedgoat\s*\d*/i,
    /mafate\s*\d*/i,
    /challenger\s*\d*/i,
    /torrent\s*\d*/i,
  ],
  "on running": [
    /cloud\s*(monster|nova|swift|surge|flow|x|5|stratus)?\s*\d*/i,
    /roger\s*(pro|advantage)?/i,
  ],
  puma: [
    /suede\s*(classic)?/i,
    /rs[\s-]*x/i,
    /palermo/i,
    /speedcat/i,
    /clyde/i,
  ],
  "ray-ban": [
    /wayfarer/i,
    /aviator/i,
    /clubmaster/i,
    /round\s*metal/i,
    /justin/i,
    /erika/i,
  ],
  seiko: [
    /presage/i,
    /prospex/i,
    /srpb\w*/i,
    /srp[a-z]\d*/i,
    /skx\d*/i,
    /\b5\s*sports?\b/i,
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
