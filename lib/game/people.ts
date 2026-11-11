import type { RunState } from "./types";

/**
 * PEOPLE
 *
 * A career is other people. The simulation already had staff — rows with a
 * salary and a skill number — but nobody the player would recognise a second
 * time, and nothing that remembered what the player did.
 *
 * This is the generic half: identity, standing, and memory. The *cast* is
 * career-specific and lives beside its career (`lib/game/medical/cast.ts`), so
 * Chef and Solicitor bring their own people to the same machinery.
 *
 * Three numbers, deliberately not one:
 *
 *   warmth   — do they like you. Moves easily, both ways.
 *   trust    — do they believe what you tell them. Slow to earn, fast to lose.
 *   respect  — do they rate you professionally. Earned by results, not warmth.
 *
 * They are separate because the interesting positions are the mixed ones: a
 * rival who respects you and does not like you is a different problem from a
 * friend who likes you and thinks you are careless.
 */

export type PersonRole =
  | "mentor"
  | "rival"
  | "manager"
  | "colleague"
  | "employee"
  | "partner"
  | "friend"
  | "romantic"
  | "journalist"
  | "investor";

export const PERSON_ROLES: readonly PersonRole[] = [
  "mentor",
  "rival",
  "manager",
  "colleague",
  "employee",
  "partner",
  "friend",
  "romantic",
  "journalist",
  "investor",
];

export type PersonStatus = "active" | "distant" | "estranged" | "gone";

export const PERSON_STATUSES: readonly PersonStatus[] = [
  "active",
  "distant",
  "estranged",
  "gone",
];

/**
 * A trait is a stable disposition that changes how someone reads the same
 * action. Authored, small, and readable — the player should be able to predict
 * a reaction once they know the person.
 */
export type PersonTrait =
  | "principled"
  | "ambitious"
  | "loyal"
  | "cynical"
  | "generous"
  | "proud"
  | "cautious"
  | "blunt";

export const PERSON_TRAITS: readonly PersonTrait[] = [
  "principled",
  "ambitious",
  "loyal",
  "cynical",
  "generous",
  "proud",
  "cautious",
  "blunt",
];

/** The persisted half. Authored detail is looked up from the career's cast. */
export interface PersonState {
  /** Stable across the whole run, and the key the cast is keyed by. */
  id: string;
  role: PersonRole;
  /**
   * Persisted rather than looked up from the cast, so `touchPerson` can apply
   * them without knowing which career it is inside. They never change during a
   * run, so the cost is a two-item array per person.
   */
  traits: PersonTrait[];
  /** −100 … 100. Negative is genuine hostility, not mere coolness. */
  warmth: number;
  /** 0 … 100. */
  trust: number;
  /** 0 … 100. */
  respect: number;
  status: PersonStatus;
  /**
   * What they remember. Flags are set by events and read by later events, so
   * a decision in week 12 can still be the reason someone refuses you in week
   * 80. Kept as a string list rather than a map because they are facts, not
   * counters, and a set of facts is trivially validated.
   */
  memory: string[];
  /** Week of the last interaction, for "you have not spoken since" lines. */
  lastSeen: number;
  /** Newest-first, capped — what the phone and the profile card show. */
  recent: PersonInteraction[];
}

export interface PersonInteraction {
  week: number;
  text: string;
  tone: "good" | "bad" | "neutral";
}

/** Kept small: this is persisted per person for the whole run. */
export const MAX_INTERACTIONS = 8;

/** Everything the cast author supplies. Never persisted. */
export interface PersonDef {
  id: string;
  name: string;
  /** Shown beside the name — "Consultant, Lyon", "Health correspondent". */
  title: string;
  role: PersonRole;
  traits: PersonTrait[];
  /** Two or three sentences. Who they are, not what they do for you. */
  bio: string;
  /** Deterministic avatar seed — see `initialsOf` / `hueOf`. */
  handle: string;
  /** Starting standing, before anything has happened. */
  start: { warmth: number; trust: number; respect: number };
  /** Only appears once this is true; absent means from week one. */
  appears?: (s: RunState) => boolean;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

export function initialPerson(def: PersonDef): PersonState {
  return {
    id: def.id,
    role: def.role,
    traits: [...def.traits],
    warmth: def.start.warmth,
    trust: def.start.trust,
    respect: def.start.respect,
    status: "active",
    memory: [],
    lastSeen: 0,
    recent: [],
  };
}

export const personIn = (s: RunState, id: string): PersonState | undefined =>
  s.people?.find((p) => p.id === id);

export const remembers = (s: RunState, id: string, flag: string): boolean =>
  personIn(s, id)?.memory.includes(flag) ?? false;

/**
 * Anyone at all who remembers this — used by events that should fire once the
 * profession knows, whoever told them.
 */
export const anyoneRemembers = (s: RunState, flag: string): boolean =>
  (s.people ?? []).some((p) => p.memory.includes(flag));

export interface PersonDelta {
  warmth?: number;
  trust?: number;
  respect?: number;
  /** Facts to remember. Duplicates are ignored. */
  remember?: string[];
  status?: PersonStatus;
}

/**
 * Move someone's standing and record why.
 *
 * The `why` line is not decoration: the brief for this system is that the
 * player can always tell what changed a relationship, and a silent number is
 * how a simulation stops being legible. It is what the phone and the person's
 * card both read back.
 *
 * Traits are applied here rather than at every call site, so an author writing
 * an event says "this is a −8 warmth thing" once and the principled colleague
 * and the cynical one diverge on their own.
 */
export function touchPerson(
  s: RunState,
  id: string,
  delta: PersonDelta,
  why: string,
  tone: "good" | "bad" | "neutral" = "neutral",
): void {
  const p = personIn(s, id);
  if (!p) return;
  if (p.status === "gone") return;

  const scale = traitScale(p, delta);
  if (delta.warmth) p.warmth = clamp(p.warmth + delta.warmth * scale, -100, 100);
  if (delta.trust) p.trust = clamp(p.trust + delta.trust * scale, 0, 100);
  if (delta.respect) p.respect = clamp(p.respect + delta.respect * scale, 0, 100);

  for (const flag of delta.remember ?? []) {
    if (!p.memory.includes(flag)) p.memory.push(flag);
  }
  if (delta.status) p.status = delta.status;

  p.lastSeen = s.week;
  p.recent = [{ week: s.week, text: why, tone }, ...p.recent].slice(
    0,
    MAX_INTERACTIONS,
  );

  /* Standing decides whether they are still in your life. Estrangement is a
     consequence you can walk into, not a button — and it is recoverable,
     which is why "gone" is only ever set explicitly by an event. */
  if (p.status !== "gone") {
    p.status =
      p.warmth <= -45 ? "estranged" : p.warmth <= -10 ? "distant" : "active";
  }
}

/**
 * How much harder a given change lands on this person.
 *
 * Deliberately mild — 0.7 to 1.35 — because the point is that people differ,
 * not that trait selection is the real game. A proud person takes a slight
 * badly; a loyal one forgives; a cynic was never surprised.
 */
function traitScale(p: PersonState, delta: PersonDelta): number {
  const bad = (delta.warmth ?? 0) < 0 || (delta.trust ?? 0) < 0;
  let scale = 1;
  if (p.role === "rival") scale *= 0.9;
  for (const t of p.traits ?? []) {
    if (t === "proud" && bad) scale *= 1.35;
    if (t === "loyal" && bad) scale *= 0.7;
    if (t === "cynical") scale *= 0.85;
    if (t === "generous" && !bad) scale *= 1.2;
  }
  return scale;
}

/** Weekly drift: standing decays toward neutral if you never speak. */
export function driftPeople(s: RunState): void {
  for (const p of s.people ?? []) {
    if (p.status === "gone") continue;
    const silence = s.week - p.lastSeen;
    if (silence < 8) continue;
    /* Slow, and it never reaches zero on its own. Neglect cools a
       relationship; it does not manufacture hostility. */
    if (p.warmth > 0) p.warmth = Math.max(0, p.warmth - 0.35);
    if (p.trust > 50) p.trust = Math.max(50, p.trust - 0.2);
  }
}

/* ------------------------------------------------------------- avatars */

/** Two letters, deterministic, no image required. */
export function initialsOf(name: string): string {
  const parts = name.replace(/^(Dr|Prof|Mr|Ms|Mrs)\.?\s+/i, "").split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * A stable hue per person, so the same character is the same colour every
 * time you see them without shipping twelve portraits. Same trick the phone
 * already uses for its accounts.
 */
export function hueOf(handle: string): number {
  let h = 0;
  for (let i = 0; i < handle.length; i++) {
    h = (h * 31 + handle.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/** How the relationship should be described in one word. */
export function standingOf(p: PersonState): string {
  if (p.status === "gone") return "Gone";
  if (p.status === "estranged") return "Estranged";
  if (p.warmth >= 60) return "Close";
  if (p.warmth >= 25) return "Warm";
  if (p.warmth >= -10) return "Cordial";
  return "Cool";
}
