import type { Rng } from "../types";
import type { MedicalState, StaffMember, StaffTrait } from "./types";
import { ROLE_BY_ID } from "./data";

/**
 * STAFF, AND THE PLACE THEY WORK
 *
 * A staff member was a salary and a skill number. You could not treat one
 * differently from another, and none of them had any opinion about you.
 *
 * ------------------------------------------------------------- the fields
 *
 * All of the new ones are OPTIONAL on the type and defaulted by `hydrate`.
 * That is not laziness — it is what makes a v9 save load: an old roster has
 * six fields per person, and the migration fills the rest rather than
 * rejecting a run because its nurses predate morale.
 *
 *   morale       how they feel about this week      (moves fast)
 *   loyalty      whether they would leave for 10%   (moves slowly)
 *   ambition     how much they want more            (fixed per person)
 *   expects      the salary they think they deserve (rises with skill)
 *   workload     0..100, derived from cases vs capacity
 *   training     progress toward the next skill point
 *   record       last few weeks of performance
 *
 * -------------------------------------------------------- culture is derived
 *
 * The brief for this was explicit and correct: culture must not be a thing you
 * buy. So `cultureScore` is a pure function of conditions the player creates —
 * pay against expectation, workload, morale spread, how long people have been
 * here, and whether anyone has been dismissed recently. There is no
 * `m.culture` field to set, and no upgrade that raises it.
 */

/** Fixed dispositions. Authored, small, and readable. */
export const STAFF_TRAITS: readonly StaffTrait[] = [
  "meticulous",
  "fast",
  "mentor",
  "abrasive",
  "steady",
  "restless",
];

export const TRAIT_BLURB: Record<StaffTrait, string> = {
  meticulous: "Slower, and almost never wrong.",
  fast: "Gets through a list. Occasionally gets through it too quickly.",
  mentor: "Everyone around them gets better.",
  abrasive: "Excellent clinician. Difficult colleague.",
  steady: "Same person on a bad week as on a good one.",
  restless: "Will not be here in two years unless something changes.",
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));

/**
 * Fill in anything an older save is missing.
 *
 * Called on every read path rather than once at load, because a save can
 * arrive from migration, from a fixture, or from a hand-edited import, and a
 * single missing field should never be able to produce `NaN` three systems
 * downstream. Traits are derived from the id so they are stable for a given
 * person without being stored twice.
 */
export function hydrateStaff(x: StaffMember): Required<StaffMember> {
  const seed = hashId(x.id);
  return {
    ...x,
    morale: x.morale ?? 60,
    loyalty: x.loyalty ?? 55,
    ambition: x.ambition ?? 30 + (seed % 50),
    expects: x.expects ?? Math.round(x.salary * 1.05),
    workload: x.workload ?? 50,
    training: x.training ?? 0,
    traits: x.traits?.length
      ? x.traits
      : [STAFF_TRAITS[seed % STAFF_TRAITS.length]],
    record: x.record ?? [],
    joinedWeek: x.joinedWeek ?? 0,
    warnings: x.warnings ?? 0,
    lead: x.lead ?? false,
  };
}

function hashId(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export const hasTrait = (x: StaffMember, t: StaffTrait): boolean =>
  (x.traits ?? []).includes(t);

/* ----------------------------------------------------------- the culture */

export interface Culture {
  /** 0..100. */
  score: number;
  word: string;
  /** The two or three things actually driving it, best and worst first. */
  drivers: { label: string; effect: number; detail: string }[];
}

/**
 * What it is like to work here, computed from what is true.
 *
 * Each component is signed and named, so the panel can show the player *why*
 * their culture is 38 rather than presenting a number with no handle on it.
 * That is the same principle as the reputation change log: a derived value the
 * player cannot explain is a value they cannot act on.
 */
export function cultureScore(m: MedicalState, week: number): Culture {
  const staff = m.staff.map(hydrateStaff);
  if (staff.length === 0) {
    return {
      score: 50,
      word: "No team yet",
      drivers: [
        {
          label: "Nobody employed",
          effect: 0,
          detail: "Culture starts existing when someone else does.",
        },
      ],
    };
  }

  const drivers: { label: string; effect: number; detail: string }[] = [];
  let score = 50;

  // --- pay against expectation ------------------------------------------
  const underpaid = staff.filter((x) => x.salary < x.expects * 0.92).length;
  const payShare = underpaid / staff.length;
  const payEffect = Math.round(-payShare * 28 + (1 - payShare) * 8);
  score += payEffect;
  drivers.push({
    label: underpaid > 0 ? "Pay is behind" : "Pay is fair",
    effect: payEffect,
    detail:
      underpaid > 0
        ? `${underpaid} of ${staff.length} are paid below what they expect.`
        : "Nobody here is being underpaid relative to what they think they are worth.",
  });

  // --- workload ----------------------------------------------------------
  const load = staff.reduce((n, x) => n + x.workload, 0) / staff.length;
  const loadEffect = Math.round(load > 70 ? -(load - 70) * 0.55 : (70 - load) * 0.18);
  score += loadEffect;
  drivers.push({
    label: load > 70 ? "The rota is punishing" : "Workload is manageable",
    effect: loadEffect,
    detail: `Average load ${Math.round(load)} of 100.`,
  });

  // --- morale ------------------------------------------------------------
  const morale = staff.reduce((n, x) => n + x.morale, 0) / staff.length;
  const moraleEffect = Math.round((morale - 55) * 0.35);
  score += moraleEffect;
  drivers.push({
    label: morale >= 60 ? "People are in good spirits" : "Morale is low",
    effect: moraleEffect,
    detail: `Average morale ${Math.round(morale)}.`,
  });

  // --- stability ---------------------------------------------------------
  const tenure =
    staff.reduce((n, x) => n + Math.max(0, week - x.joinedWeek), 0) /
    staff.length;
  const tenureEffect = Math.round(Math.min(10, tenure * 0.14));
  score += tenureEffect;
  if (tenureEffect >= 3) {
    drivers.push({
      label: "People stay",
      effect: tenureEffect,
      detail: `Average ${Math.round(tenure)} weeks on the team.`,
    });
  }

  // --- how you handle problems -------------------------------------------
  const warned = staff.reduce((n, x) => n + x.warnings, 0);
  if (warned > 0) {
    const effect = -Math.min(12, warned * 3);
    score += effect;
    drivers.push({
      label: "Discipline is visible",
      effect,
      detail: `${warned} formal warning${warned === 1 ? "" : "s"} on the books.`,
    });
  }

  // --- who is in the room -------------------------------------------------
  const abrasive = staff.filter((x) => hasTrait(x, "abrasive")).length;
  const mentors = staff.filter((x) => hasTrait(x, "mentor")).length;
  if (abrasive > 0 || mentors > 0) {
    const effect = mentors * 4 - abrasive * 5;
    score += effect;
    drivers.push({
      label: mentors >= abrasive ? "People teach each other" : "There is friction",
      effect,
      detail: `${mentors} mentor${mentors === 1 ? "" : "s"}, ${abrasive} difficult colleague${abrasive === 1 ? "" : "s"}.`,
    });
  }

  score = clamp(score, 0, 100);
  return {
    score,
    word:
      score >= 78
        ? "Somewhere people want to work"
        : score >= 60
          ? "A decent place to work"
          : score >= 42
            ? "Functional"
            : score >= 25
              ? "Strained"
              : "People are looking",
    // Loudest first, so the summary is the thing to fix.
    drivers: drivers.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)),
  };
}

/* ------------------------------------------------------ what culture does */

/**
 * The couplings, gathered so they are visible in one place rather than as
 * magic numbers scattered through the weekly resolve.
 */

/** Output multiplier on everything the team does. 0.86 … 1.14. */
export const productivityFactor = (culture: number): number =>
  0.86 + (culture / 100) * 0.28;

/** Extra chance a case goes wrong. Zero above 55, climbing sharply below 30. */
export const errorRate = (culture: number): number =>
  culture >= 55 ? 0 : Math.min(0.09, (55 - culture) * 0.0018);

/** Weekly chance any given person starts looking elsewhere. */
export const churnRate = (culture: number, loyalty: number): number => {
  const base = culture >= 60 ? 0 : (60 - culture) * 0.0011;
  const held = loyalty >= 60 ? 0.4 : loyalty <= 25 ? 1.6 : 1;
  return Math.min(0.1, base * held);
};

/** Bonus on the skill of who applies. A good place attracts good people. */
export const recruitAppeal = (culture: number): number =>
  Math.round((culture - 50) * 0.18);

/* --------------------------------------------------------- weekly update */

/**
 * One week for the team.
 *
 * Deliberately not a per-person random walk: morale moves for *reasons* —
 * how loaded they were, whether they are paid what they expect, who they work
 * beside — because a player who cannot name the reason cannot manage it.
 */
export function tickStaff(
  m: MedicalState,
  ctx: { week: number; load: number; culture: number; cashShort: boolean },
  rng: Rng,
): { left: StaffMember[]; notes: string[] } {
  const notes: string[] = [];
  const left: StaffMember[] = [];

  for (const raw of m.staff) {
    const x = hydrateStaff(raw);

    // Workload follows the practice's actual pressure, damped so one heavy
    // week does not read as a crisis.
    x.workload = clamp(x.workload + (ctx.load - x.workload) * 0.35, 0, 100);

    let morale = x.morale;
    morale += x.workload > 75 ? -2.2 : x.workload < 45 ? 1.1 : 0.2;
    if (x.salary < x.expects * 0.92) morale -= 1.4;
    if (ctx.cashShort) morale -= 2.5;
    if (hasTrait(x, "steady")) morale += 0.4;
    morale += (ctx.culture - 50) * 0.03;
    x.morale = clamp(morale, 0, 100);

    // Loyalty is the slow integral of morale, which is why it cannot be
    // repaired in a week and why a good year matters.
    x.loyalty = clamp(x.loyalty + (x.morale - 50) * 0.035, 0, 100);

    // Expectations creep. Someone who has grown will ask to be paid for it.
    x.expects = Math.max(
      x.expects,
      Math.round(x.salary * (1 + x.ambition / 2200) + x.skill * 3),
    );

    // Training pays out as skill, capped so it is a slope and not a ladder.
    if (x.training > 0) {
      x.training = Math.max(0, x.training - 1);
      if (x.training === 0 && x.skill < 97) {
        x.skill = Math.min(97, x.skill + 4);
        notes.push(`${x.name} finished a course and came back sharper.`);
      }
    }

    // A mentor lifts everyone slowly, which is the whole reason to keep one.
    if (m.staff.some((o) => o.id !== x.id && hasTrait(hydrateStaff(o), "mentor"))) {
      if (x.skill < 92 && rng.chance(0.04)) x.skill += 1;
    }

    x.record = [
      ...(x.record ?? []),
      Math.round(x.morale * 0.5 + (100 - x.workload) * 0.2 + x.skill * 0.3),
    ].slice(-6);

    Object.assign(raw, x);

    // Leaving.
    if (rng.chance(churnRate(ctx.culture, x.loyalty))) {
      left.push(raw);
      notes.push(`${x.name} resigned.`);
    }
  }

  if (left.length > 0) {
    const gone = new Set(left.map((x) => x.id));
    m.staff = m.staff.filter((x) => !gone.has(x.id));
  }
  return { left, notes };
}

/** Average load across the team, for the culture panel. */
export const averageLoad = (m: MedicalState): number =>
  m.staff.length === 0
    ? 0
    : m.staff.reduce((n, x) => n + hydrateStaff(x).workload, 0) / m.staff.length;

/** What it would cost to bring everyone up to what they expect. */
export const payGap = (m: MedicalState): number =>
  m.staff.reduce((n, raw) => {
    const x = hydrateStaff(raw);
    return n + Math.max(0, x.expects - x.salary);
  }, 0);

/** Salary a role commands here, given the market. */
export const salaryFor = (roleId: string, marketSalary: number): number =>
  Math.round((ROLE_BY_ID.get(roleId as never)?.salary ?? 1000) * marketSalary);
