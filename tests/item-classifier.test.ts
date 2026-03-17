import { describe, it, expect } from "vitest";
import { classifyItemType, isBrandTypeWorthNotifying, vintedCategoryToItemType, resolveItemType } from "../src/item-classifier.js";

describe("classifyItemType", () => {
  // ============================================================
  // Shoes
  // ============================================================
  it.each([
    "Salomon SuperCross Contragrip Gore-Tex Trail sport shoes",
    "Nike Air Max 90 buty sportowe",
    "Adidas Samba sneakers",
    "Jordan 4 Retro boots",
    "New Balance 990 trampki",
    "Asics Gel Kayano 14",
    "Nike Dunk Low",
    "Salomon XT-6 Advanced",
    "Salomon Speedcross 5",
    "On Cloudmonster running",
    "Converse Chuck 70",
    "Adidas Ultraboost 22",
    "Nike Metcon 8 training",
    "Nike Fsb Chukka",
  ])("classifies shoes: %s", (title) => {
    expect(classifyItemType(title)).toBe("shoes");
  });

  // ============================================================
  // Jackets / outerwear
  // ============================================================
  it.each([
    "The North Face Nuptse 700 puffer",
    "Mammut Nano Puff kurtka",
    "TNF 1996 Retro Nuptse puffer",
    "The North Face fleece jacket",
    "Canada Goose parka zimowa",
    "Mammut hardshell anorak",
  ])("classifies jackets: %s", (title) => {
    expect(classifyItemType(title)).toBe("jacket");
  });

  // ============================================================
  // Tops (shirts, t-shirts, blouses, hoodies, fleece)
  // ============================================================
  it.each([
    "Nike t-shirt",
    "Nike hoodie bluza",
    "The North Face longsleeve",
    "Supreme Box Logo tee",
    "Salomon polo shirt",
    "North Face Denali fleece",
    "Carhartt WIP sweatshirt",
    "Radiation tee jbj",
    "Vintage Diesel Jumper Crewneck Sweater",
  ])("classifies tops: %s", (title) => {
    expect(classifyItemType(title)).toBe("top");
  });

  // ============================================================
  // Pants
  // ============================================================
  it.each([
    "Nike Tech Fleece jogger pants",
    "Nike Tech Fleece jogger pants",
    "Nike shorts szorty",
    "Carhartt cargo trousers",
    "Dickies jeans",
    "Levi's 501 dżinsy",
  ])("classifies pants: %s", (title) => {
    expect(classifyItemType(title)).toBe("pants");
  });

  // ============================================================
  // Bags
  // ============================================================
  it.each([
    "The North Face Base Camp duffel 55L",
    "The North Face plecak",
    "Osprey backpack 40L",
    "Supreme saszetka nerka",
    "Fjällräven Kånken torba",
  ])("classifies bags: %s", (title) => {
    expect(classifyItemType(title)).toBe("bag");
  });

  // ============================================================
  // Returns empty for ambiguous titles
  // ============================================================
  it.each([
    "Nike",
    "Salomon vintage",
    "Supreme Logo",
  ])("returns empty for ambiguous: %s", (title) => {
    expect(classifyItemType(title)).toBe("");
  });
});

// ============================================================
// isBrandTypeWorthNotifying
// ============================================================
describe("isBrandTypeWorthNotifying", () => {
  // Shoes-only brands
  it("allows Jordan shoes", () => {
    expect(isBrandTypeWorthNotifying("Jordan", "shoes")).toBe(true);
  });
  it("blocks Jordan tops", () => {
    expect(isBrandTypeWorthNotifying("Jordan", "top")).toBe(false);
  });
  it("blocks Jordan pants", () => {
    expect(isBrandTypeWorthNotifying("Jordan", "pants")).toBe(false);
  });
  it("blocks Asics tops", () => {
    expect(isBrandTypeWorthNotifying("Asics", "top")).toBe(false);
  });
  it("allows New Balance shoes", () => {
    expect(isBrandTypeWorthNotifying("New Balance", "shoes")).toBe(true);
  });

  // Shoes+jackets+bags brands
  it("blocks TNF pants", () => {
    expect(isBrandTypeWorthNotifying("The North Face", "pants")).toBe(false);
  });
  it("allows TNF bags", () => {
    expect(isBrandTypeWorthNotifying("The North Face", "bag")).toBe(true);
  });
  it("blocks Salomon tops", () => {
    expect(isBrandTypeWorthNotifying("Salomon", "top")).toBe(false);
  });

  // Unrestricted brands
  it("allows Nike everything", () => {
    expect(isBrandTypeWorthNotifying("Nike", "top")).toBe(true);
  });

  // Shoes-only brands (Crocs)
  it("allows Crocs shoes", () => {
    expect(isBrandTypeWorthNotifying("Crocs", "shoes")).toBe(true);
  });
  it("blocks Crocs tops", () => {
    expect(isBrandTypeWorthNotifying("Crocs", "top")).toBe(false);
  });

  // Unknown brand or type → pass through
  it("allows unknown brand", () => {
    expect(isBrandTypeWorthNotifying("RandomBrand", "top")).toBe(true);
  });
  it("allows empty item type", () => {
    expect(isBrandTypeWorthNotifying("The North Face", "")).toBe(true);
  });
});

// ============================================================
// vintedCategoryToItemType — numeric Vinted catalog_id mapping
// ============================================================
describe("vintedCategoryToItemType", () => {
  it.each([
    ["2684", "shoes"],
    ["2955", "shoes"],
    ["2711", "shoes"],
    ["2961", "shoes"],
    ["2691", "shoes"],
    ["2706", "shoes"],
    ["2695", "shoes"],
    ["2952", "shoes"],
    ["2713", "shoes"],
    ["2954", "shoes"],
    ["2960", "shoes"],
    ["2697", "shoes"],
    ["734", "shoes"],
  ])("maps %s to shoes", (catId, expected) => {
    expect(vintedCategoryToItemType(catId)).toBe(expected);
  });

  it.each([
    ["2632", "top"],
    ["2586", "top"],
    ["2936", "top"],
  ])("maps %s to top", (catId, expected) => {
    expect(vintedCategoryToItemType(catId)).toBe(expected);
  });

  it("maps 1929 to jacket", () => {
    expect(vintedCategoryToItemType("1929")).toBe("jacket");
  });

  it("maps 2845 to accessory", () => {
    expect(vintedCategoryToItemType("2845")).toBe("accessory");
  });

  it("returns empty for unknown category", () => {
    expect(vintedCategoryToItemType("9999")).toBe("");
  });

  it("returns empty for empty string", () => {
    expect(vintedCategoryToItemType("")).toBe("");
  });
});

// ============================================================
// resolveItemType — title classification with Vinted fallback
// ============================================================
describe("resolveItemType", () => {
  it("uses title classification when title has keywords", () => {
    expect(resolveItemType("Nike Air Max buty", "2961")).toBe("shoes");
  });

  it("falls back to Vinted category when title is vague", () => {
    expect(resolveItemType("Jordan 4 Retro White Oreo R.44", "2955")).toBe("shoes");
  });

  it("returns shoes from Vinted category for item with no keywords in title", () => {
    expect(resolveItemType("Nike R.42", "2684")).toBe("shoes");
  });

  it("returns top from Vinted category for vague title", () => {
    expect(resolveItemType("adidas Originals M", "2632")).toBe("top");
  });

  it("returns empty when both title and category are unknown", () => {
    expect(resolveItemType("Nike", "9999")).toBe("");
  });

  it("returns empty when title is vague and category is empty", () => {
    expect(resolveItemType("Supreme Logo", "")).toBe("");
  });

  it("title classifier takes priority over Vinted category", () => {
    // Title says jacket but Vinted says shoes — trust the title
    expect(resolveItemType("The North Face kurtka", "2955")).toBe("jacket");
  });
});
