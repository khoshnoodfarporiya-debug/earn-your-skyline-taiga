import type {
  HeldQualification,
  MedicalState,
  Qualification,
  QualificationId,
  SpecialtyId,
} from "./types";

/**
 * THE CLINICAL LADDER
 *
 * Qualifications are not a score. Each one changes what you personally are
 * allowed to treat, which is the same gate that hiring a specialist opens —
 * so every rung is a real choice between *becoming* the consultant and
 * *employing* one.
 *
 * Employing is faster. Becoming is cheaper forever, and the academic rungs
 * (doctorate, professorship) do things no hire can: they make everyone you
 * recruit better.
 */

export const QUALIFICATIONS: Qualification[] = [
  {
    id: "md",
    label: "Doctor of Medicine",
    postNominal: "MD",
    blurb: "Medical school and residency, already behind you and already paid for.",
    tuition: 0,
    cpd: 0,
    minSkill: 0,
    requires: [],
    specialised: false,
    effect: ["Treat severity 1–2 in any open department"],
  },
  {
    id: "membership",
    label: "Membership of the Royal College",
    postNominal: "MRCP",
    blurb:
      "Written papers and a clinical exam in one field. The first real specialisation.",
    tuition: 14_000,
    cpd: 40,
    minSkill: 50,
    requires: ["md"],
    specialised: true,
    effect: [
      "Treat severity 3 yourself in the chosen department",
      "Your full skill counts there, not 80%",
    ],
  },
  {
    id: "doctorate",
    label: "Doctorate",
    postNominal: "PhD",
    blurb:
      "Original research, three years of it. Nobody needs one to practise, and it changes who will work for you.",
    tuition: 38_000,
    cpd: 100,
    minSkill: 58,
    requires: ["md"],
    specialised: false,
    effect: ["+10 skill on every future recruit", "+3 reputation on award"],
  },
  {
    id: "fellowship",
    label: "Fellowship",
    postNominal: "FRCP",
    blurb:
      "Full consultant standing in your field. You become the specialist you would otherwise hire.",
    tuition: 34_000,
    cpd: 90,
    minSkill: 64,
    requires: ["membership"],
    specialised: true,
    effect: [
      "Treat severity 4 yourself in the chosen department",
      "Counts as a consultant for that department",
    ],
  },
  {
    id: "surgical",
    label: "Fellowship in Surgery",
    postNominal: "FRCS",
    blurb:
      "You operate. The most demanding qualification on the ladder and the only route to the biggest cases without a surgeon on payroll.",
    tuition: 52_000,
    cpd: 130,
    minSkill: 70,
    requires: ["fellowship"],
    specialised: true,
    effect: [
      "Treat severity 5 yourself in the chosen department",
      "Counts as a surgeon there",
    ],
  },
  {
    id: "professorship",
    label: "Professorship",
    postNominal: "Prof",
    blurb:
      "A teaching chair. Your practice becomes somewhere people train, which is worth more than anything you could buy.",
    tuition: 70_000,
    cpd: 190,
    minSkill: 76,
    requires: ["doctorate", "fellowship"],
    specialised: false,
    effect: [
      "Every clinician on staff gains skill each week",
      "+18 skill on every future recruit",
      "+6 reputation on award",
    ],
  },
];

export const QUALIFICATION_BY_ID = new Map(
  QUALIFICATIONS.map((q) => [q.id, q]),
);

export const holds = (m: MedicalState, id: QualificationId) =>
  m.qualifications.some((q) => q.id === id);

export const heldIn = (
  m: MedicalState,
  id: QualificationId,
  specialty: SpecialtyId,
) => m.qualifications.some((q) => q.id === id && q.specialty === specialty);

/**
 * The highest case severity you can personally take in a given department.
 * This is the whole point of the ladder — it is checked in exactly the same
 * place as "do I employ a consultant for this".
 */
export function playerCoverage(
  m: MedicalState,
  specialty: SpecialtyId,
): number {
  if (heldIn(m, "surgical", specialty)) return 5;
  if (heldIn(m, "fellowship", specialty)) return 4;
  if (heldIn(m, "membership", specialty)) return 3;
  return 2;
}

/** Doctorate and a chair make everyone you hire better. */
export function recruitBonus(m: MedicalState): number {
  let bonus = 0;
  if (holds(m, "doctorate")) bonus += 10;
  if (holds(m, "professorship")) bonus += 18;
  return bonus;
}

/** Why an enrolment is not currently possible, or null when it is. */
export function enrolBlocker(
  m: MedicalState,
  q: Qualification,
  cash: number,
  cpd: number,
  skill: number,
  specialty: SpecialtyId | null,
): string | null {
  if (q.specialised) {
    if (!specialty) return "Choose a department";
    if (m.qualifications.some((h) => h.id === q.id && h.specialty === specialty))
      return "Already held in that department";
    if (!m.departments.includes(specialty)) return "Department not open";
  } else if (holds(m, q.id)) {
    return "Already held";
  }
  for (const req of q.requires) {
    // A specialised prerequisite must have been taken in the same field.
    const needed = QUALIFICATION_BY_ID.get(req);
    const ok =
      needed?.specialised && specialty
        ? heldIn(m, req, specialty)
        : holds(m, req);
    if (!ok) {
      return `Requires ${needed?.postNominal ?? req}${needed?.specialised && specialty ? " in this field" : ""}`;
    }
  }
  if (skill < q.minSkill) return `Needs skill ${q.minSkill}`;
  if (cpd < q.cpd) return `Needs ${q.cpd} CPD`;
  if (cash < q.tuition) return "Cannot afford the tuition";
  return null;
}

/** Post-nominals for the header, e.g. "Prof · MD, PhD, FRCS". */
export function titleFor(m: MedicalState): string {
  const order: QualificationId[] = [
    "md",
    "membership",
    "doctorate",
    "fellowship",
    "surgical",
  ];
  const seen = new Set<QualificationId>();
  const letters: string[] = [];
  for (const id of order) {
    if (holds(m, id) && !seen.has(id)) {
      seen.add(id);
      letters.push(QUALIFICATION_BY_ID.get(id)!.postNominal);
    }
  }
  const prefix = holds(m, "professorship") ? "Prof" : "Dr";
  return `${prefix} · ${letters.join(", ")}`;
}

export function heldList(m: MedicalState): HeldQualification[] {
  return m.qualifications;
}
