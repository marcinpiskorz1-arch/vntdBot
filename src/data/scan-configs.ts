import type { ScanConfig } from "../types.js";

/**
 * Hardcoded scan configs — what the bot searches for on Vinted/OLX.
 * `priority: true` = scanned every cycle (hype models).
 * Others = scanned every 2nd cycle (full scan).
 */
export const scanConfigs: ScanConfig[] = [
  // Sneakersy — marki
  { searchText: "nike" },
  { searchText: "jordan" },
  { searchText: "adidas" },
  { searchText: "new balance" },
  { searchText: "under armour" },
  { searchText: "asics" },
  { searchText: "vans" },
  // Jordan — modele (priority: skanowane co cykl)
  { searchText: "jordan 1", priority: true },
  { searchText: "jordan 3", priority: true },
  { searchText: "jordan 4", priority: true },
  { searchText: "jordan 5", priority: true },
  { searchText: "jordan 11", priority: true },
  // New Balance — modele hype
  { searchText: "new balance 550", priority: true },
  { searchText: "new balance 574", priority: true },
  { searchText: "new balance 990", priority: true },
  { searchText: "new balance 2002r", priority: true },
  { searchText: "new balance 530", priority: true },
  // Asics — modele
  { searchText: "asics gel lyte", priority: true },
  { searchText: "asics gel kayano", priority: true },
  // Nike — popularne modele (priority: skanowane co cykl)
  { searchText: "nike air max", priority: true },
  { searchText: "nike dunk", priority: true },
  { searchText: "nike blazer", priority: true },
  { searchText: "nike metcon", priority: true },
  { searchText: "nike air force", priority: true },
  { searchText: "nike vapormax", priority: true },
  { searchText: "nike pegasus", priority: true },
  { searchText: "nike acg", priority: true },
  { searchText: "nike tech fleece", priority: true },
  { searchText: "nike sb", priority: true },
  // Adidas — popularne modele
  { searchText: "adidas samba", priority: true },
  { searchText: "adidas gazelle", priority: true },
  { searchText: "adidas superstar", priority: true },
  { searchText: "adidas stan smith", priority: true },
  { searchText: "adidas ultraboost", priority: true },
  { searchText: "adidas nmd", priority: true },
  { searchText: "adidas yeezy", priority: true },
  { searchText: "adidas spezial", priority: true },
  { searchText: "adidas campus", priority: true },
  { searchText: "adidas forum", priority: true },
  { searchText: "adidas terrex", priority: true },
  // Outdoor / góry
  { searchText: "la sportiva" },
  { searchText: "salewa" },
  { searchText: "salomon" },
  // Salomon — modele hype
  { searchText: "salomon xt-6", priority: true },
  { searchText: "salomon speedcross", priority: true },
  { searchText: "salomon xt-4", priority: true },
  { searchText: "mammut" },
  { searchText: "arc'teryx" },
  // Arc'teryx — modele premium
  { searchText: "arcteryx alpha", priority: true },
  { searchText: "arcteryx beta", priority: true },
  { searchText: "arcteryx atom", priority: true },
  { searchText: "arcteryx cerium", priority: true },
  { searchText: "scarpa" },
  { searchText: "norrøna" },
  { searchText: "haglöfs" },
  { searchText: "revolutionrace" },
  { searchText: "hunter boots" },
  { searchText: "timberland" },
  { searchText: "dynafit" },
  { searchText: "merrell" },
  { searchText: "peak performance" },
  { searchText: "rab", categoryIds: [5] },
  { searchText: "millet" },
  { searchText: "meindl" },
  { searchText: "lowa" },
  { searchText: "osprey" },
  // Streetwear / hype
  { searchText: "the north face" },
  // TNF — modele z wysokim resale
  { searchText: "north face nuptse", priority: true },
  { searchText: "north face 1996", priority: true },
  { searchText: "north face denali", priority: true },
  { searchText: "north face duffel", priority: true },
  { searchText: "patagonia" },
  // Patagonia — modele
  { searchText: "patagonia retro-x", priority: true },
  { searchText: "patagonia nano puff", priority: true },
  { searchText: "patagonia black hole", priority: true },
  { searchText: "fjällräven" },
  { searchText: "stone island" },
  { searchText: "nervous" },
  { searchText: "carhartt" },
  { searchText: "dickies" },
  { searchText: "supreme" },
  { searchText: "supreme box logo", priority: true },
  { searchText: "stüssy" },
  { searchText: "napapijri" },
  { searchText: "bape" },
  { searchText: "ralph lauren" },
  { searchText: "tommy hilfiger" },
  // Workwear / vintage
  { searchText: "levi's" },
  { searchText: "wrangler" },
  // Snow / board
  { searchText: "volcom" },
  { searchText: "quiksilver" },
  { searchText: "burton" },
  { searchText: "dc shoes" },
  { searchText: "oakley" },
  { searchText: "helly hansen" },
  { searchText: "dakine" },
  // Moto / sport
  { searchText: "alpinestars" },
  { searchText: "fox racing", categoryIds: [5] },
  { searchText: "dainese" },
  // Inne
  { searchText: "save the duck" },
  // Technologie / materiały premium
  { searchText: "gore-tex" },
  { searchText: "goretex" },
  { searchText: "windstopper" },
  { searchText: "pertex" },
  { searchText: "primaloft" },
  { searchText: "cordura" },
  { searchText: "vibram" },
  { searchText: "polartec" },
  // Premium / luxury resell
  { searchText: "moncler" },
  { searchText: "canada goose" },
  { searchText: "off-white" },
  { searchText: "balenciaga" },
  { searchText: "burberry" },
  { searchText: "barbour" },
  // Tier 2 resell
  { searchText: "columbia" },
  { searchText: "converse" },
  { searchText: "converse chuck 70", priority: true },
  { searchText: "on running" },
  { searchText: "on cloudmonster", priority: true },
  // Skate
  { searchText: "santa cruz" },

  // ============================================================
  // High ROI (shipping-friendly) — Electronics + Collectibles + Premium small goods
  // ============================================================

  // Audio / wearables
  { searchText: "airpods", priority: true },
  { searchText: "sony wh-1000xm", priority: true },
  { searchText: "bose qc", priority: true },
  { searchText: "jbl" },
  { searchText: "garmin fenix", priority: true },
  { searchText: "garmin forerunner", priority: true },
  { searchText: "apple watch", priority: true },
  { searchText: "g-shock", priority: true },

  // Small tech / gaming peripherals
  { searchText: "kindle" },
  { searchText: "nintendo switch", priority: true },
  { searchText: "joy-con" },
  { searchText: "dualshock" },
  { searchText: "dualsense" },
  { searchText: "logitech mx master" },
  { searchText: "keychron" },

  // Collectibles / hobby
  { searchText: "lego technic", priority: true },
  { searchText: "lego star wars", priority: true },
  { searchText: "lego creator", priority: true },
  { searchText: "lego icons" },
  { searchText: "lego architecture" },

  // Premium accessories
  { searchText: "ray-ban", priority: true },
  { searchText: "michael kors" },
  { searchText: "seiko", priority: true },
  { searchText: "casio edifice" },
  { searchText: "orient zegarek" },

  // Outdoor accessories (małe, wysyłkowe)
  { searchText: "petzl" },
  { searchText: "black diamond" },
  { searchText: "leatherman" },
  { searchText: "nalgene" },
  { searchText: "camelbak" },

  // Telefony
  { searchText: "iphone 13", priority: true },
  { searchText: "iphone 14", priority: true },
  { searchText: "iphone 15", priority: true },
  { searchText: "iphone 16", priority: true },
  { searchText: "samsung galaxy s23" },
  { searchText: "samsung galaxy s24", priority: true },
  { searchText: "google pixel" },
  { searchText: "xiaomi" },

  // Tablety
  { searchText: "ipad pro", priority: true },
  { searchText: "ipad air", priority: true },
  { searchText: "ipad mini" },

  // Laptopy / komputery
  { searchText: "macbook pro", priority: true },
  { searchText: "macbook air", priority: true },
  { searchText: "thinkpad", priority: true },
  { searchText: "dell xps" },
  { searchText: "surface pro" },
  { searchText: "steam deck", priority: true },
];
