import type { RunState } from "../game/types";
import { med, weeklyCosts } from "../game/careers/doctor";
import { cityOf } from "../game/medical/cities";
import { techniciansNeeded, departmentSlots } from "../game/medical/sim";
import { weeksOfCover } from "../game/medical/supplies";
import { cultureScore, payGap } from "../game/medical/culture";
import { readRep } from "../game/reputation";
import { equitySold, totalOutstanding } from "../game/finance";
import { currentAmbition } from "../game/ambitions";
import { money } from "../game/format";
import { screenOf, sectionOf, type ScreenId } from "./navigation";

/**
 * ORIENTATION
 *
 * Every screen answers one question. This computes, for the screen you are on:
 * what it is for, what is currently true about it, and the single most useful
 * thing to do next.
 *
 * ------------------------------------------------------- why it lives here
 *
 * The purpose lines were already in `navigation.ts`, but they were static —
 * "Who does the work, and what they cost you every week" is the same sentence
 * whether your team is thriving or three people short. A player arriving on
 * Staff with a technician gap needs the screen to *say so*, not to restate its
 * own job title.
 *
 * So every screen gets a `status`: one sentence derived from real state, with
 * a severity, and where useful a `primary` action naming the screen that fixes
 * it. When nothing is wrong the status says that too — "nothing needs
 * attention here" is information, and an empty header is not.
 *
 * Pure and dependency-free, like `alerts.ts`, so it can be tested directly.
 */

export type StatusTone = "critical" | "warning" | "good" | "neutral";

export interface ScreenAction {
  label: string;
  /** Where it takes you. Navigation is always the player's choice. */
  destination: ScreenId;
}

export interface Orientation {
  /** "Practice / Caseload" */
  section: string;
  screen: string;
  /** The static one-liner: what this screen is for. */
  purpose: string;
  /** What is true right now. Always present. */
  status: string;
  tone: StatusTone;
  /** The most useful next step, when there is one. */
  primary?: ScreenAction;
  /**
   * Answers to "why does this matter" and "how do I improve it", written
   * against current state rather than as static help text.
   */
  help: { question: string; answer: string; go?: ScreenAction }[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function orient(state: RunState, screen: ScreenId): Orientation {
  const section = sectionOf(screen, state.careerId);
  const def = screenOf(screen);
  const base = {
    section: section.label,
    screen: def.label,
    purpose: def.purpose,
  };

  if (state.careerId !== "doctor") {
    return { ...base, status: "", tone: "neutral", help: [] };
  }
  const m = med(state);

  switch (screen) {
    /* ------------------------------------------------------------ practice */
    case "build": {
      const deptUsed = m.departments.length;
      const deptMax = departmentSlots(m);
      const techs = m.staff.filter((x) => x.role === "technician").length;
      const techNeed = techniciansNeeded(m);
      const blockedByDept = m.lastCases.filter(
        (c) => c.blockedBy === "department",
      ).length;

      if (techs < techNeed) {
        return {
          ...base,
          status: `${techNeed - techs} machine${techNeed - techs === 1 ? "" : "s"} cannot be used — you are short of technicians.`,
          tone: "critical",
          primary: { label: "Hire a technician", destination: "staff" },
          help: [
            {
              question: "Why does this matter?",
              answer:
                "Equipment without someone to run it treats nobody. You are paying upkeep on machines that are switched off.",
              go: { label: "Go to Staff", destination: "staff" },
            },
          ],
        };
      }
      if (blockedByDept > 0) {
        return {
          ...base,
          status: `${blockedByDept} case${blockedByDept === 1 ? "" : "s"} last week needed a department you do not have.`,
          tone: "warning",
          primary: { label: "See what was turned away", destination: "caseload" },
          help: [
            {
              question: "How do I improve it?",
              answer:
                "Open the department those cases needed, or accept that this work goes elsewhere. The Caseload screen names which one.",
              go: { label: "Go to Caseload", destination: "caseload" },
            },
          ],
        };
      }
      if (deptUsed >= deptMax) {
        return {
          ...base,
          status: `All ${deptMax} department slot${deptMax === 1 ? " is" : "s are"} in use. More premises would give you room for more.`,
          tone: "neutral",
          help: [
            {
              question: "What unlocks this?",
              answer:
                "Each premises tier adds department slots. A clinic adds three; a medical centre adds more.",
            },
          ],
        };
      }
      return {
        ...base,
        status: `${deptUsed} of ${deptMax} departments open, ${m.equipment.length} machine${m.equipment.length === 1 ? "" : "s"} installed.`,
        tone: "good",
        help: [
          {
            question: "Where should I go?",
            answer:
              "The Caseload screen tells you which department would earn the most if you opened it next.",
            go: { label: "Go to Caseload", destination: "caseload" },
          },
        ],
      };
    }

    case "caseload": {
      const arrived = m.lastCases.reduce((n, c) => n + c.arrived, 0);
      const treated = m.lastCases.reduce((n, c) => n + c.treated, 0);
      const away = arrived - treated;
      if (arrived === 0) {
        return {
          ...base,
          status: "No week resolved yet. Commit a week and the arrivals appear here.",
          tone: "neutral",
          primary: { label: "Plan the week", destination: "overview" },
          help: [],
        };
      }
      const share = away / Math.max(1, arrived);
      /* Name the *dominant* blocker rather than listing all of them: the
         useful answer is which single thing to fix first. */
      const counts = new Map<string, number>();
      for (const c of m.lastCases) {
        if (!c.blockedBy) continue;
        counts.set(c.blockedBy, (counts.get(c.blockedBy) ?? 0) + c.turnedAway);
      }
      const worst = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      const WHERE: Record<string, ScreenAction> = {
        department: { label: "Open a department", destination: "build" },
        equipment: { label: "Buy the equipment", destination: "build" },
        staff: { label: "Hire someone qualified", destination: "staff" },
        capacity: { label: "See what limits you", destination: "caseload" },
      };

      if (away === 0) {
        return {
          ...base,
          status: `All ${arrived} patients who arrived last week were treated.`,
          tone: "good",
          help: [
            {
              question: "Why does this matter?",
              answer:
                "Turning nobody away is what holds patient trust up, and patient trust is what grows the panel.",
              go: { label: "See your standing", destination: "standing" },
            },
          ],
        };
      }
      return {
        ...base,
        status: worst
          ? `${away} of ${arrived} patients were referred elsewhere — mostly because of ${blockerWord(worst[0])}.`
          : `${away} of ${arrived} patients were referred elsewhere.`,
        tone: share > 0.4 ? "critical" : "warning",
        primary: worst ? WHERE[worst[0]] : undefined,
        help: [
          {
            question: "What changed this?",
            answer: `You treated ${treated} of ${arrived}. Every referral is work that walked out of the door and a small knock to patient trust.`,
          },
          {
            question: "How do I improve it?",
            answer: worst
              ? `${blockerWord(worst[0])} blocked the most cases. Fixing that one thing recovers the largest share.`
              : "Add capacity, or accept the referrals as the cost of your current size.",
            go: worst ? WHERE[worst[0]] : undefined,
          },
        ],
      };
    }

    case "staff": {
      const culture = cultureScore(m, state.week);
      const gap = payGap(m);
      if (m.staff.length === 0) {
        return {
          ...base,
          status: "Nobody employed. Every hour of treatment is currently your own.",
          tone: "warning",
          help: [
            {
              question: "Why does this matter?",
              answer:
                "Your own hours are most of your capacity now and almost none of it later. Hiring is how the practice stops being you.",
            },
          ],
        };
      }
      if (culture.score < 40) {
        return {
          ...base,
          status: `Workplace culture is ${Math.round(culture.score)} — ${culture.word.toLowerCase()}. People are more likely to leave.`,
          tone: "critical",
          primary: { label: "See what is driving it", destination: "team" },
          help: [
            {
              question: "What changed this?",
              answer: culture.drivers[0]
                ? `Mostly: ${culture.drivers[0].label.toLowerCase()} — ${culture.drivers[0].detail}`
                : "Pay, workload and morale together.",
              go: { label: "Go to Team", destination: "team" },
            },
          ],
        };
      }
      return {
        ...base,
        status:
          gap > 0
            ? `${m.staff.length} on the payroll. ${money(gap)}/wk short of what they expect to be paid.`
            : `${m.staff.length} on the payroll, all paid what they expect.`,
        tone: gap > 0 ? "warning" : "good",
        primary:
          gap > 0 ? { label: "Review the team", destination: "team" } : undefined,
        help: [
          {
            question: "Why does this matter?",
            answer:
              "Underpaid people lose morale, morale drags loyalty, and loyalty is what stops them leaving.",
            go: { label: "Go to Team", destination: "team" },
          },
        ],
      };
    }

    case "supplies": {
      const cover = weeksOfCover(m);
      const throttled = m.supplies.throttleWeeks > 0;
      if (throttled) {
        return {
          ...base,
          status: `You ran out. Capacity is reduced for ${m.supplies.throttleWeeks} more week${m.supplies.throttleWeeks === 1 ? "" : "s"}.`,
          tone: "critical",
          help: [
            {
              question: "How do I improve it?",
              answer:
                "Restock now to clear the throttle, and turn auto-order on so a shortfall is bought automatically at full price rather than stopping the lists.",
            },
          ],
        };
      }
      if (cover < 2) {
        return {
          ...base,
          status: `${cover.toFixed(1)} weeks of stock left. Below one week, capacity drops sharply.`,
          tone: "warning",
          help: [
            {
              question: "What happens if it runs out?",
              answer:
                "Every site is throttled for two weeks. Larger orders are cheaper per case; the only cost is cash tied up in a stock room.",
            },
          ],
        };
      }
      return {
        ...base,
        status: `${cover >= 99 ? "99+" : cover.toFixed(1)} weeks of cover${m.supplies.autoOrder ? ", auto-order on" : ""}.`,
        tone: "good",
        help: [],
      };
    }

    case "contracts": {
      const offers = state.offers ?? [];
      const live = state.contracts ?? [];
      const due = live.filter((c) => c.dueWeek - state.week <= 1);
      const unworked = live.filter((c) => c.progress === 0);
      if (due.length > 0) {
        return {
          ...base,
          status: `${due.length} assignment${due.length === 1 ? " is" : "s are"} due within a week.`,
          tone: "critical",
          primary: { label: "Put blocks into casework", destination: "overview" },
          help: [
            {
              question: "What happens next?",
              answer:
                "An assignment resolves on its deadline whether or not you worked it. One you never touched fails regardless of how good you are.",
              go: { label: "Go to Overview", destination: "overview" },
            },
          ],
        };
      }
      if (unworked.length > 0) {
        return {
          ...base,
          status: `${unworked.length} assignment${unworked.length === 1 ? " has" : "s have"} had no work put in yet.`,
          tone: "warning",
          primary: { label: "Assign casework blocks", destination: "overview" },
          help: [],
        };
      }
      return {
        ...base,
        status: offers.length
          ? `${offers.length} offer${offers.length === 1 ? "" : "s"} on the table, ${live.length} in progress.`
          : `Nothing on offer. ${live.length} in progress.`,
        tone: "neutral",
        help: [
          {
            question: "What unlocks this?",
            answer:
              "Offers arrive because of what you have built — departments, credentials, standing and a team. A one-room practice sees the routine work only.",
          },
        ],
      };
    }

    case "money": {
      const owed = totalOutstanding(state);
      const sold = equitySold(state);
      const weekly = weeklyCosts(state);
      const runway = weekly > 0 ? state.r.cash / weekly : 99;
      if (state.r.cash < 0) {
        return {
          ...base,
          status: `You are ${money(-state.r.cash)} overdrawn. Below −${money(60_000)} the business enters distress.`,
          tone: "critical",
          primary: { label: "Raise money", destination: "money" },
          help: [
            {
              question: "How do I improve it?",
              answer:
                "Raise a facility, cut weekly costs, or sell something. Distress is recoverable but it costs a great deal of time.",
            },
          ],
        };
      }
      if (runway < 4) {
        return {
          ...base,
          status: `${runway.toFixed(1)} weeks of cash at ${money(weekly)}/wk of running costs.`,
          tone: "warning",
          help: [
            {
              question: "Why does this matter?",
              answer:
                "Thin reserves are the single largest driver of a cash emergency, and an emergency costs far more than borrowing early would have.",
            },
          ],
        };
      }
      return {
        ...base,
        status:
          sold > 0
            ? `${money(state.r.cash)} in hand, ${money(owed)} owed, and ${100 - sold}% of the practice is yours.`
            : `${money(state.r.cash)} in hand, ${money(owed)} owed, and you own all of it.`,
        tone: "good",
        help: [
          {
            question: "Why does this matter?",
            answer:
              "Equity is permanent and interest is not. Selling a share costs you a slice of every profitable week from here on.",
          },
        ],
      };
    }

    /* ------------------------------------------------------------- network */
    case "cities": {
      const count = m.cities.length;
      return {
        ...base,
        status:
          count === 1
            ? `Operating in ${cityOf(m.homeCity).name} only. A single city eventually caps how large you can get.`
            : `Operating in ${count} cities. Your own clinical hours count only in ${cityOf(m.homeCity).name}.`,
        tone: count === 1 ? "neutral" : "good",
        help: [
          {
            question: "Where should I go?",
            answer:
              "Population caps the panel you can ever hold; fees decide what the work is worth. A market's current conditions matter as much as its baseline.",
          },
          {
            question: "Is expansion safe right now?",
            answer:
              state.r.cash < weeklyCosts(state) * 8
                ? "Not yet. A new site's upkeep starts immediately and its panel takes about twenty weeks to fill."
                : "You have the reserves to carry a new site through its empty first months.",
            go: { label: "Check the money", destination: "money" },
          },
        ],
      };
    }

    case "outbreaks": {
      const live = m.outbreaks.length;
      if (live > 0) {
        const worst = m.outbreaks[0];
        return {
          ...base,
          status: `${live} running. ${cityOf(worst.city).name} is ${worst.contained ? "contained" : "unanswered"}.`,
          tone: worst.contained ? "warning" : "critical",
          help: [
            {
              question: "How do I respond?",
              answer:
                "Containment is cheap and buys time. Research ends it everywhere and costs your own CPD. Vaccination ends it fastest and needs a pharmacy.",
            },
          ],
        };
      }
      return {
        ...base,
        status: "Nothing spreading. Pressure rises with the years and with how many cities you hold.",
        tone: "good",
        help: [],
      };
    }

    case "growth":
      return {
        ...base,
        status: `${m.campaigns.length} campaign${m.campaigns.length === 1 ? "" : "s"} running.`,
        tone: "neutral",
        help: [
          {
            question: "Why does this matter?",
            answer:
              "Word-of-mouth channels multiply your actual standing. Run on good outcomes they are the cheapest growth here; run while failing cases they shrink your catchment.",
          },
        ],
      };

    case "rivals": {
      const rivals = state.rivals ?? [];
      const hostile = rivals.filter((r) => r.stance === "enemy").length;
      return {
        ...base,
        status: hostile
          ? `${hostile} of ${rivals.length} are actively hostile and will bid above their weight against you.`
          : `${rivals.length} other careers running beside yours.`,
        tone: hostile ? "warning" : "neutral",
        help: [],
      };
    }

    /* -------------------------------------------------------------- career */
    case "career": {
      const cpd = Math.round(state.r.cpd);
      return {
        ...base,
        status: `${m.qualifications.length} qualification${m.qualifications.length === 1 ? "" : "s"} held, ${cpd} CPD banked.`,
        tone: "neutral",
        help: [
          {
            question: "What unlocks this?",
            answer:
              "CPD comes only from studying, and tuition costs cash as well. Each rung lets you personally do work that otherwise needs a consultant on the payroll.",
          },
        ],
      };
    }

    case "standing": {
      const scores: [string, number][] = [
        ["credibility", readRep(state, "credibility")],
        ["patient trust", readRep(state, "patients")],
        ["staff loyalty", readRep(state, "loyalty")],
        ["industry influence", readRep(state, "influence")],
        ["public popularity", readRep(state, "popularity")],
        ["ethical standing", readRep(state, "ethics")],
      ];
      const worst = [...scores].sort((a, b) => a[1] - b[1])[0];
      return {
        ...base,
        status: `Weakest right now: ${worst[0]} at ${Math.round(worst[1])}.`,
        tone: worst[1] < 30 ? "warning" : "neutral",
        help: [
          {
            question: "What changed this?",
            answer:
              "Every movement is recorded with the reason it happened. The list below is the last few weeks in full.",
          },
        ],
      };
    }

    case "people": {
      const people = state.people ?? [];
      const cold = people.filter((p) => p.warmth < -10).length;
      return {
        ...base,
        status: cold
          ? `${people.length} people. ${cold} have cooled on you.`
          : `${people.length} people, none of whom you have fallen out with.`,
        tone: cold >= 3 ? "warning" : "neutral",
        help: [
          {
            question: "Why does this matter?",
            answer:
              "They remember what you decided, and what they remember gates what they offer you later.",
          },
        ],
      };
    }

    case "timeline":
      return {
        ...base,
        status: `${(state.timeline ?? []).length} moment${(state.timeline ?? []).length === 1 ? "" : "s"} recorded across ${state.week} week${state.week === 1 ? "" : "s"}.`,
        tone: "neutral",
        help: [],
      };

    case "character": {
      const amb = currentAmbition(state);
      return {
        ...base,
        status: amb
          ? `Working toward: ${amb.label.toLowerCase()} — ${pct(amb.progress(state))} of the way.`
          : "No long-term ambition chosen yet.",
        tone: "neutral",
        help: [
          {
            question: "Why does this matter?",
            answer:
              "An ambition is a lens rather than a target. Meeting one is recorded and celebrated, and then you carry on playing.",
          },
        ],
      };
    }

    case "team": {
      const culture = cultureScore(m, state.week);
      return {
        ...base,
        status: `Culture ${Math.round(culture.score)} — ${culture.word.toLowerCase()}. ${culture.drivers[0]?.label ?? ""}`.trim(),
        tone:
          culture.score < 40 ? "critical" : culture.score < 60 ? "warning" : "good",
        help: [
          {
            question: "How do I improve it?",
            answer: culture.drivers[0]
              ? `The largest single factor is ${culture.drivers[0].label.toLowerCase()}. ${culture.drivers[0].detail}`
              : "Pay people what they expect and keep the rota survivable.",
          },
        ],
      };
    }

    /* ---------------------------------------------------------------- life */
    case "life": {
      const burnout = state.r.burnout;
      if (burnout >= 85) {
        return {
          ...base,
          status: `Burnout ${Math.round(burnout)}. At 100 you are signed off — recoverable, and it costs weeks.`,
          tone: "critical",
          primary: { label: "Assign rest blocks", destination: "overview" },
          help: [
            {
              question: "How do I improve it?",
              answer:
                "Rest brings it down now. Exercise builds a stock that brings it down every week from then on. Lifestyle relief compounds with both.",
            },
          ],
        };
      }
      /* 65 is the threshold the simulation actually uses: above it your
         effective skill drops and standing bleeds every week. Saying only
         "burnout 81" leaves the player to know that. */
      return {
        ...base,
        status:
          burnout >= 65
            ? `Burnout ${Math.round(burnout)} — above 65, so your skill is being blunted and standing is bleeding every week.`
            : `Burnout ${Math.round(burnout)}. ${m.lifestyle.length} thing${m.lifestyle.length === 1 ? "" : "s"} bought.`,
        tone: burnout >= 65 ? "warning" : "good",
        help: [
          {
            question: "Why does this matter?",
            answer:
              "Most of what you can buy here destroys net worth. You buy it for burnout relief and standing, and you pay for that in the thing you are measured on.",
          },
        ],
      };
    }

    default:
      return { ...base, status: "", tone: "neutral", help: [] };
  }
}

function blockerWord(kind: string): string {
  switch (kind) {
    case "department":
      return "a department you do not have";
    case "equipment":
      return "equipment you do not have";
    case "staff":
      return "nobody qualified being available";
    case "capacity":
      /* Deliberately not "room and hours". Which of the two is actually
         binding is a real question with a real answer, and the capacity
         pipeline on the Caseload screen names it — so the header states the
         symptom and sends the player to the thing that diagnoses it, rather
         than guessing "room" and pointing at Build. */
      return "the week running out before the queue did";
    default:
      return kind;
  }
}

/** Used by the header to colour the status line without relying on hue alone. */
export const TONE_WORD: Record<StatusTone, string> = {
  critical: "Needs attention",
  warning: "Worth a look",
  good: "Healthy",
  neutral: "Status",
};
