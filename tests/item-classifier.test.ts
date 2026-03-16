import { describe, it, expect } from "vitest";
import { classifyItemType } from "../src/item-classifier.js";

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
    "Arc'teryx Alpha SV jacket",
    "The North Face Nuptse 700",
    "Patagonia Nano Puff kurtka",
    "Arc'teryx Beta AR Gore-Tex",
    "TNF 1996 Retro Nuptse puffer",
    "Patagonia Retro-X fleece jacket",
    "North Face Denali fleece",
    "Arc'teryx Atom LT Hoody",
    "Arc'teryx Cerium Down Jacket",
    "Canada Goose parka zimowa",
    "Mammut hardshell anorak",
  ])("classifies jackets: %s", (title) => {
    expect(classifyItemType(title)).toBe("jacket");
  });

  // ============================================================
  // Tops (shirts, t-shirts, blouses, hoodies, fleece)
  // ============================================================
  it.each([
    "Arc'teryx shirt koszulka",
    "Patagonia t-shirt",
    "Nike hoodie bluza",
    "The North Face longsleeve",
    "Supreme Box Logo tee",
    "Salomon polo shirt",
    "Carhartt WIP sweatshirt",
    "Arc'teryx bluzka sportowa",
  ])("classifies tops: %s", (title) => {
    expect(classifyItemType(title)).toBe("top");
  });

  // ============================================================
  // Pants
  // ============================================================
  it.each([
    "Arc'teryx spodnie trekkingowe",
    "Nike Tech Fleece jogger pants",
    "Patagonia shorts szorty",
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
    "Patagonia Black Hole duffel 55L",
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
    "Arc'teryx",
    "Salomon vintage",
    "Supreme Logo",
  ])("returns empty for ambiguous: %s", (title) => {
    expect(classifyItemType(title)).toBe("");
  });
});
