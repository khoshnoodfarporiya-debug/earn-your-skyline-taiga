import type { RunState } from "../types";
import { pushLog } from "../engine";
import type { KitchenState } from "./kitchen";

/**
 * WHAT THE CITY THINKS OF YOU, IN SEVEN PARTS
 *
 * "Reputation 62" answered no useful question. A kitchen whose food is superb
 * and whose service is chaos, and one that is merely competent at everything,
 * had the same number — and the player had no way to know which of their
 * problems was the one costing them covers.
 *
 * ---------------------------------------------------------------- the rule
 *
 * `s.r.reputation` is written from about twenty places in this career and read
 * by the forecast, hiring, events, the objective and every setback check.
 * Replacing it with a derived value would have meant rewriting all of them,
 * and any one missed would be a silent balance change.
 *
 * So it is not replaced. **Every existing write now goes through
 * `applyStanding`, which moves the overall by exactly what it always moved and
 * additionally attributes the move to one of seven categories.** The overall
 * is the same number it has always been; what is new is that the player can
 * see which part of the restaurant produced it, and why.
 *
 * That gives a migration rule with no data conversion at all: a save arrives
 * with no categories, `seedStanding` sets all seven to whatever that run's
 * `reputation` already is, and the run continues from a position that agrees
 * with the restaurant it has actually been running.
 *
 * ------------------------------------------------------- the honesty rule
 *
 * Every call names a reason, and the reason is a fact about the week: a
 * number of covers, a named dish, a station that fell behind. There is no
 * random drift term anywhere in this file. If a bar moves, the panel can say
 * what moved it, because the sentence was written at the point the simulation
 * decided it.
 */

export type StandingId =
  | "food"
  | "service"
  | "value"
  | "atmosphere"
  | "consistency"
  | "hygiene"
  | "innovation";

export interface StandingDef {
  id: StandingId;
  label: string;
  /** What it is, in the player's terms. */
  hint: string;
  /** What moves it, so a change is never a mystery. */
  driver: string;
  /**
   * Share of the *scene* score — the one number used to rank you against the
   * rival kitchens in your city. Not used for `s.r.reputation`, which is the
   * accumulator every existing system already reads.
   */
  weight: number;
}

export const STANDINGS: StandingDef[] = [
  {
    id: "food",
    label: "Food quality",
    hint: "Whether what leaves the pass is any good.",
    driver: "Plate quality, freshness, the skill of whoever cooked it.",
    weight: 0.26,
  },
  {
    id: "service",
    label: "Service",
    hint: "Whether people get what they ordered while they still wanted it.",
    driver: "Waits, walkouts, mistakes, covers turned away.",
    weight: 0.18,
  },
  {
    id: "value",
    label: "Value",
    hint: "Whether the bill felt fair for what arrived.",
    driver: "Your prices against the plate, the room and what the city spends.",
    weight: 0.15,
  },
  {
    id: "atmosphere",
    label: "Atmosphere",
    hint: "Whether the room is somewhere people want to sit.",
    driver: "The premises, how full it is, and how calm the brigade looked.",
    weight: 0.13,
  },
  {
    id: "consistency",
    label: "Consistency",
    hint: "Whether tonight will be like the night they came before.",
    driver: "How much your plate quality moves from week to week.",
    weight: 0.14,
  },
  {
    id: "hygiene",
    label: "Hygiene",
    hint: "Whether the kitchen is clean and the food is safe.",
    driver: "Spoilage, what you throw away, inspections, allergy handling.",
    weight: 0.08,
  },
  {
    id: "innovation",
    label: "Innovation",
    hint: "Whether there is a reason to come here rather than anywhere else.",
    driver: "Original dishes, signatures, and how long the menu has stood still.",
    weight: 0.06,
  },
];

export const STANDING_BY_ID = new Map(STANDINGS.map((x) => [x.id, x]));

/** One attributed move, kept so a bar is never a mystery. */
export interface StandingChange {
  week: number;
  id: StandingId;
  delta: number;
  why: string;
}

/** Enough to explain a season without bloating a 156-week save. */
export const MAX_STANDING_LOG = 48;

/** Enough of a trend to see a direction. One entry per resolved week. */
export const MAX_STANDING_TREND = 16;

/** One week's seven scores, for the trend chart. */
export interface StandingSnapshot {
  week: number;
  scores: Record<StandingId, number>;
}

/* --------------------------------------------------------------- reading */

/**
 * The seven scores, defaulting to whatever the overall already is.
 *
 * A save from before this existed has no `standing` object and reads as a
 * kitchen whose seven parts all agree with its reputation, which is the only
 * honest thing to say about a run that was never measured in parts.
 */
export function standingOf(
  k: KitchenState,
  overall: number,
): Record<StandingId, number> {
  const seed = Math.max(0, Math.min(100, overall));
  const stored = k.standing ?? {};
  const out = {} as Record<StandingId, number>;
  for (const def of STANDINGS) {
    const v = stored[def.id];
    out[def.id] = typeof v === "number" && Number.isFinite(v) ? v : seed;
  }
  return out;
}

export const standingValue = (
  k: KitchenState,
  id: StandingId,
  overall: number,
): number => standingOf(k, overall)[id];

/**
 * The weighted blend, used to rank you against the city's other kitchens.
 *
 * Deliberately *not* `s.r.reputation`: that is an accumulator with its own
 * history, and this is a description of the restaurant as it stands today.
 * They agree closely, and where they differ the difference is informative —
 * a kitchen coasting on an old reputation reads lower here than its number.
 */
export function sceneScore(k: KitchenState, overall: number): number {
  const scores = standingOf(k, overall);
  let sum = 0;
  for (const def of STANDINGS) sum += scores[def.id] * def.weight;
  return Math.max(0, Math.min(100, sum));
}

/** Plain-English band, so a bar is never the only signal. */
export function standingWord(value: number): string {
  if (value >= 80) return "Excellent";
  if (value >= 62) return "Strong";
  if (value >= 45) return "Fair";
  if (value >= 28) return "Weak";
  return "Poor";
}

/** What changed recently, newest first. */
export const recentStanding = (
  k: KitchenState,
  week: number,
  weeks = 4,
): StandingChange[] =>
  (k.repLog ?? []).filter((c) => c.week > week - weeks);

/**
 * Which way a category has been going, over the weeks that were recorded.
 *
 * Returns null when there is not yet enough history to say anything — which
 * is a real answer and better than drawing a flat line through one point.
 */
export function trendOf(
  k: KitchenState,
  id: StandingId,
): { from: number; to: number; delta: number } | null {
  const trend = k.repTrend ?? [];
  if (trend.length < 2) return null;
  const from = trend[0].scores[id];
  const to = trend[trend.length - 1].scores[id];
  if (typeof from !== "number" || typeof to !== "number") return null;
  return { from, to, delta: to - from };
}

/* --------------------------------------------------------------- writing */

/**
 * Move one category, move the overall with it, and say why.
 *
 * The two moves are the same number. That is what makes this a superset of
 * the old single figure rather than a second economy: every reputation change
 * this career made before still happens, at the same size, and is now also
 * filed under the part of the restaurant that caused it.
 *
 * `quiet` suppresses the narrative log line for things that happen every
 * single week — the ordinary review move, ordinary wear. The number still
 * moves and the reason is still recorded; it simply does not shout. Without
 * it the week's log would be nothing but standing noise.
 */
export function applyStanding(
  s: RunState,
  id: StandingId,
  delta: number,
  why: string,
  quiet = true,
): void {
  if (!Number.isFinite(delta) || delta === 0) return;
  const k = s.data.kitchen as KitchenState | undefined;
  if (!k) return;

  const overallBefore = s.r.reputation ?? 0;
  const current = standingOf(k, overallBefore);
  const before = current[id];
  const after = Math.max(0, Math.min(100, before + delta));

  k.standing = { ...current, [id]: after };
  /* The overall keeps its own clamp and its own history: it is the number
     twenty other places already read, and this must not change what it does. */
  s.r.reputation = Math.max(0, Math.min(100, overallBefore + delta));

  const moved = Math.round(delta * 100) / 100;
  k.repLog = [{ week: s.week, id, delta: moved, why }, ...(k.repLog ?? [])].slice(
    0,
    MAX_STANDING_LOG,
  );

  if (!quiet && Math.abs(moved) >= 1.5) {
    const def = STANDING_BY_ID.get(id);
    pushLog(
      s,
      `${def?.label ?? id} ${moved > 0 ? "up" : "down"} — ${why}.`,
      moved > 0 ? "good" : "bad",
    );
  }
}

/**
 * Move a category toward what the restaurant demonstrably *is*, and say why.
 *
 * The other half of the model, and the reason there are two functions rather
 * than one. `applyStanding` is for **news** — a bad night, a critic, a
 * complaint — and it moves the overall with it, because that is what the
 * overall has always been: an accumulator of things that happened.
 *
 * This is for **facts**. Atmosphere is a property of the room you bought;
 * value is a property of the prices you set; hygiene follows how much you
 * throw away. Those are true on the week they become true, they do not
 * accumulate, and pushing the overall reputation every week because you own a
 * nice dining room would run it away to 100 inside a season.
 *
 * So a settle moves the category at a stated rate toward a stated target and
 * **leaves `s.r.reputation` alone**. That is the entire compatibility
 * guarantee for this phase: the economy still runs on the number it always
 * ran on, and the breakdown is a description sitting beside it.
 */
export function settleStanding(
  s: RunState,
  id: StandingId,
  target: number,
  rate: number,
  why: string,
): void {
  const k = s.data.kitchen as KitchenState | undefined;
  if (!k) return;
  if (!Number.isFinite(target)) return;

  const current = standingOf(k, s.r.reputation ?? 0);
  const before = current[id];
  const gap = Math.max(0, Math.min(100, target)) - before;
  if (Math.abs(gap) < 0.05) return;

  const step = Math.sign(gap) * Math.min(Math.abs(gap), Math.abs(rate));
  const after = Math.max(0, Math.min(100, before + step));
  k.standing = { ...current, [id]: after };

  const moved = Math.round(step * 100) / 100;
  if (moved === 0) return;
  k.repLog = [{ week: s.week, id, delta: moved, why }, ...(k.repLog ?? [])].slice(
    0,
    MAX_STANDING_LOG,
  );
}

/**
 * Record this week's seven scores, once, at the end of a resolved week.
 *
 * Called from `resolveWeek` after everything that moves a category has run,
 * so the trend is a record of weeks that happened rather than of moments
 * inside them. Bounded, because a 156-week save must not carry 156 of these.
 */
export function recordStandingWeek(s: RunState): void {
  const k = s.data.kitchen as KitchenState | undefined;
  if (!k) return;
  const scores = standingOf(k, s.r.reputation ?? 0);
  k.repTrend = [...(k.repTrend ?? []), { week: s.week, scores }].slice(
    -MAX_STANDING_TREND,
  );
}

/**
 * Give an un-measured save seven scores that agree with the run it played.
 *
 * Called on first touch rather than at load, for the same reason
 * `ensureChefPhone` is: a career must be able to gain a feature without the
 * engine knowing the feature exists.
 */
export function seedStanding(k: KitchenState, overall: number): void {
  if (!k.standing) k.standing = standingOf(k, overall);
}
