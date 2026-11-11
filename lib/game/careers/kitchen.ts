import type { Rng } from "../types";
/* Type-only, and the dependency runs one way at runtime: `service.ts` is the
   pipeline that reads this model, and this file only names its stations. */
import type { ServicePolicy, ServiceReport, Station } from "./service";
import {
  INGREDIENT_BY_ID,
  RECIPE_BY_ID,
  seasonalPrice,
  STARTER_RECIPES,
  dishBlocker,
  recipeName,
  type Ingredient,
  type IngredientLot,
  type MenuEntry,
  type Recipe,
  type RecipeProgress,
  type Storage,
} from "./recipes";
/* A career-neutral shape that lives in medical/types for historical
   reasons — nothing in it is medical. See the note in chefPhone.ts. */
import type { PhoneState } from "../medical/types";
/* Phase 3's shapes. Types only, so `kitchen.ts` can describe the state
   without depending on the modules that compute it — the same one-way rule
   the service pipeline and the pantry already follow. */
import type {
  StandingChange,
  StandingId,
  StandingSnapshot,
} from "./standing";
import type { Review } from "./reviews";
import type { BuzzState, Complaint } from "./buzz";
import type { Competitor } from "./competitors";
import type { CriticVerdict, CriticWatch } from "./critics";
import type { WineLot } from "./cellar";
import type { GuideRecord } from "./guide";
import type { VentureState } from "./ventures";

/**
 * THE KITCHEN
 *
 * The Physician's binding constraint is capability: cases arrive and you can
 * only treat what you have a department for. The Chef's is **spoilage**, and
 * the whole model exists to make that a real decision rather than a flavour
 * note on a card.
 *
 * ------------------------------------------------------------ why it bites
 *
 * Produce is bought in lots, each with a shelf life. Every week a lot ages.
 * Past its life it is written off — you paid for it, you never sold it, and it
 * leaves as an expense line with your money in it. So:
 *
 *   order too little  you turn covers away, and a table you could not seat is
 *                     a review you do not get
 *   order too much    you eat the write-off, every week, forever
 *
 * That alone would only be an inventory puzzle. What makes it a *cooking* game
 * is that stock is consumed oldest-first and **freshness feeds quality**: a
 * kitchen running down a fortnight-old crate serves worse food than the same
 * kitchen running a fresh one, and the reviews say so. Over-ordering therefore
 * does not just cost money later, it costs reputation now.
 *
 * And the better produce spoils faster. A luxury crate is the best food you
 * can serve and it is worthless in a week, so the top of the menu is only
 * available to a restaurant with the covers to turn it over. That is the
 * career's whole arc in one number.
 *
 * ------------------------------------------------------------ what is here
 *
 * The catalogues and the week's service maths. The `CareerDef` that drives it
 * lives in `chef.ts`, exactly as the medical career splits its content from
 * `doctor.ts`.
 */

/**
 * A room to cook in.
 *
 * Two things were wrong on the first pass and the simulation found both.
 *
 * `spend` has to clear the food cost of the crate the room can realistically
 * turn over. A standard crate is $900 for 95 covers — roughly $9.50 of food on
 * every plate — and a stall selling at $14 lost money on gross margin before
 * it paid a penny of rent. Eight runs out of eight went insolvent.
 *
 * Fixing the margin alone still left it unwinnable, because the *scale* was
 * wrong too: a stall clearing $250 a week cannot reach an $88,000 bistro
 * inside a career. Capacity is up and the ladder is cheaper, so the climb is
 * a hard decision rather than an arithmetic impossibility. Food cost now runs
 * about 36% at the bottom and 27% at the top, which is roughly the trade.
 */
export interface Premises {
  id: string;
  label: string;
  blurb: string;
  cost: number;
  /** Weekly rent, charged whether or not you open. */
  rent: number;
  /** Covers one service can physically seat and turn. */
  capacity: number;
  /** What people expect to pay here, per head. */
  spend: number;
}

export const PREMISES: Premises[] = [
  {
    id: "stall",
    label: "Market stall",
    blurb:
      "A pitch, a griddle and a queue. No seats, no bookings, and nobody expecting very much.",
    cost: 0,
    rent: 300,
    capacity: 130,
    spend: 26,
  },
  {
    id: "bistro",
    label: "Small bistro",
    blurb:
      "Twenty-eight covers, one service a night, and the first room that is actually yours.",
    cost: 30_000,
    rent: 1_450,
    capacity: 270,
    spend: 44,
  },
  {
    id: "restaurant",
    label: "Restaurant",
    blurb:
      "A proper dining room and a proper brigade. People book a fortnight ahead or they do not eat.",
    cost: 140_000,
    rent: 3_700,
    capacity: 490,
    spend: 78,
  },
  {
    id: "flagship",
    label: "Flagship dining room",
    blurb:
      "The room your name goes above. Critics come on purpose, and they come back to check.",
    cost: 520_000,
    rent: 8_600,
    capacity: 830,
    spend: 145,
  },
  {
    /*
     * The top of the ladder, and deliberately not "a bigger flagship".
     *
     * It seats *fewer* people than the flagship and charges nearly twice as
     * much a head, because that is what the room at the top of this trade
     * actually is: a small number of covers, every one of them expecting the
     * best night of their year. The rent is the punishment for a quiet week.
     */
    id: "destination",
    label: "The destination",
    blurb:
      "Forty covers a night, booked six months out, and people who got on a plane for it. Fewer seats than the flagship and four times the pressure.",
    cost: 1_450_000,
    rent: 19_500,
    capacity: 560,
    spend: 265,
  },
];

export const PREMISES_BY_ID = new Map(PREMISES.map((p) => [p.id, p]));

/**
 * WHERE THE KITCHEN IS
 *
 * A city is not a difficulty slider. It moves five numbers at once, and they
 * pull against each other hard enough that the best city depends on how you
 * intend to cook:
 *
 *   `rent`     what the room costs, open or shut
 *   `spend`    what a cover is worth here
 *   `demand`   how many people are looking for a table at all
 *   `produce`  what the same crate costs from the same kind of supplier
 *   `shelfLife` weeks added to — or taken off — everything in the larder
 *
 * The last one is the reason this is worth having in *this* career rather
 * than being an economy multiplier with a place name on it. Milan has its
 * produce grown an hour away and gains a week; New York and Mumbai lose one,
 * because everything arrives on a lorry or in the heat. A city therefore does
 * not make the Chef's problem easier or harder so much as it changes what the
 * problem *is*: Mumbai is cheap, busy, and will not let you hold stock; Paris
 * pays half as much again a head and charges you for the privilege of being
 * wrong.
 *
 * ------------------------------------------------------------ why Lyon is 1
 *
 * Lyon is neutral on all five axes, and that is deliberate rather than dull.
 * It is the city every run before this feature started in, so a save written
 * then reads as Lyon and plays exactly as it did — a default that quietly
 * added a week of shelf life would have re-balanced every existing run and
 * every figure measured against them.
 *
 * Chosen once, at week one, and never moved. You cannot pick a restaurant up.
 */
export interface KitchenCity {
  id: string;
  name: string;
  country: string;
  /** Key into the projected map positions. */
  position: string;
  blurb: string;
  rent: number;
  spend: number;
  demand: number;
  produce: number;
  /** Weeks added to everything in the larder. Negative means it dies faster. */
  shelfLife: number;
  difficulty: "gentle" | "even" | "hard";
}

export const KITCHEN_CITIES: KitchenCity[] = [
  {
    id: "lyon",
    name: "Lyon",
    country: "France",
    position: "lyon",
    blurb:
      "Bouchons, a covered market at the end of the street, and suppliers who have been feeding this city for two hundred years. Nothing here is against you.",
    rent: 1,
    spend: 1,
    demand: 1,
    produce: 1,
    shelfLife: 0,
    difficulty: "gentle",
  },
  {
    id: "milan",
    name: "Milan",
    country: "Italy",
    position: "milan",
    blurb:
      "An hour from the best growers in Europe. Produce arrives the morning it was cut, and it shows for a week longer than it has any right to.",
    rent: 1.15,
    spend: 1.15,
    demand: 1,
    produce: 1,
    shelfLife: 1,
    difficulty: "even",
  },
  {
    id: "madrid",
    name: "Madrid",
    country: "Spain",
    position: "madrid",
    blurb:
      "Cheap rooms, late tables and a city that eats out constantly without paying very much to do it.",
    rent: 0.72,
    spend: 0.8,
    demand: 0.95,
    produce: 0.82,
    shelfLife: 0,
    difficulty: "gentle",
  },
  {
    id: "paris",
    name: "Paris",
    country: "France",
    position: "paris",
    blurb:
      "The room your name goes above, in the city where the name matters most. Everything here costs more, including mistakes.",
    rent: 1.65,
    spend: 1.45,
    demand: 1.25,
    produce: 1.38,
    shelfLife: 0,
    difficulty: "even",
  },
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    position: "london",
    blurb:
      "More people looking for dinner than anywhere in Europe, and a landlord who knows it.",
    rent: 1.85,
    spend: 1.35,
    demand: 1.3,
    produce: 1.32,
    shelfLife: 0,
    difficulty: "even",
  },
  {
    id: "newyork",
    name: "New York",
    country: "United States",
    position: "newyork",
    blurb:
      "The biggest room in the world and the shortest patience. Produce arrives on a lorry and it shows.",
    rent: 2.1,
    spend: 1.55,
    demand: 1.45,
    produce: 1.5,
    shelfLife: -1,
    difficulty: "hard",
  },
  {
    id: "mumbai",
    name: "Mumbai",
    country: "India",
    position: "mumbai",
    blurb:
      "Everything is cheap, everyone is hungry, and nothing keeps. Turn it over tonight or throw it away tomorrow.",
    rent: 0.5,
    spend: 0.45,
    demand: 1.6,
    produce: 0.52,
    shelfLife: -1,
    difficulty: "hard",
  },
];

export const KITCHEN_CITY_BY_ID = new Map(
  KITCHEN_CITIES.map((c) => [c.id, c]),
);

/** The city this kitchen is in. Absent on a save written before the choice. */
export const cityOf = (k: KitchenState): KitchenCity =>
  KITCHEN_CITY_BY_ID.get(k.city ?? "lyon") ?? KITCHEN_CITIES[0];

/**
 * A crate of produce.
 *
 * `covers` is how many plates it can carry, `shelfLife` how many weeks before
 * what is left goes in the bin. The two move in opposite directions on
 * purpose: the produce that makes the best food is the produce you cannot
 * hold. Buying luxury without the covers to turn it is the single most
 * expensive mistake available in this career, and it is available from week
 * one.
 */
export interface Produce {
  id: string;
  label: string;
  blurb: string;
  cost: number;
  covers: number;
  shelfLife: number;
  /** Added to the plate's quality while genuinely fresh. */
  grade: number;
}

export const PRODUCE: Produce[] = [
  {
    id: "basic",
    label: "Standard crate",
    blurb:
      "Root vegetables, cheap cuts, things that keep. Nobody writes about it and nobody sends it back.",
    cost: 900,
    covers: 95,
    shelfLife: 4,
    grade: 0,
  },
  {
    id: "market",
    label: "Market crate",
    blurb:
      "Whatever was good this morning. Better food, and it will not wait for you.",
    cost: 2_500,
    covers: 130,
    shelfLife: 2,
    grade: 9,
  },
  {
    id: "luxury",
    label: "Luxury order",
    blurb:
      "Turbot, ceps, the things a review mentions by name. Worth nothing at all by next week.",
    cost: 6_600,
    covers: 165,
    shelfLife: 1,
    grade: 20,
  },
];

export const PRODUCE_BY_ID = new Map(PRODUCE.map((p) => [p.id, p]));

export interface KitchenRole {
  id: string;
  label: string;
  blurb: string;
  hireCost: number;
  salary: number;
  /** Covers this person can put out per week. */
  covers: number;
  /** Added to the plate. Front of house adds to the room, not the food. */
  craft: number;
  /**
   * Tickets this role moves per tick, at each station of the service
   * pipeline.
   *
   * This is what makes a role a *position* rather than a salary with a name:
   * a pastry chef is worth nothing on the hot line and is the only reason
   * puddings do not block the mains, and a dishwasher contributes no cooking
   * at all until the plates run out — at which point they are the whole
   * kitchen. See `service.ts` for how the queues are worked.
   *
   * Optional, because a save written before the pipeline existed carries
   * roles that predate it; `stationsOf` falls back to a sensible reading of
   * `covers` for those.
   */
  stations?: Partial<Record<Station, number>>;
  /** The rung below this one. Promotion moves a person up the list. */
  promotesFrom?: string;
}

export const KITCHEN_ROLES: KitchenRole[] = [
  {
    id: "commis",
    label: "Commis chef",
    blurb: "Young, quick, and learning on your time. Cheap hands on the pass.",
    hireCost: 900,
    salary: 640,
    covers: 45,
    craft: 1,
    /* Prep is what a commis is for, and they can stand on the pass when the
       pass is drowning. */
    stations: { prep: 3, pass: 1, wash: 1 },
  },
  {
    id: "partie",
    label: "Chef de partie",
    blurb: "Runs a section without being told twice. The backbone of a brigade.",
    hireCost: 2_400,
    salary: 1_280,
    covers: 80,
    craft: 4,
    /* The backbone of the hot line. */
    stations: { hot: 3, prep: 1, pass: 1 },
    promotesFrom: "commis",
  },
  {
    id: "sous",
    label: "Sous chef",
    blurb:
      "Runs the kitchen when you are not in it, which is what lets you leave it.",
    hireCost: 5_200,
    salary: 2_350,
    covers: 115,
    craft: 9,
    /* Runs the pass, which is the job that keeps a night in order — and can
       cover any section when one falls behind. */
    stations: { pass: 3, hot: 2, prep: 1 },
    promotesFrom: "partie",
  },
  {
    id: "front",
    label: "Front of house",
    blurb:
      "Seats people, reads the room, and keeps a bad night from becoming a bad review.",
    hireCost: 700,
    salary: 560,
    covers: 30,
    craft: 3,
    /* Seats, takes the order and carries the plate. Nothing reaches a table
       without them, however fast the kitchen is. */
    stations: { front: 4 },
  },
  {
    id: "pastry",
    label: "Pastry chef",
    blurb:
      "Their own section and their own oven. Puddings stop being the thing that jams the pass at nine o'clock.",
    hireCost: 3_100,
    salary: 1_520,
    covers: 55,
    craft: 6,
    stations: { pastry: 4, prep: 1 },
  },
  {
    id: "dish",
    label: "Kitchen porter",
    blurb:
      "Plates back on the shelf, pans back on the stove. Invisible right up until there is nothing clean to plate on.",
    hireCost: 500,
    salary: 480,
    covers: 20,
    craft: 0,
    stations: { wash: 5, prep: 1 },
  },
  {
    /*
     * The sommelier is the only role in this brigade that earns their salary
     * somewhere other than the kitchen: they are worth nothing at all without
     * a cellar to sell, and worth more than a sous chef with one. See
     * `cellar.ts` for the pour rate they change.
     */
    id: "somm",
    label: "Sommelier",
    blurb:
      "Knows what is in the racks, what it is worth, and how to get a table to order the bottle above the one they were going to.",
    hireCost: 3_600,
    salary: 1_720,
    covers: 12,
    craft: 2,
    stations: { front: 2 },
  },
  {
    id: "manager",
    label: "Restaurant manager",
    blurb:
      "Runs the room: who sits where, who is waiting, and who is about to complain. The kitchen cooks better when the floor is calm.",
    hireCost: 4_200,
    salary: 1_950,
    covers: 25,
    craft: 2,
    stations: { front: 3, pass: 1 },
  },
];

export const ROLE_BY_ID = new Map(KITCHEN_ROLES.map((r) => [r.id, r]));


/**
 * WHAT KIND OF NIGHT YOU RUN
 *
 * The larder answers "how much food"; this answers "for whom". Before it
 * existed the week had exactly one decision in it — how many crates to buy —
 * and a run either climbed the premises ladder or died at the stall with no
 * way to steer in between.
 *
 * ---------------------------------------------------------- the trade-offs
 *
 * None of these is best. Each is best at something:
 *
 *   lunch     volume at a low spend. The way to move stock that is about to
 *             turn, and the cheapest service in burnout.
 *   dinner    the balanced middle, and where reviews are really made.
 *   event     a private booking. Fewer covers, far better money, and the
 *             count is agreed in advance so nothing is guessed or wasted.
 *   catering  off-site and paid on delivery. Reliable cash that builds no
 *             reputation whatsoever — the thing you do when the dining room
 *             is not filling and rent is due on Friday.
 *   tasting   a dozen covers at four times the spend, and the only service
 *             that moves standing quickly. It moves it downward just as fast
 *             when the kitchen cannot hold the standard.
 *
 * ------------------------------------------------------------ booked work
 *
 * `booked` is the important flag. A booked service has its covers agreed
 * beforehand, so reputation does not gate it and nobody is turned away — you
 * either staff and stock it or you do not. That is what makes catering a
 * recovery route rather than another way to lose: it pays when your standing
 * cannot yet fill a room.
 *
 * It is deliberately not free. Booked work carries more burnout per block,
 * demands more of the brigade, and earns little or no review — a season spent
 * on catering keeps the lights on and leaves you no better known than before.
 */
export interface ServiceType {
  id: string;
  label: string;
  blurb: string;
  /** Covers one block can seat, as a share of the room's capacity. */
  capacityShare: number;
  /** Multiplier on the room's spend per head. */
  spend: number;
  /** Covers agreed in advance: demand does not gate it, nothing is turned away. */
  booked: boolean;
  /** Burnout per block. */
  burnout: number;
  /** How strongly the plate moves reviews. Zero for work nobody reviews. */
  reviewWeight: number;
  /** Share of the brigade one block consumes. */
  crewLoad: number;
  /** Index into PREMISES this needs at minimum. */
  minRoom: number;
  /** Craft needed before it can be attempted at all. */
  minCraft: number;
  /** Equipment ids without which this service does not physically exist. */
  needsKit?: string[];
}

export const SERVICES: ServiceType[] = [
  {
    id: "lunch",
    label: "Lunch service",
    blurb:
      "Quick, busy and forgiving. The most covers you will do in a day and the least money for each of them — and the best way to move produce before it turns.",
    capacityShare: 0.75,
    spend: 0.6,
    booked: false,
    burnout: 3,
    reviewWeight: 0.6,
    crewLoad: 0.8,
    minRoom: 0,
    minCraft: 0,
  },
  {
    id: "dinner",
    label: "Dinner service",
    blurb:
      "The main event. Where the money is, where the reviews come from, and where a bad night is noticed.",
    capacityShare: 0.5,
    spend: 1,
    booked: false,
    burnout: 4.5,
    reviewWeight: 1,
    crewLoad: 1,
    minRoom: 0,
    minCraft: 0,
  },
  {
    id: "event",
    label: "Private event",
    blurb:
      "One party, one menu, agreed in advance. Good money and no guessing — you know exactly how many are coming and exactly what to buy.",
    capacityShare: 0.35,
    spend: 1.8,
    booked: true,
    burnout: 5,
    reviewWeight: 0.3,
    crewLoad: 1.3,
    minRoom: 1,
    minCraft: 45,
  },
  {
    id: "catering",
    label: "Catering contract",
    blurb:
      "Cooked here, eaten somewhere else. It pays on delivery and nobody writes about it — the service you take when the room is not full and the rent is.",
    capacityShare: 0.6,
    spend: 0.85,
    booked: true,
    burnout: 5.5,
    reviewWeight: 0,
    crewLoad: 1.2,
    /*
     * Open from the market stall, deliberately.
     *
     * It was gated behind a bistro and 40 craft, which put the career's only
     * recovery route out of reach of exactly the runs that needed it: a
     * simulation of struggling kitchens showed five in eight stuck at the
     * stall, where catering was unavailable. A rescue you cannot reach when
     * you are drowning is not a rescue. Cooking for someone else's party out
     * of a market kitchen is also simply what this trade looks like.
     */
    minRoom: 0,
    minCraft: 30,
  },
  {
    id: "tasting",
    label: "Tasting menu",
    blurb:
      "Twelve covers, nine courses, four times the spend. The fastest way to be talked about, in either direction.",
    capacityShare: 0.14,
    spend: 4,
    booked: false,
    burnout: 6,
    reviewWeight: 2.2,
    crewLoad: 1.8,
    minRoom: 2,
    minCraft: 62,
  },
  {
    /*
     * The counter. The smallest service in the game and by some distance the
     * most valuable per cover — and the only one that cannot be run without a
     * specific piece of kit, because eight stools facing the pass is a
     * physical thing rather than a way of cooking.
     *
     * It is also the most exposed: `reviewWeight` is the highest here, since
     * every person eating watched it being made.
     */
    id: "counter",
    label: "Chef's counter",
    blurb:
      "Eight seats at the pass, one menu, and no kitchen door to hide behind. Six times the spend and nowhere to put a mistake.",
    capacityShare: 0.05,
    spend: 6.5,
    booked: true,
    burnout: 9,
    reviewWeight: 2.8,
    crewLoad: 2.4,
    minRoom: 3,
    minCraft: 74,
    needsKit: ["counter"],
  },
];

export const SERVICE_BY_ID = new Map(SERVICES.map((x) => [x.id, x]));

/** Can this kitchen attempt this service at all? */
export function serviceOpen(
  sv: ServiceType,
  k: KitchenState,
  skill: number,
): boolean {
  const roomIndex = PREMISES.findIndex((p) => p.id === k.premises);
  if (roomIndex < sv.minRoom || skill < sv.minCraft) return false;
  /* Some services are a physical thing rather than a way of cooking: the
     counter is eight stools facing the pass, and without them there is no
     counter to sit at. */
  return (sv.needsKit ?? []).every((id) => (k.equipment ?? []).includes(id));
}

/** Why it is not available, in the player's words, or null. */
export function serviceBlocker(
  sv: ServiceType,
  k: KitchenState,
  skill: number,
): string | null {
  const roomIndex = PREMISES.findIndex((p) => p.id === k.premises);
  if (roomIndex < sv.minRoom) {
    return `Needs ${PREMISES[sv.minRoom].label.toLowerCase()} or better.`;
  }
  const missingKit = (sv.needsKit ?? []).filter(
    (id) => !(k.equipment ?? []).includes(id),
  );
  if (missingKit.length > 0) {
    return `Needs the ${KIT_BY_ID.get(missingKit[0])?.label.toLowerCase() ?? missingKit[0]}.`;
  }
  if (skill < sv.minCraft) {
    return `Needs ${sv.minCraft} craft — you have ${Math.round(skill)}.`;
  }
  return null;
}


/**
 * WHAT IS IN THE KITCHEN
 *
 * Most of this list does what equipment does in any management game: more
 * covers, better plates. Two lines of it do something nothing else in the
 * game can.
 *
 * ------------------------------------------------------------ refrigeration
 *
 * Shelf life is the Chef's whole identity. Produce ages, is served
 * oldest-first, and what expires leaves as a write-off that shows up in the
 * reviews as well as the ledger. Until now nothing could touch that curve —
 * you could only order more carefully around it.
 *
 * A cold room adds a week of life to everything in the larder. A blast
 * chiller adds another and saves most of what would still have been thrown
 * out. That is not a bigger number, it is a different game: one extra week is
 * what makes the market crate viable for a kitchen that cannot yet turn one
 * over, and two is what brings the luxury order within reach at all.
 *
 * Priced accordingly. Refrigeration is the worst value here per cover it
 * adds, because covers are not what you are buying.
 */
export interface KitchenKit {
  id: string;
  label: string;
  blurb: string;
  cost: number;
  upkeep: number;
  /** Extra weeks of life on everything in the larder. */
  shelfLife: number;
  /** Share of what would have spoiled that is recovered anyway. */
  wasteSaved: number;
  /** Covers the brigade can additionally plate. */
  covers: number;
  /** Added to the plate. */
  craft: number;
  /** Multiplier on spend per head. */
  spend: number;
}

export const KITCHEN_KIT: KitchenKit[] = [
  {
    id: "range",
    label: "Six-burner range",
    blurb: "More pans on at once. The difference between a queue and a service.",
    cost: 9_000,
    upkeep: 90,
    shelfLife: 0,
    wasteSaved: 0,
    covers: 28,
    craft: 1,
    spend: 1,
  },
  {
    id: "prep",
    label: "Prep station",
    blurb:
      "Benches, a sink and somewhere to put things down. Unglamorous, and the first thing a working kitchen runs out of.",
    cost: 7_500,
    upkeep: 70,
    shelfLife: 0,
    wasteSaved: 0.08,
    covers: 22,
    craft: 0,
    spend: 1,
  },
  {
    id: "dishwasher",
    label: "Pass-through dishwasher",
    blurb:
      "Plates back on the shelf in ninety seconds. Nobody has ever written about one and every kitchen needs one.",
    cost: 5_500,
    upkeep: 60,
    shelfLife: 0,
    wasteSaved: 0,
    covers: 18,
    craft: 0,
    spend: 1,
  },
  {
    id: "coldroom",
    label: "Walk-in cold room",
    blurb:
      "A week of life on everything you own. The only thing you can buy that argues with the calendar.",
    cost: 24_000,
    upkeep: 210,
    shelfLife: 1,
    wasteSaved: 0.15,
    covers: 0,
    craft: 0,
    spend: 1,
  },
  {
    id: "oven",
    label: "Deck oven",
    blurb: "Even heat, proper bread, and a pass that stops apologising.",
    cost: 15_000,
    upkeep: 130,
    shelfLife: 0,
    wasteSaved: 0,
    covers: 14,
    craft: 4,
    spend: 1,
  },
  {
    id: "blast",
    label: "Blast chiller",
    blurb:
      "Down to temperature in minutes rather than hours. Another week of life, and most of what used to go in the bin does not.",
    cost: 38_000,
    upkeep: 320,
    shelfLife: 1,
    wasteSaved: 0.4,
    covers: 0,
    craft: 2,
    spend: 1,
  },
  {
    id: "pastry",
    label: "Pastry section",
    blurb:
      "Marble, a mixer and somewhere cold enough to work. Puddings stop being an afterthought.",
    cost: 26_000,
    upkeep: 240,
    shelfLife: 0,
    wasteSaved: 0,
    covers: 10,
    craft: 6,
    spend: 1.05,
  },
  {
    id: "cellar",
    label: "Wine store",
    blurb:
      "A proper list, kept properly. It raises what every table spends without changing a thing you cook — and it is the only place a cellar can be aged. See the cellar screen.",
    cost: 31_000,
    upkeep: 190,
    shelfLife: 0,
    wasteSaved: 0,
    covers: 0,
    craft: 0,
    spend: 1.14,
  },

  /* ------------------------------------------------------- the luxury three
   *
   * None of these cooks anything. Each buys the *room* rather than the
   * kitchen, which is what the top of this trade is actually spent on, and
   * each one earns its keep through a different part of the model: the
   * counter opens a service, the porcelain moves the plate, the private room
   * moves the book.
   */
  {
    id: "counter",
    label: "Chef's counter",
    blurb:
      "Eight stools facing the pass. They watch you cook it and you watch them eat it, which is either the best idea you ever had or the worst.",
    cost: 84_000,
    upkeep: 340,
    shelfLife: 0,
    wasteSaved: 0,
    covers: 6,
    craft: 5,
    spend: 1.12,
  },
  {
    id: "porcelain",
    label: "Porcelain and glassware",
    blurb:
      "Hand-thrown plates, proper stems, and linen that goes out to be laundered. Nobody mentions it and everybody notices.",
    cost: 46_000,
    upkeep: 420,
    shelfLife: 0,
    wasteSaved: 0,
    covers: 0,
    craft: 3,
    spend: 1.16,
  },
  {
    id: "privateroom",
    label: "Private dining room",
    blurb:
      "Fourteen covers behind a door. It fills on the nights the main room does not, and it is booked by people who do not ask the price.",
    cost: 68_000,
    upkeep: 260,
    shelfLife: 0,
    wasteSaved: 0,
    covers: 16,
    craft: 0,
    spend: 1.08,
  },
];

export const KIT_BY_ID = new Map(KITCHEN_KIT.map((x) => [x.id, x]));

/** The kit actually installed. Absent on a save written before it existed. */
const installed = (k: KitchenState): KitchenKit[] =>
  (k.equipment ?? [])
    .map((id) => KIT_BY_ID.get(id))
    .filter((x): x is KitchenKit => !!x);

/**
 * Extra weeks of life on every lot in the larder.
 *
 * The most consequential number in this file: it moves the deadline the whole
 * career is played against. Two things touch it — refrigeration, which you
 * buy, and the city, which you chose once and cannot change. A city term can
 * be negative, and the callers floor the resulting life at one week so that
 * nothing can ever spoil in the week it was delivered.
 */
export const extraShelfLife = (k: KitchenState): number =>
  installed(k).reduce((n, x) => n + x.shelfLife, 0) + cityOf(k).shelfLife;

/** Share of a spoiled lot recovered rather than binned. Never all of it. */
export const wasteSaved = (k: KitchenState): number =>
  Math.min(0.75, installed(k).reduce((n, x) => n + x.wasteSaved, 0));

export const kitCovers = (k: KitchenState): number =>
  installed(k).reduce((n, x) => n + x.covers, 0);

export const kitCraft = (k: KitchenState): number =>
  installed(k).reduce((n, x) => n + x.craft, 0);

/**
 * Extra covers from anyone who specialises in tonight's service.
 *
 * Small on purpose — a speciality is a reason to keep a particular person, not
 * a reason to run the same service every week.
 */
export const specialistBonus = (k: KitchenState, service: string): number =>
  k.staff.filter((x) => x.speciality === service).length * 12;

export const kitSpend = (k: KitchenState): number =>
  installed(k).reduce((n, x) => n * x.spend, 1);

/** Power, servicing and the cold — a local bill, like the rent beside it. */
export const kitUpkeep = (k: KitchenState): number =>
  Math.round(installed(k).reduce((n, x) => n + x.upkeep, 0) * capitalIndex(k));

/** What a piece of kit costs to buy and install here. */
export const kitPrice = (k: KitchenState, kit: KitchenKit): number =>
  Math.round(kit.cost * capitalIndex(k));

/** What a role is paid, and what it costs to take somebody on, here. */
export const rolePay = (
  k: KitchenState,
  role: KitchenRole,
): { salary: number; hireCost: number } => {
  const labour = labourIndex(k);
  return {
    salary: Math.round(role.salary * labour),
    hireCost: Math.round(role.hireCost * labour),
  };
};

/* ------------------------------------------------------------ the agency */

/**
 * Somebody the agency has found, before you have agreed to take them on.
 *
 * Everything a `KitchenStaff` needs to exist is already decided here — the
 * skill, the wage, the temperament — so accepting a candidate is a transfer,
 * not a fresh roll. That is what makes the shortlist honest: the person you
 * looked at is the person who turns up.
 */
export interface Candidate {
  id: string;
  name: string;
  role: string;
  salary: number;
  skill: number;
  speciality?: string;
  traits: string[];
}

/** How many people a briefing comes back with. */
export const SHORTLIST_SIZE = 3;

/** How long the agency's people stay available before taking other work. */
export const SHORTLIST_WEEKS = 2;

/**
 * A shortlist is only worth showing while the people on it are still free.
 *
 * Checked wherever the shortlist is read rather than swept up at the end of
 * the week: the same answer, and it keeps `resolveWeek` out of it.
 */
export const shortlistLive = (
  k: KitchenState,
  week: number,
): Candidate[] =>
  k.shortlist && k.shortlistWeek !== undefined &&
  week - k.shortlistWeek < SHORTLIST_WEEKS
    ? k.shortlist
    : [];

/**
 * What the agency charges to go looking, and what it charges to place.
 *
 * The two together come to exactly what a hire cost before the agency
 * existed, so a player who briefs once and hires once pays what they always
 * did. The search fee is only *lost* if you look and walk away — which is the
 * decision the fee exists to create, and the reason briefing again to see
 * three different people is a real cost rather than a free reroll.
 */
export const agencyFees = (
  k: KitchenState,
  role: KitchenRole,
): { search: number; placement: number; total: number } => {
  const { hireCost } = rolePay(k, role);
  const search = Math.max(100, Math.round(hireCost * 0.25));
  return { search, placement: Math.max(0, hireCost - search), total: hireCost };
};

/** Second-hand, like everything in a kitchen. */
export const kitValue = (k: KitchenState): number =>
  installed(k).reduce((n, x) => n + x.cost * 0.45, 0);


/**
 * WHO IS COMING, AND HOW MUCH OF THAT YOU KNOW
 *
 * The Chef's problem is that food is bought before the customers arrive and
 * rots if they do not. Everything else in this file is about the food; this
 * part is about the customers, and specifically about how much of next week
 * is knowable in advance.
 *
 * ------------------------------------------------------------- the trade
 *
 * A booking policy decides how much of the room you sell before the night
 * and how much you leave to the street. Neither end is right:
 *
 *   walk-ins only   nothing is promised, so nothing is wasted on a no-show —
 *                   and you order for a number you cannot see.
 *   reservations    you know the number, and you turn away the people who
 *                   walked past and looked in.
 *   deposits        no-shows nearly vanish, and so do some of the bookings,
 *                   because being asked for money up front puts people off.
 *   conservative    book to less than the room holds. Never oversold, never
 *                   quite full.
 *   overbooked      sell more than the room seats on the assumption some
 *                   will not come. When they all come, you turn people away
 *                   at the door and they remember it.
 *
 * The point is that *predictability itself* costs something. A player who
 * wants to order exactly the right amount of food can have that, and pays
 * for it in covers.
 */
export type BookingPolicy =
  | "walkins"
  | "reservations"
  | "deposits"
  | "conservative"
  | "overbook";

export interface BookingPolicyDef {
  id: BookingPolicy;
  label: string;
  blurb: string;
  /** Share of the room reservations may fill. Above 1 is deliberate overselling. */
  book: number;
  /** Share of booked covers that do not turn up. */
  noShow: number;
  /** Multiplier on the walk-in trade left over. */
  walkIn: number;
  /** Taken per booked cover and kept when they do not arrive. */
  deposit: number;
}

export const BOOKING_POLICIES: BookingPolicyDef[] = [
  {
    id: "walkins",
    label: "Walk-ins welcome",
    blurb:
      "No book, no promises. The best nights are enormous and you never know which they are until the door opens.",
    book: 0,
    noShow: 0,
    walkIn: 1.35,
    deposit: 0,
  },
  {
    id: "conservative",
    label: "Book carefully",
    blurb:
      "Take reservations for four fifths of the room and keep the rest for whoever wanders in. Rarely full, never oversold.",
    book: 0.8,
    noShow: 0.12,
    walkIn: 0.75,
    deposit: 0,
  },
  {
    id: "reservations",
    label: "Reservations only",
    blurb:
      "The whole room, booked. You know exactly how many are coming, and the couple looking through the window are turned away.",
    book: 1,
    noShow: 0.12,
    walkIn: 0.25,
    deposit: 0,
  },
  {
    id: "deposits",
    label: "Deposit on booking",
    blurb:
      "Card details to hold the table. Almost nobody fails to turn up, and a few decide not to bother booking at all.",
    book: 0.85,
    noShow: 0.03,
    walkIn: 0.3,
    deposit: 12,
  },
  {
    id: "overbook",
    label: "Overbook the room",
    blurb:
      "Sell a fifth more than you can seat, because some never come. On the night they all come, somebody is standing in the doorway with a booking and no table.",
    book: 1.2,
    noShow: 0.12,
    walkIn: 0.15,
    deposit: 0,
  },
];

export const POLICY_BY_ID = new Map(BOOKING_POLICIES.map((x) => [x.id, x]));

/** The policy in force. Absent on a save written before the book existed. */
export const policyOf = (k: KitchenState): BookingPolicyDef =>
  POLICY_BY_ID.get(k.policy ?? "walkins") ?? BOOKING_POLICIES[0];

/** One driver of demand, in words rather than as a coefficient. */
export interface DemandDriver {
  label: string;
  effect: "up" | "down" | "flat";
  note: string;
}

/**
 * What next week looks like before you commit to it.
 *
 * Deliberately a *range*, and deliberately pure: the same kitchen in the same
 * week always forecasts the same thing, so a player can order against it and
 * the harness can assert on it. Where the week actually lands inside that
 * range is the seeded roll at resolution — the uncertainty is real, and it is
 * bounded and visible rather than hidden in a formula.
 */
export interface Forecast {
  service: string;
  /** Covers already promised to somebody. */
  reservations: number;
  /** Of those, how many are expected not to arrive. */
  noShows: number;
  walkInLow: number;
  walkInHigh: number;
  /** Total covers wanting a table, low and high. */
  low: number;
  high: number;
  /** What the room can physically seat for this service. */
  seats: number;
  /** Covers the larder can carry right now, across all services. */
  stock: number;
  drivers: DemandDriver[];
  /** What runs out first if the week goes as forecast. */
  binding: string;
}

/**
 * What the city and its other restaurants are doing to the week.
 *
 * Optional, and absent means the arithmetic this career had before any of it
 * existed — which is what keeps a save with no scene, and every test written
 * against the old signature, meaningful. See `scene.ts` for the one function
 * that builds it, and for why nothing computes it twice.
 */
export interface SceneInput {
  demand: number;
  drivers: DemandDriver[];
}

export function forecastFor(
  k: KitchenState,
  reputation: number,
  sv: ServiceType,
  blocks: number,
  skill: number,
  scene?: SceneInput,
): Forecast {
  const room = premisesOf(k);
  const policy = policyOf(k);
  const seats = Math.round(room.capacity * sv.capacityShare * blocks);
  const stock = larderCovers(k);
  const hands = Math.round(brigadeCovers(k, skill));

  const drivers: DemandDriver[] = [];

  /* Booked work is agreed in advance: there is nothing to forecast. */
  if (sv.booked) {
    drivers.push({
      label: "Agreed in advance",
      effect: "flat",
      note: "The covers are contracted. Nobody has to be attracted and nobody is turned away.",
    });
    return {
      service: sv.id,
      reservations: seats,
      noShows: 0,
      walkInLow: 0,
      walkInHigh: 0,
      low: seats,
      high: seats,
      seats,
      stock,
      drivers,
      binding: bindingOf(seats, seats, hands, stock, sv),
    };
  }

  const pull = 0.46 + reputation / 74;
  const buzz = 1 + Math.min(0.35, k.streak * 0.06);
  const city = cityOf(k);
  /*
   * The phone earning its place: followers are people who did not walk past
   * the window, and some of them book. Capped low — the street and word of
   * mouth still dominate — but real, so the composer is a lever rather than
   * a diary. Deterministic, like everything else the forecast reads.
   */
  const online = 1 + Math.min(0.2, (k.phone?.social.followers ?? 0) / 12_000);
  /*
   * What the menu does to the number of people who want a table.
   *
   * Breadth brings a wider audience; a menu priced above what the room
   * expects sends some of them elsewhere. Both live in `menuFactors`, and both
   * belong *here* rather than being applied after the night is over, so the
   * forecast a player orders against already contains the pricing decision
   * they made. A kitchen with no menu gets exactly 1 and the old arithmetic.
   */
  const menu = menuFactors(k, skill);
  /*
   * The scene multiplies everything else rather than being added to it: who
   * is in this city, what the rivals are taking, and what the phone has done
   * are all *shares of the people who would otherwise have come*, not extra
   * people from nowhere.
   */
  const interest =
    seats * pull * buzz * city.demand * online * menu.demand * (scene?.demand ?? 1);

  /* Said in words as well as folded into the number, because a player who
     priced the menu high needs to see the covers it cost them. */
  if (menu.dishes > 0 && Math.abs(menu.demand - 1) > 0.02) {
    drivers.push({
      label: "Your menu",
      effect: menu.demand > 1 ? "up" : "down",
      note:
        menu.demand > 1
          ? `${menu.dishes} dishes across ${menu.variety} course${menu.variety === 1 ? "" : "s"} — a wider menu reaches more people.`
          : menu.priceIndex > 1.05
            ? `Priced about ${Math.round((menu.priceIndex - 1) * 100)}% above what this room expects to pay, and some of them notice.`
            : "A narrow menu asks the room to want what you cook.",
    });
  }

  if (city.demand !== 1) {
    drivers.push({
      label: city.name,
      effect: city.demand > 1 ? "up" : "down",
      note:
        city.demand > 1
          ? `More people are looking for a table here than the room can seat — ${Math.round((city.demand - 1) * 100)}% more than a quiet city.`
          : `A smaller appetite for eating out than a capital — ${Math.round((1 - city.demand) * 100)}% fewer looking for a table.`,
    });
  }

  for (const driver of scene?.drivers ?? []) drivers.push(driver);

  drivers.push({
    label: "Your standing",
    effect: reputation >= 45 ? "up" : reputation <= 20 ? "down" : "flat",
    note:
      reputation >= 45
        ? "People have heard of you, and it shows in the book."
        : reputation <= 20
          ? "Few people know this place exists yet."
          : "You are known well enough to fill some of the room.",
  });
  if ((k.phone?.social.followers ?? 0) >= 1_200) {
    drivers.push({
      label: "Word travels online",
      effect: "up",
      note: `${Math.round(k.phone!.social.followers).toLocaleString("en-US")} people follow the kitchen, and some of them book.`,
    });
  }
  if (k.streak > 0) {
    drivers.push({
      label: "Word of mouth",
      effect: "up",
      note: `${k.streak} week${k.streak === 1 ? "" : "s"} of turning people away. Nothing fills a dining room like not getting in.`,
    });
  }

  /* Reservations are capped by the policy and by how many people want to
     come at all — you cannot book a room nobody is asking for. */
  const reservations = Math.round(
    Math.min(seats * policy.book, interest * 0.75),
  );
  const noShows = Math.round(reservations * policy.noShow);
  const arriving = reservations - noShows;

  const walkInCentre = Math.max(0, interest - reservations) * policy.walkIn;
  const walkInLow = Math.round(walkInCentre * 0.55);
  const walkInHigh = Math.round(walkInCentre * 1.45);

  drivers.push({
    label: policy.label,
    effect: policy.book > 0 ? "flat" : "up",
    note:
      policy.book === 0
        ? "Nothing is promised, so the whole night is walk-in trade."
        : policy.book > 1
          ? "Sold beyond the room on the assumption some will not come."
          : `Up to ${Math.round(policy.book * 100)}% of the room is sold before the night.`,
  });
  if (policy.noShow > 0 && reservations > 0) {
    drivers.push({
      label: "No-shows",
      effect: "down",
      note:
        policy.deposit > 0
          ? `About ${Math.round(policy.noShow * 100)}% fail to arrive, and their deposit is kept.`
          : `About ${Math.round(policy.noShow * 100)}% of bookings simply do not turn up.`,
    });
  }

  const low = arriving + walkInLow;
  const high = arriving + walkInHigh;

  return {
    service: sv.id,
    reservations,
    noShows,
    walkInLow,
    walkInHigh,
    low,
    high,
    seats,
    stock,
    drivers,
    binding: bindingOf(high, seats, hands, stock, sv),
  };
}

/**
 * What runs out first.
 *
 * Named in the player's words, because "you served fewer than you hoped" has
 * five different fixes and buying more food is only one of them.
 */
export function bindingOf(
  wanted: number,
  seats: number,
  hands: number,
  stock: number,
  sv: ServiceType,
): string {
  const crew = Math.floor(hands / sv.crewLoad);
  if (wanted <= 0) return "Weak demand — nobody is asking for a table";
  if (stock < Math.min(wanted, seats, crew)) return "Not enough food in the larder";
  if (crew < Math.min(wanted, seats)) return "Not enough hands on the pass";
  if (seats < wanted) return "Not enough seats in the room";
  return "Demand — you could serve more than are asking";
}


/**
 * WHERE THE FOOD COMES FROM
 *
 * Produce used to arrive from nowhere at a fixed price. A supplier is the
 * decision behind the decision: the same crate costs different money, arrives
 * with different life left in it, and sometimes does not arrive at all.
 *
 * ------------------------------------------------------------- the trade
 *
 * `freshness` is the one that matters, because it moves the same curve the
 * cold room moves. A farm delivery lands with an extra week in it; a
 * wholesaler's pallet has already spent a week on a lorry. So the cheapest
 * supplier is not the cheapest food — it is food you have less time to sell,
 * which is the whole Chef problem restated as a purchase order.
 *
 * `reliability` is the second axis and the reason not to depend on one
 * account. A farm that fails one delivery in eight is fine when the larder is
 * deep and ruinous on the Friday you were counting on it.
 *
 * ------------------------------------------------------- the relationship
 *
 * Ordering repeatedly builds standing with a supplier, and standing pays back
 * in the two things you cannot buy directly: a better price and a delivery
 * that turns up. It is deliberately slow. A kitchen that spreads its orders
 * thinly across six accounts never gets the discount, and that is the cost of
 * not being dependent on anybody.
 */
export interface Supplier {
  id: string;
  label: string;
  blurb: string;
  /** Multiplier on the crate price. */
  price: number;
  /** Weeks of shelf life added on delivery. Negative means it arrives tired. */
  freshness: number;
  /** Chance the delivery actually arrives. */
  reliability: number;
  /** They will not take an order smaller than this. */
  minimum: number;
  /** Produce grades they carry. */
  carries: string[];
  /** Standing in the trade before they will open an account. */
  minReputation: number;
}

export const SUPPLIERS: Supplier[] = [
  {
    id: "market",
    label: "The covered market",
    blurb:
      "Five minutes' walk, cash on the day, whatever is on the stall. No account, no minimum, no favours.",
    price: 1,
    freshness: 0,
    reliability: 0.97,
    minimum: 0,
    carries: ["basic", "market"],
    minReputation: 0,
  },
  {
    id: "wholesaler",
    label: "Wholesaler",
    blurb:
      "A pallet at a time and a price nobody else can match. It has already been in a lorry for a day and it shows.",
    price: 0.8,
    freshness: -1,
    reliability: 0.99,
    minimum: 2_400,
    carries: ["basic", "market"],
    minReputation: 0,
  },
  {
    id: "farm",
    label: "Direct from the farm",
    blurb:
      "Picked the morning it arrives, which buys you a week you cannot buy any other way. When the van breaks down there is no second van.",
    price: 0.96,
    freshness: 1,
    reliability: 0.87,
    minimum: 1_400,
    carries: ["basic", "market"],
    minReputation: 18,
  },
  {
    id: "seafood",
    label: "Day-boat merchant",
    blurb:
      "Off the boat and on your pass. Expensive, unpredictable, and the only way to put fish worth writing about on a plate.",
    price: 1.18,
    freshness: 0,
    reliability: 0.9,
    minimum: 1_800,
    carries: ["market", "luxury"],
    minReputation: 28,
  },
  {
    id: "premium",
    label: "Premium supplier",
    blurb:
      "The people who deliver to the places with stars. They will not open an account until you are somebody, and they charge for the privilege.",
    price: 1.32,
    freshness: 1,
    reliability: 0.96,
    minimum: 3_800,
    carries: ["market", "luxury"],
    minReputation: 40,
  },
  {
    id: "emergency",
    label: "Emergency wholesaler",
    blurb:
      "Anything, any quantity, this afternoon, at a price that assumes you have no choice. You will not have.",
    price: 1.85,
    freshness: -1,
    reliability: 1,
    minimum: 0,
    carries: ["basic", "market", "luxury"],
    minReputation: 0,
  },
];

export const SUPPLIER_BY_ID = new Map(SUPPLIERS.map((x) => [x.id, x]));

/** Standing with one supplier, 0 to 100. Absent until you order from them. */
export const standingWith = (k: KitchenState, id: string): number =>
  k.suppliers?.[id] ?? 0;

/**
 * What a crate actually costs from this supplier.
 *
 * Standing takes up to 12% off. That is deliberately less than the spread
 * between the cheapest and dearest supplier, so a relationship improves a
 * choice rather than replacing it.
 */
export function priceFrom(
  sup: Supplier,
  produce: Produce,
  standing: number,
  /* What the same crate costs in this city. Defaults to Lyon's own market so
     an older call site — and every test written before cities existed — still
     reads the price it always read. */
  city = 1,
): number {
  const loyalty = 1 - Math.min(0.12, standing / 850);
  return Math.round(produce.cost * sup.price * loyalty * city);
}

/**
 * What one delivery of an ingredient costs, all in.
 *
 * The crate-side twin of `priceFrom`, and it reads the same four things:
 * the supplier's markup, the standing you have built with them, what this
 * city charges for food, and — the one a crate does not have — whether the
 * thing is in season. Every ingredient purchase in the game goes through
 * here, so there is one place where an order's price is decided.
 */
export function ingredientPrice(
  k: KitchenState,
  sup: Supplier,
  ing: Ingredient,
  standing: number,
  week: number,
): number {
  const loyalty = 1 - Math.min(0.12, standing / 850);
  const unit = seasonalPrice(ing, week) * sup.price * loyalty * produceIndex(k);
  return Math.round(unit * ing.orderSize);
}

/** Shelf life a crate arrives with, before the kitchen's own refrigeration. */
export const lifeFrom = (sup: Supplier, produce: Produce): number =>
  Math.max(1, produce.shelfLife + sup.freshness);

/**
 * Odds the van turns up.
 *
 * Standing buys back most of the gap to certain, which is the real reason to
 * keep an account warm rather than always chasing the lowest price.
 */
export const arrivalOdds = (sup: Supplier, standing: number): number =>
  Math.min(0.995, sup.reliability + (1 - sup.reliability) * (standing / 140));

/**
 * Did the van turn up?
 *
 * Deterministic on purpose. The engine clones state and replays commands, so
 * a command that called the random generator would mean different things on
 * different replays of the same run. Hashing the run's seed with the order's
 * own number gives a number that is fixed for that order, unpredictable to
 * the player, and identical every time the run is rebuilt — which is what
 * "deterministic and testable" has to mean here.
 *
 * A first attempt queued orders and rolled them during the week instead. That
 * worked, but it put a `pending` array in the save and made buying feel like
 * it had failed, for no gain over this.
 */
export function delivered(
  seed: number,
  orderNo: number,
  sup: Supplier,
  standing: number,
): boolean {
  let h = (seed ^ (orderNo * 0x9e3779b1)) >>> 0;
  h ^= h << 13;
  h >>>= 0;
  h ^= h >> 17;
  h ^= h << 5;
  h >>>= 0;
  return h / 0x100000000 < arrivalOdds(sup, standing);
}

/** Why this supplier will not take the order, in the player's words, or null. */
export function supplierBlocker(
  sup: Supplier,
  k: KitchenState,
  reputation: number,
  produce: Produce | null,
): string | null {
  if (reputation < sup.minReputation) {
    return `They open accounts at ${sup.minReputation} standing. You are at ${Math.round(reputation)}.`;
  }
  if (produce && !sup.carries.includes(produce.id)) {
    return `They do not carry ${produce.label.toLowerCase()}.`;
  }
  return null;
}

/** One purchase of produce, tracked separately so it can age on its own. */
export interface Lot {
  id: string;
  produce: string;
  /** Who delivered it. Absent on a lot bought before suppliers existed. */
  from?: string;
  /**
   * Shelf life this particular crate arrived with, in weeks.
   *
   * On the lot rather than looked up from the produce, because two crates of
   * the same thing from different suppliers genuinely have different amounts
   * of time left in them — which is the entire point of choosing a supplier.
   * Absent on an older lot, which falls back to the catalogue figure.
   */
  life?: number;
  /** Covers still available from this lot. */
  left: number;
  /** What the whole lot cost, for writing off what is wasted. */
  unitCost: number;
  boughtWeek: number;
}

/**
 * SOMEBODY WHO WORKS FOR YOU
 *
 * A cook was `{ id, name, role, salary }` — a salary that produced covers. The
 * brigade was therefore interchangeable: two commis chefs were the same commis
 * chef twice, and losing one cost arithmetic rather than anything you felt.
 *
 * Every field below had to earn its place by changing a number the player can
 * see, because attributes that only appear on a card are decoration:
 *
 *   skill     what they put out, and what it is worth on the plate
 *   morale    how much of that skill actually arrives this week
 *   loyalty   whether they are still here next month
 *   speciality where they are better than their role suggests
 *
 * Deliberately four and not eleven. Consistency, speed, leadership potential
 * and employment history were all specified; each would have needed its own
 * lever in a weekly loop that already has enough, and unexpressed state is
 * how a management game starts lying to its player.
 */
export interface KitchenStaff {
  id: string;
  name: string;
  role: string;
  salary: number;
  /** 0-100. What they can do on a good day. */
  skill?: number;
  /** 0-100. How much of that arrives this week. Falls when overworked. */
  morale?: number;
  /** 0-100. How likely they are to still be here. */
  loyalty?: number;
  /** A service they are unusually good at, or none. */
  speciality?: string;
  /** The week they started, so the run can say how long they have been here. */
  since?: number;
  /**
   * How worn out they are, 0-100.
   *
   * Distinct from morale on purpose. Morale is how they feel about working
   * here and moves slowly; fatigue is how much service they have absorbed
   * this month and moves every single week. A tired cook makes mistakes; an
   * unhappy one leaves.
   */
  fatigue?: number;
  /** Services worked. Skill grows out of this, not out of money. */
  experience?: number;
  /** Progress towards the next skill point from deliberate training, 0-100. */
  training?: number;
  /** One or two, fixed when they are hired. See `brigade.ts`. */
  traits?: string[];
  /** Set while they are taking a week off, and cleared when it is over. */
  restingUntil?: number;
  /** Week they last came up a rank. Read by the phone's staff post. */
  promotedWeek?: number;
}

/* Fields are optional so a brigade hired before any of this existed still
   loads; these are what an un-migrated cook reads as. */
export const skillOf = (x: KitchenStaff): number => x.skill ?? 50;
export const moraleOf = (x: KitchenStaff): number => x.morale ?? 70;
export const loyaltyOf = (x: KitchenStaff): number => x.loyalty ?? 60;

/**
 * How much of a person's work actually lands.
 *
 * Skill sets the ceiling; morale decides how close to it they get. A brilliant
 * cook who is being run into the ground is worth less than a steady one who is
 * not, which is the entire argument for looking after people.
 */
export const effectiveOf = (x: KitchenStaff): number =>
  (0.55 + (skillOf(x) / 100) * 0.65) * (0.6 + (moraleOf(x) / 100) * 0.4);

/** The brigade's average morale, for the read-out. Null when nobody works here. */
export const brigadeMorale = (k: KitchenState): number | null =>
  k.staff.length === 0
    ? null
    : k.staff.reduce((n, x) => n + moraleOf(x), 0) / k.staff.length;

/** Anyone likely to hand their jacket back soon. */
export const atRisk = (k: KitchenState): KitchenStaff[] =>
  k.staff.filter((x) => loyaltyOf(x) < 35 || moraleOf(x) < 30);

/** What one kind of service did this week. */
export interface ServiceLine {
  id: string;
  blocks: number;
  /** Covers promised before the night. */
  reservations: number;
  /** Booked covers that did not arrive. */
  noShows: number;
  /** Covers off the street. */
  walkIns: number;
  /** Everybody who wanted a table. */
  wanted: number;
  served: number;
  turnedAway: number;
  revenue: number;
  /** What the food on those plates cost, at what it was bought for. */
  foodCost: number;
  /** Deposits kept from people who did not come. */
  deposits: number;
  quality: number;
  freshness: number;
  /** What actually limited this service, in words. */
  binding: string;
}

export interface ServiceResult {
  wanted: number;
  served: number;
  turnedAway: number;
  /** Covers lost for want of food rather than want of hands or seats. */
  shortOfFood: number;
  quality: number;
  freshness: number;
  waste: number;
  wasteCost: number;
  revenue: number;
  /** One entry per service actually run, for the week's read-out. */
  lines: ServiceLine[];
  /**
   * What each dish did, when a menu was on.
   *
   * Optional: a week served without a menu has no dishes to report, and a
   * save written before the menu existed has none either.
   */
  dishes?: DishResult[];
  /** What the named ingredients cost this week, off the lots they came from. */
  ingredientCost?: number;
  /** Covers sold as the staple alone, because the menu ran short. */
  plainCovers?: number;
  /**
   * The nights themselves, tick by tick.
   *
   * One entry per service that ran, carrying its own queues, waits, mistakes
   * and bottleneck. This is what the service dashboard renders: the player
   * steps through the recording rather than watching a timer, which is why
   * leaving the screen and reloading the save both show the same night.
   *
   * Optional and bounded — a week runs at most a handful of services and each
   * keeps at most fourteen ticks — because it is written to `localStorage`
   * every week alongside everything else.
   */
  nights?: ServiceReport[];
}

export interface KitchenState {
  premises: string;
  /**
   * Where the kitchen is. Chosen at week one and never changed.
   *
   * Optional so a save written before the choice existed loads and reads as
   * Lyon, which is where every run before this one was.
   */
  city?: string;
  larder: Lot[];
  /**
   * Kit installed. Optional so a save written before equipment existed still
   * loads and reads as a kitchen with none.
   */
  equipment?: string[];
  staff: KitchenStaff[];
  /** Services opened last week, from the allocation. */
  lastService: ServiceResult | null;
  /** Weeks in a row the room sold out, for the word-of-mouth term. */
  streak: number;
  /**
   * How the book is run. Optional so a save written before reservations
   * existed loads and reads as walk-ins only, which is what it was.
   */
  policy?: BookingPolicy;
  /** Standing with each supplier, keyed by id. Absent until you order. */
  suppliers?: Record<string, number>;
  /**
   * The kitchen's phone: feed, messages, news, standing.
   *
   * Optional so a save from before the Chef had one still loads;
   * `ensureChefPhone` creates it on first touch, so an old run gains a
   * phone rather than being rejected for not having one.
   */
  phone?: PhoneState;
  /**
   * Named ingredients, on top of the crates.
   *
   * Optional, like everything else added after this career shipped: a save
   * without one reads as a kitchen that has not started buying ingredients
   * yet, which is exactly what it is.
   */
  pantry?: IngredientLot[];
  /** What is offered, at the prices the player set. Absent means no menu. */
  menu?: MenuEntry[];
  /** Dishes developed, and what has been done to them since. */
  recipes?: RecipeProgress[];
  /**
   * How the player wants a service run: push the brigade, simplify the
   * plating, hold the walk-ins, and so on.
   *
   * Named `service` rather than `policy` because `policy` is already the
   * *booking* policy and has been since this career shipped — two different
   * decisions that would read as one field. Optional, so a save from before
   * the pipeline runs every night on the house defaults.
   */
  service?: ServicePolicy;

  /* ------------------------------------------------------------- phase 3
   *
   * The restaurant as the city sees it. Every field below is optional and
   * every reader treats absence as the neutral value, which is what lets a
   * save written before any of this existed load and play unchanged: no
   * standing breakdown, no reviews, no rivals, and a reputation that is
   * exactly the single number it always was.
   */

  /** The seven standing categories. Absent means "all equal to reputation". */
  standing?: Partial<Record<StandingId, number>>;
  /** Why each category moved, newest first. Bounded. */
  repLog?: StandingChange[];
  /** One snapshot per resolved week, for the trend. Bounded. */
  repTrend?: StandingSnapshot[];
  /** What people wrote about recent nights. Bounded. */
  reviews?: Review[];
  /** Complaints that gained enough attention to need an answer. */
  complaints?: Complaint[];
  /** Reach, expectations, promotions — what the phone does to the room. */
  buzz?: BuzzState;
  /** The other restaurants in this city. Created on first resolved week. */
  rivals?: Competitor[];
  /** A critic who has taken an interest but has not been yet. */
  criticWatch?: CriticWatch;
  /** Reviews that have been published about you. Bounded. */
  verdicts?: CriticVerdict[];
  /** Awards won. Kept for the record; none of them ends anything. */
  awards?: { week: number; label: string }[];
  /** Week the room was last taken on, so a renovation is news for a while. */
  renovatedWeek?: number;
  /**
   * Plate quality, one entry per resolved week, oldest first. Bounded.
   *
   * Consistency is the only standing category that cannot be measured from a
   * single week — it is by definition about the difference between weeks — so
   * this is the shortest possible record that can answer it.
   */
  qualityLog?: number[];
  /** Week the menu last changed. Innovation decays from here. */
  menuChangedWeek?: number;

  /* ------------------------------------------------------------- phase 4
   *
   * The craft, the cellar, the guide and the work outside the kitchen. All
   * optional, all absent on every save written before them, and all read
   * through helpers that treat absence as "this chef has not done any of
   * that yet" — which for a save from Phase 3 is exactly true.
   */

  /** Practice points banked against each technique. See `craft.ts`. */
  techniques?: Record<string, number>;
  /** Stages already done, so none is offered twice. */
  stages?: string[];
  /** Week you get back from one. While it is ahead, you are not here. */
  stagingUntil?: number;
  /** The technique deliberate practice is currently going into. */
  practising?: string;
  /** Cases of wine, oldest first. See `cellar.ts`. */
  cellar?: WineLot[];
  /** Stars currently held, 0–3. The guide can take them back. */
  stars?: number;
  /** What the guide has done, newest first. Bounded. */
  guide?: GuideRecord[];
  /** Work outside the kitchen: books, television, consultancy, pop-ups. */
  ventures?: VentureState;

  nextId: number;
  /**
   * Who the agency has found for you, and the week they found them.
   *
   * Hiring used to be blind: you paid, and a person appeared. Now you brief an
   * agency, pay them to go and look, and see the three people they came back
   * with — name, skill, wage and temperament — before you commit to anybody.
   *
   * Optional so a save from before the agency existed still loads; a run with
   * no shortlist simply has not briefed anyone yet.
   */
  shortlist?: Candidate[];
  shortlistWeek?: number;
}

/* ----------------------------------------------------------------- helpers */

export const premisesOf = (k: KitchenState): Premises =>
  PREMISES_BY_ID.get(k.premises) ?? PREMISES[0];

export const rent = (k: KitchenState): number =>
  Math.round(premisesOf(k).rent * cityOf(k).rent);

/**
 * A sum quoted in Lyon money, in the money of the city this kitchen is in.
 *
 * Lives here rather than in `chef.ts` because the events file needs it too,
 * and `chef.ts` imports the events — so the rule has to sit below both of
 * them. `localSum` in `chef.ts` is the `RunState` spelling of this and calls
 * straight through, so there is still one definition of what "local" means.
 */
export const localOf = (k: KitchenState, amount: number): number =>
  Math.round(amount * cityOf(k).spend);

/**
 * What a cover is worth here.
 *
 * The room sets the expectation and the city sets the money. Every takings
 * calculation goes through this rather than reading `premises.spend`, so a
 * city cannot be added that changes the cards without changing the till.
 */
export const spendPerHead = (k: KitchenState): number =>
  premisesOf(k).spend * cityOf(k).spend;

/** Multiplier on every crate, from every supplier, in this city. */
export const produceIndex = (k: KitchenState): number => cityOf(k).produce;

/**
 * What people cost here.
 *
 * Found by simulation, and it was the single worst hole in the first pass of
 * the city table: rent, produce, takings and the target were all local while
 * wages were not, so a kitchen in Mumbai took 45% of Lyon's money at the till
 * and paid 100% of Lyon's wages at the pass. The bot was insolvent for 119 of
 * 120 weeks there and it was arithmetic, not difficulty.
 *
 * ------------------------------------------------- and why it is `spend`
 *
 * It used to be halfway between rent and spend, on the reasoning that a cook
 * is not paid in menu prices. True of the world, and wrong for this model —
 * because it left labour costing 19% more *relative to takings* in London than
 * in Lyon, on top of a rent that is already 37% higher relative to takings.
 * Compounded over a hundred and twenty weeks that was about fifty thousand
 * pounds, and it was the difference between a London kitchen ending level and
 * ending buried.
 *
 * A wage is a cost of producing revenue, exactly as produce is — and produce
 * has always tracked `spend`. Putting labour on the same index makes the
 * *operating margin* comparable everywhere, which is what balanced means, and
 * leaves the city to differentiate on the things it is supposed to: the rent,
 * the demand, the shelf life and the price of a crate.
 *
 * Applied when somebody is hired, so the salary on the payroll is already the
 * local one and a raise later compounds from it.
 */
export const labourIndex = (k: KitchenState): number => cityOf(k).spend;

/**
 * WHAT CAPITAL COSTS HERE
 *
 * The old `labourIndex` formula, under the name it was always describing:
 * halfway between what a city charges for space and what it pays for food.
 *
 * It is the right index for the things you *buy* — a range, a lease, a
 * fit-out — because those are priced off local building and equipment costs,
 * which sit between the two. It was the wrong index for wages, and that
 * distinction is the whole of this fix. See `labourIndex` above.
 */
export const capitalIndex = (k: KitchenState): number =>
  (cityOf(k).rent + cityOf(k).spend) / 2;

/**
 * What a room costs to take on here.
 *
 * Property follows the local cost base — but on the *blend*, not on rent
 * alone, and the difference between those two is worth a paragraph because it
 * was the whole of the expensive cities' balance problem.
 *
 * Scaling the purchase by `rent` charges a city's property premium **twice**:
 * once as capital at the moment you take the room on, and again as rent every
 * week you hold it, forever. London's rent is 1.85× Lyon's while its takings
 * are 1.35×, so a bistro there cost 37% more *relative to what it could earn*
 * than the same bistro in Lyon — and that gap compounds up a four-rung ladder.
 * The city harness showed the result plainly: a competent kitchen in London or
 * New York never left the market stall in a hundred and twenty weeks.
 *
 * `capitalIndex` is that blend, and the equipment list has always used it for
 * the same reason. A lease is a business asset priced off local building
 * costs, and the weekly rent is where the city's property premium belongs.
 */
export const premisesPrice = (k: KitchenState, room: Premises): number =>
  Math.round(room.cost * capitalIndex(k));

export const wages = (k: KitchenState): number =>
  k.staff.reduce((n, s) => n + s.salary, 0);

/** Covers the brigade can physically plate, you included. */
export function brigadeCovers(k: KitchenState, skill: number): number {
  /* The role sets what the job is worth; the person decides how much of it
     turns up. */
  const staff = k.staff.reduce(
    (n, s) => n + (ROLE_BY_ID.get(s.role)?.covers ?? 0) * effectiveOf(s),
    0,
  );
  /* Your own hands. A good cook is worth a section on their own, which is why
     a solo stall is viable at the start and hopeless by the end. */
  return staff + kitCovers(k) + 40 + skill * 0.6;
}

export const craftOf = (k: KitchenState): number =>
  k.staff.reduce(
    (n, s) => n + (ROLE_BY_ID.get(s.role)?.craft ?? 0) * effectiveOf(s),
    0,
  ) + kitCraft(k);

/** Covers the larder can still carry. */
export const larderCovers = (k: KitchenState): number =>
  k.larder.reduce((n, l) => n + l.left, 0);

/** What is left in the larder, at cost — an asset until it is not. */
export const larderValue = (k: KitchenState, week: number): number =>
  k.larder.reduce((n, l) => {
    const p = PRODUCE_BY_ID.get(l.produce);
    if (!p) return n;
    /* Worth what it can still be sold as, not what it cost. Stock on its last
       week is nearly worthless and the balance sheet should say so. */
    const left = Math.max(
      0,
      Math.max(1, (l.life ?? p.shelfLife) + extraShelfLife(k)) -
        (week - l.boughtWeek),
    );
    return n + (left > 0 ? l.left * l.unitCost * 0.6 : 0);
  }, 0);

/**
 * How fresh a lot is, 1 down to 0.
 *
 * Linear across its shelf life. A crate bought this week is 1; one on the last
 * day of its life is near 0 and still perfectly sellable — which is the point.
 * You are never forced to bin it, you simply serve worse food if you do not.
 */
export function freshnessOf(lot: Lot, week: number, extra = 0): number {
  const p = PRODUCE_BY_ID.get(lot.produce);
  if (!p) return 0;
  const age = week - lot.boughtWeek;
  /* The crate's own life, which depends on who delivered it. Older lots have
     no `life` and fall back to the catalogue. */
  const life = Math.max(1, (lot.life ?? p.shelfLife) + extra);
  return Math.max(0, Math.min(1, 1 - age / life));
}

export const isSpoiled = (lot: Lot, week: number, extra = 0): boolean => {
  const p = PRODUCE_BY_ID.get(lot.produce);
  if (!p) return true;
  /* Floored at a week, like `freshnessOf`: a city that costs you shelf life
     shortens the clock, it does not bin the crate on the day it arrives. */
  const life = Math.max(1, (lot.life ?? p.shelfLife) + extra);
  return week - lot.boughtWeek > life;
};

/**
 * Bin what has gone over, and report the loss.
 *
 * Called at the top of the week, before service, so a lot that expired is
 * genuinely unavailable tonight rather than quietly serving one last time.
 */
export function clearSpoiled(
  k: KitchenState,
  week: number,
): { covers: number; cost: number } {
  const extra = extraShelfLife(k);
  /* Chilling does not stop food going over. It saves a share of what would
     otherwise have been binned — trimmed, re-portioned, turned into stock. */
  const saved = wasteSaved(k);
  let covers = 0;
  let cost = 0;
  const keep: Lot[] = [];
  for (const lot of k.larder) {
    if (isSpoiled(lot, week, extra)) {
      const lost = Math.round(lot.left * (1 - saved));
      covers += lost;
      cost += lost * lot.unitCost;
    } else {
      keep.push(lot);
    }
  }
  k.larder = keep;
  return { covers, cost: Math.round(cost) };
}

/**
 * Take `covers` worth of food out of the larder, oldest first.
 *
 * FIFO is not an accounting convenience here, it is the mechanic: a kitchen
 * works down its oldest stock, so a larder with a fortnight of produce in it
 * serves the fortnight-old food *first* and the quality of the whole service
 * reflects that. Returns the covers actually drawn and the freshness they
 * averaged, weighted by how many plates came off each lot.
 */
export function drawFromLarder(
  k: KitchenState,
  covers: number,
  week: number,
): { drawn: number; freshness: number; grade: number; cost: number } {
  const extra = extraShelfLife(k);
  const order = [...k.larder].sort((a, b) => a.boughtWeek - b.boughtWeek);
  let need = covers;
  let drawn = 0;
  let freshWeighted = 0;
  let gradeWeighted = 0;
  /* What the food actually cost, at what it was bought for — the other half
     of a margin the player can only see if both halves are reported. */
  let cost = 0;

  for (const lot of order) {
    if (need <= 0) break;
    const take = Math.min(lot.left, need);
    if (take <= 0) continue;
    const p = PRODUCE_BY_ID.get(lot.produce);
    freshWeighted += freshnessOf(lot, week, extra) * take;
    gradeWeighted += (p?.grade ?? 0) * take;
    cost += take * lot.unitCost;
    lot.left -= take;
    drawn += take;
    need -= take;
  }
  k.larder = k.larder.filter((l) => l.left > 0);
  return {
    drawn,
    freshness: drawn > 0 ? freshWeighted / drawn : 0,
    grade: drawn > 0 ? gradeWeighted / drawn : 0,
    cost,
  };
}

/**
 * SUPERSEDED BY `forecastFor`.
 *
 * This returned a single number for a whole week's trade. It is kept because
 * it is the simplest statement of the underlying pull — standing times word of
 * mouth times the seats on offer — and `forecastFor` is the same arithmetic
 * split into the parts a player can act on: what is booked, what might walk
 * in, and how wide the gap between them is.
 *
 * Nothing calls it. Left exported rather than deleted so the relationship
 * between the two is visible at the point of use if the forecast ever needs
 * re-deriving.
 */
export function demandFor(
  k: KitchenState,
  reputation: number,
  seats: number,
  rng: Rng,
): number {
  if (seats <= 0) return 0;
  const pull = 0.46 + reputation / 74;
  const buzz = 1 + Math.min(0.35, k.streak * 0.06);
  const noise = 0.88 + rng.next() * 0.24;
  return Math.round(seats * pull * buzz * noise);
}

/**
 * What went on the plate, 0–100.
 *
 * Freshness is weighted heavily and deliberately: it is the number the player
 * controls by ordering well rather than by spending more, and it is the one
 * that separates this career from "buy the expensive thing".
 */
export function plateQuality(
  skill: number,
  craft: number,
  freshness: number,
  grade: number,
  pressure: number,
): number {
  const base = 26 + skill * 0.34 + craft * 1.15 + grade;
  const fresh = freshness * 26;
  /* Running the pass flat out costs you the details. */
  const rushed = Math.max(0, pressure - 1) * 14;
  return Math.max(0, Math.min(100, base + fresh - rushed));
}

/**
 * What the room thought, as a move in reputation.
 *
 * Expectation rises with standing, so the same plate that made your name at
 * 30 is merely adequate at 70. That is what stops reputation running away
 * once it starts, and it is why the top premises are a commitment rather than
 * a reward.
 */
export function reviewDelta(quality: number, reputation: number): number {
  const expected = 34 + reputation * 0.52;
  const gap = quality - expected;
  /* Bad news travels faster than good — a point of praise is worth less than
     a point of complaint, which is the thing every restaurant owner will tell
     you unprompted. */
  return gap >= 0 ? gap * 0.085 : gap * 0.155;
}

/* =========================================================== the pantry ===
 *
 * Named ingredients, the menu built out of them, and what a service does to
 * both. The catalogue is in `recipes.ts`; the arithmetic lives here beside
 * `drawFromLarder` and `clearSpoiled`, which are the crate-side versions of
 * exactly these jobs.
 *
 * Everything below is additive. A kitchen with no pantry and no menu returns
 * the neutral value from every function here, which is what lets a save
 * written before any of it existed play precisely as it did.
 */

/** How a lot of an ingredient is doing, in the four words a chef would use. */
export type FreshnessState = "fresh" | "acceptable" | "expiring" | "spoiled";

/**
 * Extra weeks of life the kitchen buys an ingredient, by where it is kept.
 *
 * Refrigeration is already the one purchase that argues with the calendar for
 * the crates; this is the same rule applied to the things a recipe actually
 * names. Dry goods gain nothing from a cold room — a sack of flour does not
 * care — and frozen stock is barely ageing to begin with, so the cold you buy
 * matters most for exactly the chilled ingredients the good dishes need.
 */
export function pantryExtraLife(k: KitchenState, storage: Storage): number {
  const cold = installed(k).reduce((n, x) => n + x.shelfLife, 0);
  const city = cityOf(k).shelfLife;
  if (storage === "dry") return Math.max(0, city);
  if (storage === "frozen") return cold > 0 ? cold + 2 : 2;
  return cold + city;
}

/** Weeks of life a lot has left. Floored so nothing dies the week it lands. */
export function ingredientLifeLeft(
  lot: IngredientLot,
  week: number,
  k: KitchenState,
): number {
  const ing = INGREDIENT_BY_ID.get(lot.ingredient);
  if (!ing) return 0;
  const total = Math.max(1, lot.life + pantryExtraLife(k, ing.storage));
  return total - (week - lot.boughtWeek);
}

/**
 * The band a lot is in.
 *
 * Four states rather than a percentage, because "62% fresh" is not a decision
 * and "use it this week or bin it" is. `spoiled` is the one with teeth: it can
 * never be served, whatever the kitchen would prefer.
 */
export function ingredientState(
  lot: IngredientLot,
  week: number,
  k: KitchenState,
): FreshnessState {
  const left = ingredientLifeLeft(lot, week, k);
  if (left <= 0) return "spoiled";
  if (left <= 1) return "expiring";
  const ing = INGREDIENT_BY_ID.get(lot.ingredient);
  const total = Math.max(1, (ing?.life ?? 1) + pantryExtraLife(k, ing?.storage ?? "dry"));
  return left / total > 0.55 ? "fresh" : "acceptable";
}

/** 1 down to 0 across a lot's life, for what it does to the plate. */
export function ingredientFreshness(
  lot: IngredientLot,
  week: number,
  k: KitchenState,
): number {
  const ing = INGREDIENT_BY_ID.get(lot.ingredient);
  if (!ing) return 0;
  const total = Math.max(1, lot.life + pantryExtraLife(k, ing.storage));
  return Math.max(0, Math.min(1, ingredientLifeLeft(lot, week, k) / total));
}

/** The pantry, whatever the save happens to carry. */
export const pantryOf = (k: KitchenState): IngredientLot[] => k.pantry ?? [];

/** Units of one ingredient on hand, spoiled stock excluded. */
export function pantryQty(
  k: KitchenState,
  ingredient: string,
  week: number,
): number {
  return pantryOf(k)
    .filter(
      (l) =>
        l.ingredient === ingredient && ingredientState(l, week, k) !== "spoiled",
    )
    .reduce((n, l) => n + l.qty, 0);
}

/** What the pantry is worth at what it cost, spoiled stock excluded. */
export function pantryValue(k: KitchenState, week: number): number {
  return pantryOf(k)
    .filter((l) => ingredientState(l, week, k) !== "spoiled")
    .reduce((n, l) => n + l.qty * l.unitCost, 0);
}

/**
 * Bin what has gone over, and report the loss.
 *
 * The crate-side twin of `clearSpoiled`, and it runs at the same moment for
 * the same reason: food that expired must be genuinely unavailable tonight
 * rather than quietly serving one last time. Refrigeration recovers a share
 * of what would otherwise be thrown, exactly as it does for the crates.
 */
export function clearSpoiledPantry(
  k: KitchenState,
  week: number,
): { units: number; cost: number; names: string[] } {
  if (!k.pantry || k.pantry.length === 0) {
    return { units: 0, cost: 0, names: [] };
  }
  const saved = wasteSaved(k);
  let units = 0;
  let cost = 0;
  const names: string[] = [];
  const keep: IngredientLot[] = [];

  for (const lot of k.pantry) {
    if (ingredientState(lot, week, k) === "spoiled") {
      const lost = lot.qty * (1 - saved);
      units += lost;
      cost += lost * lot.unitCost;
      const name = INGREDIENT_BY_ID.get(lot.ingredient)?.name;
      if (name && !names.includes(name)) names.push(name);
    } else {
      keep.push(lot);
    }
  }
  k.pantry = keep;
  return { units: Math.round(units * 10) / 10, cost: Math.round(cost), names };
}

/** Everything in the pantry that will be spoiled by this time next week. */
export function expiringSoon(
  k: KitchenState,
  week: number,
): { lot: IngredientLot; state: FreshnessState }[] {
  return pantryOf(k)
    .map((lot) => ({ lot, state: ingredientState(lot, week, k) }))
    .filter((x) => x.state === "expiring" || x.state === "spoiled");
}

/* ------------------------------------------------------------- the menu */

/** What the kitchen is actually offering. Empty is a legitimate answer. */
export const activeMenu = (k: KitchenState): MenuEntry[] => k.menu ?? [];

/** What the kitchen has developed, including the dishes it started with. */
export function knownRecipes(k: KitchenState): RecipeProgress[] {
  if (k.recipes && k.recipes.length > 0) return k.recipes;
  /* A save from before recipes existed still knows the dishes any kitchen can
     cook — they are not a purchase, they are what a cook already knows. */
  return STARTER_RECIPES.map((id) => ({ id, served: 0, refined: 0 }));
}

export const progressFor = (
  k: KitchenState,
  id: string,
): RecipeProgress | undefined => knownRecipes(k).find((p) => p.id === id);

export const knowsRecipe = (k: KitchenState, id: string): boolean =>
  knownRecipes(k).some((p) => p.id === id);

/** The best cook in the building, you included. */
export const bestSkillIn = (k: KitchenState, own: number): number =>
  k.staff.reduce((n, x) => Math.max(n, skillOf(x) * effectiveOf(x)), own);

/**
 * WHAT A MENU DOES TO A WEEK
 *
 * Four numbers, and every one of them is a trade the player made:
 *
 *   `demand`    a wider menu reaches more people — up to a point. Past about
 *               eight dishes the room does not get any larger and the kitchen
 *               does; and a menu priced above what the room expects to pay
 *               loses covers, which is what stops "set every price to 300"
 *               from being the whole game.
 *   `quality`   a short menu is a consistent one. Every dish past six costs a
 *               little polish, and dishes the brigade cannot cook cost more.
 *   `prepLoad`  slow dishes eat the pass. A menu of tasting courses plates
 *               fewer covers than a menu of soup, with the same brigade.
 *   `variety`   distinct categories, which is what "wider audience" means:
 *               five mains is not a menu, it is one dish five times.
 */
export interface MenuFactors {
  dishes: number;
  variety: number;
  demand: number;
  quality: number;
  prepLoad: number;
  /** Average price against what the room expects to pay. 1 is on the nose. */
  priceIndex: number;
}

export function menuFactors(k: KitchenState, own: number): MenuFactors {
  const menu = activeMenu(k);
  if (menu.length === 0) {
    return {
      dishes: 0,
      variety: 0,
      demand: 1,
      quality: 1,
      prepLoad: 1,
      priceIndex: 1,
    };
  }
  const rows = menu
    .map((e) => ({ e, r: RECIPE_BY_ID.get(e.recipe) }))
    .filter((x): x is { e: MenuEntry; r: Recipe } => !!x.r);
  if (rows.length === 0) {
    return {
      dishes: 0,
      variety: 0,
      demand: 1,
      quality: 1,
      prepLoad: 1,
      priceIndex: 1,
    };
  }

  const variety = new Set(rows.map((x) => x.r.category)).size;
  /* Repeating a cuisine is what "similar dishes" means in practice: three
     French mains read as one idea, however different their ingredients. */
  const cuisines = new Set(rows.map((x) => x.r.cuisine)).size;
  const sameness = 1 - Math.min(0.12, (rows.length - cuisines) * 0.03);

  const room = premisesOf(k);
  const expected = room.spend * cityOf(k).spend;
  const avgPrice =
    rows.reduce((n, x) => n + x.e.price, 0) / Math.max(1, rows.length);
  const priceIndex = expected > 0 ? avgPrice / expected : 1;

  /* Breadth helps, and stops helping. Eight dishes is a full menu; a
     twentieth adds waste and nothing else. */
  const breadth = 1 + Math.min(0.22, variety * 0.05 + Math.min(rows.length, 8) * 0.012);
  /* Charging above what the room expects costs covers, and charging under it
     wins a few. Bounded both ways: a cheap menu is not a growth strategy. */
  const perceived = Math.max(0.62, Math.min(1.12, 1 - (priceIndex - 1) * 0.42));

  const best = bestSkillIn(k, own);
  const overreach =
    rows.reduce((n, x) => n + Math.max(0, x.r.needsSkill - best), 0) /
    Math.max(1, rows.length);
  const consistency = 1 - Math.max(0, rows.length - 6) * 0.015 - overreach * 0.004;

  /* A dish's time on the pass, against the eight minutes a plain cover takes.
     A menu that averages sixteen minutes plates about half as many. */
  const avgPrep =
    rows.reduce((n, x) => n + x.r.prepTime, 0) / Math.max(1, rows.length);

  return {
    dishes: rows.length,
    variety,
    demand: Math.max(0.6, breadth * perceived * sameness),
    quality: Math.max(0.7, Math.min(1.15, consistency)),
    prepLoad: Math.max(0.55, Math.min(1.25, 8 / Math.max(4, avgPrep))),
    priceIndex,
  };
}

/** One dish's share of a night, before anything runs out. */
export interface DishPlan {
  recipe: Recipe;
  entry: MenuEntry;
  progress?: RecipeProgress;
  /** 0-1 of the room, normalised across the menu. */
  share: number;
}

/**
 * Who orders what.
 *
 * Popularity is the weight, and a signature dish pulls harder than its
 * popularity alone — being known for something is the whole point of earning
 * it. Deterministic: the same menu always splits the same room the same way,
 * so a player can plan an order against it.
 */
export function planDishes(k: KitchenState, own: number): DishPlan[] {
  const best = bestSkillIn(k, own);
  const rows = activeMenu(k)
    .map((entry) => {
      const recipe = RECIPE_BY_ID.get(entry.recipe);
      if (!recipe) return null;
      if (dishBlocker(recipe, k, best)) return null;
      const progress = progressFor(k, entry.recipe);
      const weight = recipe.popularity * (progress?.signature ? 1.35 : 1);
      return { recipe, entry, progress, weight };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const total = rows.reduce((n, x) => n + x.weight, 0);
  if (total <= 0) return [];
  return rows.map(({ recipe, entry, progress, weight }) => ({
    recipe,
    entry,
    progress,
    share: weight / total,
  }));
}

/** What one dish did over a service. */
export interface DishResult {
  recipe: string;
  name: string;
  covers: number;
  revenue: number;
  /** What the ingredients actually cost, off the lots they came from. */
  cost: number;
  quality: number;
  /** Set when the dish ran out of something. */
  shortOf?: string;
}

/**
 * Take the ingredients for `covers` of one dish out of the pantry.
 *
 * Oldest lots first, exactly like the crates — a kitchen works down what it
 * has. Two rules are absolute:
 *
 *   1. **spoiled stock is never served.** It is skipped here and binned by
 *      `clearSpoiledPantry`, so the safe rule holds even if a caller forgets
 *      to sweep first.
 *   2. **quantities never go negative.** The number of covers actually made is
 *      the return value; asking for more than the pantry can carry produces
 *      fewer dishes, never a negative lot.
 */
export function consumeForCovers(
  k: KitchenState,
  recipe: Recipe,
  covers: number,
  week: number,
): { made: number; cost: number; freshness: number; shortOf?: string } {
  if (covers <= 0) return { made: 0, cost: 0, freshness: 1 };
  if (recipe.needs.length === 0) return { made: covers, cost: 0, freshness: 1 };

  /* How many covers every line could carry on its own; the scarcest binds. */
  let possible = covers;
  let shortOf: string | undefined;
  for (const line of recipe.needs) {
    const have = pantryQty(k, line.ingredient, week);
    const canDo = line.qty > 0 ? Math.floor(have / line.qty) : covers;
    if (canDo < possible) {
      possible = Math.max(0, canDo);
      shortOf = INGREDIENT_BY_ID.get(line.ingredient)?.name ?? line.ingredient;
    }
  }
  if (possible <= 0) return { made: 0, cost: 0, freshness: 1, shortOf };

  const pantry = k.pantry ?? [];
  let cost = 0;
  let freshWeighted = 0;
  let freshUnits = 0;

  for (const line of recipe.needs) {
    let need = line.qty * possible;
    const lots = pantry
      .filter(
        (l) =>
          l.ingredient === line.ingredient &&
          l.qty > 0 &&
          ingredientState(l, week, k) !== "spoiled",
      )
      .sort((a, b) => a.boughtWeek - b.boughtWeek);

    for (const lot of lots) {
      if (need <= 1e-9) break;
      const take = Math.min(lot.qty, need);
      lot.qty = Math.max(0, lot.qty - take);
      need -= take;
      cost += take * lot.unitCost;
      freshWeighted += ingredientFreshness(lot, week, k) * take;
      freshUnits += take;
    }
  }
  k.pantry = pantry.filter((l) => l.qty > 1e-6);

  return {
    made: possible,
    cost,
    freshness: freshUnits > 0 ? freshWeighted / freshUnits : 1,
    shortOf: possible < covers ? shortOf : undefined,
  };
}

/*
 * `serveFromMenu` used to live here: it split a night's covers across the
 * menu in one pass and returned the totals. Phase 2's pipeline replaced it —
 * a night is now tickets moving through stations, which is the same job done
 * where the queues are visible — so it was deleted rather than left beside
 * its replacement. Two functions that both claim to serve a night are two
 * answers to the same question, and one of them is always the stale one.
 *
 * The rule it enforced survives untouched in `consumeForCovers`, which is
 * still the only thing that takes an ingredient off a shelf.
 */

/**
 * What the menu would need to serve a given number of covers, against what is
 * on the shelf.
 *
 * The one place that arithmetic lives. The Menu screen warns with it, the
 * pantry panel warns with it, and the weekly briefing warns with it — three
 * surfaces that would otherwise each have their own idea of what "short of
 * chicken" means, and would disagree the first time one of them was edited.
 */
export interface Shortfall {
  ingredient: string;
  /** The dish that wanted it, named as the player named it. */
  dish: string;
  need: number;
  have: number;
}

export function menuShortfalls(
  k: KitchenState,
  covers: number,
  week: number,
  own: number,
): Shortfall[] {
  const out: Shortfall[] = [];
  for (const plan of planDishes(k, own)) {
    /* A main is ordered by its share of the room; everything else by how many
       covers are tempted — the same split `serveFromMenu` actually uses. */
    const isMain =
      plan.recipe.category === "main" || plan.recipe.category === "special";
    const want = Math.max(
      1,
      Math.round(covers * (isMain ? plan.share : plan.recipe.popularity / 100)),
    );
    for (const line of plan.recipe.needs) {
      const have = pantryQty(k, line.ingredient, week);
      const need = line.qty * want;
      if (have < need) {
        out.push({
          ingredient: line.ingredient,
          dish: recipeName(plan.recipe, plan.progress),
          need: Math.round(need * 10) / 10,
          have: Math.round(have * 10) / 10,
        });
      }
    }
  }
  return out;
}

export function initialKitchen(): KitchenState {
  return {
    premises: "stall",
    larder: [],
    equipment: [],
    staff: [],
    lastService: null,
    streak: 0,
    policy: "walkins",
    suppliers: {},
    /* The dishes any cook already knows. Not a purchase — a starting point,
       and the reason a new run can open a service on week one. */
    recipes: STARTER_RECIPES.map((id) => ({ id, served: 0, refined: 0 })),
    pantry: [],
    menu: [],
    nextId: 1,
  };
}
