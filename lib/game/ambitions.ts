import type { RunState } from "./types";
import { readRep } from "./reputation";

/**
 * AMBITIONS
 *
 * What *you* decided this career was for.
 *
 * The game used to have one goal, supplied by the career: clear the debt and
 * reach a net-worth number, at which point the run stopped. That is a target,
 * not an ambition — the player never chose it and could not decline it.
 *
 * An ambition is picked by the player, tracked against real state, celebrated
 * when it completes, and then **the run carries on**. That last clause is the
 * whole design: completing an ambition unlocks the next one and a line in the
 * timeline, and changes nothing about whether you may keep playing.
 *
 * Progress is a pure function of state, never a stored counter, so an ambition
 * cannot drift out of step with the run that is supposed to be satisfying it.
 */

export type AmbitionId =
  | "renowned"
  | "empire"
  | "principled"
  | "independent"
  | "authority"
  | "balanced"
  | "mentor";

export interface AmbitionDef {
  id: AmbitionId;
  label: string;
  /** One sentence, in the player's voice. */
  blurb: string;
  /** What it will cost you to chase this rather than something else. */
  tension: string;
  /** 0..1. Pure over state. */
  progress: (s: RunState) => number;
  /** What the player sees as the measure, e.g. "412k of 2m". */
  readout: (s: RunState) => string;
}

/**
 * Seven, deliberately in tension with each other.
 *
 * A player chasing `empire` will find `balanced` slipping away, and one
 * chasing `principled` will keep turning down the money that `independent`
 * wants. That is the point: an ambition you could satisfy accidentally while
 * pursuing another is not a choice.
 */
export const AMBITIONS: AmbitionDef[] = [
  {
    id: "renowned",
    label: "Be known outside your own field",
    blurb: "You want the general public to have heard of you.",
    tension: "Fame is not respect. The profession will notice which you chased.",
    progress: (s) =>
      clamp01(
        (readRep(s, "popularity") / 100) * 0.6 +
          Math.min(1, followerish(s) / 250_000) * 0.4,
      ),
    readout: (s) =>
      `popularity ${Math.round(readRep(s, "popularity"))}, ${compact(followerish(s))} following`,
  },
  {
    id: "empire",
    label: "Build the largest organisation in your industry",
    blurb: "Sites, people, reach. You want scale.",
    tension: "Scale costs culture, and culture is what stops people leaving.",
    progress: (s) =>
      clamp01(
        Math.min(1, (s.r._sites ?? 0) / 8) * 0.4 +
          Math.min(1, (s.r._headcount ?? 0) / 60) * 0.35 +
          Math.min(1, (s.r._cities ?? 1) / 6) * 0.25,
      ),
    readout: (s) =>
      `${Math.round(s.r._sites ?? 0)} sites, ${Math.round(s.r._headcount ?? 0)} people, ${Math.round(s.r._cities ?? 1)} cities`,
  },
  {
    id: "principled",
    label: "Get to the top without becoming someone you dislike",
    blurb: "You want to be able to account for every decision you made.",
    tension: "The fastest money in this game is always the money you refuse.",
    progress: (s) =>
      clamp01(
        (readRep(s, "ethics") / 100) * 0.5 +
          (readRep(s, "credibility") / 100) * 0.3 +
          Math.min(1, (s.r._netWorth ?? 0) / 800_000) * 0.2,
      ),
    readout: (s) =>
      `ethics ${Math.round(readRep(s, "ethics"))}, credibility ${Math.round(readRep(s, "credibility"))}`,
  },
  {
    id: "independent",
    label: "Never need anyone's money again",
    blurb: "No debt, no investors, no board. Just yours.",
    tension: "Refusing capital means growing at the speed of your own profits.",
    progress: (s) => {
      const owned = 100 - (s.r._equitySold ?? 0);
      return clamp01(
        Math.min(1, (s.r._netWorth ?? 0) / 2_000_000) * 0.5 +
          (owned / 100) * 0.3 +
          ((s.r.debt ?? 0) <= 0 ? 0.2 : 0),
      );
    },
    readout: (s) =>
      `${money(s.r._netWorth ?? 0)} net worth, ${Math.round(100 - (s.r._equitySold ?? 0))}% owned`,
  },
  {
    id: "authority",
    label: "Be the person your industry calls",
    blurb: "Committees, boards, the profession's ear.",
    tension: "Institutional weight is bought with days you do not spend working.",
    progress: (s) =>
      clamp01(
        (readRep(s, "influence") / 100) * 0.65 +
          Math.min(1, (s.r._credentials ?? 0) / 4) * 0.35,
      ),
    readout: (s) =>
      `influence ${Math.round(readRep(s, "influence"))}, ${Math.round(s.r._credentials ?? 0)} credentials`,
  },
  {
    id: "balanced",
    label: "Have a life as well as a career",
    blurb: "Successful, and still recognisable to the people who knew you.",
    tension: "Every hour this protects is an hour the ambitious ones are working.",
    progress: (s) =>
      clamp01(
        (1 - Math.min(1, (s.r.burnout ?? 0) / 100)) * 0.35 +
          Math.min(1, closeRelationships(s) / 4) * 0.35 +
          Math.min(1, (s.r._netWorth ?? 0) / 600_000) * 0.3,
      ),
    readout: (s) =>
      `burnout ${Math.round(s.r.burnout ?? 0)}, ${closeRelationships(s)} close relationships`,
  },
  {
    id: "mentor",
    label: "Leave people behind who are better than you were",
    blurb: "The measure is who you brought up, not what you own.",
    tension: "Time spent on other people's careers is time off your own.",
    progress: (s) =>
      clamp01(
        Math.min(1, (s.r._mentored ?? 0) / 4) * 0.5 +
          (readRep(s, "loyalty") / 100) * 0.3 +
          Math.min(1, respectedBy(s) / 5) * 0.2,
      ),
    readout: (s) =>
      `${Math.round(s.r._mentored ?? 0)} people brought up, loyalty ${Math.round(readRep(s, "loyalty"))}`,
  },
];

export const AMBITION_BY_ID = new Map(AMBITIONS.map((a) => [a.id, a]));

const clamp01 = (n: number) =>
  Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

const followerish = (s: RunState): number => s.r._followers ?? 0;

const closeRelationships = (s: RunState): number =>
  (s.people ?? []).filter((p) => p.warmth >= 45 && p.status === "active").length;

const respectedBy = (s: RunState): number =>
  (s.people ?? []).filter((p) => p.respect >= 60).length;

const money = (n: number) =>
  `$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}m`
    : n >= 1_000
      ? `${Math.round(n / 1000)}k`
      : `${Math.round(n)}`;

/** The one currently chosen, if any. */
export const currentAmbition = (s: RunState): AmbitionDef | null =>
  s.ambition ? (AMBITION_BY_ID.get(s.ambition) ?? null) : null;

export const isComplete = (s: RunState, id: AmbitionId): boolean =>
  (s.ambitionsDone ?? []).includes(id);

/**
 * Pick one. Changing your mind is allowed and costs nothing mechanical —
 * an ambition is a lens on the same run, not a contract, and punishing a
 * player for reconsidering what they want would be a strange thing for this
 * game to do.
 */
export function setAmbition(s: RunState, id: AmbitionId): void {
  if (!AMBITION_BY_ID.has(id)) return;
  if (isComplete(s, id)) return;
  s.ambition = id;
}

/**
 * Called after the week resolves.
 *
 * Returns the ambition that just completed, if one did. **Never touches
 * `outcome`.** Completing an ambition is a celebration and an entry in the
 * timeline; the player keeps playing, and may pick another.
 */
export function checkAmbition(s: RunState): AmbitionDef | null {
  const def = currentAmbition(s);
  if (!def) return null;
  if (def.progress(s) < 1) return null;
  s.ambitionsDone = [...(s.ambitionsDone ?? []), def.id];
  s.ambition = null;
  return def;
}
