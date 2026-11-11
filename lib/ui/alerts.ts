import type { RunState } from "../game/types";
import { med, weeklyCosts } from "../game/careers/doctor";
import { cityOf } from "../game/medical/cities";
import { OUTBREAK_BY_ID } from "../game/medical/outbreaks";
import { techniciansNeeded } from "../game/medical/sim";
import { weeksOfCover } from "../game/medical/supplies";
import { REP_BY_ID, recentRepChanges } from "../game/reputation";
import { coverageFor } from "../game/medical/sim";
import { DEPARTMENTS } from "./departments";
import { totalOutstanding, weeklyDebtService } from "../game/finance";
import { money } from "../game/format";
import type { ScreenId } from "./navigation";
import { chefAlerts } from "./chefHelp";
import { lawyerAlerts } from "./lawyerHelp";
import { founderAlerts } from "./founderHelp";
import { politicianAlerts } from "./politicianHelp";
import { architectAlerts } from "./architectHelp";
import { engineerAlerts } from "./engineerHelp";

/**
 * Urgent state, derived rather than stored.
 *
 * Everything here was previously something the player had to go looking for
 * in one of nine tabs. An alert names the problem, says why it matters, and
 * links to the exact screen that fixes it — so the interface answers "what
 * needs attention?" without the player auditing every panel.
 *
 * Pure and dependency-free so it can be reasoned about and tested on its own.
 */

export type Severity = "critical" | "warning" | "info";

export interface Alert {
  id: string;
  severity: Severity;
  /** Short label, e.g. "Burnout critical". */
  title: string;
  /** One sentence on what is happening and why it matters. */
  detail: string;
  destination: ScreenId;
  actionLabel: string;
}

const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/** Most severe first, whoever produced them. */
const bySeverity = (alerts: Alert[]): Alert[] =>
  [...alerts].sort((a, b) => RANK[a.severity] - RANK[b.severity]);

/**
 * What needs attention, in this career's own terms.
 *
 * The *shape* — a title, a reason, and the screen that fixes it — is
 * career-agnostic and always was. What was medical was the content, and this
 * function returned an empty list for anybody else, which is why a Chef or a
 * Solicitor never saw a badge on a destination in their lives. Each career now
 * derives its own; see `chefHelp.ts` and `lawyerHelp.ts`.
 */
export function deriveAlerts(state: RunState): Alert[] {
  if (state.careerId === "chef") return bySeverity(chefAlerts(state));
  if (state.careerId === "lawyer") return bySeverity(lawyerAlerts(state));
  if (state.careerId === "founder") return bySeverity(founderAlerts(state));
  if (state.careerId === "politician")
    return bySeverity(politicianAlerts(state));
  if (state.careerId === "architect")
    return bySeverity(architectAlerts(state));
  if (state.careerId === "engineer")
    return bySeverity(engineerAlerts(state));
  if (state.careerId !== "doctor") return [];
  const m = med(state);
  const out: Alert[] = [];

  // --- outbreaks -----------------------------------------------------------
  for (const active of m.outbreaks) {
    const def = OUTBREAK_BY_ID.get(active.id);
    if (!def) continue;
    out.push({
      id: `outbreak:${active.id}:${active.city}`,
      severity: def.severity >= 4 ? "critical" : "warning",
      title: `${def.label} · ${cityOf(active.city).name}`,
      detail: active.contained
        ? `Contained, ${Math.ceil(active.weeksLeft)} weeks to run. Still costing reputation every week.`
        : `Unanswered. ${def.affects.length} departments surging, and it costs risk and reputation every week.`,
      destination: "outbreaks",
      actionLabel: "Respond",
    });
  }

  // --- you ----------------------------------------------------------------
  if (state.r.burnout >= 85) {
    out.push({
      id: "burnout:critical",
      severity: "critical",
      title: "Burnout critical",
      detail:
        "At 100 you are signed off — a setback you climb out of, not an ending, and an expensive one. Rest blocks are the only thing that bring it down.",
      destination: "overview",
      actionLabel: "Assign rest",
    });
  } else if (state.r.burnout >= 68) {
    out.push({
      id: "burnout:high",
      severity: "warning",
      title: "Burnout high",
      detail:
        "Above 65 your effective skill drops and reputation bleeds every week.",
      destination: "overview",
      actionLabel: "Assign rest",
    });
  }

  if (state.r.strikes >= 2) {
    out.push({
      id: "strikes",
      severity: "critical",
      title: "One claim from losing your licence",
      detail:
        "A third upheld claim suspends your right to practise until you earn it back. Paperwork and admin staff bring malpractice risk down.",
      destination: "staff",
      actionLabel: "Hire admin",
    });
  } else if (state.r.risk >= 55) {
    out.push({
      id: "risk",
      severity: "warning",
      title: "Malpractice risk high",
      detail:
        "Claims get more likely and more expensive. Admin staff and charting reduce it.",
      destination: "staff",
      actionLabel: "Hire admin",
    });
  }

  // --- money ---------------------------------------------------------------
  const burn = weeklyCosts(state);
  if (state.r.cash < 0) {
    out.push({
      id: "cash:negative",
      severity: "critical",
      title: "Overdrawn",
      detail: `${money(state.r.cash)} on hand. Below −$60,000 the practice goes into administration — a setback you trade your way out of, not an ending, and an expensive one.`,
      destination: "staff",
      actionLabel: "Cut payroll",
    });
  } else if (burn > 0 && state.r.cash < burn * 2) {
    out.push({
      id: "cash:thin",
      severity: "warning",
      title: "Under two weeks of cover",
      detail: `${money(state.r.cash)} against ${money(burn)} a week in fixed costs.`,
      destination: "staff",
      actionLabel: "Review costs",
    });
  }

  // --- capability gaps, read off last week's actual caseload ---------------
  const blocked = { department: 0, equipment: 0, staff: 0, capacity: 0 };
  for (const c of m.lastCases) {
    if (c.blockedBy) blocked[c.blockedBy] += c.turnedAway;
  }
  const topGap = (Object.entries(blocked) as [keyof typeof blocked, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])[0];

  if (topGap && topGap[1] >= 4) {
    const [reason, count] = topGap;
    const copy = {
      department: {
        detail: `${count} patients referred out because you have no department for them.`,
        destination: "build" as ScreenId,
        action: "Open a department",
      },
      equipment: {
        detail: `${count} patients referred out for want of equipment you do not own.`,
        destination: "build" as ScreenId,
        action: "Buy equipment",
      },
      staff: {
        detail: `${count} patients referred out because nobody qualified was on the rota.`,
        destination: "staff" as ScreenId,
        action: "Hire a specialist",
      },
      capacity: {
        detail: `${count} patients turned away — you ran out of room or hours.`,
        destination: "build" as ScreenId,
        action: "Add capacity",
      },
    }[reason];
    out.push({
      id: `gap:${reason}`,
      severity: "warning",
      title: "Turning patients away",
      detail: copy.detail,
      destination: copy.destination,
      actionLabel: copy.action,
    });
  }

  /*
   * A department that exists but cannot take its own work.
   *
   * Distinct from the capability gap above, which reports what already
   * happened. This one fires on the *standing* state, so it catches a
   * department opened this week whose consultant has not been hired yet —
   * before a caseload has proved the point at the cost of a week's referrals.
   */
  const thin = DEPARTMENTS.filter(
    (d) => m.departments.includes(d.id) && coverageFor(m, d.id) < d.maxSeverity,
  );
  if (thin.length > 0 && m.lastCases.length > 0) {
    const worst = thin.sort(
      (a, b) =>
        b.maxSeverity -
        coverageFor(m, b.id) -
        (a.maxSeverity - coverageFor(m, a.id)),
    )[0];
    out.push({
      id: `cover:${worst.id}`,
      severity: "warning",
      title: `${worst.label} is open but under-staffed`,
      detail: `It can take severity ${coverageFor(m, worst.id)} of ${worst.maxSeverity}. The harder cases in that field are referred out while you pay its upkeep.`,
      destination: "team",
      actionLabel: "See the cover",
    });
  }

  // Machines nobody can run are ornaments.
  const techs = m.staff.filter((s) => s.role === "technician").length;
  if (techs < techniciansNeeded(m)) {
    out.push({
      id: "technicians",
      severity: "warning",
      title: "Short of technicians",
      detail:
        "Every machine-dependent case is being turned away until someone can run the equipment.",
      destination: "staff",
      actionLabel: "Hire a technician",
    });
  }

  /*
   * Borrowing, when servicing it is starting to matter.
   *
   * Threshold is the debt service against the weekly burn rather than an
   * absolute figure — $40,000 outstanding is trivial for a hospital group and
   * fatal for a rented room, and an alert that cannot tell the difference is
   * an alert that fires at the wrong time in both directions.
   */
  const service = weeklyDebtService(state);
  if (service > 0 && burn > 0 && service > burn * 0.25) {
    out.push({
      id: "debt:pressure",
      severity: totalOutstanding(state) > state.r.cash ? "critical" : "warning",
      title: "Borrowing is eating the week",
      detail: `${money(service)} a week goes on servicing ${money(totalOutstanding(state))} of debt — that is ${Math.round((service / burn) * 100)}% of everything the practice spends.`,
      destination: "money",
      actionLabel: "Look at the money",
    });
  }

  // --- consumables ---------------------------------------------------------
  if (m.supplies.throttleWeeks > 0) {
    out.push({
      id: "supplies:out",
      severity: "critical",
      title: "Stocked out of consumables",
      detail:
        "Capacity is cut until you restock. Auto-order would have covered this at full price.",
      destination: "supplies",
      actionLabel: "Restock",
    });
  } else if (!m.supplies.autoOrder && weeksOfCover(m) < 2) {
    out.push({
      id: "supplies:low",
      severity: "warning",
      title: "Consumables running low",
      detail: `Under two weeks of cover, and auto-order is off. Run dry and the practice throttles.`,
      destination: "supplies",
      actionLabel: "Order stock",
    });
  }

  /*
   * Standing, with the reason the simulation recorded at the time.
   *
   * The old version said "your catchment is shrinking", which is a
   * consequence, not a cause, and left the player to work out which of six
   * categories had moved and why. `recentRepChanges` has the actual entry.
   */
  const recentFall = recentRepChanges(state, 3)
    .filter((c) => c.delta <= -1)
    .sort((a, b) => a.delta - b.delta)[0];
  if (recentFall) {
    out.push({
      id: `standing:${recentFall.id}`,
      severity: "warning",
      title: `${REP_BY_ID.get(recentFall.id)?.label ?? "Standing"} fell`,
      detail: `${recentFall.delta.toFixed(1)} in week ${recentFall.week} — ${recentFall.why}.`,
      destination: "standing",
      actionLabel: "See your standing",
    });
  } else if (state.r.reputation < 32) {
    out.push({
      id: "reputation",
      severity: "warning",
      title: "Credibility low",
      detail:
        "It sets how many local patients you can attract and how many of your own list turn up. Good outcomes on harder cases are what raise it.",
      destination: "caseload",
      actionLabel: "See outcomes",
    });
  }

  return bySeverity(out);
}

/**
 * THE ONE THING, AND AT MOST ONE MORE
 *
 * `deriveAlerts` finds everything wrong. Showing everything wrong is how a
 * player learns to scroll past the whole block: a mid-run practice can trip six
 * of these at once, and six equally-styled red cards contain the same amount of
 * guidance as none.
 *
 * So the Overview takes a primary and a secondary. The primary is the most
 * severe; the secondary is the most severe of what is left *in a different
 * area*, because two cards about payroll are one card and a repetition. The
 * rest stay reachable through the section badges, which is where a player goes
 * when they are auditing rather than being told.
 */
export function topAlerts(alerts: Alert[]): Alert[] {
  if (alerts.length === 0) return [];
  const [primary] = alerts;
  const area = (a: Alert) => a.id.split(":")[0];
  const secondary = alerts
    .slice(1)
    .find(
      (a) => area(a) !== area(primary) && a.destination !== primary.destination,
    );
  return secondary ? [primary, secondary] : [primary];
}

/** Worst severity present, for the nav badge. */
export function peakSeverity(alerts: Alert[]): Severity | null {
  if (alerts.length === 0) return null;
  return alerts[0].severity;
}
