import type { Rng, RunState } from "./types";

/**
 * ASSIGNMENTS
 *
 * Work you take on that is not the weekly caseload: a named piece of work with
 * a deadline, a client, a way of going wrong, and somebody else who wanted it.
 *
 * ------------------------------------------------- what stops this being a button
 *
 * The failure mode the brief names — click, receive random money — is avoided
 * by four things, and all four have to be present or it collapses back into a
 * slot machine:
 *
 *   1. **You have to be offered it.** `requires` reads real state: standing,
 *      departments, equipment, staff, city, relationships. Half the catalogue
 *      is invisible to a one-room practice.
 *   2. **You have to win it.** Rivals bid. Your bid is your credentials, not a
 *      die roll, and losing is the common outcome early on.
 *   3. **You have to work it.** Progress costs planner blocks across several
 *      weeks. A contract you accept and ignore fails on its deadline.
 *   4. **It can turn.** Complications fire mid-run and change the terms —
 *      usually for the worse, always for a reason you can see.
 *
 * The outcome is then a *margin*, not a coin flip: preparation, skill, the
 * staff you assigned, your energy, the city and your standing all sum into a
 * score against the contract's difficulty. A well-prepared player fails
 * rarely; an over-reaching one fails often; nobody is guaranteed either way.
 */

export type ContractKind =
  | "routine"
  | "specialist"
  | "vip"
  | "research"
  | "public"
  | "emergency"
  | "grey"
  | "institutional";

export const CONTRACT_KINDS: readonly ContractKind[] = [
  "routine",
  "specialist",
  "vip",
  "research",
  "public",
  "emergency",
  "grey",
  "institutional",
];

export const KIND_WORD: Record<ContractKind, string> = {
  routine: "Routine",
  specialist: "Specialist",
  vip: "Private client",
  research: "Research",
  public: "Public health",
  emergency: "Emergency",
  grey: "Questionable",
  institutional: "Institutional",
};

export interface ContractComplication {
  id: string;
  /** What the player is told when it fires. */
  text: string;
  /** Added to the difficulty for the rest of the run. */
  harder: number;
  /** Multiplier on the fee. Below 1 means it costs you. */
  pay?: number;
  /** Extra ethical exposure this creates. */
  ethics?: number;
}

export interface ContractDef {
  id: string;
  careerId: string;
  kind: ContractKind;
  title: string;
  /** Who is asking, in one sentence. */
  blurb: string;
  /** 1..5. Compared against the player's assembled score. */
  difficulty: number;
  /** Planner blocks needed in total before the deadline. */
  effort: number;
  /** Weeks from acceptance. */
  deadline: number;
  /** Paid on success. Scaled by the city's fee index. */
  fee: number;
  /** Burnout per block worked. */
  strain: number;
  /** 0..1. How exposed you are if it goes wrong. */
  ethicalRisk: number;
  /** Reputation movement on success, by category id. */
  onSuccess: Partial<Record<string, number>>;
  /** …and on failure. */
  onFailure: Partial<Record<string, number>>;
  /** Only offered when this is true. */
  requires: (s: RunState) => boolean;
  /** Relative weight in the offer roll. */
  weight: (s: RunState) => number;
  /** Person attached to this piece of work, if any. */
  npc?: string;
  /** Rival most likely to bid for it. */
  rival?: string;
  complications?: ContractComplication[];
}

export interface ActiveContract {
  defId: string;
  city: string;
  acceptedWeek: number;
  dueWeek: number;
  /** Blocks worked so far. */
  progress: number;
  /** Staff ids assigned. Their skill counts toward the outcome. */
  assigned: string[];
  /** Complication ids that have fired. */
  complications: string[];
  /** Accumulated difficulty from complications. */
  extraDifficulty: number;
  /** Accumulated fee multiplier from complications. */
  payFactor: number;
}

export interface ContractOffer {
  defId: string;
  city: string;
  /** Week the offer lapses if not taken. */
  expiresWeek: number;
  /** What the player is bidding against. 0 means nobody else wants it. */
  rivalBid: number;
  rival?: string;
}

/** Bounded: an inbox of offers is a decision, a backlog is a chore. */
export const MAX_OFFERS = 4;
export const MAX_ACTIVE = 3;
/** Kept for the timeline and the report at the end of a run. */
export const MAX_CONTRACT_HISTORY = 30;

export interface ContractRecord {
  week: number;
  defId: string;
  title: string;
  outcome: "won" | "lost" | "expired" | "declined";
  fee: number;
}

/**
 * Everything the player brings to a piece of work, as one number.
 *
 * Gathered here rather than inline so the contract panel can show the player
 * the exact same figure the resolution uses — the "why did I fail that"
 * question has to have an answer on screen.
 */
export interface Readiness {
  total: number;
  parts: { label: string; value: number }[];
}

export function readinessFor(
  s: RunState,
  active: ActiveContract,
  def: ContractDef,
  ctx: {
    skill: number;
    burnout: number;
    standing: number;
    staffSkill: number;
    cityFactor: number;
    culture: number;
  },
): Readiness {
  const parts = [
    { label: "Your skill", value: ctx.skill * 0.34 },
    { label: "Work done", value: Math.min(1, active.progress / def.effort) * 26 },
    { label: "Team assigned", value: ctx.staffSkill * 0.18 },
    { label: "Standing", value: ctx.standing * 0.12 },
    { label: "Workplace", value: (ctx.culture - 50) * 0.14 },
    /* Burnout is subtractive and uncapped downward on purpose: taking a
       hard contract while exhausted should be a bad idea rather than a
       slightly worse one. */
    { label: "Burnout", value: -ctx.burnout * 0.22 },
    { label: "This city", value: (ctx.cityFactor - 1) * 18 },
  ];
  return {
    total: parts.reduce((n, p) => n + p.value, 0),
    parts,
  };
}

/** The bar the readiness score has to clear. */
export const requiredScore = (
  def: ContractDef,
  active: ActiveContract,
): number => 26 + (def.difficulty + active.extraDifficulty) * 9;

/**
 * Resolve a contract that has reached its deadline.
 *
 * A margin, not a threshold: clearing the bar comfortably is a clean success,
 * clearing it narrowly still succeeds but the RNG decides whether it was
 * pretty, and missing it badly is a failure the player could have predicted
 * from the panel.
 */
export function resolveContract(
  def: ContractDef,
  active: ActiveContract,
  readiness: Readiness,
  rng: Rng,
): { won: boolean; margin: number } {
  const need = requiredScore(def, active);
  const margin = readiness.total - need;

  // Unworked contracts fail regardless of how brilliant you are.
  if (active.progress < def.effort * 0.5) return { won: false, margin };

  if (margin >= 14) return { won: true, margin };
  if (margin <= -14) return { won: false, margin };
  /* The contested band. Linear from 10% at −14 to 90% at +14, so the middle
     is genuinely uncertain and the edges are not. */
  return { won: rng.chance(0.5 + margin / 35), margin };
}

/** Fee actually paid, after complications and the city. */
export const contractFee = (
  def: ContractDef,
  active: ActiveContract,
  cityFee: number,
): number => Math.round(def.fee * active.payFactor * cityFee);

export function startContract(
  defId: string,
  city: string,
  week: number,
  deadline: number,
): ActiveContract {
  return {
    defId,
    city,
    acceptedWeek: week,
    dueWeek: week + deadline,
    progress: 0,
    assigned: [],
    complications: [],
    extraDifficulty: 0,
    payFactor: 1,
  };
}

/**
 * Fire a complication, at most one per contract per week.
 *
 * Gated on having started: a complication on week one of a contract is not a
 * twist, it is a bait-and-switch. They become likelier as the deadline
 * approaches, which is when they hurt most and when the fiction supports them.
 */
export function rollComplication(
  def: ContractDef,
  active: ActiveContract,
  week: number,
  rng: Rng,
): ContractComplication | null {
  const pool = (def.complications ?? []).filter(
    (c) => !active.complications.includes(c.id),
  );
  if (pool.length === 0) return null;
  if (active.progress < 1) return null;

  const elapsed = week - active.acceptedWeek;
  const span = Math.max(1, active.dueWeek - active.acceptedWeek);
  const pressure = elapsed / span;
  if (!rng.chance(0.06 + pressure * 0.14)) return null;

  const c = rng.pick(pool);
  active.complications.push(c.id);
  active.extraDifficulty += c.harder;
  active.payFactor *= c.pay ?? 1;
  return c;
}
