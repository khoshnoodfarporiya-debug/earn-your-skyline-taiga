import type { RunState } from "../game/types";
import { money } from "../game/format";
import {
  KIND_BY_ID,
  competitionOdds,
  revisionRisk,
  stageOf,
  studioWages,
  unbanked,
  studio,
} from "../game/careers/studio";
import type { Alert } from "./alerts";
import type { Step } from "./guidance";
import type { Lesson, LessonId, TeachContext } from "./onboarding";
import type { Term } from "./glossary";

/**
 * WHAT THE INTERFACE TELLS AN ARCHITECT
 *
 * The badges, the one next step, the lessons and the words — four systems that
 * were career-agnostic and returned nothing for this career. This is the
 * content they were missing.
 *
 * One rule shapes it, the way runway shapes the Founder's and the count shapes
 * the Politician's: **a stage you have finished is yours and a stage you have
 * not is on loan.** So everything here is stated in terms of what is banked
 * against what could still be taken away, and the defence — being seen — is
 * named every time the risk is.
 */

/* ------------------------------------------------------------------ alerts */

export function architectAlerts(state: RunState): Alert[] {
  const a = studio(state);
  const out: Alert[] = [];
  const live = a.commissions.filter((c) => !c.done);

  /* ------------------------------------------- clients about to redraw you */
  for (const c of live) {
    const risk = revisionRisk(a, c, state.week);
    if (risk < 0.2) continue;
    const kind = KIND_BY_ID.get(c.kind);
    const seen = Math.max(0, state.week - c.lastSeen);
    out.push({
      id: `arch:risk:${c.id}`,
      severity: risk > 0.32 ? "critical" : "warning",
      title: `${kind?.label ?? "A commission"} could be sent back`,
      detail: `${Math.round(risk * 100)}% that ${c.client} changes the brief this week, and you last saw them ${seen === 0 ? "this week" : `${seen} weeks ago`}. Seeing them is the only defence.`,
      destination: "boards",
      actionLabel: "See the commission",
    });
  }

  /* ----------------------------------------------- work that has been redrawn */
  const redrawn = live.filter((c) => c.revisions >= 2);
  for (const c of redrawn) {
    const kind = KIND_BY_ID.get(c.kind);
    out.push({
      id: `arch:redrawn:${c.id}`,
      severity: "warning",
      title: `${kind?.label ?? "A commission"} has been redrawn ${c.revisions}×`,
      detail:
        "Those weeks are gone and the fee for them was never banked. A client this changeable is worth resigning over.",
      destination: "boards",
      actionLabel: "Look at it",
    });
  }

  /* ----------------------------------------------------- nothing to draw */
  if (live.length === 0) {
    out.push({
      id: "arch:empty",
      severity: a.offers.length > 0 ? "warning" : "critical",
      title: "Nothing on the boards",
      detail:
        a.offers.length > 0
          ? "Work has been offered to you and it goes elsewhere if you leave it."
          : "No commissions and nothing offered. Courting work is the only thing that puts something on the board.",
      destination: a.offers.length > 0 ? "offers" : "boards",
      actionLabel: a.offers.length > 0 ? "See what is offered" : "Court work",
    });
  } else if (a.offers.length > 0) {
    out.push({
      id: "arch:offers",
      severity: "info",
      title: `${a.offers.length} commission${a.offers.length === 1 ? "" : "s"} offered`,
      detail:
        "What you are asked for depends on what you have already built. Anything left on the table goes to somebody else.",
      destination: "offers",
      actionLabel: "See them",
    });
  }

  /* ------------------------------------------------------- the competition */
  if (a.competition) {
    const away = a.competition.judgedWeek - state.week;
    const odds = competitionOdds(a.competition, state.r.reputation);
    if (away <= 3) {
      out.push({
        id: "arch:comp",
        severity: odds < 0.15 ? "warning" : "info",
        title: `Judged in ${away} week${away === 1 ? "" : "s"}`,
        detail: `${Math.round(odds * 100)}% on the work you have put in. Every further week of drawing improves it, and none of it is paid unless you win.`,
        destination: "competitions",
        actionLabel: "See the entry",
      });
    }
  }

  /* --------------------------------------------- wages against nothing earned */
  const wages = studioWages(a);
  if (wages > 0 && live.length === 0) {
    out.push({
      id: "arch:wages",
      severity: "critical",
      title: "A studio with nothing on the board",
      detail: `${money(wages)} a week in wages and nothing being drawn. They are paid whether or not there is work for them.`,
      destination: "atelier",
      actionLabel: "Look at the studio",
    });
  }

  return out;
}

/* --------------------------------------------------------------- next step */

export function architectStep(
  state: RunState,
  alloc: Record<string, number>,
): Step | null {
  const a = studio(state);
  const live = a.commissions.filter((c) => !c.done);

  /* --- nothing to draw --------------------------------------------------- */
  if (live.length === 0) {
    return a.offers.length > 0
      ? {
          id: "arch:take",
          title: "Take something on",
          detail:
            "Nothing is on the boards, and an offer left standing goes to another practice.",
          destination: "offers",
          actionLabel: "See what is offered",
        }
      : {
          id: "arch:court",
          title: "Spend a week courting work",
          detail:
            "No commissions and nothing offered. Nothing else in the career can start until something is on the board.",
          destination: "boards",
          actionLabel: "See the boards",
        };
  }

  /* --- go and see the one most likely to turn on you --------------------- */
  const worst = live
    .map((c) => ({ c, risk: revisionRisk(a, c, state.week) }))
    .sort((x, y) => y.risk - x.risk)[0];
  if (worst && worst.risk > 0.18 && (alloc.client ?? 0) === 0) {
    const kind = KIND_BY_ID.get(worst.c.kind);
    return {
      id: "arch:see-client",
      title: `Go and see ${worst.c.client}`,
      detail: `${Math.round(worst.risk * 100)}% that the ${(kind?.label ?? "brief").toLowerCase()} is sent back a stage this week. A visit is the only thing that lowers it.`,
      destination: "boards",
      actionLabel: "See the commission",
    };
  }

  /* --- unbanked work sitting on the board -------------------------------- */
  const exposed = live
    .map((c) => ({ c, owed: unbanked(a, c) }))
    .sort((x, y) => y.owed - x.owed)[0];
  if (exposed && exposed.owed > 0 && (alloc.draw ?? 0) === 0) {
    const stage = stageOf(exposed.c);
    return {
      id: "arch:draw",
      title: "Put a week on the board",
      detail: `${money(exposed.owed)} of ${exposed.c.client}'s fee is drawn but not yet banked. Finishing ${stage.label.toLowerCase()} is what banks it.`,
      destination: "boards",
      actionLabel: "See the boards",
    };
  }

  /* --- the competition needs the hours ----------------------------------- */
  if (a.competition && (alloc.compete ?? 0) === 0) {
    const away = a.competition.judgedWeek - state.week;
    return {
      id: "arch:compete",
      title: "Put a week into the competition",
      detail: `Judged in ${away} week${away === 1 ? "" : "s"}, and the odds are made of nothing but the work you put in.`,
      destination: "competitions",
      actionLabel: "See the entry",
    };
  }

  /* --- the studio, once there is enough to draw -------------------------- */
  if (live.length >= 2 && a.team.length === 0) {
    return {
      id: "arch:hire",
      title: "There is more on the board than one person draws",
      detail:
        "An assistant draws alongside you; an associate sees clients for you, which cuts every brief-change risk you are carrying.",
      destination: "atelier",
      actionLabel: "Look at the studio",
    };
  }

  return null;
}

/* ---------------------------------------------------------------- lessons */

export const ARCHITECT_LESSON_IDS = [
  "arch-first-week",
  "arch-stages",
  "arch-clients",
  "arch-competitions",
] as const;

export const ARCHITECT_LESSONS: Record<string, Lesson> = {
  "arch-first-week": {
    id: "arch-first-week" as LessonId,
    screen: "overview",
    title: "A week is six blocks, and a building takes years of them",
    intro:
      "Everything costs a block, nothing happens until you commit, and the work you are paid for is measured in stages rather than weeks.",
    points: [
      {
        term: "Time blocks",
        detail:
          "Six of them, refilled weekly. Drawing advances the building, seeing the client protects it, courting brings the next one in. Unspent blocks are wasted.",
      },
      {
        term: "Stages",
        detail:
          "A commission is five of them. Each pays its share of the fee the moment it is finished, and that money is yours whatever happens afterwards.",
      },
      {
        term: "Being sent back",
        detail:
          "A client can change the brief and return the building to an earlier stage. The fee already banked is safe; the drawings are not, and the weeks must be spent again.",
      },
      {
        term: "Commit week",
        detail:
          "Drawings advance, clients decide, competitions are judged and wages are paid. Nothing is committed until you press it.",
      },
    ],
  },

  "arch-stages": {
    id: "arch-stages" as LessonId,
    screen: "boards",
    title: "Finished is banked; nearly finished is not",
    intro:
      "The single distinction this career turns on, and the reason a busy month can leave you with nothing to show.",
    points: [
      {
        term: "Banked",
        detail:
          "The share of the fee paid for every stage you have completed. It is never returned, even if the client walks away or the building is abandoned.",
      },
      {
        term: "Unbanked",
        detail:
          "The weeks you have put into the stage you are on. Worth nothing until it is finished, and lost entirely if the brief changes under you.",
      },
      {
        term: "The board",
        detail:
          "Only one commission is being drawn at a time. Everything else waits, and waiting is what lets a client drift far enough away to change their mind.",
      },
    ],
  },

  "arch-clients": {
    id: "arch-clients" as LessonId,
    screen: "boards",
    title: "The client you have not seen is the one who redraws you",
    intro:
      "Every live commission carries a weekly chance the brief is reinvented, and recency is the whole defence against it.",
    points: [
      {
        term: "The risk",
        detail:
          "Shown as a percentage on every commission. It climbs the longer it has been since you actually sat with the client.",
      },
      {
        term: "Seeing them",
        detail:
          "A block spent with a client resets that clock. It draws nothing and advances nothing, which is exactly why it is easy to keep postponing.",
      },
      {
        term: "An associate",
        detail:
          "The one hire who is not about drawing. They see clients on your behalf, which cuts the risk on everything you are carrying at once.",
      },
      {
        term: "Resigning",
        detail:
          "A client who has already redrawn you twice will do it again. Walking away keeps everything banked so far and costs you the rest.",
      },
    ],
  },

  "arch-competitions": {
    id: "arch-competitions" as LessonId,
    screen: "competitions",
    title: "Months of unpaid work, and the only way to a museum",
    intro:
      "Competitions pay nothing unless you win, and usually you do not. They are still the only route to the buildings that change what you are offered.",
    points: [
      {
        term: "The odds",
        detail:
          "Made of the weeks you put in and the standing you already have. Nothing else moves them, and they are shown before you commit.",
      },
      {
        term: "The cost",
        detail:
          "An entry fee, and every week of drawing that goes into it instead of onto a commission that would have paid you.",
      },
      {
        term: "Why bother",
        detail:
          "What a practice is offered depends on what it has built. A won competition is the only thing that puts a landmark in a portfolio that has none.",
      },
    ],
  },
};

export function architectLearned(id: string, state: RunState): boolean {
  const a = studio(state);
  switch (id) {
    case "arch-first-week":
      return state.history.length > 0;
    case "arch-stages":
      return a.commissions.some((c) => c.stage > 0 || c.done);
    case "arch-clients":
      return a.commissions.some((c) => c.lastSeen > 0) || a.team.length > 0;
    case "arch-competitions":
      return Boolean(a.competition) || a.wonCompetitions > 0;
    default:
      return true;
  }
}

export function architectRelevant(
  id: string,
  state: RunState,
  ctx: TeachContext,
): boolean {
  const a = studio(state);
  switch (id) {
    case "arch-first-week":
      return state.history.length === 0 && state.week <= 2;
    case "arch-stages":
      return a.commissions.length > 0;
    case "arch-clients":
      return a.commissions.some(
        (c) => !c.done && revisionRisk(a, c, state.week) > 0.1,
      );
    case "arch-competitions":
      return ctx.hasReport && state.week >= 5;
    default:
      return false;
  }
}

/* ------------------------------------------------------------- the words */

export const STUDIO_TERMS: Term[] = [
  {
    id: "the-brief",
    term: "The brief",
    plain: "What the client actually wants most",
    detail:
      "Cheap, extraordinary or soon — the brief meeting decides which wins, once, while the job is young. Economy pays less and rarely surprises; signature pays more and dares the client to change their mind; programme trades nerves for weeks.",
  },
  {
    id: "consent",
    term: "Consent",
    plain: "Planning permission, granted",
    detail:
      "Lodged for a fee while the job is young, decided by a slow committee, occasionally deferred. A consented scheme is far harder to reinvent — the revision maths is halved for the rest of the job.",
  },
  {
    id: "value-engineering",
    term: "Value engineering",
    plain: "Making the tender land",
    detail:
      "An over-budget scheme fights at tender. Value engineering brings the cost plan back inside — for a haircut on the remaining fee, and a building slightly less than it was drawn to be. Once per job.",
  },
  {
    id: "embodied-carbon",
    term: "Embodied carbon",
    plain: "What the palette weighs",
    detail:
      "Some markets price it now. Mass timber reads well where they do; concrete reads badly. The building stands either way — the reviews do not.",
  },
  {
    id: "commission",
    term: "Commission",
    plain: "A building you are drawing",
    detail:
      "One client, one building, five stages. It pays as it goes rather than at the end, and it can be taken away at any point.",
  },
  {
    id: "stage",
    term: "Stage",
    plain: "One step of a building",
    detail:
      "The unit this career is paid in. Finishing one banks its share of the fee for good; being halfway through one is worth nothing.",
  },
  {
    id: "banked",
    term: "Banked",
    plain: "Fee you cannot lose",
    detail:
      "What the finished stages have already paid you. It survives a changed brief, a resignation and an abandoned building alike.",
  },
  {
    id: "revision",
    term: "Sent back",
    plain: "The brief changed",
    detail:
      "The client reinvents what they want and the building returns to an earlier stage. The drawings are gone and the weeks must be spent again.",
  },
  {
    id: "the-board",
    term: "The board",
    plain: "What is being drawn now",
    detail:
      "The one commission your drawing time goes into. Everything else sits still until you point the board at it.",
  },
  {
    id: "competition",
    term: "Competition",
    plain: "Unpaid work for a chance",
    detail:
      "An open contest for a building nobody has promised you. It costs an entry fee and months of drawing, and pays only if you win.",
  },
  {
    id: "portfolio",
    term: "Portfolio",
    plain: "What you have built",
    detail:
      "The finished buildings behind you. It decides what you are offered next, which is why a landmark is worth more than its fee.",
  },
];
