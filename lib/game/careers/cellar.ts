import type { KitchenState } from "./kitchen";
import { cityOf, premisesOf } from "./kitchen";

/**
 * THE CELLAR
 *
 * The one thing in a restaurant that gets *better* while it sits there.
 *
 * That inversion is why this exists as its own system rather than as another
 * shelf in the larder. Everything else in this career is about spoilage: buy
 * too much and you pay twice, once for the bin and again in the reviews. Wine
 * is the opposite trade — money you take off the floor and put into a rack,
 * which is worth more every week you leave it and worth nothing at all if you
 * needed that money on Tuesday.
 *
 * ---------------------------------------------------------------- the rules
 *
 *   1. **You have to have somewhere to put it.** Without the wine store
 *      installed, the cellar holds a token amount and the rest is a
 *      cupboard — a bought case that cannot be kept properly is a bought case
 *      that will not be worth anything.
 *   2. **Bottles are drunk.** A list is not a passive multiplier; covers open
 *      bottles, and a list that runs out stops earning. That is what stops
 *      this being free money with an ageing bonus attached.
 *   3. **It peaks and then it fades.** A wine held to its peak is worth
 *      considerably more than it cost. Held a decade past it, it is a story
 *      about a bottle you should have sold.
 *   4. **A sommelier sells it.** The role earns its salary here and nowhere
 *      else, which is exactly the trade a real restaurant makes.
 *
 * Optional on the save, like everything since Phase 1: a kitchen with no
 * cellar pours nothing, earns nothing from wine, and plays as it always did.
 */

export interface Wine {
  id: string;
  label: string;
  region: string;
  /** Red, white, sparkling, sweet — what it is at the table. */
  style: string;
  blurb: string;
  /** What a bottle costs, in Lyon money, before the city. */
  price: number;
  /** Bottles per case. Buying is by the case. */
  caseSize: number;
  /** 0–100. What having it on the list says about the restaurant. */
  prestige: number;
  /** Weeks from purchase until it is at its best. */
  peak: number;
  /** Share of its value gained per week while it climbs. */
  climb: number;
  /** What it is sold for, as a multiple of what it cost. */
  markup: number;
  /** Dish categories it is poured with. */
  pairs: string[];
}

export const WINES: Wine[] = [
  {
    id: "house_white",
    label: "House white",
    region: "Local",
    style: "White",
    blurb:
      "Bought by the pallet, poured by the glass, and the reason the wine list makes any money at all.",
    price: 6,
    caseSize: 24,
    prestige: 8,
    peak: 8,
    climb: 0.002,
    markup: 3.4,
    pairs: ["starter", "main", "side"],
  },
  {
    id: "house_red",
    label: "House red",
    region: "Local",
    style: "Red",
    blurb: "Nobody has ever complained about it and nobody has ever mentioned it.",
    price: 7,
    caseSize: 24,
    prestige: 8,
    peak: 10,
    climb: 0.002,
    markup: 3.4,
    pairs: ["main", "side"],
  },
  {
    id: "cremant",
    label: "Crémant",
    region: "Loire",
    style: "Sparkling",
    blurb:
      "What people drink while they decide, and the first thing on every bill.",
    price: 14,
    caseSize: 12,
    prestige: 24,
    peak: 12,
    climb: 0.003,
    markup: 3.1,
    pairs: ["starter", "dessert"],
  },
  {
    id: "chablis",
    label: "Chablis, premier cru",
    region: "Burgundy",
    style: "White",
    blurb: "Stone and lemon. The bottle that makes a shellfish plate make sense.",
    price: 38,
    caseSize: 12,
    prestige: 52,
    peak: 60,
    climb: 0.006,
    markup: 2.9,
    pairs: ["starter", "main"],
  },
  {
    id: "rhone",
    label: "Northern Rhône syrah",
    region: "Rhône",
    style: "Red",
    blurb:
      "Pepper, bacon fat and violets, and it will outlive everyone who ordered it.",
    price: 52,
    caseSize: 12,
    prestige: 58,
    peak: 130,
    climb: 0.007,
    markup: 2.8,
    pairs: ["main"],
  },
  {
    id: "barolo",
    label: "Barolo",
    region: "Piedmont",
    style: "Red",
    blurb: "Undrinkable young, extraordinary old, and expensive at both ends.",
    price: 78,
    caseSize: 6,
    prestige: 72,
    peak: 180,
    climb: 0.009,
    markup: 2.7,
    pairs: ["main"],
  },
  {
    id: "sauternes",
    label: "Sauternes",
    region: "Bordeaux",
    style: "Sweet",
    blurb:
      "Half a glass with the tart, and the table stops talking for a moment.",
    price: 64,
    caseSize: 6,
    prestige: 66,
    peak: 150,
    climb: 0.008,
    markup: 2.9,
    pairs: ["dessert"],
  },
  {
    id: "champagne",
    label: "Grower champagne",
    region: "Champagne",
    style: "Sparkling",
    blurb:
      "A grower's own fruit, disgorged by hand. Somebody at the table will know what that means.",
    price: 96,
    caseSize: 6,
    prestige: 84,
    peak: 120,
    climb: 0.008,
    markup: 2.6,
    pairs: ["starter", "dessert", "main"],
  },
  {
    id: "burgundy",
    label: "Grand cru burgundy",
    region: "Burgundy",
    style: "Red",
    blurb:
      "The bottle a wine list is actually judged on, whether or not anybody orders it.",
    price: 340,
    caseSize: 3,
    prestige: 100,
    peak: 220,
    climb: 0.011,
    markup: 2.4,
    pairs: ["main"],
  },
];

export const WINE_BY_ID = new Map(WINES.map((w) => [w.id, w]));

/** One case, bought at one time. */
export interface WineLot {
  id: string;
  wine: string;
  /** Bottles remaining. Never negative. */
  bottles: number;
  /** What one bottle cost when it was bought. */
  unitCost: number;
  boughtWeek: number;
}

export const cellarOf = (k: KitchenState): WineLot[] => k.cellar ?? [];

/**
 * The most a bottle can ever be worth against what it cost.
 *
 * Low on purpose. A cellar is a restaurant's cellar, and this number is the
 * one thing standing between that and a wine fund with a kitchen attached —
 * every week held is money that is not in the till, and the reward for it has
 * to stay inside the range where that is still a real question.
 */
const MAX_MATURITY = 2.4;

/**
 * What an aged bottle actually sells for, as a multiple of what it cost.
 *
 * *Not* markup × maturity. A restaurant that pays £100 for a bottle sells it
 * at around £300; when that bottle is worth £240 a decade later it does not go
 * on the list at £720. The markup compresses as the bottle appreciates, which
 * is what wine lists actually do, and it is what stops the cellar being paid
 * twice for the same wait.
 */
const saleMultiple = (wine: Wine, matured: number): number =>
  wine.markup * Math.min(1.6, matured);

/* ------------------------------------------------------------ the capacity */

/**
 * How many bottles this kitchen can keep properly.
 *
 * Without the wine store it is a rack behind the bar: enough to pour with,
 * nothing you would age. The room matters too — a flagship has a cellar under
 * it and a market stall has a crate.
 */
export function cellarCapacity(k: KitchenState): number {
  const store = (k.equipment ?? []).includes("cellar") ? 900 : 0;
  const room = ["stall", "bistro", "restaurant", "flagship", "destination"].indexOf(
    premisesOf(k).id,
  );
  return 40 + Math.max(0, room) * 90 + store;
}

export const bottlesHeld = (k: KitchenState): number =>
  cellarOf(k).reduce((n, lot) => n + lot.bottles, 0);

export const cellarFull = (k: KitchenState): boolean =>
  bottlesHeld(k) >= cellarCapacity(k);

/* ---------------------------------------------------------------- ageing */

/**
 * What a bottle is worth now, against what it cost.
 *
 * Climbs to its peak and then declines slowly — a wine twice as old as its
 * peak is worth about what it cost, and a wine three times as old is a
 * cautionary tale. Bounded at four times cost so the cellar cannot become an
 * investment fund that happens to have a restaurant attached.
 */
export function maturityOf(wine: Wine, held: number): number {
  if (held <= 0) return 1;
  if (held <= wine.peak) return Math.min(MAX_MATURITY, 1 + held * wine.climb);
  const atPeak = Math.min(MAX_MATURITY, 1 + wine.peak * wine.climb);
  const past = held - wine.peak;
  return Math.max(0.55, atPeak - past * wine.climb * 0.85);
}

/** In words, because a multiplier is not a decision. */
export function maturityWord(wine: Wine, held: number): string {
  if (held < wine.peak * 0.4) return "Young — worth keeping";
  if (held < wine.peak * 0.85) return "Coming round";
  if (held <= wine.peak * 1.15) return "At its best — pour it or sell it";
  if (held <= wine.peak * 2) return "Past its peak";
  return "Over the hill";
}

/** What the whole cellar is worth today. Counts on the balance sheet. */
export function cellarValue(k: KitchenState, week: number): number {
  return Math.round(
    cellarOf(k).reduce((n, lot) => {
      const wine = WINE_BY_ID.get(lot.wine);
      if (!wine) return n;
      return n + lot.bottles * lot.unitCost * maturityOf(wine, week - lot.boughtWeek);
    }, 0),
  );
}

/** What a case costs here, in this city's money. */
export const casePrice = (k: KitchenState, wine: Wine): number =>
  Math.round(wine.price * wine.caseSize * cityOf(k).spend);

/* ------------------------------------------------------------- the pouring */

/**
 * How much of the room drinks, and how well.
 *
 * A sommelier is the whole difference between a list and a wine programme:
 * without one, people order the second-cheapest bottle; with one, they are
 * talked into the thing that actually goes with what they ordered.
 */
export function pourRate(k: KitchenState, hasSommelier: boolean): number {
  const list = listPrestige(k);
  const base = 0.3 + Math.min(0.22, list / 420);
  return hasSommelier ? base * 1.55 : base;
}

/** How impressive the list is, 0–100, from what is actually in the racks. */
export function listPrestige(k: KitchenState): number {
  const lots = cellarOf(k).filter((l) => l.bottles > 0);
  if (lots.length === 0) return 0;
  const best = Math.max(
    ...lots.map((l) => WINE_BY_ID.get(l.wine)?.prestige ?? 0),
  );
  const breadth = Math.min(30, lots.length * 5);
  return Math.min(100, best * 0.7 + breadth);
}

export interface Pour {
  /** Bottles opened. */
  bottles: number;
  /** What they sold for. */
  revenue: number;
  /** What they had cost, off the lots they came from. */
  cost: number;
  /** The best thing poured, for the report. */
  best: string | null;
}

/**
 * Pour for a night, oldest-first within each wine.
 *
 * Oldest-first for the same reason the larder is drawn oldest-first: it is
 * what a cellar actually does, and it means the ageing bonus is realised
 * rather than hoarded. A bottle that has climbed sells for more, so the
 * decision to hold is paid off at the moment it is opened.
 *
 * Never takes a lot below zero — the invariant the whole inventory rests on.
 */
export function pourForCovers(
  k: KitchenState,
  covers: number,
  week: number,
  hasSommelier: boolean,
  categories: string[],
): Pour {
  const want = Math.floor((covers * pourRate(k, hasSommelier)) / 2.4);
  if (want <= 0) return { bottles: 0, revenue: 0, cost: 0, best: null };

  /* The good stuff first: a sommelier sells the list from the top, and a
     kitchen without one still opens what pairs. */
  const lots = cellarOf(k)
    .filter((l) => l.bottles > 0)
    .filter((l) => {
      const wine = WINE_BY_ID.get(l.wine);
      if (!wine) return false;
      return categories.length === 0 || wine.pairs.some((p) => categories.includes(p));
    })
    .sort((a, b) => {
      const wa = WINE_BY_ID.get(a.wine)!;
      const wb = WINE_BY_ID.get(b.wine)!;
      if (hasSommelier && wa.prestige !== wb.prestige) {
        return wb.prestige - wa.prestige;
      }
      return a.boughtWeek - b.boughtWeek;
    });

  let left = want;
  let revenue = 0;
  let cost = 0;
  let best: string | null = null;
  let bestPrestige = -1;

  for (const lot of lots) {
    if (left <= 0) break;
    const wine = WINE_BY_ID.get(lot.wine);
    if (!wine) continue;
    const take = Math.min(lot.bottles, left);
    if (take <= 0) continue;
    const matured = maturityOf(wine, week - lot.boughtWeek);
    revenue += take * lot.unitCost * saleMultiple(wine, matured);
    cost += take * lot.unitCost;
    lot.bottles -= take;
    left -= take;
    if (wine.prestige > bestPrestige) {
      bestPrestige = wine.prestige;
      best = wine.label;
    }
  }

  k.cellar = cellarOf(k).filter((l) => l.bottles > 0);
  return {
    bottles: want - left,
    revenue: Math.round(revenue),
    cost: Math.round(cost),
    best,
  };
}

/**
 * What the list does to the room even when nobody is drinking.
 *
 * A serious list is a reason to book, and it is read by the segments who care
 * about the room. Small and bounded — it is a reason to come, not a substitute
 * for cooking.
 */
export const cellarDraw = (k: KitchenState): number =>
  1 + Math.min(0.09, listPrestige(k) / 1_100);

/** Why a case cannot be bought, in the player's words. */
export function wineBlocker(
  k: KitchenState,
  wine: Wine,
  cash: number,
): string | null {
  if (bottlesHeld(k) + wine.caseSize > cellarCapacity(k)) {
    return (k.equipment ?? []).includes("cellar")
      ? "Needs space — the cellar is full"
      : "Needs the wine store — nowhere to keep it";
  }
  if (cash < casePrice(k, wine)) return "Costs more than you have";
  return null;
}

/** Bottles that would be sold off, for the "realise the cellar" command. */
export function sellPrice(k: KitchenState, lot: WineLot, week: number): number {
  const wine = WINE_BY_ID.get(lot.wine);
  if (!wine) return 0;
  /* A merchant pays less than a diner: selling stock back is always a worse
     deal than pouring it, which is what keeps the cellar a restaurant's
     cellar rather than a trading desk. */
  return Math.round(
    lot.bottles * lot.unitCost * maturityOf(wine, week - lot.boughtWeek) * 0.72,
  );
}
