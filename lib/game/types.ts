/**
 * Career-agnostic game contract.
 *
 * The engine knows nothing about medicine, cooking or law. It knows how to:
 *   - hand the player a budget of time blocks each week,
 *   - let them spend those blocks on the career's actions,
 *   - ask the career to resolve the week,
 *   - roll the career's events,
 *   - ask the career whether the run is over.
 *
 * Everything that makes a Doctor run feel different from a Chef run lives in a
 * CareerDef. That is the whole point of the design: careers are not reskins,
 * they own their own resources, their own failure modes and their own maths.
 */

import type { PersonState, PersonDef } from "./people";
import type { TimelineEntry } from "./timeline";
import type { PendingConsequence } from "./consequences";
import type { RepChange } from "./reputation";
import type { RivalState } from "./rivals";
import type { ActiveContract, ContractOffer, ContractRecord } from "./contracts";
import type { Obligation } from "./finance";
import type { NewsItem } from "./news";
import type { ActiveCrisis } from "./crisis";
import type { ActiveSetback, SetbackKind } from "./setbacks";
import type { AmbitionId } from "./ambitions";
import type { ArchivedCareer, LegacyGrant } from "./retirement";
import type { BackgroundId } from "./backgrounds";
import type { TraitId } from "./traits";

/** A numeric value tracked across the run. Careers declare their own set. */
export interface ResourceDef {
  id: string;
  label: string;
  /** Short line shown in the tooltip / ledger. */
  hint: string;
  format: "money" | "percent" | "int";
  min?: number;
  max?: number;
  /** Which direction is bad, for colouring the meter. */
  polarity: "higher-better" | "lower-better" | "neutral";
  /**
   * Meters render as a bar, stats as a number, and `hidden` not at all in the
   * generic list — for values that have a panel of their own and would be
   * duplicated, not clarified, by also appearing as a nameless meter.
   */
  display: "meter" | "stat" | "hidden";
}

/** One spendable block of the player's week. */
export interface ActionDef {
  id: string;
  label: string;
  /** One line describing the fantasy, not the numbers. */
  blurb: string;
  /** Time blocks consumed per unit allocated. Almost always 1. */
  timeCost: number;
  /** Cash charged per unit allocated (can be 0). */
  cashCost: number;
  /** Hard cap on units per week, if the fiction demands one. */
  maxPerWeek?: number;
  /** Hidden until this predicate passes. */
  unlocked?: (s: RunState) => boolean;
  /** Human-readable per-unit effect list, shown before committing. */
  preview: (s: RunState) => string[];
}

/** Player-facing choice raised by an event. */
export interface EventChoice {
  label: string;
  /** Shown under the button, e.g. "Pay $12,000". */
  detail: string;
  affordable?: (s: RunState) => boolean;
  apply: (s: RunState, rng: Rng) => string;
}

export interface GameEventDef {
  id: string;
  title: string;
  /** Flavour text. Supports {tokens} filled from state by the engine. */
  body: (s: RunState) => string;
  /** Relative weight once eligible. */
  weight: (s: RunState) => number;
  /** Gate: only rolls when true. */
  eligible: (s: RunState) => boolean;
  /** Do not fire again within this many weeks. */
  cooldown: number;
  choices: EventChoice[];
  tone: "bad" | "good" | "neutral";
  /**
   * Fires at most once in a run, whatever the cooldown says.
   *
   * The cooldown mechanism cannot express this: a 999-week cooldown reads as
   * a tuning number, and the engine would still have to special-case it. This
   * is what the opening beat of a chain almost always wants — the offer that
   * defines a storyline should not be made twice.
   */
  once?: boolean;
  /**
   * Which storyline this belongs to. Two events in the same chain never
   * compete in the same roll, so a chain reads as a sequence rather than as
   * two unrelated things arriving together.
   */
  chain?: string;
  /**
   * A follow-up rather than an opening: excluded from the ordinary weighted
   * roll and fired only when a delayed consequence calls for it by id.
   *
   * Without this a scheduled follow-up would also be sitting in the random
   * pool, and the player could receive the sequel before the original.
   */
  followUp?: boolean;
}

export type RunOutcome = {
  kind: "won" | "lost";
  title: string;
  body: string;
};

/**
 * WHERE A RUN CAN BEGIN
 *
 * A career that offers more than one of these lets the player choose the city
 * before week one. It is not a skin: the career applies the choice to its own
 * state in `applyStartCity`, and from then on the city is that career's
 * business — the engine never reads it again.
 *
 * `effects` is the contract with the player. Every line in it has to be
 * something the simulation actually does, because a card that promises a
 * cheaper market and changes nothing is the placeholder mechanic this codebase
 * refuses to ship.
 */
export interface StartCity {
  id: string;
  name: string;
  country: string;
  /** Key into the projected map positions, so the picker can draw it. */
  position: string;
  /** What this place is, in one line. */
  blurb: string;
  /** What choosing it changes, stated as the player will feel it. */
  effects: string[];
  /** Named honestly. A hard start is a hard start. */
  difficulty: "gentle" | "even" | "hard";
}

export interface CareerDef {
  id: string;
  label: string;
  /** One-sentence pitch on the career select screen. */
  tagline: string;
  /** What makes this career mechanically different. Sells the run. */
  distinctRule: string;
  icon: string;
  available: boolean;
  /**
   * The horizon the career's stated objective is pitched at, in weeks.
   *
   * It used to be the week the run was force-ended on. Nothing terminates a
   * run any more, so this is now only a yardstick: "a strong three years"
   * rather than a deadline. Nothing in the engine reads it.
   */
  weekLimit: number;
  /** Time blocks granted per week, may vary with state. */
  timeBudget: (s: RunState) => number;
  resources: ResourceDef[];
  actions: ActionDef[];
  events: GameEventDef[];
  /** Fresh resource bag at week 1. */
  initialResources: () => Record<string, number>;
  /**
   * Structured state a career needs beyond flat numbers — rosters, owned
   * buildings, unlocked departments. Lives on RunState.data.
   */
  initialData: () => Record<string, unknown>;
  /**
   * The places this career can start in. The first is the default, and a
   * career that omits this starts in the one place it has always started in.
   */
  startCities?: StartCity[];
  /**
   * Apply the chosen start city to the career's own state, once, at week one.
   *
   * Called by `startRun` after `initialData` and before backgrounds and
   * legacies, so where you are is true before anything is added on top of it.
   * Must be deterministic and must not touch the RNG: two runs on the same
   * seed and the same city are the same run.
   */
  applyStartCity?: (s: RunState, cityId: string) => void;
  /**
   * Career-specific commands dispatched from its own UI (hire, buy a
   * facility, open a department, set a policy). The engine clones state
   * first, so implementations mutate freely and return nothing.
   */
  command?: (s: RunState, cmd: string, arg: string) => void;
  /**
   * The recurring characters this career ships with.
   *
   * Read once at `startRun` and again on migration, so a save written before
   * a person existed gains them at their starting standing rather than being
   * rejected. Omitting it gives a career with no cast, which is the correct
   * state for one that has not been written yet.
   */
  cast?: PersonDef[];
  /** Applied once per allocated unit of an action, before weekly upkeep. */
  applyAction: (s: RunState, actionId: string, rng: Rng) => void;
  /**
   * Resolve one delayed consequence that has come due.
   *
   * Returns a line for the week's log, or the id of a follow-up event to
   * raise instead. Returning nothing means the consequence fizzled, which is
   * a legitimate result — a threat that did not materialise because the state
   * it depended on changed is better fiction than one that fires regardless.
   */
  resolvePending?: (
    s: RunState,
    p: PendingConsequence,
    rng: Rng,
  ) => { log?: string; raiseEvent?: string } | void;
  /** Passive weekly maths: income, payroll, interest, drift, attrition. */
  resolveWeek: (s: RunState, rng: Rng) => LedgerLine[];
  /**
   * Serious trouble the run has fallen into this week.
   *
   * Replaces `checkOutcome`. The contract is deliberately different: a career
   * returns the KINDS of setback that now apply, and the engine turns them
   * into recoverable states. There is no return value that ends a run,
   * because there is no longer any such thing.
   */
  checkSetbacks?: (s: RunState) => SetbackKind[];
  /**
   * Validates this career's own slice of `RunState.data` when a save is
   * loaded, against whatever catalogues the career was written from.
   *
   * The engine's validator checks the engine's shape and delegates here, so
   * career state stays the career's business. Omitting the hook accepts the
   * slice — the right default while a career's shape is still moving, and a
   * deliberate choice rather than an oversight for one that has settled.
   */
  validateData?: (data: unknown) => boolean;
  /** Headline number shown in the top bar, e.g. net worth. */
  scoreboard: (s: RunState) => { label: string; value: string; sub: string };
  /**
   * Live read-out of what the current allocation would do, shown before the
   * player commits. Careers decide what matters enough to forecast — this is
   * how a player learns the career's binding constraint without a manual.
   */
  briefing: (
    s: RunState,
    alloc: Record<string, number>,
  ) => { label: string; value: string; tone: "good" | "bad" | "neutral"; note?: string }[];
  /** Objective text shown on the goal card. */
  objective: (s: RunState) => { text: string; progress: number };
}

/** A single line in the end-of-week ledger. */
export interface LedgerLine {
  label: string;
  amount?: number;
  note?: string;
  kind: "income" | "expense" | "info";
}

/**
 * One resolved week, kept so the run can show a trend rather than a single
 * number. Career-agnostic on purpose: the net is the sum of that week's
 * ledger, which every career produces.
 */
export interface WeekSummary {
  week: number;
  net: number;
}

export interface RunState {
  careerId: string;
  week: number;
  /** The career's own resource bag. */
  r: Record<string, number>;
  /** Structured career state (rosters, buildings, unlocks). */
  data: Record<string, unknown>;
  /** Counts of each upgrade owned. */
  owned: Record<string, number>;
  /** Week number each event last fired, for cooldowns. */
  eventHistory: Record<string, number>;
  /** Accumulated narrative log, newest first. */
  log: LogEntry[];
  /** Resolved weeks, oldest first, for the trend read-out. */
  history: WeekSummary[];
  /**
   * Recurring characters and where you stand with them.
   *
   * Engine-level rather than career-level: the model is the same whoever the
   * people are, and an event in any career needs to be able to ask "does she
   * still trust me" without going through that career's own state shape.
   *
   * Optional in the type because a save written before this existed has no
   * such field; `migrateRun` fills it, and every reader tolerates undefined so
   * a partially-migrated object can never crash a render.
   */
  people?: PersonState[];
  /** Milestones that actually happened, oldest first. */
  timeline?: TimelineEntry[];
  /** Decisions that have not finished happening yet. */
  pending?: PendingConsequence[];
  /** Why each reputation category moved, newest first. */
  repLog?: RepChange[];

  /* ------------------------------------------------------------ phase 2
   *
   * All optional, all filled by `migrateRun`, all bounded. The same
   * discipline as Phase 1: a reader that tolerates undefined can never crash
   * a render on a partially-migrated object, and a bounded array can never
   * grow a 156-week save without limit.
   */

  /** Other people's careers, running beside yours. */
  rivals?: RivalState[];
  /** Work on the table. */
  offers?: ContractOffer[];
  /** Work you took. */
  contracts?: ActiveContract[];
  /** Work you finished, won or lost. */
  contractLog?: ContractRecord[];
  /** Money you raised, and what it costs. */
  obligations?: Obligation[];
  /** The world, reported. Only items with real effects live here. */
  news?: NewsItem[];
  /** Bad weeks that are still running. */
  crises?: ActiveCrisis[];

  /* ------------------------------------------------------------ phase 3
   *
   * The sandbox layer. Nothing here can end a run: `outcome` is now written
   * in exactly one place, by `retire`, after a confirmation the player could
   * have cancelled.
   */

  /** Serious, recoverable failures currently in force. */
  setbacks?: ActiveSetback[];
  /** Kinds already climbed out of, for the archive and the timeline. */
  setbacksSurvived?: SetbackKind[];
  /** The long-term goal the player chose, if any. */
  ambition?: AmbitionId | null;
  ambitionsDone?: AmbitionId[];
  /** Where this character came from. Fixed at startRun. */
  background?: BackgroundId;
  /**
   * Which city the run began in, recorded the way `background` is.
   *
   * The career already holds the city in its own state — that copy is what
   * the simulation reads. This one is the record of the *choice*, so a
   * restart can offer the same start, and so a save can say where it began
   * without the engine having to understand any career's data.
   */
  startCity?: string;
  /** Personality. Two from the background, the rest earned by behaviour. */
  traits?: TraitId[];
  /** What a previous character passed on, applied once at startRun. */
  legacy?: LegacyGrant | null;
  /** True once the player has chosen to retire. Never set by the simulation. */
  retired?: boolean;
  outcome: RunOutcome | null;
  seed: number;
}

/**
 * Characters the player has retired.
 *
 * Stored under its own key rather than inside a run, because it outlives every
 * run and a new character must be able to read it before one exists.
 */
export interface CareerArchive {
  characters: ArchivedCareer[];
}

export interface LogEntry {
  week: number;
  text: string;
  tone: "bad" | "good" | "neutral";
}

/** Seeded RNG so a run is reproducible from its seed. */
export interface Rng {
  next: () => number;
  int: (min: number, max: number) => number;
  chance: (p: number) => boolean;
  pick: <T>(items: T[]) => T;
}
