import type { RunState } from "../game/types";
import { money } from "../game/format";
import {
  buildableKinds,
  certWeeksFor,
  confidenceOf,
  designNeededFor,
  estimateOf,
  faultCost,
  kindOf,
  recallCost,
  surfaceChance,
  workshopCityOf,
  workshopRevenue,
  workshop,
} from "../game/careers/workshop";
import type { Alert } from "./alerts";
import type { Step } from "./guidance";
import type { Lesson, LessonId, TeachContext } from "./onboarding";
import type { Term } from "./glossary";

/**
 * WHAT THE INTERFACE TELLS AN ENGINEER
 *
 * The badges, the one next step, the lessons and the words — none of which
 * this career had. This is the content those four systems were missing.
 *
 * **The rule that governs every line in this file: `latent` is never quoted.**
 * The true fault count is the one thing the player must not be told, so every
 * sentence here is built from `estimateOf`, `confidenceOf` and `surfaceChance`
 * — a range, how much the range is worth, and the odds it bites this week.
 * An alert that leaked the real number would delete the career, and this file
 * is the most likely place for that to happen by accident.
 */

/* ------------------------------------------------------------------ alerts */

export function engineerAlerts(state: RunState): Alert[] {
  const w = workshop(state);
  const city = workshopCityOf(w);
  const out: Alert[] = [];
  const live = w.products.filter((p) => p.stage !== "withdrawn");

  for (const p of live) {
    const kind = kindOf(p);
    if (!kind) continue;
    const est = estimateOf(p);

    /* ------------------------------------ shipped, and failing at customers */
    if (p.stage === "shipped") {
      const chance = surfaceChance(p);
      if (p.surfaced > 0) {
        out.push({
          id: `eng:surfaced:${p.id}`,
          severity: "critical",
          title: `${p.name} is failing in the field`,
          detail: `${p.surfaced} outstanding at ${money(faultCost(w, p))} each. Recalling it costs ${money(recallCost(w, p))} and stops the bleeding.`,
          destination: "bench",
          actionLabel: "See the bench",
        });
      } else if (chance > 0.25) {
        out.push({
          id: `eng:risk:${p.id}`,
          severity: "warning",
          title: `${p.name} is likely to fail somewhere`,
          detail: `${Math.round(chance * 100)}% that a fault surfaces this week, at ${money(faultCost(w, p))} each — priced by how well it has sold.`,
          destination: "bench",
          actionLabel: "See the bench",
        });
      }
      continue;
    }

    /* --------------------------------- about to be submitted, and shouldn't be */
    if (est.low > city.certTolerance) {
      out.push({
        id: `eng:overtolerance:${p.id}`,
        severity: "warning",
        title: `${p.name} would almost certainly be refused`,
        detail: `Estimated ${est.low}–${est.high} faults against a tolerance of ${city.certTolerance}. Testing is what narrows it and takes them out.`,
        destination: "bench",
        actionLabel: "See the estimate",
      });
    } else if (confidenceOf(p) < 40 && p.design >= designNeededFor(p, kind)) {
      out.push({
        id: `eng:blind:${p.id}`,
        severity: "warning",
        title: `You do not know what is in ${p.name}`,
        detail: `The estimate is only ${confidenceOf(p)}% confident. Submitting on a guess this wide is how a certification fee is wasted.`,
        destination: "bench",
        actionLabel: "See the estimate",
      });
    }

    /* ------------------------------------------ waiting on the certifier */
    if (p.stage === "certifying" && p.submittedWeek !== undefined) {
      const waited = state.week - p.submittedWeek;
      const left = Math.max(0, certWeeksFor(w) - waited);
      if (left > 0) {
        out.push({
          id: `eng:waiting:${p.id}`,
          severity: "info",
          title: `${p.name} is with the certifier`,
          detail: `${left} week${left === 1 ? "" : "s"} to go. Nothing you do to it now changes the answer.`,
          destination: "bench",
          actionLabel: "See the bench",
        });
      }
    }
  }

  /* ------------------------------------------------------- an idle bench */
  if (live.length === 0) {
    out.push({
      id: "eng:empty",
      severity: "warning",
      title: "Nothing on the bench",
      detail:
        "No product being designed and none on sale. Nothing earns here until something is certified and shipped.",
      destination: "newbuild",
      actionLabel: "Start something",
    });
  }

  return out;
}

/* --------------------------------------------------------------- next step */

export function engineerStep(
  state: RunState,
  alloc: Record<string, number>,
): Step | null {
  const w = workshop(state);
  const city = workshopCityOf(w);
  const live = w.products.filter((p) => p.stage !== "withdrawn");

  /* --- nothing to work on ------------------------------------------------ */
  if (live.length === 0) {
    const open = buildableKinds(state.r.skill);
    return {
      id: "eng:start",
      title: open.length > 0 ? "Start something" : "Nothing is open to you yet",
      detail:
        open.length > 0
          ? "The bench is empty. A product earns every week once it is certified, and nothing gets there without being started."
          : "Every product needs more craft than you have. A week at the bench is still the way to earn it.",
      destination: "newbuild",
      actionLabel: "See what you could build",
    };
  }

  /* --- something is failing at customers --------------------------------- */
  const bleeding = live.find((p) => p.stage === "shipped" && p.surfaced > 0);
  if (bleeding) {
    return {
      id: "eng:recall",
      title: `Decide what to do about ${bleeding.name}`,
      detail: `${bleeding.surfaced} fault${bleeding.surfaced === 1 ? "" : "s"} outstanding at ${money(faultCost(w, bleeding))} each. Pulling it yourself costs far less than letting it keep failing.`,
      destination: "bench",
      actionLabel: "See the bench",
    };
  }

  /* --- designed, but nobody knows what is in it -------------------------- */
  const risky = live.find((p) => {
    const kind = kindOf(p);
    if (!kind || p.stage === "shipped" || p.stage === "certifying") return false;
    return (
      p.design >= designNeededFor(p, kind) && estimateOf(p).high > city.certTolerance
    );
  });
  if (risky && (alloc.test ?? 0) === 0) {
    const est = estimateOf(risky);
    return {
      id: "eng:test",
      title: `Test ${risky.name} before you submit it`,
      detail: `Estimated ${est.low}–${est.high} faults against a tolerance of ${city.certTolerance}. Testing both removes them and tells you how many are left.`,
      destination: "bench",
      actionLabel: "See the estimate",
    };
  }

  /* --- still designing --------------------------------------------------- */
  const designing = live.find((p) => {
    const kind = kindOf(p);
    return kind && p.stage === "design" && p.design < designNeededFor(p, kind);
  });
  if (designing && (alloc.design ?? 0) === 0) {
    const kind = kindOf(designing);
    return {
      id: "eng:design",
      title: `Put a week into ${designing.name}`,
      detail: `${designing.design} of ${kind ? designNeededFor(designing, kind) : "?"} weeks drawn. Designing is also what puts the faults in, which is why the estimate widens as it goes.`,
      destination: "bench",
      actionLabel: "See the bench",
    };
  }

  /* --- shipped and under-sold -------------------------------------------- */
  const selling = live.find((p) => p.stage === "shipped" && p.reach < 0.6);
  if (selling && (alloc.sell ?? 0) === 0) {
    return {
      id: "eng:sell",
      title: `Find more buyers for ${selling.name}`,
      detail: `It has reached ${Math.round(selling.reach * 100)}% of the market, and it earns in proportion. A wider reach also prices every fault higher.`,
      destination: "bench",
      actionLabel: "See the bench",
    };
  }

  /* --- earning, and room for another ------------------------------------- */
  if (
    workshopRevenue(w) > 0 &&
    live.every((p) => p.stage === "shipped") &&
    buildableKinds(state.r.skill).length > 0
  ) {
    return {
      id: "eng:next",
      title: "Start the next one while this one earns",
      detail:
        "A certified product pays every week without being touched, which is what funds the weeks the next one needs.",
      destination: "newbuild",
      actionLabel: "See what you could build",
    };
  }

  return null;
}

/* ---------------------------------------------------------------- lessons */

export const ENGINEER_LESSON_IDS = [
  "eng-first-week",
  "eng-estimate",
  "eng-certification",
  "eng-field",
] as const;

export const ENGINEER_LESSONS: Record<string, Lesson> = {
  "eng-first-week": {
    id: "eng-first-week" as LessonId,
    screen: "overview",
    title: "A week is six blocks, and you never see what is in the work",
    intro:
      "Everything costs a block, nothing happens until you commit, and the number that decides whether any of it worked is one you are never shown.",
    points: [
      {
        term: "Time blocks",
        detail:
          "Six of them, refilled weekly. Designing advances a product, testing removes faults from it, selling widens its reach. Unspent blocks are wasted.",
      },
      {
        term: "The faults",
        detail:
          "Every week of design puts defects in. You are never told how many — only an estimated range, and how much that range is worth trusting.",
      },
      {
        term: "Certification",
        detail:
          "A product earns nothing until a certifier passes it, and they only accept so many faults. Submitting on a guess is how the fee is wasted.",
      },
      {
        term: "Commit week",
        detail:
          "Designs advance, tests report, certifiers answer and shipped products sell — or fail. Nothing is committed until you press it.",
      },
    ],
  },

  "eng-estimate": {
    id: "eng-estimate" as LessonId,
    screen: "bench",
    title: "A range, and how much the range is worth",
    intro:
      "The band drawn on every product is the only thing you will ever know about its faults. Reading it is the whole skill.",
    points: [
      {
        term: "The band",
        detail:
          "The low and high of what is estimated to be in it, drawn against the line the certifier will accept. Where the band sits is the decision.",
      },
      {
        term: "Confidence",
        detail:
          "How much the band is worth. A narrow range you are 30% sure of tells you less than a wide one you are 80% sure of.",
      },
      {
        term: "Testing",
        detail:
          "Does two things at once: takes faults out, and narrows what you know. It is the only source of both, and it costs the same blocks as designing.",
      },
      {
        term: "The trap",
        detail:
          "Designing is what creates the defects, so a more ambitious product is a worse liability. The better it is worth building, the more of it there is to get wrong.",
      },
    ],
  },

  "eng-certification": {
    id: "eng-certification" as LessonId,
    screen: "bench",
    title: "Nothing earns until somebody else says it may",
    intro:
      "Certification is a fee, a wait, and a verdict you cannot influence once it is submitted.",
    points: [
      {
        term: "The tolerance",
        detail:
          "How many faults this market's certifier will accept. It is a property of where you work, not of what you built.",
      },
      {
        term: "The wait",
        detail:
          "Weeks in which nothing you do to that product changes the answer. Plan the block you spend elsewhere.",
      },
      {
        term: "Being refused",
        detail:
          "The fee is gone and the product comes back to you. Testing first is always cheaper than submitting twice.",
      },
    ],
  },

  "eng-field": {
    id: "eng-field" as LessonId,
    screen: "bench",
    title: "What ships is what can come back",
    intro:
      "A certified product earns every week untouched — and every week it can also fail at somebody's premises.",
    points: [
      {
        term: "Reach",
        detail:
          "How much of the market has it. It sets what the product earns, and it sets what a single fault costs when it surfaces.",
      },
      {
        term: "Surfacing",
        detail:
          "A fault that was always in it, reaching a customer weeks after you shipped. It is charged at the price the reach implies.",
      },
      {
        term: "Recalling it",
        detail:
          "Pulling a product yourself costs real money and far less than letting it keep failing. It is a brake, not a defeat.",
      },
    ],
  },
};

export function engineerLearned(id: string, state: RunState): boolean {
  const w = workshop(state);
  switch (id) {
    case "eng-first-week":
      return state.history.length > 0;
    case "eng-estimate":
      return w.products.some((p) => p.tested > 0);
    case "eng-certification":
      return w.products.some(
        (p) => p.stage === "certifying" || p.stage === "shipped",
      );
    case "eng-field":
      return w.faultsInField > 0 || w.recalls > 0;
    default:
      return true;
  }
}

export function engineerRelevant(
  id: string,
  state: RunState,
  ctx: TeachContext,
): boolean {
  const w = workshop(state);
  switch (id) {
    case "eng-first-week":
      return state.history.length === 0 && state.week <= 2;
    case "eng-estimate":
      return w.products.some((p) => p.stage !== "withdrawn");
    case "eng-certification":
      return w.products.some((p) => {
        const kind = kindOf(p);
        return kind && p.stage !== "shipped" && p.design >= designNeededFor(p, kind);
      });
    case "eng-field":
      return w.products.some((p) => p.stage === "shipped") || ctx.hasReport;
    default:
      return false;
  }
}

/* ------------------------------------------------------------- the words */

export const WORKSHOP_TERMS: Term[] = [
  {
    id: "the-spec",
    term: "The spec",
    plain: "What it must survive",
    detail:
      "Requirements are negotiated before the thing exists, once. Lean designs faster and sells cheaper — and everything the spec no longer covers is a fault waiting at a customer. Hardened is the reverse trade.",
  },
  {
    id: "architecture",
    term: "Architecture",
    plain: "How it is put together",
    detail:
      "Integrated is elegant, premium, and the whole unit comes back when it fails. Modular is slower to draw, quick on the rig, and a field failure is a module in the post. Decided once, while designing.",
  },
  {
    id: "the-prototype",
    term: "The prototype",
    plain: "The certifier's rigour, pointed earlier",
    detail:
      "A paid build that finds one real fault and narrows the estimate before certification money is at stake. Once per product — the second prototype is called production.",
  },
  {
    id: "the-disciplines",
    term: "The disciplines",
    plain: "Mechanical, electrical, software, manufacturing",
    detail:
      "One of each, at most — each works the week passively: design, testing, or reach. The bench is still yours to point; they make the pointing count for more.",
  },
  {
    id: "latent-estimate",
    term: "The estimate",
    plain: "How many faults, roughly",
    detail:
      "A range rather than a number, because the true count is never known to you. Testing narrows it and removes faults at the same time.",
  },
  {
    id: "confidence",
    term: "Confidence",
    plain: "How much the estimate is worth",
    detail:
      "A wide range you trust tells you more than a narrow one you do not. It rises only with testing, never with time.",
  },
  {
    id: "tolerance",
    term: "Tolerance",
    plain: "What the certifier accepts",
    detail:
      "The number of faults this market will pass. A property of where you work — the same product passes in one city and is refused in another.",
  },
  {
    id: "certification",
    term: "Certification",
    plain: "Permission to sell",
    detail:
      "A fee and a wait, ending in a verdict. Until it passes, a product earns nothing however good it is.",
  },
  {
    /* Not "Reach": the Solicitor already has that word for the ceiling on what
       a market will ever send it, which is a different idea entirely. */
    id: "market-reach",
    term: "Market reach",
    plain: "How much of the market has it",
    detail:
      "What a shipped product earns is proportional to this — and so is what each fault costs when it surfaces. Selling well raises both.",
  },
  {
    id: "surfaced",
    term: "Surfaced",
    plain: "A fault that reached a customer",
    detail:
      "A defect you shipped, arriving weeks later as a bill. It was always in the product; the only thing that changed is that somebody found it.",
  },
  {
    id: "recall",
    term: "Recall",
    plain: "Pulling it yourself",
    detail:
      "Withdrawing a shipped product before it fails further. Expensive, and reliably cheaper than the alternative.",
  },
];
