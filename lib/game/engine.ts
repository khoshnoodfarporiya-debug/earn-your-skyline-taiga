import type {
  CareerDef,
  GameEventDef,
  LedgerLine,
  RunState,
  Rng,
} from "./types";
import { makeRng, weekRng } from "./rng";
import { driftPeople, initialPerson } from "./people";
import { mark } from "./timeline";
import { takeDue } from "./consequences";
import {
  SETBACK_BLURB,
  SETBACK_LABEL,
  beginSetback,
  tickSetbacks,
} from "./setbacks";
import { checkTraits } from "./traits";
import { checkAmbition, type AmbitionId } from "./ambitions";
import { BACKGROUND_BY_ID, type BackgroundId } from "./backgrounds";
import type { TraitId } from "./traits";
import type { LegacyGrant } from "./retirement";
import { repKey } from "./reputation";

export type Allocation = Record<string, number>;

export interface WeekResult {
  state: RunState;
  ledger: LedgerLine[];
  event: { def: GameEventDef; body: string } | null;
}

/**
 * How a character begins.
 *
 * `background` and `legacy` are both optional and both applied exactly once,
 * here. Keeping them out of the weekly loop is what guarantees a background
 * cannot be re-triggered and a legacy cannot compound.
 */
export interface StartOptions {
  background?: BackgroundId;
  legacy?: LegacyGrant | null;
  ambition?: AmbitionId | null;
  /**
   * Where the run begins, for a career that offers a choice.
   *
   * An id the career does not know falls back to its default city rather than
   * throwing — this arrives from the UI and, one day, from a shared link.
   */
  city?: string;
}

export function startRun(
  career: CareerDef,
  seed = Date.now(),
  opts: StartOptions = {},
): RunState {
  const s: RunState = {
    careerId: career.id,
    week: 1,
    r: career.initialResources(),
    data: career.initialData(),
    owned: {},
    eventHistory: {},
    log: [
      {
        week: 1,
        text: `Week 1. ${career.tagline}`,
        tone: "neutral",
      },
    ],
    history: [],
    /*
     * Only the people who are already in your life.
     *
     * An `appears` gate exists so a partner or an investor turns up when the
     * run gives them a reason to; seeding the whole cast at week one would
     * have made those gates decorative, and put an investor in the contacts
     * of a one-room practice. The rest join through the career's weekly
     * arrival check.
     */
    people: [],
    timeline: [],
    pending: [],
    /*
     * Initialised here rather than lazily by the first `applyRep`.
     *
     * `validateRun` requires an array, and leaving it undefined meant a save
     * straight from `startRun` only validated once `migrateRun` had filled it
     * in — so any test calling the validator directly was passing vacuously.
     */
    repLog: [],
    /*
     * Phase 2's collections, initialised for the same reason `repLog` is: the
     * validator requires arrays, and leaving them undefined means a save
     * straight from `startRun` only validates after `migrateRun` has filled
     * them — which makes every direct-validator test pass vacuously. The v9
     * guard assertion caught exactly this at v10.
     *
     * The rivals themselves are seeded on the first resolved week rather than
     * here, so a career with no rival cast is simply a career without rivals.
     */
    rivals: [],
    offers: [],
    contracts: [],
    contractLog: [],
    obligations: [],
    news: [],
    crises: [],
    setbacks: [],
    setbacksSurvived: [],
    ambitionsDone: [],
    traits: [],
    retired: false,
    outcome: null,
    seed,
  };
  s.people = (career.cast ?? [])
    .filter((def) => !def.appears || def.appears(s))
    .map(initialPerson);
  mark(
    s,
    "start",
    "start",
    "You qualified",
    `${career.label}. ${career.tagline}`,
  );

  /* ------------------------------------------------------ start city */
  /*
   * Applied before the background and the legacy, because both of those add
   * to a starting position and the city is what that position *is*. A career
   * with one place skips this entirely, and an unrecognised id lands on the
   * career's default rather than leaving a run half-placed.
   */
  const cities = career.startCities ?? [];
  if (cities.length > 0) {
    const chosen = cities.find((c) => c.id === opts.city) ?? cities[0];
    s.startCity = chosen.id;
    career.applyStartCity?.(s, chosen.id);
    mark(
      s,
      "startcity",
      "start",
      `${chosen.name}, ${chosen.country}`,
      chosen.blurb,
    );
  }

  /* ------------------------------------------------------- background */
  const bg = opts.background ? BACKGROUND_BY_ID.get(opts.background) : undefined;
  if (bg) {
    s.background = bg.id;
    for (const [key, delta] of Object.entries(bg.resources)) {
      s.r[key] = (s.r[key] ?? 0) + delta;
    }
    /* Two traits are fixed by where you came from and are never removed.
       Everything else has to be earned — see traits.ts. */
    s.traits = [...bg.traits] as TraitId[];
    for (const r of bg.relationships) {
      const p = s.people?.find((x) => x.id === r.id);
      if (!p) continue;
      p.warmth = clamp(p.warmth + (r.warmth ?? 0), -100, 100);
      p.trust = clamp(p.trust + (r.trust ?? 0), 0, 100);
      p.respect = clamp(p.respect + (r.respect ?? 0), 0, 100);
    }
    mark(s, "background", "start", bg.label, bg.opening);
  }

  /* ---------------------------------------------------------- legacy */
  if (opts.legacy) {
    const g = opts.legacy;
    s.legacy = g;
    if (g.cash) s.r.cash += g.cash;
    if (g.rep) s.r[repKey(g.rep.id as never)] = (s.r[repKey(g.rep.id as never)] ?? 0) + g.rep.amount;
    if (g.resource) s.r[g.resource.id] = (s.r[g.resource.id] ?? 0) + g.resource.amount;
    if (g.personId && g.personBoost) {
      const p = s.people?.find((x) => x.id === g.personId);
      if (p) {
        p.warmth = clamp(p.warmth + g.personBoost.warmth, -100, 100);
        p.trust = clamp(p.trust + g.personBoost.trust, 0, 100);
        p.respect = clamp(p.respect + g.personBoost.respect, 0, 100);
      }
    }
    mark(s, "legacy", "start", `After ${g.fromName}`, g.note);
  }

  if (opts.ambition) s.ambition = opts.ambition;

  clampResources(career, s);
  return s;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));

export function clampResources(career: CareerDef, s: RunState) {
  // Every resource passes through here after every mutation, which makes it
  // the one place to stop a NaN or Infinity spreading. One bad divide would
  // otherwise poison the bag permanently and render the run as "NaN" with no
  // way back.
  for (const key of Object.keys(s.r)) {
    if (!Number.isFinite(s.r[key])) s.r[key] = 0;
  }
  for (const def of career.resources) {
    const v = s.r[def.id];
    if (v === undefined) continue;
    let next = v;
    if (def.min !== undefined) next = Math.max(def.min, next);
    if (def.max !== undefined) next = Math.min(def.max, next);
    s.r[def.id] = next;
  }
}

export function timeSpent(career: CareerDef, alloc: Allocation): number {
  return career.actions.reduce(
    (sum, a) => sum + (alloc[a.id] ?? 0) * a.timeCost,
    0,
  );
}

export function cashCommitted(career: CareerDef, alloc: Allocation): number {
  return career.actions.reduce(
    (sum, a) => sum + (alloc[a.id] ?? 0) * a.cashCost,
    0,
  );
}

/**
 * State is plain JSON — numbers, arrays, records — so structuredClone gives a
 * correct deep copy of `data` without the engine knowing its shape.
 */
function cloneState(s: RunState): RunState {
  return {
    ...s,
    r: { ...s.r },
    data: structuredClone(s.data),
    owned: { ...s.owned },
    eventHistory: { ...s.eventHistory },
    log: [...s.log],
    history: [...(s.history ?? [])],
    /* Deep, not spread: `touchPerson` mutates a person in place, and a shallow
       copy of the array would let a resolved week write back through into the
       state the caller still holds. That is exactly the isolation bug the
       command tests already guard for `data`. */
    people: structuredClone(s.people ?? []),
    timeline: [...(s.timeline ?? [])],
    pending: structuredClone(s.pending ?? []),
    /* Same reason as `people`: `tickSetbacks` mutates grip in place, and a
       shallow copy would write back through into the caller's state. */
    setbacks: structuredClone(s.setbacks ?? []),
    /*
     * And again, and this one was actually wrong until a second career got
     * crises and a test caught it: `crisisChoice` mutates severity, stage and
     * `taken` in place, so a shallow copy meant answering a crisis also
     * answered it in the state the caller still held. Two commands run against
     * the same state disagreed about which stage the crisis was on.
     */
    crises: structuredClone(s.crises ?? []),
    setbacksSurvived: [...(s.setbacksSurvived ?? [])],
    ambitionsDone: [...(s.ambitionsDone ?? [])],
    traits: [...(s.traits ?? [])],
  };
}

/** Dispatches a career-specific command (hire, buy, open, set policy). */
export function runCommand(
  career: CareerDef,
  state: RunState,
  cmd: string,
  arg: string,
): RunState {
  if (!career.command) return state;
  const s = cloneState(state);
  career.command(s, cmd, arg);
  clampResources(career, s);
  return s;
}

/**
 * Resolves one week.
 *
 * Order matters and is deliberate:
 *   1. action effects   — what the player chose to do with their time
 *   2. weekly upkeep    — the world charging rent regardless
 *   3. event roll       — drama, which can react to the post-upkeep state
 *   4. outcome check    — win/lose evaluated on the final numbers
 *
 * Putting events after upkeep means a player who is already underwater gets
 * the bad news in the same week, rather than a week late.
 */
export function advanceWeek(
  career: CareerDef,
  state: RunState,
  alloc: Allocation,
): WeekResult {
  const s = cloneState(state);
  const rng = weekRng(s.seed, s.week);

  /*
   * 0. What you already set in motion.
   *
   * Before the player's actions, so a follow-up lands on the week they are
   * about to plan around rather than a week after it mattered. Resolved from
   * a stream of its own: the queue length depends on choices the player made
   * weeks ago, so drawing from the week stream here would make every later
   * event in the run depend on how many consequences happened to be pending —
   * and the balance harness would stop measuring what it thinks it measures.
   */
  const dueRng = makeRng((s.seed ^ (s.week * 0x9e3779b1)) >>> 0);
  let raised: string | null = null;
  for (const p of takeDue(s)) {
    const out = career.resolvePending?.(s, p, dueRng);
    if (out?.log) pushLog(s, out.log, "neutral");
    if (out?.raiseEvent && !raised) raised = out.raiseEvent;
  }
  clampResources(career, s);

  // 1. Player actions.
  const actionCash = cashCommitted(career, alloc);
  s.r.cash -= actionCash;
  for (const action of career.actions) {
    const units = alloc[action.id] ?? 0;
    for (let i = 0; i < units; i++) career.applyAction(s, action.id, rng);
  }
  clampResources(career, s);

  // 2. The world's weekly maths.
  const ledger = career.resolveWeek(s, rng);
  if (actionCash > 0) {
    ledger.unshift({
      label: "Week's outlay",
      amount: -actionCash,
      kind: "expense",
    });
  }
  clampResources(career, s);

  // 3. Record the week. Done here rather than inside resolveWeek because the
  // outlay line is added above, so this is the first point the ledger is
  // complete and the net is the real one.
  s.history = [
    ...s.history,
    {
      week: s.week,
      net: ledger.reduce((sum, l) => sum + (l.amount ?? 0), 0),
    },
  ].slice(-MAX_HISTORY);

  // 4. People drift when you neglect them.
  driftPeople(s);

  /*
   * 4b. And people arrive when the run finally gives them a reason to.
   *
   * `PersonDef.appears` was evaluated once, at `startRun`, and never again —
   * so every gated cast member was written, documented as arriving later, and
   * then never arrived at all. The Physician's cast has said "an investor does
   * not call a one-room practice" since it was authored, and the investor
   * never called a practice of any size.
   *
   * Additive on purpose: somebody already in your life keeps the standing they
   * have earned. The only thing this can do is introduce somebody new.
   */
  for (const def of career.cast ?? []) {
    if (def.appears && !def.appears(s)) continue;
    if ((s.people ?? []).some((p) => p.id === def.id)) continue;
    s.people = [...(s.people ?? []), initialPerson(def)];
  }

  /*
   * 5. Events.
   *
   * A follow-up armed weeks ago outranks the random pool. Otherwise the
   * sequel to a decision would queue behind whatever the dice produced, and
   * the player would experience the chain out of order — which is the whole
   * thing this system exists to avoid.
   */
  const event = raised
    ? raiseEvent(career, s, raised)
    : rollEvent(career, s, rng);

  /*
   * 5. THE RUN DOES NOT END HERE.
   *
   * This block used to call `career.checkOutcome` and, failing that, compare
   * the week against `weekLimit` — four automatic terminators and a clock. All
   * of them are gone, and the deletion is the point rather than a side effect:
   * Earn Your Skyline is a sandbox, and the player decides when the story is
   * finished.
   *
   * What replaced them:
   *   - collapse / lost licence / insolvency  → recoverable setbacks
   *   - the net-worth goal                    → a milestone, then you continue
   *   - week 156                              → nothing at all
   *
   * `s.outcome` is still on the type and is still rendered, because retired
   * characters and old saves both use it. It is now written in exactly one
   * place — `retire()` — behind a confirmation the player could cancel.
   */
  s.week += 1;

  // Setbacks the career has decided the run has fallen into.
  for (const kind of career.checkSetbacks?.(s) ?? []) {
    const sb = beginSetback(s, kind);
    if (sb) {
      pushLog(s, SETBACK_BLURB[kind], "bad");
      mark(s, `setback-${kind}-${s.week}`, "failure", SETBACK_LABEL[kind], SETBACK_BLURB[kind]);
    }
  }

  // …and the ones being climbed out of.
  for (const cleared of tickSetbacks(s)) {
    s.setbacksSurvived = [
      ...new Set([...(s.setbacksSurvived ?? []), cleared.kind]),
    ];
    pushLog(s, `You are through the ${SETBACK_LABEL[cleared.kind].toLowerCase()}.`, "good");
    mark(
      s,
      `recovered-${cleared.kind}-${s.week}`,
      "recovery",
      `You came back from ${SETBACK_LABEL[cleared.kind].toLowerCase()}`,
      `${cleared.weeks} weeks, and you are still here.`,
    );
  }

  // Personality, earned rather than chosen.
  for (const t of checkTraits(s)) {
    pushLog(s, `People have started describing you as ${t.label.toLowerCase()}.`, "neutral");
    mark(s, `trait-${t.id}`, "people", `You became ${t.label.toLowerCase()}`, t.blurb);
  }

  // An ambition completing is a celebration, never a stop.
  const done = checkAmbition(s);
  if (done) {
    pushLog(s, `Ambition met: ${done.label.toLowerCase()}.`, "good");
    mark(s, `ambition-${done.id}`, "award", done.label, done.blurb);
  }

  return { state: s, ledger, event };
}

/** Fire a specific event by id, bypassing the weighted roll. */
function raiseEvent(
  career: CareerDef,
  s: RunState,
  id: string,
): { def: GameEventDef; body: string } | null {
  const def = career.events.find((e) => e.id === id);
  /* A save can outlive the event that scheduled its follow-up. Dropping it
     silently is correct: the alternative is crashing a run because a story
     beat was renamed. */
  if (!def) return null;
  s.eventHistory[def.id] = s.week;
  return { def, body: def.body(s) };
}

function rollEvent(
  career: CareerDef,
  s: RunState,
  rng: Rng,
): { def: GameEventDef; body: string } | null {
  /* Which storylines are already running. A chain gets one event at a time,
     so two beats of the same story never arrive in the same week. */
  const openChains = new Set(
    career.events
      .filter((e) => e.chain && s.eventHistory[e.id] !== undefined)
      .map((e) => e.chain as string),
  );

  const pool = career.events.filter((e) => {
    // Follow-ups are pulled by id, never rolled for.
    if (e.followUp) return false;
    const last = s.eventHistory[e.id];
    if (e.once && last !== undefined) return false;
    if (last !== undefined && s.week - last < e.cooldown) return false;
    if (e.chain && openChains.has(e.chain) && last === undefined) {
      /* Another beat of this story has already fired and this one has not:
         hold it back so the storyline stays a sequence. */
      return false;
    }
    return e.eligible(s);
  });
  if (pool.length === 0) return null;

  const weights = pool.map((e) => Math.max(0, e.weight(s)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  // A quiet week is a real outcome, not a gap. Weights are tuned so that the
  // pool total is the chance of *anything* happening, capped at 85%.
  const fireChance = Math.min(0.85, total);
  if (!rng.chance(fireChance)) return null;

  let roll = rng.next() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      const def = pool[i];
      s.eventHistory[def.id] = s.week;
      return { def, body: def.body(s) };
    }
  }
  return null;
}

export function resolveEventChoice(
  career: CareerDef,
  state: RunState,
  def: GameEventDef,
  choiceIndex: number,
): RunState {
  const s = cloneState(state);
  const choice = def.choices[choiceIndex];
  if (!choice) return s;
  const rng = makeRng((s.seed ^ (s.week * 7919) ^ choiceIndex) >>> 0);
  const result = choice.apply(s, rng);
  clampResources(career, s);
  s.log = [
    { week: s.week - 1, text: result, tone: def.tone },
    ...s.log,
  ].slice(0, MAX_LOG);
  /* An event choice can drop you into a setback — it cannot end the run.
     Same contract as `advanceWeek`, deliberately, so there is exactly one
     way into trouble and exactly one way out. */
  for (const kind of career.checkSetbacks?.(s) ?? []) {
    if (beginSetback(s, kind)) pushLog(s, SETBACK_BLURB[kind], "bad");
  }
  return s;
}

/**
 * The log is rendered in full on the end screen and persisted to
 * localStorage every week, so it has to stay bounded — a 156-week run with an
 * event most weeks would otherwise grow without limit.
 */
export const MAX_LOG = 120;

/**
 * Weekly summaries kept. A full run is 156 weeks and each entry is two
 * numbers, so this holds the whole run without meaningfully growing the save.
 */
export const MAX_HISTORY = 200;

export function pushLog(
  s: RunState,
  text: string,
  tone: "bad" | "good" | "neutral" = "neutral",
) {
  s.log = [{ week: s.week, text, tone }, ...s.log].slice(0, MAX_LOG);
}
