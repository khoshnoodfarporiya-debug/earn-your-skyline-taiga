import type { RunState } from "./types";

/**
 * THE TIMELINE
 *
 * A career you can look back on.
 *
 * The one rule: **every entry is something that actually happened.** Nothing
 * here is generated to fill the page, and nothing is inferred from a save that
 * did not record it — a run migrated from an older save starts with an empty
 * timeline and fills from that week forward, because inventing a first
 * promotion the player may never have had would make the whole feature a lie.
 *
 * `mark` is idempotent per `id`, so the call sites can be blunt: the moment
 * something is true, mark it, and the second call does nothing. That is how a
 * "first employee" entry gets recorded exactly once from a hiring path that
 * runs every time anyone is hired.
 */

export type TimelineKind =
  | "start"
  | "qualification"
  | "promotion"
  | "business"
  | "expansion"
  | "people"
  | "social"
  | "crisis"
  | "award"
  | "money"
  | "failure"
  | "recovery";

export const TIMELINE_KINDS: readonly TimelineKind[] = [
  "start",
  "qualification",
  "promotion",
  "business",
  "expansion",
  "people",
  "social",
  "crisis",
  "award",
  "money",
  "failure",
  "recovery",
];

export interface TimelineEntry {
  /** Stable and unique — the idempotency key. */
  id: string;
  week: number;
  kind: TimelineKind;
  title: string;
  /** One sentence of what it meant. Written at the moment it happened. */
  detail: string;
}

/**
 * A whole run is 156 weeks. Even a busy one produces well under a hundred
 * genuine milestones, so this cap is a guard against a bug writing in a loop
 * rather than a real limit the player will meet.
 */
export const MAX_TIMELINE = 120;

export const hasMilestone = (s: RunState, id: string): boolean =>
  (s.timeline ?? []).some((t) => t.id === id);

/** Record a milestone once. Returns true if this call was the one that did. */
export function mark(
  s: RunState,
  id: string,
  kind: TimelineKind,
  title: string,
  detail: string,
): boolean {
  if (!s.timeline) s.timeline = [];
  if (hasMilestone(s, id)) return false;
  if (s.timeline.length >= MAX_TIMELINE) return false;
  s.timeline.push({ id, week: s.week, kind, title, detail });
  return true;
}

/** Oldest first, which is the only order a life story reads in. */
export const timelineOf = (s: RunState): TimelineEntry[] =>
  [...(s.timeline ?? [])].sort((a, b) => a.week - b.week);
