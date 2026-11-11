import type { KitchenState } from "./kitchen";
import { premisesOf, knownRecipes } from "./kitchen";
import { RECIPE_BY_ID } from "./recipes";

/**
 * WHAT THE CHEF CAN ACTUALLY DO
 *
 * Until now the player's cooking was one number — `skill` — that went up when
 * they spent a week on it. That is a progress bar, not a craft: it answered
 * "how good are you" and never "good at what", so a chef who had spent three
 * years on pastry and one who had spent them on butchery were the same person.
 *
 * ---------------------------------------------------------------- the model
 *
 * Fourteen techniques across five disciplines. Each is learned by *doing the
 * work* — cooking dishes in that discipline moves it, deliberate practice
 * moves it faster, and a stage in somebody else's kitchen moves it fastest and
 * costs the most. Each does something specific and stated:
 *
 *   - unlocks recipes that cannot be cooked without it
 *   - lets you handle ingredients that would otherwise be wasted
 *   - lifts every dish in its discipline
 *   - or takes waste off the whole kitchen
 *
 * There is no technique whose effect is "+2 skill". A player who learns
 * butchery should be able to point at the dishes it opened and the waste line
 * that fell.
 *
 * ------------------------------------------------------------- the standing
 *
 * Out of all of it comes the thing a chef's career is actually measured by:
 * what other chefs think you are. That is `chefRank`, and it is not a score —
 * it gates who will come and work for you, which kitchens will have you for a
 * stage, and which of the offers in `ventures.ts` are made at all.
 *
 * Every field is optional on the save. A kitchen from before this existed has
 * no techniques, is ranked on what it has actually built, and plays exactly as
 * it did.
 */

export type Discipline =
  | "butchery"
  | "saucier"
  | "pastry"
  | "garde"
  | "modern";

export interface DisciplineDef {
  id: Discipline;
  label: string;
  /** What this part of cooking is, in a line. */
  blurb: string;
}

export const DISCIPLINES: DisciplineDef[] = [
  {
    id: "butchery",
    label: "Butchery",
    blurb: "Breaking down whole animals and fish, and using all of them.",
  },
  {
    id: "saucier",
    label: "Sauce",
    blurb: "Stocks, reductions, emulsions — the part people cannot name and always notice.",
  },
  {
    id: "pastry",
    label: "Pastry",
    blurb: "Its own discipline, its own section, and the last thing anybody eats.",
  },
  {
    id: "garde",
    label: "Larder",
    blurb: "Curing, pickling, fermenting: making food last without a freezer.",
  },
  {
    id: "modern",
    label: "Modern technique",
    blurb: "Precision cooking and the things that were not possible thirty years ago.",
  },
];

export const DISCIPLINE_BY_ID = new Map(DISCIPLINES.map((d) => [d.id, d]));

export interface Technique {
  id: string;
  label: string;
  discipline: Discipline;
  blurb: string;
  /** What it does. Every word of this has to be something the code performs. */
  effect: string;
  /** Practice points to learn it. A block of practice is worth about 22. */
  cost: number;
  /** Techniques that must be learned first. */
  needs?: string[];
  /** Recipe ids this makes cookable at all. */
  unlocks?: string[];
  /** Ingredient ids that cannot be used properly without it. */
  handles?: string[];
  /** Added to the quality of every dish in this discipline. */
  lift: number;
  /** Share of what would have been wasted that this recovers, 0–1. */
  yield?: number;
  /** Added to what a cover is worth, as a multiplier above 1. */
  worth?: number;
}

export const TECHNIQUES: Technique[] = [
  /* --------------------------------------------------------------- butchery */
  {
    id: "breakdown",
    label: "Breaking down a carcass",
    discipline: "butchery",
    blurb: "A whole animal, on a bench, and a knife you sharpened yourself.",
    effect: "Recovers a fifth of what the kitchen would otherwise throw away.",
    cost: 40,
    lift: 2,
    yield: 0.2,
  },
  {
    id: "fishmonger",
    label: "Filleting and fish butchery",
    discipline: "butchery",
    blurb: "Whole fish, off the bone, without leaving half of it on the frame.",
    effect: "Unlocks the langoustine plate and lifts every fish dish.",
    cost: 55,
    needs: ["breakdown"],
    unlocks: ["langoustine"],
    handles: ["langoustine"],
    lift: 4,
  },
  {
    id: "dryage",
    label: "Dry-ageing",
    discipline: "butchery",
    blurb: "Six weeks in a cabinet, losing water and gaining everything else.",
    effect: "Unlocks aged beef, and it is worth about 5% more a cover.",
    cost: 70,
    needs: ["breakdown"],
    unlocks: ["aged_rib"],
    handles: ["agedbeef"],
    lift: 5,
    worth: 0.05,
  },

  /* ---------------------------------------------------------------- saucier */
  {
    id: "stocks",
    label: "Stocks and reductions",
    discipline: "saucier",
    blurb: "On at seven, skimmed all day, and the reason everything tastes of something.",
    effect: "Lifts every sauced dish, and bones stop being waste.",
    cost: 35,
    lift: 4,
    yield: 0.1,
  },
  {
    id: "emulsion",
    label: "Emulsions",
    discipline: "saucier",
    blurb: "Butter, acid and nerve. The sauce that splits is the one you served.",
    effect: "Lifts sauced dishes further and cuts mistakes on the hot line.",
    cost: 55,
    needs: ["stocks"],
    lift: 5,
  },
  {
    id: "jus",
    label: "Classical jus",
    discipline: "saucier",
    blurb: "Two days, forty litres, and about a pint of it left at the end.",
    effect: "Unlocks the aged rib and adds 4% to what a cover is worth.",
    cost: 80,
    needs: ["emulsion"],
    unlocks: ["aged_rib"],
    lift: 6,
    worth: 0.04,
  },

  /* ----------------------------------------------------------------- pastry */
  {
    id: "doughs",
    label: "Doughs and laminated pastry",
    discipline: "pastry",
    blurb: "Butter cold, room cold, hands colder. Twenty-seven layers or none.",
    effect: "Lifts every pastry dish.",
    cost: 35,
    lift: 4,
  },
  {
    id: "sugar",
    label: "Sugarwork and tempering",
    discipline: "pastry",
    blurb: "Chocolate to thirty-one degrees, held there, and not a degree over.",
    effect: "Unlocks the soufflé and lifts pastry further.",
    cost: 60,
    needs: ["doughs"],
    unlocks: ["souffle"],
    lift: 5,
  },
  {
    id: "petits",
    label: "Petits fours",
    discipline: "pastry",
    blurb: "Four small things with the coffee that nobody ordered and everybody remembers.",
    effect: "Adds 4% to what a cover is worth, on every service.",
    cost: 70,
    needs: ["sugar"],
    lift: 2,
    worth: 0.04,
  },

  /* ----------------------------------------------------------------- larder */
  {
    id: "curing",
    label: "Curing and salting",
    discipline: "garde",
    blurb: "Salt, time, and a cellar that smells like a good decision.",
    effect: "Everything in the larder keeps longer, and waste falls.",
    cost: 40,
    lift: 3,
    yield: 0.15,
  },
  {
    id: "ferment",
    label: "Fermentation",
    discipline: "garde",
    blurb: "Jars along a shelf, labelled in pencil, doing the work while you sleep.",
    effect: "Lifts larder dishes and makes the menu genuinely original.",
    cost: 60,
    needs: ["curing"],
    lift: 5,
  },
  {
    id: "caviar",
    label: "Caviar service",
    discipline: "garde",
    blurb: "Mother-of-pearl, a cold plate, and getting out of the way.",
    effect: "Lets the kitchen serve caviar at all, and it is worth 5% a cover.",
    cost: 75,
    needs: ["curing"],
    handles: ["caviar"],
    unlocks: ["caviar_service"],
    lift: 3,
    worth: 0.05,
  },

  /* ------------------------------------------------------------- modern */
  {
    id: "precision",
    label: "Precision cooking",
    discipline: "modern",
    blurb: "A water bath, a probe, and an argument about whether it is cooking.",
    effect: "Fewer mistakes everywhere, and every dish lands more consistently.",
    cost: 50,
    lift: 3,
  },
  {
    id: "plating",
    label: "Plating at the pass",
    discipline: "modern",
    blurb: "Tweezers, a warm plate, and thirty seconds before it stops being hot.",
    effect: "Unlocks the tasting counter's own course and lifts presentation everywhere.",
    cost: 85,
    needs: ["precision"],
    unlocks: ["counter_course"],
    lift: 6,
    worth: 0.04,
  },
];

export const TECHNIQUE_BY_ID = new Map(TECHNIQUES.map((t) => [t.id, t]));

/* ------------------------------------------------------------ the progress */

/** Practice points banked against each technique. */
export const progressOf = (k: KitchenState): Record<string, number> =>
  k.techniques ?? {};

export const learnedTechniques = (k: KitchenState): Technique[] =>
  TECHNIQUES.filter((t) => (progressOf(k)[t.id] ?? 0) >= t.cost);

export const knowsTechnique = (k: KitchenState, id: string): boolean =>
  (progressOf(k)[id] ?? 0) >= (TECHNIQUE_BY_ID.get(id)?.cost ?? Infinity);

/** Whether the prerequisites are in place, so a technique can be worked on. */
export const canLearn = (k: KitchenState, t: Technique): boolean =>
  (t.needs ?? []).every((id) => knowsTechnique(k, id));

/** Why a technique cannot be practised yet, in the player's words. */
export function techniqueBlocker(
  k: KitchenState,
  t: Technique,
): string | null {
  if (knowsTechnique(k, t.id)) return "You already know this";
  const missing = (t.needs ?? []).filter((id) => !knowsTechnique(k, id));
  if (missing.length > 0) {
    const names = missing
      .map((id) => TECHNIQUE_BY_ID.get(id)?.label ?? id)
      .join(" and ");
    return `Needs ${names.toLowerCase()} first`;
  }
  return null;
}

/**
 * Add practice, and say whether it finished something.
 *
 * The only place technique progress is written. Points above what a technique
 * costs are dropped rather than banked — there is no such thing as being
 * better than knowing how to fillet a fish, and carrying the surplus would
 * make the next technique free.
 */
export function practise(
  k: KitchenState,
  id: string,
  points: number,
): { learned: boolean; technique: Technique | null } {
  const t = TECHNIQUE_BY_ID.get(id);
  if (!t || !canLearn(k, t)) return { learned: false, technique: null };
  const before = progressOf(k)[id] ?? 0;
  if (before >= t.cost) return { learned: false, technique: t };
  const after = Math.min(t.cost, before + Math.max(0, points));
  k.techniques = { ...progressOf(k), [id]: after };
  return { learned: after >= t.cost, technique: t };
}

/**
 * The practice a week of cooking is worth on its own.
 *
 * Small, and only for disciplines the menu actually uses — you do not get
 * better at pastry by running a soup kitchen. This is what makes a long run
 * teach the chef something even if they never spend a block on practice.
 */
export function practiceFromService(
  k: KitchenState,
  covers: number,
): Record<Discipline, number> {
  const out: Record<Discipline, number> = {
    butchery: 0,
    saucier: 0,
    pastry: 0,
    garde: 0,
    modern: 0,
  };
  if (covers <= 0) return out;
  const worked = Math.min(3, covers / 90);
  for (const entry of k.menu ?? []) {
    const recipe = RECIPE_BY_ID.get(entry.recipe);
    if (!recipe) continue;
    const discipline = disciplineOfRecipe(recipe.category);
    if (discipline) out[discipline] += worked;
  }
  return out;
}

/** Which discipline a recipe category belongs to. */
export function disciplineOfRecipe(category: string): Discipline | null {
  if (category === "dessert") return "pastry";
  if (category === "starter") return "garde";
  if (category === "main") return "saucier";
  if (category === "side") return "garde";
  return null;
}

/* -------------------------------------------------------------- the effects */

/** Every technique the kitchen holds in one discipline. */
export const inDiscipline = (k: KitchenState, d: Discipline): Technique[] =>
  learnedTechniques(k).filter((t) => t.discipline === d);

/**
 * What the chef's technique adds to a dish.
 *
 * Only the discipline the dish belongs to counts, which is the whole point of
 * having disciplines: a saucier's kitchen does not plate a better tart.
 */
export function techniqueLift(k: KitchenState, category: string): number {
  const d = disciplineOfRecipe(category);
  if (!d) return 0;
  return inDiscipline(k, d).reduce((n, t) => n + t.lift, 0);
}

/** Share of waste recovered by technique, capped so it can never be free. */
export const techniqueYield = (k: KitchenState): number =>
  Math.min(0.4, learnedTechniques(k).reduce((n, t) => n + (t.yield ?? 0), 0));

/**
 * What technique adds to the value of a cover.
 *
 * Deliberately small, and capped low.
 *
 * Technique already pays three times over: it lifts the plate, which lifts
 * the reviews, which fills the room; it takes real money off the waste line;
 * and it opens dishes that could not be cooked at all. A *fourth* payment as
 * a flat multiplier on every cover is how this was first written, at up to
 * +55%, and the city harness showed what that does — an ambitious kitchen
 * ended a hundred and twenty weeks three and a half million ahead of a plain
 * one, which is not a trade, it is a printing press.
 *
 * What survives is the honest part: petits fours with the coffee and a
 * properly aged rib do make an evening worth a little more. A little.
 */
export const techniqueWorth = (k: KitchenState): number =>
  1 + Math.min(0.18, learnedTechniques(k).reduce((n, t) => n + (t.worth ?? 0), 0));

/** Ingredients the kitchen is not yet able to handle. */
export function cannotHandle(k: KitchenState, ingredient: string): boolean {
  const gate = TECHNIQUES.find((t) => (t.handles ?? []).includes(ingredient));
  return gate ? !knowsTechnique(k, gate.id) : false;
}

/** The technique that would open an ingredient up, for the blocked message. */
export const handlerFor = (ingredient: string): Technique | null =>
  TECHNIQUES.find((t) => (t.handles ?? []).includes(ingredient)) ?? null;

/** Recipes a technique has opened, for the develop screen's gate. */
export function techniqueUnlocks(k: KitchenState, recipe: string): boolean {
  const gate = TECHNIQUES.find((t) => (t.unlocks ?? []).includes(recipe));
  return gate ? knowsTechnique(k, gate.id) : true;
}

export const gateFor = (recipe: string): Technique | null =>
  TECHNIQUES.find((t) => (t.unlocks ?? []).includes(recipe)) ?? null;

/**
 * Precision and emulsion both make a kitchen make fewer mistakes.
 *
 * Returned as a multiplier on the error rate rather than a subtraction, so it
 * can never take mistakes to zero — a kitchen that cannot make a mistake is a
 * kitchen with no service pressure in it.
 */
export const techniqueSteadiness = (k: KitchenState): number =>
  (knowsTechnique(k, "precision") ? 0.82 : 1) *
  (knowsTechnique(k, "emulsion") ? 0.9 : 1);

/* ------------------------------------------------------------- the standing */

export interface Rank {
  id: string;
  label: string;
  /** What this means in the trade. */
  blurb: string;
  /** Points needed. See `rankScore`. */
  at: number;
}

/**
 * What other chefs think you are.
 *
 * Deliberately not a title you buy: it is computed from what you have
 * actually done — techniques learned, stars held, the room you run, the
 * signature you earned — and it gates who will work for you, which kitchens
 * will take you for a stage, and which offers get made.
 */
export const RANKS: Rank[] = [
  {
    id: "unknown",
    label: "Nobody in particular",
    blurb: "You cook. Outside this street, that is all anybody knows.",
    at: 0,
  },
  {
    id: "working",
    label: "A working chef",
    blurb: "You are on the list of people who can be rung on a Friday.",
    at: 18,
  },
  {
    id: "patron",
    label: "Chef-patron",
    blurb: "Your own room, your own menu, and your name is on both.",
    at: 40,
  },
  {
    id: "known",
    label: "A name other chefs know",
    blurb: "People who cook for a living have eaten your food on purpose.",
    at: 66,
  },
  {
    id: "serious",
    label: "One of the serious ones",
    blurb: "Young cooks write to you asking for a stage. Some of them are good.",
    at: 92,
  },
  {
    id: "great",
    label: "One of the best in the country",
    blurb:
      "The kind of kitchen people plan a journey around. Every service is now a promise.",
    at: 124,
  },
];

/**
 * The score behind the rank.
 *
 * Four things, and all four are earned rather than bought: what you can do,
 * what the guide thinks, what you built, and whether the city has a dish it
 * associates with you.
 */
export function rankScore(k: KitchenState, reputation: number): number {
  const techniques = learnedTechniques(k).length * 6;
  const stars = (k.stars ?? 0) * 16;
  const room = ["stall", "bistro", "restaurant", "flagship", "destination"].indexOf(
    premisesOf(k).id,
  );
  const signature = knownRecipes(k).some((p) => p.signature) ? 10 : 0;
  return (
    techniques + stars + Math.max(0, room) * 7 + signature + reputation * 0.28
  );
}

export function chefRank(k: KitchenState, reputation: number): Rank {
  const score = rankScore(k, reputation);
  let best = RANKS[0];
  for (const rank of RANKS) if (score >= rank.at) best = rank;
  return best;
}

/** How far to the next one, for the screen. Null at the top. */
export function nextRank(
  k: KitchenState,
  reputation: number,
): { rank: Rank; short: number } | null {
  const score = rankScore(k, reputation);
  const next = RANKS.find((r) => r.at > score);
  return next ? { rank: next, short: Math.ceil(next.at - score) } : null;
}

export const rankIndex = (k: KitchenState, reputation: number): number =>
  RANKS.findIndex((r) => r.id === chefRank(k, reputation).id);

/* ----------------------------------------------------------------- stages */

/**
 * A week in somebody else's kitchen.
 *
 * Unpaid, exhausting, and the fastest way to learn anything — which is
 * exactly what a stage is. The kitchens that will have you depend on your
 * rank, so this is a ladder rather than a shop: the three-star kitchen does
 * not answer a stall-holder's letter.
 */
export interface Stage {
  id: string;
  label: string;
  city: string;
  blurb: string;
  /** Rank index required to be accepted at all. */
  needsRank: number;
  /** What it costs to go — travel, and a week not earning. */
  cost: number;
  /** Practice points, spread across the discipline it is famous for. */
  points: number;
  discipline: Discipline;
  /** Burnout it adds. A stage is not a holiday. */
  burnout: number;
}

export const STAGES: Stage[] = [
  {
    id: "market_butcher",
    label: "A week with the market butcher",
    city: "Lyon",
    blurb:
      "Six mornings behind the block with somebody who has done it for forty years.",
    needsRank: 0,
    cost: 900,
    /*
     * Enough to finish the discipline's cheapest technique, and that is the
     * rule for every stage on this list rather than a coincidence: a week
     * away that leaves five bars at 85% is a week that taught you nothing you
     * can use on Monday.
     */
    points: 40,
    discipline: "butchery",
    burnout: 6,
  },
  {
    id: "bakery",
    label: "Nights at the bakery",
    city: "Milan",
    blurb: "Eleven at night to seven in the morning, and everything is timing.",
    needsRank: 0,
    cost: 1_100,
    points: 36,
    discipline: "pastry",
    burnout: 8,
  },
  {
    id: "brasserie",
    label: "The sauce section at a brasserie",
    city: "Paris",
    blurb: "Four hundred covers a night, and one person on every sauce.",
    needsRank: 1,
    cost: 2_200,
    points: 44,
    discipline: "saucier",
    burnout: 10,
  },
  {
    id: "nordic",
    label: "A season in a fermentation cellar",
    city: "Copenhagen",
    blurb:
      "A room of jars, a notebook, and somebody who genuinely wants to explain them.",
    needsRank: 2,
    cost: 4_800,
    points: 52,
    discipline: "garde",
    burnout: 7,
  },
  {
    id: "three_star",
    label: "A stage at a three-star kitchen",
    city: "Tokyo",
    blurb:
      "You will do one job for six days and it will change how you think about all of them.",
    needsRank: 3,
    cost: 9_500,
    points: 70,
    discipline: "modern",
    burnout: 14,
  },
];

export const STAGE_BY_ID = new Map(STAGES.map((s) => [s.id, s]));

/** Why a stage is not available, in the player's words. */
export function stageBlocker(
  stage: Stage,
  k: KitchenState,
  reputation: number,
  done: string[],
): string | null {
  if (done.includes(stage.id)) return "You have done this one already";
  const rank = rankIndex(k, reputation);
  if (rank < stage.needsRank) {
    return `Requires ${RANKS[stage.needsRank].label.toLowerCase()} at least — they will not have you yet`;
  }
  return null;
}

/**
 * Where a stage's points go.
 *
 * Into the *cheapest unlearned technique* of its discipline first, so a stage
 * always finishes something rather than leaving five bars at 60%. Returns
 * what was learned, so the week can say so.
 */
export function applyStage(k: KitchenState, stage: Stage): Technique[] {
  let left = stage.points;
  const learned: Technique[] = [];
  const order = TECHNIQUES.filter((t) => t.discipline === stage.discipline).sort(
    (a, b) => a.cost - b.cost,
  );
  for (const t of order) {
    if (left <= 0) break;
    if (knowsTechnique(k, t.id) || !canLearn(k, t)) continue;
    const before = progressOf(k)[t.id] ?? 0;
    const need = t.cost - before;
    const give = Math.min(need, left);
    const out = practise(k, t.id, give);
    left -= give;
    if (out.learned && out.technique) learned.push(out.technique);
  }
  return learned;
}
