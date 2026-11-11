import type { StartCity } from "../types";
import type { PhoneState } from "../medical/types";
import type { RunState } from "../types";

/**
 * THE WORKSHOP
 *
 * Everything the Engineer is made of. No React, no engine.
 *
 * ------------------------------------------------------- the binding constraint
 *
 * Defect risk. What you shipped is already wrong, and you do not know how
 * wrong yet.
 *
 * This is the only career in the game built on **hidden state**. Every other
 * one shows the player its numbers: a chef sees the larder, a founder sees
 * the runway, a politician sees the polling. An engineer cannot see the thing
 * that decides whether the run succeeds, because neither can an engineer.
 *
 *   - `latent` is the truth, and no screen ever prints it.
 *   - `estimateOf` is what the player is shown: a *range*, wide when nothing
 *     has been tested and narrow when a great deal has.
 *   - Testing does two different jobs at once — it removes faults, and it
 *     tells you more about how many are left. That is why it is never simply
 *     a delay.
 *
 * So the decision the whole career turns on is: ship now against an estimate
 * you do not trust, or spend another fortnight finding out. Revenue starts
 * the week you ship. So does the liability, and the liability arrives late.
 *
 * The second decision is the one nobody enjoys: when faults do start
 * surfacing, do you recall it yourself — expensive, controlled, and it keeps
 * some of your name — or hope the rest stay buried?
 */

/* ------------------------------------------------------------ where you are */

export interface WorkshopCity extends StudyCityShape {
  /** Multiplies what a shipped product earns. */
  revenueIndex: number;
  /** Weeks the certifier takes, whatever you think of that. */
  certWeeks: number;
  /**
   * How many latent faults the certifier will tolerate before refusing.
   * Lower is stricter.
   */
  certTolerance: number;
  /** What the workshop and its people cost, weekly. */
  overhead: number;
  /** How hard the market punishes a fault that reaches a customer. */
  scrutiny: number;
}

/** Local alias so the shape reads as a place rather than a config bag. */
type StudyCityShape = StartCity;

export const WORKSHOP_CITIES: WorkshopCity[] = [
  {
    id: "berlin",
    name: "Berlin",
    country: "Germany",
    position: "berlin",
    blurb:
      "A certification body that has read the standard more recently than you have.",
    effects: [
      "The strictest certifier on the board, and the slowest",
      "A certified product is worth more here than anywhere",
      "Faults that escape are treated as a scandal",
    ],
    difficulty: "even",
    revenueIndex: 1.15,
    certWeeks: 5,
    certTolerance: 3,
    overhead: 780,
    scrutiny: 1.25,
  },
  {
    id: "tokyo",
    name: "Tokyo",
    country: "Japan",
    position: "tokyo",
    blurb:
      "Customers who will forgive a late product and never a broken one.",
    effects: [
      "Good revenue and a demanding certifier",
      "The market is unforgiving about failures in the field",
      "An expensive workshop",
    ],
    difficulty: "hard",
    revenueIndex: 1.2,
    certWeeks: 4,
    certTolerance: 4,
    overhead: 900,
    scrutiny: 1.45,
  },
  {
    id: "singapore",
    name: "Singapore",
    country: "Singapore",
    position: "singapore",
    blurb:
      "The fastest route from a drawing to a shipping container anywhere.",
    effects: [
      "Certification is quick and comparatively relaxed",
      "You can be selling months before anybody else",
      "Which means shipping faults months earlier too",
    ],
    difficulty: "gentle",
    revenueIndex: 1.0,
    certWeeks: 2,
    certTolerance: 8,
    overhead: 640,
    scrutiny: 0.9,
  },
  {
    id: "saopaulo",
    name: "São Paulo",
    country: "Brazil",
    position: "saopaulo",
    blurb:
      "Cheap to build in, a long way from anybody who signs certificates.",
    effects: [
      "The cheapest workshop by a distance",
      "The certifier is slow and you are at the back of the queue",
      "Lower revenue — the market pays less",
    ],
    difficulty: "even",
    revenueIndex: 0.82,
    certWeeks: 6,
    certTolerance: 6,
    overhead: 380,
    scrutiny: 1.0,
  },
];

export const WORKSHOP_CITY_BY_ID = new Map(
  WORKSHOP_CITIES.map((c) => [c.id, c]),
);

export const workshopCityOf = (w: WorkshopState): WorkshopCity =>
  WORKSHOP_CITY_BY_ID.get(w.city) ?? WORKSHOP_CITIES[0];

/* -------------------------------------------------------------- the products */

export interface ProductKind {
  id: string;
  label: string;
  blurb: string;
  /** Weeks of design at one bench. */
  designWeeks: number;
  /**
   * Latent faults introduced per week of design. The whole difficulty curve
   * of the career is this one number.
   */
  complexity: number;
  /** Weekly revenue at full market, before the city index. */
  revenue: number;
  /** Cost to put it through certification. */
  certCost: number;
  /** Craft needed before you can attempt it at all. */
  needsSkill: number;
  /** What one fault reaching a customer costs, before the city's scrutiny. */
  faultCost: number;
}

export const PRODUCT_KINDS: ProductKind[] = [
  {
    id: "bracket",
    label: "A mounting bracket",
    blurb:
      "Three bends and a hole. It is not exciting and it will not kill anybody.",
    designWeeks: 3,
    complexity: 0.7,
    revenue: 900,
    certCost: 1_200,
    needsSkill: 0,
    faultCost: 600,
  },
  {
    id: "sensor",
    label: "A flow sensor",
    blurb: "Sits in a pipe and tells the truth about what is going past.",
    designWeeks: 6,
    complexity: 1.4,
    revenue: 2_600,
    certCost: 4_500,
    needsSkill: 25,
    faultCost: 2_200,
  },
  {
    id: "controller",
    label: "A motor controller",
    blurb:
      "Firmware, power electronics, and heat. All three ways to be wrong at once.",
    designWeeks: 9,
    complexity: 2.3,
    revenue: 6_400,
    certCost: 12_000,
    needsSkill: 42,
    faultCost: 5_800,
  },
  {
    id: "pump",
    label: "A surgical pump",
    blurb:
      "Regulated, audited, and the only product here where a fault is a person.",
    designWeeks: 13,
    complexity: 3.1,
    revenue: 15_500,
    certCost: 38_000,
    needsSkill: 60,
    faultCost: 22_000,
  },
];

export const PRODUCT_BY_ID = new Map(PRODUCT_KINDS.map((k) => [k.id, k]));

export type ProductStage =
  | "design"
  | "testing"
  | "certifying"
  | "shipped"
  | "withdrawn";

export interface Product {
  id: string;
  kind: string;
  name: string;
  stage: ProductStage;
  /** Weeks of design done. */
  design: number;
  /** Weeks of testing done. Narrows the estimate and removes faults. */
  tested: number;
  /**
   * THE HIDDEN NUMBER.
   *
   * How many faults are actually in it. Never rendered anywhere — the UI is
   * only ever allowed `estimateOf`. If this appears on a screen the career
   * has lost its point.
   */
  latent: number;
  /** Faults that have reached a customer and been reported. */
  surfaced: number;
  /** The week certification was submitted, so the wait can be counted. */
  submittedWeek?: number;
  shippedWeek?: number;
  /** How much of the market it has reached. Grows while shipped. */
  reach: number;
  recalls: number;
  /*
   * PHASE 5, ALL OPTIONAL: a product from an older save carries none of
   * these and designs, tests, ships and fails exactly as it always did.
   */
  /** The requirements envelope, negotiated once while designing. */
  spec?: SpecLevel;
  /** How the thing is put together. Decided once, while designing. */
  architecture?: ArchitectureId;
  /** Whether a prototype round has been built. Once per product. */
  prototyped?: boolean;
}

export type SpecLevel = "lean" | "standard" | "hardened";

/**
 * REQUIREMENTS ARE A NEGOTIATION, NOT A GIVEN
 *
 * What the product must survive is agreed before it exists: cut the
 * requirements and it designs faster and sells cheaper — and everything the
 * spec no longer covers is a fault waiting at a customer. Harden them and
 * the design drags, the price rises, and far less is in there to surface.
 * Standard is the default and exactly the product this career always built.
 */
export const SPECS: Record<
  SpecLevel,
  { label: string; blurb: string; design: number; revenue: number; seed: number }
> = {
  lean: {
    label: "Lean spec",
    blurb: "Only what the launch needs. Faster, cheaper, and it finds out at customers.",
    design: 0.8,
    revenue: 0.9,
    seed: 1.45,
  },
  standard: {
    label: "Standard",
    blurb: "The envelope the market expects. Nothing traded either way.",
    design: 1,
    revenue: 1,
    seed: 1,
  },
  hardened: {
    label: "Hardened",
    blurb: "Margins on the margins. Slower to draw, dearer to buy, quieter in the field.",
    design: 1.25,
    revenue: 1.1,
    seed: 0.68,
  },
};

export type ArchitectureId = "integrated" | "modular";

/**
 * THE ARCHITECTURE DECISION, MADE ONCE AND LIVED WITH
 *
 * Integrated is elegant and compact — it designs faster and commands a
 * premium, and when it fails the whole unit comes back. Modular takes
 * longer to draw and every fault is a swappable module: cheaper in the
 * field, faster on the test rig. Undecided is identity: the old product.
 */
export const ARCHITECTURES: Record<
  ArchitectureId,
  {
    label: string;
    blurb: string;
    design: number;
    revenue: number;
    fault: number;
    testYield: number;
  }
> = {
  integrated: {
    label: "Integrated",
    blurb: "One elegant unit. Premium price, and the whole thing comes back when it fails.",
    design: 0.9,
    revenue: 1.08,
    fault: 1.3,
    testYield: 1,
  },
  modular: {
    label: "Modular",
    blurb: "Swappable everything. Slower to draw, cheap to fix, quick on the rig.",
    design: 1.15,
    revenue: 1,
    fault: 0.6,
    testYield: 1.25,
  },
};

export const specOf = (p: Product) => SPECS[p.spec ?? "standard"];
export const archOf = (p: Product) =>
  p.architecture
    ? ARCHITECTURES[p.architecture]
    : { design: 1, revenue: 1, fault: 1, testYield: 1 };

/* ------------------------------------------------------------ the lab */

export interface RigDef {
  id: string;
  label: string;
  blurb: string;
  cost: number;
}

/**
 * Laboratory equipment: bought once, owned forever, and every product on
 * the bench benefits. The thermal chamber makes each test week remove
 * more; the shaker table makes each one *tell* you more.
 */
export const RIGS: RigDef[] = [
  {
    id: "thermal",
    label: "Thermal chamber",
    blurb: "Bake it, freeze it, find what lets go. Testing removes a fifth more.",
    cost: 9_000,
  },
  {
    id: "shaker",
    label: "Shaker table",
    blurb: "A week on the table is a year on the road. Confidence comes faster.",
    cost: 14_000,
  },
];

export const RIG_BY_ID = new Map(RIGS.map((r) => [r.id, r]));

export const rigsOf = (w: WorkshopState): string[] => w.rigs ?? [];
export const hasRig = (w: WorkshopState, id: string): boolean =>
  rigsOf(w).includes(id);

export const rigCost = (w: WorkshopState, rig: RigDef): number =>
  Math.round(rig.cost * workshopCityOf(w).revenueIndex);

/* ------------------------------------------------------- the disciplines */

export interface BenchRole {
  id: string;
  label: string;
  blurb: string;
  /** Weekly, before the city's index. */
  salary: number;
  /** Weeks of design added to the focused product, weekly. */
  design: number;
  /** Weeks of testing added to the focused product, weekly. */
  test: number;
  /** Extra market reach for every shipped product, weekly. */
  reach: number;
}

/**
 * The four disciplines a real product needs. Each hire does one thing to
 * the week, passively — the bench is still yours to point.
 */
export const BENCH_ROLES: BenchRole[] = [
  {
    id: "mechanical",
    label: "Mechanical engineer",
    blurb: "Housings, mounts, and everything that moves or must not.",
    salary: 980,
    design: 0.5,
    test: 0,
    reach: 0,
  },
  {
    id: "electrical",
    label: "Electrical engineer",
    blurb: "Boards, power and the faults that only show under load.",
    salary: 950,
    design: 0,
    test: 0.4,
    reach: 0,
  },
  {
    id: "software",
    label: "Software engineer",
    blurb: "Firmware. Half the design, half the testing, all of the updates.",
    salary: 990,
    design: 0.25,
    test: 0.2,
    reach: 0,
  },
  {
    id: "manufacturing",
    label: "Manufacturing engineer",
    blurb: "Yield, tooling and shipping in volume. Reach grows on its own.",
    salary: 920,
    design: 0,
    test: 0,
    reach: 0.025,
  },
];

export const BENCH_ROLE_BY_ID = new Map(BENCH_ROLES.map((r) => [r.id, r]));

export interface BenchHire {
  id: string;
  name: string;
  role: string;
  salary: number;
  since: number;
}

export const benchOf = (w: WorkshopState): BenchHire[] => w.team ?? [];

export const benchWages = (w: WorkshopState): number =>
  benchOf(w).reduce((n, h) => n + h.salary, 0);

export const benchSalary = (w: WorkshopState, role: BenchRole): number =>
  Math.round(role.salary * workshopCityOf(w).revenueIndex);

export const benchOutput = (
  w: WorkshopState,
): { design: number; test: number; reach: number } =>
  benchOf(w).reduce(
    (acc, h) => {
      const role = BENCH_ROLE_BY_ID.get(h.role);
      if (!role) return acc;
      return {
        design: acc.design + role.design,
        test: acc.test + role.test,
        reach: acc.reach + role.reach,
      };
    },
    { design: 0, test: 0, reach: 0 },
  );

/** What a prototype round costs: a fraction of certification, since it is
    the same rigour pointed earlier. */
export const prototypeCost = (w: WorkshopState, kind: ProductKind): number =>
  Math.round(kind.certCost * 0.35 * workshopCityOf(w).revenueIndex);

export interface WorkshopState {
  /**
   * The handset. Optional so a save from before this career had one
   * still loads; it is created on first touch.
   */
  phone?: PhoneState;
  city: string;
  products: Product[];
  /** Which product the bench is pointed at. */
  focus?: string;
  nextId: number;
  /** Every fault that has ever reached a customer. The career's real score. */
  faultsInField: number;
  recalls: number;
  /** The lab: rigs bought once and owned forever. Optional — see above. */
  rigs?: string[];
  /** The disciplines on the payroll. Optional — see above. */
  team?: BenchHire[];
}

export function initialWorkshop(): WorkshopState {
  return {
    city: WORKSHOP_CITIES[0].id,
    products: [],
    nextId: 1,
    faultsInField: 0,
    recalls: 0,
  };
}

/* -------------------------------------------------------------- the numbers */

export const kindOf = (p: Product): ProductKind | undefined =>
  PRODUCT_BY_ID.get(p.kind);

/** Weeks of design this product needs before it can be tested. */
export const designNeeded = (kind: ProductKind): number => kind.designWeeks;

/** The same, for one product: the kind's weeks through the spec and the
    architecture. Identity for a product that never chose. */
export const designNeededFor = (p: Product, kind: ProductKind): number =>
  Math.max(1, Math.round(kind.designWeeks * specOf(p).design * archOf(p).design));

export const designProgress = (p: Product): number => {
  const kind = kindOf(p);
  return kind ? Math.min(1, p.design / designNeededFor(p, kind)) : 0;
};

/**
 * WHAT THE PLAYER IS ALLOWED TO KNOW.
 *
 * A range, not a number. With nothing tested the band is enormous and honest
 * about it; every week of testing narrows it and pulls it down. The truth
 * sits inside the band, so a player who ships at "2 to 5" is taking a real
 * and quantified risk rather than being lied to.
 *
 * The width is what testing is really buying. Removing faults is the obvious
 * half; knowing how many are left is the half that decides whether you ship.
 */
export function estimateOf(p: Product): { low: number; high: number } {
  const kind = kindOf(p);
  if (!kind) return { low: 0, high: 0 };
  /* Confidence runs 0 to 1 and needs real weeks to approach 1. */
  const confidence = 1 - Math.pow(0.72, p.tested);
  const width = (1 - confidence) * (kind.complexity * 6 + 4);
  return {
    low: Math.max(0, Math.round(p.latent - width * 0.55)),
    high: Math.round(p.latent + width),
  };
}

/** How sure the player is allowed to feel, as a percentage. */
export const confidenceOf = (p: Product): number =>
  Math.round((1 - Math.pow(0.72, p.tested)) * 100);

/** Faults a week of testing finds and removes. Diminishing, never zero. */
export function testYield(p: Product): number {
  const kind = kindOf(p);
  if (!kind) return 0;
  /* The easy faults go first. Late testing is slow and still worth it. */
  return Math.max(0.35, p.latent * 0.28) * (kind.complexity > 2 ? 0.85 : 1);
}

/** The same, on this workshop's bench: a modular product strips faster,
    and a thermal chamber strips a fifth more. Identity when neither. */
export const testYieldFor = (w: WorkshopState, p: Product): number =>
  testYield(p) * archOf(p).testYield * (hasRig(w, "thermal") ? 1.2 : 1);

/** Whether the certifier would pass it, given what is actually in there. */
export const wouldCertify = (
  w: WorkshopState,
  p: Product,
): boolean => p.latent <= workshopCityOf(w).certTolerance;

export const certWeeksFor = (w: WorkshopState): number =>
  workshopCityOf(w).certWeeks;

/** What one product earns this week, given how far it has spread. */
export function revenueOf(w: WorkshopState, p: Product): number {
  const kind = kindOf(p);
  if (!kind || p.stage !== "shipped") return 0;
  /* The spec's price band and the architecture's premium — both exactly
     one for a product that never chose. */
  return Math.round(
    kind.revenue *
      workshopCityOf(w).revenueIndex *
      Math.min(1, p.reach) *
      specOf(p).revenue *
      archOf(p).revenue,
  );
}

export const workshopRevenue = (w: WorkshopState): number =>
  w.products.reduce((n, p) => n + revenueOf(w, p), 0);

/**
 * The chance a latent fault surfaces this week.
 *
 * Proportional to how many are in there and to how many units are out in the
 * world, which is why a product that has been selling well for six months is
 * the most dangerous thing a workshop owns.
 */
export function surfaceChance(p: Product): number {
  if (p.stage !== "shipped") return 0;
  return Math.min(0.85, p.latent * 0.055 * (0.4 + p.reach));
}

/** What a surfaced fault costs, here. */
export function faultCost(w: WorkshopState, p: Product): number {
  const kind = kindOf(p);
  if (!kind) return 0;
  /* A modular failure is a module in the post; an integrated one is the
     whole unit back on the bench. */
  return Math.round(
    kind.faultCost * workshopCityOf(w).scrutiny * (0.5 + p.reach) * archOf(p).fault,
  );
}

/**
 * What pulling it yourself costs.
 *
 * Deliberately expensive, and deliberately cheaper than letting a bad product
 * keep going. A voluntary recall removes every latent fault, stops the
 * revenue, and costs a fraction of the reputation a run of field failures
 * would — because you were the one who said it.
 */
export function recallCost(w: WorkshopState, p: Product): number {
  const kind = kindOf(p);
  if (!kind) return 0;
  return Math.round(
    kind.faultCost *
      2.4 *
      (0.6 + p.reach) *
      workshopCityOf(w).scrutiny *
      archOf(p).fault,
  );
}

/** What a product may be asked to do next, in the player's words. */
export function nextStepFor(
  w: WorkshopState,
  p: Product,
): string {
  const kind = kindOf(p);
  if (!kind) return "";
  switch (p.stage) {
    case "design":
      return designProgress(p) >= 1
        ? "Designed. Test it, or send it to the certifier as it is."
        : "Still on the bench.";
    case "testing":
      return "Testing. Every week narrows the estimate and takes faults out.";
    case "certifying":
      return `With the certifier — ${certWeeksFor(w)} weeks in ${workshopCityOf(w).name}.`;
    case "shipped":
      return "Shipped, selling, and carrying whatever you left in it.";
    case "withdrawn":
      return "Withdrawn from sale.";
  }
}

export const liveProducts = (w: WorkshopState): Product[] =>
  w.products.filter((p) => p.stage !== "withdrawn");

export const shippedProducts = (w: WorkshopState): Product[] =>
  w.products.filter((p) => p.stage === "shipped");

/** Craft-gated: you cannot attempt a surgical pump in your first month. */
export const buildableKinds = (skill: number): ProductKind[] =>
  PRODUCT_KINDS.filter((k) => k.needsSkill <= skill);

const PRODUCT_NAMES = [
  "Kestrel", "Anvil", "Meridian", "Halcyon", "Tessellate", "Ferrite",
  "Lodestone", "Quillon", "Solenoid", "Verity", "Cadence", "Bastion",
];

export const productName = (n: number) => PRODUCT_NAMES[n % PRODUCT_NAMES.length];

/**
 * This career's slice of the run.
 *
 * It lives here rather than beside the CareerDef because it is about
 * the *state shape*, and because anything that needs it — the event
 * catalogue, the voice pack — would otherwise have to import the
 * career module and form an import cycle with it.
 */
export const workshop = (s: RunState): WorkshopState =>
  s.data.workshop as WorkshopState;
