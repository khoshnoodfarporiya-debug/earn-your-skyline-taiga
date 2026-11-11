import type { Rng } from "../types";
import {
  CONDITIONS,
  EQUIPMENT_BY_ID,
  FACILITY_BY_ID,
  ROLE_BY_ID,
  SPECIALTY_BY_ID,
} from "./data";
import { catchmentMultiplier } from "./marketing";
import { fleetAcuity, fleetReach, fleetUpkeep, fleetValue } from "./fleet";
import { playerCoverage } from "./progression";
import {
  biasFor,
  cityOf,
  contestedShare,
  payrollIndex,
  populationCeiling,
} from "./cities";
import { outbreakSurge } from "./outbreaks";
import type { CityId } from "./types";
import type {
  CaseResult,
  Condition,
  MedicalState,
  SpecialtyId,
  TriagePolicy,
} from "./types";

export const VISIT_RATE = 0.28;

/** Cases still arrive for departments you have not opened — at reduced volume,
 *  so the player can see what they are missing without being flooded by it. */
const UNOPENED_DEPARTMENT_WEIGHT = 0.15;

// ------------------------------------------------------------- capacity

export interface Capacity {
  /** What the buildings can physically host. */
  facilitySlots: number;
  /** What the people can actually get through. */
  staffUnits: number;
  /** What you personally add this week. */
  personalUnits: number;
  /** The binding number. */
  effective: number;
  /** Which side is the constraint, for the UI to explain. */
  limitedBy: "space" | "people";
  nurseBonus: number;
  techniciansNeeded: number;
  techniciansOn: number;
}

export function facilitySlots(med: MedicalState): number {
  return med.facilities.reduce(
    (sum, f) => sum + (FACILITY_BY_ID.get(f.type)?.slots ?? 0),
    0,
  );
}

/** Slots standing in one city. */
export function slotsIn(med: MedicalState, city: CityId): number {
  return med.facilities.reduce(
    (sum, f) =>
      f.city === city ? sum + (FACILITY_BY_ID.get(f.type)?.slots ?? 0) : sum,
    0,
  );
}

/** Every city you actually have premises in. */
export function activeCities(med: MedicalState): CityId[] {
  const seen = new Set<CityId>();
  for (const f of med.facilities) seen.add(f.city);
  return [...seen];
}

export function departmentSlots(med: MedicalState): number {
  return med.facilities.reduce(
    (sum, f) => sum + (FACILITY_BY_ID.get(f.type)?.departmentSlots ?? 0),
    0,
  );
}

/** Machines without technicians are ornaments. */
export function techniciansNeeded(med: MedicalState): number {
  const techEquip = med.equipment.filter(
    (id) => EQUIPMENT_BY_ID.get(id)?.needsTechnician,
  ).length;
  return Math.ceil(techEquip / 3);
}

/**
 * Capacity in one city. Staff are a single pool spread across the network in
 * proportion to the space each city has, while your own hours only count
 * where you personally work — which is why a distant second site needs to be
 * staffed rather than visited.
 */
export function capacityIn(
  med: MedicalState,
  city: CityId,
  clinicBlocks: number,
  playerSkill: number,
  burnout: number,
): Capacity {
  const total = facilitySlots(med);
  const here = slotsIn(med, city);
  const share = total > 0 ? here / total : 0;

  const network = computeCapacity(med, 0, playerSkill, burnout);
  const staffHere = network.staffUnits * share;
  const personalHere =
    city === med.homeCity
      ? clinicBlocks * (10 + playerSkill / 8) * (1 - burnout / 200)
      : 0;
  const people = staffHere + personalHere;

  return {
    facilitySlots: here,
    staffUnits: staffHere,
    personalUnits: personalHere,
    effective: Math.max(0, Math.min(here, people)),
    limitedBy: here < people ? "space" : "people",
    nurseBonus: network.nurseBonus,
    techniciansNeeded: network.techniciansNeeded,
    techniciansOn: network.techniciansOn,
  };
}

export function computeCapacity(
  med: MedicalState,
  clinicBlocks: number,
  playerSkill: number,
  burnout: number,
): Capacity {
  let clinicianUnits = 0;
  let supportUnits = 0;
  let nurses = 0;
  let technicians = 0;

  for (const s of med.staff) {
    const role = ROLE_BY_ID.get(s.role);
    if (!role) continue;
    if (s.role === "nurse") {
      nurses++;
      supportUnits += role.units;
    } else if (s.role === "technician") {
      technicians++;
      supportUnits += role.units;
    } else if (s.role === "admin") {
      // Admins free clinical time rather than treating anyone themselves.
      supportUnits += 2;
    } else if (s.role === "comms") {
      // Non-clinical entirely. Listed explicitly because the fallback below
      // would otherwise count them as a treating clinician.
      supportUnits += 0;
    } else {
      clinicianUnits += role.units;
    }
  }

  const nurseBonus = Math.min(0.35, nurses * 0.05);
  const staffUnits = clinicianUnits * (1 + nurseBonus) + supportUnits;
  const personalUnits =
    clinicBlocks * (10 + playerSkill / 8) * (1 - burnout / 200);

  const slots = facilitySlots(med);
  const people = staffUnits + personalUnits;

  return {
    facilitySlots: slots,
    staffUnits,
    personalUnits,
    effective: Math.max(0, Math.min(slots, people)),
    limitedBy: slots < people ? "space" : "people",
    nurseBonus,
    techniciansNeeded: techniciansNeeded(med),
    techniciansOn: technicians,
  };
}

// ------------------------------------------------------- staffing checks

/** Best skill available for a given specialty, including the player. */
export function skillFor(
  med: MedicalState,
  specialty: SpecialtyId,
  playerSkill: number,
): number {
  // Outside your own field you are competent but not expert — unless you took
  // the exams, in which case your full skill counts.
  const qualified =
    specialty === "general" || playerCoverage(med, specialty) >= 3;
  let best = qualified ? playerSkill : playerSkill * 0.8;
  for (const s of med.staff) {
    if (s.role === "gp" && specialty === "general") best = Math.max(best, s.skill);
    if (
      (s.role === "specialist" || s.role === "surgeon") &&
      s.specialty === specialty
    ) {
      best = Math.max(best, s.skill);
    }
  }
  return best;
}

export function hasSpecialist(med: MedicalState, specialty: SpecialtyId) {
  return med.staff.some(
    (s) =>
      (s.role === "specialist" || s.role === "surgeon") &&
      s.specialty === specialty,
  );
}

/**
 * The highest severity your organisation can take in a department, whoever
 * does the work. Employing a consultant and becoming one are deliberately the
 * same gate — that is what makes the qualification ladder a real alternative
 * to payroll rather than a parallel score.
 */
export function coverageFor(med: MedicalState, specialty: SpecialtyId): number {
  let level = playerCoverage(med, specialty);
  for (const s of med.staff) {
    if (s.specialty !== specialty) continue;
    if (s.role === "surgeon") level = Math.max(level, 5);
    else if (s.role === "specialist") level = Math.max(level, 4);
  }
  return level;
}

export type Block = "department" | "equipment" | "staff" | "capacity" | null;

/** Why this condition cannot be treated at all, if it cannot. */
export function blockerFor(med: MedicalState, cond: Condition): Block {
  if (!med.departments.includes(cond.specialty)) return "department";

  if (cond.equipment) {
    for (const e of cond.equipment) {
      if (!med.equipment.includes(e)) return "equipment";
    }
    if (techniciansNeeded(med) > med.staff.filter((s) => s.role === "technician").length) {
      return "staff";
    }
  }

  // Serious work needs someone actually qualified to do it — either on the
  // payroll or, if you took the exams, you.
  if (cond.severity > coverageFor(med, cond.specialty)) return "staff";
  return null;
}

/**
 * The panel one city can sustain: how much room you have there, how well
 * regarded you are, how hard you are marketing — then bounded by the share
 * incumbents leave you and hard-capped by the number of people who live
 * there. The panel drifts toward this rather than compounding off its size.
 */
export function catchmentIn(
  m: MedicalState,
  city: CityId,
  reputation: number,
): number {
  const here = slotsIn(m, city);
  if (here <= 0) return 0;
  const base = here * 3.2 * (0.55 + reputation / 100);
  /* Marketing makes more of the population want you; the fleet makes more of
     it able to reach you. Both widen the same funnel, so both multiply here —
     and an uncrewed fleet contributes nothing, which `fleetReach` enforces. */
  const marketed =
    base * (catchmentMultiplier(m, reputation) + fleetReach(m));
  const contested = marketed * contestedShare(city, reputation);
  return Math.max(0, Math.min(contested, populationCeiling(city)));
}

/** Network-wide catchment, for the headline read-out. */
export function catchment(m: MedicalState, reputation: number): number {
  const cities = activeCities(m);
  if (cities.length === 0) return 0;
  return cities.reduce((sum, c) => sum + catchmentIn(m, c, reputation), 0);
}

/** Total panel across the network. */
export function totalPanel(m: MedicalState): number {
  return Object.values(m.panels).reduce((sum, n) => sum + (n || 0), 0);
}

// ------------------------------------------------------ case generation

export function generateCases(
  med: MedicalState,
  panel: number,
  reputation: number,
  rng: Rng,
  city?: CityId,
): Map<string, number> {
  // A better-regarded practice sees more of the panel present each week.
  const rate = VISIT_RATE * (0.85 + reputation / 330);
  const total = Math.max(0, Math.round(panel * rate));

  const weights = CONDITIONS.map((cond) => {
    const open = med.departments.includes(cond.specialty);
    // Local epidemiology reshapes what walks through the door: Tokyo sends
    // tumours and strokes, Lagos sends children. An outbreak overwhelms that
    // — the affected specialties surge whether or not you can treat them.
    const local = city ? biasFor(city, cond.specialty) : 1;
    const surge = city ? outbreakSurge(med, city, cond.specialty) : 1;
    /*
     * Ambulances bring in the serious end. Scaled by severity so a critical
     * case is lifted the full amount and a trivial one not at all — a fleet
     * changes the *composition* of the week, it does not simply add patients
     * (that is `reach`, and it happens upstream in the catchment).
     */
    const acuity = 1 + fleetAcuity(med) * ((cond.severity - 1) / 4);
    return (
      cond.prevalence *
      local *
      surge *
      acuity *
      (open ? 1 : UNOPENED_DEPARTMENT_WEIGHT)
    );
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  const counts = new Map<string, number>();
  if (sum <= 0) return counts;

  for (let i = 0; i < total; i++) {
    let roll = rng.next() * sum;
    for (let j = 0; j < CONDITIONS.length; j++) {
      roll -= weights[j];
      if (roll <= 0) {
        const id = CONDITIONS[j].id;
        counts.set(id, (counts.get(id) ?? 0) + 1);
        break;
      }
    }
  }
  return counts;
}

// ------------------------------------------------------------ resolution

export interface ResolutionOutput {
  results: CaseResult[];
  revenue: number;
  reputationDelta: number;
  riskDelta: number;
  capacityUsed: number;
  treatedTotal: number;
  arrivedTotal: number;
  turnedAwayTotal: number;
  /** Patients turned away, split by what actually stopped you treating them. */
  blockedBy: Record<Exclude<Block, null>, number>;
  /** The single biggest reason, for a one-line explanation to the player. */
  topBlocker: Exclude<Block, null> | null;
}

function triageSort(policy: TriagePolicy) {
  return (a: Condition, b: Condition) => {
    if (policy === "urgent") return b.severity - a.severity || b.fee - a.fee;
    if (policy === "profitable") return b.fee / b.units - a.fee / a.units;
    return a.units - b.units; // volume: clear the most people
  };
}

export function resolveCases(
  med: MedicalState,
  arrivals: Map<string, number>,
  capacity: Capacity,
  playerSkill: number,
  rng: Rng,
  /** Scales every fee — what the work bills for in this market. */
  feeIndex = 1,
): ResolutionOutput {
  const order = [...CONDITIONS].sort(triageSort(med.triage));
  let remaining = capacity.effective;
  let revenue = 0;
  let reputationDelta = 0;
  let riskDelta = 0;
  let treatedTotal = 0;
  let arrivedTotal = 0;
  let turnedAwayTotal = 0;
  const results: CaseResult[] = [];
  const blockedBy: Record<Exclude<Block, null>, number> = {
    department: 0,
    equipment: 0,
    staff: 0,
    capacity: 0,
  };

  for (const cond of order) {
    const arrived = arrivals.get(cond.id) ?? 0;
    if (arrived === 0) continue;
    arrivedTotal += arrived;

    const spec = SPECIALTY_BY_ID.get(cond.specialty)!;
    const blocker = blockerFor(med, cond);

    if (blocker) {
      // Never treated: the patient is referred elsewhere. Mild reputational
      // cost, scaled by how badly they needed you.
      reputationDelta -= arrived * cond.severity * 0.012;
      turnedAwayTotal += arrived;
      blockedBy[blocker] += arrived;
      results.push({
        conditionId: cond.id,
        label: cond.label,
        specialty: cond.specialty,
        severity: cond.severity,
        arrived,
        treated: 0,
        succeeded: 0,
        failed: 0,
        turnedAway: arrived,
        revenue: 0,
        blockedBy: blocker,
      });
      continue;
    }

    const affordable = Math.floor(remaining / cond.units);
    const treated = Math.max(0, Math.min(arrived, affordable));
    const turnedAway = arrived - treated;
    remaining -= treated * cond.units;

    // Outcome quality: the skill on your bench against what the case demands,
    // lifted by the kit you bought for it.
    const skill = skillFor(med, cond.specialty, playerSkill);
    const equipBonus = (cond.equipment ?? []).reduce(
      (sum, e) => sum + (EQUIPMENT_BY_ID.get(e)?.qualityBonus ?? 0),
      0,
    );
    const p = Math.max(
      0.05,
      Math.min(0.985, 0.55 + (skill - cond.minSkill) / 55 + equipBonus),
    );

    let succeeded = Math.round(treated * p);
    // A little noise so identical weeks are not identical.
    if (treated > 0 && rng.chance(Math.abs(treated * p - succeeded))) {
      succeeded = Math.min(treated, succeeded + (rng.chance(0.5) ? 1 : -1));
    }
    succeeded = Math.max(0, Math.min(treated, succeeded));
    const failed = treated - succeeded;

    const fee = cond.fee * feeIndex;
    const caseRevenue = succeeded * fee + failed * fee * 0.3;
    revenue += caseRevenue;

    reputationDelta += succeeded * spec.prestige * cond.severity * 0.02;
    reputationDelta -= failed * spec.prestige * cond.severity * 0.055;
    reputationDelta -= turnedAway * cond.severity * 0.012;
    riskDelta += failed * cond.severity * 0.16;
    riskDelta += treated * 0.004;

    treatedTotal += treated;
    turnedAwayTotal += turnedAway;
    blockedBy.capacity += turnedAway;

    results.push({
      conditionId: cond.id,
      label: cond.label,
      specialty: cond.specialty,
      severity: cond.severity,
      arrived,
      treated,
      succeeded,
      failed,
      turnedAway,
      revenue: caseRevenue,
      blockedBy: turnedAway > 0 ? "capacity" : null,
    });
  }

  const topBlocker =
    (Object.entries(blockedBy)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])[0]?.[0] as Exclude<Block, null>) ?? null;

  return {
    results: results.sort((a, b) => b.arrived - a.arrived),
    revenue,
    reputationDelta,
    riskDelta,
    capacityUsed: capacity.effective - remaining,
    treatedTotal,
    arrivedTotal,
    turnedAwayTotal,
    blockedBy,
    topBlocker,
  };
}

// ------------------------------------------------------------------ costs

export function weeklyUpkeep(med: MedicalState): number {
  let total = 0;
  // Premises cost what the local market charges for them.
  for (const f of med.facilities) {
    total +=
      (FACILITY_BY_ID.get(f.type)?.upkeep ?? 0) * cityOf(f.city).costIndex;
  }
  for (const e of med.equipment) {
    total += EQUIPMENT_BY_ID.get(e)?.upkeep ?? 0;
  }
  for (const d of med.departments) {
    total += SPECIALTY_BY_ID.get(d)?.upkeep ?? 0;
  }
  /* Charged whether or not the fleet is crewed. A vehicle you cannot staff
     still costs you what a vehicle costs. */
  total += fleetUpkeep(med);
  return total;
}

/** Wages track the cost of living everywhere you operate. */
export function payroll(med: MedicalState): number {
  const index = payrollIndex(med);
  return med.staff.reduce((sum, s) => sum + s.salary, 0) * index;
}

export function assetValue(med: MedicalState): number {
  let total = 0;
  for (const f of med.facilities) {
    const type = FACILITY_BY_ID.get(f.type);
    total += (type?.cost ?? 0) * cityOf(f.city).propertyIndex * 0.85;
  }
  for (const e of med.equipment) {
    total += (EQUIPMENT_BY_ID.get(e)?.cost ?? 0) * 0.6;
  }
  total += fleetValue(med);
  return total;
}

/** What a facility costs to buy in a given city. */
export function facilityPrice(typeId: string, city: CityId): number {
  const type = FACILITY_BY_ID.get(typeId as never);
  return Math.round((type?.cost ?? 0) * cityOf(city).propertyIndex);
}
