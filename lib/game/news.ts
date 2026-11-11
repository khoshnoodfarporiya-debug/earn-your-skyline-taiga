import type { Rng, RunState } from "./types";

/**
 * WORLD NEWS
 *
 * The phone already had a news app, and everything in it was decoration: a
 * headline about a regulator tightening standards changed nothing about
 * standards.
 *
 * This is the other kind. Every item here carries an `effect` that the career
 * applies when it lands, and the headline is a description of that effect
 * rather than an illustration of it. If a story says fees are being squeezed
 * in London, the London fee multiplier moves.
 *
 * ------------------------------------------------- four channels, kept apart
 *
 * The brief asks for these to be distinguishable, and they are — by *who knows
 * it*, which is the only distinction that matters to a player:
 *
 *   news      public, everyone knows, affects markets      (this module)
 *   posts     public, you said it, affects your standing   (posts.ts)
 *   feed      public, they said it, affects nothing        (bots.ts)
 *   messages  private, addressed to you, needs an answer   (phone.ts)
 *
 * Which is why a rival's expansion is news, a rival's opinion is feed, and a
 * rival's offer is a message.
 */

export type NewsScope = "world" | "city" | "rival" | "you";

export interface NewsEffect {
  /** City this applies to, or absent for everywhere you operate. */
  city?: string;
  /** Multiplicative nudges to that city's market. */
  demand?: number;
  fees?: number;
  salary?: number;
  rent?: number;
  regulation?: number;
  sentiment?: number;
  /** Reputation categories moved directly. */
  rep?: Partial<Record<string, number>>;
  /** Contract offers made likelier for this many weeks. */
  contractBoost?: number;
}

export interface NewsItem {
  id: string;
  week: number;
  scope: NewsScope;
  outlet: string;
  headline: string;
  body: string;
  tone: "good" | "bad" | "neutral";
  /** What it did, in the player's words. Empty for colour-only items. */
  impact: string;
  effect?: NewsEffect;
}

/** Bounded, like everything else that accumulates over 156 weeks. */
export const MAX_WORLD_NEWS = 30;

const OUTLETS = [
  "The Clinical Register",
  "Health Service Weekly",
  "Metro Evening",
  "The Lancet Brief",
  "Regional Business Daily",
];

/**
 * The stories the world can tell about itself.
 *
 * Authored, weighted, and each one gated so it can only appear when it would
 * make sense — a story about wage competition needs a city with a wage
 * problem, not a random draw.
 */
export function worldNews(
  s: RunState,
  rng: Rng,
  ctx: { cities: string[]; cityName: (id: string) => string; markets: Record<string, { salary: number; demand: number; regulation: number; sentiment: number; shock: string | null }> },
): NewsItem | null {
  if (ctx.cities.length === 0) return null;
  const city = rng.pick(ctx.cities);
  const m = ctx.markets[city];
  if (!m) return null;
  const name = ctx.cityName(city);

  /* Shocks announce themselves. This is the main way a player finds out a
     market has turned, so it is checked before the ambient pool. */
  if (m.shock && rng.chance(0.55)) {
    return shockStory(s, city, name, m.shock, rng);
  }

  const pool: (() => NewsItem)[] = [];

  if (m.salary >= 1.08) {
    pool.push(() => ({
      id: `news.wages.${city}.${s.week}`,
      week: s.week,
      scope: "city",
      outlet: OUTLETS[4],
      headline: `Clinician pay climbs again in ${name}`,
      body: "Three large providers have raised consultant packages in a fortnight. Smaller practices are already losing people they cannot match.",
      tone: "bad",
      impact: "Wages here will keep rising, and recruits are harder to hold.",
      effect: { city, salary: 1.02, sentiment: -1 },
    }));
  }

  if (m.regulation >= 40) {
    pool.push(() => ({
      id: `news.reg.${city}.${s.week}`,
      week: s.week,
      scope: "city",
      outlet: OUTLETS[1],
      headline: `New documentation standards take effect in ${name}`,
      body: "Providers have ninety days to comply. Practices with thin administrative cover are expected to feel it first.",
      tone: "bad",
      impact: "Administrative load in this city rises.",
      effect: { city, regulation: 1.06, fees: 0.99 },
    }));
  }

  if (m.demand <= 0.95) {
    pool.push(() => ({
      id: `news.demand.${city}.${s.week}`,
      week: s.week,
      scope: "city",
      outlet: OUTLETS[4],
      headline: `Households in ${name} are deferring private care`,
      body: "Providers report cancellations running well above the seasonal norm as budgets tighten.",
      tone: "bad",
      impact: "Fewer cases will arrive here for a while.",
      effect: { city, demand: 0.985 },
    }));
  }

  pool.push(() => ({
    id: `news.tech.${s.week}`,
    week: s.week,
    scope: "world",
    outlet: OUTLETS[3],
    headline: "Point-of-care diagnostics move faster than guidelines",
    body: "A generation of bedside tests is arriving before anybody has agreed how to use them. Early adopters are being watched closely.",
    tone: "neutral",
    impact: "Specialist work is easier to come by for the next few weeks.",
    effect: { contractBoost: 6 },
  }));

  pool.push(() => ({
    id: `news.publichealth.${s.week}`,
    week: s.week,
    scope: "world",
    outlet: OUTLETS[1],
    headline: "Health boards told to buy capacity from private providers",
    body: "A funding settlement has left regional boards contracting out work they would previously have kept.",
    tone: "good",
    impact: "Public-health and institutional contracts are more likely.",
    effect: { contractBoost: 8 },
  }));

  if (m.sentiment <= 42) {
    pool.push(() => ({
      id: `news.mood.${city}.${s.week}`,
      week: s.week,
      scope: "city",
      outlet: OUTLETS[2],
      headline: `"Two-tier medicine": ${name} debates private practice`,
      body: "A local campaign has put private providers on the front page, and not kindly.",
      tone: "bad",
      impact: "Public trust in private practice here is falling.",
      effect: { city, sentiment: -2.5, rep: { popularity: -1.5 } },
    }));
  }

  if (pool.length === 0) return null;
  return rng.pick(pool)();
}

function shockStory(
  s: RunState,
  city: string,
  name: string,
  shock: string,
  rng: Rng,
): NewsItem {
  const table: Record<string, [string, string, "good" | "bad", string]> = {
    boom: [
      `${name} is hiring`,
      "Employment and incomes are both up, and private healthcare demand has followed.",
      "good",
      "More work here while it lasts, and everything costs more to chase.",
    ],
    recession: [
      `${name} slips into a downturn`,
      "Two quarters of contraction. Discretionary spending is the first thing to go, and elective medicine is discretionary.",
      "bad",
      "Fewer cases and softer fees here.",
    ],
    "wage-spiral": [
      `Bidding war for clinicians in ${name}`,
      "Packages have moved twice this quarter. Nobody expects them to come back down.",
      "bad",
      "Wages here are rising sharply.",
    ],
    "property-crash": [
      `Commercial property collapses in ${name}`,
      "A wave of closures has left more clinical space empty than anyone can remember.",
      "good",
      "Premises here are unusually cheap.",
    ],
    "regulatory-crackdown": [
      `${name} regulator announces enhanced oversight`,
      "Unannounced inspections, tighter reporting, and a published register of findings.",
      "bad",
      "Regulation here is climbing and inspections are more likely.",
    ],
    "public-backlash": [
      `Scandal at a ${name} clinic reaches the national press`,
      "Somebody else's failure, and the whole sector is wearing it.",
      "bad",
      "Public trust in private medicine here has dropped.",
    ],
  };
  const [headline, body, tone, impact] = table[shock] ?? [
    `Conditions change in ${name}`,
    "The market here has moved.",
    "neutral" as const,
    "Watch this city.",
  ];
  return {
    id: `news.shock.${city}.${shock}.${s.week}`,
    week: s.week,
    scope: "city",
    outlet: rng.pick(OUTLETS),
    headline,
    body,
    tone: tone as "good" | "bad",
    impact,
    effect: { city },
  };
}

/** A rival's move, written as the profession would hear about it. */
export function rivalNews(
  s: RunState,
  name: string,
  move: { text: string; kind: string },
  rng: Rng,
): NewsItem {
  return {
    id: `news.rival.${name}.${s.week}`,
    week: s.week,
    scope: "rival",
    outlet: rng.pick(OUTLETS),
    headline: `${name} ${move.text}`,
    body:
      move.kind === "setback"
        ? "Not everything works. The profession is small and everybody heard."
        : "Worth knowing where the competition is putting its money.",
    tone: move.kind === "setback" ? "good" : "neutral",
    impact: "",
  };
}

/** Something the player did, reported back at them. */
export function playerNews(
  s: RunState,
  headline: string,
  body: string,
  tone: "good" | "bad",
): NewsItem {
  return {
    id: `news.you.${s.week}.${headline.slice(0, 12)}`,
    week: s.week,
    scope: "you",
    outlet: "The Clinical Register",
    headline,
    body,
    tone,
    impact: "",
  };
}

export const recentNews = (s: RunState, weeks = 8): NewsItem[] =>
  (s.news ?? []).filter((n) => n.week > s.week - weeks);
