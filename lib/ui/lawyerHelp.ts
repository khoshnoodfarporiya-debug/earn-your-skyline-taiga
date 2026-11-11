import type { RunState } from "../game/types";
import { money } from "../game/format";
import {
  CASE_BY_ID,
  billsOf,
  billsOwed,
  chambersRent,
  hasClerk,
  hoursNeededFor,
  hoursOutstanding,
  legalWages,
  oddsFor,
  settlementFor,
  staffHours,
  workInProgress,
} from "../game/careers/casework";
import { practice } from "../game/careers/lawyer";
import type { Alert } from "./alerts";
import type { Step } from "./guidance";
import type { Lesson, LessonId, TeachContext } from "./onboarding";
import type { Term } from "./glossary";

/**
 * WHAT THE INTERFACE TELLS A SOLICITOR
 *
 * The badges on the navigation, the one next step on the Overview, the lessons
 * that retire themselves, and the words. All four of those systems were built
 * for the Physician and returned empty for everybody else — so a Solicitor run
 * had no badges, no guidance, no lessons, and a glossary button that did not
 * render. The machinery was always career-agnostic; only the content was
 * missing, and this file is the content.
 *
 * Everything here is derived from the practice, never stored, and every
 * sentence is in this career's own words: instructions, hearings, costs and
 * bills. Nothing borrows a word from the other two.
 */

/* ------------------------------------------------------------------ alerts */

/**
 * What is urgent in a practice, in the order it actually kills one.
 *
 * The ordering matters more here than in the other careers because the things
 * that go wrong are weeks apart from their causes. A hearing you are not ready
 * for is worse than being overdrawn, because the overdraft is this week's
 * problem and the hearing is the reason next month has no money in it.
 */
export function lawyerAlerts(state: RunState): Alert[] {
  const p = practice(state);
  const out: Alert[] = [];
  const weekly = chambersRent(p) + legalWages(p);

  /* ------------------------------------------------------- what is listed */
  const listed = [...p.cases].sort((a, b) => a.dueWeek - b.dueWeek);
  for (const c of listed) {
    const k = CASE_BY_ID.get(c.kind);
    if (!k) continue;
    const away = c.dueWeek - state.week;
    if (away > 3) continue;
    const ready = Math.min(1, c.hoursDone / hoursNeededFor(p, k));

    if (ready < 1) {
      out.push({
        id: `hearing:unready:${c.id}`,
        severity: away <= 1 ? "critical" : "warning",
        title: `${k.label} is ${Math.round(ready * 100)}% prepared`,
        detail: `Heard ${away <= 0 ? "this week" : `in ${away} week${away === 1 ? "" : "s"}`}, and ${Math.round(hoursNeededFor(p, k) - c.hoursDone)} hours short. Arriving without the hours is close to conceding — and losing costs you their costs as well as your own.`,
        destination: "casework",
        actionLabel: "See the file",
      });
      continue;
    }

    /*
     * Ready, and still a coin toss. This is the career's actual decision, so
     * the alert states both numbers rather than telling the player what to do
     * with them.
     */
    const odds = oddsFor(c, p, state.r.skill);
    if (odds < 0.55) {
      out.push({
        id: `hearing:odds:${c.id}`,
        severity: "warning",
        title: `${k.label} is ${Math.round(odds * 100)}% as it stands`,
        detail: `Heard ${away <= 0 ? "this week" : `in ${away} week${away === 1 ? "" : "s"}`}. Settling pays ${money(settlementFor(c, p, state.r.skill))} today and avoids their costs entirely; the door pays everything or nothing.`,
        destination: "casework",
        actionLabel: "Settle or run it",
      });
    }
  }

  /* Something the court has moved. Worth saying out loud, because the cost of
     it is invisible: the fee went further away and the rent did not. */
  const putBack = p.cases.filter((c) => (c.adjournments ?? 0) > 0);
  if (putBack.length > 0 && !hasClerk(p)) {
    out.push({
      id: "listing:relisted",
      severity: "info",
      title:
        putBack.length === 1
          ? "A hearing has been put back"
          : `${putBack.length} hearings have been put back`,
      detail:
        "Every adjournment is more weeks of chambers rent against the same fee, and a lower offer from the other side. A practice clerk keeps most of your dates where the court put them.",
      destination: "firm",
      actionLabel: "Look at the firm",
    });
  }

  /* --------------------------------------------------------------- money */
  if (state.r.cash < 0) {
    out.push({
      id: "cash:negative",
      severity: "critical",
      title: "Overdrawn",
      detail: `${money(state.r.cash)} in the client account. Far enough under and the practice goes into administration — a setback you trade your way out of, not an ending, and an expensive one.`,
      destination: "ledger",
      actionLabel: "Open the books",
    });
  } else if (weekly > 0 && state.r.cash < weekly * 3) {
    out.push({
      id: "cash:thin",
      severity: "warning",
      title: "Under three weeks of cover",
      detail: `${money(state.r.cash)} against ${money(weekly)} a week that falls due whether or not anything settles. In this career the next fee is usually further away than three weeks.`,
      destination: "ledger",
      actionLabel: "Open the books",
    });
  }

  /*
   * Owed money you cannot spend — the career's premise, as an alert.
   *
   * Only fires when the firm is actually short, because a judgment sitting on
   * the books is a perfectly good thing to be holding when you are solvent.
   */
  const owed = billsOwed(p);
  if (owed > 0 && weekly > 0 && state.r.cash < weekly * 4) {
    const soonest = [...billsOf(p)].sort((a, b) => a.dueWeek - b.dueWeek)[0];
    out.push({
      id: "bills:owed",
      severity: "warning",
      title: `${money(owed)} owed to you, and none of it is money`,
      detail: `The next lands week ${soonest?.dueWeek ?? state.week}. A factor will buy the wait off you today at a discount — which is worse arithmetic and better solvency.`,
      destination: "ledger",
      actionLabel: "Sell a judgment",
    });
  }

  /* ------------------------------------------------------- the work itself */
  const owedHours = hoursOutstanding(p);
  const mine = 12 + state.r.skill * 0.12;
  const canFind = mine * 4 + staffHours(p);
  if (owedHours > canFind * 3 && p.cases.length > 0) {
    out.push({
      id: "hours:short",
      severity: "warning",
      title: "More work on the books than hours to do it",
      detail: `${Math.round(owedHours)} hours outstanding against about ${Math.round(canFind)} a week if you spend the whole week on files. Somebody else's hours are the only other source.`,
      destination: "firm",
      actionLabel: "Look at the firm",
    });
  }

  if (p.cases.length === 0 && p.offers.length === 0 && state.week > 2) {
    out.push({
      id: "pipeline:empty",
      severity: "warning",
      title: "Nothing on the books and nothing on the table",
      detail:
        "Chambers rent is due either way. Pitching for work is the block that puts instructions in the door; standing is what decides how big they are.",
      destination: "instructions",
      actionLabel: "See what is on the table",
    });
  }

  /* A conflict is the one thing on the Instructions screen that is a reason
     not to press the button, so it is worth surfacing before the offer is
     taken rather than after the regulator has read the file. */
  const conflicted = p.offers.filter((o) => o.conflict);
  if (conflicted.length > 0) {
    out.push({
      id: "conflict:offered",
      severity: "warning",
      title: "You are being asked to act against a former client",
      detail: `${conflicted[0].client} wants you against ${conflicted[0].opponent}. You may take it. If you do, the regulator may read the file after judgment, and standing decides the size of everything you are sent afterwards.`,
      destination: "instructions",
      actionLabel: "Read the instruction",
    });
  }

  /* An instruction going cold. Small, but it is the one alert that expires. */
  const cooling = p.offers.filter((o) => o.expiresWeek - state.week <= 1);
  if (cooling.length > 0 && p.cases.length < 3) {
    out.push({
      id: "offers:cooling",
      severity: "info",
      title:
        cooling.length === 1
          ? "An instruction goes cold next week"
          : `${cooling.length} instructions go cold next week`,
      detail:
        "Nobody waits. What is on the table now is what this market and your standing currently produce.",
      destination: "instructions",
      actionLabel: "Take it or leave it",
    });
  }

  /* ------------------------------------------------------------------ you */
  if (state.r.burnout >= 85) {
    out.push({
      id: "burnout:critical",
      severity: "critical",
      title: "Burnout critical",
      detail:
        "At 100 you are signed off — a setback you climb out of, not an ending. Rest is the only thing that brings it down, and a week of rest is a week of hours nobody put into a file.",
      destination: "overview",
      actionLabel: "Assign rest",
    });
  } else if (state.r.burnout >= 68) {
    out.push({
      id: "burnout:high",
      severity: "warning",
      title: "Burnout high",
      detail:
        "Above 80 your week is five blocks rather than six, which in this career is a fifth of the hours going into every file you are carrying.",
      destination: "overview",
      actionLabel: "Assign rest",
    });
  }

  return out;
}

/* -------------------------------------------------------------- next step */

/**
 * One sentence about what to do next, derived from where the practice is.
 *
 * Ordered so the sequence teaches the loop: get an instruction, put hours into
 * it, decide what to do with it, and only then worry about the firm around it.
 */
export function lawyerStep(state: RunState, alloc: Record<string, number>): Step | null {
  const p = practice(state);
  const week = state.week;

  if (p.cases.length === 0 && p.offers.length === 0) {
    return {
      id: "law:pitch",
      title: "Nobody has instructed you yet",
      detail:
        "A block spent pitching puts work on the table. Nothing else fills the pipeline in week one.",
    };
  }

  if (p.cases.length === 0 && p.offers.length > 0) {
    return {
      id: "law:take",
      title: "There is work on the table",
      detail:
        "Read who is paying and when before you accept — that is a term of the instruction, not a surprise afterwards.",
      destination: "instructions",
      actionLabel: "Open Instructions",
    };
  }

  if (hoursOutstanding(p) > 0 && (alloc.casework ?? 0) === 0) {
    return {
      id: "law:casework",
      title: "Nobody is doing the work",
      detail:
        "Casework is the block that puts hours into files. A matter that reaches its date short of hours is close to conceding.",
    };
  }

  /* The decision the career is built around, offered once there is one to
     make rather than as a standing lecture. */
  const soon = [...p.cases]
    .filter((c) => c.dueWeek - week <= 3)
    .sort((a, b) => a.dueWeek - b.dueWeek)[0];
  if (soon) {
    const k = CASE_BY_ID.get(soon.kind);
    const odds = oddsFor(soon, p, state.r.skill);
    if (k && odds < 0.6) {
      return {
        id: "law:settle",
        title: `${k.label} is heard in ${Math.max(0, soon.dueWeek - week)} weeks`,
        detail: `${Math.round(odds * 100)}% as it stands. Settling is certain money and no costs order; the door is the whole fee or nothing at all.`,
        destination: "casework",
        actionLabel: "Open Casework",
      };
    }
  }

  const mine = (12 + state.r.skill * 0.12) * 4;
  if (week >= 8 && p.staff.length === 0 && hoursOutstanding(p) > mine * 2) {
    return {
      id: "law:hire",
      title: "Every hour in every file is your own",
      detail:
        "Somebody else's hours are the only way the practice carries more than you can personally reach. The roll is on the phone.",
      destination: "firm",
      actionLabel: "Open The firm",
    };
  }

  const weekly = chambersRent(p) + legalWages(p);
  if (billsOwed(p) > 0 && weekly > 0 && state.r.cash < weekly * 4) {
    return {
      id: "law:factor",
      title: "You are owed money you cannot spend",
      detail:
        "A judgment is not a payment. Selling one raises cash today at a discount that gets worse the further off it is.",
      destination: "ledger",
      actionLabel: "Open The books",
    };
  }

  if (week >= 14 && workInProgress(p) > 0 && p.cases.length >= 3) {
    return {
      id: "law:wip",
      title: `${money(workInProgress(p))} of work in progress`,
      detail:
        "Hours already spent on matters that have not paid. It is the number that kills firms, and it is not on the balance sheet as cash.",
      destination: "ledger",
      actionLabel: "Open The books",
    };
  }

  return null;
}

/* ---------------------------------------------------------------- lessons */

export const LAWYER_LESSON_IDS = [
  "law-first-week",
  "law-instructions",
  "law-casework",
  "law-books",
  "law-firm",
] as const;

export const LAWYER_LESSONS: Record<string, Lesson> = {
  "law-first-week": {
    id: "law-first-week" as LessonId,
    screen: "overview",
    title: "A week is six blocks, and none of them pay",
    intro:
      "Everything costs a block, nothing happens until you commit, and — unlike most work — none of what you do this week produces any money this week.",
    points: [
      {
        term: "Time blocks",
        detail:
          "Six of them, refilled weekly. Casework puts hours into files; pitching puts instructions on the table; research moves the odds on everything you run. Unspent blocks are wasted.",
      },
      {
        term: "Why nothing pays",
        detail:
          "Work is paid on settlement or judgment, months after you do it. Chambers rent falls due every week in between. A practice doing brilliant work can be three weeks from insolvency.",
      },
      {
        term: "Standing",
        detail:
          "Decides the size of instruction you are offered, not how many. A firm nobody has heard of still gets house purchases; it never gets the group claim.",
      },
      {
        term: "Commit week",
        detail:
          "Hours go into files, dates arrive, the court decides what it decides, and the rent is taken. Nothing is committed until you press it.",
      },
    ],
  },

  "law-instructions": {
    id: "law-instructions" as LessonId,
    screen: "instructions",
    title: "What you accept is half the game",
    intro:
      "An instruction is a lump of hours you must find before it can resolve, against a date you do not control.",
    points: [
      {
        term: "Hours and the window",
        detail:
          "Every kind of work needs a minimum before it can resolve at all, and has a fixed number of weeks until it is heard. A group claim is 190 hours before a penny.",
      },
      {
        term: "Who is paying",
        detail:
          "Stated on the instruction before you take it. A prompt payer hands over money at judgment; anyone else hands over a bill that matures weeks later, and a doubtful one may argue it down.",
      },
      {
        term: "What this market sends",
        detail:
          "Two different gates. Standing is what you have earned and it rises. Reach is what this city has and it does not — some markets never send the largest work however well you are regarded.",
      },
      {
        term: "Conflicts",
        detail:
          "An instruction against somebody you have acted for is marked. You may take it. The regulator may read the file afterwards, and standing is what decides everything you are sent next.",
      },
    ],
  },

  "law-casework": {
    id: "law-casework" as LessonId,
    screen: "casework",
    title: "Settle, or go to the door",
    intro:
      "Every live matter carries an offer that rises as your position improves. Taking it is certain money at a discount; refusing it is how the good runs happen and how the bad ones end.",
    points: [
      {
        term: "Prepared",
        detail:
          "Hours against the minimum the work needs. Reaching a hearing short of them is close to conceding. Hours beyond the minimum are preparation and genuinely improve the odds.",
      },
      {
        term: "The odds",
        detail:
          "Shown honestly and capped below certainty. There is no amount of work that makes a contested matter safe, which is what makes settling a judgement rather than a mistake.",
      },
      {
        term: "Costs follow the event",
        detail:
          "Losing does not merely fail to pay. The other side's costs are yours, and they are real money. Settling avoids them entirely, which is the actual reason solicitors settle.",
      },
      {
        term: "The date can move",
        detail:
          "A hearing can be relisted and put back weeks. Your hours are already spent, the rent still runs, and the other side's offer falls a little each time it happens.",
      },
    ],
  },

  "law-books": {
    id: "law-books" as LessonId,
    screen: "ledger",
    title: "Three kinds of money, and only one of them is money",
    intro:
      "The books separate what you have from what you are owed from what you have merely done — and only the first pays chambers.",
    points: [
      {
        term: "Cash",
        detail:
          "What is actually in the client account. The only one of the three that pays rent, salaries or a costs order.",
      },
      {
        term: "Owed to you",
        detail:
          "Judgments that have not turned into money yet. A factor will buy the wait off you at a discount that gets worse the further off the bill is.",
      },
      {
        term: "Work in progress",
        detail:
          "Hours already spent on matters that have not resolved. Not on the balance sheet as cash, not free to carry, and the number that kills firms.",
      },
      {
        term: "What falls due anyway",
        detail:
          "Chambers rent and salaries, every week, whether or not anything settled. Weeks of cover is the figure to watch — this career's next fee is usually further off than you think.",
      },
    ],
  },

  "law-firm": {
    id: "law-firm" as LessonId,
    screen: "firm",
    title: "Other people's hours",
    intro:
      "You can only personally reach so many hours a week. Everything the practice carries beyond that is somebody else's.",
    points: [
      {
        term: "Hours against salary",
        detail:
          "Everyone you take on adds hours to the pipeline and a salary that falls due every week, settled or not. Hire against the work in the building, not against the balance.",
      },
      {
        term: "The practice clerk",
        detail:
          "Almost no hours, and the only hire that attacks the real problem: they keep your dates where the court put them and get the bills in sooner.",
      },
      {
        term: "The record",
        detail:
          "What a court has actually said, against what you were told it might. The only place to check whether the odds you were shown have held.",
      },
    ],
  },
};

/** Has the player already shown they understand this? */
export function lawyerLearned(id: string, state: RunState): boolean {
  const p = practice(state);
  switch (id) {
    case "law-first-week":
      return state.history.length > 0;
    case "law-instructions":
      /* Taking one is the lesson, demonstrated. */
      return p.cases.length > 0 || p.lastVerdicts.length > 0;
    case "law-casework":
      return p.lastVerdicts.length > 0;
    case "law-books":
      return state.history.length >= 6;
    case "law-firm":
      return p.staff.length > 0;
    default:
      return true;
  }
}

/** Is this system on screen and about to matter? */
export function lawyerRelevant(
  id: string,
  state: RunState,
  ctx: TeachContext,
): boolean {
  const p = practice(state);
  switch (id) {
    case "law-first-week":
      return state.history.length === 0 && state.week <= 2;
    case "law-instructions":
      return p.offers.length > 0 || state.week >= 2;
    case "law-casework":
      return p.cases.length > 0;
    case "law-books":
      return ctx.hasReport;
    case "law-firm":
      return hoursOutstanding(p) > 0 && state.week >= 4;
    default:
      return false;
  }
}

/* ------------------------------------------------------------ the words */

export const LEGAL_TERMS: Term[] = [
  {
    id: "instruction",
    term: "Instruction",
    plain: "A client asking you to act",
    detail:
      "A piece of work on the table. Accepting it puts a lump of hours on your books against a fixed number of weeks until it is heard. Instructions expire if you leave them.",
  },
  {
    id: "wip",
    term: "Work in progress",
    plain: "Hours you have done and not been paid for",
    detail:
      "The value of work sitting in unresolved matters. It is not cash, it is not certain, and carrying too much of it is how a busy practice becomes an insolvent one.",
  },
  {
    id: "settlement",
    term: "Settlement",
    plain: "Taking a smaller sum to end it now",
    detail:
      "A fraction of the fee, available immediately, certain, and it avoids any costs order. It rises as your position improves — so the better your case, the more you are being offered to give it up.",
  },
  {
    id: "costs-order",
    term: "Costs order",
    plain: "Paying the other side's solicitors",
    detail:
      "Costs follow the event: lose a contested matter and you pay a share of what the winning side spent, on top of being paid nothing yourself. Counsel argues them down; settling avoids them.",
  },
  {
    id: "relisting",
    term: "Relisting",
    plain: "The court moving your hearing",
    detail:
      "A date can be put back by weeks. The hours are already spent, chambers rent keeps running, and the other side's offer falls a little for the wait. A practice clerk makes it rarer.",
  },
  {
    id: "counsel",
    term: "Counsel",
    plain: "A barrister you brief for the hearing",
    detail:
      "Paid now, out of cash you may not have, for better odds at a hearing that may be months away — and a much smaller costs order if it still goes against you.",
  },
  {
    id: "factoring",
    term: "Factoring",
    plain: "Selling a judgment for cash today",
    detail:
      "A court has said the money is yours; you cannot pay rent with that sentence. A factor buys the wait, at a discount that is worse the further off the bill is.",
  },
  {
    id: "payer",
    term: "Payer",
    plain: "Whether the client actually pays",
    detail:
      "Stated on the instruction before you take it. Prompt, slow or doubtful — and the largest work is systematically the slowest, because it is funded by people with a process.",
  },
  {
    id: "reach",
    term: "Reach",
    plain: "The biggest work this city ever sends",
    detail:
      "A ceiling belonging to the market, not to you. Standing rises with what you do; reach does not, so some cities will never send the work that would change the firm.",
  },
];
