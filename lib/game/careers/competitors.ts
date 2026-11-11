import type { Rng } from "../types";
import { cityOf, type KitchenState } from "./kitchen";
import { SEGMENTS, seasonOf } from "./diners";
import { standingOf, type StandingId } from "./standing";

/**
 * THE OTHER RESTAURANTS ON THE STREET
 *
 * Three of them, in your city, and no more. That is a deliberate ceiling: a
 * simulation of two hundred invisible kitchens produces a number the player
 * cannot argue with, and three named rivals produce a decision — *they have
 * gone cheap, do I follow them down or go the other way*.
 *
 * ------------------------------------------------------------- what they do
 *
 * A rival is not a difficulty modifier with a name on it. Each one has a
 * strength, a weakness, a price level and a list of the segments it is built
 * for, and the pressure it puts on you is computed *per segment*: a cheap
 * neighbourhood place takes budget diners and families off you and cannot
 * touch your luxury table, and the tasting counter across the square does
 * precisely the reverse.
 *
 * So the counter-play is real. You are never told to "raise reputation"; you
 * are told that the bistro has cut its prices and is taking your families,
 * and you can decide whether those were the covers you wanted.
 *
 * -------------------------------------------------------------- the strategies
 *
 * A rival changes strategy in response to the *state of the city*, including
 * you. Beating them on food makes them compete on price; a signature dish of
 * yours gets copied; a brigade with collapsing morale gets raided. Every
 * change is announced on the phone in the week it happens, because a rival
 * whose moves are invisible is just noise in a formula.
 */

export type PriceLevel = "cheap" | "mid" | "high" | "luxury";

export const PRICE_LABEL: Record<PriceLevel, string> = {
  cheap: "Cheap",
  mid: "Mid-market",
  high: "Expensive",
  luxury: "No prices on the menu",
};

/** Where a rival sits against the room's ordinary spend. */
export const PRICE_STAND: Record<PriceLevel, number> = {
  cheap: 0.68,
  mid: 1,
  high: 1.35,
  luxury: 2,
};

export type StrategyId =
  | "steady"
  | "undercut"
  | "copy"
  | "poach"
  | "festival"
  | "collaborate"
  | "expand";

export interface StrategyDef {
  id: StrategyId;
  label: string;
  /** What they are doing, in the player's words. */
  note: string;
  /** Extra pull on the segments they target, as a share. */
  pull: number;
}

export const STRATEGIES: StrategyDef[] = [
  {
    id: "steady",
    label: "Doing what they do",
    note: "No change. They are running the same restaurant they ran last month.",
    pull: 0,
  },
  {
    id: "undercut",
    label: "Competing on price",
    note: "Prices cut across the menu. The people who count the bill have noticed.",
    pull: 0.14,
  },
  {
    id: "copy",
    label: "Copying you",
    note: "Something very like your signature has appeared on their menu.",
    pull: 0.1,
  },
  {
    id: "poach",
    label: "Hiring",
    note: "They are recruiting, and they are looking at your line.",
    pull: 0.04,
  },
  {
    id: "festival",
    label: "At the city festival",
    note: "A stall at the festival, and a queue at it. Everyone will have tried them by Sunday.",
    pull: 0.12,
  },
  {
    id: "collaborate",
    label: "Looking for a collaboration",
    note: "They have suggested doing something together. It would put you in front of their room.",
    pull: -0.04,
  },
  {
    id: "expand",
    label: "Opening a second room",
    note: "A second site. Their attention is elsewhere, and their standards usually follow it.",
    pull: -0.06,
  },
];

export const STRATEGY_BY_ID = new Map(STRATEGIES.map((x) => [x.id, x]));

export interface Competitor {
  id: string;
  name: string;
  /** What kind of restaurant it is. */
  concept: string;
  cuisine: string;
  price: PriceLevel;
  /** The category they are genuinely good at. */
  strength: StandingId;
  /** The one they are not. Your opening. */
  weakness: StandingId;
  /** 0–100, moves week to week. */
  reputation: number;
  /** Segment ids they are built for. */
  targets: string[];
  strategy: StrategyId;
  /** Week the current strategy started, so the screen can say "since". */
  since: number;
}

/* ------------------------------------------------------------ the roster */

/**
 * Three archetypes, filled with a city's own names.
 *
 * The archetypes are fixed because they are the three shapes a rival can take
 * that a player can act against — somebody cheaper, somebody better, and
 * somebody more fashionable. The names and cuisines come from the city, so
 * Mumbai's cheap room and Milan's are not the same restaurant with a different
 * label.
 */
interface Archetype {
  key: string;
  concept: string;
  price: PriceLevel;
  strength: StandingId;
  weakness: StandingId;
  targets: string[];
  reputation: number;
}

const ARCHETYPES: Archetype[] = [
  {
    key: "value",
    concept: "Neighbourhood room, full every night, nothing on the menu over what people expect to pay",
    price: "cheap",
    strength: "value",
    weakness: "innovation",
    targets: ["budget", "families", "regulars"],
    reputation: 44,
  },
  {
    key: "craft",
    concept: "Serious cooking in a plain room. The chef trained somewhere you have heard of",
    price: "high",
    strength: "food",
    weakness: "atmosphere",
    targets: ["enthusiasts", "regulars", "business"],
    reputation: 58,
  },
  {
    key: "scene",
    concept: "The room everyone is photographing this year. The food is beside the point and it is still good",
    price: "luxury",
    strength: "atmosphere",
    weakness: "consistency",
    targets: ["tourists", "luxury", "business"],
    reputation: 52,
  },
];

const CITY_RIVALS: Record<
  string,
  { name: string; cuisine: string }[]
> = {
  lyon: [
    { name: "Bouchon Perrache", cuisine: "Lyonnais" },
    { name: "La Table de Fourvière", cuisine: "Modern French" },
    { name: "Comptoir Confluence", cuisine: "Small plates" },
  ],
  milan: [
    { name: "Trattoria Navigli", cuisine: "Lombard" },
    { name: "Osteria del Duomo", cuisine: "Northern Italian" },
    { name: "Bar Sempione", cuisine: "Aperitivo and plates" },
  ],
  madrid: [
    { name: "Casa Lavapiés", cuisine: "Castilian" },
    { name: "Mesón Chamberí", cuisine: "Market cooking" },
    { name: "Azotea Gran Vía", cuisine: "Rooftop tapas" },
  ],
  paris: [
    { name: "Le Bistrot Daguerre", cuisine: "Bistrot classique" },
    { name: "Maison Verlaine", cuisine: "Haute cuisine" },
    { name: "Atelier Oberkampf", cuisine: "Neo-bistrot" },
  ],
  london: [
    { name: "The Rye & Anchor", cuisine: "British pub kitchen" },
    { name: "Fitzrovia Larder", cuisine: "Modern British" },
    { name: "Sable, Soho", cuisine: "Seasonal counter" },
  ],
  newyork: [
    { name: "Delancey Counter", cuisine: "Deli and grill" },
    { name: "Cormorant", cuisine: "New American" },
    { name: "The Vestry Room", cuisine: "Chef's table" },
  ],
  mumbai: [
    { name: "Colaba Canteen", cuisine: "Irani café" },
    { name: "Bandra Fire", cuisine: "Coastal grill" },
    { name: "The Kala Ghoda Room", cuisine: "Contemporary Indian" },
  ],
};

/**
 * The three rivals a city starts with.
 *
 * Deterministic from the city alone — no RNG — so two runs that begin in
 * Paris begin against the same three restaurants, and a test can name them.
 */
export function rivalsFor(cityId: string, week: number): Competitor[] {
  const names = CITY_RIVALS[cityId] ?? CITY_RIVALS.lyon;
  return ARCHETYPES.map((arch, i) => ({
    id: `${cityId}-${arch.key}`,
    name: names[i]?.name ?? `Rival ${i + 1}`,
    concept: arch.concept,
    cuisine: names[i]?.cuisine ?? "Local",
    price: arch.price,
    strength: arch.strength,
    weakness: arch.weakness,
    reputation: arch.reputation,
    targets: arch.targets,
    strategy: "steady" as StrategyId,
    since: week,
  }));
}

/** The rivals this kitchen faces, created on first touch. */
export function ensureRivals(k: KitchenState, week: number): Competitor[] {
  if (!k.rivals || k.rivals.length === 0) {
    k.rivals = rivalsFor(cityOf(k).id, week);
  }
  return k.rivals;
}

/* ----------------------------------------------------------- the pressure */

/**
 * What the rivals are taking off you, per segment.
 *
 * A rival pulls a segment away in proportion to how much better they are at
 * what that segment came for. Being *equal* to a rival costs you nothing —
 * you split the room — and being better than them takes covers back.
 *
 * Bounded per segment at 0.45. A single rival can hurt; three of them cannot
 * close you, because being unable to trade at all is not a decision, it is a
 * dead run.
 */
export function competitorPressure(
  k: KitchenState,
  overall: number,
): Record<string, number> {
  const rivals = k.rivals ?? [];
  const scores = standingOf(k, overall);
  const out: Record<string, number> = {};
  if (rivals.length === 0) return out;

  for (const seg of SEGMENTS) {
    let pressure = 0;
    for (const rival of rivals) {
      if (!rival.targets.includes(seg.id)) continue;
      const strategy = STRATEGY_BY_ID.get(rival.strategy);
      /* On the thing this segment actually cares about most. */
      const mine = scores[rival.strength] ?? 50;
      const theirs = rival.reputation;
      const care = seg.wants[rival.strength] ?? 0.1;
      const edge = ((theirs - mine) / 100) * care * 1.6;
      pressure += Math.max(0, edge) + (strategy?.pull ?? 0) * care * 2;
      /* A rival competing on price takes the price-sensitive whatever their
         reputation is — that is what a price war does. */
      if (rival.strategy === "undercut") {
        pressure += seg.priceSensitivity * 0.1;
      }
    }
    if (pressure > 0) out[seg.id] = Math.min(0.45, pressure);
  }
  return out;
}

/** How you rank in your own city, counting yourself. */
export function cityRank(
  k: KitchenState,
  yours: number,
): { rank: number; of: number; above: string | null } {
  const rivals = k.rivals ?? [];
  const better = rivals.filter((r) => r.reputation > yours);
  const sorted = better.slice().sort((a, b) => a.reputation - b.reputation);
  return {
    rank: better.length + 1,
    of: rivals.length + 1,
    above: sorted[0]?.name ?? null,
  };
}

/* -------------------------------------------------------------- the week */

export interface RivalMove {
  rival: string;
  strategy: StrategyId;
  /** What happened, for the log and the phone. */
  note: string;
  /** True when this is worth a message rather than a line. */
  loud: boolean;
}

/**
 * What the rivals did this week.
 *
 * Reactive rather than random: each rival looks at the city and at you, and
 * the strategy it picks is a response to something the player can see. A
 * strategy holds for at least four weeks, so the scene screen reads as three
 * restaurants with intentions rather than a slot machine.
 */
export function moveRivals(
  k: KitchenState,
  overall: number,
  week: number,
  yourSignature: string | null,
  weakestMorale: number | null,
  rng: Rng,
): RivalMove[] {
  const rivals = ensureRivals(k, week);
  const scores = standingOf(k, overall);
  const season = seasonOf(week);
  const moves: RivalMove[] = [];

  for (const rival of rivals) {
    /*
     * Their own standing drifts toward what they are: a rival built on food
     * gets better at food while nothing disturbs them, and every one of them
     * loses a little ground to a restaurant that is beating them at their own
     * game. This is the only part of a rival that moves on its own, and it is
     * bounded and slow.
     */
    const mine = scores[rival.strength] ?? 50;
    const drift = mine > rival.reputation + 12 ? -0.7 : rival.reputation < 70 ? 0.25 : 0;
    rival.reputation = Math.max(20, Math.min(92, rival.reputation + drift));

    /* A strategy is a commitment. Four weeks minimum. */
    if (week - rival.since < 4) continue;

    const next = decideStrategy(rival, scores, overall, season.id, yourSignature, weakestMorale, rng);
    if (next === rival.strategy) continue;

    rival.strategy = next;
    rival.since = week;
    const def = STRATEGY_BY_ID.get(next);
    moves.push({
      rival: rival.name,
      strategy: next,
      note: `${rival.name}: ${def?.note ?? ""}`,
      loud: next === "copy" || next === "poach" || next === "collaborate",
    });
  }

  return moves;
}

function decideStrategy(
  rival: Competitor,
  scores: Record<StandingId, number>,
  overall: number,
  season: string,
  yourSignature: string | null,
  weakestMorale: number | null,
  rng: Rng,
): StrategyId {
  /* Somebody with a dish the city is talking about gets copied. */
  if (
    yourSignature &&
    rival.strategy !== "copy" &&
    scores.innovation > rival.reputation &&
    rng.chance(0.4)
  ) {
    return "copy";
  }
  /* An unhappy brigade is a recruitment opportunity, and they know it. */
  if (
    weakestMorale !== null &&
    weakestMorale < 38 &&
    rival.reputation >= 45 &&
    rng.chance(0.45)
  ) {
    return "poach";
  }
  /* Being beaten on their own strength sends them to the one lever anybody
     can pull in a week. */
  if (scores[rival.strength] > rival.reputation + 8 && rng.chance(0.5)) {
    return "undercut";
  }
  /* Autumn is festival season everywhere, and everybody who can afford a
     stall takes one. */
  if (season === "autumn" && rival.reputation >= 48 && rng.chance(0.35)) {
    return "festival";
  }
  /* A restaurant doing well and not threatened looks outward. */
  if (rival.reputation >= 70 && overall < rival.reputation - 10 && rng.chance(0.25)) {
    return "expand";
  }
  /* And occasionally somebody just wants to cook with you. */
  if (overall >= 45 && rng.chance(0.12)) return "collaborate";

  return "steady";
}

/**
 * The opening a rival leaves you.
 *
 * Every rival has a weakness, and the useful thing to tell a player is not
 * "they are strong" but "here is what they are bad at and you are not".
 */
export function openingAgainst(
  rival: Competitor,
  k: KitchenState,
  overall: number,
): string {
  const scores = standingOf(k, overall);
  const yours = scores[rival.weakness] ?? 50;
  const label = WEAKNESS_WORD[rival.weakness];
  return yours > rival.reputation - 8
    ? `You are already better than them on ${label}. Say so, loudly, and to the people who care about it.`
    : `Their weakness is ${label} — and it is not currently yours either. Fix that and you take their room.`;
}

const WEAKNESS_WORD: Record<StandingId, string> = {
  food: "the cooking itself",
  service: "getting food to a table",
  value: "what it costs to eat there",
  atmosphere: "the room",
  consistency: "being the same twice",
  hygiene: "how clean the kitchen is",
  innovation: "having a reason to exist",
};
