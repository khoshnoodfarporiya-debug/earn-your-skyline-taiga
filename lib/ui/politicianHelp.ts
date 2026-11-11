import type { RunState } from "../game/types";
import {
  ISSUES,
  driftTable,
  nextOffice,
  projectedShare,
  selectionBlocker,
  thresholdFor,
  weeksToPoll,
  wouldHold,
  campaign,
} from "../game/careers/constituency";
import type { Alert } from "./alerts";
import type { Step } from "./guidance";
import type { Lesson, LessonId, TeachContext } from "./onboarding";
import type { Term } from "./glossary";

/**
 * WHAT THE INTERFACE TELLS A POLITICIAN
 *
 * The badges, the one next step, the lessons and the words — all four are
 * career-agnostic machinery that returned empty for this career, so a
 * Politician run had none of them. This file is the missing content.
 *
 * One rule shapes it, the way runway shapes the Founder's: **nothing is banked
 * until the count.** A number that is fine today and falling is a worse
 * position than a number that is poor today and rising, so almost everything
 * here is stated against polling day rather than against now.
 */

/* ------------------------------------------------------------------ alerts */

export function politicianAlerts(state: RunState): Alert[] {
  const c = campaign(state);
  const out: Alert[] = [];

  /* ------------------------------------------------------- out of office */
  if (c.outOfOffice) {
    out.push({
      id: "pol:out",
      severity: "critical",
      title: "Out of office",
      detail:
        "No seat, no allowance and no platform. Standing again starts the campaign from wherever your positions have left you.",
      destination: "polling",
      actionLabel: "Stand again",
    });
    return out;
  }

  const share = projectedShare(c);
  const need = thresholdFor(c);
  const weeks = weeksToPoll(c, state.week);
  const holding = wouldHold(c);

  /* ------------------------------------------------------------ the count */
  if (!holding) {
    out.push({
      id: "pol:losing",
      severity: weeks <= 6 ? "critical" : "warning",
      title: weeks <= 6 ? "Losing, with the count in sight" : "Behind the bar",
      detail: `${(share * 100).toFixed(1)}% against a bar of ${(need * 100).toFixed(1)}%, and ${weeks} week${weeks === 1 ? "" : "s"} to close it. Campaigning lifts support; only positions move where it settles.`,
      destination: weeks <= 6 ? "blocs" : "positions",
      actionLabel: weeks <= 6 ? "See the blocs" : "Look at your positions",
    });
  }

  /* ------------------------------------------ support that is a loan, not a gain */
  const owed = driftTable(c).filter((r) => r.gap > 6);
  if (owed.length > 0 && holding) {
    const worst = owed.sort((a, b) => b.gap - a.gap)[0];
    out.push({
      id: "pol:drift",
      severity: "warning",
      title: "Ahead on borrowed support",
      detail: `${worst.bloc.label} are ${Math.round(worst.gap)} points above where your positions leave them. Stop working and it drains back before the count.`,
      destination: "blocs",
      actionLabel: "See the drift",
    });
  }

  /* ------------------------------------------------------ nothing said yet */
  const answered = ISSUES.filter((i) => c.positions[i.id]).length;
  if (answered === 0 && state.week >= 3) {
    out.push({
      id: "pol:silent",
      severity: "warning",
      title: "You have not said anything",
      detail:
        "No positions taken, so every bloc settles at the seat's opening figures. Campaigning against that is a treadmill.",
      destination: "positions",
      actionLabel: "Take a position",
    });
  }

  /* ----------------------------------------------------------- reversals */
  if (c.reversals.length > 0) {
    out.push({
      id: "pol:reversals",
      severity: "warning",
      title: `${c.reversals.length} public reversal${c.reversals.length === 1 ? "" : "s"}`,
      detail: `That is ${c.reversals.length * 6} points off every bloc in the seat, including the people who agreed with the new answer.`,
      destination: "positions",
      actionLabel: "See where you stand",
    });
  }

  /* --------------------------------------------------------- the ladder */
  const next = nextOffice(c);
  if (next && selectionBlocker(c) === null && holding) {
    out.push({
      id: "pol:selection",
      severity: "info",
      title: `The party would select you for ${next.label}`,
      detail: `A ${Math.round(next.term / 52)}-year term at ${next.pay}× the allowance — and a new campaign, in a seat that is harder to hold.`,
      destination: "office",
      actionLabel: "Look at the ladder",
    });
  }

  return out;
}

/* --------------------------------------------------------------- next step */

export function politicianStep(
  state: RunState,
  alloc: Record<string, number>,
): Step | null {
  const c = campaign(state);

  if (c.outOfOffice) {
    return {
      id: "pol:stand-again",
      title: "Put your name forward again",
      detail:
        "Nothing here is over. The campaign restarts from the positions you already hold, and the allowance comes back with the seat.",
      destination: "polling",
      actionLabel: "Stand again",
    };
  }

  const share = projectedShare(c);
  const need = thresholdFor(c);
  const weeks = weeksToPoll(c, state.week);
  const holding = wouldHold(c);
  const answered = ISSUES.filter((i) => c.positions[i.id]).length;

  /* --- say something ----------------------------------------------------- */
  if (answered === 0) {
    return {
      id: "pol:first-position",
      title: "Answer one of the questions",
      detail:
        "Until you take a position every bloc drifts to the seat's opening figures, and canvassing only rents you the difference.",
      destination: "positions",
      actionLabel: "Take a position",
    };
  }

  /* --- behind, with time to fix it --------------------------------------- */
  if (!holding && weeks > 8) {
    return {
      id: "pol:reposition",
      title: "You are short, and there is still time to move the line",
      detail: `${(share * 100).toFixed(1)}% against ${(need * 100).toFixed(1)}%. Positions change where support settles; canvassing only lifts you above it for a while.`,
      destination: "positions",
      actionLabel: "Look at your positions",
    };
  }

  /* --- behind, close to the day ------------------------------------------ */
  if (!holding && weeks <= 8) {
    const worst = driftTable(c)
      .filter((r) => r.bloc.share * r.bloc.turnout > 0)
      .sort((a, b) => a.now - b.now)[0];
    return {
      id: "pol:campaign",
      title: worst ? `Work the ${worst.bloc.label.toLowerCase()}` : "Get out and campaign",
      detail: `${weeks} week${weeks === 1 ? "" : "s"} to the count — too late to change what you stand for, and campaigning is what lifts support before a vote.`,
      destination: "blocs",
      actionLabel: "Target a bloc",
    };
  }

  /* --- ahead on support that will drain ---------------------------------- */
  const owed = driftTable(c).filter((r) => r.gap > 6);
  if (owed.length > 0 && weeks > 4 && (alloc.canvass ?? 0) === 0) {
    return {
      id: "pol:hold",
      title: "Keep working the seat you are ahead in",
      detail:
        "Everything above where your positions leave you is a loan. It drains every week you do not spend on it.",
      destination: "blocs",
      actionLabel: "See the drift",
    };
  }

  /* --- the rung above ---------------------------------------------------- */
  const next = nextOffice(c);
  if (next && holding) {
    const blocked = selectionBlocker(c);
    return blocked
      ? {
          id: "pol:party",
          title: "Put a block into party work",
          detail: `${blocked} Standing inside the party is what decides selection, and voters never see it.`,
          destination: "office",
          actionLabel: "See the ladder",
        }
      : {
          id: "pol:climb",
          title: `Ask to be selected for ${next.label}`,
          detail:
            "You would hold what you have. The rung above pays more and buys a longer term to be unpopular in.",
          destination: "office",
          actionLabel: "Look at it",
        };
  }

  return null;
}

/* ---------------------------------------------------------------- lessons */

export const POLITICIAN_LESSON_IDS = [
  "pol-first-week",
  "pol-count",
  "pol-positions",
  "pol-ladder",
] as const;

export const POLITICIAN_LESSONS: Record<string, Lesson> = {
  "pol-first-week": {
    id: "pol-first-week" as LessonId,
    screen: "overview",
    title: "A week is six blocks, and support drains through all of them",
    intro:
      "Everything costs a block, nothing happens until you commit, and the electorate is moving away from you the entire time.",
    points: [
      {
        term: "Time blocks",
        detail:
          "Six of them, refilled weekly. Canvassing lifts support, surgeries earn the kind that sticks, party work buys selection. Unspent blocks are wasted.",
      },
      {
        term: "The drift",
        detail:
          "Every bloc moves toward where your positions leave it, every week. Doing nothing is not holding steady — it is sliding back to your own platform.",
      },
      {
        term: "Polling day",
        detail:
          "The only moment any of this is banked. A lead a month early is worth nothing on its own; the count is the only number that is ever kept.",
      },
      {
        term: "Commit week",
        detail:
          "Support moves, the allowance arrives, and the calendar advances toward the count. Nothing is committed until you press it.",
      },
    ],
  },

  "pol-count": {
    id: "pol-count" as LessonId,
    screen: "polling",
    title: "Two numbers, and only the gap between them matters",
    intro:
      "What you would take today, and what you need to take. Everything else in this career is a way of moving one toward the other.",
    points: [
      {
        term: "The share",
        detail:
          "What the seat would give you if the vote were today, weighted by how large each bloc is and how reliably it turns out.",
      },
      {
        term: "The bar",
        detail:
          "What you have to clear. It is set by the office rather than by you, and climbing the ladder raises it.",
      },
      {
        term: "Turnout",
        detail:
          "A bloc that likes you and stays at home is worth less than a smaller one that always votes. Support is not counted evenly.",
      },
    ],
  },

  "pol-positions": {
    id: "pol-positions" as LessonId,
    screen: "positions",
    title: "Campaigning rents support; positions own it",
    intro:
      "The single distinction the career turns on, and the reason a busy week can leave you exactly where you started.",
    points: [
      {
        term: "The line",
        detail:
          "Where each bloc settles, decided entirely by the positions you have taken. Canvassing lifts you above it and never moves it.",
      },
      {
        term: "What a stance costs",
        detail:
          "Nothing here pleases everybody. Each answer is listed with what it does to every bloc, in points, before you take it.",
      },
      {
        term: "Reversals",
        detail:
          "Change a stated position and the whole seat marks you down — six points off every bloc, including the ones who wanted the new answer.",
      },
    ],
  },

  "pol-ladder": {
    id: "pol-ladder" as LessonId,
    screen: "office",
    title: "The rung above is bought from the party, not the voters",
    intro:
      "Selection and election are different currencies, and the one that promotes you is the one nobody votes on.",
    points: [
      {
        term: "Party standing",
        detail:
          "Earned by party work, spent on selection. Voters never see it, and no amount of popularity substitutes for it.",
      },
      {
        term: "What you get",
        detail:
          "A longer term and a larger allowance — more weeks before you next have to be judged, which is the real prize.",
      },
      {
        term: "What it costs",
        detail:
          "A new seat, a new polling day, and a bar that is higher than the one you just cleared. Climbing resets the campaign.",
      },
    ],
  },
};

export function politicianLearned(id: string, state: RunState): boolean {
  const c = campaign(state);
  switch (id) {
    case "pol-first-week":
      return state.history.length > 0;
    case "pol-count":
      return c.results.length > 0 || state.history.length >= 4;
    case "pol-positions":
      return Object.keys(c.positions).length > 0;
    case "pol-ladder":
      return c.office !== "candidate" || c.party >= 25;
    default:
      return true;
  }
}

export function politicianRelevant(
  id: string,
  state: RunState,
  ctx: TeachContext,
): boolean {
  const c = campaign(state);
  switch (id) {
    case "pol-first-week":
      return state.history.length === 0 && state.week <= 2;
    case "pol-count":
      return ctx.hasReport || state.week >= 2;
    case "pol-positions":
      return state.week >= 2;
    case "pol-ladder":
      return Boolean(nextOffice(c)) && state.week >= 5;
    default:
      return false;
  }
}

/* ------------------------------------------------------------- the words */

export const CAMPAIGN_TERMS: Term[] = [
  {
    id: "the-postbag",
    term: "The postbag",
    plain: "Named cases on your desk",
    detail:
      "Constituents write with real problems and real deadlines. A Surgery block works the oldest; a case delivered moves that bloc's lean permanently — the one support that does not drift.",
  },
  {
    id: "the-fund",
    term: "The campaign fund",
    plain: "Donations, kept apart",
    detail:
      "Raised at fundraisers and spent on campaigning — it reimburses canvassing, targeting and media, and buys focus groups. It never pays the rent; that separation is the law.",
  },
  {
    id: "volunteers",
    term: "Volunteers",
    plain: "The people who knock",
    detail:
      "Recruited by organising and gone if untended. They amplify every canvassing block, and on polling day they are the turnout operation — worth up to two points of share.",
  },
  {
    id: "the-band",
    term: "The band",
    plain: "What the count might be",
    detail:
      "Nobody knows the share to a decimal. The margin narrows as polling day approaches, and a fresh focus group narrows it further — the simulation knows the truth, you know the band.",
  },
  {
    id: "the-count",
    term: "The count",
    plain: "Polling day",
    detail:
      "The one week any of this is banked. Support on every other week is a forecast; the count is the only figure that is ever kept.",
  },
  {
    id: "bloc",
    term: "Bloc",
    plain: "A group of voters",
    detail:
      "The seat is divided into groups that move together. Each is a share of the electorate and a likelihood of actually voting, and the two are multiplied.",
  },
  {
    id: "the-line",
    term: "The line",
    plain: "Where support settles",
    detail:
      "Where each bloc ends up given the positions you have taken. Support drifts toward it every week whatever else you do.",
  },
  {
    id: "drift",
    term: "Drift",
    plain: "Support moving on its own",
    detail:
      "The weekly slide toward the line. Anything above it was rented by campaigning and drains away the moment you stop.",
  },
  {
    id: "turnout",
    term: "Turnout",
    plain: "Who actually votes",
    detail:
      "A bloc's support is only worth what its turnout makes it. The enthusiastic and the reliable are rarely the same people.",
  },
  {
    id: "reversal",
    term: "Reversal",
    plain: "Changing your mind in public",
    detail:
      "Taking a different position on a question you already answered. It costs across the whole seat, not only among those who liked the old answer.",
  },
  {
    id: "party-standing",
    term: "Party standing",
    plain: "What the party thinks",
    detail:
      "Earned by party work and spent on selection for a higher office. Entirely separate from what voters think of you.",
  },
  {
    id: "selection",
    term: "Selection",
    plain: "Being put up for a seat",
    detail:
      "The party's permission to stand for the rung above. It is a threshold on standing, not a vote, and no popularity substitutes for it.",
  },
];
