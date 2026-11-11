import type { RunState } from "../game/types";
import { money } from "../game/format";
import {
  activeMenu,
  brigadeCovers,
  brigadeMorale,
  extraShelfLife,
  freshnessOf,
  larderCovers,
  loyaltyOf,
  moraleOf,
} from "../game/careers/kitchen";
import { kitchen, weeklyOutgoings } from "../game/careers/chef";
import type { Alert } from "./alerts";
import type { Step } from "./guidance";
import type { Lesson, LessonId, TeachContext } from "./onboarding";
import type { Term } from "./glossary";

/**
 * WHAT THE INTERFACE TELLS A CHEF
 *
 * The badges on the navigation, the one next step on the Overview, the lessons
 * that retire themselves, and the words. All four were built for the Physician
 * and returned empty for everybody else, so a Chef run had no badges, no
 * guidance, no lessons and no glossary button. The machinery was always
 * career-agnostic; only the content was missing.
 *
 * Everything here is derived from the kitchen, never stored, and every
 * sentence is in this career's own words: covers, services, lots and the
 * brigade. Nothing borrows a word from the other two.
 */

/* ------------------------------------------------------------------ alerts */

/**
 * What is urgent in a kitchen, in the order it actually closes one.
 *
 * Food first, because a service that cannot open is the only failure here
 * that wastes an entire week — everything else is a bad night rather than no
 * night at all.
 */
export function chefAlerts(state: RunState): Alert[] {
  const k = kitchen(state);
  const out: Alert[] = [];
  const weekly = weeklyOutgoings(k);
  const covers = larderCovers(k);

  /* ---------------------------------------------------------------- food */
  if (covers === 0) {
    out.push({
      id: "larder:empty",
      severity: "critical",
      title: "Nothing in the larder",
      detail:
        "You cannot open a service without food. Rent is charged whether or not the room opens, so an unopened week is the most expensive kind there is.",
      destination: "larder",
      actionLabel: "Order produce",
    });
  } else {
    /*
     * What dies next week, counted in covers rather than crates.
     *
     * Stated as covers because that is the unit the player plans in: "three
     * lots expiring" means nothing next to "40 covers of food in the bin".
     */
    const extra = extraShelfLife(k);
    const doomed = k.larder.reduce(
      (n, lot) => (freshnessOf(lot, state.week + 1, extra) <= 0 ? n + lot.left : n),
      0,
    );
    if (doomed > 0) {
      out.push({
        id: "larder:dying",
        severity: doomed >= covers * 0.5 ? "warning" : "info",
        title: `${doomed} covers die next week`,
        detail:
          "Produce has a shelf life and nothing stops it running out. Cook it, or throw it away and pay for it twice.",
        destination: "larder",
        actionLabel: "See the larder",
      });
    }
  }

  if (activeMenu(k).length === 0) {
    out.push({
      id: "menu:empty",
      severity: "warning",
      title: "Nothing on the menu",
      detail:
        "Without dishes the room is sold the staple alone, at the staple's price. A menu is what makes a cover worth more than the food in it.",
      destination: "menu",
      actionLabel: "Put a dish on",
    });
  }

  /* -------------------------------------------------------------- the room */
  const last = k.lastService;
  if (last && last.turnedAway >= 10) {
    const short = last.shortOfFood >= last.turnedAway * 0.5;
    out.push({
      id: short ? "service:food" : "service:room",
      severity: "warning",
      title: `${last.turnedAway} covers turned away`,
      detail: short
        ? "Most of them for want of food rather than hands or seats. Buy against the forecast, not against last week."
        : "The room or the brigade ran out before the demand did. Seats and hands are the two things that fix it.",
      destination: short ? "larder" : "kitchen",
      actionLabel: short ? "Order more" : "Look at the room",
    });
  }

  if (last && last.served > 0 && last.quality <= 42) {
    out.push({
      id: "service:quality",
      severity: "warning",
      title: "The plates are going out badly",
      detail: `Quality ${Math.round(last.quality)} last night. Tired produce and a stretched brigade both show on the plate, and word of mouth is downstream of it.`,
      destination: "pass",
      actionLabel: "Read the service",
    });
  }

  /* ------------------------------------------------------------- the line */
  const morale = brigadeMorale(k);
  if (morale !== null && morale < 35) {
    out.push({
      id: "brigade:morale",
      severity: "warning",
      title: "The brigade is on its knees",
      detail:
        "Morale decides how much of somebody's skill actually turns up. A line running on nothing puts out worse food than the same line rested.",
      destination: "brigade",
      actionLabel: "Look at the line",
    });
  }

  const leaving = k.staff.filter((x) => loyaltyOf(x) <= 35 && moraleOf(x) <= 45);
  if (leaving.length > 0) {
    out.push({
      id: "brigade:leaving",
      severity: "warning",
      title:
        leaving.length === 1
          ? `${leaving[0].name} is about to walk`
          : `${leaving.length} of the brigade are about to walk`,
      detail:
        "Loyalty moves slowly and does not come back quickly. Whoever goes takes their skill and their speciality with them, and the agency sends a stranger.",
      destination: "brigade",
      actionLabel: "Look at the line",
    });
  }

  /* --------------------------------------------------------------- money */
  if (state.r.cash < 0) {
    out.push({
      id: "cash:negative",
      severity: "critical",
      title: "Overdrawn",
      detail: `${money(state.r.cash)} in the account. Far enough under and the restaurant closes its doors — a setback you trade your way out of, not an ending, and an expensive one.`,
      destination: "books",
      actionLabel: "Open the money",
    });
  } else if (weekly > 0 && state.r.cash < weekly * 2) {
    out.push({
      id: "cash:thin",
      severity: "warning",
      title: "Under two weeks of cover",
      detail: `${money(state.r.cash)} against ${money(weekly)} a week in rent, wages and upkeep — all of it due whether or not you open.`,
      destination: "books",
      actionLabel: "Open the money",
    });
  }

  /* ------------------------------------------------------------------ you */
  if (state.r.burnout >= 85) {
    out.push({
      id: "burnout:critical",
      severity: "critical",
      title: "Burnout critical",
      detail:
        "At 100 you are signed off — a setback you climb out of, not an ending. Rest is the only thing that brings it down, and a chef who is not in the room is a room cooking without its chef.",
      destination: "overview",
      actionLabel: "Assign rest",
    });
  } else if (state.r.burnout >= 68) {
    out.push({
      id: "burnout:high",
      severity: "warning",
      title: "Burnout high",
      detail:
        "Above 80 your week is five blocks rather than six, which is a whole service you can no longer open.",
      destination: "overview",
      actionLabel: "Assign rest",
    });
  }

  return out;
}

/* -------------------------------------------------------------- next step */

/**
 * One sentence about what to do next.
 *
 * Ordered as the loop actually runs: buy food, put it on a menu, open a
 * service, read what happened — and only then worry about the room and the
 * people in it.
 */
export function chefStep(state: RunState, alloc: Record<string, number>): Step | null {
  const k = kitchen(state);
  const week = state.week;
  const covers = larderCovers(k);

  if (covers === 0) {
    return {
      id: "chef:buy",
      title: "There is nothing to cook",
      detail:
        "Order produce before you open. Your suppliers are on the phone, under Market.",
      destination: "larder",
      actionLabel: "Open Larder",
    };
  }

  if (activeMenu(k).length === 0) {
    return {
      id: "chef:menu",
      title: "Nothing is on the menu",
      detail:
        "Dishes are what a cover is worth beyond the food in it. Put one on before the next service.",
      destination: "menu",
      actionLabel: "Open Menu",
    };
  }

  const cooking = (alloc.dinner ?? 0) + (alloc.lunch ?? 0);
  if (cooking === 0) {
    return {
      id: "chef:open",
      title: "No service is open this week",
      detail:
        "Food in the larder does not earn anything. A service block is what turns covers into takings — and stock ages either way.",
    };
  }

  /* Buying for more services than the room can seat is the commonest way to
     lose money in this career, so it is worth saying before the week runs. */
  const seats = Math.round(brigadeCovers(k, state.r.skill) * 1.15);
  if (seats > 0 && covers > seats * 2.2 && week >= 3) {
    return {
      id: "chef:overbought",
      title: `${covers} covers in stock and hands for about ${seats}`,
      detail:
        "Anything you cannot cook before it dies is paid for twice — once at the market and once in the bin.",
      destination: "larder",
      actionLabel: "Open Larder",
    };
  }

  if (week >= 6 && k.staff.length === 0) {
    return {
      id: "chef:hire",
      title: "Every plate is going out of your hands",
      detail:
        "A brigade is how the room serves more than one chef can cook. The agency is on the phone, under Agency.",
      destination: "brigade",
      actionLabel: "Open Brigade",
    };
  }

  const last = k.lastService;
  if (last && last.turnedAway >= 12 && week >= 8) {
    return {
      id: "chef:grow",
      title: `${last.turnedAway} covers turned away last night`,
      detail:
        "The room, the brigade or the larder ran out before the demand did. Whichever it was is the thing to spend on.",
      destination: "kitchen",
      actionLabel: "Open The room",
    };
  }

  if (week >= 12 && (k.equipment ?? []).length === 0 && state.r.cash > 60_000) {
    return {
      id: "chef:kit",
      title: "Nothing is installed in the kitchen",
      detail:
        "Equipment buys shelf life and plate quality — the two things that decide whether a busy week is a profitable one.",
      destination: "kitchen",
      actionLabel: "Open The room",
    };
  }

  return null;
}

/* ---------------------------------------------------------------- lessons */

export const CHEF_LESSON_IDS = [
  "chef-first-week",
  "chef-larder",
  "chef-menu",
  "chef-service",
  "chef-brigade",
] as const;

export const CHEF_LESSONS: Record<string, Lesson> = {
  "chef-first-week": {
    id: "chef-first-week" as LessonId,
    screen: "overview",
    title: "A week is six blocks, and the food is already ageing",
    intro:
      "Everything costs a block, nothing happens until you commit, and the stock you bought is getting older whether or not you open.",
    points: [
      {
        term: "Time blocks",
        detail:
          "Six of them, refilled weekly. Services are what earn; prep and practice are what make them better. Unspent blocks are wasted — the week resolves either way.",
      },
      {
        term: "Buy before you know",
        detail:
          "Produce is ordered before the week runs and dies on its own schedule. You are always committing to a guess about how full the room will be.",
      },
      {
        term: "Covers",
        detail:
          "One cover is one person eating. It is the unit for everything here — what the room seats, what the brigade can plate, and what is left in the larder.",
      },
      {
        term: "Commit week",
        detail:
          "The services run, the room turns up or does not, food is used or wasted, and the rent is taken. Nothing is committed until you press it.",
      },
    ],
  },

  "chef-larder": {
    id: "chef-larder" as LessonId,
    screen: "larder",
    title: "Everything in here is on a clock",
    intro:
      "The larder is the career's whole constraint in one screen: you paid for this already, and it is worth nothing the moment it turns.",
    points: [
      {
        term: "Lots",
        detail:
          "Each delivery is its own crate with its own shelf life. Two crates of the same thing from different suppliers genuinely have different amounts of time left in them.",
      },
      {
        term: "Shelf life",
        detail:
          "Counted in weeks and shown as freshness. Tired produce still cooks — it just goes out worse, and the plate quality is what word of mouth is downstream of.",
      },
      {
        term: "Suppliers",
        detail:
          "Cheaper food arrives with less life in it. A warm account gets a better price and a van that actually turns up; a cold one gets neither.",
      },
      {
        term: "Waste",
        detail:
          "Anything that dies is paid for twice — once at the market and once as the covers you could not serve. Buying against the forecast is the whole skill.",
      },
    ],
  },

  "chef-menu": {
    id: "chef-menu" as LessonId,
    screen: "menu",
    title: "What a cover is actually worth",
    intro:
      "The room will eat the staple at the staple's price. A menu is how a seat becomes worth more than the food sitting in it.",
    points: [
      {
        term: "Dishes and ingredients",
        detail:
          "Each dish draws named ingredients off the lots you bought. Put on something you cannot supply and the room is sold the staple instead.",
      },
      {
        term: "Cost against price",
        detail:
          "Margin is what you charge less what it costs to make. A dish with a beautiful margin nobody orders earns nothing.",
      },
      {
        term: "Quality",
        detail:
          "Your skill, the brigade's, and how fresh the ingredients were. It decides what the room thinks and therefore what next week's bookings look like.",
      },
    ],
  },

  "chef-service": {
    id: "chef-service" as LessonId,
    screen: "pass",
    title: "What actually limited the night",
    intro:
      "The report is the other half of the forecast: what happened, and — the part you cannot infer — which of the three constraints bound.",
    points: [
      {
        term: "The book",
        detail:
          "How much of the room you sell in advance. More booking is more of next week knowable before any food is bought, at the cost of the walk-ins you turn away.",
      },
      {
        term: "Seats, hands, food",
        detail:
          "Three ceilings, and the lowest one decides the night. The report names which it was, so you spend on the one that is actually binding.",
      },
      {
        term: "Walkouts",
        detail:
          "People who sat down and left before eating. They cost you the cover and they tell everybody, which is worse than never seating them.",
      },
    ],
  },

  "chef-brigade": {
    id: "chef-brigade" as LessonId,
    screen: "brigade",
    title: "The line is not interchangeable",
    intro:
      "Two commis chefs are not the same commis chef twice. Everyone on the line has a skill, a mood and a view about whether they are staying.",
    points: [
      {
        term: "Skill and speciality",
        detail:
          "What they put out, and where they are better than their role suggests. The agency sends better people to better-regarded kitchens.",
      },
      {
        term: "Morale",
        detail:
          "How much of that skill actually turns up this week. It moves fast, and a line run into the ground plates worse food than the same line rested.",
      },
      {
        term: "Loyalty",
        detail:
          "Whether they are here next month. It moves slowly and does not come back quickly. Somebody who walks takes their speciality with them.",
      },
    ],
  },
};

/** Has the player already shown they understand this? */
export function chefLearned(id: string, state: RunState): boolean {
  const k = kitchen(state);
  switch (id) {
    case "chef-first-week":
      return state.history.length > 0;
    case "chef-larder":
      /* Ordering something is the lesson, demonstrated. */
      return k.larder.length > 0;
    case "chef-menu":
      return activeMenu(k).length > 0;
    case "chef-service":
      return state.history.length >= 3 && k.lastService !== null;
    case "chef-brigade":
      return k.staff.length > 0;
    default:
      return true;
  }
}

/** Is this system on screen and about to matter? */
export function chefRelevant(
  id: string,
  state: RunState,
  ctx: TeachContext,
): boolean {
  const k = kitchen(state);
  switch (id) {
    case "chef-first-week":
      return state.history.length === 0 && state.week <= 2;
    case "chef-larder":
      return true;
    case "chef-menu":
      return larderCovers(k) > 0 || state.week >= 2;
    case "chef-service":
      return ctx.hasReport;
    case "chef-brigade":
      return state.week >= 4;
    default:
      return false;
  }
}

/* ------------------------------------------------------------ the words */

export const CHEF_TERMS: Term[] = [
  {
    id: "cover",
    term: "Cover",
    plain: "One person eating",
    detail:
      "The unit for everything in this career: what the room seats, what the brigade can plate in a night, what is left in the larder, and what a night's takings divide by.",
  },
  {
    id: "service",
    term: "Service",
    plain: "One sitting — a lunch or a dinner",
    detail:
      "A block of the week spent opening the room. Each kind seats a different share of it and is worth a different amount a head; some need equipment or a bigger room before you can run them at all.",
  },
  {
    id: "lot",
    term: "Lot",
    plain: "One crate you bought",
    detail:
      "Produce is tracked per delivery, not as a pile, because each crate arrived with its own shelf life. The oldest is always drawn from first.",
  },
  {
    id: "shelf-life",
    term: "Shelf life",
    plain: "How long food lasts",
    detail:
      "Counted in weeks from delivery. Shown as freshness, which falls as it ages and drags plate quality down with it before the food is technically gone.",
  },
  {
    id: "the-pass",
    term: "The pass",
    plain: "Where finished plates go out",
    detail:
      "In this game it is the screen carrying the booking policy, the forecast for next week, and the report on the last night — everything about the room rather than about the food.",
  },
  {
    id: "brigade",
    term: "Brigade",
    plain: "The people on the line",
    detail:
      "Your kitchen staff. Each has a skill, a morale that decides how much of it turns up, and a loyalty that decides whether they are still here next month.",
  },
  {
    id: "walkout",
    term: "Walkout",
    plain: "Somebody who left before eating",
    detail:
      "Worse than never seating them: you lose the cover and they tell people. Caused by waits, which are caused by the room being fuller than the line can plate.",
  },
  {
    id: "plate-quality",
    term: "Plate quality",
    plain: "How good the food actually was",
    detail:
      "Computed from your skill, the brigade's, and how fresh the ingredients were. Everything the city thinks of you is downstream of this one number.",
  },
];
