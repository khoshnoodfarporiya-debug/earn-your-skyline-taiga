import {
  CONDITIONS_BY_SPECIALTY,
  DEPARTMENT_COLOUR,
  EQUIPMENT_BY_ID,
  SPECIALTIES,
  SPECIALTY_BY_ID,
} from "../game/medical/data";
import { coverageFor } from "../game/medical/sim";
import type { MedicalState, SpecialtyId } from "../game/medical/types";
import type { MedIconName } from "../../components/visuals/MedIcon";

/**
 * DEPARTMENT IDENTITY
 *
 * What a department looks like, and what it demands of you, in one place.
 *
 * ------------------------------------------------------ derived, not authored
 *
 * Only two things here are written by hand: the icon and the one-line purpose.
 * Everything else — the case types, the equipment a department cannot function
 * without, the severity ceiling, the capacity a case consumes, the running
 * cost — is computed from `CONDITIONS` and `SPECIALTIES`, the same tables the
 * simulation resolves against.
 *
 * That is deliberate. A hand-written "needs a CT scanner" is a claim that
 * drifts the moment someone edits a condition; a derived one cannot. It also
 * means the card and the week agree by construction, which is the entire point
 * of a visual that claims to explain a system.
 *
 * ------------------------------------------------------------------ colour
 *
 * The palette is `DEPARTMENT_COLOUR`, already in the game and already borrowed
 * from hospital wayfinding. It is checked here against the semantic colours —
 * alarm red, caution amber, good green — because a department that shares a hue
 * with "this is going wrong" teaches the player the wrong thing twice.
 */

export interface DepartmentIdentity {
  id: SpecialtyId;
  label: string;
  icon: MedIconName;
  /** Accent from the shared wayfinding palette. Never a semantic colour. */
  colour: string;
  /** What this department is for, in one line. */
  purpose: string;
  /** The conditions it handles, most common first. */
  cases: { label: string; severity: number; fee: number; units: number }[];
  /** Machines without which some of its work is impossible. */
  equipment: { id: string; label: string; forCases: number }[];
  /** The severity ceiling, and therefore the qualification or hire it needs. */
  maxSeverity: number;
  /** What treating an average case costs you in capacity. */
  unitsPerCase: number;
  /** Weekly running cost once open. */
  upkeep: number;
  /** One-off cost to open. */
  unlockCost: number;
}

/**
 * The two authored fields.
 *
 * The purpose lines are short on purpose: this is the sentence under an icon
 * on a card, not the department's blurb, which is longer and lives in
 * `SPECIALTIES`.
 */
const AUTHORED: Record<SpecialtyId, { icon: MedIconName; purpose: string }> = {
  general: { icon: "stethoscope", purpose: "The front door. Everything starts here." },
  paediatrics: { icon: "child", purpose: "Medicine for children, and their parents." },
  dermatology: { icon: "skin", purpose: "Skin. High volume, quick appointments." },
  psychiatry: { icon: "mind", purpose: "Long appointments, patients who stay years." },
  radiology: { icon: "scan", purpose: "Imaging as a service to every other department." },
  neurology: { icon: "brain", purpose: "The nervous system. Slow, complex, unforgiving." },
  orthopaedics: { icon: "bone", purpose: "Bones and joints, and the theatre they need." },
  cardiology: { icon: "heart", purpose: "The heart unit. Expensive, and how a hospital gets known." },
  maternity: { icon: "maternity", purpose: "Round the clock by nature. Builds standing fastest." },
  emergency: { icon: "emergency", purpose: "You do not choose what arrives." },
  surgery: { icon: "scalpel", purpose: "The highest fees, and the highest cost of error." },
  oncology: { icon: "cell", purpose: "Long courses of the hardest medicine there is." },
};

/**
 * Build the identity for one department.
 *
 * Uncached and cheap — twelve departments, a few dozen conditions. Callers that
 * render the whole set inside a render loop should memoise the array, not this.
 */
export function departmentIdentity(id: SpecialtyId): DepartmentIdentity {
  const spec = SPECIALTY_BY_ID.get(id)!;
  const conditions = [...(CONDITIONS_BY_SPECIALTY[id] ?? [])].sort(
    (a, b) => b.prevalence - a.prevalence,
  );

  /* Count how many of this department's cases each machine gates, so the card
     can say "needed by 3 of 5 case types" rather than listing hardware. */
  const equipCount = new Map<string, number>();
  for (const c of conditions) {
    for (const e of c.equipment ?? []) {
      equipCount.set(e, (equipCount.get(e) ?? 0) + 1);
    }
  }

  const totalUnits = conditions.reduce((n, c) => n + c.units * c.prevalence, 0);
  const totalWeight = conditions.reduce((n, c) => n + c.prevalence, 0);

  return {
    id,
    label: spec.label,
    icon: AUTHORED[id].icon,
    colour: DEPARTMENT_COLOUR[id],
    purpose: AUTHORED[id].purpose,
    cases: conditions.map((c) => ({
      label: c.label,
      severity: c.severity,
      fee: c.fee,
      units: c.units,
    })),
    equipment: [...equipCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([eid, n]) => ({
        id: eid,
        label: EQUIPMENT_BY_ID.get(eid as never)?.label ?? eid,
        forCases: n,
      })),
    maxSeverity: conditions.reduce((n, c) => Math.max(n, c.severity), 0),
    unitsPerCase: totalWeight > 0 ? totalUnits / totalWeight : 0,
    upkeep: spec.upkeep,
    unlockCost: spec.unlockCost,
  };
}

export const DEPARTMENTS: DepartmentIdentity[] = SPECIALTIES.map((s) =>
  departmentIdentity(s.id),
);

export const DEPARTMENT_BY_ID = new Map(DEPARTMENTS.map((d) => [d.id, d]));

/** The staffing this department needs before it can take its hardest cases. */
export function staffingNeed(id: SpecialtyId): string {
  const d = DEPARTMENT_BY_ID.get(id)!;
  if (d.maxSeverity >= 5) return "A surgeon, or FRCS yourself";
  if (d.maxSeverity >= 4) return "A consultant, or FRCP yourself";
  if (d.maxSeverity >= 3) return "MRCP yourself, or a consultant";
  return "Any clinician can cover it";
}

// ------------------------------------------------------------- live coverage

export type CoverageLevel = "uncovered" | "partial" | "covered";

export interface DepartmentCoverage {
  id: SpecialtyId;
  open: boolean;
  /** Highest severity the organisation can actually take here. */
  covered: number;
  /** Highest severity that arrives here. */
  needed: number;
  level: CoverageLevel;
  /** Named staff who can work this department. */
  staff: { name: string; role: string; skill: number }[];
  /** Machines this department's work needs that you do not have. */
  missingEquipment: string[];
  /** Plain sentence: what is wrong, or that nothing is. */
  note: string;
}

/**
 * Where the bench is thin, department by department.
 *
 * `covered` comes straight from `coverageFor` — the same function the
 * simulation calls when it decides whether a case is treatable — so this can
 * never disagree with what actually happens on commit.
 */
export function departmentCoverage(m: MedicalState): DepartmentCoverage[] {
  return DEPARTMENTS.map((d) => {
    const open = m.departments.includes(d.id);
    const covered = coverageFor(m, d.id);
    const needed = d.maxSeverity;
    const staff = m.staff
      .filter(
        (s) =>
          s.specialty === d.id ||
          (d.id === "general" && (s.role === "gp" || s.role === "specialist")),
      )
      .map((s) => ({ name: s.name, role: s.role, skill: Math.round(s.skill) }));

    const missingEquipment = d.equipment
      .filter((e) => !m.equipment.includes(e.id as never))
      .map((e) => e.label);

    /*
     * Graded by the size of the shortfall, not by an absolute number.
     *
     * The first version tested `covered <= 2`, which marked General Practice
     * uncovered while it was fully staffed — its whole field tops out at
     * severity 2, so covering it *is* covering 2. A ceiling only means
     * anything against the demand it faces.
     */
    const shortfall = needed - covered;
    const level: CoverageLevel = !open
      ? "uncovered"
      : shortfall <= 0 && missingEquipment.length === 0
        ? "covered"
        : shortfall >= 2
          ? "uncovered"
          : "partial";

    const note = !open
      ? "Not open. Cases in this field are referred out."
      : missingEquipment.length > 0 && covered < needed
        ? `Takes severity ${covered} of ${needed}, and ${missingEquipment.length} machine${missingEquipment.length === 1 ? "" : "s"} are missing.`
        : missingEquipment.length > 0
          ? `Staffed to the top of the field, but missing ${missingEquipment.join(", ").toLowerCase()}.`
          : covered < needed
            ? `Takes severity ${covered} of ${needed}. The hardest cases here are referred out.`
            : "Covered to the top of the field.";

    return { id: d.id, open, covered, needed, level, staff, missingEquipment, note };
  });
}
