import { describe, it, expect } from "vitest";
import { classifyItemType, isBrandTypeWorthNotifying } from "../src/item-classifier.js";

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
  ])("classifies shoes: %s", (title) => {
    expect(classifyItemType(title)).toBe("shoes");
  });

  // ============================================================
  // Jackets / outerwear
  // ============================================================
  it.each([
    "The North Face Nuptse 700",
    "Mammut Nano Puff kurtka",
    "TNF 1996 Retro Nuptse puffer",
    "The North Face fleece jacket",
    "North Face Denali fleece",
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

  // Shoes-only brands (including Crocs, Dr. Martens)
  it("allows Crocs shoes", () => {
    expect(isBrandTypeWorthNotifying("Crocs", "shoes")).toBe(true);
  });
  it("blocks Crocs tops", () => {
    expect(isBrandTypeWorthNotifying("Crocs", "top")).toBe(false);
  });
  it("allows Dr. Martens shoes", () => {
    expect(isBrandTypeWorthNotifying("Dr. Martens", "shoes")).toBe(true);
  });
  it("blocks Dr. Martens tops", () => {
    expect(isBrandTypeWorthNotifying("Dr. Martens", "top")).toBe(false);
  });

  // Unknown brand or type → pass through
  it("allows unknown brand", () => {
    expect(isBrandTypeWorthNotifying("RandomBrand", "top")).toBe(true);
  });
  it("allows empty item type", () => {
    expect(isBrandTypeWorthNotifying("The North Face", "")).toBe(true);
  });
});
