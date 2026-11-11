import type { RunState } from "./types";

/**
 * DELAYED CONSEQUENCES
 *
 * The thing that separates a decision from a dice roll is that you find out
 * later. Every event choice used to resolve entirely in the moment: pay the
 * money, take the hit, next week. Nothing you did in week 20 could still be
 * arriving in week 34.
 *
 * A pending consequence is a promise the world made. It is stored on the run,
 * survives a save, and fires at the top of the week it is due — before the
 * player's actions, so a follow-up lands on the week they are about to plan
 * rather than a week late.
 *
 * Deliberately *data*, not a closure: a closure cannot be serialised, so the
 * effect is a named kind the career resolves. That means a pending item in an
 * old save whose kind no longer exists is dropped harmlessly at load rather
 * than crashing on a missing function.
 */

export interface PendingConsequence {
  /** Unique per scheduling, so the same chain can be armed twice. */
  id: string;
  /** The week it fires. Compared with `>=`, so a missed week still fires. */
  dueWeek: number;
  /** What to do. Resolved by the career's `resolvePending` hook. */
  kind: string;
  /** Free-form payload the career's resolver understands. */
  payload?: Record<string, string | number | boolean>;
  /**
   * Shown to the player *now*, when it is scheduled, if the fiction says they
   * would know something is coming. Empty means it arrives unannounced —
   * which is right for the ones that should be a surprise.
   */
  notice?: string;
}

/** A save with a runaway scheduler must not grow without bound. */
export const MAX_PENDING = 24;

export function schedule(
  s: RunState,
  weeksFromNow: number,
  kind: string,
  payload?: PendingConsequence["payload"],
  notice?: string,
): void {
  if (!s.pending) s.pending = [];
  if (s.pending.length >= MAX_PENDING) return;
  s.pending.push({
    /* The week and a counter make this unique without an RNG draw, which
       matters: scheduling must not consume from the gameplay stream or it
       would shift every later event. */
    id: `${kind}@${s.week}+${weeksFromNow}#${s.pending.length}`,
    dueWeek: s.week + Math.max(1, Math.round(weeksFromNow)),
    kind,
    payload,
    notice,
  });
}

/** Everything due this week, removed from the queue as it is handed over. */
export function takeDue(s: RunState): PendingConsequence[] {
  if (!s.pending?.length) return [];
  const due = s.pending.filter((p) => s.week >= p.dueWeek);
  if (due.length === 0) return [];
  s.pending = s.pending.filter((p) => s.week < p.dueWeek);
  return due;
}

/** What the player can see coming, soonest first. */
export const upcoming = (s: RunState): PendingConsequence[] =>
  (s.pending ?? [])
    .filter((p) => p.notice)
    .sort((a, b) => a.dueWeek - b.dueWeek);
