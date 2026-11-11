import type { RunState } from "./types";

/**
 * BACKGROUNDS
 *
 * Where you were before week one.
 *
 * The brief's constraint is the whole design here: these must not be difficulty
 * labels. So none of them is uniformly better than another — each moves at
 * least two numbers in opposite directions, changes who already knows you, and
 * carries its own small pool of situations that only happen to someone with
 * that history.
 *
 * The test I held them to: for every pair, there is a strategy where A is
 * clearly the better start and a different strategy where B is. A wealthy
 * family starts solvent and is distrusted by the people who did it the hard
 * way; an indebted graduate starts underwater and is believed instantly.
 */

export type BackgroundId =
  | "working"
  | "wealthy"
  | "international"
  | "prodigy"
  | "changer"
  | "creator"
  | "indebted";

export interface BackgroundDef {
  id: BackgroundId;
  label: string;
  /** Two sentences of who you were. */
  blurb: string;
  /** The single line naming what you get. */
  benefit: string;
  /** …and what it costs you. */
  cost: string;
  /** Resource deltas applied once at startRun, by resource id. */
  resources: Record<string, number>;
  /**
   * People who already have an opinion about you. Applied after the cast is
   * seeded, so a background can only adjust someone the career actually has.
   */
  relationships: { id: string; warmth?: number; trust?: number; respect?: number }[];
  /** Traits this background starts you with. */
  traits: string[];
  /** Line written into the timeline at week one. */
  opening: string;
  /** Event ids this background makes eligible. Career supplies the events. */
  events: string[];
}

export const BACKGROUNDS: BackgroundDef[] = [
  {
    id: "working",
    label: "Working-class family",
    blurb:
      "Nobody in your family had done this before. You were the first, and everyone knows it — including you, at three in the morning.",
    benefit: "People believe you have done the work, because you have.",
    cost: "No safety net. A bad quarter is a genuine emergency.",
    resources: { cash: -6_000, repEthics: 6, repPatients: 6, burnout: 4 },
    relationships: [{ id: "mbeki", warmth: 12, trust: 10 }],
    traits: ["disciplined"],
    opening:
      "First in the family to qualify. Nobody at home entirely understands the job, and all of them are proud of it.",
    events: ["bg.working.family", "bg.working.imposter"],
  },
  {
    id: "wealthy",
    label: "Wealthy family",
    blurb:
      "The fees were paid, the flat was bought, and the assumption that you would succeed was never once questioned in your hearing.",
    benefit: "You start solvent and can take a risk in week three.",
    cost: "Colleagues assume you were given it, and some of them are right.",
    resources: { cash: 55_000, debt: -60_000, repCredibilityPenalty: 0, reputation: -5 },
    relationships: [
      { id: "hallam", warmth: -8, respect: -10 },
      { id: "thorne", warmth: 15, trust: 10 },
    ],
    traits: ["ambitious"],
    opening:
      "The debt everyone else is carrying was settled before you qualified. It is not something you bring up.",
    events: ["bg.wealthy.expectation", "bg.wealthy.favour"],
  },
  {
    id: "international",
    label: "International student",
    blurb:
      "You trained a long way from where you grew up, in your second language, and paid the higher fees for the privilege.",
    benefit: "You start with a licence that travels and a wider view of the work.",
    cost: "You are starting again socially, and the paperwork never quite ends.",
    resources: { cash: -10_000, skill: 4, repInfluence: 6, repLoyalty: -4 },
    relationships: [{ id: "duarte", warmth: 10, trust: 8 }],
    traits: ["analytical"],
    opening:
      "Qualified abroad, converted the registration, and arrived knowing three people. Two of them have since moved.",
    events: ["bg.international.visa", "bg.international.home"],
  },
  {
    id: "prodigy",
    label: "Academic prodigy",
    blurb:
      "You were the best in your year and everybody told you so. It has not yet occurred to you that the job is mostly not an exam.",
    benefit: "Exceptional starting skill and credentials that open doors early.",
    cost: "People find you difficult, and you have never had to be liked.",
    resources: { skill: 12, cpd: 20, repInfluence: 8, repLoyalty: -10 },
    relationships: [
      { id: "hallam", respect: 15, warmth: -6 },
      { id: "okoro", warmth: -12, respect: 10 },
    ],
    traits: ["analytical", "ambitious"],
    opening:
      "Top of the year, a distinction, and a supervisor who wrote 'brilliant, and knows it' on your final report.",
    events: ["bg.prodigy.arrogance", "bg.prodigy.offer"],
  },
  {
    id: "changer",
    label: "Career changer",
    blurb:
      "You did something else for eight years first. You are older than the others in your cohort and considerably harder to rattle.",
    benefit: "You can run a business already, and nothing here frightens you.",
    cost: "Less clinical time than everyone your age, and you started late.",
    resources: {
      cash: 18_000,
      skill: -6,
      repLoyalty: 10,
      repInfluence: -6,
      burnout: -6,
    },
    relationships: [{ id: "lindqvist", warmth: 14, trust: 12, respect: 8 }],
    traits: ["disciplined", "empathetic"],
    opening:
      "Eight years in another industry before this one. It taught you how to read a P&L, which nobody else in your cohort can do.",
    events: ["bg.changer.previous", "bg.changer.age"],
  },
  {
    id: "creator",
    label: "Social-media personality",
    blurb:
      "You had an audience before you had a qualification. Some of the profession thinks that is a problem, and some of them are jealous.",
    benefit: "You start already known, and reach compounds fast.",
    cost: "The regulator is watching, and credibility must be earned twice.",
    resources: {
      repPopularity: 30,
      repInfluence: -8,
      reputation: -8,
      _followers: 18_000,
    },
    relationships: [
      { id: "raman", warmth: 10, trust: -6 },
      { id: "hallam", warmth: -12, respect: -12 },
    ],
    traits: ["charismatic", "creative"],
    opening:
      "Eighteen thousand people followed you here from a different kind of career. Your supervisor has mentioned it twice, neither time kindly.",
    events: ["bg.creator.scrutiny", "bg.creator.brand"],
  },
  {
    id: "indebted",
    label: "Heavily indebted graduate",
    blurb:
      "You did everything right and it cost more than it has ever cost anyone. The number does not feel real until the first payment leaves.",
    benefit: "You are relentless, and everyone can see why.",
    cost: "A very large debt, compounding from week one.",
    resources: { debt: 95_000, repPatients: 4, repEthics: 4, burnout: 6 },
    relationships: [{ id: "okoro", warmth: 8, trust: 6 }],
    traits: ["disciplined", "risktaker"],
    opening:
      "The largest student debt in your cohort, and a repayment schedule that assumes you will never take a month off.",
    events: ["bg.indebted.pressure", "bg.indebted.offer"],
  },
];

export const BACKGROUND_BY_ID = new Map(BACKGROUNDS.map((b) => [b.id, b]));

export const backgroundOf = (s: RunState): BackgroundDef | null =>
  s.background ? (BACKGROUND_BY_ID.get(s.background as BackgroundId) ?? null) : null;

/**
 * Whether a background-gated event may fire.
 *
 * The careers own the events themselves; this is the gate they consult, so a
 * background's pool cannot leak into a run that did not choose it.
 */
export const fromBackground = (s: RunState, eventId: string): boolean =>
  (backgroundOf(s)?.events ?? []).includes(eventId);
