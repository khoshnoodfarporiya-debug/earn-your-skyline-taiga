import { validatePhone } from "../phone/validate";
import {
  every,
  inCatalogue,
  isInt,
  isObj,
  isStr,
  numbers,
  oneOf,
} from "../validate";
import { CITY_BY_ID } from "./cities";
import {
  EQUIPMENT_BY_ID,
  FACILITY_BY_ID,
  ROLE_BY_ID,
  SPECIALTY_BY_ID,
} from "./data";
import { QUALIFICATION_BY_ID } from "./progression";
import { CAMPAIGN_BY_ID } from "./marketing";
import { LIFESTYLE_BY_ID } from "./lifestyle";
import { FLEET_BY_ID } from "./fleet";
import { OUTBREAK_BY_ID } from "./outbreaks";
import type { TriagePolicy } from "./types";

/**
 * THE PHYSICIAN'S SAVE CONTRACT
 *
 * Everything the medical career persists, checked against the catalogues it
 * was written from. This lives beside the career it describes rather than in
 * `save.ts`, so the root validator knows nothing about clinics — a second
 * career brings its own validator and `save.ts` does not grow a branch.
 *
 * Wired up as `doctor.validateData`. A career that omits the hook simply
 * has its data slice accepted, which is the right default for a career whose
 * shape has not been pinned down yet.
 */

const TRIAGE: readonly TriagePolicy[] = ["urgent", "profitable", "volume"];
const BLOCKED_BY = ["capacity", "department", "equipment", "staff"] as const;

export function validateMedicalData(data: unknown): boolean {
  if (!isObj(data)) return false;
  const m = data.med;
  if (!isObj(m)) return false;

  // ------------------------------------------------------------ the estate
  if (
    !every(
      m.facilities,
      (f) =>
        isObj(f) &&
        isStr(f.id) &&
        isStr(f.name) &&
        inCatalogue(f.type, FACILITY_BY_ID) &&
        inCatalogue(f.city, CITY_BY_ID),
    )
  ) {
    return false;
  }

  if (
    !every(
      m.staff,
      (x) =>
        isObj(x) &&
        isStr(x.id) &&
        isStr(x.name) &&
        inCatalogue(x.role, ROLE_BY_ID) &&
        (x.specialty === null || inCatalogue(x.specialty, SPECIALTY_BY_ID)) &&
        numbers(x, ["skill", "salary"]),
    )
  ) {
    return false;
  }

  if (!every(m.departments, (d) => inCatalogue(d, SPECIALTY_BY_ID))) return false;
  if (!every(m.equipment, (e) => inCatalogue(e, EQUIPMENT_BY_ID))) return false;
  /*
   * The fleet is optional: a save written before ambulances existed has no
   * `fleet` at all, and that is a valid v11 save rather than a corrupt one.
   * Present-but-wrong is still rejected — `undefined` is the only pass.
   */
  if (m.fleet !== undefined && !every(m.fleet, (v) => inCatalogue(v, FLEET_BY_ID))) {
    return false;
  }
  if (
    !every(
      m.qualifications,
      (q) =>
        isObj(q) &&
        inCatalogue(q.id, QUALIFICATION_BY_ID) &&
        (q.specialty === null || inCatalogue(q.specialty, SPECIALTY_BY_ID)),
    )
  ) {
    return false;
  }
  if (!every(m.campaigns, (c) => inCatalogue(c, CAMPAIGN_BY_ID))) return false;
  if (!every(m.lifestyle, (l) => inCatalogue(l, LIFESTYLE_BY_ID))) return false;
  if (!every(m.solved, (p) => inCatalogue(p, OUTBREAK_BY_ID))) return false;

  // -------------------------------------------------------------- the map
  if (!every(m.cities, (c) => inCatalogue(c, CITY_BY_ID))) return false;
  if (!inCatalogue(m.homeCity, CITY_BY_ID)) return false;
  // You cannot work somewhere you hold no licence for.
  if (!(m.cities as string[]).includes(m.homeCity as string)) return false;

  if (!isObj(m.panels)) return false;
  for (const [id, value] of Object.entries(m.panels)) {
    if (!inCatalogue(id, CITY_BY_ID) || !numbers({ v: value }, ["v"])) {
      return false;
    }
  }

  if (
    !every(
      m.outbreaks,
      (o) =>
        isObj(o) &&
        inCatalogue(o.id, OUTBREAK_BY_ID) &&
        inCatalogue(o.city, CITY_BY_ID) &&
        numbers(o, ["weeksLeft"]) &&
        isInt(o.startedWeek) &&
        typeof o.contained === "boolean",
    )
  ) {
    return false;
  }

  // ------------------------------------------------------- last week's work
  if (
    !every(
      m.lastCases,
      (c) =>
        isObj(c) &&
        isStr(c.conditionId) &&
        isStr(c.label) &&
        inCatalogue(c.specialty, SPECIALTY_BY_ID) &&
        numbers(c, [
          "severity",
          "arrived",
          "treated",
          "succeeded",
          "failed",
          "turnedAway",
          "revenue",
        ]) &&
        (c.blockedBy === null || oneOf(c.blockedBy, BLOCKED_BY)),
    )
  ) {
    return false;
  }

  if (
    !every(
      m.lastCityReports,
      (r) =>
        isObj(r) &&
        inCatalogue(r.city, CITY_BY_ID) &&
        numbers(r, [
          "slots",
          "capacity",
          "panel",
          "catchment",
          "arrived",
          "treated",
          "turnedAway",
          "revenue",
        ]),
    )
  ) {
    return false;
  }

  if (!isInt(m.nextId) || m.nextId < 0) return false;
  if (!oneOf(m.triage, TRIAGE)) return false;

  // ----------------------------------------------------------------- phone
  /*
   * Delegated to the shared validator every career now uses. This block
   * used to hold its own copy of these checks — and its own gaps: any
   * object passed as a choice, and `answered` was any integer, which the
   * thread view then dereferenced. One validator, one set of claims.
   */
  if (!validatePhone(m.phone)) return false;

  // -------------------------------------------------------------- supplies
  const supplies = m.supplies;
  if (!isObj(supplies)) return false;
  if (typeof supplies.autoOrder !== "boolean") return false;
  if (!numbers(supplies, ["stock", "lastConsumption", "throttleWeeks"])) {
    return false;
  }

  return true;
}
