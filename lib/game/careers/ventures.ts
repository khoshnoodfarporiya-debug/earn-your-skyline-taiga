import type { KitchenState } from "./kitchen";
import { cityOf } from "./kitchen";
import { rankIndex, RANKS } from "./craft";
import type { StandingId } from "./standing";

/**
 * THE WORK THAT IS NOT COOKING
 *
 * Past a certain point every chef in this trade is offered the same four
 * things: write a book, go on television, consult for somebody with more
 * money than kitchen, or take the food somewhere else for a fortnight.
 *
 * ------------------------------------------------------------- the one trade
 *
 * All of it is paid for out of the same thing: **you are not in your kitchen
 * while you do it.** A venture takes blocks out of the week — the same blocks
 * that would have opened a service — for as long as it runs, and the room
 * notices you are not there. That is the entire mechanic, and it is why these
 * are offers rather than upgrades: a chef who takes all four will have a very
 * good year and a restaurant that has quietly stopped being very good.
 *
 * ---------------------------------------------------------------- the ladder
 *
 * Nothing here can be bought. Each is gated on `chefRank` — what other chefs
 * think you are, from `craft.ts` — so the offers arrive in the order a real
 * career gets them: a pop-up long before a television series, and a book only
 * once there is somebody who wants to read it.
 */

export type VentureKind = "book" | "television" | "consult" | "popup" | "class";

export interface Venture {
  id: string;
  kind: VentureKind;
  label: string;
  blurb: string;
  /** Rank index required before it is offered at all. */
  needsRank: number;
  /** Weeks it runs. */
  weeks: number;
  /** Time blocks it takes out of every one of those weeks. */
  blocks: number;
  /** What it costs to start, in Lyon money. */
  cost: number;
  /**
   * Paid on completion, in Lyon money.
   *
   * A flat figure, converted to the city, and deliberately *not* derived from
   * what the restaurant earns. Two versions of this were tied to the kitchen's
   * own takings and both were unstable: the fee raised the cash, the cash
   * bought the room, the room raised the takings, and the takings raised the
   * fee. A thirty per cent change to one number moved a hundred-and-twenty
   * week run by seven million in the harness, in both directions. A fee with
   * no feedback in it is worth more than a fee that is perfectly fair at one
   * particular moment.
   *
   * The figures are calibrated against what a *service block* earns a mature
   * kitchen — about seven-tenths of it, since the rest of what a venture pays
   * arrives as reach and standing, and since the expectations it raises are a
   * real cost. Every one is gated on rank, which is what keeps the early
   * windfall inside the range where a small kitchen has earned it.
   *
   * What that leaves is honest and intended: a venture is worth a great deal
   * early and comparatively little once the restaurant is big. That is what
   * consultancy is actually like.
   */
  fee: number;
  /** Paid every week after it finishes, forever. Royalties. */
  royalty: number;
  /** Followers gained on completion. */
  followers: number;
  /** Added to the bar every night is judged against, permanently. */
  expectation: number;
  /** Standing it moves on completion, and why. */
  moves: { id: StandingId; delta: number; why: string }[];
  /** What it costs, stated on the card. */
  toll: string;
  /** Can it be done more than once? A book can; a first book cannot. */
  repeatable: boolean;
}

export const VENTURES: Venture[] = [
  {
    id: "popup",
    kind: "popup",
    label: "A pop-up in another city",
    blurb:
      "Two weeks in somebody else's room with your menu on the door. Everybody does one; most people do one.",
    needsRank: 1,
    weeks: 3,
    blocks: 2,
    cost: 6_500,
    fee: 32_000,
    royalty: 0,
    followers: 900,
    expectation: 3,
    moves: [
      {
        id: "innovation",
        delta: 3,
        why: "Cooked your menu in front of a city that had never seen it",
      },
    ],
    toll: "Two blocks a week for three weeks, and you are not on your own pass.",
    repeatable: true,
  },
  {
    id: "consult",
    kind: "consult",
    label: "Consult for a hotel group",
    blurb:
      "Write somebody else's menu, train somebody else's brigade, and take a cheque that does not depend on the weather.",
    needsRank: 2,
    weeks: 6,
    blocks: 2,
    cost: 0,
    fee: 50_000,
    royalty: 0,
    followers: 120,
    expectation: 0,
    moves: [
      {
        id: "consistency",
        delta: 2,
        why: "Wrote a menu that has to work in four rooms at once",
      },
    ],
    toll:
      "Two blocks a week for six weeks. Unglamorous, well paid, and nobody will be impressed.",
    repeatable: true,
  },
  {
    id: "class",
    kind: "class",
    label: "Teach a masterclass series",
    blurb:
      "Six Saturdays, twenty people, and explaining out loud why you do the thing you do.",
    needsRank: 2,
    weeks: 4,
    blocks: 1,
    cost: 1_200,
    fee: 20_000,
    royalty: 0,
    followers: 1_400,
    expectation: 2,
    moves: [
      {
        id: "food",
        delta: 2,
        why: "Teaching a technique is how you find out whether you know it",
      },
    ],
    toll: "One block a week for four weeks. The cheapest thing on this list.",
    repeatable: true,
  },
  {
    id: "book",
    kind: "book",
    label: "Write the book",
    blurb:
      "Two hundred recipes, tested three times each, photographed in your own dining room at six in the morning.",
    needsRank: 3,
    weeks: 10,
    blocks: 2,
    cost: 14_000,
    fee: 150_000,
    /* The reason a chef writes one. It never stops arriving. */
    royalty: 520,
    followers: 4_200,
    expectation: 6,
    moves: [
      {
        id: "innovation",
        delta: 5,
        why: "Published the kitchen's own way of doing things",
      },
      {
        id: "consistency",
        delta: 2,
        why: "Ten weeks of testing every recipe three times",
      },
    ],
    toll:
      "Two blocks a week for ten weeks — a quarter of a year out of your own kitchen.",
    repeatable: false,
  },
  {
    id: "television",
    kind: "television",
    label: "The television series",
    blurb:
      "Eight episodes, a crew in your kitchen every Tuesday, and a producer who wants you to be angrier.",
    needsRank: 4,
    weeks: 8,
    blocks: 3,
    cost: 0,
    fee: 70_000,
    royalty: 300,
    followers: 26_000,
    /* The single most expensive line in this file. Everybody who books after
       this has seen you on television and expects to be able to tell. */
    expectation: 16,
    moves: [
      {
        id: "atmosphere",
        delta: 4,
        why: "Half the country has now seen the dining room",
      },
      {
        id: "consistency",
        delta: -3,
        why: "Eight weeks of the chef being somewhere other than the pass",
      },
    ],
    toll:
      "Three blocks a week for eight weeks, and the room will be full of people who came to look at you.",
    repeatable: false,
  },
];

export const VENTURE_BY_ID = new Map(VENTURES.map((v) => [v.id, v]));

/* ---------------------------------------------------------------- the state */

export interface ActiveVenture {
  id: string;
  startedWeek: number;
  /** Weeks still to run. Counted down once per resolved week. */
  weeksLeft: number;
}

export interface VentureState {
  active: ActiveVenture | null;
  /** Ids finished, so a one-off is offered once. */
  done: string[];
  /** Weekly royalties earned, in Lyon money. Accumulates across ventures. */
  royalties: number;
  /** Week the last commitment ended, for the gap between them. */
  lastFinished?: number;
}

export const emptyVentures = (): VentureState => ({
  active: null,
  done: [],
  royalties: 0,
});

export const venturesOf = (k: KitchenState): VentureState =>
  k.ventures ?? emptyVentures();

export function ensureVentures(k: KitchenState): VentureState {
  if (!k.ventures) k.ventures = emptyVentures();
  return k.ventures;
}

export const activeVenture = (k: KitchenState): Venture | null => {
  const id = venturesOf(k).active?.id;
  return id ? (VENTURE_BY_ID.get(id) ?? null) : null;
};

/**
 * Time blocks a running venture takes out of the week.
 *
 * Read by `timeBudget`, which is the only place it needs to be: the player
 * simply has fewer blocks to allocate, and the planner already explains what
 * a block is worth. There is no separate "you are distracted" penalty,
 * because there does not need to be one.
 */
export const ventureBlocks = (k: KitchenState): number => {
  const v = activeVenture(k);
  return v ? v.blocks : 0;
};

/** Weekly royalty income, in Lyon money. Zero until something is finished. */
export const royaltiesOf = (k: KitchenState): number =>
  Math.max(0, Math.round(venturesOf(k).royalties));

/** What royalties are actually worth here. */
export const localRoyalties = (k: KitchenState): number =>
  Math.round(royaltiesOf(k) * cityOf(k).spend);

/* -------------------------------------------------------------- the offers */

/** Whether this venture can be started, and if not, why not. */
export function ventureBlocker(
  v: Venture,
  k: KitchenState,
  reputation: number,
  cash: number,
  /** The week now, for the gap between commitments. Optional so a caller that
      only wants the rank and cash gates still works. */
  week?: number,
): string | null {
  const state = venturesOf(k);
  if (state.active) return "Not yet — you are already committed to something";
  if (week !== undefined) {
    const wait = ventureCooldown(k, week);
    if (wait > 0) {
      return `Not for another ${wait} week${wait === 1 ? "" : "s"} — you have only just finished one`;
    }
  }
  if (!v.repeatable && state.done.includes(v.id)) {
    return "You have done this once, and once is all there is";
  }
  const rank = rankIndex(k, reputation);
  if (rank < v.needsRank) {
    return `Requires ${RANKS[v.needsRank].label.toLowerCase()} at least — nobody is offering it yet`;
  }
  if (cash < localOf(k, v.cost)) return "Costs more than you have";
  return null;
}

/** Ventures currently on the table. */
export const offered = (k: KitchenState, reputation: number): Venture[] =>
  VENTURES.filter((v) => rankIndex(k, reputation) >= v.needsRank);

const localOf = (k: KitchenState, amount: number): number =>
  Math.round(amount * cityOf(k).spend);

/** What it costs to start, here. */
export const ventureCost = (k: KitchenState, v: Venture): number =>
  localOf(k, v.cost);

/** What it pays on completion, here. */
export const ventureFee = (k: KitchenState, v: Venture): number =>
  localOf(k, v.fee);

/**
 * HOW LONG BEFORE THE NEXT ONE
 *
 * Six weeks, and this is the load-bearing number in the file.
 *
 * Without it a chef can be on a commitment for the whole run — the harness bot
 * finished a hundred and twenty weeks having done seventeen consecutive
 * consultancies, permanently two blocks down. That is not a decision anybody
 * makes and it is not what any of these offers are. A gap between commitments
 * is what makes each one a choice about *this* season rather than a standing
 * arrangement, and it is what keeps the trade a trade at every size of
 * restaurant.
 */
export const VENTURE_GAP = 6;

/** Weeks before another commitment can be taken on. */
export const ventureCooldown = (k: KitchenState, week: number): number => {
  const last = venturesOf(k).lastFinished;
  if (last === undefined) return 0;
  return Math.max(0, VENTURE_GAP - (week - last));
};

/* ---------------------------------------------------------------- the week */

export interface VentureWeek {
  /** Finished this week, if one did. */
  finished: Venture | null;
  /** Weeks still to run on whatever is active. */
  left: number;
  /** Royalties due this week, in local money. */
  royalties: number;
}

/**
 * Advance whatever is running by one week.
 *
 * Called once per resolved week. Counting down here rather than deriving from
 * `startedWeek` is deliberate: a week that is not resolved — a save closed
 * mid-week, an event that cost the player their whole allocation — must not
 * silently advance a ten-week book.
 */
export function advanceVentures(k: KitchenState, week: number): VentureWeek {
  const state = ensureVentures(k);
  const royalties = localRoyalties(k);

  if (!state.active) return { finished: null, left: 0, royalties };

  state.active.weeksLeft -= 1;
  if (state.active.weeksLeft > 0) {
    return { finished: null, left: state.active.weeksLeft, royalties };
  }

  const v = VENTURE_BY_ID.get(state.active.id) ?? null;
  state.active = null;
  if (v) {
    state.done = [...state.done, v.id];
    state.royalties += v.royalty;
  }
  state.lastFinished = week;
  return { finished: v, left: 0, royalties };
}

/** In words, for the planner: what the week is short of and why. */
export function ventureLine(k: KitchenState): string | null {
  const v = activeVenture(k);
  const state = venturesOf(k);
  if (!v || !state.active) return null;
  const left = state.active.weeksLeft;
  return `${v.label} — ${left} week${left === 1 ? "" : "s"} to run, ${v.blocks} block${v.blocks === 1 ? "" : "s"} a week gone from your own kitchen.`;
}
