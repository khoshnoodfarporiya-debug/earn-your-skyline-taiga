import type { RunState } from "../game/types";
import { med } from "../game/careers/doctor";
import { activeCities } from "../game/medical/sim";
import type { ScreenId } from "./navigation";
import {
  CHEF_LESSONS,
  CHEF_LESSON_IDS,
  chefLearned,
  chefRelevant,
} from "./chefHelp";
import {
  LAWYER_LESSONS,
  LAWYER_LESSON_IDS,
  lawyerLearned,
  lawyerRelevant,
} from "./lawyerHelp";
import {
  FOUNDER_LESSONS,
  FOUNDER_LESSON_IDS,
  founderLearned,
  founderRelevant,
} from "./founderHelp";
import {
  POLITICIAN_LESSONS,
  POLITICIAN_LESSON_IDS,
  politicianLearned,
  politicianRelevant,
} from "./politicianHelp";
import {
  ARCHITECT_LESSONS,
  ARCHITECT_LESSON_IDS,
  architectLearned,
  architectRelevant,
} from "./architectHelp";
import {
  ENGINEER_LESSONS,
  ENGINEER_LESSON_IDS,
  engineerLearned,
  engineerRelevant,
} from "./engineerHelp";

/**
 * TEACHING THROUGH THE FIRST WEEKS
 *
 * Not a slideshow. A lesson appears on the screen where its system lives, at
 * the moment that system first matters, and retires itself the moment the
 * player does the thing it was explaining.
 *
 * ----------------------------------------------------------------- the shape
 *
 * Each lesson has three predicates and no state of its own:
 *
 *   relevant   is this system on screen and about to bind?
 *   learned    has the player already demonstrated they understand it?
 *   points     the two to five things the lesson actually teaches
 *
 * `learned` is the important one. Every other tutorial in this genre keeps
 * showing until you press a button, which measures patience rather than
 * comprehension. Here, hiring somebody retires the staffing lesson whether or
 * not it was ever read — and a player who arrives already knowing the genre
 * never sees a card at all.
 *
 * ------------------------------------------------------- why not in the save
 *
 * What has been taught lives in its own localStorage key, not in `RunState`.
 * Two reasons: a save written before this existed stays valid without a
 * migration, and teaching is a property of the *player*, not the character —
 * starting a second physician should not re-explain what a time block is.
 *
 * ------------------------------------------------------------ the vocabulary
 *
 * Lessons introduce the profession's real words rather than avoiding them, but
 * always plain-language first: "active patients — the game calls this your
 * panel". The glossary in `lib/ui/glossary.ts` is the same discipline applied
 * everywhere else.
 */

/**
 * Every lesson in the game, across every career.
 *
 * One union rather than three, because `taught` is a flat list in
 * localStorage and a player who has been told what a time block is has been
 * told — the ids are prefixed per career so nothing can collide.
 */
export type LessonId =
  /* The Physician's. */
  | "first-week"
  | "first-report"
  | "first-purchase"
  | "first-hire"
  | "first-qualification"
  | "first-city"
  /* The Chef's. */
  | "chef-first-week"
  | "chef-larder"
  | "chef-menu"
  | "chef-service"
  | "chef-brigade"
  /* The Solicitor's. */
  | "law-first-week"
  | "law-instructions"
  | "law-casework"
  | "law-books"
  | "law-firm"
  /* The Founder's. */
  | "founder-first-week"
  | "founder-runway"
  | "founder-team"
  | "founder-raising"
  /* The Politician's. */
  | "pol-first-week"
  | "pol-count"
  | "pol-positions"
  | "pol-ladder"
  /* The Architect's. */
  | "arch-first-week"
  | "arch-stages"
  | "arch-clients"
  | "arch-competitions"
  /* The Engineer's. */
  | "eng-first-week"
  | "eng-estimate"
  | "eng-certification"
  | "eng-field";

export interface LessonPoint {
  /** The term as the interface labels it. */
  term: string;
  /** What it means, in a sentence a non-clinician can read. */
  detail: string;
}

export interface Lesson {
  id: LessonId;
  /** Which screen it belongs on. */
  screen: ScreenId;
  title: string;
  /** One line of framing before the points. */
  intro: string;
  points: LessonPoint[];
  /** What the player should do next, when the lesson names one. */
  action?: { label: string; destination: ScreenId };
}

/** Everything the run needs to decide what to teach. */
export interface TeachContext {
  /** Blocks assigned in the week currently being planned. */
  allocated: number;
  /** True once a week has resolved and there is a report to read. */
  hasReport: boolean;
}

const MEDICAL_LESSONS: Record<string, Lesson> = {
  "first-week": {
    id: "first-week",
    screen: "overview",
    title: "A week is six blocks of your time",
    intro:
      "Everything in this game costs a block of the week, and nothing happens until you commit it.",
    points: [
      {
        term: "Time blocks",
        detail:
          "Six of them, refilled every week. Assign them below. Unspent blocks are simply wasted — the week resolves either way.",
      },
      {
        term: "Energy and burnout",
        detail:
          "Working blocks raise burnout; rest lowers it. Above 65 your skill is blunted and your standing bleeds. It is a condition you manage, not a health bar.",
      },
      {
        term: "Cash",
        detail:
          "Fixed costs are charged every week whether or not you treat anybody. Treating patients is how they get paid for.",
      },
      {
        term: "Commit week",
        detail:
          "Resolves the caseload, lands the bills, and shows you exactly what happened. Nothing is committed until you press it.",
      },
    ],
  },

  "first-report": {
    id: "first-report",
    screen: "caseload",
    title: "What happened to everyone who arrived",
    intro:
      "The caseload screen accounts for every patient who presented last week, and names what stopped the ones you did not treat.",
    points: [
      {
        term: "Arrivals",
        detail:
          "About a quarter of your active patients present in any given week. More of them arrive when your credibility is higher.",
      },
      {
        term: "Treated",
        detail:
          "The ones you got through. Each case consumes capacity in proportion to how serious it is.",
      },
      {
        term: "Referred out",
        detail:
          "Sent elsewhere. Not a bug and not a penalty screen — it is work walking out of the door, and it costs a little patient trust each time.",
      },
      {
        term: "Capacity",
        detail:
          "How much you can get through this week. It is the smaller of the room in your buildings and the hours your people have.",
      },
      {
        term: "Missing capabilities",
        detail:
          "A department you have not opened, a machine you do not own, or nobody qualified enough. Each is named, with the screen that fixes it.",
      },
    ],
    /* No action: the funnel it is describing is directly below. A button
       that navigates to the screen you are already on teaches distrust. */
  },

  "first-purchase": {
    id: "first-purchase",
    screen: "build",
    title: "Everything you buy has two prices",
    intro:
      "Each card states both, in the same order, every time — because the second one is what actually decides whether you can afford it.",
    points: [
      {
        term: "Now",
        detail:
          "The one-off cost, taken from cash the moment you buy. Property costs more in richer cities.",
      },
      {
        term: "Every week",
        detail:
          "Upkeep, charged for as long as you own it — including in a week where nobody comes through the door.",
      },
      {
        term: "What it needs",
        detail:
          "Some machines are useless without a technician to run them; some departments cannot take their own hardest cases without a consultant.",
      },
      {
        term: "What it does",
        detail:
          "More slots, more departments, or the ability to treat something you currently refer away. The card says which.",
      },
    ],
  },

  "first-hire": {
    id: "first-hire",
    screen: "staff",
    title: "People are capacity, and people are a fixed cost",
    intro:
      "Hiring is how the practice outgrows your own hours. It is also the largest permanent bill you will take on.",
    points: [
      {
        term: "Role",
        detail:
          "Clinicians treat patients. Nurses multiply what every clinician gets through. Technicians run the machines. Administrators buy back your time.",
      },
      {
        term: "Salary",
        detail:
          "Charged every week, adjusted for what wages cost in the cities you operate in. It does not fall in a quiet week.",
      },
      {
        term: "Capacity",
        detail:
          "Measured in units. A minor case costs about one; major surgery costs twelve. A general practitioner adds twenty-six a week.",
      },
      {
        term: "Morale, workload and culture",
        detail:
          "How it feels to work here, as a number between 0 and 100. It multiplies everything your staff get through, and below 25 people start leaving.",
      },
    ],
    action: { label: "Look at the team", destination: "team" },
  },

  "first-qualification": {
    id: "first-qualification",
    screen: "career",
    title: "What the practice can do, and what you can do",
    intro:
      "These are two different things, and the difference is the whole of the career ladder.",
    points: [
      {
        term: "What the organisation offers",
        detail:
          "A department is open, the equipment is installed, and somebody on the payroll is qualified for the case. That somebody does not have to be you.",
      },
      {
        term: "What you can personally perform",
        detail:
          "Your own ceiling, raised by qualifications. Without them you can take routine cases in any open department and nothing harder.",
      },
      {
        term: "Employ, or become",
        detail:
          "Both open the same gate. Employing is faster and costs a salary forever; qualifying is slow, one-off, and cheaper for the rest of the run.",
      },
      {
        term: "Professional learning points",
        detail:
          "The game calls these CPD. You earn them by studying and spend them on qualifications — they are the gate that time, not money, controls.",
      },
    ],
  },

  "first-city": {
    id: "first-city",
    screen: "cities",
    title: "A second city is a second business",
    intro:
      "Expanding is how the late game exists, and it is the most expensive mistake available to you.",
    points: [
      {
        term: "Licence",
        detail:
          "Permission to operate. Buying one changes nothing on its own — patients only arrive where premises actually stand.",
      },
      {
        term: "Premises",
        detail:
          "You have to build there too, at that city's property prices, before a single patient exists in the market.",
      },
      {
        term: "Demand and competition",
        detail:
          "Each market has its own population, its own fee levels and its own incumbents. A rich city with entrenched rivals can be worth less than a poor one without them.",
      },
      {
        term: "Running costs",
        detail:
          "Upkeep and wages both scale with local costs, and they start the week you buy. Revenue starts later, once a panel has built up.",
      },
      {
        term: "Why it looks like a loss",
        detail:
          "Your own clinical hours only count where you personally are. A distant site has to be staffed, not visited — which is why a second city is a hiring decision before it is a property one.",
      },
    ],
  },
};

/** Every career's lessons, in one index so `lessonFor` has one lookup. */
export const LESSONS: Record<string, Lesson> = {
  ...MEDICAL_LESSONS,
  ...CHEF_LESSONS,
  ...LAWYER_LESSONS,
  ...FOUNDER_LESSONS,
  ...POLITICIAN_LESSONS,
  ...ARCHITECT_LESSONS,
  ...ENGINEER_LESSONS,
};

const MEDICAL_ORDER: LessonId[] = [
  "first-week",
  "first-report",
  "first-purchase",
  "first-hire",
  "first-qualification",
  "first-city",
];

/**
 * The order lessons are offered in, for this career.
 *
 * Per career rather than global: the sequences teach different loops, and a
 * Chef has no use for being told about qualifications in a fixed position
 * between two kitchen lessons.
 */
export function lessonOrderFor(careerId: string): LessonId[] {
  if (careerId === "chef") return [...CHEF_LESSON_IDS] as LessonId[];
  if (careerId === "lawyer") return [...LAWYER_LESSON_IDS] as LessonId[];
  if (careerId === "founder") return [...FOUNDER_LESSON_IDS] as LessonId[];
  if (careerId === "politician")
    return [...POLITICIAN_LESSON_IDS] as LessonId[];
  if (careerId === "architect")
    return [...ARCHITECT_LESSON_IDS] as LessonId[];
  if (careerId === "engineer")
    return [...ENGINEER_LESSON_IDS] as LessonId[];
  if (careerId === "doctor") return MEDICAL_ORDER;
  return [];
}

/**
 * Has the player already shown they understand this?
 *
 * Deliberately generous. Every one of these is an action that cannot be taken
 * by accident, so taking it is proof enough — and a lesson that outstays the
 * competence it was teaching is worse than one that leaves early.
 */
export function learned(
  id: LessonId,
  state: RunState,
  /* Unused today. Kept in the signature because it is the other half of the
     pair with `relevant`, and a lesson whose completion depends on the plan
     rather than the run is a change of one line rather than of every caller. */
  _ctx: TeachContext,
): boolean {
  if (state.careerId === "chef") return chefLearned(id, state);
  if (state.careerId === "lawyer") return lawyerLearned(id, state);
  if (state.careerId === "founder") return founderLearned(id, state);
  if (state.careerId === "politician") return politicianLearned(id, state);
  if (state.careerId === "architect") return architectLearned(id, state);
  if (state.careerId === "engineer") return engineerLearned(id, state);
  if (state.careerId !== "doctor") return true;
  const m = med(state);
  switch (id) {
    case "first-week":
      // A committed week is the whole lesson, demonstrated.
      return state.history.length > 0;
    case "first-report":
      // Two reports read means the shape of a week is familiar.
      return state.history.length >= 3;
    case "first-purchase":
      return (
        m.facilities.length > 1 ||
        m.departments.length > 1 ||
        m.equipment.length > 0
      );
    case "first-hire":
      return m.staff.length > 0;
    case "first-qualification":
      return m.qualifications.length > 1;
    case "first-city":
      return activeCities(m).length > 1;
    default:
      return true;
  }
}

/**
 * Is this system on screen and about to matter?
 *
 * A lesson that fires before its system exists is noise — nobody needs the
 * expansion talk in week two — so each of these waits for the moment the
 * player could actually act on it.
 */
export function relevant(
  id: LessonId,
  state: RunState,
  ctx: TeachContext,
): boolean {
  if (state.careerId === "chef") return chefRelevant(id, state, ctx);
  if (state.careerId === "lawyer") return lawyerRelevant(id, state, ctx);
  if (state.careerId === "founder") return founderRelevant(id, state, ctx);
  if (state.careerId === "politician")
    return politicianRelevant(id, state, ctx);
  if (state.careerId === "architect")
    return architectRelevant(id, state, ctx);
  if (state.careerId === "engineer")
    return engineerRelevant(id, state, ctx);
  if (state.careerId !== "doctor") return false;
  const m = med(state);
  switch (id) {
    case "first-week":
      /*
       * Week bound as well as history.
       *
       * A save can reach week sixty with an empty history — the log is capped,
       * and an imported or repaired save may carry none at all. Teaching what
       * a time block is to somebody mid-insolvency reads as the interface
       * having lost track of the run, which is worse than teaching nothing.
       */
      return state.history.length === 0 && state.week <= 2;
    case "first-report":
      return ctx.hasReport;
    case "first-purchase":
      /* Once there is enough cash for the cheapest meaningful thing. Before
         that the lesson is about a decision the player cannot make. */
      return state.r.cash >= 9_000;
    case "first-hire":
      return state.history.length >= 2;
    case "first-qualification":
      return state.r.cpd >= 15;
    case "first-city":
      return state.r.cash >= 40_000 && activeCities(m).length === 1;
    default:
      return false;
  }
}

/**
 * The lesson to show on a given screen, if any.
 *
 * At most one per screen, always the earliest unlearned one — teaching two
 * systems at once is how a tutorial becomes a wall of text that gets closed
 * without being read.
 */
export function lessonFor(
  screen: ScreenId,
  state: RunState,
  ctx: TeachContext,
  taught: readonly string[],
): Lesson | null {
  for (const id of lessonOrderFor(state.careerId)) {
    const lesson = LESSONS[id];
    if (!lesson || lesson.screen !== screen) continue;
    if (taught.includes(id)) continue;
    if (learned(id, state, ctx)) continue;
    if (!relevant(id, state, ctx)) continue;
    return lesson;
  }
  return null;
}

/** Every lesson, with whether it is still outstanding — for the reopen list. */
export function lessonStatus(
  state: RunState,
  ctx: TeachContext,
  taught: readonly string[],
): { lesson: Lesson; done: boolean }[] {
  return lessonOrderFor(state.careerId)
    .filter((id) => Boolean(LESSONS[id]))
    .map((id) => ({
      lesson: LESSONS[id],
      done: taught.includes(id) || learned(id, state, ctx),
    }));
}
