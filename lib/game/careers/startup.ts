import type { StartCity } from "../types";
import type { PhoneState } from "../medical/types";
import type { RunState } from "../types";

/**
 * THE VENTURE
 *
 * Everything the Founder is made of, with no React and no engine in sight.
 * The career def in `founder.ts` is the only thing that reads it.
 *
 * ------------------------------------------------------- the binding constraint
 *
 * Runway. Not money — *weeks*.
 *
 * Every other career in this game is played against a number of pounds. This
 * one is played against a number of weeks, and the difference is the whole
 * career: a founder with $400,000 and $50,000 a week of burn is in far more
 * trouble than one with $60,000 and $4,000, and the scoreboard says so. Cash
 * is only ever interesting here as the numerator of a division.
 *
 * That produces the three decisions the run is actually about:
 *
 *   1. Everything you buy shortens the runway that pays for it. A hire adds
 *      capacity *and* burn, so a team that would finish the product in eight
 *      weeks can consume the ten weeks you had.
 *   2. Growth compounds, sales do not. Selling puts users on the board this
 *      week and is forgotten next week; brand keeps paying, slowly, forever.
 *      Under time pressure the wrong one is always the tempting one.
 *   3. Raising buys weeks with ownership, permanently. The exchange rate is
 *      set by traction you had to spend weeks building, and it is the only
 *      price in the game that can never be paid back.
 *
 * The win is `defaultAlive` — revenue covering burn, at which point runway
 * stops being finite and the career stops being a countdown. Everything here
 * exists to make that moment hard to reach and obvious when it arrives.
 */

/* ------------------------------------------------------------ where you are */

export interface StartupCity extends StartCity {
  /** What engineers cost here, against a base of 1. */
  salaryIndex: number;
  /** How much capital is in the air. Multiplies progress toward a round. */
  capital: number;
  /** How readily word travels. Multiplies organic growth. */
  reach: number;
  /** Desks, weekly. Small next to payroll, and never zero. */
  rent: number;
  /**
   * How many people in this market would ever pay for the product.
   *
   * The balance bots found what its absence meant: word of mouth is
   * proportional to the users you already have, and with no ceiling that is
   * an exponential — every city reached the goal, every seed, week after
   * week of five-per-cent compounding. Growth now slows as the market fills,
   * which is also simply true of markets.
   */
  market: number;
  /**
   * What it costs you to exist here for a week.
   *
   * Without this the career had no constraint at all for the first act: a
   * solo founder's only outgoing was a desk, which made the opening runway
   * sixty-one weeks and the tagline's "eleven weeks of savings" a lie. A
   * founder still has rent and food, and it is the largest line on the ledger
   * until the first hire — which is exactly the pressure the whole career is
   * supposed to be played under.
   */
  living: number;
}

/**
 * Four places to start, and none of them is strictly best.
 *
 * The expensive cities buy you capital and reach at a payroll that eats the
 * runway faster; the cheap ones give you months you have to spend without
 * help. This is the same trade the Chef's cities make, in the currency this
 * career is played in.
 */
export const STARTUP_CITIES: StartupCity[] = [
  {
    id: "newyork",
    name: "New York",
    country: "United States",
    position: "newyork",
    blurb:
      "Everyone here is doing what you are doing, which is the advantage and the problem.",
    effects: [
      "Money is easiest to raise here",
      "Engineers cost half again what they cost anywhere else",
      "Word travels fastest",
    ],
    difficulty: "hard",
    salaryIndex: 1.5,
    capital: 1.45,
    reach: 1.25,
    rent: 900,
    living: 4100,
    market: 6000,
  },
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    position: "london",
    blurb: "Serious money, and it asks serious questions before it moves.",
    effects: [
      "Capital is available but slower to commit",
      "Wages sit between the extremes",
      "A large market on the doorstep",
    ],
    difficulty: "even",
    salaryIndex: 1.15,
    capital: 1.1,
    reach: 1.05,
    rent: 650,
    living: 3200,
    market: 4500,
  },
  {
    id: "berlin",
    name: "Berlin",
    country: "Germany",
    position: "berlin",
    blurb: "Cheap enough to be wrong twice, which is usually how many times it takes.",
    effects: [
      "Payroll goes a long way — the most weeks per pound",
      "Raising takes noticeably longer",
      "You have to make your own noise",
    ],
    difficulty: "gentle",
    salaryIndex: 0.85,
    capital: 0.8,
    reach: 0.9,
    rent: 380,
    living: 2100,
    market: 3000,
  },
  {
    id: "mumbai",
    name: "Mumbai",
    country: "India",
    position: "mumbai",
    blurb:
      "The longest runway in the game, and the furthest from the people writing cheques.",
    effects: [
      "The cheapest team you can hire anywhere",
      "Investors are hardest to reach from here",
      "An enormous market, and everyone is already selling to it",
    ],
    difficulty: "even",
    salaryIndex: 0.6,
    capital: 0.62,
    reach: 1.0,
    rent: 240,
    living: 1150,
    market: 8000,
  },
];

export const STARTUP_CITY_BY_ID = new Map(
  STARTUP_CITIES.map((c) => [c.id, c]),
);

export const startupCityOf = (v: VentureState): StartupCity =>
  STARTUP_CITY_BY_ID.get(v.city) ?? STARTUP_CITIES[0];

/* ------------------------------------------------------------- who you hire */

export interface StartupRole {
  id: string;
  label: string;
  blurb: string;
  /** Weekly, before the city index. */
  salary: number;
  /** One-off, before the city index. */
  hireCost: number;
  /** Product points a week this person is worth. */
  build: number;
  /** Users a week this person brings in directly. */
  sell: number;
  /** Brand points a week. */
  market: number;
}

export const STARTUP_ROLES: StartupRole[] = [
  {
    id: "engineer",
    label: "Engineer",
    blurb: "Ships the thing. The only role that makes the product better.",
    salary: 2_600,
    hireCost: 3_000,
    build: 1.1,
    sell: 0,
    market: 0,
  },
  {
    id: "designer",
    label: "Designer",
    blurb:
      "Makes it make sense. Fewer people leave when they can work out what it does.",
    salary: 2_200,
    hireCost: 2_400,
    build: 0.7,
    sell: 0,
    market: 0.8,
  },
  {
    id: "seller",
    label: "Account executive",
    blurb:
      "Brings in customers one conversation at a time. None of it compounds.",
    salary: 2_000,
    hireCost: 2_200,
    build: 0,
    sell: 26,
    market: 0,
  },
  {
    id: "marketer",
    label: "Growth lead",
    blurb:
      "Builds the channel rather than the customer. Slow, then all at once.",
    salary: 2_300,
    hireCost: 2_600,
    build: 0,
    sell: 4,
    market: 3.2,
  },
  {
    id: "support",
    label: "Support lead",
    blurb:
      "Answers the people you already have, which is why they stay. Cuts churn directly.",
    salary: 1_700,
    hireCost: 1_800,
    build: 0.15,
    sell: 0,
    market: 0.6,
  },
];

export const STARTUP_ROLE_BY_ID = new Map(STARTUP_ROLES.map((r) => [r.id, r]));

export interface Hire {
  id: string;
  name: string;
  role: string;
  /** This city's money, fixed at the moment they signed. */
  salary: number;
  since: number;
}

/* --------------------------------------------------------------- the rounds */

export interface Round {
  id: string;
  label: string;
  blurb: string;
  /** Before the city's capital index. */
  amount: number;
  /** What a room will not even take a meeting without. */
  minUsers: number;
  minProduct: number;
  /** Percentage points of the company it costs, at ordinary traction. */
  dilution: number;
  /** Weeks of pitching, at ordinary traction, to close it. */
  effort: number;
}

/**
 * Three rounds, each a bigger bet on a bigger number.
 *
 * The bars are deliberately traction bars rather than time bars: you cannot
 * wait your way into a seed round, you have to be worth one. That is what
 * stops "raise" being a button you press whenever the runway is short — by
 * the time you need the money most, you are least able to raise it.
 */
export const ROUNDS: Round[] = [
  {
    id: "preseed",
    label: "Pre-seed",
    blurb:
      "Angels, mostly. They are buying you rather than the numbers, which is fortunate.",
    amount: 120_000,
    minUsers: 0,
    minProduct: 15,
    dilution: 10,
    effort: 3,
  },
  {
    id: "seed",
    label: "Seed",
    blurb:
      "A fund, a partner meeting, and a spreadsheet about your retention.",
    amount: 600_000,
    minUsers: 400,
    minProduct: 45,
    dilution: 18,
    effort: 5,
  },
  {
    id: "seriesa",
    label: "Series A",
    blurb:
      "They are not buying the idea any more. They are buying the growth rate.",
    amount: 2_400_000,
    minUsers: 2_500,
    minProduct: 65,
    dilution: 22,
    effort: 7,
  },
];

export const ROUND_BY_ID = new Map(ROUNDS.map((r) => [r.id, r]));

/* ------------------------------------------------------------- the venture */

export interface WeekResult {
  week: number;
  gained: number;
  churned: number;
  revenue: number;
  burn: number;
  runway: number;
  alive: boolean;
  lines: string[];
}

export interface VentureState {
  /**
   * The handset. Optional so a save from before this career had one
   * still loads; it is created on first touch.
   */
  phone?: PhoneState;
  city: string;
  /** Paying customers. The only number investors actually look at. */
  users: number;
  /** Monthly, per user, in this city's money. */
  price: number;
  /** 0-100. Drives conversion and, more importantly, retention. */
  product: number;
  /** 0-100. A decaying stock of attention that produces organic growth. */
  brand: number;
  team: Hire[];
  /** Percentage of the company still yours. */
  equity: number;
  raised: number;
  roundsClosed: string[];
  /** 0-100 toward the round being pitched, or 0 when not raising. */
  pitch: number;
  pitchRound?: string;
  nextId: number;
  lastWeek?: WeekResult;
  /*
   * PHASE 5, ALL OPTIONAL: a save written before the product work still
   * loads, and absence means "never engaged", which costs nothing.
   */
  /** 0-100. What you actually know about the people you are building for. */
  insight?: number;
  /** 0-100. The corners cut to ship faster, compounding against you. */
  techDebt?: number;
  /** The roadmap's current answer to "fast, or right?". Absent = steady. */
  stance?: RoadmapStance;
  /** Experiments finished, with the lift each one measured. */
  experiments?: CompletedExperiment[];
  /** The one experiment in flight, if any. */
  experimentRun?: { id: string; started: number };
}

export type RoadmapStance = "ship" | "steady" | "stability";

/**
 * THE ROADMAP AS ONE DECISION, HELD RATHER THAN CLICKED
 *
 * "Fast, or right?" is the product conversation every real venture has
 * weekly, and it is a *stance*, not a button: the cost of shipping fast is
 * invisible the week you choose it and undeniable a quarter later. Ship
 * multiplies everything built — yours and the team's — and quietly accrues
 * technical debt; stability builds almost nothing and pays the debt down.
 * Steady is the default and deliberately neutral, so a founder who never
 * opens the roadmap plays exactly the venture this career always was.
 */
export const STANCES: Record<
  RoadmapStance,
  { label: string; blurb: string; buildMult: number; debtPerWeek: number }
> = {
  ship: {
    label: "Ship fast",
    blurb: "Everything builds a third faster, and the corners you cut stay cut.",
    buildMult: 1.3,
    debtPerWeek: 2.4,
  },
  steady: {
    label: "Steady",
    blurb: "Build at the pace the code can carry. Nothing accrues, nothing heals.",
    buildMult: 1,
    debtPerWeek: 0,
  },
  stability: {
    label: "Stability",
    blurb: "Refactor weeks. Little ships, and the debt comes down.",
    buildMult: 0.45,
    debtPerWeek: -3.5,
  },
};

export const insightOf = (v: VentureState): number => v.insight ?? 0;
export const techDebtOf = (v: VentureState): number => v.techDebt ?? 0;
export const stanceOf = (v: VentureState): RoadmapStance => v.stance ?? "steady";
export const experimentsOf = (v: VentureState): CompletedExperiment[] =>
  v.experiments ?? [];

/**
 * What building is worth this week, per block, yours and the team's alike:
 * the roadmap's pace times how well you know what to build. Insight is a
 * bonus and never a tax — at zero it multiplies by exactly one, so a founder
 * who never interviews builds precisely what they always built.
 */
export const buildLiftOf = (v: VentureState): number =>
  STANCES[stanceOf(v)].buildMult * (1 + insightOf(v) * 0.003);

export interface CompletedExperiment {
  id: string;
  week: number;
  /** The measured relative lift on its funnel stage, e.g. 0.11 for +11%. */
  lift: number;
}

export interface ExperimentDef {
  id: string;
  label: string;
  blurb: string;
  /** Which stage of the funnel the result multiplies. */
  stage: "visitors" | "trials" | "paying";
  /** In Lyon money; charged at this city's salary index. */
  baseCost: number;
  /** The lift a well-informed venture can expect, before variance. */
  baseLift: number;
}

/**
 * ACQUISITION EXPERIMENTS, RUN ONCE AND MEASURED
 *
 * Each is a real project with a real bill, two weeks of waiting, and a
 * result that is *measured*, not promised: what you know about your
 * customers (insight) is most of whether the test finds anything. The lift
 * is permanent — a rebuilt onboarding stays rebuilt — which is why each can
 * run only once: the second landing-page rewrite is a redesign, not an
 * experiment.
 */
export const EXPERIMENTS: ExperimentDef[] = [
  {
    id: "landing",
    label: "Landing page test",
    blurb: "Say what the product does, in the words customers used.",
    stage: "visitors",
    baseCost: 2_500,
    baseLift: 0.12,
  },
  {
    id: "onboarding",
    label: "Onboarding rework",
    blurb: "Walk the first hour of the product like a stranger would.",
    stage: "trials",
    baseCost: 4_000,
    baseLift: 0.14,
  },
  {
    id: "referral",
    label: "Referral programme",
    blurb: "Give the people who stay a reason to say so.",
    stage: "paying",
    baseCost: 6_000,
    baseLift: 0.1,
  },
];

export const EXPERIMENT_BY_ID = new Map(EXPERIMENTS.map((e) => [e.id, e]));

export const experimentCost = (v: VentureState, e: ExperimentDef): number =>
  Math.round(e.baseCost * startupCityOf(v).salaryIndex);

export function initialVenture(): VentureState {
  return {
    city: STARTUP_CITIES[0].id,
    users: 0,
    price: 24,
    product: 8,
    brand: 4,
    team: [],
    equity: 100,
    raised: 0,
    roundsClosed: [],
    pitch: 0,
    nextId: 1,
  };
}

/* ------------------------------------------------------------- the numbers */

const cityIndex = (v: VentureState) => startupCityOf(v).salaryIndex;

/** What a role costs here, this week. */
export const rolePrice = (
  v: VentureState,
  role: StartupRole,
): { salary: number; hireCost: number } => ({
  salary: Math.round(role.salary * cityIndex(v)),
  hireCost: Math.round(role.hireCost * cityIndex(v)),
});

export const payroll = (v: VentureState): number =>
  v.team.reduce((n, h) => n + h.salary, 0);

/**
 * What it costs to exist for a week.
 *
 * Payroll, desks, and the servers — which scale with users, so growth is not
 * free even before anybody is paid to look after it.
 */
export const burnOf = (v: VentureState): number => {
  const city = startupCityOf(v);
  return (
    payroll(v) + city.rent + city.living + Math.round(v.users * 0.35)
  );
};

/** Monthly prices, weekly ledger: the division is the whole conversion. */
export const revenueOf = (v: VentureState): number =>
  Math.round((v.users * v.price) / 4.33);

export const netBurnOf = (v: VentureState): number =>
  burnOf(v) - revenueOf(v);

/**
 * Default alive: the moment the career stops being a countdown.
 *
 * Stated as its own function because it is the objective, the scoreboard's
 * headline, and the thing three different screens have to agree about.
 */
export const defaultAlive = (v: VentureState): boolean =>
  revenueOf(v) >= burnOf(v);

/**
 * Weeks left at the current rate. `Infinity` once you are default alive.
 *
 * Callers must handle the infinite case rather than being handed a large
 * number, because "you are not dying any more" is a different sentence from
 * "you have 400 weeks", and the UI says so.
 */
export const runwayOf = (cash: number, v: VentureState): number => {
  const net = netBurnOf(v);
  if (net <= 0) return Infinity;
  return Math.max(0, cash / net);
};

/**
 * How fast you lose people, weekly.
 *
 * Falls from 9% to 3% as the product improves, and support staff take a
 * further bite. This is the quiet reason building beats selling in the long
 * run: churn is a percentage, so it scales with everything you have won.
 */
export const churnRate = (v: VentureState): number => {
  const fromProduct = 0.09 - (Math.min(100, v.product) / 100) * 0.06;
  const fromSupport = v.team.reduce(
    (n, h) => n + (h.role === "support" ? 0.006 : 0),
    0,
  );
  /*
   * Price pressure. Without this, raising the price was a strict upgrade:
   * an 18% rise shed 10% of users once, the freed market headroom grew them
   * back, and the balance bots ratcheted price 65% above base by week 100.
   * A product priced above what this market considers normal now loses
   * people every week it stays there — price becomes an equilibrium you
   * choose, not a lever you crank.
   */
  const city = startupCityOf(v);
  const base = Math.round(24 * (0.8 + city.salaryIndex * 0.25));
  const fromPrice = Math.max(0, v.price / base - 1) * 0.025;
  /* Cut corners surface as bugs, and bugs surface as cancellations. Zero
     debt costs exactly nothing, which keeps an old save's economy intact. */
  const fromDebt = (techDebtOf(v) / 100) * 0.02;
  return Math.max(0.012, fromProduct - fromSupport + fromPrice + fromDebt);
};

/**
 * THE ACQUISITION FUNNEL
 *
 * The same growth the career always had, finally shown as the pipeline it
 * is: people who *looked*, people who *tried*, people who *paid*. The totals
 * are calibrated so that a venture with no insight and no experiments gains
 * exactly what the old one-line formula produced — the funnel is a lens on
 * the existing economy, plus the two levers the product work adds:
 *
 *   - insight lifts the paying rate (you built what they asked for)
 *   - each finished experiment permanently lifts its own stage
 *
 * Visitors remain proportional to brand *and* existing users — word of
 * mouth needs a mouth — and to the room left in this market.
 */
const TRIAL_BASE = 0.52;
const BUY_BASE = 0.24;

export function funnelOf(v: VentureState): {
  visitors: number;
  trialRate: number;
  buyRate: number;
  trials: number;
  gained: number;
} {
  const city = startupCityOf(v);
  const headroom = Math.max(0, 1 - v.users / city.market);
  const reached =
    ((v.brand / 100) * 9 * city.reach +
      v.users * (v.brand / 100) * 0.05 * city.reach) *
    headroom;

  let visitorLift = 1;
  let trialLift = 1;
  let buyLift = 1 + insightOf(v) * 0.0015;
  for (const done of experimentsOf(v)) {
    const def = EXPERIMENT_BY_ID.get(done.id);
    if (!def) continue;
    if (def.stage === "visitors") visitorLift *= 1 + done.lift;
    if (def.stage === "trials") trialLift *= 1 + done.lift;
    if (def.stage === "paying") buyLift *= 1 + done.lift;
  }

  const visitors = (reached / (TRIAL_BASE * BUY_BASE)) * visitorLift;
  const trialRate = TRIAL_BASE * trialLift;
  const buyRate = BUY_BASE * buyLift;
  const trials = visitors * trialRate;
  return { visitors, trialRate, buyRate, trials, gained: trials * buyRate };
}

/** People who arrive because they heard, not because you asked — the bottom
    of the funnel, kept under its old name for every existing caller. */
export const organicUsers = (v: VentureState): number => funnelOf(v).gained;

/**
 * What one customer is worth against what keeping them costs — the unit
 * economics investors actually read. Margin is weekly price share minus the
 * infrastructure a user consumes (dearer as debt accrues); lifetime is the
 * reciprocal of churn.
 */
export function unitEconomicsOf(v: VentureState): {
  weeklyMargin: number;
  weeksRetained: number;
  lifetimeValue: number;
} {
  const weeklyPrice = v.price / 4.33;
  const infraPerUser = 0.35 * (1 + techDebtOf(v) / 250);
  const weeklyMargin = weeklyPrice - infraPerUser;
  const weeksRetained = 1 / churnRate(v);
  return {
    weeklyMargin,
    weeksRetained,
    lifetimeValue: weeklyMargin * weeksRetained,
  };
}

/** Brand is a stock, and stocks leak. Nothing you did last month still works. */
export const BRAND_DECAY = 0.06;

/** The team's weekly contribution, before anything you do yourself. */
export const teamOutput = (
  v: VentureState,
): { build: number; sell: number; market: number } =>
  v.team.reduce(
    (acc, h) => {
      const role = STARTUP_ROLE_BY_ID.get(h.role);
      if (!role) return acc;
      return {
        build: acc.build + role.build,
        sell: acc.sell + role.sell,
        market: acc.market + role.market,
      };
    },
    { build: 0, sell: 0, market: 0 },
  );

/* --------------------------------------------------------------- valuation */

/**
 * What the company is worth, and therefore what your share is worth.
 *
 * A revenue multiple with a floor, because a pre-revenue company is not worth
 * nothing — it is worth what somebody last paid for a slice of it. Using the
 * last round's implied price as that floor keeps the number honest: it is the
 * only real evidence of value a young venture has.
 */
export const valuationOf = (v: VentureState): number => {
  const annual = revenueOf(v) * 52;
  /*
   * A modest multiple, deliberately: 1.5x to 3x annual revenue as the
   * product matures. The old 4x-8x was VC paper, and against a goal shared
   * with careers that count hard assets it made the bots reach in every
   * city, every seed, by week 65 — the balance trace showed an $18M
   * "valuation" on four thousand customers. The implied-by-round floor
   * still gives a freshly funded company its post-money story; it just no
   * longer compounds into a win by itself.
   */
  const multiple = 1.5 + (Math.min(100, v.product) / 100) * 1.5;
  const fromRevenue = annual * multiple;
  const lastRound = v.roundsClosed.length
    ? (ROUND_BY_ID.get(v.roundsClosed[v.roundsClosed.length - 1])?.amount ?? 0)
    : 0;
  /* A round of $600k for 18% implies the whole thing was worth $3.3m. */
  const roundDef = v.roundsClosed.length
    ? ROUND_BY_ID.get(v.roundsClosed[v.roundsClosed.length - 1])
    : undefined;
  const impliedByRound =
    roundDef && roundDef.dilution > 0
      ? (lastRound / roundDef.dilution) * 100
      : 0;
  return Math.round(Math.max(fromRevenue, impliedByRound));
};

/** Your slice, in money. The Founder's net-worth equivalent. */
export const stakeOf = (v: VentureState): number =>
  Math.round((valuationOf(v) * v.equity) / 100);

/* ----------------------------------------------------------- raising money */

/**
 * Whether a room would take the meeting at all.
 *
 * Returns the reason it would not, so every screen can say it in the same
 * words rather than each inventing its own explanation of a locked button.
 */
export const roundBlocker = (
  v: VentureState,
  round: Round,
): string | null => {
  if (v.roundsClosed.includes(round.id)) return "Already raised.";
  const idx = ROUNDS.findIndex((r) => r.id === round.id);
  const previous = ROUNDS[idx - 1];
  if (previous && !v.roundsClosed.includes(previous.id)) {
    return `Nobody leads a ${round.label.toLowerCase()} before the ${previous.label.toLowerCase()}.`;
  }
  if (v.users < round.minUsers) {
    return `They want ${round.minUsers.toLocaleString("en-US")} customers. You have ${Math.round(v.users).toLocaleString("en-US")}.`;
  }
  if (v.product < round.minProduct) {
    return `The product is not far enough along — they look for ${round.minProduct}, you are at ${Math.round(v.product)}.`;
  }
  return null;
};

/**
 * How much traction improves the terms.
 *
 * Growing fast and retaining well makes a round cheaper in ownership; the
 * reverse makes it dearer. Bounded hard on both sides so a good quarter never
 * makes money free and a bad one never takes the company.
 */
export const dilutionFor = (v: VentureState, round: Round): number => {
  const growth = v.lastWeek
    ? v.lastWeek.gained / Math.max(1, v.users)
    : 0;
  const retention = 1 - churnRate(v) * 10;
  const strength = Math.max(-1, Math.min(1, growth * 8 + retention - 0.55));
  /* Up to a third off the ask, or half again on top of it. */
  const factor = 1 - strength * (strength > 0 ? 0.33 : 0.5);
  return Math.round(round.dilution * factor * 10) / 10;
};

/** Progress made per block of pitching, before the city's capital index. */
export const pitchPerBlock = (v: VentureState, round: Round): number => {
  const base = 100 / Math.max(1, round.effort);
  return base * startupCityOf(v).capital;
};

/** What the round actually pays out here. */
export const roundAmount = (v: VentureState, round: Round): number =>
  Math.round(round.amount * (0.85 + startupCityOf(v).capital * 0.15));

/* ---------------------------------------------------------------- helpers */

export const teamCount = (v: VentureState, roleId: string): number =>
  v.team.filter((h) => h.role === roleId).length;

/** For the ledger and the panels: weeks, or the sentence that replaces them. */
export const runwayLabel = (cash: number, v: VentureState): string => {
  const weeks = runwayOf(cash, v);
  if (!Number.isFinite(weeks)) return "Default alive";
  if (weeks < 1) return "Under a week";
  return `${Math.floor(weeks)} week${Math.floor(weeks) === 1 ? "" : "s"}`;
};

/**
 * This career's slice of the run.
 *
 * It lives here rather than beside the CareerDef because it is about
 * the *state shape*, and because anything that needs it — the event
 * catalogue, the voice pack — would otherwise have to import the
 * career module and form an import cycle with it.
 */
export const venture = (s: RunState): VentureState =>
  s.data.venture as VentureState;
