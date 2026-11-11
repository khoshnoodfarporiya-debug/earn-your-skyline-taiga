import type { KitchenState } from "./kitchen";

/**
 * WHAT YOU ACTUALLY COOK
 *
 * The Chef shipped with produce and no food. Crates of "basic", "market" and
 * "luxury" bought covers, and a cover was an abstraction — nobody ever chose a
 * dish. This module is the layer where that choice lives: named ingredients,
 * recipes that consume them, and a menu the player composes out of the
 * recipes they have developed.
 *
 * ------------------------------------------------------ how it sits on top
 *
 * It sits *on top of* the crate larder rather than replacing it, and that is
 * the load-bearing decision in the whole feature. The crate is the staple —
 * the stock, the trimmings, the things a kitchen buys by the box and does not
 * write down — and it still meters covers, still ages, still feeds plate
 * quality through freshness and grade, still writes off what it loses. Every
 * figure this career was balanced against is that system, and it is untouched.
 *
 * A recipe is what turns one of those covers into a *dish*: it costs the
 * staple cover plus its own named ingredients, and in exchange it sets what
 * the cover sells for and how good it is. A kitchen with no menu therefore
 * plays exactly as it did before this file existed, which is what lets an old
 * save carry on without being quietly re-balanced.
 *
 * ---------------------------------------------------------------- the trade
 *
 * Every field here has to move a number the player can see, or it is
 * decoration:
 *
 *   `needs`        what the dish consumes, and therefore what you must buy and
 *                  hold — which is what makes a long menu expensive to keep
 *                  fresh rather than merely long
 *   `difficulty`   against the brigade's skill: a dish nobody can cook comes
 *                  out worse than one they can
 *   `prepTime`     against the brigade's hands: a menu of slow dishes plates
 *                  fewer covers
 *   `popularity`   what share of the room orders it, and therefore which
 *                  ingredients are used before they turn
 *   `originality` and `presentation` are the two halves of what a critic
 *                  notices, and the two things developing a dish moves
 */

/* ------------------------------------------------------------ ingredients */

export type IngredientCategory =
  | "produce"
  | "protein"
  | "seafood"
  | "dairy"
  | "dry"
  | "garnish";

/**
 * Where a thing has to be kept, which is the reason refrigeration is worth
 * buying for the pantry as well as for the crates.
 *
 *   dry      a shelf. Refrigeration does nothing for it.
 *   chilled  a fridge. A cold room adds real weeks.
 *   frozen   a freezer, and it barely ages once it is in one.
 */
export type Storage = "dry" | "chilled" | "frozen";

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  /** How it is counted and ordered. */
  unit: "kg" | "litre" | "dozen" | "portion";
  /** What one unit costs at the covered market, before supplier and city. */
  price: number;
  /** How many units come in one delivery. */
  orderSize: number;
  /** Weeks before it is written off, at ordinary storage. */
  life: number;
  storage: Storage;
  /** 0-100. Better things cost more and lift the plate. */
  quality: number;
  /** The weeks of a 52-week year it is at its best. Absent means all year. */
  season?: { from: number; to: number };
  blurb: string;
}

export const INGREDIENTS: Ingredient[] = [
  {
    id: "roots",
    name: "Root vegetables",
    category: "produce",
    unit: "kg",
    price: 3.2,
    orderSize: 40,
    life: 5,
    storage: "dry",
    quality: 45,
    blurb:
      "Carrots, celeriac, onions. They keep, they are cheap, and nobody writes about them.",
  },
  {
    id: "greens",
    name: "Leaves and herbs",
    category: "produce",
    unit: "kg",
    price: 8.5,
    orderSize: 12,
    life: 2,
    storage: "chilled",
    quality: 62,
    blurb:
      "Bright, fragile, and the first thing in the bin if the week goes quiet.",
  },
  {
    id: "tomatoes",
    name: "Vine tomatoes",
    category: "produce",
    unit: "kg",
    price: 6.4,
    orderSize: 20,
    life: 2,
    storage: "chilled",
    quality: 66,
    season: { from: 22, to: 40 },
    blurb: "Worth twice as much in August and worth avoiding in February.",
  },
  {
    id: "chicken",
    name: "Free-range chicken",
    category: "protein",
    unit: "kg",
    price: 9.8,
    orderSize: 25,
    life: 2,
    storage: "chilled",
    quality: 58,
    blurb:
      "The reliable centre of a plate. Everybody eats it and nobody is surprised.",
  },
  {
    id: "beef",
    name: "Aged beef",
    category: "protein",
    unit: "kg",
    price: 27,
    orderSize: 15,
    life: 3,
    storage: "chilled",
    quality: 80,
    blurb:
      "Hung for a month before it reaches you. Expensive, forgiving, and it sells itself.",
  },
  {
    id: "lamb",
    name: "Salt-marsh lamb",
    category: "protein",
    unit: "kg",
    price: 34,
    orderSize: 10,
    life: 2,
    storage: "chilled",
    quality: 86,
    season: { from: 14, to: 34 },
    blurb:
      "A short season and a long reputation. The kind of thing a menu is remembered for.",
  },
  {
    id: "whitefish",
    name: "Day-boat white fish",
    category: "seafood",
    unit: "kg",
    price: 22,
    orderSize: 12,
    life: 1,
    storage: "chilled",
    quality: 78,
    blurb:
      "Landed this morning and worthless by Thursday. The purest test of ordering well.",
  },
  {
    id: "shellfish",
    name: "Shellfish",
    category: "seafood",
    unit: "kg",
    price: 31,
    orderSize: 8,
    life: 1,
    storage: "chilled",
    quality: 84,
    blurb:
      "Alive when it arrives, and unforgiving about everything that happens next.",
  },
  {
    id: "butter",
    name: "Cultured butter",
    category: "dairy",
    unit: "kg",
    price: 11,
    orderSize: 15,
    life: 4,
    storage: "chilled",
    quality: 72,
    blurb:
      "Half of French cooking, and the reason the pass smells the way it does.",
  },
  {
    id: "cream",
    name: "Double cream",
    category: "dairy",
    unit: "litre",
    price: 6,
    orderSize: 20,
    life: 2,
    storage: "chilled",
    quality: 64,
    blurb:
      "Turns quietly, and takes a whole service down with it when it does.",
  },
  {
    id: "flour",
    name: "Stoneground flour",
    category: "dry",
    unit: "kg",
    price: 2.1,
    orderSize: 50,
    life: 12,
    storage: "dry",
    quality: 55,
    blurb:
      "Bread, pasta, pastry. It sits on a shelf for a season and does not complain.",
  },
  {
    id: "chocolate",
    name: "Single-origin chocolate",
    category: "dry",
    unit: "kg",
    price: 24,
    orderSize: 10,
    life: 10,
    storage: "dry",
    quality: 88,
    blurb:
      "Keeps for months, costs like meat, and finishes a meal people talk about.",
  },
  {
    id: "stockbones",
    name: "Bones and trim",
    category: "protein",
    unit: "kg",
    price: 1.8,
    orderSize: 30,
    life: 4,
    storage: "frozen",
    quality: 40,
    blurb:
      "What a stockpot is made of. Frozen it lasts, and it costs almost nothing.",
  },
  {
    id: "truffle",
    name: "Fresh truffle",
    category: "garnish",
    unit: "portion",
    price: 46,
    orderSize: 6,
    life: 1,
    storage: "chilled",
    quality: 95,
    season: { from: 44, to: 52 },
    blurb:
      "A week of usefulness and a price that assumes you know it. The definition of a risk.",
  },

  /* ---------------------------------------------------------- the luxuries
   *
   * Three ingredients that are only worth buying if the kitchen can handle
   * them, and each is gated on a technique in `craft.ts` rather than on money.
   * They share one property that makes them a decision rather than a purchase:
   * the better they are, the faster they die.
   */
  {
    id: "langoustine",
    name: "Live langoustines",
    category: "protein",
    unit: "kg",
    price: 62,
    orderSize: 4,
    life: 1,
    storage: "chilled",
    quality: 96,
    blurb:
      "Alive this morning, cooked tonight, worthless tomorrow. Nothing in this larder is less forgiving.",
  },
  {
    id: "agedbeef",
    name: "Dry-aged rib",
    category: "protein",
    unit: "kg",
    price: 54,
    orderSize: 6,
    life: 3,
    storage: "chilled",
    quality: 94,
    blurb:
      "Six weeks in somebody's cabinet before it reached yours, and priced accordingly.",
  },
  {
    id: "caviar",
    name: "Caviar",
    category: "garnish",
    unit: "portion",
    price: 88,
    orderSize: 8,
    life: 2,
    storage: "chilled",
    quality: 98,
    blurb:
      "A tin, a cold spoon, and about two weeks before it is an expensive mistake.",
  },
];

export const INGREDIENT_BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));

/* ---------------------------------------------------------------- recipes */

export type RecipeCategory =
  | "starter"
  | "main"
  | "dessert"
  | "side"
  | "special";

/** What a dish needs, per cover. */
export interface RecipeLine {
  ingredient: string;
  /** Units per cover. Small numbers: a plate is not a kilo of beef. */
  qty: number;
}

export interface Recipe {
  id: string;
  name: string;
  category: RecipeCategory;
  /** The tradition it belongs to. Two dishes from one cuisine read as a theme. */
  cuisine: string;
  needs: RecipeLine[];
  /** 0-100. Against the brigade's craft: too hard and it lands badly. */
  difficulty: number;
  /** Minutes on the pass, per cover. Slow dishes cost you covers. */
  prepTime: number;
  /** 0-100 before anything this kitchen does to it. */
  baseQuality: number;
  /** What people expect to pay, in Lyon money. The price itself is per menu. */
  suggestedPrice: number;
  /** Kit it cannot be cooked without. Ids from `KITCHEN_KIT`. */
  needsEquipment: string[];
  /** The best cook in the brigade must clear this for it to land properly. */
  needsSkill: number;
  /** 0-100. What share of a room orders it when it is on. */
  popularity: number;
  /** 0-100. How unlike everything else it is. */
  originality: number;
  /** 0-100. What it looks like when it lands. */
  presentation: number;
  /** What has to be true before it can be developed at all. */
  unlock: {
    craft?: number;
    /** Index into PREMISES: 1 is a bistro, 2 a restaurant. */
    room?: number;
    reputation?: number;
  };
  /** What developing it costs in cash, on top of a block of your week. */
  developCost: number;
  blurb: string;
}

/**
 * Seventeen dishes, chosen to prove the system rather than to fill a book.
 *
 * Between them they exercise every rule: all five categories, dishes gated on
 * equipment, on the brigade's skill and on the room, two seasonal ones, cheap
 * staples that are pure margin, and a truffle plate that is a bet. Adding a
 * thirteenth is a row here and nothing else.
 */
export const RECIPES: Recipe[] = [
  {
    id: "soup",
    name: "Soup of the day",
    category: "starter",
    cuisine: "Bistro",
    needs: [
      { ingredient: "roots", qty: 0.18 },
      { ingredient: "stockbones", qty: 0.08 },
    ],
    difficulty: 10,
    prepTime: 3,
    baseQuality: 40,
    suggestedPrice: 7,
    needsEquipment: [],
    needsSkill: 0,
    popularity: 55,
    originality: 8,
    presentation: 25,
    unlock: {},
    developCost: 0,
    blurb:
      "Whatever is left, softened and blitzed. Every kitchen has one and every kitchen needs one.",
  },
  {
    id: "bread",
    name: "House bread and butter",
    category: "side",
    cuisine: "Bistro",
    needs: [
      { ingredient: "flour", qty: 0.12 },
      { ingredient: "butter", qty: 0.03 },
    ],
    difficulty: 22,
    prepTime: 2,
    baseQuality: 52,
    suggestedPrice: 5,
    needsEquipment: [],
    needsSkill: 0,
    popularity: 70,
    originality: 12,
    presentation: 30,
    unlock: {},
    developCost: 0,
    blurb:
      "Costs almost nothing, is ordered by nearly everyone, and sets the tone before the food arrives.",
  },
  {
    id: "roast_chicken",
    name: "Roast chicken, root vegetables",
    category: "main",
    cuisine: "Bistro",
    needs: [
      { ingredient: "chicken", qty: 0.32 },
      { ingredient: "roots", qty: 0.15 },
      { ingredient: "butter", qty: 0.02 },
    ],
    difficulty: 28,
    prepTime: 8,
    baseQuality: 58,
    suggestedPrice: 21,
    needsEquipment: [],
    needsSkill: 20,
    popularity: 72,
    originality: 15,
    presentation: 40,
    unlock: {},
    developCost: 0,
    blurb:
      "The dish a kitchen is judged on, precisely because there is nowhere to hide.",
  },
  {
    id: "tomato_salad",
    name: "Tomato salad, herbs",
    category: "starter",
    cuisine: "Bistro",
    needs: [
      { ingredient: "tomatoes", qty: 0.2 },
      { ingredient: "greens", qty: 0.05 },
    ],
    difficulty: 12,
    prepTime: 3,
    baseQuality: 50,
    suggestedPrice: 9,
    needsEquipment: [],
    needsSkill: 0,
    popularity: 48,
    originality: 20,
    presentation: 55,
    unlock: { craft: 30 },
    developCost: 250,
    blurb:
      "Three ingredients and nothing between them and the diner. Brilliant in August, embarrassing in March.",
  },
  {
    id: "pasta",
    name: "Hand-rolled pasta, butter and herbs",
    category: "main",
    cuisine: "Italian",
    needs: [
      { ingredient: "flour", qty: 0.14 },
      { ingredient: "butter", qty: 0.04 },
      { ingredient: "greens", qty: 0.03 },
    ],
    difficulty: 42,
    prepTime: 7,
    baseQuality: 64,
    suggestedPrice: 18,
    needsEquipment: ["prep"],
    needsSkill: 35,
    popularity: 66,
    originality: 35,
    presentation: 52,
    unlock: { craft: 38 },
    developCost: 900,
    blurb:
      "Cheap to buy and expensive to make: it is all labour, which is why it needs a prep station.",
  },
  {
    id: "fish_meuniere",
    name: "White fish meunière",
    category: "main",
    cuisine: "French",
    needs: [
      { ingredient: "whitefish", qty: 0.24 },
      { ingredient: "butter", qty: 0.05 },
      { ingredient: "greens", qty: 0.02 },
    ],
    difficulty: 55,
    prepTime: 9,
    baseQuality: 72,
    suggestedPrice: 29,
    needsEquipment: ["coldroom"],
    needsSkill: 45,
    popularity: 54,
    originality: 40,
    presentation: 62,
    unlock: { craft: 46, room: 1 },
    developCost: 1_800,
    blurb:
      "One day of life in the fish, and about ninety seconds of margin for error in the pan.",
  },
  {
    id: "steak",
    name: "Aged beef, bone marrow butter",
    category: "main",
    cuisine: "French",
    needs: [
      { ingredient: "beef", qty: 0.3 },
      { ingredient: "butter", qty: 0.04 },
      { ingredient: "stockbones", qty: 0.1 },
    ],
    difficulty: 48,
    prepTime: 10,
    baseQuality: 76,
    suggestedPrice: 38,
    needsEquipment: ["range"],
    needsSkill: 42,
    popularity: 78,
    originality: 25,
    presentation: 58,
    unlock: { craft: 44, room: 1 },
    developCost: 2_200,
    blurb:
      "The highest-margin main on any menu, and the one every table can already picture.",
  },
  {
    id: "shellfish_plate",
    name: "Shellfish, cream and cider",
    category: "special",
    cuisine: "French",
    needs: [
      { ingredient: "shellfish", qty: 0.22 },
      { ingredient: "cream", qty: 0.08 },
      { ingredient: "greens", qty: 0.02 },
    ],
    difficulty: 68,
    prepTime: 12,
    baseQuality: 82,
    suggestedPrice: 46,
    needsEquipment: ["coldroom"],
    needsSkill: 58,
    popularity: 44,
    originality: 62,
    presentation: 74,
    unlock: { craft: 58, room: 2, reputation: 35 },
    developCost: 4_500,
    blurb:
      "Two ingredients that die in a day, cooked to order. Nobody attempts this with a bad fridge.",
  },
  {
    id: "lamb_spring",
    name: "Spring lamb, first greens",
    category: "main",
    cuisine: "French",
    needs: [
      { ingredient: "lamb", qty: 0.28 },
      { ingredient: "greens", qty: 0.06 },
      { ingredient: "butter", qty: 0.03 },
    ],
    difficulty: 62,
    prepTime: 11,
    baseQuality: 84,
    suggestedPrice: 44,
    needsEquipment: ["range"],
    needsSkill: 55,
    popularity: 58,
    originality: 55,
    presentation: 70,
    unlock: { craft: 55, room: 2 },
    developCost: 3_800,
    blurb:
      "On for twenty weeks of the year, and worth building the spring menu around for all of them.",
  },
  {
    id: "chocolate_tart",
    name: "Chocolate tart, cream",
    category: "dessert",
    cuisine: "French",
    needs: [
      { ingredient: "chocolate", qty: 0.06 },
      { ingredient: "flour", qty: 0.05 },
      { ingredient: "cream", qty: 0.05 },
      { ingredient: "butter", qty: 0.03 },
    ],
    difficulty: 52,
    prepTime: 6,
    baseQuality: 70,
    suggestedPrice: 12,
    needsEquipment: ["pastry"],
    needsSkill: 40,
    popularity: 62,
    originality: 30,
    presentation: 68,
    unlock: { craft: 42, room: 1 },
    developCost: 1_600,
    blurb:
      "Made in the morning, keeps all day, and every cover that orders one is margin.",
  },
  {
    id: "truffle_pasta",
    name: "Truffle pasta",
    category: "special",
    cuisine: "Italian",
    needs: [
      { ingredient: "flour", qty: 0.12 },
      { ingredient: "truffle", qty: 0.5 },
      { ingredient: "butter", qty: 0.05 },
    ],
    difficulty: 74,
    prepTime: 9,
    baseQuality: 88,
    suggestedPrice: 68,
    needsEquipment: ["prep"],
    needsSkill: 62,
    popularity: 38,
    originality: 78,
    presentation: 80,
    unlock: { craft: 62, room: 2, reputation: 45 },
    developCost: 6_000,
    blurb:
      "A week of shelf life on the one ingredient that costs more than the plate it sits on.",
  },
  {
    id: "tasting_course",
    name: "Tasting course",
    category: "special",
    cuisine: "Modern",
    needs: [
      { ingredient: "whitefish", qty: 0.09 },
      { ingredient: "lamb", qty: 0.09 },
      { ingredient: "greens", qty: 0.04 },
      { ingredient: "butter", qty: 0.03 },
      { ingredient: "chocolate", qty: 0.02 },
    ],
    difficulty: 88,
    prepTime: 16,
    baseQuality: 92,
    suggestedPrice: 95,
    needsEquipment: ["prep", "coldroom"],
    needsSkill: 70,
    popularity: 30,
    originality: 90,
    presentation: 92,
    unlock: { craft: 70, room: 2, reputation: 55 },
    developCost: 9_000,
    blurb:
      "Nine plates from five ingredients, every one of them perishable. The whole career in one dish.",
  },

  /* ------------------------------------------------------- the luxury five
   *
   * Each of these is gated on a *technique* as well as on craft, a room and a
   * reputation — see `craft.ts`. That is the difference between the top of
   * this menu and the rest of it: the money will not buy you the dish, and no
   * amount of reputation will either. You have to have learned to do it.
   */
{
    id: "langoustine",
    name: "Langoustines, grilled",
    category: "starter",
    cuisine: "Coastal",
    needs: [
      { ingredient: "langoustine", qty: 0.18 },
      { ingredient: "butter", qty: 0.04 },
    ],
    difficulty: 78,
    prepTime: 7,
    baseQuality: 92,
    suggestedPrice: 42,
    needsEquipment: ["range"],
    needsSkill: 66,
    popularity: 34,
    originality: 62,
    presentation: 88,
    unlock: { craft: 58, room: 2, reputation: 40 },
    developCost: 4_200,
    blurb:
      "Split, grilled, and on the plate in four minutes. There is nowhere to hide in this dish.",
  },
  {
    id: "aged_rib",
    name: "Dry-aged rib, jus",
    category: "main",
    cuisine: "Classical",
    needs: [
      { ingredient: "agedbeef", qty: 0.32 },
      { ingredient: "stockbones", qty: 0.4 },
      { ingredient: "butter", qty: 0.03 },
    ],
    difficulty: 80,
    prepTime: 12,
    baseQuality: 94,
    suggestedPrice: 82,
    needsEquipment: ["range", "coldroom"],
    needsSkill: 70,
    popularity: 46,
    originality: 48,
    presentation: 76,
    unlock: { craft: 66, room: 2, reputation: 48 },
    developCost: 7_500,
    blurb:
      "Two days of jus for a sauce that goes on in a spoonful. This is what the classical section is for.",
  },
  {
    id: "souffle",
    name: "Soufflé",
    category: "dessert",
    cuisine: "Classical",
    needs: [
      { ingredient: "chocolate", qty: 0.06 },
      { ingredient: "cream", qty: 0.08 },
      { ingredient: "butter", qty: 0.03 },
      { ingredient: "flour", qty: 0.04 },
    ],
    difficulty: 86,
    prepTime: 14,
    baseQuality: 90,
    suggestedPrice: 24,
    needsEquipment: ["pastry", "oven"],
    needsSkill: 72,
    popularity: 40,
    originality: 56,
    presentation: 84,
    unlock: { craft: 64, room: 2, reputation: 42 },
    developCost: 5_000,
    blurb:
      "Twelve minutes, no second chances, and the table has to be ready before it is.",
  },
  {
    id: "caviar_service",
    name: "Caviar service",
    category: "starter",
    cuisine: "Luxury",
    needs: [
      { ingredient: "caviar", qty: 0.5 },
      { ingredient: "cream", qty: 0.04 },
    ],
    difficulty: 55,
    prepTime: 4,
    baseQuality: 96,
    suggestedPrice: 120,
    needsEquipment: ["coldroom"],
    needsSkill: 58,
    popularity: 22,
    originality: 54,
    presentation: 94,
    unlock: { craft: 60, room: 3, reputation: 55 },
    developCost: 9_000,
    blurb:
      "The easiest thing on the menu to cook and the hardest to justify. Get out of its way.",
  },
  {
    id: "counter_course",
    name: "Counter course",
    category: "special",
    cuisine: "Modern",
    needs: [
      { ingredient: "whitefish", qty: 0.1 },
      { ingredient: "greens", qty: 0.06 },
      { ingredient: "butter", qty: 0.03 },
      { ingredient: "stockbones", qty: 0.2 },
    ],
    difficulty: 92,
    prepTime: 16,
    baseQuality: 96,
    suggestedPrice: 46,
    needsEquipment: ["prep", "blast"],
    needsSkill: 78,
    popularity: 30,
    originality: 94,
    presentation: 96,
    unlock: { craft: 74, room: 3, reputation: 58 },
    developCost: 12_000,
    blurb:
      "Cooked eighteen inches from the person eating it, which changes everything about how it has to look.",
  },
];

export const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

/** The dishes every kitchen can cook from week one, without developing them. */
export const STARTER_RECIPES = RECIPES.filter(
  (r) => r.developCost === 0 && Object.keys(r.unlock).length === 0,
).map((r) => r.id);

/* -------------------------------------------------------------- the state */

/**
 * What this kitchen has done to a recipe.
 *
 * Absent until it is developed, so an untouched catalogue costs a save
 * nothing. `name` is only present when the player has renamed it — an original
 * dish can be given a house name, and the catalogue keeps its own id and its
 * own name, so a rename can never orphan the row it belongs to.
 */
export interface RecipeProgress {
  id: string;
  /** The player's name for it, if they have given it one. */
  name?: string;
  /** Covers of it that have gone out. Feeds the signature threshold. */
  served: number;
  /** Rounds of development bought since it was developed. */
  refined: number;
  /** True once it is genuinely the dish this kitchen is known for. */
  signature?: boolean;
}

/** One dish on the menu, at the price the player set. */
export interface MenuEntry {
  recipe: string;
  price: number;
}

/** A lot of one ingredient, bought at one time from one supplier. */
export interface IngredientLot {
  id: string;
  ingredient: string;
  /** Units remaining. Never negative — see `consumeForCovers`. */
  qty: number;
  /** What one unit cost, for waste and food-cost arithmetic. */
  unitCost: number;
  /** Weeks of life this delivery arrived with. */
  life: number;
  boughtWeek: number;
  /** Who delivered it. */
  from?: string;
  /** 0-100 as delivered. A better supplier lands a better box. */
  quality: number;
}

/* -------------------------------------------------------------- arithmetic */

/** A recipe's name as the player knows it. */
export const recipeName = (r: Recipe, p?: RecipeProgress): string =>
  p?.name?.trim() || r.name;

/**
 * What one cover of a dish costs in ingredients, at catalogue prices.
 *
 * This is the *estimate* shown before anything is bought. What a cover
 * actually cost comes off the lots it was drawn from, and that is the figure
 * the ledger uses — two numbers on purpose, because the gap between them is
 * the player buying badly.
 */
export const recipeCost = (r: Recipe): number =>
  r.needs.reduce((n, line) => {
    const ing = INGREDIENT_BY_ID.get(line.ingredient);
    return ing ? n + ing.price * line.qty : n;
  }, 0);

/** Margin per cover at a given price, as money and as a share. */
export function dishMargin(
  r: Recipe,
  price: number,
): { cost: number; profit: number; foodCostShare: number } {
  const cost = recipeCost(r);
  return {
    cost,
    profit: price - cost,
    foodCostShare: price > 0 ? cost / price : 1,
  };
}

/**
 * How good this dish can be here, before the week's own pressure.
 *
 * Base quality, plus what development has added, plus what the ingredients in
 * it are worth, minus what the brigade cannot yet do. A dish beyond the
 * kitchen's skill is not refused — it is *served worse*, which is the honest
 * outcome and the one a player can learn from.
 */
export function dishQuality(
  r: Recipe,
  progress: RecipeProgress | undefined,
  bestSkill: number,
  /**
   * What the chef's own technique adds, from `craft.ts`.
   *
   * Optional and defaulting to nothing, so every existing caller and every
   * test written before techniques existed produces exactly the number it
   * always did. Only the discipline this dish belongs to contributes, which
   * is decided by the caller — a saucier's kitchen does not plate a better
   * tart, and this function must not be the place that forgets it.
   */
  techniqueLift = 0,
): number {
  const ingredientQuality =
    r.needs.length === 0
      ? 50
      : r.needs.reduce(
          (n, line) =>
            n + (INGREDIENT_BY_ID.get(line.ingredient)?.quality ?? 50),
          0,
        ) / r.needs.length;
  const refined = Math.min(12, (progress?.refined ?? 0) * 3);
  const shortfall = Math.max(0, r.needsSkill - bestSkill);
  return Math.max(
    5,
    Math.min(
      100,
      r.baseQuality * 0.6 +
        ingredientQuality * 0.25 +
        r.presentation * 0.15 +
        refined +
        techniqueLift -
        shortfall * 0.8,
    ),
  );
}

/** Rounds of development before a well-served dish becomes the house's own. */
export const SIGNATURE_REFINED = 3;
/** Covers of it that have to have gone out, too. */
export const SIGNATURE_SERVED = 250;

/** Has this dish earned the right to be called a signature? */
export const earnsSignature = (p: RecipeProgress): boolean =>
  p.refined >= SIGNATURE_REFINED && p.served >= SIGNATURE_SERVED;

/**
 * Why this recipe cannot be developed yet, in the player's words, or null.
 *
 * Takes the numbers rather than the run so it stays pure and testable, and so
 * a panel can ask about a dish the kitchen has never seen.
 */
export function recipeBlocker(
  r: Recipe,
  ctx: { craft: number; roomIndex: number; reputation: number },
): string | null {
  if (r.unlock.craft && ctx.craft < r.unlock.craft) {
    return `Needs ${r.unlock.craft} craft — you have ${Math.round(ctx.craft)}.`;
  }
  if (r.unlock.room !== undefined && ctx.roomIndex < r.unlock.room) {
    return "Needs a bigger room than this one.";
  }
  if (r.unlock.reputation && ctx.reputation < r.unlock.reputation) {
    return `Needs ${r.unlock.reputation} in reviews — you have ${Math.round(
      ctx.reputation,
    )}.`;
  }
  return null;
}

/**
 * Why a dish on the menu cannot be sent out at all, or null.
 *
 * Equipment and a brigade hopelessly short of the dish are the two hard stops.
 * Being merely *under*-skilled is a penalty rather than a block, and a missing
 * ingredient is stated separately by the caller, with the shortfall, because
 * it fixes itself the moment the van arrives.
 */
export function dishBlocker(
  r: Recipe,
  k: KitchenState,
  bestSkill: number,
): string | null {
  const installed = k.equipment ?? [];
  const missing = r.needsEquipment.filter((id) => !installed.includes(id));
  if (missing.length > 0) return `Needs ${missing.join(" and ")} installed.`;
  if (bestSkill + 25 < r.needsSkill) {
    return `Nobody here can cook it — it needs ${r.needsSkill} skill.`;
  }
  return null;
}

/** Is this ingredient in season in a given week of the run? */
export function inSeason(ing: Ingredient, week: number): boolean {
  if (!ing.season) return true;
  const w = ((week - 1) % 52) + 1;
  return w >= ing.season.from && w <= ing.season.to;
}

/**
 * What a unit costs this week, before supplier and city.
 *
 * Out of season is dearer, which is what makes the seasonal ingredients a
 * calendar to plan against rather than a label on a card.
 */
export const seasonalPrice = (ing: Ingredient, week: number): number =>
  inSeason(ing, week) ? ing.price : ing.price * 1.55;
