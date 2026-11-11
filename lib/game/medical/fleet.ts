import type { FleetVehicle, MedicalState } from "./types";

/**
 * THE FLEET
 *
 * Everything else you buy makes you better at treating whoever walks in.
 * An ambulance changes who walks in.
 *
 * ------------------------------------------------------------- the decision
 *
 * A vehicle widens the catchment — people who could not have got to you become
 * people you see — and tilts the arriving mix toward the serious end. Both
 * halves matter, and the second one is the trap: critical work pays several
 * times what a routine appointment pays, and a practice that cannot cover it
 * turns it away and takes the reputation hit for having been asked.
 *
 * So the honest summary of this catalogue is: it is an amplifier. Bought by a
 * practice with open departments and a bench deep enough to cover them, it is
 * the strongest thing on the shelf. Bought early, by a practice already
 * turning a third of its arrivals away, it makes the number worse and charges
 * upkeep for the privilege. That is the same shape as the rest of the game —
 * the Caseload screen already tells a player which of the two they are.
 *
 * ------------------------------------------------------------------- crew
 *
 * Nothing here does anything without paramedics. This is deliberately the
 * `needsTechnician` rule rather than a purchase block: you can own a vehicle
 * you cannot staff, exactly as you can own a scanner you cannot run, and the
 * interface says so on the card rather than refusing the sale. Being able to
 * get into that state — and see why — is more instructive than being stopped.
 *
 * Crewing *scales* rather than switching, for reasons measured rather than
 * assumed — see `fleetCrewRatio`.
 *
 * -------------------------------------------------------------- the numbers
 *
 * `reach` is added to the catchment multiplier, so a mobile ICU is "+22% of
 * the surrounding population" and the three of them together are +42%, not
 * ×1.42 compounded. Additive because these are vehicles covering ground, and
 * a second one covers more ground rather than multiplying the first.
 *
 * `retention` sits near a car's, not a building's. An ambulance is a
 * depreciating vehicle with a specialist conversion on it, and pretending it
 * holds its value would make the fleet a free store of wealth against the
 * net-worth goal.
 */
export const FLEET: FleetVehicle[] = [
  {
    id: "patient_transport",
    label: "Patient transport van",
    blurb:
      "Brings in the people who simply cannot get to you — the frail, the housebound, the ones two buses away. It is not an emergency vehicle and does not pretend to be.",
    cost: 48_000,
    upkeep: 340,
    reach: 0.06,
    /* No acuity: this one carries routine patients who were always going to
       be routine. It widens the door without changing what comes through. */
    acuity: 0,
    crew: 1,
    retention: 0.55,
  },
  {
    id: "emergency_ambulance",
    label: "Emergency ambulance",
    blurb:
      "Blue lights, a trained crew and the equipment to start treatment on the road. Brings you the work that pays — and the work that is noticed when you turn it down.",
    cost: 145_000,
    upkeep: 980,
    reach: 0.14,
    acuity: 0.12,
    crew: 2,
    retention: 0.5,
  },
  {
    id: "mobile_icu",
    label: "Mobile intensive care unit",
    blurb:
      "An intensive care bed that drives. It will bring you the most serious cases in the region, which is worth a great deal if you can take them and expensive if you cannot.",
    cost: 390_000,
    upkeep: 2_600,
    reach: 0.22,
    acuity: 0.25,
    crew: 3,
    retention: 0.55,
  },
];

export const FLEET_BY_ID = new Map(FLEET.map((v) => [v.id, v]));

/**
 * The vehicles actually owned.
 *
 * `fleet` is optional on the save, so this is the single place that decides an
 * absent fleet is an empty one. Everything else asks this.
 */
const owned = (m: MedicalState): FleetVehicle[] =>
  (m.fleet ?? [])
    .map((id) => FLEET_BY_ID.get(id))
    .filter((x): x is FleetVehicle => !!x);

export const fleetSize = (m: MedicalState): number => (m.fleet ?? []).length;

/** Paramedics the fleet needs before any of it works. */
export const crewNeeded = (m: MedicalState): number =>
  owned(m).reduce((n, v) => n + v.crew, 0);

export const crewOn = (m: MedicalState): number =>
  m.staff.filter((x) => x.role === "paramedic").length;

/** Fully crewed — every vehicle could roll at once. */
export const fleetCrewed = (m: MedicalState): boolean =>
  crewNeeded(m) === 0 || crewOn(m) >= crewNeeded(m);

/**
 * How much of the fleet is actually running, 0 to 1.
 *
 * This was all-or-nothing to begin with, on the reasoning that part-crewing
 * means deciding which vehicle the two paramedics you have are sitting in.
 * Measured against the engine's actual churn, that was clearly the wrong call:
 * a probe over 120 weeks had a two-vehicle fleet **live for 9 weeks and parked
 * for 88**, because one resignation out of three zeroed a $193,000 asset and
 * the practice could not keep three paramedics on the books.
 *
 * A cliff that steep does not read as a demanding mechanic, it reads as a
 * broken one. Scaling instead means a crew of two out of three runs two thirds
 * of the fleet — and it matches how the engine already treats people
 * everywhere else, as one pool spread across the work rather than assigned to
 * a particular room.
 */
export const fleetCrewRatio = (m: MedicalState): number => {
  const need = crewNeeded(m);
  if (need === 0) return 0;
  return Math.max(0, Math.min(1, crewOn(m) / need));
};

/**
 * Added to the catchment multiplier — how much further you reach.
 *
 * Scaled by how crewed the fleet is, so an uncrewed vehicle reaches nobody at
 * all and a half-crewed one reaches half as far. The upkeep is charged either
 * way — that is the cost of owning a vehicle you cannot staff.
 */
export function fleetReach(m: MedicalState): number {
  return owned(m).reduce((n, v) => n + v.reach, 0) * fleetCrewRatio(m);
}

/**
 * How far the arriving case mix tilts toward the serious end.
 *
 * Consumed by `generateCases`, which raises the weight of a condition by
 * `1 + acuity × (severity − 1) / 4` — so at 0.25 a critical case is a quarter
 * more likely to arrive than it was and a trivial one is untouched.
 */
export function fleetAcuity(m: MedicalState): number {
  return owned(m).reduce((n, v) => n + v.acuity, 0) * fleetCrewRatio(m);
}

export const fleetUpkeep = (m: MedicalState): number =>
  owned(m).reduce((n, v) => n + v.upkeep, 0);

/** What the fleet contributes to net worth — less than it cost, like a car. */
export const fleetValue = (m: MedicalState): number =>
  owned(m).reduce((n, v) => n + v.cost * v.retention, 0);
