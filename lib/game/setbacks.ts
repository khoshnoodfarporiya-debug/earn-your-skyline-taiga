import type { RunState } from "./types";

/**
 * SETBACKS
 *
 * The worst thing that can happen to you, and the fact that you are still here
 * afterwards.
 *
 * ------------------------------------------------------ what this replaces
 *
 * Until now the game had four ways to be over: burnout at 100, three claims
 * lost, deep insolvency, and running out of weeks. Each one wrote
 * `RunState.outcome` and the next render showed a results screen. That is a
 * scored puzzle, not a sandbox — and it directly contradicts the product rule
 * that the player decides when the story is finished.
 *
 * So none of them end a run any more. Each is now a **setback**: a state you
 * enter, that costs you a great deal, that you can climb out of, and that the
 * timeline remembers you climbed out of. Bankruptcy is a chapter, not a
 * credits roll.
 *
 * `RunState.outcome` is not deleted — it now means exactly one thing, which is
 * that the player chose to retire. Old saves carrying a `lost` outcome still
 * load and still render their summary; they simply cannot be produced any more.
 *
 * ------------------------------------------------------------- the shape
 *
 * A setback has a **grip** (how much it is still costing you) that falls as
 * you meet its recovery conditions. It is not a timer: sitting still does not
 * clear a licence suspension, and money alone does not clear a collapse.
 *
 * Every one is deliberately expensive to escape. "Recoverable" is not the same
 * as "cheap", and a comeback that costs nothing is not a comeback.
 */

export type SetbackKind =
  | "collapse" // you stopped being able to work
  | "suspension" // the regulator took your licence
  | "insolvency" // the business failed
  | "disgrace"; // the public turned on you

export const SETBACK_KINDS: readonly SetbackKind[] = [
  "collapse",
  "suspension",
  "insolvency",
  "disgrace",
];

export const SETBACK_LABEL: Record<SetbackKind, string> = {
  collapse: "Signed off",
  suspension: "Practising rights suspended",
  insolvency: "Business failure",
  disgrace: "Public disgrace",
};

export interface ActiveSetback {
  kind: SetbackKind;
  startedWeek: number;
  /** 0..100. Zero is recovered. Falls only when you do the work. */
  grip: number;
  /** Weeks it has been running, for the timeline and the summary. */
  weeks: number;
  /** Recovery steps already taken, so each counts once. */
  done: string[];
}

/** Two at once is a bad year. Three would be indistinguishable from a loss. */
export const MAX_SETBACKS = 2;

export interface RecoveryStep {
  id: string;
  label: string;
  /** What it takes, in the player's words. */
  detail: string;
  /** How much grip it removes. */
  relief: number;
  /** True when the player currently qualifies to take it. */
  available: (s: RunState) => boolean;
}

/**
 * What it costs you while it has hold of you.
 *
 * Read every week by the career. Deliberately proportional to grip rather than
 * binary: a setback at grip 20 is a limp, at grip 90 it is a wall, and the
 * difference is what makes the climb legible.
 */
export interface SetbackEffects {
  /** Multiplier on time blocks. */
  blocks: number;
  /** Multiplier on everything the practice earns. */
  income: number;
  /** Whether the player may personally do the career's core work. */
  canPractise: boolean;
  /** Extra weekly reputation drag. */
  standingDrag: number;
}

export function setbackEffects(list: ActiveSetback[]): SetbackEffects {
  const out: SetbackEffects = {
    blocks: 1,
    income: 1,
    canPractise: true,
    standingDrag: 0,
  };
  for (const sb of list) {
    const g = sb.grip / 100;
    switch (sb.kind) {
      case "collapse":
        // Signed off. You are not at work, and the place runs without you.
        out.blocks *= 1 - g * 0.55;
        out.canPractise = out.canPractise && sb.grip < 45;
        break;
      case "suspension":
        // The organisation continues; you personally may not.
        out.canPractise = false;
        out.income *= 1 - g * 0.35;
        out.standingDrag += g * 0.8;
        break;
      case "insolvency":
        /*
         * Creditors take a cut — a small one.
         *
         * This started at 40% of revenue and was a death spiral: a practice
         * in administration is by definition not making money, so taking a
         * third of what little it earns guarantees it never climbs out. The
         * balance harness showed it plainly — every strategy that dipped
         * below the line stayed there for the remaining hundred weeks.
         *
         * 15% is enough to be felt and to make clearing it urgent, and
         * little enough that trading out is genuinely possible. Which is the
         * whole point: recovery should be hard, not arithmetically excluded.
         */
        out.income *= 1 - g * 0.15;
        out.standingDrag += g * 0.3;
        break;
      case "disgrace":
        out.income *= 1 - g * 0.25;
        out.standingDrag += g * 1.1;
        break;
    }
  }
  out.blocks = Math.max(0.35, out.blocks);
  out.income = Math.max(0.3, out.income);
  return out;
}

export const has = (s: RunState, kind: SetbackKind): boolean =>
  (s.setbacks ?? []).some((sb) => sb.kind === kind);

export const canPractise = (s: RunState): boolean =>
  setbackEffects(s.setbacks ?? []).canPractise;

export function beginSetback(
  s: RunState,
  kind: SetbackKind,
  grip = 85,
): ActiveSetback | null {
  if (has(s, kind)) return null;
  if ((s.setbacks ?? []).length >= MAX_SETBACKS) return null;
  const sb: ActiveSetback = {
    kind,
    startedWeek: s.week,
    grip: Math.max(30, Math.min(100, grip)),
    weeks: 0,
    done: [],
  };
  s.setbacks = [...(s.setbacks ?? []), sb];
  return sb;
}

/**
 * A week inside a setback.
 *
 * Grip decays *slightly* on its own — time genuinely does help with all four of
 * these — but nowhere near fast enough to be a waiting game. The recovery
 * steps are the route out; this is just the floor under them, so a player who
 * cannot yet afford any step is never completely stuck.
 */
export function tickSetbacks(s: RunState): ActiveSetback[] {
  const cleared: ActiveSetback[] = [];
  for (const sb of [...(s.setbacks ?? [])]) {
    sb.weeks += 1;
    sb.grip = Math.max(0, sb.grip - 0.9);
    if (sb.grip <= 0) {
      cleared.push(sb);
      s.setbacks = (s.setbacks ?? []).filter((x) => x !== sb);
    }
  }
  return cleared;
}

/**
 * The ways out.
 *
 * Career-agnostic on purpose: every one of these is something any professional
 * in trouble can do, and the career supplies the specifics through the state
 * each predicate reads. A career that wants its own route adds it to this list
 * rather than inventing a parallel mechanism.
 */
export const RECOVERY: Record<SetbackKind, RecoveryStep[]> = {
  collapse: [
    {
      id: "leave",
      label: "Take proper leave",
      detail: "Stop. Actually stop, for as long as it takes.",
      relief: 30,
      available: (s) => (s.r.burnout ?? 0) < 70,
    },
    {
      id: "support",
      label: "Get professional support",
      detail: "Occupational health, and someone to talk to who is not staff.",
      relief: 26,
      available: (s) => s.r.cash >= 12_000,
    },
    {
      id: "delegate",
      label: "Hand the running of it to someone else",
      detail: "A deputy who can carry it while you are not there.",
      relief: 24,
      available: (s) => (s.r._hasDeputy ?? 0) === 1,
    },
    {
      id: "rebuild",
      label: "Come back on reduced hours",
      detail: "Two days. Then three. Not all of it at once.",
      relief: 30,
      available: (s) => (s.r.burnout ?? 0) < 40,
    },
  ],
  suspension: [
    {
      id: "remediation",
      label: "Complete a remediation programme",
      detail: "Supervised practice, documented, and expensive.",
      relief: 34,
      available: (s) => s.r.cash >= 40_000,
    },
    {
      id: "retrain",
      label: "Retrain properly",
      detail: "Back to the coursework. It counts for something.",
      relief: 28,
      available: (s) => (s.r.cpd ?? 0) >= 25,
    },
    {
      id: "character",
      label: "Ask people to speak for you",
      detail: "References from colleagues who still respect you.",
      relief: 26,
      available: (s) =>
        (s.people ?? []).filter((p) => p.respect >= 55).length >= 2,
    },
    {
      id: "clean",
      label: "Show a clean record",
      detail: "Time, and nothing else going wrong.",
      relief: 24,
      available: (s) => (s.r.risk ?? 0) <= 15,
    },
  ],
  insolvency: [
    {
      id: "restructure",
      /*
       * The route that must work when you have nothing.
       *
       * Originally gated on £25,000 of cash, which is precisely the thing an
       * insolvent practice does not have — so the first step out of
       * insolvency required being solvent. Restructuring is a negotiation,
       * not a purchase, and it is now available to anyone who turns up to it.
       */
      label: "Restructure the debt",
      detail: "Every creditor, one at a time, from a weak position.",
      relief: 30,
      available: () => true,
    },
    {
      id: "sellup",
      label: "Sell a site",
      detail: "Somebody else's opportunity. Raises cash you do not have.",
      relief: 24,
      available: (s) => (s.r._sites ?? 0) >= 2,
    },
    {
      id: "downsize",
      label: "Shrink to something that works",
      detail: "One site, a small team, and a margin.",
      relief: 28,
      available: (s) => (s.r._sites ?? 99) <= 2,
    },
    {
      id: "backer",
      label: "Find someone who believes you",
      detail: "Money from a person rather than an institution.",
      relief: 26,
      available: (s) =>
        (s.people ?? []).some((p) => p.warmth >= 40 && p.trust >= 50),
    },
    {
      id: "profit",
      label: "Trade your way out",
      detail: "A profitable quarter. Unglamorous and decisive.",
      relief: 32,
      available: (s) => s.r.cash >= 60_000,
    },
  ],
  disgrace: [
    {
      id: "account",
      label: "Give a full account",
      detail: "On the record, without qualifiers.",
      relief: 30,
      available: () => true,
    },
    {
      id: "restitution",
      label: "Make it right where you can",
      detail: "Money, time, and no publicity about either.",
      relief: 28,
      available: (s) => s.r.cash >= 50_000,
    },
    {
      id: "work",
      label: "Do good work quietly for a long time",
      detail: "The only thing that has ever actually worked.",
      relief: 26,
      available: (s) => (s.r.repEthics ?? 70) >= 60,
    },
    {
      id: "advocate",
      label: "Let someone respected vouch for you",
      detail: "Costs them something, which is why it lands.",
      relief: 24,
      available: (s) => (s.people ?? []).some((p) => p.respect >= 65),
    },
  ],
};

export const gripWord = (grip: number): string => {
  if (grip >= 75) return "At its worst";
  if (grip >= 45) return "Still holding you";
  if (grip >= 20) return "Loosening";
  return "Nearly clear";
};

/** What the player is told when it starts. Career supplies nothing here. */
export const SETBACK_BLURB: Record<SetbackKind, string> = {
  collapse:
    "You have been signed off. Not for a week — properly. The work continues without you, badly, and the first thing to understand is that going back early makes this longer.",
  suspension:
    "Your right to practise has been suspended pending review. The organisation can keep operating. You personally cannot do the work, and everyone knows why.",
  insolvency:
    "The business could not meet what it owed. An administrator is involved, creditors are taking their share of everything that comes in, and what is left is yours to rebuild from.",
  disgrace:
    "It got out, and it got out badly. Nobody has taken anything away from you formally. They do not need to.",
};
