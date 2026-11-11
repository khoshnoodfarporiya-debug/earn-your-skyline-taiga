import type { RunState } from "../game/types";
import { med } from "../game/careers/doctor";
import { ROLE_BY_ID } from "../game/medical/data";
import {
  computeCapacity,
  facilitySlots,
  techniciansNeeded,
} from "../game/medical/sim";
import { supplyThrottle } from "../game/medical/supplies";
import { cultureScore, productivityFactor } from "../game/medical/culture";
import { setbackEffects } from "../game/setbacks";
import { SETBACK_LABEL } from "../game/setbacks";
import type { ScreenId } from "./navigation";

/**
 * WHERE YOUR WEEK'S CAPACITY COMES FROM, AND WHAT EATS IT
 *
 * "Capacity 412" is a number a player can neither predict nor influence on
 * purpose. This decomposes it into the terms the simulation actually multiplies
 * together, in the order it multiplies them, and names the one that is
 * currently binding.
 *
 * ------------------------------------------------------- the real arithmetic
 *
 * From `doctor.ts` and `sim.ts`, per city, this is the whole calculation:
 *
 *   people    = clinicianUnits × (1 + nurseBonus) + supportUnits + yourHours
 *   base      = min(facilitySlots, people)          ← the binding constraint
 *   effective = base
 *             × (1 + manageBlocks × 0.03)           ← running the practice
 *             × supplyThrottle                      ← 0.6 while stocked out
 *             × productivityFactor(culture)         ← 0.86 … 1.14
 *
 * and a suspension zeroes your own hours entirely, because you personally are
 * not allowed to work.
 *
 * Every row below is one of those terms. If the engine changes, this changes
 * with it or the test that compares the two fails — `pipelineMatchesEngine`
 * exists for exactly that.
 *
 * ------------------------------------------------------------- what is shown
 *
 * `min(space, people)` is the part players get wrong: buying a hospital when
 * you are people-limited buys nothing at all, and the pipeline says so in
 * words rather than leaving it to be inferred from two bars.
 */

export type CapacityRowKind = "source" | "limit" | "modifier" | "total";

export interface CapacityRow {
  id: string;
  label: string;
  /** Units contributed, or the multiplier applied. */
  value: number;
  /** Pre-formatted for display: "+142 units", "×0.94". */
  display: string;
  kind: CapacityRowKind;
  /** What this term is, and what moves it. */
  detail: string;
  /** Where to go about it. */
  destination?: ScreenId;
  /** True when this row is the reason capacity is what it is. */
  binding?: boolean;
}

export interface CapacityPipeline {
  /** Everyone who treats, before the space check. */
  people: number;
  /** What the buildings can host. */
  space: number;
  /** min(people, space). */
  base: number;
  /** After every multiplier. */
  effective: number;
  limitedBy: "space" | "people";
  /** One sentence naming the binding constraint. */
  bindingLabel: string;
  bindingDetail: string;
  bindingDestination: ScreenId;
  /** What one more clinic block would add, so the planner is legible. */
  perClinicBlock: number;
  rows: CapacityRow[];
}

/**
 * Decompose the capacity that would apply to a week with `clinicBlocks` of
 * your own clinical time in it.
 *
 * Network-wide rather than per city: the per-city split is a second question,
 * and answering both at once produces a table nobody reads. `capacityIn`
 * remains the per-city function and is unchanged.
 */
export function capacityPipeline(
  state: RunState,
  clinicBlocks: number,
): CapacityPipeline {
  const m = med(state);
  const sb = setbackEffects(state.setbacks ?? []);
  /* A suspension does not close the practice; it removes you from it. The
     engine passes 0 blocks in that case, so the pipeline must too. */
  const ownBlocks = sb.canPractise ? clinicBlocks : 0;

  const cap = computeCapacity(m, ownBlocks, state.r.skill, state.r.burnout);
  const space = facilitySlots(m);
  const people = cap.staffUnits + cap.personalUnits;
  const base = Math.max(0, Math.min(space, people));

  const throttle = supplyThrottle(m);
  const culture = cultureScore(m, state.week);
  const cultureFactor = productivityFactor(culture.score);
  const effective = base * throttle * cultureFactor;

  const perBlock =
    (10 + state.r.skill / 8) * (1 - state.r.burnout / 200) * (sb.canPractise ? 1 : 0);

  // ------------------------------------------------------------- the rows
  const clinicians = m.staff.filter(
    (s) => !["nurse", "technician", "admin", "comms"].includes(s.role),
  );
  const clinicianUnits = clinicians.reduce(
    (n, s) => n + (ROLE_BY_ID.get(s.role)?.units ?? 0),
    0,
  );
  const nurses = m.staff.filter((s) => s.role === "nurse");
  const techs = m.staff.filter((s) => s.role === "technician");
  const admins = m.staff.filter((s) => s.role === "admin");

  const rows: CapacityRow[] = [
    {
      id: "clinicians",
      label: `Clinicians on staff (${clinicians.length})`,
      value: clinicianUnits,
      display: `${Math.round(clinicianUnits)} units`,
      kind: "source",
      detail:
        clinicians.length > 0
          ? "GPs, consultants and surgeons. The bulk of what gets treated."
          : "Nobody employed who treats patients. Everything is your own hours.",
      destination: "staff",
    },
    {
      id: "nurses",
      label: `Nursing lift (${nurses.length})`,
      value: clinicianUnits * cap.nurseBonus,
      display: `+${Math.round(clinicianUnits * cap.nurseBonus)} units`,
      kind: "source",
      detail: `Each nurse multiplies every clinician by 5%, capped at 35%. Currently +${Math.round(cap.nurseBonus * 100)}%.`,
      destination: "staff",
    },
    {
      id: "support",
      label: `Support staff (${techs.length + admins.length})`,
      value: techs.length * 6 + admins.length * 2,
      display: `${Math.round(techs.length * 6 + admins.length * 2)} units`,
      kind: "source",
      detail:
        "Technicians run the machines; administrators free clinical time. Neither treats anyone directly.",
      destination: "staff",
    },
    {
      id: "personal",
      label: `Your own hours (${ownBlocks} block${ownBlocks === 1 ? "" : "s"})`,
      value: cap.personalUnits,
      display: `${Math.round(cap.personalUnits)} units`,
      kind: "source",
      detail: sb.canPractise
        ? `Each clinic block is worth about ${Math.round(perBlock)} units at your skill, less as burnout rises.`
        : `You may not practise: ${SETBACK_LABEL[(state.setbacks ?? [])[0]?.kind ?? "suspension"].toLowerCase()}. Your hours count for nothing until it clears.`,
      destination: "overview",
    },
    {
      id: "space",
      label: "Room in the buildings",
      value: space,
      display: `${Math.round(space)} slots`,
      kind: "limit",
      detail:
        "Every premises adds treatment slots. Capacity is whichever of people and space is smaller.",
      destination: "build",
      binding: space < people,
    },
    {
      id: "people",
      label: "People available",
      value: people,
      display: `${Math.round(people)} units`,
      kind: "limit",
      detail: "Staff plus your own hours, before space is considered.",
      destination: "staff",
      binding: people <= space,
    },
  ];

  if (throttle < 1) {
    rows.push({
      id: "supplies",
      label: "Stock-out throttle",
      value: throttle,
      display: `×${throttle.toFixed(2)}`,
      kind: "modifier",
      detail:
        "You ran out of consumables and turned auto-order off. Every site works at reduced capacity until restocked.",
      destination: "supplies",
    });
  }
  rows.push({
    id: "culture",
    label: `Workplace culture (${Math.round(culture.score)})`,
    value: cultureFactor,
    display: `×${cultureFactor.toFixed(2)}`,
    kind: "modifier",
    detail:
      "How it feels to work here, between ×0.86 and ×1.14. Pay, workload and morale together.",
    destination: "team",
  });
  rows.push({
    id: "total",
    label: "Treatment capacity this week",
    value: effective,
    display: `${Math.round(effective)} units`,
    kind: "total",
    detail:
      "What the week can actually get through. A severity-1 case costs 1 unit; a tumour resection costs 12.",
  });

  const techShort = techniciansNeeded(m) > techs.length;
  const limitedBy: "space" | "people" = space < people ? "space" : "people";

  return {
    people,
    space,
    base,
    effective,
    limitedBy,
    ...bindingWords(limitedBy, techShort, clinicians.length, throttle < 1),
    perClinicBlock: perBlock,
    rows,
  };
}

function bindingWords(
  limitedBy: "space" | "people",
  techShort: boolean,
  clinicians: number,
  stockedOut: boolean,
): {
  bindingLabel: string;
  bindingDetail: string;
  bindingDestination: ScreenId;
} {
  /* A stock-out outranks the structural limit: it is temporary, it is the
     largest single multiplier in the chain, and it is the thing the player can
     fix this afternoon. */
  if (stockedOut) {
    return {
      bindingLabel: "Your main limit this week is the consumables stock-out",
      bindingDetail:
        "Everything is running at 60% until the shelves are refilled. Buying space or staff changes nothing while this holds.",
      bindingDestination: "supplies",
    };
  }
  if (limitedBy === "space") {
    return {
      bindingLabel: "Your main limit is room to treat people in",
      bindingDetail:
        "You have more clinical hours than places to use them. More staff would sit idle; more premises would not.",
      bindingDestination: "build",
    };
  }
  if (techShort) {
    return {
      bindingLabel: "Your main limit is technician cover",
      bindingDetail:
        "Machines you already pay upkeep on cannot be used, so the cases that need them never start.",
      bindingDestination: "staff",
    };
  }
  return {
    bindingLabel:
      clinicians === 0
        ? "Your main limit is that you are the only clinician"
        : "Your main limit is clinical hours",
    bindingDetail:
      clinicians === 0
        ? "Every patient treated is one you treated. One more pair of hands is worth more than any building right now."
        : "You have more room than people to fill it. Hiring, or taking more clinic blocks yourself, is what moves this.",
    bindingDestination: "staff",
  };
}

/**
 * The invariant the test asserts: the pipeline's own total must equal the
 * engine's `computeCapacity` put through the same multipliers.
 *
 * Kept here rather than in the test file so the two can never drift apart —
 * anything that changes the arithmetic above has to change this line too.
 */
export function pipelineMatchesEngine(
  state: RunState,
  clinicBlocks: number,
): boolean {
  const m = med(state);
  const sb = setbackEffects(state.setbacks ?? []);
  const cap = computeCapacity(
    m,
    sb.canPractise ? clinicBlocks : 0,
    state.r.skill,
    state.r.burnout,
  );
  const expected =
    cap.effective *
    supplyThrottle(m) *
    productivityFactor(cultureScore(m, state.week).score);
  const got = capacityPipeline(state, clinicBlocks).effective;
  return Math.abs(expected - got) < 1e-6;
}
