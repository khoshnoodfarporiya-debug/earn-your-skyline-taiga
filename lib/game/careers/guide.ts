import type { KitchenState } from "./kitchen";
import { activeMenu, premisesOf, knownRecipes } from "./kitchen";
import { RECIPE_BY_ID } from "./recipes";
import { standingOf, type StandingId } from "./standing";
import { learnedTechniques } from "./craft";
import { listPrestige } from "./cellar";

/**
 * THE GUIDE
 *
 * Not another critic. A critic writes a piece and moves on; the guide comes
 * back every year, and what it gives you it can take away again.
 *
 * -------------------------------------------------------- why it is separate
 *
 * The five critics in `critics.ts` are *opinions* — each weighs the seven
 * standing categories differently, and a bad one from the value critic is
 * survivable if the enthusiasts still love you. The guide is a *standard*: it
 * measures the same six things in every restaurant it visits, publishes once a
 * year, and its verdict is the only thing in this career that changes what
 * kind of restaurant you are running.
 *
 * ------------------------------------------------------------ what a star is
 *
 * Three things at once, and the third is the point:
 *
 *   - a **draw**: people plan journeys around starred restaurants
 *   - a **premium**: what a cover is worth goes up, sharply
 *   - a **standard you now have to hold**: expectations rise permanently
 *     while you hold it, every service is judged against them, and a year of
 *     coasting loses it.
 *
 * A restaurant that wins two stars and then relaxes is measurably worse off
 * than one that never won any, because the room is now full of people who
 * came for two stars. That is the whole design.
 *
 * ------------------------------------------------------------- and no ending
 *
 * Three stars is not a win screen. Nothing here writes `outcome`, nothing
 * stops the run, and the week after the guide is published is an ordinary
 * Monday with a harder problem in it.
 */

export interface StarLevel {
  stars: number;
  label: string;
  /** What the guide says it means. */
  blurb: string;
  /** Score needed to reach it. */
  at: number;
  /** Score below which it is taken away once held. Deliberately lower. */
  keep: number;
  /** Multiplier on covers wanting a table. */
  draw: number;
  /** Multiplier on what a cover is worth. */
  worth: number;
  /** Points added to the bar every night is judged against. */
  expectation: number;
}

export const STAR_LEVELS: StarLevel[] = [
  {
    stars: 0,
    label: "Not in the guide",
    blurb: "They have not been, or they have been and said nothing.",
    at: 0,
    keep: 0,
    draw: 1,
    worth: 1,
    expectation: 0,
  },
  {
    stars: 1,
    label: "One star",
    blurb: "A very good restaurant in its category. Worth a stop.",
    at: 62,
    keep: 52,
    draw: 1.16,
    worth: 1.14,
    expectation: 7,
  },
  {
    stars: 2,
    label: "Two stars",
    blurb: "Excellent cooking. Worth a detour.",
    at: 78,
    keep: 68,
    draw: 1.3,
    worth: 1.3,
    expectation: 14,
  },
  {
    stars: 3,
    label: "Three stars",
    blurb: "Exceptional cuisine. Worth a special journey.",
    at: 91,
    keep: 82,
    draw: 1.48,
    worth: 1.55,
    expectation: 24,
  },
];

export const starLevel = (stars: number): StarLevel =>
  STAR_LEVELS[Math.max(0, Math.min(3, Math.round(stars)))];

/** What a restaurant currently holds. Absent means none, which is true. */
export const starsOf = (k: KitchenState): number =>
  Math.max(0, Math.min(3, k.stars ?? 0));

export const starDraw = (k: KitchenState): number => starLevel(starsOf(k)).draw;
export const starWorth = (k: KitchenState): number => starLevel(starsOf(k)).worth;
export const starExpectation = (k: KitchenState): number =>
  starLevel(starsOf(k)).expectation;

/* ---------------------------------------------------------------- the score */

/**
 * What the guide measures, and how heavily.
 *
 * Six components, and every one of them is something the player built. There
 * is no term here for money, for followers or for how many covers you turn: a
 * guide inspector does not care how busy you are.
 */
export interface GuideComponent {
  id: string;
  label: string;
  /** What it is looking at, in the player's words. */
  note: string;
  weight: number;
}

export const GUIDE_COMPONENTS: GuideComponent[] = [
  {
    id: "cooking",
    label: "The cooking",
    note: "Food quality, and whether it is that good every time.",
    weight: 0.34,
  },
  {
    id: "craft",
    label: "Technique",
    note: "What this kitchen is demonstrably able to do that others cannot.",
    weight: 0.18,
  },
  {
    id: "personality",
    label: "Personality of the menu",
    note: "Whether the food could only have come from here.",
    weight: 0.16,
  },
  {
    id: "room",
    label: "The room and the service",
    note: "How it feels to sit there and be looked after.",
    weight: 0.14,
  },
  {
    id: "cellar",
    label: "The list",
    note: "Whether there is a wine programme or a printed page.",
    weight: 0.08,
  },
  {
    id: "kitchen",
    label: "The kitchen itself",
    note: "Cleanliness, and whether the place is run properly.",
    weight: 0.1,
  },
];

export interface GuideScore {
  total: number;
  parts: { id: string; label: string; value: number; note: string }[];
}

/**
 * Score the restaurant as the guide would.
 *
 * Pure and deterministic — the same restaurant always scores the same, which
 * is what makes the guide something a player can work toward rather than
 * something that happens to them.
 */
export function guideScore(k: KitchenState, reputation: number): GuideScore {
  const scores = standingOf(k, reputation);
  const menu = activeMenu(k);
  const originality =
    menu.length > 0
      ? menu.reduce(
          (n, e) => n + (RECIPE_BY_ID.get(e.recipe)?.originality ?? 30),
          0,
        ) / menu.length
      : 12;
  const signature = knownRecipes(k).some((p) => p.signature) ? 14 : 0;
  const room = ["stall", "bistro", "restaurant", "flagship", "destination"].indexOf(
    premisesOf(k).id,
  );

  const values: Record<string, number> = {
    /* Cooking is the plate and whether it is the same twice — a guide will
       not star a kitchen that is brilliant on Thursdays. */
    cooking: scores.food * 0.68 + scores.consistency * 0.32,
    craft: Math.min(100, learnedTechniques(k).length * 11),
    personality: Math.min(100, originality + signature + scores.innovation * 0.3),
    room: scores.atmosphere * 0.55 + scores.service * 0.45 + Math.max(0, room) * 3,
    cellar: listPrestige(k),
    kitchen: scores.hygiene,
  };

  const parts = GUIDE_COMPONENTS.map((c) => ({
    id: c.id,
    label: c.label,
    value: Math.max(0, Math.min(100, values[c.id] ?? 0)),
    note: c.note,
  }));

  const total = GUIDE_COMPONENTS.reduce(
    (n, c) => n + (values[c.id] ?? 0) * c.weight,
    0,
  );
  return { total: Math.max(0, Math.min(100, total)), parts };
}

/**
 * What the guide would give this restaurant today.
 *
 * Asymmetric on purpose: `at` is what it takes to win a star and `keep` is the
 * lower score at which one already held is taken away. Without that gap a
 * restaurant on the boundary would gain and lose a star every year, which is
 * noise rather than drama.
 */
export function starsFor(score: number, held: number): number {
  /* Can you keep what you have? */
  let keep = 0;
  for (const level of STAR_LEVELS) {
    if (level.stars <= held && score >= level.keep) keep = level.stars;
  }
  /* Could you win more? Never more than one at a time — nobody goes from
     nothing to two, and the guide says so itself. */
  let earn = keep;
  for (const level of STAR_LEVELS) {
    if (level.stars === keep + 1 && score >= level.at) earn = level.stars;
  }
  return earn;
}

/* ------------------------------------------------------------- the calendar */

/** The guide publishes once a year, in the same week every year. */
export const GUIDE_WEEK = 40;

export const guideDue = (week: number): boolean => week % 52 === GUIDE_WEEK % 52;

/** Weeks until it publishes again. */
export const weeksToGuide = (week: number): number => {
  const into = week % 52;
  const target = GUIDE_WEEK % 52;
  return into <= target ? target - into : 52 - into + target;
};

/** One year's verdict, kept so the player can see the arc. */
export interface GuideRecord {
  week: number;
  /** Stars before and after, so a loss reads as a loss. */
  from: number;
  to: number;
  score: number;
  /** The guide's own sentence. */
  note: string;
  /** The weakest component, named — the only guidance it ever gives. */
  weakest: string;
}

export const MAX_GUIDE_RECORDS = 8;

/**
 * Publish.
 *
 * Returns the record and the new star count. The caller applies it, so this
 * stays pure and testable — and so the one place that writes `k.stars` is the
 * week, not a scoring function.
 */
export function publishGuide(
  k: KitchenState,
  reputation: number,
  week: number,
): { record: GuideRecord; stars: number } {
  const held = starsOf(k);
  const score = guideScore(k, reputation);
  const stars = starsFor(score.total, held);
  const weakest = score.parts
    .slice()
    .sort((a, b) => a.value - b.value)[0];

  const note =
    stars > held
      ? stars === 3
        ? "Exceptional cuisine, worth a special journey. The third star is the one nobody plans for."
        : `${starLevel(stars).label} — ${starLevel(stars).blurb}`
      : stars < held
        ? held - stars > 1
          ? "The guide has removed two stars in one edition, which it almost never does."
          : "The guide has taken a star back. It gives no reason and it never does."
        : held === 0
          ? "The guide came, ate, and did not write about you."
          : `${starLevel(stars).label}, retained.`;

  return {
    record: {
      week,
      from: held,
      to: stars,
      score: Math.round(score.total),
      note,
      weakest: weakest?.label ?? "The cooking",
    },
    stars,
  };
}

/**
 * What is currently standing between this restaurant and the next star.
 *
 * Shown on the screen all year, because a guide that only speaks once a year
 * and says nothing useful is a lottery. It names the weakest component and
 * how far off the threshold the restaurant is — never a formula, and never a
 * promise.
 */
export function towardsNext(
  k: KitchenState,
  reputation: number,
): { next: StarLevel | null; short: number; weakest: GuideScore["parts"][number] | null } {
  const held = starsOf(k);
  const next = STAR_LEVELS.find((l) => l.stars === held + 1) ?? null;
  const score = guideScore(k, reputation);
  const weakest = score.parts.slice().sort((a, b) => a.value - b.value)[0] ?? null;
  return {
    next,
    short: next ? Math.max(0, Math.ceil(next.at - score.total)) : 0,
    weakest,
  };
}

/** Whether a star currently held is at risk, for the warning on the screen. */
export function starAtRisk(k: KitchenState, reputation: number): boolean {
  const held = starsOf(k);
  if (held === 0) return false;
  return guideScore(k, reputation).total < starLevel(held).keep + 4;
}

/** Which standing category a component maps to, for the "what to fix" line. */
export const COMPONENT_STANDING: Record<string, StandingId> = {
  cooking: "food",
  craft: "innovation",
  personality: "innovation",
  room: "atmosphere",
  cellar: "atmosphere",
  kitchen: "hygiene",
};
