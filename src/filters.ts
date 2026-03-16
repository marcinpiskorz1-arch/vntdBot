import type { RawItem } from "./types.js";

// ============================================================
// Filter predicates — each returns true if item should be KEPT
// ============================================================

const KIDS_KEYWORDS = /(?:^|\b)(dziec|kids?|enfant|copii|barn|kinder|junior|bébé|bebe|niemowl|maluch|dziewczyn.*lat|ch[łl]op.*lat|rozmiar \d{2,3} cm|boy['s]?|girl['s]?|toddler|infant|newborn|baby|bambini|niño|dla dzieci|bucik|dla ch[łl]opc|dla dziewczyn|child|children)/i;
const KIDS_SIZES = /\b(rozmiar|size|r\.)?\s*(1[6-9]|2[0-9]|3[0-3])\b/i;
const KIDS_CATEGORIES = /\b(Enfants|Dzieci|Kids|Kinder)\b/i;
const SHOE_KEYWORDS = /(?:^|\b)(but[iy]?|shoe|sneaker|boot|sandal|trampk|adidasy|klapk|klapki)/i;

const BEANIE_KEYWORDS = /(?:^|\b)(beanie|czapk[aię]|bonnet|m[üu]tze|hat|kapelusz|beret)/i;
const BAD_CONDITION = /zadowalaj|satisf|słaby|poor|accep|(?<!bardzo )dobr|(?<!very )good/i;
const PICKUP_ONLY = /(?:^|\b)(tylko odbio|odbi[oó]r osobi|nie wysy[łl]am|osobisty odbio)/i;

// Accessories & junk — cases, covers, cables, straps, instructions, socks, etc.
const JUNK_KEYWORDS = /(?:^|[\s,;(\/-])(cases?|etui|covers?|pokrowiec|obudowa|foli[aę]|szkie[łl]ko|tempered|screen protector|h[üu]lle|schutzh[üu]lle|custodia|funda|coque|naklejk[aię]|skin|sticker|wk[łl]adk[aię]|grip|saszetk[aię]|kabel|cabl[eo]|[łl]adowark|charger|adapter|przej[sś]ci[oó]wk|strap|pasek do|pasek .{0,15}watch|band do|watch band|remie[nń]|reme[sš]ek|instrukcj[aię]|manual|booklet|box only|pude[łl]ko|insole|wk[łl]adk[aię] do but|skarpet[kiy]|socks|bielizn|underwear|boxer|brelok|breloczek|keychain|lanyard|smycz|naszywk|patch|sznur[oó]wk|laces|kryt na mobil|belt|skal|d[eé]kliukas|obal|tok|hus[aăe]|os[łl]on[aę]|majic[ae]|trik[oó]|majtek|majtk[iy]|kalhotk|krabičk[auy]|krabice|pulóver)/i;

// Women's bags & purses
const WOMENS_BAG_KEYWORDS = /(?:^|[\s,;(])(torebk[aię]|torebka damska|damska torebka|purse|handbag|clutch|women'?s bag)/i;

// Car/vehicle/industrial parts — not resellable on Vinted profitably
const VEHICLE_PARTS_KEYWORDS = /(?:^|[\s,;(])(halogen|tarcza hamulcow|klocki hamulcow|dekiel|pokrywa silnik|komputer .{0,20}(audi|bmw|vw|opel|ford|fiat|renault|peugeot|mercedes|volvo|toyota|honda|hyundai|kia|skoda|seat|citroen)|cz[ęe][sś]ci (samochod|motocykl|auto)|alternator|rozrusznik|siedzenie .{0,30}(traktor|kosiark|ci[aą]gnik|w[oó]zek wid[łl]owy)|cz[ęe][sś][cć] (do|samochodow)|lampa (przednia|tylna)|zderzak|b[łl]otnik|lusterko .{0,15}(boczne|zewn)|maska (silnika|samochod)|felg[aię]|opona|hamulce|sprz[ęe]g[łl]o|amortyzator|wahacz|zwrotnica|ło[żz]ysko|tuleja|uszczelk[aięy]|radio samochod|radioodtwarzacz|nawigacj[aę] samochod|cb radio|autoradio|car radio|antena samochod|g[łl]o[śs]nik samochod|wzmacniacz samochod|subwoofer samochod)/i;

// Single/broken/defective items — only one earphone, exchange for working, etc.
const SINGLE_BROKEN_KEYWORDS = /(?:^|[\s,;(])(1x s[łl]uchawk|jedna s[łl]uchawk|jedno s[łl]uchawk|single (earphone|earbud|airpod)|jeden (airpod|s[łl]uchawk)|lev[áaé] sl[úu]ch[aá]|prav[áaé] sl[úu]ch[aá]|lev[éeáa] (airpod|earbud)|prav[éeáa] (airpod|earbud)|left (airpod|earbud)|right (airpod|earbud)|only (one|left|right)|wymian[aę] uszkodzon|wymiana .{0,20}na (dobr|sprawn|now)|exchange .{0,15}(defective|broken|damaged)|defektivn|pokryw[aę] (ba|osło)|osłon[aę]|jedną? sztuk)/i;

// Tools, industrial equipment, random hardware junk
const HARDWARE_JUNK = /(?:^|[\s,;(])(magnes z wy[łl][aą]cznikiem|lina jutow|sznur|[łl]a[nń]cuch|zestaw do ci[eę]ci|no[żz]yce do|wiertark|szlifierk|spawark|kompresor|podno[sś]nik|klucz udarow|pi[łl]a |pi[łl]ark|kosiark[aię]|dmuchaw|odkurzacz przemy|agregat|pami[ęe][cć] ram|ddr[345]|dimm|sodimm|ram .{0,10}\d+\s*gb|joy-?con|joycon)/i;

/** Keep items above minimum price */
export function isAboveMinPrice(item: RawItem, minPrice: number): boolean {
  return item.price >= minPrice;
}

/** Filter out children's items (keywords, categories, shoe sizes 16-33) */
export function isNotKidsItem(item: RawItem): boolean {
  const text = `${item.title} ${item.description} ${item.size} ${item.category}`;
  if (KIDS_KEYWORDS.test(text)) return false;
  if (KIDS_CATEGORIES.test(item.category)) return false;
  const isShoe = SHOE_KEYWORDS.test(text);
  if (isShoe && KIDS_SIZES.test(item.size || "")) return false;
  return true;
}

/** Filter out beanies / hats / czapki (low-value accessories) */
export function isNotHat(item: RawItem): boolean {
  const text = `${item.title} ${item.description} ${item.category}`;
  return !BEANIE_KEYWORDS.test(text);
}

/** Filter out items in poor condition */
export function isGoodCondition(item: RawItem): boolean {
  return !BAD_CONDITION.test(item.condition);
}

/** Filter out pickup-only items */
export function isShippable(item: RawItem): boolean {
  const text = `${item.title} ${item.description}`;
  return !PICKUP_ONLY.test(text);
}

/** Filter out low-value accessories & junk (cases, cables, straps, socks, etc.) */
export function isNotJunk(item: RawItem): boolean {
  const text = `${item.title} ${item.description} ${item.category}`;
  return !JUNK_KEYWORDS.test(text);
}

/** Filter out women's bags & purses */
export function isNotWomensBag(item: RawItem): boolean {
  const text = `${item.title} ${item.description} ${item.category}`;
  return !WOMENS_BAG_KEYWORDS.test(text);
}

/** Filter out car/vehicle/industrial parts */
export function isNotVehiclePart(item: RawItem): boolean {
  const text = `${item.title} ${item.description} ${item.category}`;
  return !VEHICLE_PARTS_KEYWORDS.test(text);
}

/** Filter out single/broken/defective items (one AirPod, exchange for working, etc.) */
export function isNotSingleOrBroken(item: RawItem): boolean {
  const text = `${item.title} ${item.description}`;
  return !SINGLE_BROKEN_KEYWORDS.test(text);
}

/** Filter out tools, industrial equipment, RAM, joycons, random hardware */
export function isNotHardwareJunk(item: RawItem): boolean {
  const text = `${item.title} ${item.description}`;
  return !HARDWARE_JUNK.test(text);
}

export interface FilterResult {
  passed: RawItem[];
  removed: number;
  breakdown: {
    priceTooLow: number;
    kids: number;
    hats: number;
    badCondition: number;
    junk: number;
    womensBags: number;
    vehicleParts: number;
    singleBroken: number;
    hardwareJunk: number;
    pickupOnly: number;
  };
}

/** Run all filters in sequence, returning passed items + breakdown stats */
export function filterItems(items: RawItem[], minPrice: number): FilterResult {
  const priceFiltered = items.filter(i => isAboveMinPrice(i, minPrice));
  const noKids = priceFiltered.filter(isNotKidsItem);
  const noHats = noKids.filter(isNotHat);
  const goodCondition = noHats.filter(isGoodCondition);
  const noJunk = goodCondition.filter(isNotJunk);
  const noWomensBags = noJunk.filter(isNotWomensBag);
  const noVehicleParts = noWomensBags.filter(isNotVehiclePart);
  const noSingleBroken = noVehicleParts.filter(isNotSingleOrBroken);
  const noHardwareJunk = noSingleBroken.filter(isNotHardwareJunk);
  const shippable = noHardwareJunk.filter(isShippable);

  return {
    passed: shippable,
    removed: items.length - shippable.length,
    breakdown: {
      priceTooLow: items.length - priceFiltered.length,
      kids: priceFiltered.length - noKids.length,
      hats: noKids.length - noHats.length,
      badCondition: noHats.length - goodCondition.length,
      junk: goodCondition.length - noJunk.length,
      womensBags: noJunk.length - noWomensBags.length,
      vehicleParts: noWomensBags.length - noVehicleParts.length,
      singleBroken: noVehicleParts.length - noSingleBroken.length,
      hardwareJunk: noSingleBroken.length - noHardwareJunk.length,
      pickupOnly: noHardwareJunk.length - shippable.length,
    },
  };
}
