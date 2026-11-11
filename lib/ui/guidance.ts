import type { RunState } from "../game/types";
import { med } from "../game/careers/doctor";
import { activeCities, capacityIn } from "../game/medical/sim";
import type { ScreenId } from "./navigation";
import { chefStep } from "./chefHelp";
import { lawyerStep } from "./lawyerHelp";
import { founderStep } from "./founderHelp";
import { politicianStep } from "./politicianHelp";
import { architectStep } from "./architectHelp";
import { engineerStep } from "./engineerHelp";

/**
 * Progressive disclosure, done as one sentence at a time.
 *
 * A new player does not need to know about qualifications, marketing or
 * lifestyle in week one — they need to know that a week is six blocks of time
 * and that committing it resolves the caseload. So instead of a tutorial
 * modal, the Overview carries exactly one "next step" derived from where the
 * run actually is.
 *
 * Each step names its own trigger, so the sequence teaches the loop first and
 * only introduces a system at the moment it starts to bind. Steps are ordered
 * most-urgent first and the first match wins.
 */

export interface Step {
  id: string;
  /** Imperative and specific — what to do right now. */
  title: string;
  /** Why it matters, in one line. */
  detail: string;
  /** Where the action lives, when it is not on the Overview itself. */
  destination?: ScreenId;
  actionLabel?: string;
}

export function nextStep(
  state: RunState,
  /**
   * The week's allocation, not just its total. The capacity estimate needs
   * to know how many blocks are actually *clinic* — an earlier version was
   * handed the total and treated it as clinic time, so a week spent entirely
   * on rest or study reported full personal capacity and the "more patients
   * than you can see" hint never fired when it mattered.
   */
  alloc: Record<string, number>,
  allocatedBlocks: number,
  budget: number,
  hasCommitted: boolean,
): Step | null {
  /*
   * --- the loop itself ----------------------------------------------------
   *
   * Hoisted above the career dispatch, because an unspent block is an unspent
   * block whatever the profession — and these three were the reason a Chef and
   * a Solicitor got no guidance at all rather than merely no career-specific
   * guidance.
   *
   * The week-one framing used to live here as its own step: "your week is six
   * blocks of time", followed by the same sentence the onboarding lesson now
   * carries three inches above it. Two cards saying the same thing is worse
   * than either alone, so the explanation belongs to the lesson and this is
   * back to being a terse nudge about the current plan.
   */
  if (allocatedBlocks === 0) {
    return {
      id: "allocate",
      title: "Assign your time",
      detail: "Nothing happens until you spend at least one block.",
    };
  }

  if (allocatedBlocks < budget) {
    return {
      id: "allocate:partial",
      title: `${budget - allocatedBlocks} block${budget - allocatedBlocks === 1 ? "" : "s"} still unassigned`,
      detail:
        "Unused blocks are wasted — the week resolves whether or not you spend them.",
    };
  }

  if (!hasCommitted && state.week === 1) {
    return {
      id: "intro:commit",
      title: "Commit the week",
      detail: "Nothing is spent, and nothing resolves, until you do.",
    };
  }

  /* Past the plan, the next step is entirely the career's own business. */
  if (state.careerId === "chef") return chefStep(state, alloc);
  if (state.careerId === "lawyer") return lawyerStep(state, alloc);
  if (state.careerId === "founder") return founderStep(state, alloc);
  if (state.careerId === "politician") return politicianStep(state, alloc);
  if (state.careerId === "architect") return architectStep(state, alloc);
  if (state.careerId === "engineer") return engineerStep(state, alloc);
  if (state.careerId !== "doctor") return null;

  const m = med(state);
  const week = state.week;
  const clinicBlocks = alloc.clinic ?? 0;

  // --- capacity, the first real constraint ---------------------------------
  const cities = activeCities(m);
  const demand = state.r.panel * 0.28;
  // capacityIn only credits personal hours to the home city, so summing
  // across the network counts the player's clinic blocks exactly once.
  const capacity = cities.reduce(
    (sum, c) =>
      sum + capacityIn(m, c, clinicBlocks, state.r.skill, state.r.burnout).effective,
    0,
  );

  if (week >= 3 && capacity > 0 && demand > capacity * 1.15) {
    return {
      id: "capacity",
      title: "More patients than you can see",
      detail:
        "Hiring adds hours; premises add room. Whichever you have less of is the one to buy.",
      destination: "staff",
      actionLabel: "Open Staff",
    };
  }

  // --- capability: the medicine you are in ---------------------------------
  if (week >= 6 && m.departments.length === 1 && state.r.cash > 20_000) {
    return {
      id: "departments",
      title: "You only treat general practice",
      detail:
        "Everything else that walks in gets referred out. A second department is the biggest single earner available to you.",
      destination: "build",
      actionLabel: "Open Build",
    };
  }

  if (week >= 10 && m.staff.length === 0) {
    return {
      id: "delegate",
      title: "Every hour of treatment is still your own",
      detail:
        "Hired clinicians add capacity that does not cost you burnout. This is how the practice outgrows you.",
      destination: "staff",
      actionLabel: "Open Staff",
    };
  }

  // --- the wider systems, introduced only once they can pay -----------------
  if (week >= 14 && state.r.cpd >= 40 && m.qualifications.length === 1) {
    return {
      id: "qualifications",
      title: "You have CPD banked",
      detail:
        "Qualifications let you personally treat what would otherwise need a consultant on the payroll.",
      destination: "career",
      actionLabel: "Open Career",
    };
  }

  if (week >= 18 && cities.length === 1 && state.r.cash > 60_000) {
    return {
      id: "expand",
      title: "One city will eventually cap you",
      detail:
        "A market can only hold as many patients as live in it. Expanding is how the late game exists.",
      destination: "cities",
      actionLabel: "Open Cities",
    };
  }

  return null;
}
