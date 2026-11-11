import {
  activeMenu,
  cityOf,
  premisesOf,
  progressFor,
  spendPerHead,
  type KitchenState,
} from "./kitchen";
import { RECIPE_BY_ID, recipeName } from "./recipes";
import { STANDINGS, standingOf, type StandingId } from "./standing";

/**
 * WHO IS ACTUALLY IN THE ROOM
 *
 * A cover was a cover: every one of them wanted the same thing, paid the same
 * money and judged the night by the same rule. That is why pricing had one
 * correct answer and why a bistro in Mumbai and a bistro in Paris played
 * identically once you adjusted for rent.
 *
 * The room is now eight kinds of people, and the thing that makes them
 * different is *which of the seven standing categories they weigh*. A budget
 * diner is not a luxury diner with less money — they are somebody who does not
 * care about the atmosphere and cares enormously about the bill, and a kitchen
 * built to please one of them is visibly not built to please the other.
 *
 * ------------------------------------------------------------- what it does
 *
 * Three things, all of them mechanical:
 *
 *   1. The mix decides *how many people want a table* — each segment's share
 *      of the city, multiplied by how much this restaurant appeals to them.
 *   2. The mix decides *what they will pay* — a room of tourists and luxury
 *      diners spends more per head than a room of families, on the same menu.
 *   3. The mix decides *who reviews you and on what* — a review is written by
 *      a segment, and it complains about the thing that segment cares about.
 *
 * ------------------------------------------------------------ city and season
 *
 * The mix is per city and per season, so the same strategy genuinely does not
 * transfer. Madrid is full of budget diners and families; New York is business
 * and luxury; Mumbai is price-sensitive at a scale nowhere else is. Summer
 * fills the tourist share everywhere and empties the business one.
 */

/* ------------------------------------------------------------- the seasons */

export type SeasonId = "spring" | "summer" | "autumn" | "winter";

export interface Season {
  id: SeasonId;
  label: string;
  /** What it means for a restaurant, in one line. */
  note: string;
}

export const SEASONS: Season[] = [
  {
    id: "spring",
    label: "Spring",
    note: "Produce improves week by week and the city starts eating out again.",
  },
  {
    id: "summer",
    label: "Summer",
    note: "Tourists everywhere, regulars away, and everything in the larder dies faster.",
  },
  {
    id: "autumn",
    label: "Autumn",
    note: "The best cooking season: game, mushrooms, and a city back at work.",
  },
  {
    id: "winter",
    label: "Winter",
    note: "Parties and private bookings carry it. Nobody walks past in the rain.",
  },
];

export const SEASON_BY_ID = new Map(SEASONS.map((x) => [x.id, x]));

/**
 * Which season a week falls in.
 *
 * Week 1 is early spring, and the year is the same 52 weeks `inSeason` in
 * `recipes.ts` already divides ingredients by — so a run's calendar means one
 * thing rather than two.
 */
export function seasonOf(week: number): Season {
  const w = ((Math.max(1, Math.round(week)) - 1) % 52) + 1;
  if (w <= 13) return SEASONS[0];
  if (w <= 26) return SEASONS[1];
  if (w <= 39) return SEASONS[2];
  return SEASONS[3];
}

/* ------------------------------------------------------------- the segments */

export interface DinerSegment {
  id: string;
  label: string;
  /** Who they are, in one line. */
  blurb: string;
  /**
   * What they judge you on. Keys are the standing categories, values sum to
   * roughly 1 — so `appealOf` is directly comparable between segments.
   */
  wants: Partial<Record<StandingId, number>>;
  /**
   * How much of the room's ordinary spend they part with. A luxury diner
   * genuinely pays more for the same plate; a budget diner genuinely does not.
   */
  spend: number;
  /**
   * How hard they push back on a menu priced above the city's expectation.
   * 0 means they never look at the price, 1 means they only look at it.
   */
  priceSensitivity: number;
  /** How long they will wait before giving up, as a share of normal patience. */
  patience: number;
  /** Base share of a neutral city's covers, before bias. Sums to 1. */
  base: number;
  /** Per-city multipliers on that share. Absent means 1. */
  cityBias?: Record<string, number>;
  /** Per-season multipliers. Absent means 1. */
  seasonBias?: Partial<Record<SeasonId, number>>;
  /** Only shows up for these services, when set. */
  services?: string[];
}

export const SEGMENTS: DinerSegment[] = [
  {
    id: "budget",
    label: "Budget diners",
    blurb: "Eating out because it is Tuesday. The bill is the whole decision.",
    wants: { value: 0.55, food: 0.2, service: 0.15, consistency: 0.1 },
    spend: 0.72,
    priceSensitivity: 0.95,
    patience: 0.85,
    base: 0.19,
    cityBias: { mumbai: 2.1, madrid: 1.5, paris: 0.55, newyork: 0.6 },
    seasonBias: { winter: 1.1 },
  },
  {
    id: "regulars",
    label: "Local regulars",
    blurb:
      "The same table, most weeks. They forgive one bad night and never a second.",
    wants: { consistency: 0.34, value: 0.2, food: 0.2, service: 0.16, atmosphere: 0.1 },
    spend: 0.95,
    priceSensitivity: 0.55,
    patience: 1.25,
    base: 0.21,
    cityBias: { lyon: 1.45, madrid: 1.2, newyork: 0.7, london: 0.85 },
    seasonBias: { summer: 0.72, autumn: 1.15 },
  },
  {
    id: "business",
    label: "Business customers",
    blurb:
      "Lunch with a client and a train at three. Nobody is looking at the menu.",
    wants: { service: 0.36, atmosphere: 0.22, food: 0.22, consistency: 0.2 },
    spend: 1.3,
    priceSensitivity: 0.12,
    patience: 0.7,
    base: 0.13,
    cityBias: { newyork: 1.8, london: 1.7, milan: 1.4, mumbai: 0.7, madrid: 0.7 },
    seasonBias: { summer: 0.6, winter: 1.15 },
    services: ["lunch", "dinner", "event", "catering"],
  },
  {
    id: "tourists",
    label: "Tourists",
    blurb:
      "One night in the city and a list of places somebody recommended. They will never be back.",
    wants: { atmosphere: 0.34, innovation: 0.24, food: 0.24, service: 0.18 },
    spend: 1.1,
    priceSensitivity: 0.25,
    patience: 1.1,
    base: 0.13,
    cityBias: { paris: 1.9, london: 1.5, newyork: 1.4, lyon: 1.1, mumbai: 0.65 },
    seasonBias: { summer: 1.85, spring: 1.2, winter: 0.55 },
  },
  {
    id: "families",
    label: "Families",
    blurb:
      "Four of them, one of whom will not eat anything green. Early, and out by eight.",
    wants: { value: 0.34, service: 0.24, consistency: 0.2, hygiene: 0.14, food: 0.08 },
    spend: 0.85,
    priceSensitivity: 0.8,
    patience: 0.6,
    base: 0.14,
    cityBias: { madrid: 1.4, mumbai: 1.35, lyon: 1.1, newyork: 0.7, paris: 0.7 },
    seasonBias: { summer: 1.25, winter: 0.85 },
    services: ["lunch", "dinner", "event"],
  },
  {
    id: "enthusiasts",
    label: "Food enthusiasts",
    blurb:
      "They have read about you. They will know if the stock was made this morning.",
    wants: { food: 0.42, innovation: 0.3, consistency: 0.16, service: 0.12 },
    spend: 1.25,
    priceSensitivity: 0.2,
    patience: 1.4,
    base: 0.1,
    cityBias: { paris: 1.5, milan: 1.45, lyon: 1.4, newyork: 1.3, mumbai: 0.8 },
    seasonBias: { autumn: 1.25 },
  },
  {
    id: "luxury",
    label: "Luxury diners",
    blurb:
      "The bill is not the point. Being made to feel that the evening was arranged for them is.",
    wants: { food: 0.3, atmosphere: 0.28, service: 0.26, innovation: 0.16 },
    spend: 1.95,
    priceSensitivity: 0.04,
    patience: 1.15,
    base: 0.06,
    cityBias: { paris: 2.1, newyork: 1.9, london: 1.6, milan: 1.5, mumbai: 0.4, madrid: 0.5 },
    seasonBias: { winter: 1.3, summer: 0.85 },
  },
  {
    id: "event",
    label: "Event clients",
    blurb:
      "A room, a date and a number of covers. What they are buying is that nothing goes wrong.",
    wants: { service: 0.34, consistency: 0.26, food: 0.22, hygiene: 0.18 },
    spend: 1.4,
    priceSensitivity: 0.3,
    patience: 1.5,
    base: 0.04,
    cityBias: { london: 1.4, newyork: 1.3, paris: 1.2 },
    seasonBias: { winter: 1.8, autumn: 1.2, summer: 0.7 },
    services: ["event", "catering"],
  },
];

export const SEGMENT_BY_ID = new Map(SEGMENTS.map((x) => [x.id, x]));

/* ---------------------------------------------------------------- appeal */

/**
 * How much this restaurant appeals to one segment, 0–100.
 *
 * Their weights against your seven scores, then the price question on top.
 * The price term is the only part that is not standing: a kitchen can be
 * excellent and still be wrong for somebody, which is the entire point of
 * having segments at all.
 */
export function appealOf(
  segment: DinerSegment,
  k: KitchenState,
  overall: number,
): number {
  const scores = standingOf(k, overall);
  let sum = 0;
  let weight = 0;
  for (const def of STANDINGS) {
    const w = segment.wants[def.id];
    if (!w) continue;
    sum += scores[def.id] * w;
    weight += w;
  }
  const base = weight > 0 ? sum / weight : overall;

  /*
   * What you charge, against what they expect to pay.
   *
   * `priceStand` is 1 when the menu sits exactly on the room's ordinary
   * spend. Above that a price-sensitive segment falls away fast and a luxury
   * one barely notices; below it, everybody is a little more interested and
   * the price-sensitive are a lot more.
   */
  const gap = priceStand(k) - 1;
  const priceMove = -gap * segment.priceSensitivity * 42;
  return Math.max(0, Math.min(100, base + priceMove));
}

/**
 * Where the menu sits against what this room ordinarily charges.
 *
 * 1 means the average dish is priced at the room's own spend per head. A
 * kitchen with no menu returns exactly 1 — it charges the room's spend by
 * definition, which is the arithmetic this career had before menus existed.
 */
export function priceStand(k: KitchenState): number {
  const menu = activeMenu(k);
  if (menu.length === 0) return 1;
  const expected = spendPerHead(k);
  if (expected <= 0) return 1;
  const average =
    menu.reduce((sum, entry) => sum + entry.price, 0) / menu.length;
  return average / expected;
}

/* ------------------------------------------------------------------ mix */

export interface SegmentShare {
  segment: DinerSegment;
  /** Share of everybody who wants a table here, 0-1. */
  share: number;
  /** How much this restaurant appeals to them, 0-100. */
  appeal: number;
}

/**
 * Who wants a table, and what that does to the week.
 *
 * ----------------------------------------------------- the neutral baseline
 *
 * Every figure here is expressed **against the ordinary restaurant in this
 * city and this season**, and that is not a stylistic choice — it is the only
 * way this layer can exist without double-counting the city.
 *
 * `city.spend` already says that Mumbai eats cheaply and Paris does not.
 * `city.demand` already says that Mumbai is hungrier. If the segment mix then
 * *also* reported a low spend for Mumbai — because Mumbai's mix is mostly
 * budget diners and families, which it is — the city's poverty would be
 * charged twice and a perfectly well-run kitchen there would be insolvent for
 * most of the run. It was, when this was first written, for 91 weeks in 120.
 *
 * So the baseline is the same mix with every appeal term removed: the crowd
 * this city would send to any competent restaurant. What these numbers report
 * is the *difference your restaurant makes* — whether you are pulling a
 * richer or poorer room than the street average, and whether more or fewer
 * people are choosing you over the alternatives.
 */
export interface DinerMix {
  /** Who is in the room, most numerous first. Shares sum to 1. */
  shares: SegmentShare[];
  /** Covers wanting a table, against a neutral restaurant here. */
  demand: number;
  /** Spend per head, against what this city's ordinary crowd spends. */
  spend: number;
  /** How patient tonight's room is, against the service's own patience. */
  patience: number;
}

export function dinerMix(
  k: KitchenState,
  overall: number,
  week: number,
  service?: string,
  competition?: Record<string, number>,
): DinerMix {
  const city = cityOf(k);
  const season = seasonOf(week);

  const rows = SEGMENTS.filter(
    (seg) => !service || !seg.services || seg.services.includes(service),
  ).map((seg) => {
    const appeal = appealOf(seg, k, overall);
    const bias = (seg.cityBias?.[city.id] ?? 1) * (seg.seasonBias?.[season.id] ?? 1);
    /*
     * Pull is *relative to your own standing*, and that is the second place
     * this file refuses to charge for the same thing twice.
     *
     * The forecast already prices general attractiveness: `pull = 0.46 +
     * reputation / 74` has been the first term in the demand calculation
     * since this career shipped. If a segment's pull were computed from its
     * appeal *absolutely*, a well-run kitchen would be charged for its
     * reputation once in the forecast and again here — which cost the control
     * bot about a fifth of its covers and made Mumbai insolvent for 53 weeks
     * in 120.
     *
     * So what this measures is the difference between how a segment sees you
     * and how the city in general does. A restaurant whose seven categories
     * all agree with its reputation pulls exactly 1 from everybody, and the
     * mix is the city's own. A restaurant that is unusually good on value
     * pulls more budget diners and fewer enthusiasts — the *composition*
     * changes, which is the mechanic, and the total barely moves.
     */
    const relative = appeal - Math.max(0, Math.min(100, overall));
    const pull = Math.max(0.5, Math.min(1.5, 1 + relative / 55));
    const taken = 1 - Math.min(0.6, competition?.[seg.id] ?? 0);
    /* What this city would send anybody. The denominator for everything. */
    const neutral = seg.base * bias;
    return { segment: seg, neutral, weight: neutral * pull * taken, appeal };
  });

  const total = rows.reduce((sum, x) => sum + x.weight, 0);
  const neutralTotal = rows.reduce((sum, x) => sum + x.neutral, 0);

  const shares =
    total > 0
      ? rows
          .map((x) => ({
            segment: x.segment,
            share: x.weight / total,
            appeal: x.appeal,
          }))
          .sort((a, b) => b.share - a.share)
      : rows.map((x) => ({ segment: x.segment, share: 0, appeal: x.appeal }));

  /*
   * Bounded to a quarter either way. Demand multiplies the forecast, which is
   * the input to every other number in the economy; a wide band here is not a
   * flavour adjustment, it is a global difficulty slider.
   */
  const demand =
    neutralTotal > 0
      ? Math.max(0.75, Math.min(1.25, total / neutralTotal))
      : 1;

  const spendOf = (weightKey: "weight" | "neutral") => {
    const sum = rows.reduce((n, x) => n + x[weightKey], 0);
    if (sum <= 0) return 1;
    return rows.reduce((n, x) => n + x.segment.spend * x[weightKey], 0) / sum;
  };
  const spend =
    Math.max(0.85, Math.min(1.2, spendOf("weight") / spendOf("neutral")));

  const patienceSum = rows.reduce((n, x) => n + x.weight, 0);
  const patience =
    patienceSum > 0
      ? rows.reduce((n, x) => n + x.segment.patience * x.weight, 0) / patienceSum
      : 1;

  return { shares, demand, spend, patience };
}

/** Just the shares, for a panel that only wants to draw the room. */
export const segmentMix = (
  k: KitchenState,
  overall: number,
  week: number,
  service?: string,
  competition?: Record<string, number>,
): SegmentShare[] => dinerMix(k, overall, week, service, competition).shares;

/**
 * Pick the segment one particular table belongs to.
 *
 * Used when a review or a customer post is written, so the complaint comes
 * from somebody with a reason to make it. Deterministic given the roll.
 */
export function segmentAt(mix: SegmentShare[], roll: number): DinerSegment {
  let acc = 0;
  for (const x of mix) {
    acc += x.share;
    if (roll <= acc) return x.segment;
  }
  return mix[mix.length - 1]?.segment ?? SEGMENTS[0];
}

/**
 * The one sentence explaining why this segment is or is not coming.
 *
 * Written from the same numbers the share was computed from, so the panel can
 * never say something the mix does not do.
 */
export function whySegment(
  share: SegmentShare,
  k: KitchenState,
  week: number,
): string {
  const seg = share.segment;
  const city = cityOf(k);
  const season = seasonOf(week);
  const cityBias = seg.cityBias?.[city.id] ?? 1;
  const seasonBias = seg.seasonBias?.[season.id] ?? 1;
  const stand = priceStand(k);

  const parts: string[] = [];
  if (cityBias >= 1.3) parts.push(`${city.name} is full of them`);
  else if (cityBias <= 0.75) parts.push(`there are few of them in ${city.name}`);
  if (seasonBias >= 1.25) parts.push(`${season.label.toLowerCase()} is their season`);
  else if (seasonBias <= 0.8) parts.push(`they are thin on the ground in ${season.label.toLowerCase()}`);

  if (seg.priceSensitivity >= 0.5 && stand > 1.12) {
    parts.push("your prices are above what they will pay");
  } else if (seg.priceSensitivity >= 0.5 && stand < 0.92) {
    parts.push("your prices are inside what they will pay");
  }

  const best = topWant(seg);
  parts.push(
    share.appeal >= 62
      ? `and what they judge you on — ${best.toLowerCase()} — you are good at`
      : share.appeal <= 38
        ? `and what they judge you on — ${best.toLowerCase()} — is your weakest part`
        : `and they judge you mostly on ${best.toLowerCase()}`,
  );

  const sentence = parts.join(", ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

/** The category a segment weighs most heavily. */
export function topWant(seg: DinerSegment): string {
  let best: StandingId | null = null;
  let bestWeight = 0;
  for (const def of STANDINGS) {
    const w = seg.wants[def.id] ?? 0;
    if (w > bestWeight) {
      bestWeight = w;
      best = def.id;
    }
  }
  return STANDINGS.find((d) => d.id === best)?.label ?? "the food";
}

/**
 * How well the menu itself suits a segment.
 *
 * Read off the dishes actually on: originality for the enthusiasts, price for
 * the budget end, presentation for the luxury table. Used by the scene panel
 * to name the dish that is bringing a segment in, which is a thing a player
 * can act on — "put the pithivier back on" — rather than a score.
 */
export function bestDishFor(
  seg: DinerSegment,
  k: KitchenState,
): { name: string; why: string } | null {
  const menu = activeMenu(k);
  if (menu.length === 0) return null;
  const expected = spendPerHead(k);

  let bestName: string | null = null;
  let bestWhy = "";
  let bestScore = -Infinity;

  for (const entry of menu) {
    const recipe = RECIPE_BY_ID.get(entry.recipe);
    if (!recipe) continue;
    const innovation = (seg.wants.innovation ?? 0) * recipe.originality;
    const food = (seg.wants.food ?? 0) * recipe.baseQuality;
    const room = (seg.wants.atmosphere ?? 0) * recipe.presentation;
    const value =
      (seg.wants.value ?? 0) *
      Math.max(0, 100 - (entry.price / Math.max(1, expected)) * 60);
    const score = innovation + food + room + value;
    if (score > bestScore) {
      bestScore = score;
      bestName = recipeName(recipe, progressFor(k, recipe.id));
      bestWhy =
        innovation >= food && innovation >= value
          ? "there is nothing else like it in the city"
          : value >= food
            ? "it is the best thing on the menu for the money"
            : "it is the best cooking you do";
    }
  }
  return bestName ? { name: bestName, why: bestWhy } : null;
}

/** What the room looks like tonight, in words, for the report. */
export function roomDescription(mix: SegmentShare[]): string {
  const top = mix.slice(0, 2).filter((x) => x.share > 0.12);
  if (top.length === 0) return "A mixed room with nobody in particular in it.";
  if (top.length === 1) {
    return `Mostly ${top[0].segment.label.toLowerCase()}.`;
  }
  return `Mostly ${top[0].segment.label.toLowerCase()}, with ${top[1].segment.label.toLowerCase()} behind them.`;
}

/** The premises' own contribution to how the room feels. */
export function roomComfort(k: KitchenState): number {
  const room = premisesOf(k);
  const index = PREMISES_RANK.indexOf(room.id);
  return index < 0 ? 40 : 32 + index * 17;
}

const PREMISES_RANK = ["stall", "bistro", "restaurant", "flagship"];
