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
const JUNK_KEYWORDS = /(?:^|[\s,;(\/-])(cases?|etui|covers?|pokrowiec|obudowa|foli[aę]|szkie[łl]ko|tempered|screen protector|h[üu]lle|schutzh[üu]lle|custodia|funda|coque|naklejk[aię]|skin|sticker|wk[łl]adk[aię]|grip|saszetk[aię]|kabel|cabl[eo]|[łl]adowark|charger|adapter|przej[sś]ci[oó]wk|strap|pasek do|band do|watch band|remie[nń]|instrukcj[aię]|manual|booklet|box only|pude[łl]ko|insole|wk[łl]adk[aię] do but|skarpet[kiy]|socks|bielizn|underwear|boxer|brelok|breloczek|keychain|lanyard|smycz|naszywk|patch|sznur[oó]wk|laces|kryt na mobil|belt)/i;

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
  const text = `${item.title} ${item.category}`;
  return !JUNK_KEYWORDS.test(text);
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
  const shippable = noJunk.filter(isShippable);

  return {
    passed: shippable,
    removed: items.length - shippable.length,
    breakdown: {
      priceTooLow: items.length - priceFiltered.length,
      kids: priceFiltered.length - noKids.length,
      hats: noKids.length - noHats.length,
      badCondition: noHats.length - goodCondition.length,
      junk: goodCondition.length - noJunk.length,
      pickupOnly: noJunk.length - shippable.length,
    },
  };
}
