import type { MedicalState, SupplyState, SupplyTier } from "./types";

/**
 * CONSUMABLES
 *
 * Dressings, cannulas, reagents, gloves, the drugs you actually hand over.
 * Every treated case burns some, and the bill scales with what you billed —
 * a bowel resection consumes more than a blood-pressure check.
 *
 * The decision is not *whether* to buy. It is whether to tie up cash for a
 * discount:
 *
 *   Spot        — pay for exactly what you used, at full price. No capital
 *                 tied up, worst unit cost.
 *   Bulk        — pay up front for weeks of cover and get more stock per
 *                 pound. Cheaper per case, and the money is gone until it is
 *                 used.
 *
 * Auto-order is on by default and simply pays spot for any shortfall, so a
 * player who never opens the screen is never blocked — they just quietly pay
 * the worst price. Turning it off is the gamble: run dry and the practice
 * throttles until you restock.
 */

/**
 * Cost of consumables for one treated case, by severity.
 *
 * Deliberately per-case rather than a share of revenue. A revenue share was
 * tried first and flattened the strategy space: it taxes whichever line is
 * winning hardest, so expansion and marketing lost most of their advantage
 * and four separate strategies converged on the same win rate. Consumables
 * track clinical *activity*, not billing — a dressing costs the same whoever
 * is paying for it.
 */
export const SUPPLY_COST = [0, 4, 8, 16, 28, 45];

export const costForSeverity = (severity: number) =>
  SUPPLY_COST[Math.max(1, Math.min(5, Math.round(severity)))];

/** Capacity multiplier while stocked out. */
export const SHORTAGE_THROTTLE = 0.6;

/** Weeks of throttling a stock-out causes. */
export const SHORTAGE_WEEKS = 2;

export const SUPPLY_TIERS: SupplyTier[] = [
  {
    id: "weeks4",
    label: "Standing order",
    weeks: 4,
    /** Stock received per pound spent. */
    yield: 1.14,
    blurb: "Four weeks of cover. A small discount for committing.",
  },
  {
    id: "weeks12",
    label: "Bulk order",
    weeks: 12,
    yield: 1.25,
    blurb: "A quarter's cover. Meaningful savings, meaningful cash tied up.",
  },
  {
    id: "weeks26",
    label: "Annual contract",
    weeks: 26,
    yield: 1.38,
    blurb: "Half a year. The best unit price available, and a large cheque.",
  },
];

export const TIER_BY_ID = new Map(SUPPLY_TIERS.map((t) => [t.id, t]));

export function initialSupplies(): SupplyState {
  return {
    stock: 900,
    autoOrder: true,
    lastConsumption: 0,
    throttleWeeks: 0,
  };
}

/**
 * What a week is expected to burn. Uses last week's actual draw, with a floor
 * so the very first order is not free.
 */
export function weeklyEstimate(m: MedicalState): number {
  return Math.max(300, m.supplies.lastConsumption);
}

export function tierCost(m: MedicalState, tierId: string): number {
  const tier = TIER_BY_ID.get(tierId);
  if (!tier) return 0;
  return Math.round(weeklyEstimate(m) * tier.weeks);
}

export function tierStock(m: MedicalState, tierId: string): number {
  const tier = TIER_BY_ID.get(tierId);
  if (!tier) return 0;
  return Math.round(tierCost(m, tierId) * tier.yield);
}

/** Weeks of cover currently held, for the UI. */
export function weeksOfCover(m: MedicalState): number {
  return m.supplies.stock / weeklyEstimate(m);
}

/** Capacity multiplier this week — 1 unless a stock-out is being served out. */
export function supplyThrottle(m: MedicalState): number {
  return m.supplies.throttleWeeks > 0 ? SHORTAGE_THROTTLE : 1;
}

export interface SupplyDraw {
  consumed: number;
  /** Bought at spot to cover a gap, when auto-order is on. */
  emergencySpend: number;
  /** True when the practice ran dry and will be throttled. */
  stockedOut: boolean;
}

/** What a week's treated caseload costs in consumables. */
export function consumptionFor(
  cases: { severity: number; treated: number }[],
): number {
  return cases.reduce(
    (sum, c) => sum + c.treated * costForSeverity(c.severity),
    0,
  );
}

/**
 * Draws a week's consumption. Called after the caseload resolves, because
 * consumption is a function of what was actually treated.
 */
export function drawSupplies(m: MedicalState, consumed: number): SupplyDraw {
  const s = m.supplies;
  s.lastConsumption = consumed;

  if (s.throttleWeeks > 0) s.throttleWeeks -= 1;

  if (s.stock >= consumed) {
    s.stock -= consumed;
    return { consumed, emergencySpend: 0, stockedOut: false };
  }

  const shortfall = consumed - s.stock;
  s.stock = 0;

  if (s.autoOrder) {
    // Covered, at the worst unit price — which is the cost of never planning.
    return { consumed, emergencySpend: shortfall, stockedOut: false };
  }

  // Gambled and lost. The practice runs at reduced capacity until restocked.
  s.throttleWeeks = SHORTAGE_WEEKS;
  return { consumed, emergencySpend: 0, stockedOut: true };
}
