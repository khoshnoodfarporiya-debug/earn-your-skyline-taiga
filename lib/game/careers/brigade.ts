import {
  KIT_BY_ID,
  ROLE_BY_ID,
  activeMenu,
  brigadeCovers,
  premisesOf,
  effectiveOf,
  moraleOf,
  skillOf,
  type KitchenState,
  type KitchenStaff,
  type ServiceType,
} from "./kitchen";
import { RECIPE_BY_ID } from "./recipes";
import {
  STATIONS,
  routeFor,
  shapeOf,
  type ServicePolicy,
  type Station,
  type StationLoad,
} from "./service";

/**
 * THE BRIGADE
 *
 * Who is standing at which station, how tired they are, what they are good at,
 * and what the kitchen can therefore actually put out.
 *
 * Phase 1 had a brigade of numbers: a role produced covers, so two commis were
 * one commis twice and losing somebody cost arithmetic. This is the layer that
 * makes a *position* mean something — a pastry chef is worthless on the hot
 * line and is the only thing that stops puddings jamming the pass, and a
 * kitchen porter cooks nothing at all right up until there are no clean plates.
 *
 * Everything here is additive and optional on the save. A cook hired before
 * any of it existed reads as an untrained, unfatigued, untraited person of
 * average steadiness, which is exactly what they were.
 */

/* ------------------------------------------------------------- the traits */

/**
 * A handful, each with a stated modifier.
 *
 * The rule they were written to: a trait must be something the player can read
 * on the card and then *recognise in the report*. Nothing here is a hidden
 * die-roll penalty — a wasteful cook costs you a stated share of the
 * ingredients they touch, and the waste line says so.
 */
export interface Trait {
  id: string;
  label: string;
  /** What it does, in the player's words. Shown on the person's card. */
  effect: string;
  good: boolean;
}

export const TRAITS: Trait[] = [
  {
    id: "calm",
    label: "Calm under pressure",
    effect: "Half as many mistakes when the kitchen is behind.",
    good: true,
  },
  {
    id: "fast_learner",
    label: "Fast learner",
    effect: "Earns 50% more experience from every service worked.",
    good: true,
  },
  {
    id: "perfectionist",
    label: "Perfectionist",
    effect: "+6 on the plate, and moves one fewer ticket an hour.",
    good: true,
  },
  {
    id: "creative",
    label: "Creative",
    effect: "+8 on the plate for anything with real originality in it.",
    good: true,
  },
  {
    id: "reliable",
    label: "Reliable",
    effect: "Tires a third more slowly, and loyalty holds when others fray.",
    good: true,
  },
  {
    id: "team_player",
    label: "Team player",
    effect: "Adds a ticket an hour to whichever station is worst hit.",
    good: true,
  },
  {
    id: "wasteful",
    label: "Wasteful",
    effect: "Uses about 12% more of every ingredient they touch.",
    good: false,
  },
  {
    id: "temperamental",
    label: "Temperamental",
    effect: "Mistakes come in runs, and morale falls twice as fast under strain.",
    good: false,
  },
];

export const TRAIT_BY_ID = new Map(TRAITS.map((t) => [t.id, t]));

export const traitsOf = (x: KitchenStaff): Trait[] =>
  (x.traits ?? [])
    .map((id) => TRAIT_BY_ID.get(id))
    .filter((t): t is Trait => !!t);

export const hasTrait = (x: KitchenStaff, id: string): boolean =>
  (x.traits ?? []).includes(id);

/* ------------------------------------------------------------ the person */

export const fatigueOf = (x: KitchenStaff): number => x.fatigue ?? 0;
export const experienceOf = (x: KitchenStaff): number => x.experience ?? 0;
export const trainingOf = (x: KitchenStaff): number => x.training ?? 0;

/** Taking the week off, and therefore not on tonight. */
export const isResting = (x: KitchenStaff, week: number): boolean =>
  (x.restingUntil ?? 0) > week;

/**
 * How much of this person turns up tonight.
 *
 * Phase 1's `effectiveOf` was skill against morale. Fatigue is the third term
 * and the one the player creates themselves: a brilliant cook on their tenth
 * double is worth less than a steady one who slept. Bounded at a third rather
 * than zero — even an exhausted cook is still a pair of hands.
 */
export const readyOf = (x: KitchenStaff): number =>
  effectiveOf(x) * Math.max(0.34, 1 - fatigueOf(x) / 145);

/** Everyone actually working tonight. */
export function onTonight(k: KitchenState, week: number): KitchenStaff[] {
  return k.staff.filter((x) => !isResting(x, week));
}

/**
 * What one person contributes at each station tonight.
 *
 * The role says which stations they can work; how much of it lands is the
 * person — skill, morale, fatigue and their traits.
 */
export function stationsOf(
  x: KitchenStaff,
): Partial<Record<Station, number>> {
  const role = ROLE_BY_ID.get(x.role);
  if (!role) return {};
  if (role.stations) return role.stations;
  /*
   * A role from before the pipeline existed. Read its covers as general
   * kitchen work rather than dropping the person: an old save's brigade keeps
   * working, at the stations that role always implied.
   */
  const rate = Math.max(1, Math.round(role.covers / 30));
  return { prep: rate, hot: rate, pass: 1 };
}

/* ---------------------------------------------------------- the stations */

/**
 * What every station can move per tick tonight.
 *
 * Four inputs, and a player can act on all four: who is on, what is
 * installed, how complicated the menu is, and how the player told the kitchen
 * to run. The cause string is the point of the whole function — a bottleneck
 * that says "the pass is drowning and nobody is plating" can be fixed, and one
 * that says "efficiency low" cannot.
 */
export function stationLoads(
  k: KitchenState,
  sv: ServiceType,
  policy: ServicePolicy,
  own: number,
  week: number,
): StationLoad[] {
  const crew = onTonight(k, week);
  const shape = shapeOf(sv);

  /* The player is the executive chef and stands wherever they are needed —
     mostly the pass, which is the job. */
  const ownReady = 0.45 + (own / 100) * 0.9;
  const base: Record<Station, number> = {
    prep: ownReady * 1.2,
    hot: ownReady * 1.6,
    pastry: ownReady * 0.5,
    pass: ownReady * 2.2,
    /* Somebody always washes up, even if it is you at midnight. */
    wash: 1.2,
    /* And somebody carries the plates, even in a market stall. */
    front: 1.4,
  };

  const who: Record<Station, string[]> = {
    prep: [],
    hot: [],
    pastry: [],
    pass: [],
    wash: [],
    front: [],
  };

  for (const person of crew) {
    const ready = readyOf(person);
    for (const [station, rate] of Object.entries(stationsOf(person))) {
      const st = station as Station;
      let add = (rate ?? 0) * ready;
      /* Perfectionists are slower and better; team players find the gap. */
      if (hasTrait(person, "perfectionist")) add *= 0.82;
      base[st] += add;
      who[st].push(person.name);
    }
  }

  /* Equipment. The pastry section and the dishwasher are the two pieces of
     kit that exist to unblock a station rather than to add covers. */
  const installed = k.equipment ?? [];
  if (installed.includes("pastry")) base.pastry += 2.5;
  if (installed.includes("dishwasher")) base.wash += 4;
  if (installed.includes("prep")) base.prep += 2;
  if (installed.includes("range")) base.hot += 2;
  if (installed.includes("deck")) base.hot += 1.2;

  /* The menu's own complexity: a long, slow menu asks more of every station
     than a short one, because every ticket is more work. */
  const menu = activeMenu(k)
    .map((e) => RECIPE_BY_ID.get(e.recipe))
    .filter((r): r is NonNullable<typeof r> => !!r);
  const avgPrep =
    menu.length > 0
      ? menu.reduce((n, r) => n + r.prepTime, 0) / menu.length
      : 8;
  const complexity = Math.max(0.55, Math.min(1.4, 8 / Math.max(4, avgPrep)));

  /* Policies. Simplified plating is a real throughput gain at the pass, and
     pushing the brigade lifts everything for one night. */
  const plating = policy.simplePlating ? 1.35 : 1;
  const pushed = policy.pushBrigade ? 1.18 : 1;

  /* A service where nobody is sitting in the room needs no front of house,
     and one that is nine plates a head needs a great deal of pass. */
  const shapeBias: Partial<Record<Station, number>> = {
    front: shape.arrival === "batch" ? 0.4 : 1,
    pass: shape.expects === "presentation" ? 0.75 : 1,
  };

  /*
   * THE SCALE, AND WHY IT IS BORROWED.
   *
   * The numbers above are *shares* — who can work where, and how much of them
   * turns up. What they are shares **of** is `brigadeCovers`, the figure this
   * career has always used for how many covers a kitchen can plate, because
   * the entire economy is balanced against it.
   *
   * So the pipeline does not invent a second throughput model. It takes the
   * capacity the kitchen already had and asks a different and better question:
   * *where* does it sit. A brigade with no pastry chef has exactly the same
   * total capacity and a pastry queue that ruins the night, which is the whole
   * point of positions.
   *
   * The first pass hand-tuned per-tick numbers instead, and a full brigade
   * served 41 of 405 tickets — the model was consistent and on the wrong
   * scale entirely.
   */
  const nightCovers = brigadeCovers(k, own) / Math.max(0.5, sv.crewLoad);
  /* Three stations on a ticket's route, spread across the night's ticks. */
  const moves = (nightCovers * 3) / Math.max(1, shape.length);
  const shareTotal = STATIONS.reduce((n, s) => n + base[s.id], 0) || 1;

  return STATIONS.map(({ id }) => {
    const raw =
      (base[id] / shareTotal) *
      moves *
      complexity *
      pushed *
      (id === "pass" ? plating : 1) *
      (shapeBias[id] ?? 1) *
      /* Three of the six are on a ticket's route at any time; the other three
         support it. Scaled so the route stations carry the real load. */
      (id === "prep" || id === "hot" || id === "pass" || id === "pastry" ? 2.1 : 1);
    const capacity = Math.max(1, Math.round(raw));
    const names = who[id];
    return {
      station: id,
      capacity,
      queue: 0,
      /*
       * Who is on it, in as few words as the sentence needs.
       *
       * The first version wrote "Nobody is on X but you" for every station,
       * which on an unstaffed kitchen is the same sentence six times down the
       * screen. A solo cook already knows they are alone; what they need from
       * this line is which section that is costing them, and the warnings
       * below say so once.
       */
      cause:
        names.length === 0
          ? "Just you on this section."
          : `${names.slice(0, 2).join(" and ")}${names.length > 2 ? ` and ${names.length - 2} more` : ""}.`,
    };
  });
}

/**
 * What to do about a station that is holding the night up.
 *
 * Named as a purchase or a hire the player can actually make, because a
 * bottleneck the player cannot act on is just a complaint.
 */
export function bottleneckFix(station: Station, k: KitchenState): string {
  const installed = k.equipment ?? [];
  const has = (role: string) => k.staff.some((x) => x.role === role);
  switch (station) {
    case "prep":
      return has("commis")
        ? "Another commis, or a prep station to work on."
        : "A commis chef does nothing but this. That is the fix.";
    case "hot":
      return has("partie")
        ? installed.includes("range")
          ? "Another chef de partie — the stoves are full and so are the hands."
          : "A six-burner range: more pans on at once."
        : "A chef de partie runs a section without being told twice.";
    case "pastry":
      return has("pastry")
        ? "A pastry section of their own would stop this jamming the pass."
        : "A pastry chef. Puddings are blocking the mains.";
    case "pass":
      return has("sous")
        ? "Simplify the plating, or take a dish off the menu."
        : "A sous chef runs the pass. Nobody is running yours.";
    case "wash":
      return installed.includes("dishwasher")
        ? "A kitchen porter — the machine is not the queue, the stacking is."
        : "A pass-through dishwasher, or a porter. You are plating onto nothing.";
    case "front":
      return has("front")
        ? "Another server, or a manager to run the room."
        : "Front of house. Food is going cold under the lamp.";
  }
}

/* --------------------------------------------------- fatigue and learning */

/** Skill a person has earned from services worked, on top of what they arrived with. */
export const earnedSkill = (x: KitchenStaff): number =>
  Math.min(18, Math.floor(experienceOf(x) / 45));

/** What they are actually worth now: hired skill plus what the job taught them. */
export const currentSkill = (x: KitchenStaff): number =>
  Math.min(99, skillOf(x) + earnedSkill(x));

/** Rest taken between services. A week off clears most of a month of nights. */
export const recover = (x: KitchenStaff, resting: boolean): number =>
  Math.max(
    0,
    fatigueOf(x) - (resting ? 42 : 9) * (hasTrait(x, "reliable") ? 1.2 : 1),
  );

/** Somebody who is going to make mistakes, or leave, if the week does not ease. */
export const isBurntOut = (x: KitchenStaff): boolean => fatigueOf(x) >= 70;

/**
 * Whether this person can step up, and what it would cost.
 *
 * Promotion is earned by services worked rather than bought: a commis who has
 * cooked two hundred covers is a chef de partie, and paying them like one is
 * the only decision left. Refusing costs loyalty, which is the trade.
 */
export function promotionFor(
  x: KitchenStaff,
): { to: string; label: string; salary: number } | null {
  const next = [...ROLE_BY_ID.values()].find((r) => r.promotesFrom === x.role);
  if (!next) return null;
  if (experienceOf(x) < 120) return null;
  if (currentSkill(x) < 45) return null;
  return { to: next.id, label: next.label, salary: next.salary };
}

/** What a week of deliberate training costs, and what it buys. */
export const TRAINING_COST = 450;
export const TRAINING_GAIN = 34;

/**
 * Understaffing, stated as the station that will fail rather than as a number.
 *
 * Measured against what the room can actually send: a full house for this
 * service, across the night, needs a certain number of tickets moved every
 * tick, and any station on the route that cannot keep up is where the night
 * breaks. That is why the threshold is not a constant — a section that is
 * plenty for a market stall is nowhere near enough for a flagship, and a
 * fixed number would be wrong for one of them whatever it was set to.
 *
 * Returns nothing when the kitchen is fine, which should read as silence
 * rather than as a green tick.
 */
export function staffingWarnings(
  k: KitchenState,
  sv: ServiceType,
  policy: ServicePolicy,
  own: number,
  week: number,
): { station: Station; why: string; fix: string }[] {
  const loads = stationLoads(k, sv, policy, own, week);
  const shape = shapeOf(sv);
  const menu = activeMenu(k);
  const room = premisesOf(k);

  /* What a full room would put through each station, per tick. */
  const covers = room.capacity * sv.capacityShare;
  const needed = (covers * shape.courses) / Math.max(1, shape.length);

  const hasDessert = menu.some(
    (e) => RECIPE_BY_ID.get(e.recipe)?.category === "dessert",
  );

  const out: { station: Station; why: string; fix: string }[] = [];
  for (const load of loads) {
    /* Wash and front are support: they only bite when there is a room to
       serve, and catering has none. */
    if (load.station === "front" && shape.arrival === "batch") continue;
    if (load.station === "pastry" && !hasDessert) continue;
    /* Support sections carry less than the route does. */
    const onRoute =
      load.station === "prep" ||
      load.station === "hot" ||
      load.station === "pass" ||
      (load.station === "pastry" && hasDessert);
    const bar = onRoute ? needed : needed * 0.45;
    if (load.capacity >= bar) continue;
    out.push({
      station: load.station,
      why: `${load.capacity} tickets a quarter-hour against the ${Math.ceil(bar)} a full room would send. ${load.cause}`,
      fix: bottleneckFix(load.station, k),
    });
  }
  /* The worst one first: a player fixes the section that fails soonest. */
  return out.sort((a, b) => a.why.localeCompare(b.why)).slice(0, 3);
}

/** Everyone who is being worked too hard, for the warning on the screen. */
export const overworked = (k: KitchenState): KitchenStaff[] =>
  k.staff.filter((x) => isBurntOut(x));

/**
 * Which stations a dish passes through, for the menu screen's own warning.
 *
 * Exported here rather than in `service.ts` so a component never has to reach
 * into the pipeline to answer a question about the menu.
 */
export function stationsForMenu(k: KitchenState): Set<Station> {
  const out = new Set<Station>(["prep", "pass", "front", "wash"]);
  for (const entry of activeMenu(k)) {
    const recipe = RECIPE_BY_ID.get(entry.recipe);
    if (!recipe) continue;
    for (const st of routeFor(recipe)) out.add(st);
  }
  return out;
}

/** Equipment that would unblock a station, for the fix line. */
export const kitFor = (station: Station): string | null =>
  station === "wash"
    ? (KIT_BY_ID.get("dishwasher")?.label ?? null)
    : station === "pastry"
      ? (KIT_BY_ID.get("pastry")?.label ?? null)
      : station === "prep"
        ? (KIT_BY_ID.get("prep")?.label ?? null)
        : station === "hot"
          ? (KIT_BY_ID.get("range")?.label ?? null)
          : null;

/**
 * The morale a night leaves behind.
 *
 * Fatigue is what the service did to a body; this is what it did to how
 * somebody feels about working here. A night that went well lifts it, a night
 * of mistakes and walkouts does not, and a temperamental person feels both
 * twice as hard.
 */
export function moraleAfter(
  x: KitchenStaff,
  satisfaction: number,
  mistakes: number,
): number {
  const swing = (satisfaction - 55) / 12 - mistakes * 0.35;
  const felt = hasTrait(x, "temperamental") ? swing * 2 : swing;
  return Math.max(0, Math.min(100, moraleOf(x) + felt));
}

/**
 * How often a ticket goes wrong tonight, before the night's own pressure.
 *
 * Three things pull on it and the player controls all three: how skilled the
 * people on tonight are, how tired they are, and whether a sous chef is
 * running the pass — which is what a sous chef is *for*. Calm cooks halve
 * their own share of it, which is the trait doing exactly what its card says.
 */
export function errorRateOf(
  k: KitchenState,
  own: number,
  week: number,
): number {
  const crew = onTonight(k, week);
  if (crew.length === 0) {
    /* One person cooking alone makes the mistakes of one person cooking
       alone: fewer tickets, but nobody to catch anything. */
    return Math.max(0.04, 0.2 - own / 700);
  }
  const steadiness =
    crew.reduce((n, x) => {
      const base = currentSkill(x) / 100 - fatigueOf(x) / 260;
      return n + (hasTrait(x, "calm") ? base + 0.25 : base);
    }, 0) / crew.length;
  /* Coordination: somebody senior calling the pass stops half the errors a
     kitchen makes, which is the whole argument for the hire. */
  const coordinated = crew.some((x) => x.role === "sous" || x.role === "manager");
  const raw = 0.17 - steadiness * 0.1;
  return Math.max(0.015, raw * (coordinated ? 0.55 : 1));
}
