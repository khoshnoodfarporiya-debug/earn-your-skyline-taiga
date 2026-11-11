import type { CityId, MedicalState, OutbreakDef, SpecialtyId } from "./types";

/**
 * OUTBREAKS
 *
 * An outbreak is not an event with a button. It is a condition that sits on a
 * city for weeks and changes the caseload while it lasts: a flood of cases in
 * one or two specialties, arriving whether or not you are equipped for them.
 *
 * You cannot simply pay it away. The three responses are the three things a
 * clinician actually has:
 *
 *   CONTAIN   — cheap, immediate, buys you weeks but does not end it
 *   RESEARCH  — costs your own time and CPD; ends it early and permanently,
 *               and the work is publishable
 *   VACCINATE — expensive and needs a pharmacy; ends it fastest and wins you
 *               enormous public standing
 *
 * Doing nothing is a real option and sometimes correct: a mild outbreak in a
 * city you barely operate in is a surge of billable work, not a crisis.
 */

export const OUTBREAKS: OutbreakDef[] = [
  {
    id: "influenza",
    label: "Influenza surge",
    pathogen: "Seasonal H3N2",
    blurb:
      "It started in the schools and it is in the care homes by Thursday. Nothing exotic — just far more of it than anyone has beds for.",
    affects: ["general", "paediatrics", "emergency"],
    severity: 2,
    surge: 1.9,
    duration: 6,
    riskPerWeek: 0.5,
    reputationPerWeek: -0.4,
    researchCpd: 25,
    researchCost: 18_000,
    containCost: 9_000,
    vaccineCost: 60_000,
  },
  {
    id: "gastro",
    label: "Gastroenteritis outbreak",
    pathogen: "Norovirus",
    blurb:
      "A water supply, a restaurant, or a cruise ship — nobody agrees which. The whole city is unwell at once.",
    affects: ["general", "paediatrics"],
    severity: 2,
    surge: 2.1,
    duration: 4,
    riskPerWeek: 0.4,
    reputationPerWeek: -0.3,
    researchCpd: 20,
    researchCost: 14_000,
    containCost: 7_000,
    vaccineCost: 44_000,
  },
  {
    id: "measles",
    label: "Measles cluster",
    pathogen: "Measles morbillivirus",
    blurb:
      "Vaccination rates slipped and it found the gap. Preventable, which is exactly why the coverage will be brutal.",
    affects: ["paediatrics", "general"],
    severity: 3,
    surge: 1.7,
    duration: 8,
    riskPerWeek: 0.9,
    reputationPerWeek: -0.9,
    researchCpd: 30,
    researchCost: 26_000,
    containCost: 14_000,
    vaccineCost: 72_000,
  },
  {
    id: "resistant",
    label: "Resistant infection",
    pathogen: "Carbapenem-resistant Klebsiella",
    blurb:
      "It is in your own wards. Every antibiotic on the shelf has been tried and the microbiology is not encouraging.",
    affects: ["surgery", "emergency", "oncology"],
    severity: 4,
    surge: 1.5,
    duration: 9,
    riskPerWeek: 2.1,
    reputationPerWeek: -1.4,
    researchCpd: 45,
    researchCost: 48_000,
    containCost: 26_000,
    vaccineCost: 0, // nothing to vaccinate against
  },
  {
    id: "dengue",
    label: "Dengue season",
    pathogen: "Dengue virus",
    blurb:
      "Standing water after the rains. It will burn through the city and it will come back next year.",
    affects: ["general", "emergency", "paediatrics"],
    severity: 3,
    surge: 2.2,
    duration: 7,
    riskPerWeek: 1.0,
    reputationPerWeek: -0.7,
    researchCpd: 35,
    researchCost: 30_000,
    containCost: 16_000,
    vaccineCost: 88_000,
  },
  {
    id: "meningitis",
    label: "Meningococcal cluster",
    pathogen: "Neisseria meningitidis",
    blurb:
      "Three cases in a fortnight in the same university halls. It moves fast and it kills healthy young people.",
    affects: ["emergency", "neurology", "paediatrics"],
    severity: 4,
    surge: 1.4,
    duration: 6,
    riskPerWeek: 1.8,
    reputationPerWeek: -1.2,
    researchCpd: 40,
    researchCost: 38_000,
    containCost: 20_000,
    vaccineCost: 78_000,
  },
  {
    id: "respiratory",
    label: "Novel respiratory virus",
    pathogen: "Unclassified coronavirus",
    blurb:
      "Nobody has a name for it yet. The reference lab is three weeks behind and your emergency department is already full.",
    affects: ["emergency", "general", "cardiology"],
    severity: 5,
    surge: 2.6,
    duration: 12,
    riskPerWeek: 2.6,
    reputationPerWeek: -1.8,
    researchCpd: 60,
    researchCost: 85_000,
    containCost: 45_000,
    vaccineCost: 190_000,
  },
  {
    id: "hepatitis",
    label: "Hepatitis A outbreak",
    pathogen: "Hepatitis A virus",
    blurb:
      "Traced to a food handler. Contained in theory, and spreading in practice.",
    affects: ["general", "oncology"],
    severity: 3,
    surge: 1.5,
    duration: 6,
    riskPerWeek: 0.8,
    reputationPerWeek: -0.6,
    researchCpd: 28,
    researchCost: 22_000,
    containCost: 12_000,
    vaccineCost: 56_000,
  },
];

export const OUTBREAK_BY_ID = new Map(OUTBREAKS.map((o) => [o.id, o]));

/* --------------------------------------------------------------- pressure */

/**
 * The chance an outbreak begins somewhere in your network this week.
 *
 * Three things push it up, and each is something the player can see:
 *
 *   - the base rate, so no week is ever truly safe
 *   - how long the run has gone on, so the endgame is the dangerous part
 *   - how many cities you operate in, because reach is exposure
 *
 * Capped, because a run where something is always burning is not a harder
 * game — it is a game where the outbreak system stops meaning anything.
 *
 * Pure, so the interface can show the player the same number the simulation
 * rolls against instead of hiding it.
 */
export function outbreakPressure(week: number, cities: number): number {
  if (cities <= 0) return 0;
  const base = 0.012;
  const fromTime = Math.max(0, week) * 0.0013;
  const fromReach = Math.max(0, cities) * 0.02;
  return Math.min(0.22, base + fromTime + fromReach);
}

/**
 * The worst pathogen the world will throw at you this week.
 *
 * An early outbreak is something a one-room practice can absorb; the ones
 * that can end a career only appear once there has been time to build for
 * them. Without this ramp a week-four run could draw a severity-five
 * pathogen and simply lose, which reads as unfairness rather than difficulty.
 */
export function severityCeiling(week: number): number {
  if (week < 16) return 2;
  if (week < 40) return 3;
  if (week < 80) return 4;
  return 5;
}

/** How the current pressure should be described to the player. */
export function pressureBand(p: number): "low" | "rising" | "high" | "severe" {
  if (p < 0.04) return "low";
  if (p < 0.08) return "rising";
  if (p < 0.13) return "high";
  return "severe";
}

export const outbreakOf = (id: string) => OUTBREAK_BY_ID.get(id);

/** Case-mix multiplier an active outbreak applies in its city. */
export function outbreakSurge(
  m: MedicalState,
  city: CityId,
  specialty: SpecialtyId,
): number {
  let mult = 1;
  for (const active of m.outbreaks) {
    if (active.city !== city) continue;
    const def = OUTBREAK_BY_ID.get(active.id);
    if (!def || !def.affects.includes(specialty)) continue;
    // Containment blunts the surge without ending it.
    mult *= active.contained ? 1 + (def.surge - 1) * 0.45 : def.surge;
  }
  return mult;
}

export const activeIn = (m: MedicalState, city: CityId) =>
  m.outbreaks.filter((o) => o.city === city);

/** Whether a vaccination programme is even possible for this pathogen. */
export const hasVaccine = (id: string) =>
  (OUTBREAK_BY_ID.get(id)?.vaccineCost ?? 0) > 0;
