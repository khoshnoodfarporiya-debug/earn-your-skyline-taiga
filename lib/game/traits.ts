import type { RunState } from "./types";

/**
 * PERSONALITY
 *
 * Who you turned out to be, mostly decided by what you kept doing.
 *
 * ------------------------------------------------- the anti-min-max rule
 *
 * The brief is explicit that players must not be able to switch personality
 * whenever a different bonus is convenient, and that is enforced structurally
 * rather than by a cooldown:
 *
 *   - Two traits come from your background and are **fixed for the run**.
 *   - Every other trait is *earned* by a counter that only the simulation
 *     increments, from actions you actually took, over many weeks.
 *   - Nothing removes a trait. You do not stop being ruthless because it
 *     became inconvenient.
 *   - `TRAIT_CAP` limits how many you can hold, so becoming everything is not
 *     a strategy. Once full, later traits simply do not arrive.
 *
 * The result is that personality is a *readout of your play*, and the options
 * it unlocks arrive because you already behaved that way — not because you
 * bought them.
 */

export type TraitId =
  | "ambitious"
  | "charismatic"
  | "analytical"
  | "empathetic"
  | "creative"
  | "disciplined"
  | "ruthless"
  | "risktaker";

export const TRAIT_IDS: readonly TraitId[] = [
  "ambitious",
  "charismatic",
  "analytical",
  "empathetic",
  "creative",
  "disciplined",
  "ruthless",
  "risktaker",
];

/** Five is a person. Eight is a horoscope. */
export const TRAIT_CAP = 5;

export interface TraitDef {
  id: TraitId;
  label: string;
  blurb: string;
  /** What it opens. */
  unlocks: string;
  /** What it costs — every trait has one. */
  friction: string;
  /** How it is earned, in the player's words. */
  earnedBy: string;
  /** Counter that drives it, and the threshold. */
  counter: string;
  threshold: number;
}

export const TRAITS: TraitDef[] = [
  {
    id: "ambitious",
    label: "Ambitious",
    blurb: "You are not doing this to stay where you are.",
    unlocks: "Bigger contracts and expansions are offered to you sooner.",
    friction: "People who value steadiness read you as restless.",
    earnedBy: "Expanding, enrolling and taking on more, repeatedly.",
    counter: "_actAmbition",
    threshold: 14,
  },
  {
    id: "charismatic",
    label: "Charismatic",
    blurb: "Rooms go the way you want more often than they should.",
    unlocks: "Negotiation options, and warmer first impressions.",
    friction: "The analytical ones assume there is nothing underneath it.",
    earnedBy: "Networking, publishing, and time spent on people.",
    counter: "_actCharisma",
    threshold: 16,
  },
  {
    id: "analytical",
    label: "Analytical",
    blurb: "You would rather be right than quick.",
    unlocks: "Better outcomes on prepared work; you see the real numbers.",
    friction: "You are slower, and it costs you the opportunistic wins.",
    earnedBy: "Studying, auditing and preparing rather than improvising.",
    counter: "_actAnalysis",
    threshold: 16,
  },
  {
    id: "empathetic",
    label: "Empathetic",
    blurb: "You notice when someone is struggling, and you do something.",
    unlocks: "Staff stay; people tell you things before they become problems.",
    friction: "You carry other people's weeks as well as your own.",
    earnedBy: "Choosing people over margin, repeatedly.",
    counter: "_actEmpathy",
    threshold: 14,
  },
  {
    id: "creative",
    label: "Creative",
    blurb: "You keep doing the thing nobody asked for.",
    unlocks: "Novel options in events and assignments others do not get.",
    friction: "Institutions find you hard to place.",
    earnedBy: "Publishing, building and making things that did not exist.",
    counter: "_actCreative",
    threshold: 12,
  },
  {
    id: "disciplined",
    label: "Disciplined",
    blurb: "You do the boring part on the days you do not feel like it.",
    unlocks: "Burnout builds more slowly; fitness holds.",
    friction: "You are slow to seize a thing that needs seizing today.",
    earnedBy: "Rest, exercise and admin, week after week.",
    counter: "_actDiscipline",
    threshold: 20,
  },
  {
    id: "ruthless",
    label: "Ruthless",
    blurb: "You have found that you can do the necessary thing.",
    unlocks: "Options nobody else is offered, and margins nobody else gets.",
    friction: "Loyalty and ethics both drag. People watch what you do to others.",
    earnedBy: "Dismissals, grey work and choosing the money.",
    counter: "_actRuthless",
    threshold: 10,
  },
  {
    id: "risktaker",
    label: "Risk-taker",
    blurb: "You would rather find out.",
    unlocks: "Leverage, contested bids and the big swing.",
    friction: "Some of it does not come off, and it comes off in public.",
    earnedBy: "Borrowing, contesting and taking the harder assignment.",
    counter: "_actRisk",
    threshold: 12,
  },
];

export const TRAIT_BY_ID = new Map(TRAITS.map((t) => [t.id, t]));

export const hasTrait = (s: RunState, id: TraitId): boolean =>
  (s.traits ?? []).includes(id);

/**
 * Record a behaviour. Called from the places the behaviour actually happens —
 * `applyAction`, `command`, event choices — so the counters cannot be gamed
 * except by doing the thing.
 */
export function noteBehaviour(s: RunState, counter: string, n = 1): void {
  s.r[counter] = (s.r[counter] ?? 0) + n;
}

/**
 * Check whether any trait has been earned this week.
 *
 * Returns whatever arrived, for the timeline and the phone. Never removes.
 */
export function checkTraits(s: RunState): TraitDef[] {
  const held = new Set(s.traits ?? []);
  if (held.size >= TRAIT_CAP) return [];
  const gained: TraitDef[] = [];
  for (const t of TRAITS) {
    if (held.has(t.id)) continue;
    if ((s.r[t.counter] ?? 0) < t.threshold) continue;
    s.traits = [...(s.traits ?? []), t.id];
    held.add(t.id);
    gained.push(t);
    if (held.size >= TRAIT_CAP) break;
  }
  return gained;
}

/* ------------------------------------------------------- what they do */

/**
 * The mechanical effects, gathered here so the couplings are inspectable
 * rather than scattered. Every one has a matching downside somewhere in this
 * same function — a trait that is purely good is a stat, not a personality.
 */

/** Multiplier on burnout accumulation. */
export const burnoutFactor = (s: RunState): number =>
  (hasTrait(s, "disciplined") ? 0.88 : 1) *
  (hasTrait(s, "ambitious") ? 1.08 : 1) *
  (hasTrait(s, "empathetic") ? 1.06 : 1);

/** Added to how warmly people receive you. */
export const socialBonus = (s: RunState): number =>
  (hasTrait(s, "charismatic") ? 4 : 0) +
  (hasTrait(s, "empathetic") ? 3 : 0) -
  (hasTrait(s, "ruthless") ? 5 : 0) -
  (hasTrait(s, "analytical") ? 1 : 0);

/** Multiplier on prepared work — assignments, research, audits. */
export const preparationFactor = (s: RunState): number =>
  (hasTrait(s, "analytical") ? 1.12 : 1) * (hasTrait(s, "creative") ? 1.05 : 1);

/** Multiplier on opportunistic work — contested bids, snap decisions. */
export const opportunismFactor = (s: RunState): number =>
  (hasTrait(s, "risktaker") ? 1.12 : 1) *
  (hasTrait(s, "ruthless") ? 1.08 : 1) *
  (hasTrait(s, "analytical") ? 0.94 : 1);

/** Weekly drag on staff loyalty from how you are known to operate. */
export const loyaltyDrift = (s: RunState): number =>
  (hasTrait(s, "empathetic") ? 0.35 : 0) - (hasTrait(s, "ruthless") ? 0.45 : 0);

/** Weekly drag on ethical standing. */
export const ethicsDrift = (s: RunState): number =>
  -(hasTrait(s, "ruthless") ? 0.25 : 0);

/**
 * Whether a choice tagged for a trait is available.
 *
 * Used by events and assignments. A locked option is *shown* with its
 * requirement rather than hidden, so the player learns that personality is a
 * real gate and can see what a different run would have offered.
 */
export const allows = (s: RunState, required: TraitId | undefined): boolean =>
  !required || hasTrait(s, required);

/** How close the player is to each unearned trait, for the character screen. */
export function traitProgress(
  s: RunState,
): { def: TraitDef; held: boolean; progress: number }[] {
  return TRAITS.map((def) => ({
    def,
    held: hasTrait(s, def.id),
    progress: Math.min(1, (s.r[def.counter] ?? 0) / def.threshold),
  }));
}
