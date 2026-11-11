import { CONDITIONS_BY_ID, EQUIPMENT_BY_ID } from "../game/medical/data";
import { coverageFor, techniciansNeeded } from "../game/medical/sim";
import { supplyThrottle } from "../game/medical/supplies";
import type { MedicalState, SpecialtyId } from "../game/medical/types";
import type { ScreenId } from "./navigation";

/**
 * WHAT HAPPENED TO EVERYONE WHO TURNED UP
 *
 * The caseload table is a per-condition ledger: correct, and no help at all
 * with the question a player actually asks, which is "why did I treat 65 of
 * 146?". This turns the same rows into a funnel — how many made it to each
 * gate, and how many fell out at it, with the reason attached.
 *
 * ---------------------------------------------------------------- exactness
 *
 * Every number here is a sum over `m.lastCases`, which is what the simulation
 * wrote when the week resolved. Nothing is modelled, estimated or smoothed,
 * and the funnel closes: the drops sum to the arrivals minus the treated, and
 * `flowIsConsistent` asserts it. A visual that explains a system has to be
 * arithmetically the same system, or it is decoration that lies.
 *
 * ------------------------------------------------------------------ triage
 *
 * Triage is not a stage. In this game the policy does not filter anybody — it
 * *orders* the queue, and the ordering decides who is still waiting when the
 * week's capacity runs out. So it is presented as the rule governing the
 * capacity gate rather than as a gate of its own, because inventing a "passed
 * triage" number the engine never computes would be exactly the fake data this
 * is meant to replace.
 */

export type FlowTone = "entering" | "processed" | "constrained" | "failed" | "referred";

export interface FlowStage {
  id: string;
  label: string;
  /** How many patients reached this point. */
  count: number;
  /** What this gate is, in one line. */
  detail: string;
  tone: FlowTone;
}

export interface FlowDrop {
  id: string;
  label: string;
  count: number;
  /** Why these patients did not get through. */
  reason: string;
  /** What to do about it. */
  fix: string;
  destination: ScreenId;
  tone: FlowTone;
  /** The departments this hit hardest, for the detail view. */
  departments: { id: SpecialtyId; label: string; count: number }[];
}

export interface PatientFlow {
  arrived: number;
  reachedDepartment: number;
  reachedResources: number;
  treated: number;
  succeeded: number;
  failed: number;
  turnedAway: number;
  stages: FlowStage[];
  drops: FlowDrop[];
  /** True when a week has actually resolved. */
  hasData: boolean;
}

/** The funnel must close. Exported so a test can assert it on real states. */
export const flowIsConsistent = (f: PatientFlow): boolean =>
  f.drops.reduce((n, d) => n + d.count, 0) === f.turnedAway &&
  f.treated + f.turnedAway === f.arrived &&
  f.succeeded + f.failed === f.treated;

/**
 * Build the funnel from the week the simulation last resolved.
 *
 * `m.lastCases` records, per condition, how many arrived and what stopped the
 * ones that did not get treated. The four blockers are mutually exclusive by
 * construction — `blockerFor` returns the first thing that stops a case — so
 * summing them is safe and the totals cannot double-count.
 */
export function patientFlow(m: MedicalState): PatientFlow {
  const cases = m.lastCases;
  const sum = (pick: (c: (typeof cases)[number]) => number) =>
    cases.reduce((n, c) => n + pick(c), 0);

  const arrived = sum((c) => c.arrived);
  const treated = sum((c) => c.treated);
  const succeeded = sum((c) => c.succeeded);
  const failed = sum((c) => c.failed);
  const turnedAway = arrived - treated;

  /* Grouped by the reason the engine recorded, and by department within it, so
     "83 blocked on staffing" can be opened into which departments. */
  const byBlocker = new Map<string, Map<SpecialtyId, number>>();
  for (const c of cases) {
    if (!c.blockedBy || c.turnedAway === 0) continue;
    const inner = byBlocker.get(c.blockedBy) ?? new Map<SpecialtyId, number>();
    inner.set(c.specialty, (inner.get(c.specialty) ?? 0) + c.turnedAway);
    byBlocker.set(c.blockedBy, inner);
  }
  const total = (k: string) =>
    [...(byBlocker.get(k)?.values() ?? [])].reduce((n, v) => n + v, 0);

  const noDepartment = total("department");
  const noEquipment = total("equipment");
  const noStaff = total("staff");
  const noCapacity = total("capacity");

  const reachedDepartment = arrived - noDepartment;
  const reachedResources = reachedDepartment - noEquipment - noStaff;

  const departmentsOf = (k: string) =>
    [...(byBlocker.get(k)?.entries() ?? [])]
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({
        id,
        label: DEPT_LABEL(id),
        count,
      }));

  /*
   * The staff bucket carries two different failures — nobody qualified enough,
   * and no technician for a machine you own — because `blockerFor` returns
   * "staff" for both. They are separated here by re-reading the same two
   * conditions against current state, which is what the player would have to
   * do by hand otherwise. The COUNT stays the engine's; only the wording is
   * derived.
   */
  const techShort =
    techniciansNeeded(m) > m.staff.filter((s) => s.role === "technician").length;

  const drops: FlowDrop[] = [];
  if (noDepartment > 0) {
    drops.push({
      id: "department",
      label: "No department for them",
      count: noDepartment,
      reason:
        "These conditions belong to a field you have not opened. They were referred out on arrival.",
      fix: "Open the department, or accept this work goes elsewhere.",
      destination: "build",
      tone: "referred",
      departments: departmentsOf("department"),
    });
  }
  if (noEquipment > 0) {
    drops.push({
      id: "equipment",
      label: "Missing equipment",
      count: noEquipment,
      reason:
        "The department is open, but the work needs a machine that is not installed.",
      fix: "Buy the machine these cases needed.",
      destination: "build",
      tone: "constrained",
      departments: departmentsOf("equipment"),
    });
  }
  if (noStaff > 0) {
    drops.push({
      id: "staff",
      label: techShort ? "No technician to run the machine" : "Nobody qualified enough",
      count: noStaff,
      reason: techShort
        ? "You own machines that nobody on the payroll is trained to operate, so the cases that need them cannot proceed."
        : "These cases are more severe than anyone in that department — you included — is qualified to take.",
      fix: techShort
        ? "Hire a technician."
        : "Hire a consultant in that field, or take the qualification yourself.",
      destination: techShort ? "staff" : "career",
      tone: "constrained",
      departments: departmentsOf("staff"),
    });
  }
  if (noCapacity > 0) {
    drops.push({
      id: "capacity",
      label: "Ran out of the week",
      count: noCapacity,
      reason: `Everything was in place; there were not enough hours or rooms to reach them. Your ${TRIAGE_WORD[m.triage]} triage policy decided who waited.`,
      fix: "Add clinical hours, staff or space — or change who the queue serves first.",
      destination: "caseload",
      tone: "constrained",
      departments: departmentsOf("capacity"),
    });
  }

  const stages: FlowStage[] = [
    {
      id: "arrived",
      label: "Arrived",
      count: arrived,
      detail: "Patients from your panel who presented this week.",
      tone: "entering",
    },
    {
      id: "department",
      label: "Matched a department",
      count: reachedDepartment,
      detail: "Their condition belongs to a field you have open.",
      tone: reachedDepartment === arrived ? "processed" : "constrained",
    },
    {
      id: "resources",
      label: "Had staff and equipment",
      count: reachedResources,
      detail: "Someone qualified was available, and the machines were installed.",
      tone: reachedResources === reachedDepartment ? "processed" : "constrained",
    },
    {
      id: "treated",
      label: "Treated",
      count: treated,
      detail: `Within the week's capacity, in ${TRIAGE_WORD[m.triage]} order.`,
      tone: treated === reachedResources ? "processed" : "constrained",
    },
    {
      id: "succeeded",
      label: "Good outcome",
      count: succeeded,
      detail: "Treated, and it went the way it should.",
      tone: "processed",
    },
  ];

  return {
    arrived,
    reachedDepartment,
    reachedResources,
    treated,
    succeeded,
    failed,
    turnedAway,
    stages,
    drops,
    hasData: cases.length > 0,
  };
}

const TRIAGE_WORD: Record<string, string> = {
  urgent: "sickest-first",
  profitable: "best-value-first",
  volume: "quickest-first",
};

/**
 * Two more constraints the funnel cannot show, because they act before anyone
 * arrives rather than on the people who did.
 *
 * A licence you do not hold produces no patients to count, and a stock-out
 * shrinks the capacity gate rather than appearing as its own drop. Both change
 * the numbers, so both are stated rather than left to be inferred from a
 * funnel that silently already includes them.
 */
export function upstreamLimits(
  m: MedicalState,
): { label: string; detail: string; destination: ScreenId }[] {
  const out: { label: string; detail: string; destination: ScreenId }[] = [];
  const throttle = supplyThrottle(m);
  if (throttle < 1) {
    out.push({
      label: "Running on a stock-out",
      detail: `Consumables ran dry, so every site is working at ${Math.round(throttle * 100)}% until restocked. Fewer people got through than your staff could have seen.`,
      destination: "supplies",
    });
  }
  const licensed = m.cities.length;
  if (licensed < 14) {
    out.push({
      label: `Licensed in ${licensed} market${licensed === 1 ? "" : "s"}`,
      detail:
        "Patients only arrive where you hold a licence and have premises standing. Everywhere else contributes nobody at all — those people are not in the count above.",
      destination: "cities",
    });
  }
  return out;
}

/**
 * The specific machine or qualification a blocked department was short of.
 *
 * Used by the drill-down, so "Cardiology, 31 blocked" can say *which* thing to
 * buy. Reads the same tables the blocker check reads.
 */
export function missingFor(
  m: MedicalState,
  specialty: SpecialtyId,
  conditionIds: string[],
): string[] {
  const wants = new Set<string>();
  for (const id of conditionIds) {
    const cond = CONDITIONS_BY_ID.get(id);
    if (!cond || cond.specialty !== specialty) continue;
    for (const e of cond.equipment ?? []) {
      if (!m.equipment.includes(e)) {
        wants.add(EQUIPMENT_BY_ID.get(e)?.label ?? e);
      }
    }
    if (cond.severity > coverageFor(m, specialty)) {
      wants.add(`Someone qualified to severity ${cond.severity}`);
    }
  }
  return [...wants];
}

/** Department labels without importing the whole identity module here. */
const DEPT_LABEL = (id: SpecialtyId): string => LABELS[id] ?? id;
const LABELS: Record<string, string> = {
  general: "General Practice",
  paediatrics: "Paediatrics",
  dermatology: "Dermatology",
  psychiatry: "Psychiatry",
  radiology: "Radiology",
  neurology: "Neurology",
  orthopaedics: "Orthopaedics",
  cardiology: "Cardiology",
  maternity: "Maternity",
  emergency: "Emergency",
  surgery: "General Surgery",
  oncology: "Oncology",
};
