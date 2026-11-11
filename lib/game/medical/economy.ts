import type { Rng } from "../types";
import type { CityId } from "./types";
import { CITIES, cityOf } from "./cities";

/**
 * THE CITY ECONOMY
 *
 * Cities were constants. New York billed at 2.10x in week one and in week one
 * hundred and fifty-six, which made expansion a lookup table: read the fee
 * index, read the cost index, pick the best one, done forever.
 *
 * Now each market has a state that moves. Not much, and not fast — the whole
 * point is that a decision made in week 30 was *right then* and may not be
 * right at week 90, which only works if the drift is slow enough to be a trend
 * rather than noise you cannot plan around.
 *
 * -------------------------------------------------------------- what moves
 *
 * Six numbers, each a multiplier around 1.0, each with a different half-life:
 *
 *   demand      how much work there is        (fastest, cycle-driven)
 *   salary      what people cost              (slow, sticky upward)
 *   rent        what premises cost            (slow, follows growth)
 *   fees        what the work bills for       (slow)
 *   talent      how good the applicants are   (medium)
 *   sentiment   what the public locally think (medium, event-driven)
 *
 * Plus `regulation` (0..100, a level not a multiplier) and a `cycle` phase
 * that is the shared driver behind demand and rent.
 *
 * ---------------------------------------------------------------- bounded
 *
 * Every multiplier is clamped to [0.6, 1.6] and drifts back toward 1.0. A
 * random walk with no restoring force eventually produces a city where nothing
 * costs anything, and the balance harness would find it long before a player
 * did — but it would find it as "the economy is broken", which is a much worse
 * bug to diagnose than "New York got 8% more expensive this year".
 */

export interface CityMarket {
  /** Multiplier on how many cases arrive. */
  demand: number;
  /** Multiplier on wages and upkeep, on top of the city's static costIndex. */
  salary: number;
  /** Multiplier on premises prices, on top of propertyIndex. */
  rent: number;
  /** Multiplier on what treatment bills for, on top of feeIndex. */
  fees: number;
  /** How good the people who apply here are. */
  talent: number;
  /** Local public opinion, 0..100. Feeds catchment and contract offers. */
  sentiment: number;
  /** Regulatory burden, 0..100. Raises admin load and inspection risk. */
  regulation: number;
  /**
   * Where the local business cycle is, in radians. Advanced a little each
   * week; demand and rent are read off it. A phase rather than a flag so the
   * transition between boom and recession is gradual by construction.
   */
  cycle: number;
  /** Weeks left on a shock. Zero means the city is drifting normally. */
  shockWeeks: number;
  /** What the shock is, for the interface to name it. */
  shock: CityShock | null;
}

export type CityShock =
  | "boom"
  | "recession"
  | "wage-spiral"
  | "property-crash"
  | "regulatory-crackdown"
  | "public-backlash";

export const CITY_SHOCKS: readonly CityShock[] = [
  "boom",
  "recession",
  "wage-spiral",
  "property-crash",
  "regulatory-crackdown",
  "public-backlash",
];

export const SHOCK_LABEL: Record<CityShock, string> = {
  boom: "Boom",
  recession: "Recession",
  "wage-spiral": "Wage spiral",
  "property-crash": "Property crash",
  "regulatory-crackdown": "Regulatory crackdown",
  "public-backlash": "Public backlash",
};

export const SHOCK_BLURB: Record<CityShock, string> = {
  boom: "Money is moving. More work, and everything costs more to chase it.",
  recession: "The work is thinner and people are putting off appointments.",
  "wage-spiral": "Every practice in the city is bidding for the same clinicians.",
  "property-crash": "Premises are cheap. Somebody else's problem is your opportunity.",
  "regulatory-crackdown": "New requirements, new paperwork, and inspectors who mean it.",
  "public-backlash": "A scandal somewhere in the city has soured people on private medicine.",
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 1));

/** Neutral. A city nobody has visited is exactly its static definition. */
export function initialMarket(seed: number, index: number): CityMarket {
  return {
    demand: 1,
    salary: 1,
    rent: 1,
    fees: 1,
    talent: 1,
    sentiment: 50,
    regulation: 20,
    /* Spread the starting phases so the fourteen cities are not one
       synchronised world economy — a global boom every forty weeks would be a
       weather system, not a set of markets. */
    cycle: ((seed % 97) + index * 13) % 100 / 100 * Math.PI * 2,
    shockWeeks: 0,
    shock: null,
  };
}

export const initialMarkets = (seed: number): Record<string, CityMarket> =>
  Object.fromEntries(CITIES.map((c, i) => [c.id, initialMarket(seed, i)]));

/**
 * One week of drift for one city.
 *
 * Pure apart from the RNG, and the RNG is only consulted for shocks — the
 * ordinary week is deterministic given the cycle phase, which is what makes
 * the trend legible instead of jittery.
 */
export function driftMarket(m: CityMarket, rng: Rng, week: number): void {
  // The cycle is about a three-year period, so a 156-week run sees roughly one
  // full turn: a player lives through one boom and one downturn, not six.
  m.cycle = (m.cycle + 0.041) % (Math.PI * 2);
  const wave = Math.sin(m.cycle);

  if (m.shockWeeks > 0) {
    m.shockWeeks -= 1;
    applyShockPressure(m, m.shock);
    if (m.shockWeeks === 0) m.shock = null;
  } else {
    /* Restoring drift. Each value moves 4% of the way back to its resting
       point every week, so a shock's effects fade over roughly half a year
       rather than being switched off the moment the shock ends. */
    m.demand += (1 + wave * 0.12 - m.demand) * 0.05;
    m.salary += (1 + wave * 0.05 - m.salary) * 0.04;
    m.rent += (1 + wave * 0.09 - m.rent) * 0.04;
    m.fees += (1 - m.fees) * 0.04;
    m.talent += (1 - m.talent) * 0.05;
    m.sentiment += (50 - m.sentiment) * 0.03;
    m.regulation += (20 - m.regulation) * 0.02;

    /* Shocks are rare and get slightly more likely as the run goes on, for
       the same reason outbreak pressure does: the endgame should be the
       dangerous part, not a plateau. */
    const chance = Math.min(0.02, 0.004 + week * 0.00008);
    if (rng.chance(chance)) {
      m.shock = rng.pick([...CITY_SHOCKS]);
      m.shockWeeks = 8 + rng.int(0, 10);
    }
  }

  m.demand = clamp(m.demand, 0.6, 1.6);
  m.salary = clamp(m.salary, 0.6, 1.6);
  m.rent = clamp(m.rent, 0.6, 1.6);
  m.fees = clamp(m.fees, 0.6, 1.6);
  m.talent = clamp(m.talent, 0.6, 1.6);
  m.sentiment = clamp(m.sentiment, 0, 100);
  m.regulation = clamp(m.regulation, 0, 100);
}

/** What a running shock pushes toward each week it lasts. */
function applyShockPressure(m: CityMarket, shock: CityShock | null): void {
  switch (shock) {
    case "boom":
      m.demand += 0.03;
      m.rent += 0.02;
      m.salary += 0.015;
      break;
    case "recession":
      m.demand -= 0.03;
      m.fees -= 0.012;
      m.talent += 0.02; // good people become available when others cut
      break;
    case "wage-spiral":
      m.salary += 0.035;
      m.talent -= 0.02;
      break;
    case "property-crash":
      m.rent -= 0.04;
      m.demand -= 0.008;
      break;
    case "regulatory-crackdown":
      m.regulation += 3.5;
      m.fees -= 0.008;
      break;
    case "public-backlash":
      m.sentiment -= 2.2;
      m.demand -= 0.015;
      break;
    default:
      break;
  }
}

/* --------------------------------------------------------------- readers */

/**
 * These are the only way the rest of the game should read a market, so that
 * "the static definition times the current drift" lives in one place. A caller
 * that multiplied `city.feeIndex` by `market.fees` itself would be one
 * refactor away from forgetting to.
 */

export const marketOf = (
  markets: Record<string, CityMarket> | undefined,
  city: CityId,
): CityMarket =>
  markets?.[city] ?? {
    demand: 1,
    salary: 1,
    rent: 1,
    fees: 1,
    talent: 1,
    sentiment: 50,
    regulation: 20,
    cycle: 0,
    shockWeeks: 0,
    shock: null,
  };

export const effectiveFee = (
  markets: Record<string, CityMarket> | undefined,
  city: CityId,
): number => cityOf(city).feeIndex * marketOf(markets, city).fees;

export const effectiveCost = (
  markets: Record<string, CityMarket> | undefined,
  city: CityId,
): number => cityOf(city).costIndex * marketOf(markets, city).salary;

export const effectiveProperty = (
  markets: Record<string, CityMarket> | undefined,
  city: CityId,
): number => cityOf(city).propertyIndex * marketOf(markets, city).rent;

/** A one-line description of what this market is currently doing. */
export function marketMood(m: CityMarket): {
  word: string;
  tone: "good" | "bad" | "neutral";
  detail: string;
} {
  if (m.shock) {
    return {
      word: SHOCK_LABEL[m.shock],
      tone:
        m.shock === "boom" || m.shock === "property-crash" ? "good" : "bad",
      detail: SHOCK_BLURB[m.shock],
    };
  }
  if (m.demand >= 1.08) {
    return {
      word: "Growing",
      tone: "good",
      detail: "More work arriving than usual, and it is holding.",
    };
  }
  if (m.demand <= 0.93) {
    return {
      word: "Soft",
      tone: "bad",
      detail: "Fewer people coming through the door than this market normally sends.",
    };
  }
  return { word: "Steady", tone: "neutral", detail: "Nothing much is moving either way." };
}

/**
 * The two or three things about this city a player actually needs to know
 * before deciding anything. Deliberately capped: the city panel is already
 * dense, and a list of six percentages is a spreadsheet, not a briefing.
 */
export function marketHeadlines(
  m: CityMarket,
): { label: string; value: string; tone: "good" | "bad" | "neutral" }[] {
  const out: { label: string; value: string; tone: "good" | "bad" | "neutral" }[] =
    [];
  const pct = (n: number) => `${n > 1 ? "+" : ""}${Math.round((n - 1) * 100)}%`;

  const candidates: [number, string, string, boolean][] = [
    [Math.abs(m.demand - 1), "Demand", pct(m.demand), m.demand > 1],
    [Math.abs(m.fees - 1), "Fees", pct(m.fees), m.fees > 1],
    [Math.abs(m.salary - 1), "Wages", pct(m.salary), m.salary < 1],
    [Math.abs(m.rent - 1), "Premises", pct(m.rent), m.rent < 1],
    [Math.abs(m.talent - 1), "Talent", pct(m.talent), m.talent > 1],
  ];

  // Only what has actually moved, biggest first, at most three.
  for (const [, label, value, good] of candidates
    .filter(([size]) => size >= 0.04)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 3)) {
    out.push({ label, value, tone: good ? "good" : "bad" });
  }

  if (m.regulation >= 35) {
    out.push({
      label: "Regulation",
      value: m.regulation >= 55 ? "Heavy" : "Rising",
      tone: "bad",
    });
  }
  return out;
}
