import type { RawItem } from "./types.js";

// ============================================================
// Filter predicates — each returns true if item should be KEPT
// ============================================================

// PL kids + EN + FR + DE + IT + ES + NL + PT + SE + DK + FI + CZ + SK + LT + LV + EE + HU + RO + HR
const KIDS_KEYWORDS = /(?:^|\b)(dziec|kids?|enfant|copii|barn|kinder|junior|bébé|bebe|niemowl|maluch|dziewczyn.*lat|ch[łl]op.*lat|rozmiar \d{2,3} cm|boy['s]?|girl['s]?|toddler|infant|newborn|baby|bambini|niño|criança|dla dzieci|bucik|dla ch[łl]opc|dla dziewczyn|child|children|dět[ií]|detsk[éý]|vaik[uų]|bērn[iu]|laste|gyerek|gyermek|copil|dječj[ia]|fi[úu]\b|lány\b|l[aá]ny[oö]k)/i;
const KIDS_SIZES = /\b(rozmiar|size|r\.)?\s*(1[6-9]|2[0-9]|3[0-3])\b/i;
const KIDS_CATEGORIES = /\b(Enfants|Dzieci|Kids|Kinder|Bambini|Niños|Kinderen|Crianças|Barn|Børn|Lapset|Děti|Deti|Vaikai|Bērni|Lapsed|Gyerekek|Copii|Djeca)\b/i;
const SHOE_KEYWORDS = /(?:^|\b)(but[iy]?|shoe|sneaker|boot|sandal|trampk|adidasy|klapk|klapki|chaussure|Schuh|scarpa|zapato|schoen|sapato|sko|kenkä|boty|topánk|batai|kurpes|kingad|cipő|pantofi|cipele)/i;

// PL + EN + FR + DE + IT + ES + NL + PT + SE + DK + FI + CZ + SK + LT + LV + EE + HU + RO + HR
const BEANIE_KEYWORDS = /(?:^|\b)(beanie|czapk[aię]|bonnet|m[üu]tze|hat|kapelusz|beret|berretto|gorro|muts|mössa|hue|pipo|čepice|čiapka|kepurė|cepure|müts|sapka|căciulă|kapa)/i;
const BAD_CONDITION = /zadowalaj|satisf|słaby|poor|accep/i;
const PICKUP_ONLY = /(?:^|\b)(tylko odbio|odbi[oó]r osobi|nie wysy[łl]am|osobisty odbio|nur abholung|selbstabholung|retrait uniquement|solo ritiro|alleen afhalen|apenas levantamento|pouze osobní|len osobný|tik atsiėmimas|csak személyes)/i;

// Accessories & junk — cases, covers, cables, straps, instructions, socks, etc.
// Languages: PL EN FR DE IT ES NL PT SE DK FI CZ SK LT LV EE HU RO HR
const JUNK_KEYWORDS = /(?:^|[\s,;(\/-])(cases?|etui|covers?|pokrowiec|obudowa|foli[aę]|szkie[łl]ko|tempered|screen protector|h[üu]lle|schutzh[üu]lle|custodia|funda|coque|hoesje|capa|fodral|suojakuori|[üu]mbris|maciņš|d[eé]kliukas|obal|kryt|tok|hus[aăe]|skal|kryt na mobil|os[łl]on[aę]|naklejk[aię]|skin|sticker|aufkleber|adesivo|pegatina|wk[łl]adk[aię]|grip|saszetk[aię]|kabel|cabl[eo]|câble|Kabel|cavo|laad|[łl]adowark|charger|chargeur|Ladeger[äa]t|caricatore|cargador|oplader|carregador|laddare|laturi|nab[ií]je[čc]ka|[įi]krovikl|adapter|przej[sś]ci[oó]wk|strap|pasek do|pasek .{0,15}(watch|apple|samsung|garmin|fitbit|huawei)|band do|watch band|remie[nń]|reme[sš]ek|bracelet montre|Uhrenband|cinturino|correa reloj|horlogeband|pulseira rel[oó]g|klockarmband|akcesori[aóu]|zestaw akcesor|accessoir|Zubeh[öo]r|accessori[eo]|accesorio|tillbeh[öo]r|tilbeh[øo]r|tarvikkeet|příslušenstv|príslušenstv|priedai|piederumi|tarvikud|kiegész[ií]tő|accesorii|pribor|instrukcj[aię]|manual|booklet|box only|pude[łl]ko|insole|wk[łl]adk[aię] do but|stopk[iy]|skarpet[kiy]|socks|chaussettes|Socken|calzini|calcetines|sokken|meias|strumpor|sokker|sukat|ponožk[yi]|zokni|[sš]osete|čarape|zeķes|sokid|kojin[eė]|bielizn|underwear|boxer|sous-v[êe]tement|Unterwäsche|biancheria intima|ropa interior|ondergoed|roupa interior|underkläder|brelok|breloczek|keychain|lanyard|smycz|porte-cl[ée]s|Schl[üu]sselanhänger|portachiavi|llavero|sleutelhanger|nyckelring|naszywk|patch|sznur[oó]wk|laces|lacets|Schn[üu]rsenkel|belt|ceinture|G[üu]rtel|cintura|cintur[oó]n|riem|cinto|b[äa]lte|kork[iy]|stacj[aęi] dokuj|docking station|dock .{0,10}(station|usb|thunderbolt)|majic[ae]|trik[oó]|majtek|majtk[iy]|kalhotk|krabičk[auy]|krabice|pulóver|football|pi[łl]k[aię] no[żz]n[aeąęyj]*|pi[łl]karsk|no[żz]n[aeąęyj]|adilette|apple tv|magsafe|powerbank|power bank|bateria zewn|baterie externe|maska .{0,10}iphone|maskica|shuffle|usb[- ]?c|base station|airport|leggins[ey]?|leggings|armband|sport\s*band|mokas[iy]n[yów]*|moccasin|klapk[iy]|slides?|base[iy]now[eya]|sukienk[aię]|dress|kleid|vestido|robe|crossbody|nerka|fanny\s*pack|bum\s*bag|telefontok|remote|pilot|cip[őo]f[űu]z[őo]|portfel|wallet|p[ée]nzt[áa]rca|geldb[öo]rse|portefeuille|portafoglio|cartera|portemonnee|carteira|pl[åa]nbok|lommebok|kopack[yý]|kopa[čc]k[yý]|korki|football boots?|crampon|Stollenschuh|tacchetti|tacos|hundjacka|hundmantel|for dogs?|f[öo]r hund|dla ps[aóu]|dla pies|dog coat|dog jacket|pet clothes|djurkl[äa]der|kisállat|pro psa|pre psa|šunims|suņ|rolki|wrotki|inline\s*skat|roller\s*blad|rulleskøjter|rullskridskor|inlineskates|rollerblades|brusle|kor[čc]ul[eěi]|riedučiai|skrituļslid|rulluisud|g[öo]rkorcsolya|role|patin[es]?\s*(en\s*l[ií]nea|[àa]\s*roues)|Inlineskate|rollerblade|pattini\s*in\s*linea|jordan\s*ke[er]r|sandal[eéyłs]*|sanda[łl][eéyis]*|pantofle|pantofli|slipp|t[oe]ng|flip\s*flop|japonki|klapk[iy]|slides?|sanda[aá]l|sandalett|papuc[ie]|papucs|gumipapucs|strandpapucs|slapi|natika[čc]e|šlape|šlapky|[sš]lepet|balerin[yaęki]|balerín|balerina|ballerina|r[ęe]kawiczk[aięy]|gloves?|gants?|Handschuh|guant[ei]|handskar|hansker|käsineet|rukavice|rukavičk|pirštinės|cimdi|kindad|kesztyű|mănuși|rukavice|rullaluistim|rullsk[oö]jt)/i;

// Brands to always block — all items from these brands are filtered out
const BLOCKED_BRANDS = new Set(["apple", "puma"]);

// Women's bags & purses — PL EN FR DE IT ES NL PT CZ SK HU RO HR
const WOMENS_BAG_KEYWORDS = /(?:^|[\s,;(])(torebk[aię]|torebka damska|damska torebka|purse|handbag|clutch|women'?s bag|sac [àa] main|Handtasche|Damentasche|borsa donna|bolso de mujer|damestas|bolsa feminina|damväska|dametaske|naisten laukku|dámská kabelka|dámska kabelka|moterišk[aą] rankin|sieviešu soma|naiste kott|női táska|geantă damă|ženska torbica)/i;

// Car/vehicle/industrial parts — not resellable on Vinted profitably
const VEHICLE_PARTS_KEYWORDS = /(?:^|[\s,;(])(halogen|tarcza hamulcow|klocki hamulcow|dekiel|pokrywa silnik|komputer .{0,20}(audi|bmw|vw|opel|ford|fiat|renault|peugeot|mercedes|volvo|toyota|honda|hyundai|kia|skoda|seat|citroen)|cz[ęe][sś]ci (samochod|motocykl|auto)|alternator|rozrusznik|siedzenie .{0,30}(traktor|kosiark|ci[aą]gnik|w[oó]zek wid[łl]owy)|cz[ęe][sś][cć] (do|samochodow)|lampa (przednia|tylna)|zderzak|b[łl]otnik|lusterko .{0,15}(boczne|zewn)|maska (silnika|samochod)|felg[aię]|opona|hamulce|sprz[ęe]g[łl]o|amortyzator|wahacz|zwrotnica|ło[żz]ysko|tuleja|uszczelk[aięy]|radio samochod|radioodtwarzacz|nawigacj[aę] samochod|cb radio|autoradio|car radio|antena samochod|g[łl]o[śs]nik samochod|wzmacniacz samochod|subwoofer samochod)/i;

// Single/broken/defective items — PL EN CZ SK FR DE IT ES NL HU RO
const SINGLE_BROKEN_KEYWORDS = /(?:^|[\s,;(])(1x s[łl]uchawk|jedna s[łl]uchawk|jedno s[łl]uchawk|single (earphone|earbud|airpod)|jeden (airpod|s[łl]uchawk)|lev[áaé] sl[úu]ch[aáe]tko|prav[áaé] sl[úu]ch[aáe]tko|lev[éeáa] (airpod|earbud)|prav[éeáa] (airpod|earbud)|left (airpod|earbud)|right (airpod|earbud)|only (one|left|right)|wymian[aę] uszkodzon|wymiana .{0,20}na (dobr|sprawn|now)|exchange .{0,15}(defective|broken|damaged)|defektivn|jedną? sztuk|seul[e]? [ée]couteur|einzelner (Ohrhörer|Kopfhörer)|singolo auricolare|solo un auricular|enkel oordop|egyetlen f[üu]lhallgat[oó]|o singur[aă] c[aă][sș]ti)/i;

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

/** Filter out all items from blocked brands */
export function isNotBlockedBrand(item: RawItem): boolean {
  return !BLOCKED_BRANDS.has(item.brand.toLowerCase().trim());
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

// Numeric shoe/clothing sizes outside 36-44 range
const BAD_NUMERIC_SIZE = /^(3[0-5]|4[5-9]|[5-9]\d)\s*([.,]\d)?$/;
// Extreme letter sizes
const BAD_LETTER_SIZE = /\b(XXS|XXL|XXXL|XXXXL|2XL|3XL|4XL|2XS)\b/i;

/**
 * Filter out items with sizes outside the desired range.
 * Keeps: numeric 36-46 (including half sizes like 42.5), letter S/M/L/XL,
 * and items with no size or non-standard size strings.
 * Blocks: numeric <36 or >46, XXS, XXL and above.
 */
export function isInSizeRange(item: RawItem): boolean {
  const size = (item.size || "").trim();
  if (!size) return true; // no size info — let through

  // Check extreme letter sizes first
  if (BAD_LETTER_SIZE.test(size)) return false;

  // Extract numeric size (handles "42", "42.5", "42,5", "EU 43", "43 EU")
  const numMatch = size.match(/(\d{2,3})(?:[.,]\d)?/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    // Kids clothing sizes in cm (80-170) — always block
    if (num >= 80 && num <= 170) return false;
    // Shoe sizes 16-59 — allow 35-47 (blocks kids 16-34 and oversized 48+)
    if (num >= 16 && num <= 59) {
      return num >= 35 && num <= 47;
    }
  }

  return true; // non-numeric or out-of-range number — let through
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
    blockedBrand: number;
    womensBags: number;
    vehicleParts: number;
    singleBroken: number;
    hardwareJunk: number;
    badSize: number;
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
  const noBlockedBrands = noJunk.filter(isNotBlockedBrand);
  const noWomensBags = noBlockedBrands.filter(isNotWomensBag);
  const noVehicleParts = noWomensBags.filter(isNotVehiclePart);
  const noSingleBroken = noVehicleParts.filter(isNotSingleOrBroken);
  const noHardwareJunk = noSingleBroken.filter(isNotHardwareJunk);
  const goodSize = noHardwareJunk.filter(isInSizeRange);
  const shippable = goodSize.filter(isShippable);

  return {
    passed: shippable,
    removed: items.length - shippable.length,
    breakdown: {
      priceTooLow: items.length - priceFiltered.length,
      kids: priceFiltered.length - noKids.length,
      hats: noKids.length - noHats.length,
      badCondition: noHats.length - goodCondition.length,
      junk: goodCondition.length - noJunk.length,
      blockedBrand: noJunk.length - noBlockedBrands.length,
      womensBags: noBlockedBrands.length - noWomensBags.length,
      vehicleParts: noWomensBags.length - noVehicleParts.length,
      singleBroken: noVehicleParts.length - noSingleBroken.length,
      hardwareJunk: noSingleBroken.length - noHardwareJunk.length,
      badSize: noHardwareJunk.length - goodSize.length,
      pickupOnly: goodSize.length - shippable.length,
    },
  };
}
