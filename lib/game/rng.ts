import type { Rng } from "./types";

/**
 * mulberry32. Small, fast, good enough for a management sim, and seeded so a
 * run can be replayed exactly — which matters for balancing.
 */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}

/** Derives a stable per-week stream so event rolls don't shift when the
 *  player changes their allocation. */
export function weekRng(seed: number, week: number): Rng {
  return makeRng((seed ^ (week * 0x9e3779b1)) >>> 0);
}
