import { NEGLECT_LIMIT, stagesFor, type CrisisKind } from "../game/crisis";
import type { RunState } from "../game/types";
import { localSum } from "../game/careers/lawyer";
import type { MedIconName } from "../../components/visuals/MedIcon";

/**
 * WHAT STARTED THIS, AND WHAT MAKES IT WORSE
 *
 * A crisis card showed the stage, the severity and the choices. It did not say
 * where the thing came from or what happens if you close the tab — and both are
 * things the simulation knows exactly.
 *
 * `worsens` is not flavour: the drift rule in `neglect()` is +2 a week for the
 * first two weeks of inaction, then 6 plus the number of weeks ignored, an
 * automatic jump to the final stage at four, and a bad self-resolution at
 * eight. Those numbers are quoted here so a card can state the deadline rather
 * than implying one.
 */

export interface CrisisGuide {
  icon: MedIconName;
  /** Where this kind of trouble comes from. */
  cause: string;
  /** What it costs while it runs, and what it costs if left alone. */
  worsens: string;
  /** Who feels it. */
  affects: string;
}

export const CRISIS_GUIDE: Record<CrisisKind, CrisisGuide> = {
  lawsuit: {
    icon: "clipboard",
    cause: "A poor outcome that somebody decided to pursue rather than accept.",
    worsens:
      "The cost of settling rises with the severity. Fighting it is cheaper up front and much more expensive if you lose.",
    affects: "Your cash, your malpractice risk, and the clinician who treated them.",
  },
  walkout: {
    icon: "team",
    cause:
      "Workplace culture falling far enough that the people carrying the rota stopped believing it would improve.",
    worsens:
      "Capacity is already down while this runs. Left alone, more follow — and the ones who go first are the ones with somewhere to go.",
    affects: "Everyone still on the payroll, and the departments they were covering.",
  },
  inspection: {
    icon: "shield",
    cause:
      "Malpractice risk climbing far enough that the regulator stopped waiting for a complaint.",
    worsens:
      "Every week you do not answer adds severity, and a fourth week of silence jumps it straight to the final stage. Being seen to cooperate is worth more than being right.",
    affects:
      "Your licence, your credibility, and every clinician who has to explain who they work for.",
  },
  cashflow: {
    icon: "money",
    cause:
      "Fixed costs outrunning what the practice bills — usually an estate bought ahead of the caseload.",
    worsens:
      "Interest compounds and the options narrow. Each week of delay makes the remaining routes out more expensive than the last.",
    affects: "Payroll, upkeep, and every plan that assumed the money would be there.",
  },
  dataleak: {
    icon: "shield",
    cause:
      "Patient records going somewhere they should not have. Almost always process rather than malice.",
    worsens:
      "Patient trust bleeds every week it is unaddressed, and the regulator's interest grows with the silence.",
    affects: "Everyone on your list, whether or not their record was in it.",
  },
  scandal: {
    icon: "alert",
    cause:
      "Something the public found out about — usually the gap between what you said and what you did.",
    worsens:
      "Popularity and patient trust bleed every week it runs, and the story gets larger the longer it goes unanswered.",
    affects: "Your panel, your standing, and anyone associated with you.",
  },
  shortage: {
    icon: "capsule",
    cause:
      "A break in the consumables chain — usually a stock-out you gambled on, sometimes the market itself.",
    worsens:
      "Capacity is throttled while it runs. Every week without a fix treats fewer people at the same fixed cost.",
    affects: "Every site at once, and every case that needs anything at all.",
  },
};

/**
 * How far through a crisis is, and how long inaction has left.
 *
 * `stagesTotal` is read from the authored stage list, so a crisis that gains a
 * beat reports the new count without a change here.
 */
export function crisisProgress(
  kind: CrisisKind,
  stage: number,
  ignored: number,
  /** Whose stage set — a career with its own may have a different count. */
  careerId?: string,
) {
  const stagesTotal = stagesFor(kind, careerId).length;
  return {
    stage: stage + 1,
    stagesTotal,
    /** Weeks of doing nothing before it resolves itself, badly. */
    weeksToBurnout: Math.max(0, NEGLECT_LIMIT - ignored),
    /** Inaction jumps straight to the final stage at four weeks. */
    weeksToEscalation: Math.max(0, 4 - ignored),
  };
}

/**
 * THE SAME FIVE KINDS, IN A SOLICITOR'S WORLD
 *
 * The copy above is the Physician's — clinicians, patient records, the rota.
 * A practice suffers the same *shapes* for entirely different reasons, and a
 * card that explains a client-account audit as "malpractice risk climbing"
 * is the vocabulary leak these files exist to stop.
 *
 * Only the five a law firm can actually have. There is no `shortage` and no
 * `scandal` here, and `stagesFor` guarantees neither is ever raised for this
 * career — see `LAWYER_CRISIS_KINDS`.
 */
const LAWYER_GUIDE: Partial<Record<CrisisKind, CrisisGuide>> = {
  lawsuit: {
    icon: "clipboard",
    cause:
      "A former client who decided the outcome was your fault rather than the court's — usually a matter that reached its date short of hours.",
    worsens:
      "Settling gets dearer as the severity climbs, and every week of silence is a week their expert has your file and you do not.",
    affects: "Your cash, your indemnity premium, and how the profession reads you.",
  },
  inspection: {
    icon: "shield",
    cause:
      "The regulator asking to see the client account. Acting against a former client is the commonest reason they stop waiting to be asked.",
    worsens:
      "A fourth week of silence jumps it straight to conditions on your certificate. Being seen to cooperate is worth more than being right.",
    affects:
      "Your standing, your certificate, and every client who has to be told their file was reviewed.",
  },
  walkout: {
    icon: "team",
    cause:
      "An associate deciding the hours are not going to change. They rarely leave alone and they never leave empty-handed.",
    worsens:
      "The list goes with them, matter by matter, and the ones that go first are the ones with hours already in them.",
    affects: "The hours the firm can find, and the clients who were theirs before they were yours.",
  },
  cashflow: {
    icon: "money",
    cause:
      "Chambers and salaries falling due against money a court has already said is yours. This is the career's premise arriving on a specific Friday.",
    worsens:
      "The routes out get dearer each week: an arrangement becomes a facility, and a facility becomes a refinancing.",
    affects: "Payroll, chambers, and every matter you can no longer afford to carry to a date.",
  },
  dataleak: {
    icon: "shield",
    cause:
      "Privileged material reaching the other side. Almost always a covering email rather than anything deliberate.",
    worsens:
      "Your client is taking advice about you while you decide, and the longer it runs the more likely it is they take it to the regulator instead.",
    affects: "The client whose advice it was, your standing, and your certificate if it goes far enough.",
  },
};

/** The explanation for this crisis, in the career's own words. */
export function crisisGuideFor(
  careerId: string,
  kind: CrisisKind,
): CrisisGuide {
  if (careerId === "lawyer") return LAWYER_GUIDE[kind] ?? CRISIS_GUIDE[kind];
  return CRISIS_GUIDE[kind];
}

/**
 * What a crisis choice actually costs here.
 *
 * Authored in London figures and localised at the point of charge, because
 * this game learned the hard way that if any part of a run is denominated
 * locally then all of it must be — a flat £48,000 is a different animal in
 * Lagos, where the same matter bills 45%, than it is in New York.
 *
 * The card and the command both call this, so the figure on the button is the
 * figure the engine takes. A presentation layer that restates a number is a
 * presentation layer that will eventually restate it wrongly.
 */
export function crisisCostIn(state: RunState, amount: number): number {
  if (amount === 0) return 0;
  return state.careerId === "lawyer" ? localSum(state, amount) : amount;
}
