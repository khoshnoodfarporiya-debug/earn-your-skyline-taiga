import type { RunState } from "../game/types";
import { money } from "../game/format";
import {
  ROUND_BY_ID,
  ROUNDS,
  burnOf,
  churnRate,
  defaultAlive,
  organicUsers,
  payroll,
  revenueOf,
  roundBlocker,
  runwayOf,
  valuationOf,
  venture,
  techDebtOf,
} from "../game/careers/startup";
import type { Alert } from "./alerts";
import type { Step } from "./guidance";
import type { Lesson, LessonId, TeachContext } from "./onboarding";
import type { Term } from "./glossary";

/**
 * WHAT THE INTERFACE TELLS A FOUNDER
 *
 * The badges on the navigation, the one next step on the Overview, the lessons
 * that retire themselves, and the words. All four systems are career-agnostic
 * and all four returned empty for this career, so a Founder run had no badges,
 * no guidance, no lessons, and a glossary button that rendered nothing. The
 * machinery was never the problem; the content was missing, and this is it.
 *
 * Everything here is derived from the venture and never stored, and every
 * sentence is in this career's own words — runway, burn, churn, dilution.
 * Nothing borrows a word from the other careers.
 *
 * One rule shapes the whole file: **the clock is the alert.** Every other
 * career can be told about its worst problem in the terms of that problem. A
 * founder's problems are all the same problem, expressed in weeks, so almost
 * everything here converts itself into runway before it says anything.
 */

/* ------------------------------------------------------------------ alerts */

export function founderAlerts(state: RunState): Alert[] {
  const v = venture(state);
  const out: Alert[] = [];
  const weeks = runwayOf(state.r.cash, v);
  const alive = defaultAlive(v);
  const burn = burnOf(v);
  const revenue = revenueOf(v);

  /* ------------------------------------------------------------- the clock */
  if (alive) {
    out.push({
      id: "founder:alive",
      severity: "info",
      title: "Default alive",
      detail:
        "Revenue covers burn. The clock has stopped, and it is the only thing in this career that stops for good.",
      destination: "runway",
      actionLabel: "See the numbers",
    });
  } else if (weeks < 4) {
    out.push({
      id: "founder:runway:critical",
      severity: "critical",
      title: "Weeks from zero",
      detail: `${money(burn - revenue)} leaves every week and ${money(state.r.cash)} is left — about ${Math.max(0, Math.floor(weeks))} of them. Cut the burn or close a round.`,
      destination: "runway",
      actionLabel: "Look at the burn",
    });
  } else if (weeks < 10) {
    out.push({
      id: "founder:runway:warning",
      severity: "warning",
      title: "Runway is short",
      detail: `About ${Math.floor(weeks)} weeks left. A round takes several of them to pitch, so the time to start is before it is urgent.`,
      destination: "raising",
      actionLabel: "Look at a round",
    });
  }

  /* -------------------------------------------------- payroll you cannot meet */
  if (v.team.length > 0 && !alive) {
    const wages = payroll(v);
    if (wages > 0 && state.r.cash < wages * 3) {
      out.push({
        id: "founder:payroll",
        severity: "critical",
        title: "Payroll is the burn",
        detail: `${v.team.length} on the payroll at ${money(wages)} a week, against ${money(state.r.cash)}. Letting somebody go buys weeks immediately.`,
        destination: "crew",
        actionLabel: "Look at the team",
      });
    }
  }

  /* -------------------------------------------------- the roadmap's bill */
  {
    const debt = techDebtOf(v);
    if (debt >= 60) {
      out.push({
        id: "founder:techdebt",
        severity: "warning",
        title: "The corners you cut are compounding",
        detail: `Technical debt is at ${Math.round(debt)} of 100 — about ${(debt * 0.02).toFixed(1)}% extra churn a week and dearer servers. Stability weeks on the roadmap pay it down.`,
        destination: "product",
        actionLabel: "Open the roadmap",
      });
    }
  }

  /* ------------------------------------------------- leaving faster than joining */
  const leaving = v.users * churnRate(v);
  const arriving = organicUsers(v);
  if (v.users >= 20 && leaving > arriving) {
    out.push({
      id: "founder:churn",
      severity: "warning",
      title: "Leaking customers",
      detail: `${Math.round(leaving)} leave a week and ${Math.round(arriving)} arrive on their own. Selling refills the bucket; only building fixes it.`,
      destination: "runway",
      actionLabel: "See where they go",
    });
  }

  /* ----------------------------------------------- a round that will not close */
  if (v.pitchRound) {
    const round = ROUND_BY_ID.get(v.pitchRound);
    const blocked = round ? roundBlocker(v, round) : null;
    if (round && blocked) {
      out.push({
        id: "founder:diligence",
        severity: "warning",
        title: `The ${round.label} would fail diligence`,
        detail: `${blocked} If that is still true when the round closes, the money does not arrive and the weeks spent pitching are gone.`,
        destination: "raising",
        actionLabel: "See the round",
      });
    }
  }

  return out;
}

/* --------------------------------------------------------------- next step */

/**
 * The one thing to do next.
 *
 * Ordered by what actually ends runs. Running out of money ends a run; a
 * mediocre product does not, it just makes the next round dearer. So the
 * cash questions come first even though the product question is the more
 * interesting one.
 */
export function founderStep(
  state: RunState,
  alloc: Record<string, number>,
): Step | null {
  const v = venture(state);
  const weeks = runwayOf(state.r.cash, v);
  const alive = defaultAlive(v);

  if (alive) {
    return {
      id: "founder:compound",
      title: "Build on a company that pays for itself",
      detail:
        "Revenue covers burn, so every week from here is yours. Hiring now costs weeks you actually have.",
      destination: "crew",
      actionLabel: "Look at the team",
    };
  }

  /* --- out of road ------------------------------------------------------- */
  if (weeks < 6 && !v.pitchRound) {
    const reachable = ROUNDS.find((r) => roundBlocker(v, r) === null);
    return reachable
      ? {
          id: "founder:raise-now",
          title: `Go out and raise the ${reachable.label}`,
          detail: `About ${Math.max(0, Math.floor(weeks))} weeks of cash left, and a round takes weeks of pitching before it pays anything.`,
          destination: "raising",
          actionLabel: "Start raising",
        }
      : {
          id: "founder:cut",
          title: "Cut the burn while cutting it still helps",
          detail:
            "No round will have you yet, so the only thing that buys weeks is spending fewer of them on payroll.",
          destination: "crew",
          actionLabel: "Look at the team",
        };
  }

  /* --- raising, but not pitching ----------------------------------------- */
  if (v.pitchRound && (alloc.pitch ?? 0) === 0) {
    const round = ROUND_BY_ID.get(v.pitchRound);
    return {
      id: "founder:pitch",
      title: "Spend a block pitching",
      detail: `You are out raising the ${round?.label ?? "round"} and it moves only on the weeks you work it. It is at ${Math.round(v.pitch)}%.`,
      destination: "raising",
      actionLabel: "See the round",
    };
  }

  /* --- nobody is buying yet ---------------------------------------------- */
  if (v.users === 0) {
    return {
      id: "founder:first-customer",
      title: "Go and find the first customer",
      detail:
        "Selling is the only thing that puts somebody on the books this week. Nothing else in the career works until somebody is.",
      destination: "runway",
      actionLabel: "See where they come from",
    };
  }

  /* --- the bucket has a hole in it --------------------------------------- */
  if (v.users * churnRate(v) > organicUsers(v) && v.product < 60) {
    return {
      id: "founder:build",
      title: "Spend a block building",
      detail: `Customers leave at ${(churnRate(v) * 100).toFixed(1)}% a week and the product is at ${Math.round(v.product)}. Building is the only thing that slows that down.`,
      destination: "runway",
      actionLabel: "See the product",
    };
  }

  /* --- nothing is compounding -------------------------------------------- */
  if (v.brand < 25 && (alloc.market ?? 0) === 0 && v.users > 0) {
    return {
      id: "founder:market",
      title: "Put a block into marketing",
      detail:
        "Selling stops working the week you stop. Brand is the only thing that keeps bringing people in after you have moved on.",
      destination: "runway",
      actionLabel: "See the arrivals",
    };
  }

  /* --- the round nobody has priced --------------------------------------- */
  if (valuationOf(v) === 0 && v.users > 0) {
    const reachable = ROUNDS.find((r) => roundBlocker(v, r) === null);
    if (reachable) {
      return {
        id: "founder:first-round",
        title: `The ${reachable.label} is open to you`,
        detail:
          "Nothing has put a price on the company yet. The first round is what does, and it buys the weeks to earn the second.",
        destination: "raising",
        actionLabel: "Look at it",
      };
    }
  }

  return null;
}

/* ---------------------------------------------------------------- lessons */

export const FOUNDER_LESSON_IDS = [
  "founder-first-week",
  "founder-runway",
  "founder-team",
  "founder-raising",
] as const;

export const FOUNDER_LESSONS: Record<string, Lesson> = {
  "founder-first-week": {
    id: "founder-first-week" as LessonId,
    screen: "overview",
    title: "A week is six blocks, and the runway shortens either way",
    intro:
      "Everything costs a block, nothing happens until you commit, and the money goes out whether or not you spent them well.",
    points: [
      {
        term: "Time blocks",
        detail:
          "Six of them, refilled weekly. Building makes people stay, selling makes them arrive, marketing makes them keep arriving, and pitching buys more weeks. Unspent blocks are wasted.",
      },
      {
        term: "Burn",
        detail:
          "What leaves every week — your own costs plus every salary. It is charged on the weeks you do brilliant work and the weeks you do none.",
      },
      {
        term: "Runway",
        detail:
          "Cash divided by what is left of the burn after revenue. It is the real score of this career: every decision here is a decision about weeks.",
      },
      {
        term: "Default alive",
        detail:
          "The one ending that stops the clock. Revenue covers burn, nothing is running out, and the company no longer needs anybody's permission to exist.",
      },
    ],
  },

  "founder-runway": {
    id: "founder-runway" as LessonId,
    screen: "runway",
    title: "Two flows, and only one of them compounds",
    intro:
      "Customers arrive and customers leave. Which of those you work on decides whether the company grows or just churns in place.",
    points: [
      {
        term: "Selling",
        detail:
          "Wins people this week, one at a time. None of it is still working next month — stop selling and the arrivals stop with you.",
      },
      {
        term: "Marketing",
        detail:
          "Feeds brand, which brings people in on its own. Slow to start, decays 6% a week if neglected, and eventually the only thing still working.",
      },
      {
        term: "Churn",
        detail:
          "The share of your customers who leave every week. It falls as the product improves, which is why building is the only permanent fix for a leaking bucket.",
      },
      {
        term: "Price",
        detail:
          "Revenue is customers times price, so putting it up is the fastest lever you have. The least committed leave the moment you do.",
      },
    ],
  },

  "founder-team": {
    id: "founder-team" as LessonId,
    screen: "crew",
    title: "Every hire is priced in weeks",
    intro:
      "A salary is not what somebody costs. What they cost is the runway they shorten, and the screen tells you that figure before you commit.",
    points: [
      {
        term: "What a hire really costs",
        detail:
          "The fee to bring them in, then their salary against the clock for ever. Each role shows the weeks of runway it takes off you.",
      },
      {
        term: "What they buy",
        detail:
          "Output you cannot produce alone. A hire makes each block do more, but never makes a block free — you still only get six.",
      },
      {
        term: "Letting somebody go",
        detail:
          "Buys weeks immediately, and is the only lever that works when no round will have you. It is not a failure state; it is the brake.",
      },
    ],
  },

  "founder-raising": {
    id: "founder-raising" as LessonId,
    screen: "raising",
    title: "Money buys weeks and costs the company",
    intro:
      "A round is the only way to add runway you have not earned, and the only decision here you can never take back.",
    points: [
      {
        term: "Dilution",
        detail:
          "The share of the company the round takes. It is permanent: every later round dilutes what is left of what you kept, not what you started with.",
      },
      {
        term: "Pitching",
        detail:
          "A round moves only on the blocks you spend on it, over several weeks. Starting one when the runway is already short usually means finishing it too late.",
      },
      {
        term: "Diligence",
        detail:
          "The terms are set by traction, and checked again when the round closes. If the thing that qualified you has stopped being true, the money does not arrive.",
      },
    ],
  },
};

export function founderLearned(id: string, state: RunState): boolean {
  const v = venture(state);
  switch (id) {
    case "founder-first-week":
      return state.history.length > 0;
    case "founder-runway":
      return v.users > 0;
    case "founder-team":
      return v.team.length > 0;
    case "founder-raising":
      return v.roundsClosed.length > 0 || Boolean(v.pitchRound);
    default:
      return true;
  }
}

export function founderRelevant(
  id: string,
  state: RunState,
  ctx: TeachContext,
): boolean {
  const v = venture(state);
  switch (id) {
    case "founder-first-week":
      return state.history.length === 0 && state.week <= 2;
    case "founder-runway":
      return ctx.hasReport || state.week >= 2;
    case "founder-team":
      /* Only once a hire is affordable — before that it is a lesson about a
         button the player cannot press. */
      return state.r.cash > 0 && state.week >= 3;
    case "founder-raising":
      return ROUNDS.some((r) => roundBlocker(v, r) === null) || state.week >= 6;
    default:
      return false;
  }
}

/* ------------------------------------------------------------- the words */

export const STARTUP_TERMS: Term[] = [
  {
    id: "insight",
    term: "Insight",
    plain: "What you know about your customers",
    detail:
      "Raised by spending a block talking to customers, and it fades if you stop. Everything you build lands better with it, more trials convert, and an experiment run with it finds more.",
  },
  {
    id: "technical-debt",
    term: "Technical debt",
    plain: "The corners you cut, compounding",
    detail:
      "Shipping fast accrues it; every point costs a little extra churn and dearer servers, every week, until stability weeks on the roadmap pay it down. Steady accrues nothing.",
  },
  {
    id: "funnel",
    term: "The funnel",
    plain: "Looked, tried, paid",
    detail:
      "How a stranger becomes a customer: people who found the product, the share who tried it, the share of those who paid. Marketing widens the top; insight and experiments improve the rates.",
  },
  {
    id: "experiment",
    term: "Experiment",
    plain: "A test with a bill and a readout",
    detail:
      "Costs real money, takes two weeks, and permanently lifts one stage of the funnel by however much it measured. Each can run once — the second rewrite is a redesign.",
  },
  {
    id: "runway",
    term: "Runway",
    plain: "Weeks of cash left",
    detail:
      "Cash divided by the money leaving every week after revenue. This career is scored in weeks rather than money, and every decision converts into this number.",
  },
  {
    id: "burn",
    term: "Burn",
    plain: "What leaves every week",
    detail:
      "Your own costs plus every salary on the payroll. Charged whether or not the week went well, which is why a hire is priced in weeks rather than pounds.",
  },
  {
    id: "default-alive",
    term: "Default alive",
    plain: "Revenue covers burn",
    detail:
      "The point where the company stops running out. Nothing else in this career is permanent — rounds dilute, customers leave, brand decays — and this does not.",
  },
  {
    id: "churn",
    term: "Churn",
    plain: "Customers who leave",
    detail:
      "The share of your customers who go every week. Selling wins people back; only a better product stops them going in the first place.",
  },
  {
    id: "brand",
    term: "Brand",
    plain: "People arriving on their own",
    detail:
      "A stock of attention that brings customers in without you. It decays 6% a week, so it is built by marketing repeatedly rather than once.",
  },
  {
    id: "dilution",
    term: "Dilution",
    plain: "The share a round costs",
    detail:
      "What you give up permanently for the money. Later rounds take their share of whatever you have left, so the first one is cheaper than it looks.",
  },
  {
    id: "diligence",
    term: "Diligence",
    plain: "The check before the money",
    detail:
      "Investors re-examine the company as the round closes. If whatever qualified you for those terms has stopped being true, the round falls through.",
  },
];
