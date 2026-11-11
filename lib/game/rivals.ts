import type { Rng, RunState } from "./types";
import { personIn, touchPerson } from "./people";

/**
 * RIVALS
 *
 * Other people having careers at the same time as you.
 *
 * ------------------------------------------------------- integrate, do not clone
 *
 * The Phase 1 cast already has people whose *role* is `rival`, with warmth,
 * trust, respect and memory of what you did. Building a second, separate
 * roster of AI competitors would have meant two Femi Okoros: one you have a
 * relationship with and one who owns clinics.
 *
 * So a rival is not a new person. `RivalState.id` **is** a `PersonState.id`,
 * and this module owns only the half the relationship model does not: what
 * they are building, where, and how well it is going. Every reaction still
 * goes through `touchPerson`, so beating one of them to a contract shows up on
 * their card in the People screen like everything else.
 *
 * ------------------------------------------------------------ summarised
 *
 * A rival is emphatically NOT a second full simulation. Running fourteen
 * cities of caseload for five rivals every week would multiply the cost of a
 * turn by six for something the player sees three sentences of.
 *
 * Instead each rival advances on a **cadence** — one move every four to seven
 * weeks depending on ambition — and between moves their numbers drift on a
 * closed-form curve. The result is a career that visibly progresses, costs
 * about a dozen arithmetic operations a week, and is completely deterministic
 * given the seed.
 */

export type RivalStrategy =
  | "climber" // credentials and institutions
  | "operator" // volume, cost control, more sites
  | "celebrity" // profile first, substance second
  | "consolidator" // buys what others built
  | "specialist"; // one thing, done better than anyone

export const RIVAL_STRATEGIES: readonly RivalStrategy[] = [
  "climber",
  "operator",
  "celebrity",
  "consolidator",
  "specialist",
];

export type RivalStance = "neutral" | "competitor" | "ally" | "enemy";

export const RIVAL_STANCES: readonly RivalStance[] = [
  "neutral",
  "competitor",
  "ally",
  "enemy",
];

export interface RivalMove {
  week: number;
  /** One sentence, past tense, from the rival's side. */
  text: string;
  kind: "growth" | "credential" | "profile" | "setback" | "move" | "clash";
}

export interface RivalState {
  /** Also a PersonState id. The two halves of the same character. */
  id: string;
  strategy: RivalStrategy;
  /** Where they are based right now. A CityId. */
  city: string;
  /** 0..100. Their standing in the profession. */
  standing: number;
  /** 0..100. Personal ability. */
  skill: number;
  /** Their business, in the same units as the player's net worth. */
  worth: number;
  sites: number;
  staff: number;
  /** How hard they push. Fixed. Drives cadence and risk appetite. */
  ambition: number;
  /** Where they stand toward the player. Derived from the relationship. */
  stance: RivalStance;
  /** Week of their last move, so the cadence is stateless. */
  lastMove: number;
  /** Newest first, capped. What the news and the rivals panel read. */
  history: RivalMove[];
  /** Set when they lose a contest to the player, so grudges can accumulate. */
  losses: number;
  wins: number;
}

/** A run is 156 weeks and a rival moves ~30 times. Twelve is plenty to show. */
export const MAX_RIVAL_HISTORY = 12;

export interface RivalDef {
  id: string;
  strategy: RivalStrategy;
  city: string;
  start: { standing: number; skill: number; worth: number; ambition: number };
}

export function initialRival(def: RivalDef): RivalState {
  return {
    id: def.id,
    strategy: def.strategy,
    city: def.city,
    standing: def.start.standing,
    skill: def.start.skill,
    worth: def.start.worth,
    sites: 1,
    staff: 1,
    ambition: def.start.ambition,
    stance: "neutral",
    lastMove: 0,
    history: [],
    losses: 0,
    wins: 0,
  };
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));

/** Weeks between moves. Ambition buys pace, and pace costs stability. */
export const cadence = (r: RivalState): number =>
  Math.max(3, Math.round(8 - r.ambition / 18));

/**
 * One week of the rest of the profession.
 *
 * Called with its own RNG stream so the number of rivals can never shift the
 * player's event rolls — the same discipline the phone follows, and for the
 * same reason: the balance harness has to keep measuring what it thinks it is.
 */
export function tickRivals(
  s: RunState,
  rng: Rng,
  cities: string[],
): RivalMove[] {
  const fired: RivalMove[] = [];
  for (const r of s.rivals ?? []) {
    // Between moves: a slow closed-form drift, no branching, no allocation.
    r.standing = clamp(r.standing + (r.ambition - 45) * 0.004, 0, 100);
    r.worth *= 1 + (r.ambition / 100) * 0.004;

    if (s.week - r.lastMove < cadence(r)) continue;
    r.lastMove = s.week;

    const move = makeMove(r, rng, cities, s.week);
    r.history = [move, ...r.history].slice(0, MAX_RIVAL_HISTORY);
    fired.push(move);
  }
  return fired;
}

/**
 * What a rival does when their turn comes round.
 *
 * Weighted by strategy, so the five of them diverge into recognisably
 * different careers rather than five copies with different names. A setback is
 * always possible: a rival who only ever goes up is a difficulty curve, not a
 * person.
 */
function makeMove(
  r: RivalState,
  rng: Rng,
  cities: string[],
  week: number,
): RivalMove {
  // Everyone can fail, and the ambitious fail more.
  if (rng.chance(0.1 + r.ambition * 0.0015)) {
    r.standing = clamp(r.standing - 4 - rng.int(0, 6), 0, 100);
    r.worth *= 0.9;
    return {
      week,
      kind: "setback",
      text: rng.pick([
        "lost a claim and a good deal of standing with it",
        "closed a site that never filled",
        "had a paper retracted",
        "lost two consultants to a competitor",
      ]),
    };
  }

  switch (r.strategy) {
    case "climber":
      if (rng.chance(0.55)) {
        r.standing = clamp(r.standing + 3 + rng.int(0, 4), 0, 100);
        r.skill = clamp(r.skill + 2, 0, 100);
        return {
          week,
          kind: "credential",
          text: rng.pick([
            "took a fellowship",
            "was appointed to a national committee",
            "published in a journal that matters",
          ]),
        };
      }
      r.staff += 1;
      return { week, kind: "growth", text: "hired another consultant" };

    case "operator":
      if (r.sites < 6 && rng.chance(0.45)) {
        r.sites += 1;
        r.worth *= 1.12;
        return { week, kind: "growth", text: "opened another site" };
      }
      r.staff += 1 + rng.int(0, 2);
      r.worth *= 1.05;
      return { week, kind: "growth", text: "expanded the payroll again" };

    case "celebrity":
      if (rng.chance(0.6)) {
        r.standing = clamp(r.standing + 2, 0, 100);
        return {
          week,
          kind: "profile",
          text: rng.pick([
            "was on the evening news again",
            "signed a book deal",
            "hit a quarter of a million followers",
          ]),
        };
      }
      r.worth *= 1.08;
      return { week, kind: "growth", text: "launched a branded clinic" };

    case "consolidator":
      if (rng.chance(0.5)) {
        r.sites += 1;
        r.staff += 3;
        r.worth *= 1.16;
        return { week, kind: "growth", text: "bought out a struggling practice" };
      }
      /* The only strategy that relocates: buying whatever is cheap means
         going where the trouble is. */
      r.city = rng.pick(cities.length ? cities : [r.city]);
      return { week, kind: "move", text: "moved operations to a new market" };

    case "specialist":
    default:
      r.skill = clamp(r.skill + 2 + rng.int(0, 2), 0, 100);
      r.standing = clamp(r.standing + 2, 0, 100);
      return {
        week,
        kind: "credential",
        text: rng.pick([
          "became the person you send the hard ones to",
          "published a technique that now has their name on it",
          "turned down a chair to keep operating",
        ]),
      };
  }
}

/* ------------------------------------------------------ contact with you */

/**
 * A contest the player either won or lost.
 *
 * This is the coupling that makes rivals matter rather than decorate: losing
 * costs the player the thing, and winning costs the rival standing and earns
 * a grudge. Both sides are recorded, and the relationship moves — so the
 * People screen shows why Okoro stopped returning your calls.
 */
export function recordContest(
  s: RunState,
  rivalId: string,
  playerWon: boolean,
  what: string,
): void {
  const r = (s.rivals ?? []).find((x) => x.id === rivalId);
  if (!r) return;

  if (playerWon) {
    r.losses += 1;
    r.standing = clamp(r.standing - 2, 0, 100);
    const beat: RivalMove = {
      week: s.week,
      kind: "clash",
      text: `lost ${what} to you`,
    };
    r.history = [beat, ...r.history].slice(0, MAX_RIVAL_HISTORY);
    touchPerson(
      s,
      rivalId,
      { warmth: -6, respect: 4, remember: ["beaten-by-you"] },
      `you took ${what} from them`,
      "bad",
    );
  } else {
    r.wins += 1;
    r.standing = clamp(r.standing + 2, 0, 100);
    r.worth *= 1.03;
    const beat: RivalMove = {
      week: s.week,
      kind: "clash",
      text: `took ${what} ahead of you`,
    };
    r.history = [beat, ...r.history].slice(0, MAX_RIVAL_HISTORY);
    touchPerson(
      s,
      rivalId,
      { warmth: 2, respect: -1 },
      `they took ${what} ahead of you`,
      "neutral",
    );
  }
  refreshStance(s, r);
}

/**
 * Where they stand toward you, read off the relationship rather than stored
 * independently — one source of truth, so the People card and the rivals
 * panel can never disagree.
 */
export function refreshStance(s: RunState, r: RivalState): void {
  const p = personIn(s, r.id);
  if (!p) return;
  if (p.warmth <= -40) r.stance = "enemy";
  else if (p.warmth >= 45 && p.trust >= 55) r.stance = "ally";
  else if (r.losses + r.wins > 0 || p.warmth < 0) r.stance = "competitor";
  else r.stance = "neutral";
}

/**
 * How hard they bid against you for something.
 *
 * Standing and skill decide their case; stance decides how much they want it.
 * An enemy bids above their weight to take something off you, which is the
 * mechanical expression of a grudge.
 */
export const rivalBid = (r: RivalState): number =>
  r.standing * 0.55 +
  r.skill * 0.35 +
  (r.stance === "enemy" ? 12 : r.stance === "competitor" ? 5 : 0) +
  Math.min(10, r.sites * 1.5);

/** Everyone operating in a given city, for the map and the city panel. */
export const rivalsIn = (s: RunState, city: string): RivalState[] =>
  (s.rivals ?? []).filter((r) => r.city === city);

/** Share of a market that rivals hold beyond the city's baseline incumbents. */
export function rivalPressure(s: RunState, city: string): number {
  const here = rivalsIn(s, city);
  if (here.length === 0) return 0;
  // Bounded: a city crowded with rivals is harder, never impossible.
  return Math.min(0.28, here.reduce((n, r) => n + r.sites * 0.02 + r.standing * 0.0006, 0));
}

export const STANCE_WORD: Record<RivalStance, string> = {
  neutral: "No history",
  competitor: "Competing",
  ally: "On good terms",
  enemy: "Hostile",
};

export const STRATEGY_WORD: Record<RivalStrategy, string> = {
  climber: "Building a reputation",
  operator: "Building a business",
  celebrity: "Building an audience",
  consolidator: "Buying what others built",
  specialist: "Becoming irreplaceable",
};
