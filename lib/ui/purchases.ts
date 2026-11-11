import type { RunState } from "../game/types";
import { med } from "../game/careers/doctor";
import {
  CONDITIONS,
  SPECIALTIES,
  EQUIPMENT,
  EQUIPMENT_BY_ID,
  FACILITY_TYPES,
  FACILITY_BY_ID,
} from "../game/medical/data";
import {
  LIFESTYLE,
  LIFESTYLE_BY_ID,
  supersedes,
} from "../game/medical/lifestyle";
import {
  DEPARTMENT_BY_ID,
  departmentCoverage,
  staffingNeed,
  type CoverageLevel,
} from "./departments";
import {
  departmentSlots,
  facilityPrice,
  facilitySlots,
  techniciansNeeded,
} from "../game/medical/sim";
import { cityOf } from "../game/medical/cities";
import { FLEET, crewNeeded, crewOn } from "../game/medical/fleet";
import { money } from "../game/format";
import { purchaseArt, type PurchaseArt } from "./purchaseArt";
import type { MedIconName } from "../../components/visuals/MedIcon";

/**
 * EVERYTHING YOU CAN BUY, IN ONE SHAPE
 *
 * Facilities, machines, houses, cars and everything else are five different
 * tables with five different field sets. The purchase interface should not
 * care: a card needs a name, a price, a picture, a state and a reason, and
 * every one of those can be derived.
 *
 * ------------------------------------------------------- derived, not copied
 *
 * Nothing here restates a price, an upkeep or an effect. Every number is read
 * from `FACILITY_TYPES`, `EQUIPMENT` or `LIFESTYLE` at call time, and the buy
 * command is the same one the old buttons dispatched. This module changes how
 * a purchase is *presented*, never what it costs or what it does.
 *
 * ---------------------------------------------------------------- on locking
 *
 * Only two things in this game genuinely refuse a purchase: a facility in a
 * city you have no licence for, and not having the money. Everything else is
 * available and merely unwise. So `lock` is null almost always, and the card
 * does not invent a padlock to look like a progression system — a fake gate
 * teaches a rule that does not exist.
 *
 * What *is* modelled honestly is the operational requirement: a scanner you
 * can buy today and cannot use until somebody is hired to run it. That is a
 * `caveat`, shown on the card and expanded in the detail view, not a lock.
 */

export type PurchaseKind =
  "facility" | "department" | "equipment" | "vehicle" | "lifestyle";

export type PurchaseGroupId =
  | "facilities"
  | "departments"
  | "equipment"
  | "fleet"
  | "homes"
  | "vehicles"
  | "services"
  | "luxury";

export type PurchaseState =
  "owned" | "active" | "affordable" | "unaffordable" | "locked";

/** One line of what an item does, for the card and the detail view. */
export interface Effect {
  label: string;
  value: string;
  tone: "good" | "neutral" | "cost";
}

export interface PurchaseItem {
  id: string;
  kind: PurchaseKind;
  group: PurchaseGroupId;
  label: string;
  blurb: string;
  art: PurchaseArt | null;
  price: number;
  /** Charged every week for as long as it is owned. Zero for none. */
  upkeep: number;
  /** The single most useful thing it does, in a few words. */
  headline: string;
  effects: Effect[];
  /** True operational requirements that are not purchase blocks. */
  caveats: string[];
  /** Why it cannot be bought at all. Null unless the game truly refuses. */
  lock: string | null;
  owned: boolean;
  /** Owned *and* the one currently in service — homes and cars only. */
  active: boolean;
  affordable: boolean;
  /** How far short of the price you are. Zero when affordable. */
  shortfall: number;
  state: PurchaseState;
  /** The word on the card's badge when there is no state to report. */
  categoryWord: string;
  /** What replacing the current one refunds. Homes and cars only. */
  tradeIn: { label: string; refund: number } | null;
  /**
   * Where this sits against what you already run.
   *
   * Facilities and equipment do not replace anything, so a trade-in is the
   * wrong comparison — what a player wants is "you have 144 slots; this adds
   * 280". Null where there is nothing meaningful to compare against.
   */
  comparison: { label: string; now: string; after: string } | null;
  /**
   * How well the organisation can actually staff and equip this, once open.
   *
   * Departments only. It is the one thing a purchase card cannot express as a
   * price or an effect: a cardiology unit you have opened and cannot staff is
   * costing you upkeep to refer work away, and that is a different state from
   * "owned".
   */
  coverage: {
    level: CoverageLevel;
    /** Severity the bench can take, against the severity the field produces. */
    covered: number;
    needed: number;
    /** One sentence on what is thin, or that nothing is. */
    note: string;
    /** Named machines this field needs that are not installed. */
    missingEquipment: string[];
    /** Who can work it, or the qualification that would let you. */
    staffing: string;
  } | null;
  /** The command to dispatch, and its argument. */
  buy: { cmd: string; arg: string };
  /** Owned items that can be sold back. */
  sell: { cmd: string; arg: string; refund: number } | null;
  icon: MedIconName;
  /**
   * The item's own accent, where it has one.
   *
   * Departments carry a wayfinding colour that already identifies the field on
   * the caseload, the rota and the outbreak chips. Reusing it here as a hairline
   * makes the catalogue part of the same system rather than a separate screen
   * that happens to sell the same things. Null everywhere else.
   */
  accent: string | null;
}

export interface PurchaseGroup {
  id: PurchaseGroupId;
  label: string;
  /** What this group is and how it behaves, in one line. */
  note: string;
  icon: MedIconName;
  items: PurchaseItem[];
}

const stateOf = (
  lock: string | null,
  owned: boolean,
  active: boolean,
  affordable: boolean,
): PurchaseState =>
  active
    ? "active"
    : owned
      ? "owned"
      : lock
        ? "locked"
        : affordable
          ? "affordable"
          : "unaffordable";

/* ------------------------------------------------------------- facilities */

function facilityItems(state: RunState): PurchaseItem[] {
  const m = med(state);
  const city = m.homeCity;
  const licensed = m.cities.includes(city);
  const best = m.facilities.reduce((n, f) => {
    const rank = FACILITY_TYPES.findIndex((t) => t.id === f.type);
    return Math.max(n, rank);
  }, -1);

  return FACILITY_TYPES.map((f, i) => {
    const price = facilityPrice(f.id, city);
    const count = m.facilities.filter((x) => x.type === f.id).length;
    const affordable = state.r.cash >= price;
    /* "Active" for a facility means it is the best premises you hold —
       the one the practice actually reads as. Owning a clinic after a
       hospital is real, and it is not your headline site. */
    const active = i === best;
    const lock = licensed
      ? null
      : `No licence for ${cityOf(city).name}. Take one before you can build here.`;

    return {
      id: f.id,
      kind: "facility" as const,
      group: "facilities" as const,
      label: f.label,
      blurb: f.blurb,
      art: purchaseArt(f.id),
      price,
      upkeep: f.upkeep,
      headline: `${f.slots} treatment slots · room for ${f.departmentSlots} department${f.departmentSlots === 1 ? "" : "s"}`,
      effects: [
        {
          label: "Treatment slots",
          value: `+${f.slots}`,
          tone: "good" as const,
        },
        {
          label: "Department slots",
          value: `+${f.departmentSlots}`,
          tone: "good" as const,
        },
        {
          label: "Upkeep",
          value: `${money(f.upkeep)}/wk`,
          tone: "cost" as const,
        },
        {
          label: "Priced for",
          value: cityOf(city).name,
          tone: "neutral" as const,
        },
      ],
      caveats:
        f.upkeep > 0
          ? [
              "Upkeep is charged in a quiet week too. Premises bought ahead of the caseload are the usual route into insolvency.",
            ]
          : [],
      lock,
      owned: count > 0,
      active,
      affordable,
      shortfall: Math.max(0, price - state.r.cash),
      state: stateOf(lock, count > 0, active, affordable),
      categoryWord: "Premises",
      tradeIn: null,
      comparison: {
        label: "Treatment slots across the network",
        now: `${Math.round(facilitySlots(m))}`,
        after: `${Math.round(facilitySlots(m)) + f.slots}`,
      },
      coverage: null,
      buy: { cmd: "buyFacility", arg: `${f.id}:${city}` },
      sell: null,
      icon: (i >= 2 ? "bed" : "clinic") as MedIconName,
      accent: null,
    };
  });
}

/* ------------------------------------------------------------ departments */

/**
 * A department is a purchase, and it was the only one still rendered as a text
 * row. It also carries more state than anything else in the catalogue: opening
 * one is a decision about slots, staffing and equipment at once, and all three
 * can be wrong independently.
 *
 * Nothing here is invented. `departmentCoverage` reads `coverageFor`, the same
 * function the resolver calls when it decides whether a case is treatable, and
 * the slot arithmetic is `departmentSlots` — the number the command checks.
 */
function departmentItems(state: RunState): PurchaseItem[] {
  const m = med(state);
  const used = m.departments.length;
  const max = departmentSlots(m);
  const coverageById = new Map(departmentCoverage(m).map((c) => [c.id, c]));

  return SPECIALTIES.map((sp) => {
    const identity = DEPARTMENT_BY_ID.get(sp.id)!;
    const open = m.departments.includes(sp.id);
    const affordable = state.r.cash >= sp.unlockCost;
    const cover = coverageById.get(sp.id)!;
    const noRoom = !open && used >= max;

    /* The only genuine refusal: the command checks the slot count, so a card
       that says "no room" is saying what the engine will say. */
    const lock = noRoom
      ? `No room: all ${max} department slot${max === 1 ? " is" : "s are"} in use. More premises is what adds them.`
      : null;

    const caveats: string[] = [];
    if (open && cover.missingEquipment.length > 0) {
      caveats.push(
        `Open, but ${cover.missingEquipment.join(", ").toLowerCase()} ${cover.missingEquipment.length === 1 ? "is" : "are"} not installed — the cases that need ${cover.missingEquipment.length === 1 ? "it" : "them"} are referred out while you pay the upkeep.`,
      );
    }
    if (open && cover.covered < cover.needed) {
      caveats.push(
        `Nobody available takes severity above ${cover.covered}, and this field goes to ${cover.needed}. ${staffingNeed(sp.id)}.`,
      );
    }
    if (!open && identity.equipment.length > 0) {
      const short = identity.equipment.filter(
        (e) => !m.equipment.includes(e.id as never),
      );
      if (short.length > 0) {
        caveats.push(
          `Some of its work needs ${short.map((e) => e.label.toLowerCase()).join(", ")}, which you do not own yet. The department still opens; those cases keep being referred.`,
        );
      }
    }

    return {
      id: sp.id,
      kind: "department" as const,
      group: "departments" as const,
      label: sp.label,
      blurb: sp.blurb,
      art: purchaseArt(sp.id),
      price: sp.unlockCost,
      upkeep: sp.upkeep,
      headline: identity.purpose,
      effects: [
        {
          label: "Case types it takes",
          value: `${identity.cases.length}`,
          tone: "good" as const,
        },
        {
          label: "Hardest case",
          value: `severity ${identity.maxSeverity}`,
          tone: "neutral" as const,
        },
        {
          label: "Department slots",
          value: `1 of your ${max}`,
          tone: "cost" as const,
        },
        {
          label: "Upkeep",
          value: sp.upkeep > 0 ? `${money(sp.upkeep)}/wk` : "None",
          tone: sp.upkeep > 0 ? ("cost" as const) : ("neutral" as const),
        },
      ],
      caveats,
      lock,
      owned: open,
      /* An open department is in service by definition — there is no second
         copy of one to keep in reserve. */
      active: open,
      affordable,
      shortfall: Math.max(0, sp.unlockCost - state.r.cash),
      state: stateOf(lock, open, open, affordable),
      categoryWord: "Department",
      tradeIn: null,
      comparison: open
        ? null
        : {
            label: "Departments open",
            now: `${used}`,
            after: `${used + 1}`,
          },
      coverage: {
        level: cover.level,
        covered: cover.covered,
        needed: cover.needed,
        note: cover.note,
        missingEquipment: cover.missingEquipment,
        staffing:
          cover.staff.length > 0
            ? cover.staff.map((x) => x.name).join(", ")
            : staffingNeed(sp.id),
      },
      buy: { cmd: "openDepartment", arg: sp.id },
      sell: null,
      icon: identity.icon,
      accent: identity.colour,
    };
  });
}

/* -------------------------------------------------------------- equipment */

function equipmentItems(state: RunState): PurchaseItem[] {
  const m = med(state);
  const techs = m.staff.filter((s) => s.role === "technician").length;
  const short = techniciansNeeded(m) > techs;

  return EQUIPMENT.map((e) => {
    const owned = m.equipment.includes(e.id);
    const affordable = state.r.cash >= e.cost;
    return {
      id: e.id,
      kind: "equipment" as const,
      group: "equipment" as const,
      label: e.label,
      blurb: e.blurb,
      art: purchaseArt(e.id),
      price: e.cost,
      upkeep: e.upkeep,
      headline: `+${Math.round(e.qualityBonus * 100)}% chance a case that needs it goes well`,
      effects: [
        {
          label: "Outcome quality",
          value: `+${Math.round(e.qualityBonus * 100)}%`,
          tone: "good" as const,
        },
        {
          label: "Unlocks cases",
          value: casesNeeding(e.id),
          tone: "neutral" as const,
        },
        {
          label: "Upkeep",
          value: `${money(e.upkeep)}/wk`,
          tone: "cost" as const,
        },
        {
          label: "Staffing",
          value: e.needsTechnician ? "Needs a technician" : "Runs itself",
          tone: e.needsTechnician ? ("cost" as const) : ("good" as const),
        },
      ],
      caveats:
        e.needsTechnician && short && !owned
          ? [
              "You are already short of technicians. This machine would sit idle and still charge upkeep until somebody is hired to run it.",
            ]
          : e.needsTechnician
            ? ["One technician covers three machines. Past that, hire another."]
            : [],
      lock: null,
      owned,
      active: owned,
      affordable,
      shortfall: Math.max(0, e.cost - state.r.cash),
      state: stateOf(null, owned, false, affordable),
      categoryWord: e.needsTechnician ? "Staffed" : "Equipment",
      tradeIn: null,
      comparison: {
        label: "Machines installed",
        now: `${m.equipment.length}`,
        after: `${m.equipment.length + (owned ? 0 : 1)}`,
      },
      coverage: null,
      buy: { cmd: "buyEquipment", arg: e.id },
      sell: null,
      icon: EQUIPMENT_ICON[e.id] ?? "ecg",
      accent: null,
    };
  });
}

/**
 * The ambulances.
 *
 * The card has to carry the one thing that makes this group different from
 * equipment: a vehicle is bought and then *crewed*, and until it is crewed it
 * is doing nothing while charging upkeep. That is a caveat rather than a lock,
 * exactly as it is for an unstaffed scanner — the sale is allowed and the
 * consequence is stated.
 */
function fleetItems(state: RunState): PurchaseItem[] {
  const m = med(state);
  const crew = crewOn(m);
  const needed = crewNeeded(m);

  return FLEET.map((v) => {
    const owned = (m.fleet ?? []).includes(v.id);
    const affordable = state.r.cash >= v.cost;
    /* What the crew position would be once this one is on the road, which is
       the number a player is actually deciding against. */
    const neededAfter = needed + (owned ? 0 : v.crew);
    const shortAfter = Math.max(0, neededAfter - crew);

    const caveats: string[] = [];
    if (!owned && shortAfter > 0) {
      caveats.push(
        `Your fleet would need ${neededAfter} paramedic${neededAfter === 1 ? "" : "s"} and you have ${crew}. Until that is covered, none of your vehicles brings anyone in and all of them charge upkeep.`,
      );
    } else if (!owned) {
      caveats.push(
        `Needs ${v.crew} paramedic${v.crew === 1 ? "" : "s"} on the payroll. You have enough for this one.`,
      );
    } else if (needed > crew) {
      caveats.push(
        `Short ${needed - crew} paramedic${needed - crew === 1 ? "" : "s"}. The whole fleet is parked until that is fixed.`,
      );
    }
    if (v.acuity > 0) {
      caveats.push(
        "Brings in more serious work. That pays well if your departments can cover it, and costs you standing when it has to be turned away.",
      );
    }

    return {
      id: v.id,
      kind: "vehicle" as const,
      group: "fleet" as const,
      label: v.label,
      blurb: v.blurb,
      art: purchaseArt(v.id),
      price: v.cost,
      upkeep: v.upkeep,
      headline: `Reaches ${Math.round(v.reach * 100)}% more of the population around you`,
      effects: [
        {
          label: "Catchment",
          value: `+${Math.round(v.reach * 100)}%`,
          tone: "good" as const,
        },
        {
          label: "Case mix",
          value:
            v.acuity > 0
              ? `+${Math.round(v.acuity * 100)}% toward serious cases`
              : "Unchanged — routine patients",
          tone: v.acuity > 0 ? ("neutral" as const) : ("good" as const),
        },
        {
          label: "Crew",
          value: `${v.crew} paramedic${v.crew === 1 ? "" : "s"}`,
          tone: "cost" as const,
        },
        {
          label: "Upkeep",
          value: `${money(v.upkeep)}/wk`,
          tone: "cost" as const,
        },
        {
          label: "Net worth",
          value: `holds ${Math.round(v.retention * 100)}% of what you paid`,
          tone: "cost" as const,
        },
      ],
      caveats,
      lock: null,
      owned,
      active: owned,
      affordable,
      shortfall: Math.max(0, v.cost - state.r.cash),
      state: stateOf(null, owned, false, affordable),
      categoryWord: "Vehicle",
      tradeIn: null,
      comparison: {
        label: "Crew needed",
        now: `${needed}`,
        after: `${neededAfter}`,
      },
      coverage: null,
      buy: { cmd: "buyVehicle", arg: v.id },
      sell: null,
      icon: "ambulance" as MedIconName,
      accent: null,
    };
  });
}

/**
 * How many condition types this machine is a hard requirement for.
 *
 * Counted from `CONDITIONS`, so a machine's stated value is the number of
 * cases it actually unlocks rather than a claim about it.
 */
function casesNeeding(id: string): string {
  const n = CONDITION_GATES.get(id) ?? 0;
  return n === 0 ? "Quality only" : `${n} case type${n === 1 ? "" : "s"}`;
}

/* -------------------------------------------------------------- lifestyle */

function lifestyleItems(state: RunState): PurchaseItem[] {
  const m = med(state);

  return LIFESTYLE.map((l) => {
    const owned = m.lifestyle.includes(l.id);
    const affordable = state.r.cash >= l.cost;
    const replaced = supersedes(m, l)
      .map((id) => LIFESTYLE_BY_ID.get(id))
      .filter((x): x is NonNullable<typeof x> => !!x)[0];
    const loss = l.cost - l.cost * l.retention;

    const effects: Effect[] = [];
    if (l.restBonus)
      effects.push({
        label: "Rest blocks",
        value: `+${l.restBonus} burnout each`,
        tone: "good",
      });
    if (l.burnoutRelief)
      effects.push({
        label: "Every week",
        value: `−${l.burnoutRelief} burnout`,
        tone: "good",
      });
    if (l.timeBlocks)
      effects.push({
        label: "Your week",
        value: `+${l.timeBlocks} time block`,
        tone: "good",
      });
    if (l.status)
      effects.push({
        label: "Standing",
        value: `+${l.status} — better recruits`,
        tone: "good",
      });
    effects.push({
      label: "Upkeep",
      value: l.upkeep > 0 ? `${money(l.upkeep)}/wk` : "None",
      tone: l.upkeep > 0 ? "cost" : "neutral",
    });
    effects.push(
      l.retention >= 1
        ? {
            label: "Net worth",
            value: `holds ${Math.round(l.retention * 100)}% of what you paid`,
            tone: "good",
          }
        : {
            label: "Net worth",
            value: `${money(loss)} written off`,
            tone: "cost",
          },
    );

    return {
      id: l.id,
      kind: "lifestyle" as const,
      group: lifestyleGroup(l.category, l.retention),
      label: l.label,
      blurb: l.blurb,
      art: purchaseArt(l.id),
      price: l.cost,
      upkeep: l.upkeep,
      headline: headlineFor(l),
      effects,
      caveats:
        l.retention < 1 && l.cost >= 100_000
          ? [
              `Half the win condition is net worth. This one takes ${money(loss)} out of it the moment you buy it.`,
            ]
          : [],
      lock: null,
      owned,
      /* Homes and cars: you keep exactly one, so the owned one is the active
         one and the rest are alternatives. Everything else is simply owned. */
      active: owned,
      affordable,
      shortfall: Math.max(0, l.cost - state.r.cash),
      state: stateOf(
        null,
        owned,
        owned && (l.category === "home" || l.category === "car"),
        affordable,
      ),
      categoryWord: GROUP_META[lifestyleGroup(l.category, l.retention)].short,
      comparison: null,
      tradeIn: replaced
        ? {
            label: replaced.label,
            refund: Math.round(replaced.cost * replaced.retention),
          }
        : null,
      coverage: null,
      buy: { cmd: "buyLifestyle", arg: l.id },
      sell: owned
        ? {
            cmd: "sellLifestyle",
            arg: l.id,
            refund: Math.round(l.cost * l.retention),
          }
        : null,
      icon: LIFESTYLE_ICON[l.id] ?? "clinic",
      accent: null,
    };
  });
}

/**
 * Which display group a lifestyle item belongs in.
 *
 * Derived rather than listed: a perk with nothing to sell back is a service
 * you subscribe to, and a perk that retains value is an asset you own. That
 * distinction is already in the data as `retention === 0`, so the taxonomy the
 * brief asks for falls out of the model instead of being a second list to keep
 * in step with it.
 */
function lifestyleGroup(category: string, retention: number): PurchaseGroupId {
  if (category === "home") return "homes";
  if (category === "car") return "vehicles";
  if (category === "collectible") return "luxury";
  return retention === 0 ? "services" : "luxury";
}

function headlineFor(l: (typeof LIFESTYLE)[number]): string {
  if (l.timeBlocks) return `A seventh block of time, every week`;
  if (l.burnoutRelief && l.restBonus)
    return `−${l.burnoutRelief}/wk and +${l.restBonus} per rest block`;
  if (l.burnoutRelief) return `−${l.burnoutRelief} burnout every week`;
  if (l.restBonus) return `+${l.restBonus} burnout off every rest block`;
  if (l.retention >= 1) return `Appreciates — worth more each year`;
  return `+${l.status ?? 0} standing, and nothing else`;
}

/* ------------------------------------------------------------------ groups */

export const GROUP_META: Record<
  PurchaseGroupId,
  { label: string; note: string; icon: MedIconName; short: string }
> = {
  departments: {
    label: "Departments",
    note: "What you are able to treat at all. Each takes a department slot, charges upkeep forever, and refers its work out until it is staffed and equipped.",
    icon: "stethoscope",
    short: "Department",
  },
  facilities: {
    label: "Medical facilities",
    note: "Room to treat people in. Every one adds slots and department capacity, and charges upkeep forever.",
    icon: "clinic",
    short: "Premises",
  },
  fleet: {
    label: "Ambulances",
    note: "The only thing you can buy that changes who arrives rather than what you can do for them. Every vehicle needs a crew before it does anything at all.",
    icon: "ambulance",
    short: "Vehicle",
  },
  equipment: {
    label: "Clinical equipment",
    note: "What you are able to diagnose and treat. Some of it is useless without a technician to run it.",
    icon: "ecg",
    short: "Equipment",
  },
  homes: {
    label: "Homes and properties",
    note: "You keep one. Trading up refunds the old one at its retained value.",
    icon: "clinic",
    short: "Home",
  },
  vehicles: {
    label: "Vehicles",
    note: "You keep one. Every car on this list is worth substantially less than you paid for it.",
    icon: "globe",
    short: "Vehicle",
  },
  services: {
    label: "Services and wellbeing",
    note: "Subscriptions rather than assets — there is nothing to sell back, and they are the cheapest burnout relief there is.",
    icon: "patient",
    short: "Service",
  },
  luxury: {
    label: "Luxury and prestige",
    note: "Standing, and a hole in the net-worth target. Two of these are the only things here that gain value.",
    icon: "certificate",
    short: "Luxury",
  },
};

const GROUP_ORDER: PurchaseGroupId[] = [
  "facilities",
  "departments",
  "equipment",
  "fleet",
  "homes",
  "vehicles",
  "services",
  "luxury",
];

/** Every purchasable item in the game, in one list. */
export function allPurchases(state: RunState): PurchaseItem[] {
  if (state.careerId !== "doctor") return [];
  return [
    ...facilityItems(state),
    ...departmentItems(state),
    ...equipmentItems(state),
    ...fleetItems(state),
    ...lifestyleItems(state),
  ];
}

/** Grouped for display, cheapest first inside each group. */
export function purchaseGroups(
  state: RunState,
  only?: PurchaseGroupId[],
): PurchaseGroup[] {
  const items = allPurchases(state);
  return GROUP_ORDER.filter((g) => !only || only.includes(g))
    .map((id) => ({
      id,
      ...GROUP_META[id],
      items: items
        .filter((i) => i.group === id)
        .sort((a, b) => a.price - b.price),
    }))
    .filter((g) => g.items.length > 0);
}

/**
 * Why a purchase would fail right now, in the player's words, or null.
 *
 * The same three conditions the command itself checks, so a card that says a
 * purchase is possible cannot be wrong about it.
 */
export function purchaseBlocker(item: PurchaseItem): string | null {
  if (item.lock) return item.lock;
  if (item.owned && item.kind !== "facility") return "You already own this.";
  if (!item.affordable) return `You are ${money(item.price)} short.`;
  return null;
}

/* ----------------------------------------------------------------- lookups */

/** How many conditions each machine gates, counted once at module load. */
const CONDITION_GATES = (() => {
  const counts = new Map<string, number>();
  for (const e of EQUIPMENT) counts.set(e.id, 0);
  for (const c of CONDITIONS) {
    for (const e of c.equipment ?? []) {
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
  }
  return counts;
})();

const EQUIPMENT_ICON: Record<string, MedIconName> = {
  ecg: "ecg",
  lab: "flask",
  ultrasound: "scan",
  xray: "scan",
  pharmacy: "capsule",
  physio: "bone",
  endoscopy: "microscope",
  theatre: "scalpel",
  ct: "scan",
  dialysis: "pulse",
  icu: "bed",
  mri: "scan",
};

const LIFESTYLE_ICON: Record<string, MedIconName> = {
  townhouse: "clinic",
  suburban_house: "clinic",
  penthouse: "clinic",
  country_estate: "clinic",
  reliable_saloon: "globe",
  luxury_saloon: "globe",
  sports_car: "globe",
  gym: "pulse",
  housekeeper: "clipboard",
  trainer: "pulse",
  private_chef: "patient",
  chauffeur: "clock",
  holiday_home: "clinic",
  yacht: "globe",
  private_jet: "globe",
  watches: "clock",
  art: "certificate",
};

/** Facility lookup kept exported for the detail view's comparison. */
export const facilityOf = (id: string) => FACILITY_BY_ID.get(id as never);
export const equipmentOf = (id: string) => EQUIPMENT_BY_ID.get(id as never);
export const currentSlots = (state: RunState) => facilitySlots(med(state));
export const currentDeptSlots = (state: RunState) =>
  departmentSlots(med(state));
