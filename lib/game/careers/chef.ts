import type { CareerDef, LedgerLine, RunState } from "../types";
import type { SetbackKind } from "../setbacks";
import { money } from "../format";
import { pushLog } from "../engine";
import { validatePhone } from "../phone/validate";
import { makeRng } from "../rng";
/* Metric arithmetic only — nothing medical despite the path. */
import { applySocial } from "../medical/social";
import {
  CHEF_POST_BY_ID,
  canPostChefWeek,
  chefInitialPhone,
  chefPostContext,
  ensureChefPhone,
  generateChefWeek,
} from "./chefPhone";
import {
  KITCHEN_ROLES,
  PREMISES,
  PREMISES_BY_ID,
  PRODUCE,
  PRODUCE_BY_ID,
  ROLE_BY_ID,
  type KitchenState,
  type ServiceResult,
  brigadeCovers,
  clearSpoiled,
  craftOf,
  drawFromLarder,
  extraShelfLife,
  initialKitchen,
  larderCovers,
  larderValue,
  plateQuality,
  premisesOf,
  rent,
  reviewDelta,
  wages,
  BOOKING_POLICIES,
  POLICY_BY_ID,
  SUPPLIERS,
  SUPPLIER_BY_ID,
  delivered,
  lifeFrom,
  loyaltyOf,
  moraleOf,
  specialistBonus,
  priceFrom,
  standingWith,
  supplierBlocker,
  bindingOf,
  forecastFor,
  policyOf,
  KITCHEN_KIT,
  KITCHEN_CITIES,
  KITCHEN_CITY_BY_ID,
  KIT_BY_ID,
  cityOf,
  kitPrice,
  premisesPrice,
  rolePay,
  agencyFees,
  shortlistLive,
  SHORTLIST_SIZE,
  type Candidate,
  type KitchenRole,
  labourIndex,
  capitalIndex,
  localOf,
  skillOf,
  produceIndex,
  spendPerHead,
  kitSpend,
  kitUpkeep,
  kitValue,
  SERVICES,
  SERVICE_BY_ID,
  serviceBlocker,
  serviceOpen,
  type DishResult,
  type KitchenStaff,
  type ServiceLine,
  /* The dishes layer: named ingredients, the menu, and what a service does
     to both. See `recipes.ts` for why it sits on top of the crates. */
  activeMenu,
  bestSkillIn,
  clearSpoiledPantry,
  consumeForCovers,
  planDishes,
  ingredientPrice,
  knowsRecipe,
  knownRecipes,
  menuFactors,
  menuShortfalls,
  pantryValue,
  progressFor,
} from "./kitchen";
import {
  INGREDIENT_BY_ID,
  RECIPE_BY_ID,
  dishQuality,
  earnsSignature,
  recipeBlocker,
  recipeName,
} from "./recipes";
/* Phase 2: the night itself, and the people who work it. */
import {
  POLICY_NOTES,
  SERVICE_SHAPES,
  runService,
  type ServicePolicy,
  type ServiceReport,
} from "./service";
/* Phase 3: what the city thinks, who is in the room, and who else is cooking. */
import {
  MAX_STANDING_LOG,
  MAX_STANDING_TREND,
  STANDINGS,
  STANDING_BY_ID,
  applyStanding,
  seedStanding,
  standingOf,
  type StandingId,
} from "./standing";
import { sceneFor } from "./scene";
import {
  MAX_VERDICTS,
  CRITIC_BY_ID,
} from "./critics";
import { MAX_REVIEWS } from "./reviews";
import {
  MAX_COMPLAINTS,
  decayBuzz,
  RESPONSE_BY_ID,
  ensureBuzz,
  expectationOf,
  notePost,
  promotionOf,
  reachFactor,
  resolveComplaint,
  type ComplaintResponse,
} from "./buzz";
import { ensureRivals, STRATEGY_BY_ID } from "./competitors";
import { CHEF_EVENTS } from "./chefEvents";
/* Phase 4: the craft, the cellar, the guide and the work outside the kitchen. */
import {
  STAGE_BY_ID,
  TECHNIQUES,
  TECHNIQUE_BY_ID,
  applyStage,
  canLearn,
  chefRank,
  cannotHandle,
  knowsTechnique,
  practise,
  practiceFromService,
  rankIndex,
  stageBlocker,
  techniqueLift,
  techniqueSteadiness,
  techniqueUnlocks,
  techniqueWorth,
  techniqueYield,
} from "./craft";
import {
  WINE_BY_ID,
  casePrice,
  cellarDraw,
  cellarValue,
  pourForCovers,
  sellPrice,
  wineBlocker,
} from "./cellar";
import {
  MAX_GUIDE_RECORDS,
  guideDue,
  publishGuide,
  starDraw,
  starExpectation,
  starWorth,
  starsOf,
} from "./guide";
import {
  VENTURE_BY_ID,
  advanceVentures,
  ensureVentures,
  localRoyalties,
  ventureBlocker,
  ventureBlocks,
  ventureCost,
  ventureFee,
  venturesOf,
} from "./ventures";
import { resolveScene } from "./sceneWeek";
import {
  TRAINING_COST,
  TRAINING_GAIN,
  currentSkill,
  errorRateOf,
  experienceOf,
  fatigueOf,
  hasTrait,
  isResting,
  moraleAfter,
  onTonight,
  promotionFor,
  recover,
  TRAITS,
  TRAIT_BY_ID,
  stationLoads,
  trainingOf,
} from "./brigade";

/**
 * THE CHEF
 *
 * Same skyline, different climb. The Physician is gated on *capability* — you
 * cannot treat what you have no department for. The Chef is gated on
 * **spoilage**, and every screen in this career is ultimately about one
 * question: how much food should be in the building right now?
 *
 * The reason that is interesting rather than fiddly is that the answer moves
 * every week and is wrong in both directions. Under-order and you turn away
 * covers you will not get back. Over-order and you pay twice — once for the
 * bin, and again in the reviews, because stock is served oldest-first and the
 * room can taste it. See `kitchen.ts` for the model itself.
 *
 * --------------------------------------------------------------- the money
 *
 * Restaurants are a thin-margin, high-turnover business and the numbers say
 * so: rent and wages are charged every week whether you open or not, cash
 * clears the same night you serve, and the difference between the two is
 * where the career lives. There is no equivalent of the Physician's insurer —
 * nobody pays you in ninety days, which is the one thing that makes this
 * survivable at all.
 */

/** What one block of deliberate practice is worth. */
const PRACTICE_POINTS = 22;

const GOAL = 2_000_000;
/*
 * A market stall does not cost $80,000 to fit out, and charging that much
 * meant $152 a week of interest against a business clearing under $300 — the
 * simulation sat flat for 120 weeks and never reached the second room. The
 * loan is now what the equipment and the first month actually cost.
 */
const START_DEBT = 38_000;
const START_CASH = 7_500;

export const kitchen = (s: RunState) => s.data.kitchen as KitchenState;

/**
 * Which traits somebody arrives with.
 *
 * Derived from the same deterministic draw as their skill, never rolled, so a
 * replayed week hires the same person. A well-regarded kitchen sees fewer of
 * the difficult ones — not because the trait is rarer in the world, but
 * because people with options do not take a job in a kitchen nobody rates.
 */
function traitsForHire(draw: number, reputation: number): string[] {
  const good = TRAITS.filter((t) => t.good);
  const bad = TRAITS.filter((t) => !t.good);
  const out = [good[draw % good.length].id];
  /* A second trait about a third of the time, and it can be a bad one. */
  if (draw % 3 === 1) {
    const difficult = draw % 100 > 30 + reputation * 0.5;
    out.push(
      difficult
        ? bad[draw % bad.length].id
        : good[(draw + 3) % good.length].id,
    );
  }
  return [...new Set(out)];
}

/**
 * The person the agency would produce for `n`.
 *
 * Pulled out of the hire command so the shortlist and the hire agree by
 * construction: the candidate you were shown *is* the record that joins the
 * brigade, rather than a preview of a second roll. Deterministic, like
 * everything a command touches — the number comes from the run's own counter.
 */
function draftCandidate(
  k: KitchenState,
  role: KitchenRole,
  reputation: number,
  n: number,
): Candidate {
  const draw = ((n * 2654435761) >>> 0) % 100;
  /*
   * And on who *you* are.
   *
   * A reputation fills the dining room; a name fills the applications. Cooks
   * choose the kitchen they will learn the most in, which is why `chefRank` —
   * technique, stars and what you have built — is worth more here than the
   * room's standing with its customers.
   */
  const standing = rankIndex(k, reputation) * 4;
  return {
    id: `st-${n}`,
    name: staffName(n),
    role: role.id,
    salary: rolePay(k, role).salary,
    skill: Math.round(
      Math.max(
        20,
        Math.min(95, 32 + reputation * 0.35 + standing + (draw % 30) - 12),
      ),
    ),
    /* Roughly a third arrive better at one kind of night than another. */
    speciality:
      draw % 3 === 0 ? SERVICES[draw % SERVICES.length].id : undefined,
    traits: traitsForHire(draw, reputation),
  };
}

/** A drafted candidate, made real on the payroll. */
function joinBrigade(k: KitchenState, c: Candidate, week: number): void {
  k.staff.push({
    id: c.id,
    name: c.name,
    role: c.role,
    salary: c.salary,
    skill: c.skill,
    morale: 72,
    loyalty: 58,
    speciality: c.speciality,
    since: week,
    fatigue: 0,
    experience: 0,
    training: 0,
    traits: c.traits,
  });
}

const staffName = (n: number) => {
  const first = [
    "Marco", "Ines", "Tobias", "Nadia", "Ruben", "Halima", "Petra", "Ozan",
    "Cleo", "Bastien", "Yara", "Kwame",
  ];
  const last = [
    "Rossi", "Adeyinka", "Kaur", "Novak", "Bergström", "Haddad", "Okafor",
    "Lindqvist", "Moreau", "Silva",
  ];
  return `${first[n % first.length]} ${last[(n * 7) % last.length]}`;
};

/** Everything the business is worth: cash, the room, the brigade's kit, stock. */
export const kitchenWorth = (s: RunState): number => {
  const k = kitchen(s);
  const room = PREMISES_BY_ID.get(k.premises);
  return (
    s.r.cash +
    (room ? premisesPrice(k, room) : 0) * 0.8 +
    kitValue(k) +
    larderValue(k, s.week) +
    /* Stock is stock: the pantry counts at what it cost, minus whatever has
       gone over, exactly as the crates do. */
    pantryValue(k, s.week) +
    /*
     * And the cellar — at what a merchant would pay for it rather than at
     * what a diner would, which is the same 72% `sellWine` pays out.
     *
     * The one asset in this business that appreciates, and the only one whose
     * book value has to be discounted: you cannot realise a wine list at list
     * prices, and counting it at full maturity made a rack look like cash.
     */
    cellarValue(k, s.week) * 0.72 -
    s.r.debt
  );
};

/**
 * What the business has to be worth, here.
 *
 * The target is stated in the money of the city you chose, because the money
 * of the city is what you are paid in. A fixed two million would have made
 * Mumbai — where a cover is worth $12 — a longer grind rather than a different
 * problem, which is the one thing a city is not allowed to be in this game.
 */
export const goalFor = (s: RunState): number =>
  Math.round(GOAL * cityOf(kitchen(s)).spend);

/**
 * What leaves every week whether or not you unlock the door.
 *
 * Exported because the Money screen and the weekly briefing both state it, and
 * a second copy of `rent + wages + upkeep` in a component is a rule living in
 * React.
 */
export const weeklyOutgoings = (k: KitchenState): number =>
  rent(k) + wages(k) + kitUpkeep(k);

/**
 * A sum quoted in Lyon money, converted to the money of the city this run is
 * in.
 *
 * Everything else about a run is local — rent, produce, wages, takings, the
 * loan, the target — so a flat $4,500 demand from a supplier was three weeks
 * of takings in Mumbai and an afternoon's in Paris. Found by simulation: the
 * cheap cities were insolvent for the whole run and it was the events doing
 * it, not the trade.
 */
export const localSum = (s: RunState, amount: number): number =>
  localOf(kitchen(s), amount);

/** A multiplier as the player reads it: 1.65 is "165%". */
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** A week's interest on the fit-out loan. */
export const loanInterest = (debt: number): number =>
  debt > 0 ? Math.round(debt * 0.0019) : 0;

/** What `payLoan` would actually pay right now — never more than you have. */
export const loanPayment = (s: RunState): number =>
  Math.min(10_000, s.r.debt, Math.max(0, s.r.cash));

export const chef: CareerDef = {
  id: "chef",
  label: "Chef",
  tagline:
    "One rented kitchen, a supplier who wants cash up front, and produce that is worth less every hour.",
  distinctRule:
    "Your constraint is spoilage, not time. Stock decays weekly and is served oldest-first, so over-ordering costs you twice — once in the bin and again in the reviews.",
  icon: "knife",
  available: true,
  weekLimit: 156,

  /*
   * Six blocks, five when you are running on empty — and fewer while you are
   * doing something that is not cooking.
   *
   * A venture takes its blocks here rather than through a separate penalty,
   * because being somewhere else *is* the cost. A chef writing a book has two
   * fewer services in them every week for ten weeks, and the planner shows
   * exactly that. Never below one: there is always tomorrow's prep.
   */
  timeBudget: (s) => {
    const k = kitchen(s);
    const base = s.r.burnout > 78 ? 5 : 6;
    /* A week away in somebody else's kitchen is a week away. */
    const staging = (k.stagingUntil ?? 0) > s.week ? base - 1 : 0;
    return Math.max(1, base - ventureBlocks(k) - staging);
  },

  resources: [
    {
      id: "cash",
      label: "Cash",
      hint: "Takings clear the same night. Rent and wages do not wait.",
      format: "money",
      polarity: "higher-better",
      display: "stat",
    },
    {
      id: "debt",
      label: "Fit-out loan",
      hint: "What the kitchen cost before it had served anybody.",
      format: "money",
      polarity: "lower-better",
      display: "stat",
    },
    {
      id: "reputation",
      label: "Reviews",
      hint: "What people expect before they sit down. It sets your demand.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "higher-better",
      display: "meter",
    },
    {
      id: "skill",
      label: "Craft",
      hint: "Your own cooking. The one input nobody can take off you.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "higher-better",
      display: "meter",
    },
    {
      id: "burnout",
      label: "Burnout",
      hint: "Kitchens run hot. At 100 you stop, and the room stops with you.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "lower-better",
      display: "meter",
    },
    {
      id: "_lastRevenue",
      label: "Last week's takings",
      hint: "",
      format: "money",
      polarity: "neutral",
      display: "hidden",
    },
    {
      id: "_burnoutPeak",
      label: "",
      hint: "",
      format: "int",
      polarity: "neutral",
      display: "hidden",
    },
  ],

  actions: [
    /*
     * One action per service, generated from the catalogue so the two cannot
     * drift. `unlocked` hides the ones this kitchen cannot attempt — the
     * planner already filters on it, so a stall never sees a tasting menu it
     * has no chance of running.
     */
    ...SERVICES.map((sv) => ({
      id: sv.id,
      label: sv.label,
      blurb: sv.blurb,
      timeCost: 1,
      cashCost: 0,
      unlocked: (s: RunState) => serviceOpen(sv, kitchen(s), s.r.skill),
      preview: (s: RunState) => {
        const k = kitchen(s);
        const room = premisesOf(k);
        const seats = Math.round(room.capacity * sv.capacityShare);
        const spend = Math.round(spendPerHead(k) * sv.spend);
        return [
          `Up to ${seats} covers at about ${money(spend)} a head`,
          sv.booked
            ? "Covers agreed in advance — nothing turned away"
            : "Walk-in trade, so your standing decides who comes",
          sv.reviewWeight === 0
            ? "Nobody reviews it"
            : sv.reviewWeight > 1.5
              ? "Moves your reviews hard, both ways"
              : `+${sv.burnout} burnout`,
        ];
      },
    })),
    {
      id: "prep",
      label: "Prep",
      blurb:
        "Stocks, butchery, mise en place. It is what lets a small brigade put out a big service.",
      timeCost: 1,
      cashCost: 0,
      preview: () => [
        "+18% covers your brigade can plate this week",
        "Takes the edge off a rushed service",
      ],
    },
    {
      id: "develop",
      label: "Develop the menu",
      blurb: "Tasting, testing, throwing things away. This is how you get better.",
      timeCost: 1,
      cashCost: 150,
      preview: () => ["+1.4 craft", "Costs $150 in produce you will not sell"],
    },
    {
      /*
       * Deliberate practice.
       *
       * Which technique it goes into is a setting rather than a question
       * asked every week — `setPractice` on the craft screen chooses it, and
       * this block is what pays for it. Hidden until there is something to
       * practise, so a new chef is not shown a control that does nothing.
       */
      id: "practise",
      label: "Practise",
      blurb:
        "A morning on one thing, over and over, until your hands stop thinking about it.",
      timeCost: 1,
      cashCost: 220,
      unlocked: (s: RunState) => {
        const k = kitchen(s);
        return TECHNIQUES.some((t) => canLearn(k, t) && !knowsTechnique(k, t.id));
      },
      preview: (s: RunState) => {
        const k = kitchen(s);
        const t = k.practising ? TECHNIQUE_BY_ID.get(k.practising) : null;
        const held = t ? (k.techniques?.[t.id] ?? 0) : 0;
        return t
          ? [
              `${PRACTICE_POINTS} points towards ${t.label.toLowerCase()} — ${held} of ${t.cost}`,
              t.effect,
            ]
          : [
              `${PRACTICE_POINTS} points towards a technique`,
              "Choose which one on the craft screen first",
            ];
      },
    },
    {
      id: "room",
      label: "Work the room",
      blurb:
        "Out of the kitchen and into the dining room. People forgive a great deal from somebody who came to the table.",
      timeCost: 1,
      cashCost: 0,
      preview: () => ["+1.6 reviews", "Softens a bad week"],
    },
    {
      id: "rest",
      label: "Rest",
      blurb: "A day off. Rare, and the only thing that actually works.",
      timeCost: 1,
      cashCost: 0,
      preview: () => ["−9 burnout"],
    },
  ],

  events: [
    {
      id: "critic",
      title: "Somebody is reviewing you",
      body: () =>
        "Table six has photographed every plate and asked who the sous chef is. It will be online by Friday.",
      weight: () => 3,
      cooldown: 18,
      eligible: (s) => s.r.reputation > 18,
      tone: "neutral",
      choices: [
        {
          label: "Send out the best you have",
          detail: "Costs a luxury order's worth of produce",
          apply: (s) => {
            const q = 40 + s.r.skill * 0.4;
            s.r.cash -= localSum(s, 1_800);
            s.r.reputation += q > 55 ? 7 : 2;
            return q > 55
              ? "The review ran on Sunday and the phone has not stopped."
              : "The review was polite. Polite is not what you needed.";
          },
        },
        {
          label: "Cook the menu as written",
          detail: "No extra cost",
          apply: (s, rng) => {
            const good = rng.chance(0.42 + s.r.skill / 260);
            s.r.reputation += good ? 4 : -5;
            return good
              ? "They wrote that the kitchen is consistent. It is the best word there is."
              : "They wrote that it was fine. It is the worst word there is.";
          },
        },
      ],
    },
    {
      id: "supplier_squeeze",
      title: "Your supplier wants cash up front",
      body: () =>
        "The account is being pulled. From now on it is payment on delivery, unless you settle the balance today.",
      weight: () => 3,
      cooldown: 22,
      eligible: () => true,
      tone: "bad",
      choices: [
        {
          label: "Settle it",
          detail: "Settle the balance",
          affordable: (s) => s.r.cash >= localSum(s, 4_500),
          apply: (s) => {
            s.r.cash -= localSum(s, 4_500);
            return "Account kept. The van comes on Tuesday as it always has.";
          },
        },
        {
          label: "Let it go to cash on delivery",
          detail: "Produce costs 12% more for a while",
          apply: (s) => {
            s.r._supplierPenalty = (s.r._supplierPenalty ?? 0) + 14;
            return "You buy at the door now, and you buy at their price.";
          },
        },
      ],
    },
    {
      id: "walkout",
      title: "Your sous chef has had enough",
      body: () =>
        "Two hundred covers on Saturday and he has just taken his jacket off in the middle of service.",
      weight: () => 2,
      cooldown: 26,
      eligible: (s) => kitchen(s).staff.length > 1,
      tone: "bad",
      choices: [
        {
          label: "Give him the raise",
          detail: "Wages up permanently",
          apply: (s) => {
            const k = kitchen(s);
            const x = k.staff[0];
            if (x) x.salary = Math.round(x.salary * 1.2);
            return "He put the jacket back on. It cost you, and it was cheaper than Saturday.";
          },
        },
        {
          label: "Let him walk",
          detail: "You lose the hire and the week",
          apply: (s) => {
            const k = kitchen(s);
            k.staff = k.staff.slice(1);
            s.r.burnout += 9;
            return "You finished the service yourself. You have not done that in a long time.";
          },
        },
      ],
    },
    {
      id: "glut",
      title: "The market is flooded",
      body: () =>
        "Somebody's order fell through and there is more good produce on the market than anyone can move.",
      weight: () => 3,
      cooldown: 14,
      eligible: () => true,
      tone: "good",
      choices: [
        {
          label: "Fill the larder",
          detail: "A market crate at half price",
          affordable: (s) => s.r.cash >= localSum(s, 1_250),
          apply: (s) => {
            const k = kitchen(s);
            const p = PRODUCE_BY_ID.get("market")!;
            /* Half price *here* — a glut is a local market, not an import. */
            const paid = Math.round(p.cost * produceIndex(k) * 0.5);
            s.r.cash -= paid;
            k.larder.push({
              id: `lot-${k.nextId++}`,
              produce: "market",
              left: p.covers,
              unitCost: paid / p.covers,
              boughtWeek: s.week,
            });
            return "A crate of very good produce, at half what it is worth. It still spoils on schedule.";
          },
        },
        {
          label: "Buy only what you can turn",
          detail: "Nothing changes",
          apply: () =>
            "You walked past it. There is no prize for a full larder.",
        },
      ],
    },
    /*
     * Phase 3's twelve, kept in a file of their own because the four above
     * were written before this career had a supplier account, a pantry, a
     * brigade with names or a city full of rivals to attach anything to. See
     * `chefEvents.ts` for the rules they were written to.
     */
    ...CHEF_EVENTS,
  ],

  initialResources: () => ({
    cash: START_CASH,
    debt: START_DEBT,
    reputation: 12,
    skill: 34,
    burnout: 14,
    _lastRevenue: 0,
    _burnoutPeak: 0,
    _supplierPenalty: 0,
    _prep: 0,
  }),

  initialData: () => {
    const k = initialKitchen();
    k.phone = chefInitialPhone();
    /*
     * The seven standing categories start where the old single number did, so
     * a new run and a migrated one describe themselves the same way. The
     * rivals are deliberately *not* created here: the city is not chosen until
     * `applyStartCity`, and rivals are a property of the city.
     */
    k.standing = Object.fromEntries(STANDINGS.map((x) => [x.id, 12])) as Record<
      StandingId,
      number
    >;
    k.buzz = { interest: 1, expectation: 0, postWeeks: [], promoted: [], claims: [] };
    /* Phase 4 starts empty in every sense: no technique, no cellar, no stars,
       and nobody offering you a television series. */
    k.techniques = {};
    k.stages = [];
    k.cellar = [];
    k.stars = 0;
    k.guide = [];
    k.ventures = { active: null, done: [], royalties: 0 };
    return { kitchen: k };
  },

  /*
   * Six cities, and the card for each states the five things it moves. The
   * effects are generated from the table rather than written by hand, because
   * a hand-written card is how a city ends up promising a discount the
   * simulation does not give.
   */
  startCities: KITCHEN_CITIES.map((c) => ({
    id: c.id,
    name: c.name,
    country: c.country,
    position: c.position,
    blurb: c.blurb,
    effects: [
      `${pct(c.rent)} rent`,
      `${pct(c.spend)} a head`,
      `${pct(c.demand)} looking for a table`,
      `${pct(c.produce)} on every crate`,
      c.shelfLife === 0
        ? "Produce keeps as long as it keeps anywhere"
        : c.shelfLife > 0
          ? `Produce lasts ${c.shelfLife} week longer here`
          : `Produce dies ${-c.shelfLife} week sooner here`,
    ],
    difficulty: c.difficulty,
  })),

  applyStartCity: (s, cityId) => {
    const city = KITCHEN_CITY_BY_ID.get(cityId);
    if (!city) return;
    kitchen(s).city = cityId;
    /*
     * The opening balance sheet is in the money of the city.
     *
     * A fit-out is a local price: the same second-hand range and the same
     * three months' deposit cost what the room costs. Leaving the loan at a
     * flat $38,000 would have made a cheap city a gift and New York a
     * fortnight of solvency — the city would have been a difficulty dial
     * rather than a different problem. Both move together, so what you owe
     * against what you hold is the same ratio everywhere and the *trade* is
     * what differs.
     */
    /*
     * On the blend of what space costs and what a cover is worth, not on rent
     * alone — the same index the rooms and the equipment are priced against.
     *
     * A fit-out is a capital cost: a second-hand range, three months' deposit
     * and a builder. Scaling it by rent charged the city's property premium a
     * second time, on top of the rent itself, and left a London kitchen owing
     * $70,000 against a stall taking $2,000 a week. The harness found it: the
     * ambitious cities ended tens of thousands worse than the cheap ones for
     * no reason anybody had chosen.
     */
    const capital = capitalIndex(kitchen(s));
    s.r.debt = Math.round(START_DEBT * capital);
    s.r.cash = Math.round(START_CASH * capital);
    /* And who else is already cooking here. Deterministic from the city, so
       two runs that begin in Paris begin against the same three restaurants. */
    ensureRivals(kitchen(s), 1);
  },

  command: (s, cmd, arg) => {
    const k = kitchen(s);
    switch (cmd) {
      case "buyProduce": {
        /*
         * `supplier:grade`, falling back to the covered market when only a
         * grade is given — so an older save's command, and the first crate a
         * new player buys, both still work.
         */
        const [a, b] = arg.split(":");
        const sup = SUPPLIER_BY_ID.get(b ? a : "market");
        const p = PRODUCE_BY_ID.get(b ?? a);
        if (!sup || !p) return;
        if (supplierBlocker(sup, k, s.r.reputation, p)) return;

        const standing = standingWith(k, sup.id);
        const price = priceFrom(sup, p, standing, produceIndex(k));
        /* A minimum order is a minimum *spend*: one crate may not reach it. */
        if (price < sup.minimum) return;
        if (s.r.cash < price) return;

        s.r.cash -= price;

        /*
         * Ordering builds the account whether or not the van turns up — you
         * paid, and they know it. Standing is what buys the discount and most
         * of the way back to a reliable delivery.
         */
        k.suppliers = {
          ...(k.suppliers ?? {}),
          [sup.id]: Math.min(100, standing + 4),
        };

        /*
         * Whether the van turns up, decided now and deterministically — see
         * `delivered`. A failed delivery keeps the money and costs the
         * account, which is what makes an unreliable supplier a real risk
         * rather than a slightly worse price.
         */
        const orderNo = k.nextId++;
        if (!delivered(s.seed, orderNo, sup, standing)) {
          k.suppliers = {
            ...(k.suppliers ?? {}),
            [sup.id]: Math.max(0, standingWith(k, sup.id) - 6),
          };
          pushLog(
            s,
            `${sup.label} did not deliver. ${money(price)} paid and nothing on the bench.`,
            "bad",
          );
          break;
        }

        k.larder.push({
          id: `lot-${orderNo}`,
          produce: p.id,
          from: sup.id,
          life: lifeFrom(sup, p),
          left: p.covers,
          unitCost: price / p.covers,
          boughtWeek: s.week,
        });
        break;
      }
      case "post": {
        /*
         * The Pulse transaction, mirrored from the doctor's but running on
         * the chef catalogue. Every gate is re-checked here: the composer's
         * disabled state is a hint, not a rule.
         */
        const def = CHEF_POST_BY_ID.get(arg);
        if (!def) return;
        if (!canPostChefWeek(k, s.week)) return;
        const phone = ensureChefPhone(k);
        if (def.once && phone.postsMade.includes(def.id)) return;
        const ctx = chefPostContext(k, s.week);
        if (!def.available(ctx)) return;

        /* Publishing rolls on its own stream, like the doctor's. */
        const rng = makeRng((s.seed ^ (s.week * 0x2f6f2b79)) >>> 0);
        const misfired = def.hazard !== undefined && rng.chance(def.hazard);
        const outcome = misfired && def.backfire ? def.backfire.effect : def.effect;

        /*
         * How far it actually goes.
         *
         * Posting three weeks running reaches fewer people each time — not a
         * punishment, simply what an audience that has heard from you every
         * week does. Applied to the social half only; the promise you made is
         * a promise whether or not anybody was listening.
         */
        const carried = reachFactor(k, s.week);
        applySocial(phone.social, {
          ...outcome,
          followers: Math.round((outcome.followers ?? 0) * carried),
        });
        if (outcome.reputation) {
          applyStanding(
            s,
            "innovation",
            outcome.reputation,
            `Posted: ${def.label.toLowerCase()}`,
          );
        }

        /*
         * THE RESTAURANT-SIDE EFFECT.
         *
         * Interest fills the room next week; expectation raises the bar every
         * night after that; a promotion makes the room order one dish; a
         * claim is the promise the kitchen is now held to. This is where a
         * post stops being a diary entry.
         */
        const chefEffect = def.chef;
        if (chefEffect) {
          const promoted =
            chefEffect.promote === "signature"
              ? knownRecipes(k).find((p) => p.signature)?.id
              : chefEffect.promote === "newest"
                ? activeMenu(k)[activeMenu(k).length - 1]?.recipe
                : undefined;
          notePost(k, s.week, {
            interest: (chefEffect.interest ?? 0) * carried,
            expectation: chefEffect.expectation,
            promote: promoted,
            claim: chefEffect.claim,
          });
          if (chefEffect.morale) {
            for (const x of k.staff) {
              x.morale = Math.min(100, (x.morale ?? 70) + chefEffect.morale);
            }
          }
        } else {
          /* Even a post with no stated effect counts against the reach
             budget, which is the whole point of counting posts. */
          notePost(k, s.week, {});
        }

        /* Putting a face on the kitchen is worth something *to* the kitchen. */
        if (def.id === "meet_brigade") {
          for (const x of k.staff) {
            x.morale = Math.min(100, (x.morale ?? 70) + 4);
          }
        }

        phone.feed = [
          {
            id: `you-${s.week}`,
            week: s.week,
            author: "You",
            handle: "@you",
            kind: "player" as const,
            body: def.body(ctx),
            likes: Math.round(4 + phone.social.followers / 50),
            comments:
              misfired && def.backfire
                ? [
                    {
                      author: "Salt & Cinders",
                      handle: "@saltandcinders",
                      body: def.backfire.note,
                    },
                  ]
                : [],
            tone: misfired ? ("bad" as const) : ("good" as const),
          },
          ...phone.feed,
        ].slice(0, 60);
        phone.lastPostWeek = s.week;
        phone.postsMade = [...phone.postsMade, def.id];
        break;
      }

      case "readMessages": {
        for (const msg of ensureChefPhone(k).messages) msg.read = true;
        break;
      }

      case "readNews": {
        for (const item of ensureChefPhone(k).news) item.read = true;
        break;
      }

      case "answerMessage": {
        // arg is "messageId|choiceIndex", as the messages app sends it.
        const [msgId, rawIndex] = arg.split("|");
        const phone = ensureChefPhone(k);
        const msg = phone.messages.find((x) => x.id === msgId);
        if (!msg || !msg.choices || msg.answered !== undefined) return;
        const index = Number(rawIndex);
        const choice = msg.choices[index];
        if (!choice) return;
        applySocial(phone.social, choice.effect);

        /*
         * The chef's message chains touch the brigade, and the person is
         * named in the message id — `poach-st-12` is about the cook st-12.
         * Resolved here so the choice moves the same state the week reads.
         */
        /*
         * `poach-st-12` is about the cook st-12; `tired-st-12-7` is the same
         * cook in week 7. One shared regex here ate the "12" out of the poach
         * id and quietly matched nobody — the choice registered and the rise
         * never happened, which a test caught. Parsed per chain instead.
         */
        const staffId = msg.id.startsWith("poach-")
          ? msg.id.slice("poach-".length)
          : msg.id.slice("tired-".length).replace(/-\d+$/, "");
        const person = k.staff.find((x) => x.id === staffId);
        if (person && msg.id.startsWith("poach-")) {
          if (index === 0) {
            person.salary = Math.round(person.salary * 1.15);
            person.loyalty = Math.min(100, (person.loyalty ?? 60) + 20);
            person.morale = Math.min(100, (person.morale ?? 70) + 5);
          } else {
            person.loyalty = Math.max(0, (person.loyalty ?? 60) - 15);
          }
        }
        if (person && msg.id.startsWith("tired-")) {
          if (index === 0) {
            person.morale = Math.min(100, (person.morale ?? 70) + 10);
            person.loyalty = Math.min(100, (person.loyalty ?? 60) + 5);
          } else {
            person.loyalty = Math.max(0, (person.loyalty ?? 60) - 10);
          }
        }

        msg.answered = index;
        msg.read = true;
        break;
      }

      /*
       * ANSWERING A COMPLAINT.
       *
       * Six answers, no correct one, and every input to the outcome is
       * something the player can see before choosing: whether the complaint
       * is accurate (the service dashboard for that week says), how far it
       * has travelled, how long they took, what their standing is, and
       * whether there is anybody in the building whose job is to find out.
       *
       * `investigate` is the one answer that does not close the matter — it
       * buys a week and, if there is a manager, the truth.
       */
      case "respondComplaint": {
        const [id, raw] = arg.split("|");
        const response = raw as ComplaintResponse;
        if (!RESPONSE_BY_ID.has(response)) return;
        const complaint = (k.complaints ?? []).find((c) => c.id === id);
        if (!complaint || complaint.closed) return;
        /* One answer per week per complaint: the delay term is the cost of
           thinking about it, and this is what stops it being free. */
        if (complaint.answeredWeek === s.week) return;

        const manager = k.staff.find((x) => x.role === "manager");
        const priors = (k.complaints ?? []).filter(
          (c) => c !== complaint && c.about === complaint.about && c.answered,
        ).length;

        const outcome = resolveComplaint(complaint, response, {
          week: s.week,
          reputation: s.r.reputation,
          management: manager ? currentSkill(manager) : s.r.skill * 0.6,
          priors,
          cash: s.r.cash,
          compensation: localSum(s, 180),
        });

        s.r.cash -= outcome.spent;
        const phone = ensureChefPhone(k);
        applySocial(phone.social, {
          sentiment: outcome.sentiment,
          followers: outcome.followers,
        });
        for (const move of outcome.moves) {
          applyStanding(s, move.id, move.delta, move.why, false);
        }
        complaint.answered = response;
        complaint.answeredWeek = s.week;
        complaint.outcome = outcome.note;
        complaint.closed = outcome.closed;
        pushLog(s, outcome.note, outcome.sentiment >= 0 ? "good" : "bad");
        break;
      }

      /* ======================================================== the craft */

      /**
       * Which technique the week's practice goes into.
       *
       * A setting rather than an action, so the `practise` block in the
       * planner always has somewhere to go and the player is never asked the
       * same question twice.
       */
      case "setPractice": {
        const t = TECHNIQUE_BY_ID.get(arg);
        if (!t || !canLearn(k, t) || knowsTechnique(k, t.id)) return;
        k.practising = t.id;
        break;
      }

      /**
       * A week in somebody else's kitchen.
       *
       * Unpaid, exhausting, and the fastest way to learn anything. The cost is
       * the week itself: `timeBudget` drops while you are away, so the
       * services you were going to open are services you do not open. Any
       * already allocated are cleared here, because you are not there to cook
       * them.
       */
      case "stage": {
        const stage = STAGE_BY_ID.get(arg);
        if (!stage) return;
        const done = k.stages ?? [];
        if (stageBlocker(stage, k, s.r.reputation, done)) return;
        const price = localSum(s, stage.cost);
        if (s.r.cash < price) return;
        if ((k.stagingUntil ?? 0) > s.week) return;

        s.r.cash -= price;
        s.r.burnout = Math.min(100, s.r.burnout + stage.burnout);
        k.stages = [...done, stage.id];
        k.stagingUntil = s.week + 1;
        for (const key of Object.keys(s.r)) {
          if (key.startsWith("_svc_")) s.r[key] = 0;
        }

        const learned = applyStage(k, stage);
        pushLog(
          s,
          learned.length > 0
            ? `${stage.label} in ${stage.city}. You came back knowing how to ${learned
                .map((t) => t.label.toLowerCase())
                .join(" and ")}.`
            : `${stage.label} in ${stage.city}. Six days of somebody else's discipline, and a lot of it stuck.`,
          "good",
        );
        break;
      }

      /* ======================================================= the cellar */

      case "buyWine": {
        const wine = WINE_BY_ID.get(arg);
        if (!wine) return;
        if (wineBlocker(k, wine, s.r.cash)) return;
        const price = casePrice(k, wine);
        s.r.cash -= price;
        k.cellar = [
          ...(k.cellar ?? []),
          {
            id: `case-${k.nextId++}`,
            wine: wine.id,
            bottles: wine.caseSize,
            unitCost: price / wine.caseSize,
            boughtWeek: s.week,
          },
        ];
        break;
      }

      /**
       * Sell a case back.
       *
       * At less than a diner would pay for the same bottles, deliberately: a
       * cellar is a restaurant's cellar and not a trading desk, and the way to
       * realise it properly is to pour it.
       */
      case "sellWine": {
        const lot = (k.cellar ?? []).find((l) => l.id === arg);
        if (!lot) return;
        s.r.cash += sellPrice(k, lot, s.week);
        k.cellar = (k.cellar ?? []).filter((l) => l.id !== arg);
        break;
      }

      /* ====================================================== the ventures */

      case "startVenture": {
        const v = VENTURE_BY_ID.get(arg);
        if (!v) return;
        if (ventureBlocker(v, k, s.r.reputation, s.r.cash, s.week)) return;
        s.r.cash -= ventureCost(k, v);
        const ventures = ensureVentures(k);
        ventures.active = { id: v.id, startedWeek: s.week, weeksLeft: v.weeks };
        pushLog(
          s,
          `${v.label}. ${v.weeks} weeks, and ${v.blocks} block${v.blocks === 1 ? "" : "s"} a week that will not be spent in your own kitchen.`,
          "neutral",
        );
        break;
      }

      /**
       * Walk away from one.
       *
       * What was spent is gone and nothing is paid, which is what abandoning a
       * commitment costs. It exists because a chef whose restaurant is falling
       * over while they film a television series has to be able to stop.
       */
      case "dropVenture": {
        const ventures = ensureVentures(k);
        const v = ventures.active ? VENTURE_BY_ID.get(ventures.active.id) : null;
        if (!v) return;
        ventures.active = null;
        applyStanding(
          s,
          "consistency",
          -1.5,
          `Walked away from ${v.label.toLowerCase()} part-way through`,
        );
        pushLog(
          s,
          `You pulled out of ${v.label.toLowerCase()}. It cost you what you had already spent and it bought your kitchen back.`,
          "neutral",
        );
        break;
      }

      case "setPolicy": {
        if (!POLICY_BY_ID.has(arg as never)) return;
        k.policy = arg as typeof k.policy;
        break;
      }
      case "buyKit": {
        const kit = KIT_BY_ID.get(arg);
        if (!kit) return;
        /* One of each. A second cold room does not add a second week. */
        if ((k.equipment ?? []).includes(kit.id)) return;
        /* Bought and installed locally, like the brigade. */
        const price = kitPrice(k, kit);
        if (s.r.cash < price) return;
        s.r.cash -= price;
        k.equipment = [...(k.equipment ?? []), kit.id];
        break;
      }
      /*
       * BRIEF THE AGENCY
       *
       * You no longer buy a person sight unseen. You pay an agency to go and
       * look, and they come back with three people whose skill, wage and
       * temperament you can read before deciding. Briefing again costs the
       * fee again — that is the whole point of the fee, and the reason the
       * shortlist is a decision rather than a menu.
       */
      case "briefAgency": {
        const role = ROLE_BY_ID.get(arg);
        if (!role) return;
        const { search } = agencyFees(k, role);
        if (s.r.cash < search) return;
        s.r.cash -= search;
        /* Ids come off the run's own counter, so a replayed week produces the
           same three people. The ones you pass over still consume their
           numbers — the agency spoke to them either way. */
        const base = k.nextId;
        k.nextId += SHORTLIST_SIZE;
        k.shortlist = Array.from({ length: SHORTLIST_SIZE }, (_, i) =>
          draftCandidate(k, role, s.r.reputation, base + i),
        );
        k.shortlistWeek = s.week;
        break;
      }

      /* Take one of the people the agency found. */
      case "hireCandidate": {
        const live = shortlistLive(k, s.week);
        const pick = live.find((c) => c.id === arg);
        if (!pick) return;
        const role = ROLE_BY_ID.get(pick.role);
        if (!role) return;
        const { placement } = agencyFees(k, role);
        if (s.r.cash < placement) return;
        s.r.cash -= placement;
        joinBrigade(k, pick, s.week);
        /* The rest of that shortlist goes back on the market. */
        k.shortlist = [];
        k.shortlistWeek = undefined;
        break;
      }

      /*
       * The direct hire, kept.
       *
       * Whoever is on the agency's books right now, taken without looking —
       * one payment, no shortlist. It costs exactly what briefing and placing
       * cost together, so the fast path is never the cheap path; it simply
       * trades knowing who you are getting for a week of not deciding.
       */
      case "hireKitchen": {
        const role = ROLE_BY_ID.get(arg);
        if (!role) return;
        /* Local money, like everything else: the salary that goes on the
           payroll is this city's, and stays that person's from then on. */
        const { hireCost } = rolePay(k, role);
        if (s.r.cash < hireCost) return;
        s.r.cash -= hireCost;
        joinBrigade(
          k,
          draftCandidate(k, role, s.r.reputation, k.nextId++),
          s.week,
        );
        break;
      }
      case "takePremises": {
        const room = PREMISES_BY_ID.get(arg);
        if (!room || room.id === k.premises) return;
        const price = premisesPrice(k, room);
        if (s.r.cash < price) return;
        s.r.cash -= price;
        k.premises = room.id;
        /* Worth saying out loud for a few weeks — the phone's renovation post
           reads this, and there is nothing to announce a month later. */
        k.renovatedWeek = s.week;
        pushLog(s, `You have taken on ${room.label.toLowerCase()}.`, "good");
        break;
      }
      case "payLoan": {
        const pay = loanPayment(s);
        if (pay <= 0) return;
        s.r.cash -= pay;
        s.r.debt -= pay;
        break;
      }

      /* ------------------------------------------------------- the kitchen's
       * own dishes.
       *
       * Developing is a purchase like any other and goes through the same
       * gate: it is refused rather than clamped, so a command replayed by the
       * engine against a state that no longer allows it does nothing instead
       * of half-happening.
       */
      case "developRecipe": {
        const r = RECIPE_BY_ID.get(arg);
        if (!r || knowsRecipe(k, arg)) return;
        /* The dishes at the top of the menu are gated on what the chef can do
           rather than on what the kitchen can afford. */
        if (!techniqueUnlocks(k, r.id)) return;
        if (
          recipeBlocker(r, {
            craft: s.r.skill,
            roomIndex: PREMISES.findIndex((p) => p.id === k.premises),
            reputation: s.r.reputation,
          })
        ) {
          return;
        }
        const price = localSum(s, r.developCost);
        if (s.r.cash < price) return;
        s.r.cash -= price;
        k.recipes = [...knownRecipes(k), { id: r.id, served: 0, refined: 0 }];
        pushLog(s, `${r.name} is on. It took the week to get right.`, "good");
        break;
      }
      case "refineRecipe": {
        const r = RECIPE_BY_ID.get(arg);
        const progress = progressFor(k, arg);
        if (!r || !progress) return;
        /* Each round costs more than the last: polish has diminishing
           returns and the price says so before the quality curve does. */
        const price = localSum(s, 600 + progress.refined * 900);
        if (s.r.cash < price) return;
        s.r.cash -= price;
        k.recipes = knownRecipes(k).map((p) =>
          p.id === arg ? { ...p, refined: p.refined + 1 } : p,
        );
        const after = progressFor(k, arg);
        if (after && !after.signature && earnsSignature(after)) {
          k.recipes = knownRecipes(k).map((p) =>
            p.id === arg ? { ...p, signature: true } : p,
          );
          pushLog(
            s,
            `${recipeName(r, after)} is what people come here for now.`,
            "good",
          );
        }
        break;
      }
      case "nameRecipe": {
        /* `id:the new name`. Only the first colon splits, so a name may
           contain one. */
        const at = arg.indexOf(":");
        if (at <= 0) return;
        const id = arg.slice(0, at);
        const r = RECIPE_BY_ID.get(id);
        if (!r || !progressFor(k, id)) return;
        /*
         * Sanitised rather than trusted. A name is the one piece of player
         * text in this career, it is written to the save and rendered on
         * three screens, so it is stripped of control characters, collapsed,
         * and capped. An empty name is a reset to the catalogue's own, which
         * is why a rename can never orphan a dish.
         */
        const clean = arg
          .slice(at + 1)
          // eslint-disable-next-line no-control-regex
          .replace(/[\u0000-\u001F\u007F]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 48);
        k.recipes = knownRecipes(k).map((p) =>
          p.id === id ? { ...p, name: clean || undefined } : p,
        );
        break;
      }

      /* --------------------------------------------------------- the menu */
      case "addDish": {
        const r = RECIPE_BY_ID.get(arg);
        if (!r || !knowsRecipe(k, arg)) return;
        if (activeMenu(k).some((e) => e.recipe === arg)) return;
        /* Opens at what the dish suggests, in this city's money. The player
           moves it from there; nothing is ever priced at zero by accident. */
        k.menu = [
          ...activeMenu(k),
          { recipe: r.id, price: localSum(s, r.suggestedPrice) },
        ];
        k.menuChangedWeek = s.week;
        break;
      }
      case "dropDish": {
        if (!activeMenu(k).some((e) => e.recipe === arg)) return;
        k.menu = activeMenu(k).filter((e) => e.recipe !== arg);
        k.menuChangedWeek = s.week;
        break;
      }
      case "priceDish": {
        const at = arg.indexOf(":");
        if (at <= 0) return;
        const id = arg.slice(0, at);
        const price = Number(arg.slice(at + 1));
        if (!Number.isFinite(price) || price < 0) return;
        k.menu = activeMenu(k).map((e) =>
          e.recipe === id ? { ...e, price: Math.round(price) } : e,
        );
        break;
      }

      /* ---------------------------------------------------- the ingredients */
      case "buyIngredient": {
        /* `supplier:ingredient`. The supplier decides the price and the life
           it lands with, exactly as it does for a crate. */
        const [supId, ingId] = arg.split(":");
        const sup = SUPPLIER_BY_ID.get(supId);
        const ing = INGREDIENT_BY_ID.get(ingId ?? "");
        if (!sup || !ing) return;
        if (supplierBlocker(sup, k, s.r.reputation, null)) return;
        /*
         * Some things a kitchen cannot buy until it can handle them. Money
         * will not open a tin of caviar properly and it will not fillet a
         * langoustine — the technique will. See `craft.ts`.
         */
        if (cannotHandle(k, ing.id)) return;

        const standing = standingWith(k, sup.id);
        const price = ingredientPrice(k, sup, ing, standing, s.week);
        if (price < sup.minimum) return;
        if (s.r.cash < price) return;
        s.r.cash -= price;

        k.suppliers = {
          ...(k.suppliers ?? {}),
          [sup.id]: Math.min(100, standing + 4),
        };

        const orderNo = k.nextId++;
        if (!delivered(s.seed, orderNo, sup, standing)) {
          k.suppliers = {
            ...(k.suppliers ?? {}),
            [sup.id]: Math.max(0, standingWith(k, sup.id) - 6),
          };
          pushLog(
            s,
            `${sup.label} did not deliver the ${ing.name.toLowerCase()}. ${money(price)} paid and nothing on the bench.`,
            "bad",
          );
          break;
        }

        k.pantry = [
          ...(k.pantry ?? []),
          {
            id: `ing-${orderNo}`,
            ingredient: ing.id,
            qty: ing.orderSize,
            unitCost: price / ing.orderSize,
            /* A day-boat merchant lands a longer-lived box than a pallet that
               has already spent a day on a lorry. Same rule as the crates. */
            life: Math.max(1, ing.life + sup.freshness),
            boughtWeek: s.week,
            from: sup.id,
            quality: Math.max(
              10,
              Math.min(100, ing.quality + sup.freshness * 6),
            ),
          },
        ];
        break;
      }
      /* ------------------------------------------------- how a night is run
       *
       * The service policies. Set before the week and held until changed, so
       * they are a decision about how this kitchen behaves under pressure
       * rather than a reflex to be clicked every service.
       */
      case "setServicePolicy": {
        const key = arg as keyof ServicePolicy;
        if (!POLICY_NOTES.some((p) => p.id === key)) return;
        const now = k.service ?? {};
        k.service = { ...now, [key]: !now[key] };
        break;
      }

      /* ----------------------------------------------------- the brigade */
      case "restStaff": {
        const person = k.staff.find((x) => x.id === arg);
        if (!person) return;
        /*
         * A week off, and it costs what a week off costs: they are not on
         * any service, they earn no experience, and you pay them anyway.
         * That is the opportunity cost — not a fee, the week itself.
         */
        person.restingUntil = s.week + 1;
        pushLog(s, `${person.name} is off this week.`, "neutral");
        break;
      }
      case "trainStaff": {
        const person = k.staff.find((x) => x.id === arg);
        if (!person) return;
        const price = localSum(s, TRAINING_COST);
        if (s.r.cash < price) return;
        s.r.cash -= price;
        const gain = TRAINING_GAIN * (hasTrait(person, "fast_learner") ? 1.5 : 1);
        const total = trainingOf(person) + gain;
        /* Training is banked until it is worth a skill point, so a player
           can see it accumulating rather than wondering where the money
           went. */
        person.training = Math.round(total % 100);
        if (total >= 100) {
          person.skill = Math.min(99, skillOf(person) + 1);
          pushLog(s, `${person.name} came back sharper.`, "good");
        }
        break;
      }
      case "promoteStaff": {
        const person = k.staff.find((x) => x.id === arg);
        if (!person) return;
        const up = promotionFor(person);
        if (!up) return;
        person.role = up.to;
        /* Paid for the job they are now doing, in this city's money. */
        person.salary = Math.round(up.salary * labourIndex(k));
        person.loyalty = Math.min(100, loyaltyOf(person) + 12);
        person.morale = Math.min(100, moraleOf(person) + 8);
        /* Read by the phone: a promotion is news for about three weeks. */
        person.promotedWeek = s.week;
        pushLog(s, `${person.name} is your new ${up.label.toLowerCase()}.`, "good");
        break;
      }

      case "dumpSpoiled": {
        /*
         * The player throwing it out themselves.
         *
         * The week does this automatically at the top of `resolveWeek` — food
         * that has gone over cannot be served, and that is not optional. This
         * command exists so the decision can also be taken deliberately, and
         * it charges exactly the same write-off, so neither route is cheaper
         * than the other.
         */
        const binned = clearSpoiledPantry(k, s.week);
        if (binned.units <= 0) return;
        /* No cash moves: it was paid for when it was ordered. What is lost is
           the stock, which stops counting towards what the business is worth
           the moment it leaves the shelf. */
        s.r._wasteCost = (s.r._wasteCost ?? 0) + binned.cost;
        pushLog(
          s,
          `${binned.names.join(", ")} went in the bin — ${money(binned.cost)} of stock.`,
          "bad",
        );
        break;
      }
    }
  },

  applyAction: (s, id) => {
    /* A service block: banked per kind, so the week can resolve each one on
       its own terms rather than averaging them into a single night. */
    const sv = SERVICE_BY_ID.get(id);
    if (sv) {
      s.r[`_svc_${sv.id}`] = (s.r[`_svc_${sv.id}`] ?? 0) + 1;
      s.r.burnout += sv.burnout;
      return;
    }
    switch (id) {
      case "prep":
        s.r._prep = (s.r._prep ?? 0) + 1;
        s.r.burnout += 2.2;
        break;
      case "develop":
        s.r.skill += 1.4;
        s.r.burnout += 1.6;
        break;
      case "practise": {
        const k = kitchen(s);
        /*
         * Into the chosen technique, or into the cheapest one still open if
         * nothing has been chosen — a block of the player's week must never
         * quietly do nothing.
         */
        const chosen =
          k.practising &&
          TECHNIQUE_BY_ID.has(k.practising) &&
          !knowsTechnique(k, k.practising)
            ? k.practising
            : TECHNIQUES.filter((t) => canLearn(k, t) && !knowsTechnique(k, t.id)).sort(
                (a, b) => a.cost - b.cost,
              )[0]?.id;
        if (!chosen) break;
        const out = practise(k, chosen, PRACTICE_POINTS);
        s.r.burnout += 1.4;
        if (out.learned && out.technique) {
          pushLog(
            s,
            `You can ${out.technique.label.toLowerCase()} now. ${out.technique.effect}`,
            "good",
          );
        }
        break;
      }
      case "room":
        s.r.reputation += 1.6;
        s.r.burnout += 1.8;
        break;
      case "rest":
        s.r.burnout -= 9;
        /* A day off is a day off for everybody, which is the cheapest thing
           there is for a brigade on the edge. */
        for (const x of kitchen(s).staff) {
          x.morale = Math.min(100, moraleOf(x) + 6);
        }
        break;
    }
  },

  /*
   * THE SECOND HALF OF A DECISION.
   *
   * Every kind here was scheduled by an event choice weeks ago, and the
   * engine hands it back at the top of the week it is due — before the
   * player plans, so a follow-up lands on the week it is about.
   *
   * Each one reads the state *as it is now* rather than as it was when it
   * was scheduled. That is the point: an inspection you prepared for and
   * then let slide still finds what there is to find.
   */
  resolvePending: (s, p) => {
    const k = kitchen(s);
    switch (p.kind) {
      case "bigBooking": {
        const covers = Number(p.payload?.covers ?? 0);
        const fee = Number(p.payload?.fee ?? 0);
        /* The balance, paid on the night. The deposit was taken when it was
           booked, and this is the rest of it. */
        s.r.cash += Math.round(fee * 0.6);
        applyStanding(
          s,
          "atmosphere",
          1.4,
          `Held a private dinner for ${covers}`,
        );
        return { raiseEvent: "chef_booking_night" };
      }

      case "inspection": {
        const prepared = Number(p.payload?.prepared ?? 0) === 1;
        const scores = standingOf(k, s.r.reputation);
        /* Judged on what is actually in the building: the hygiene score, and
           whether anything in the pantry is past its life right now. */
        const rotten = (k.pantry ?? []).filter(
          (lot) => s.week - lot.boughtWeek > lot.life,
        ).length;
        const grade = scores.hygiene - rotten * 9 + (prepared ? 14 : 0);
        if (grade >= 62) {
          applyStanding(
            s,
            "hygiene",
            3,
            "Passed the inspection with nothing to note",
          );
          return {
            log: "The inspector spent an hour, wrote almost nothing down, and left. That is the best possible outcome.",
          };
        }
        if (grade >= 40) {
          applyStanding(
            s,
            "hygiene",
            -1.5,
            "The inspection found things to put right",
          );
          return {
            log: "Two things to put right within the month. Neither is serious and both are your fault.",
          };
        }
        /* Scaled to the room, like the deep clean that could have avoided it. */
        const fine = Math.round(
          localSum(s, 1_700) * (0.45 + premisesOf(k).capacity / 480),
        );
        s.r.cash -= fine;
        applyStanding(
          s,
          "hygiene",
          -6,
          "Failed the inspection, and it was published",
        );
        return {
          log: `A failed inspection, ${money(fine)} in penalties, and a notice that has to go in the window.`,
        };
      }

      case "festivalTail": {
        const buzz = ensureBuzz(k);
        buzz.interest = Math.min(1.45, buzz.interest + 0.14);
        return {
          log: "People who ate your food at the festival have started ringing for tables.",
        };
      }

      case "influencerPost": {
        /* What they write about is the night they had, which by now has
           happened and is on record. */
        const quality = k.lastService?.quality ?? 0;
        const phone = ensureChefPhone(k);
        if (quality >= 58) {
          phone.social.followers += 1_600;
          phone.social.sentiment = Math.min(100, phone.social.sentiment + 4);
          const buzz = ensureBuzz(k);
          buzz.interest = Math.min(1.45, buzz.interest + 0.12);
          buzz.expectation = Math.min(30, buzz.expectation + 5);
          return {
            log: "The influencer's post went up and it was genuinely kind. Everybody who books this month has seen it.",
          };
        }
        phone.social.sentiment = Math.max(0, phone.social.sentiment - 6);
        applyStanding(
          s,
          "food",
          -1.4,
          "A free meal was posted about, and the meal was not good",
        );
        return {
          log: "The influencer's post went up. You gave away dinner and got a paragraph about how it was fine.",
        };
      }

      case "allergyReview": {
        const scores = standingOf(k, s.r.reputation);
        if (scores.hygiene >= 60) {
          applyStanding(
            s,
            "hygiene",
            2,
            "A month with no repeat of the allergy incident",
          );
          return {
            log: "A month on, nothing like it has happened again. The retraining held.",
          };
        }
        applyStanding(
          s,
          "hygiene",
          -2.5,
          "A second guest was served something they had said they could not eat",
        );
        return {
          log: "It happened again. This time somebody wrote it down and sent it to the council.",
        };
      }

      case "illnessSpread": {
        const next = k.staff.filter((x) => !isResting(x, s.week))[1];
        if (!next) return { log: "Whatever was going round did not get any further." };
        next.restingUntil = s.week + 1;
        next.fatigue = Math.min(100, fatigueOf(next) + 10);
        return {
          log: `${next.name} has it now. That is two people off a section that was already thin.`,
        };
      }
    }
    /* An unknown kind from an older save is dropped harmlessly, which is
       exactly what the consequences module promises. */
    return;
  },

  resolveWeek: (s, rng) => {
    const k = kitchen(s);
    const out: LedgerLine[] = [];
    const prep = s.r._prep ?? 0;

    /*
     * PHASE 3, FIRST.
     *
     * A save from before any of this gains its seven standing categories at
     * the value its reputation already holds; last week's promotion fades a
     * little; and the city's other restaurants exist. All three are
     * idempotent, so this is also what happens on every subsequent week.
     */
    seedStanding(k, s.r.reputation);
    decayBuzz(k, s.week);
    ensureRivals(k, s.week);
    /* How much higher the bar is than it would be, because of what you have
       promised and what has been written about you. */
    const bar = expectationOf(k) + starExpectation(k);

    /* 1. Bin what has gone over. Before service, so it genuinely cannot be
       sold tonight — the write-off is the point of the career. */
    const spoiled = clearSpoiled(k, s.week);
    /*
     * What the chef's own technique saves from the bin.
     *
     * Butchery, stocks and curing all mean the same thing on this line: less
     * of what would have been thrown away is thrown away. Applied to the
     * write-off rather than to the shelf life, because the fiction is that
     * the trim became something rather than that it lasted longer.
     */
    const saved = techniqueYield(k);
    if (saved > 0 && spoiled.cost > 0) {
      spoiled.cost = Math.round(spoiled.cost * (1 - saved));
      spoiled.covers = Math.round(spoiled.covers * (1 - saved));
    }
    if (spoiled.covers > 0) {
      out.push({
        label: `Spoiled produce — ${spoiled.covers} covers' worth`,
        amount: -spoiled.cost,
        kind: "expense",
        note: "Bought, never served.",
      });
      /* Waste is not only money. A kitchen throwing food away is a kitchen
         that ordered badly, and it shows up on the plate soon enough. */
      applyStanding(
        s,
        "hygiene",
        -Math.min(2.5, spoiled.covers / 90),
        `${spoiled.covers} covers of produce went in the bin`,
      );
    }

    /*
     * 1b. The same sweep for the named ingredients.
     *
     * Before service, for the reason the crates are: food that has gone over
     * must be genuinely unavailable tonight. This is the safe rule the whole
     * freshness system rests on — nothing spoiled can reach a plate, because
     * it is not in the pantry any more by the time a plate is called.
     */
    const binned = clearSpoiledPantry(k, s.week);
    if (binned.units > 0) {
      /*
       * Reported, not charged again.
       *
       * The money for these ingredients left when the order was paid for, and
       * the stock has been an asset on `kitchenWorth` ever since. Taking the
       * cash a second time here would be charging twice for one mistake — the
       * loss is that an asset the kitchen owned is now worth nothing, which
       * the balance sheet already says. So this line tells the player what it
       * cost them without moving the money.
       */
      out.push({
        label: `Thrown out — ${binned.names.slice(0, 3).join(", ")}`,
        kind: "info",
        note: `${money(binned.cost)} of stock past its life. It could not be served and it was not.`,
      });
      applyStanding(
        s,
        "hygiene",
        -Math.min(1.5, binned.cost / 900),
        `${money(binned.cost)} of ingredients past their life`,
      );
    }

    /*
     * 2. Each service on its own terms.
     *
     * Resolved one kind at a time rather than as a single averaged night,
     * because that is the whole point of choosing between them: a catering
     * run and a tasting menu draw from the same larder and the same brigade
     * but answer to completely different rules about who turns up.
     *
     * The brigade is a shared pool spent in order, so a week that stacks
     * demanding services starves the last of them — which is the staffing
     * pressure the catalogue describes, made real rather than asserted.
     */
    const room = premisesOf(k);
    /* A menu of slow dishes eats the pass: the same brigade plates fewer
       covers of a tasting course than of soup, and `prepLoad` is that. */
    const hands = Math.round(
      brigadeCovers(k, s.r.skill) *
        (1 + prep * 0.18) *
        menuFactors(k, s.r.skill).prepLoad,
    );
    let handsLeft = hands;

    let served = 0;
    let wanted = 0;
    let revenue = 0;
    let turnedAway = 0;
    let shortOfFood = 0;
    let qualityWeighted = 0;
    let freshWeighted = 0;
    let reviewMove = 0;
    let soldOut = false;
    const lines: ServiceLine[] = [];
    /* The dishes layer's own totals for the week, kept beside the service
       lines rather than inside them: a dish can be served across two
       different services and is still one dish. */
    let ingredientCost = 0;
    let plainCovers = 0;
    const dishTotals = new Map<string, DishResult>();
    /* Phase 2's own totals for the week: the nights that ran, and what they
       did to the room and to the people. */
    const nights: ServiceReport[] = [];
    let mistakes = 0;
    let walkedOut = 0;
    let satisfactionWeighted = 0;
    let satisfactionCovers = 0;
    /* How the player told the kitchen to run tonight. */
    const policy: ServicePolicy = k.service ?? {};
    /* Read once: the menu does not change while a week resolves, and both
       the hands and the plate read it. */
    const menu = menuFactors(k, s.r.skill);
    /* One per service run, kept so the week's reviews know who was in the
       room and the report can say so. */
    const scenes: ReturnType<typeof sceneFor>[] = [];

    for (const sv of SERVICES) {
      const blocks = s.r[`_svc_${sv.id}`] ?? 0;
      if (blocks <= 0) continue;

      /*
       * The forecast the player was shown is the forecast the week resolves
       * against. Reservations and no-shows are the knowable half and come out
       * of it unchanged; only the walk-in trade is rolled, and only inside
       * the band that was on screen. A week that lands outside what the
       * player was told would make the forecast a decoration.
       */
      /*
       * WHO IS COMING, AND WHY.
       *
       * The scene is the city's segments, what the rivals are taking off you
       * and what the phone has done, in one multiplier and a list of reasons.
       * It goes into the forecast rather than being applied afterwards, so the
       * range the player was shown already contains it.
       */
      const scene = sceneFor(k, s.r.reputation, s.week, sv.id);
      scenes.push(scene);
      /*
       * Two more reasons to book, both of them earned: a serious wine list is
       * a reason to choose this restaurant, and a star is a reason to plan a
       * journey. Multiplied into the same demand term as everything else, so
       * the forecast the player was shown already contains them.
       */
      const fc = forecastFor(k, s.r.reputation, sv, blocks, s.r.skill, {
        demand: scene.demand * cellarDraw(k) * starDraw(k),
        drivers: [
          ...scene.drivers,
          ...(starsOf(k) > 0
            ? [
                {
                  label: `${starsOf(k)} star${starsOf(k) === 1 ? "" : "s"}`,
                  effect: "up" as const,
                  note: "People plan journeys around starred restaurants, and they expect to be able to tell why.",
                },
              ]
            : []),
          ...(cellarDraw(k) > 1.01
            ? [
                {
                  label: "The wine list",
                  effect: "up" as const,
                  note: "A list worth reading is a reason to choose this room over the one next door.",
                },
              ]
            : []),
        ],
      });
      const walkIns = sv.booked
        ? 0
        : Math.round(
            fc.walkInLow + rng.next() * Math.max(0, fc.walkInHigh - fc.walkInLow),
          );
      const arriving = fc.reservations - fc.noShows;
      const want = arriving + walkIns;

      const crew = Math.max(
        0,
        Math.floor((handsLeft + specialistBonus(k, sv.id)) / sv.crewLoad),
      );
      const canPlate = Math.min(want, fc.seats, crew);

      /*
       * WHAT THE FOOD IS.
       *
       * The menu goes out first, because a dish's own ingredients *are* the
       * food for that cover — a roast chicken is made of chicken, not of a
       * crate of staples with chicken on the side. Whatever the pantry cannot
       * carry falls through to the crates, which is what they have always
       * been: the staple, and the thing you serve when there is no menu or
       * when the menu has run out.
       *
       * Getting this the other way round — gating every cover on a crate
       * first — meant a kitchen with a full pantry and no crates opened with
       * nothing to cook, which is not a trade, it is a trap. Found in the
       * browser rather than in a test, because the arithmetic was consistent
       * and the *rule* was wrong.
       */
      /*
       * THE NIGHT ITSELF.
       *
       * With a menu on, the covers go through the service pipeline: tickets
       * are placed, prepped, cooked, plated and served, throttled by what
       * each station can actually move. That is where the brigade's roles
       * stop being a salary and start being positions — see `service.ts`.
       *
       * Without a menu there are no tickets to run, `runService` returns an
       * empty night, and every cover falls through to the crate arithmetic
       * this career has always used. That is the compatibility guarantee, and
       * it is the same one Phase 1 made.
       */
      const best = bestSkillIn(k, s.r.skill);
      /*
       * What the room orders, and what you have told them to order.
       *
       * A promoted dish takes a stated extra share of the tickets for three
       * weeks. That is the mechanical meaning of "promoting a dish increases
       * demand for it" — and it is also why promoting something you cannot
       * source is a way to ruin a week.
       */
      const rawPlans = planDishes(k, s.r.skill).map((plan) => ({
        recipe: plan.recipe,
        progress: plan.progress,
        price: plan.entry.price,
        share: plan.share + promotionOf(k, plan.recipe.id, s.week),
        /* What the chef can personally do, added to the dishes in the
           discipline they can do it in — see `craft.ts`. */
        quality: dishQuality(
          plan.recipe,
          plan.progress,
          best,
          techniqueLift(k, plan.recipe.category),
        ),
      }));
      const shareTotal = rawPlans.reduce((n, p) => n + p.share, 0);
      const plans =
        shareTotal > 0
          ? rawPlans.map((p) => ({ ...p, share: p.share / shareTotal }))
          : rawPlans;
      const loads = stationLoads(k, sv, policy, s.r.skill, s.week);
      const night =
        plans.length > 0
          ? runService({
              k,
              sv,
              demand: canPlate,
              booked: fc.reservations - fc.noShows,
              plans,
              /* The pipeline never touches the pantry itself: it asks, and
                 the Phase 1 consumption rules answer. One place decides what
                 leaves a shelf. */
              draw: (recipe, covers) => consumeForCovers(k, recipe, covers, s.week),
              loads,
              policy,
              crew: onTonight(k, s.week).map((x) => ({
                id: x.id,
                skill: currentSkill(x),
                fatigueResist: hasTrait(x, "reliable") ? 1 : 0,
                learns: hasTrait(x, "fast_learner") ? 1 : 0,
              })),
              /* Precision and emulsions are the two techniques that show up
                 as *fewer things going wrong* rather than a better plate. */
              errorRate: errorRateOf(k, s.r.skill, s.week) * techniqueSteadiness(k),
              /* A room of families gives up sooner than a room of
                 enthusiasts. The mix decides it. */
              patience: scene.patience,
              rng,
            })
          : null;

      /*
       * Covers the pipeline could not *source* fall through to the staple
       * crates. Covers that walked out do not: they left, which is the whole
       * cost of being slow, and serving them off the crates afterwards would
       * quietly refund the mistake.
       */
      const toStaple = night ? night.unmade : canPlate;
      const food = larderCovers(k);
      const draw = drawFromLarder(k, Math.min(toStaple, food), s.week);
      const offMenu = night ? night.served : 0;
      const got = offMenu + draw.drawn;
      handsLeft = Math.max(0, handsLeft - got * sv.crewLoad);

      const pressure = crew > 0 ? got / crew : 0;
      const plate =
        got > 0
          ? plateQuality(s.r.skill, craftOf(k), draw.freshness, draw.grade, pressure)
          : 0;

      /*
       * WHAT WAS ACTUALLY ON THE PLATE.
       *
       * With a menu on, the covers are split across the dishes offered, each
       * takes its own ingredients out of the pantry, and what it sells for is
       * the price the player set rather than what the room notionally spends.
       * Anything the pantry could not carry falls through to `plain` — the
       * staple crate on its own, sold at the room's ordinary spend and marked
       * down for being exactly that.
       *
       * With no menu there are no tickets, the pipeline is never entered,
       * and the line below is the arithmetic this career has always used.
       * That is the whole compatibility story: an old save keeps its economy
       * because the new path is only taken by a kitchen that built a menu.
       */
      ingredientCost += night?.ingredientCost ?? 0;
      for (const dish of night?.dishes ?? []) {
        const prev = dishTotals.get(dish.dish);
        dishTotals.set(
          dish.dish,
          prev
            ? {
                ...prev,
                covers: prev.covers + dish.covers,
                revenue: prev.revenue + dish.revenue,
                cost: prev.cost + dish.cost,
                quality:
                  (prev.quality * prev.covers + dish.quality * dish.covers) /
                  Math.max(1, prev.covers + dish.covers),
              }
            : {
                recipe: dish.dish,
                name: dish.name,
                covers: dish.covers,
                revenue: dish.revenue,
                cost: dish.cost,
                quality: dish.quality,
              },
        );
      }
      /* The night's own totals, kept for the dashboard and the report. */
      if (night) {
        nights.push(night);
        mistakes += night.mistakes;
        walkedOut += night.walked;
        satisfactionWeighted += night.satisfaction * Math.max(1, night.served);
        satisfactionCovers += Math.max(1, night.served);
      }

      /*
       * Quality is the pass and the plate together: a brilliant dish cooked
       * in a rush is not a brilliant dish, and a simple one cooked calmly is
       * better than its recipe.
       *
       * Weighted by what each cover actually ate. A cover served off the menu
       * is judged on the dish and the pass; a cover that fell through to the
       * staple is judged on the pass alone, because that is all it was. The
       * menu's own consistency factor rides on top of both — a short menu is
       * a sharper kitchen — and a night where nothing came off the menu is
       * exactly the arithmetic this career always had.
       */
      const menuPlate =
        night && night.quality > 0 ? plate * 0.45 + night.quality * 0.55 : plate;
      const q =
        got > 0
          ? Math.max(
              0,
              Math.min(
                100,
                ((menuPlate * offMenu + plate * draw.drawn) / got) *
                  menu.quality,
              ),
            )
          : 0;

      const plainTake =
        draw.drawn * spendPerHead(k) * kitSpend(k) * sv.spend * (0.85 + q / 200);
      /* Dishes are already priced; the service style still multiplies, so a
         tasting menu of the same dish is worth more than a lunch of it. */
      const menuTake = (night?.revenue ?? 0) * sv.spend * (0.9 + q / 250);
      /*
       * And who was sitting at the tables. A room of luxury diners and
       * tourists spends more per head on the same menu than a room of
       * families does — which is what makes chasing a segment a strategy
       * rather than a preference.
       */
      /*
       * And what the night is worth a head. Three multipliers, all of them
       * earned rather than bought: who was sitting there, what the chef can
       * personally do, and what the guide says about the room.
       */
      const take = Math.round(
        (plainTake + menuTake) * scene.spend * techniqueWorth(k) * starWorth(k),
      );
      /* Deposits are kept when a booking does not arrive — the whole reason
         to ask for one. */
      const kept = Math.round(fc.noShows * policyOf(k).deposit);

      plainCovers += draw.drawn;
      served += got;
      wanted += want;
      revenue += take + kept;
      const missed = Math.max(0, want - got);
      /*
       * Only walk-in trade can be turned away, which is what the card
       * promises for booked work and what the player is choosing when they
       * take it. Failing to deliver covers you had *agreed* is a different and
       * worse thing — a breach, not a full house — and modelling it as a
       * turn-away would both understate it and contradict the card. It is not
       * modelled yet; until it is, booked work does not report turn-aways.
       */
      if (!sv.booked) turnedAway += missed;
      shortOfFood += Math.max(0, canPlate - got);
      qualityWeighted += q * got;
      /* What the covers actually ate: the pantry's freshness for the menu,
         the crates' for the staple. Reading the crates alone reported 0% on a
         night cooked entirely from the pantry, which is the opposite of what
         happened. */
      freshWeighted +=
        (night ? night.quality / 100 : 1) * offMenu + draw.freshness * draw.drawn;
      /*
       * What the room thought of the plate — against a bar that includes
       * everything you have promised. This is the whole cost of promotion:
       * the same dish, sent out on the same night, scores worse when the
       * people eating it were told to expect more.
       */
      reviewMove +=
        reviewDelta(q, s.r.reputation + bar) * sv.reviewWeight * (got > 0 ? 1 : 0);
      /*
       * Turning away somebody who booked is not the same as being full.
       * Overbooking trades a fuller room for exactly this, so it has to cost
       * something a player can feel.
       */
      if (!sv.booked && fc.reservations > fc.seats && missed > 0) {
        applyStanding(
          s,
          "service",
          -Math.min(2.5, missed / 25),
          `${missed} covers turned away from a room that was overbooked`,
        );
      }
      if (!sv.booked && want > canPlate && got > 0) soldOut = true;

      lines.push({
        id: sv.id,
        blocks,
        reservations: fc.reservations,
        noShows: fc.noShows,
        walkIns,
        wanted: want,
        served: got,
        turnedAway: sv.booked ? 0 : missed,
        revenue: take + kept,
        foodCost: Math.round(draw.cost),
        deposits: kept,
        quality: q,
        freshness:
          got > 0
            ? ((night ? night.quality / 100 : 1) * offMenu +
                draw.freshness * draw.drawn) /
              got
            : 1,
        /* Both stores, because both can feed a cover now: what the menu
           served plus what the crates still hold is the food this night
           actually had. */
        binding: bindingOf(
          want,
          fc.seats,
          handsLeft + got * sv.crewLoad,
          offMenu + food,
          sv,
        ),
      });
      s.r[`_svc_${sv.id}`] = 0;
    }

    const quality = served > 0 ? qualityWeighted / served : 0;
    const freshness = served > 0 ? freshWeighted / served : 0;

    if (served > 0) {
      out.push({
        label: `${served} covers served`,
        amount: revenue,
        kind: "income",
        note: `Plate quality ${Math.round(quality)} · freshness ${Math.round(freshness * 100)}%`,
      });
      applyStanding(
        s,
        "food",
        reviewMove,
        bar >= 4
          ? `Plate quality ${Math.round(quality)} against expectations raised ${Math.round(bar)} points by what you have promised`
          : `Plate quality ${Math.round(quality)} across ${served} covers`,
      );
    } else if (lines.length > 0) {
      out.push({
        label: "Opened with nothing to cook",
        kind: "info",
        note: "The larder was empty.",
      });
      applyStanding(
        s,
        "consistency",
        -2,
        "Opened the doors with nothing in the building to cook",
      );
    }

    /* 3. Running out of food is a different failure from being full, and the
       model separates them because the player has to. */
    if (shortOfFood > 0) {
      applyStanding(
        s,
        "service",
        -Math.min(3, shortOfFood / 60),
        `${shortOfFood} covers wanted food there was none of`,
      );
    }
    k.streak = soldOut ? k.streak + 1 : 0;

    /* =================================================== the cellar, poured */

    /*
     * Wine is sold by the bottle, off the racks, oldest first.
     *
     * It sits here rather than inside the service pipeline because it is not
     * cooked: nobody prepares it, no station moves it, and it cannot be the
     * reason a table walks out. What it *is* is the single largest margin in
     * a restaurant, and the reason a cellar full of maturing bottles is worth
     * holding rather than selling.
     */
    const hasSommelier = k.staff.some((x) => x.role === "somm");
    const poured =
      served > 0
        ? pourForCovers(
            k,
            served,
            s.week,
            hasSommelier,
            [...new Set(activeMenu(k).map(
              (e) => RECIPE_BY_ID.get(e.recipe)?.category ?? "main",
            ))],
          )
        : { bottles: 0, revenue: 0, cost: 0, best: null };

    if (poured.bottles > 0) {
      revenue += poured.revenue;
      out.push({
        label: `${poured.bottles} bottles opened`,
        amount: poured.revenue,
        kind: "income",
        note: poured.best
          ? `${money(poured.cost)} of it was what the wine cost you. The best thing poured was the ${poured.best.toLowerCase()}.`
          : `${money(poured.cost)} of it was what the wine cost you.`,
      });
      /*
       * A list that is actually poured is a list people talk about — and it
       * is the atmosphere category rather than the food one, because a wine
       * programme is a property of the room.
       */
      applyStanding(
        s,
        "atmosphere",
        Math.min(1.2, poured.bottles / 90),
        `${poured.bottles} bottles went out${poured.best ? `, including the ${poured.best.toLowerCase()}` : ""}`,
      );
    }

    /* ==================================================== what you learned */

    /*
     * A week of cooking teaches the chef something, in the disciplines the
     * menu actually uses. Small — a block of deliberate practice is worth
     * about eight weeks of this — but it means a long run improves the chef
     * even if they never spend a block on it, which is how kitchens work.
     */
    if (served > 0) {
      const gained = practiceFromService(k, served);
      for (const [discipline, points] of Object.entries(gained)) {
        if (points <= 0) continue;
        const open = TECHNIQUES.filter(
          (t) =>
            t.discipline === discipline &&
            canLearn(k, t) &&
            !knowsTechnique(k, t.id),
        ).sort((a, b) => a.cost - b.cost)[0];
        if (!open) continue;
        const learned = practise(k, open.id, points);
        if (learned.learned && learned.technique) {
          pushLog(
            s,
            `Twenty weeks of cooking it and you can ${learned.technique.label.toLowerCase()} without thinking. ${learned.technique.effect}`,
            "good",
          );
        }
      }
    }

    /* ====================================================== the ventures */

    /*
     * Whatever is being written, filmed or consulted on moves one week
     * closer, and anything already finished pays what it pays. Royalties are
     * the only income in this career that arrives whether or not the doors
     * opened, which is exactly why a chef writes a book.
     */
    const venture = advanceVentures(k, s.week);
    if (venture.royalties > 0) {
      s.r.cash += venture.royalties;
      out.push({
        label: "Royalties",
        amount: venture.royalties,
        kind: "income",
        note: "Money that arrives whether or not you opened the doors.",
      });
    }
    if (venture.finished) {
      const v = venture.finished;
      const fee = ventureFee(k, v);
      s.r.cash += fee;
      out.push({
        label: v.label,
        amount: fee,
        kind: "income",
        note: "Finished, and paid.",
      });
      const phone = ensureChefPhone(k);
      phone.social.followers += v.followers;
      if (v.expectation > 0) {
        const buzz = ensureBuzz(k);
        buzz.expectation = Math.min(30, buzz.expectation + v.expectation);
      }
      for (const move of v.moves) {
        applyStanding(s, move.id, move.delta, move.why, false);
      }
      pushLog(
        s,
        v.royalty > 0
          ? `${v.label} is done. ${money(fee)} now and ${money(localOf(k, v.royalty))} a week from here.`
          : `${v.label} is done. ${money(fee)}, and your kitchen back.`,
        "good",
      );
    }

    /* ========================================================== the guide */

    /*
     * Once a year, in the same week, and it can take as easily as it gives.
     * Everything it reads is state the player built; nothing here is rolled.
     */
    if (guideDue(s.week)) {
      const held = starsOf(k);
      const published = publishGuide(k, s.r.reputation, s.week);
      k.stars = published.stars;
      k.guide = [published.record, ...(k.guide ?? [])].slice(0, MAX_GUIDE_RECORDS);

      if (published.stars > held) {
        /* A star is a standing you now have to hold, so it raises the bar
           permanently as well as filling the room. */
        const buzz = ensureBuzz(k);
        buzz.expectation = Math.min(30, buzz.expectation + 6);
        buzz.interest = Math.min(1.45, buzz.interest + 0.2);
        applyStanding(
          s,
          "food",
          3.5,
          `The guide gave you ${published.stars === 1 ? "a star" : `${published.stars} stars`}`,
          false,
        );
        pushLog(s, published.record.note, "good");
      } else if (published.stars < held) {
        applyStanding(
          s,
          "consistency",
          -4,
          "The guide took a star back",
          false,
        );
        pushLog(s, published.record.note, "bad");
      } else {
        pushLog(s, published.record.note, "neutral");
      }

      ensureChefPhone(k).news = [
        {
          id: `guide-${s.week}`,
          week: s.week,
          outlet: "The guide",
          headline:
            published.stars === held
              ? `${starsOf(k)} star${starsOf(k) === 1 ? "" : "s"} — no change`
              : published.stars > held
                ? `${published.stars} star${published.stars === 1 ? "" : "s"}`
                : "A star withdrawn",
          body: `${published.record.note} Their weakest note was ${published.record.weakest.toLowerCase()}.`,
          tone:
            published.stars > held
              ? ("good" as const)
              : published.stars < held
                ? ("bad" as const)
                : ("neutral" as const),
          read: false,
        },
        ...ensureChefPhone(k).news,
      ].slice(0, 14);
    }

    /* 4. What it costs to keep the doors on the hinges. */
    const r = rent(k);
    out.push({ label: `Rent — ${room.label}`, amount: -r, kind: "expense" });
    const w = wages(k);
    if (w > 0) out.push({ label: "Wages", amount: -w, kind: "expense" });
    const kitCost = kitUpkeep(k);
    if (kitCost > 0) {
      out.push({
        label: "Kitchen upkeep",
        amount: -kitCost,
        kind: "expense",
        note: "Power, servicing and the cold running whether you cook or not.",
      });
    }

    if (s.r.debt > 0) {
      const interest = loanInterest(s.r.debt);
      s.r.debt += interest;
      out.push({
        label: "Fit-out loan interest",
        amount: -interest,
        kind: "expense",
      });
    }

    /*
     * What the named ingredients cost the covers that were actually served.
     *
     * A separate line from the crates because it answers a different
     * question: the crate spend is what the larder cost to *hold*, this is
     * what the menu cost to *cook*. Together they are the food cost the
     * Money screen divides into takings.
     */
    if (ingredientCost > 0) {
      /*
       * The cost of what went out, not a payment.
       *
       * Ingredients are paid for when the order is placed, like crates and
       * like everything else this career buys — a command moves the cash, and
       * the weekly ledger is what the *week* did. What this line carries is
       * the cost of goods actually sold, which is the number the food-cost
       * share on the Money screen is computed from.
       */
      out.push({
        label: "Ingredients on the plate",
        kind: "info",
        note: `${money(Math.round(ingredientCost))} of stock cooked and sold. Paid for when it was ordered.`,
      });
    }

    /*
     * One settlement, one source of truth.
     *
     * Every figure the dishes layer produces lands here rather than being
     * added to cash where it was calculated — the same rule the crates,
     * rent, wages and upkeep have always followed.
     */
    s.r.cash += revenue - r - w - kitCost - spoiled.cost;
    s.r._lastRevenue = revenue;
    /* Kept for the Money screen, which reports the week rather than recomputing
       it: what food cost, what was thrown away, and what the pantry is worth. */
    s.r._ingredientSpend = Math.round(ingredientCost);
    s.r._wasteCost = Math.round(spoiled.cost + binned.cost);
    s.r._burnoutPeak = Math.max(s.r._burnoutPeak ?? 0, s.r.burnout);

    /*
     * What the week did to the dishes themselves.
     *
     * Covers served accumulate on the recipe, and a dish that has been
     * refined enough and sent out enough becomes the kitchen's signature —
     * which is earned by cooking it, not bought.
     */
    if (dishTotals.size > 0) {
      k.recipes = knownRecipes(k).map((p) => {
        const did = dishTotals.get(p.id);
        if (!did) return p;
        const next = { ...p, served: p.served + did.covers };
        if (!next.signature && earnsSignature(next)) {
          next.signature = true;
          pushLog(
            s,
            `${did.name} is what people come here for now.`,
            "good",
          );
        }
        return next;
      });
    }

    /*
     * THE BRIGADE, WEEK BY WEEK.
     *
     * Morale tracks how hard the week was: a kitchen run at full stretch grinds
     * people down, a quiet one lets them recover. Loyalty follows morale slowly,
     * and somebody whose loyalty runs out leaves — which is the cost of treating
     * a brigade as a set of numbers rather than as people.
     */
    if (k.staff.length > 0) {
      const stretch = hands > 0 ? served / hands : 0;
      const strain = stretch > 0.85 ? (stretch - 0.85) * 26 : -2.5;
      const leaving: KitchenStaff[] = [];
      /*
       * What the nights did to the people who worked them.
       *
       * Fatigue, experience and morale all come off the service reports
       * rather than off a flat per-week number, so a brigade that ran two
       * tasting menus is genuinely more wrecked than one that did a quiet
       * lunch — and somebody who took the week off recovers instead.
       */
      const nightFatigue = new Map<string, number>();
      const nightExperience = new Map<string, number>();
      for (const report of nights) {
        for (const [id, amount] of Object.entries(report.fatigue)) {
          nightFatigue.set(id, (nightFatigue.get(id) ?? 0) + amount);
        }
        for (const [id, amount] of Object.entries(report.experience)) {
          nightExperience.set(id, (nightExperience.get(id) ?? 0) + amount);
        }
      }
      const roomMood =
        satisfactionCovers > 0
          ? satisfactionWeighted / satisfactionCovers
          : 55;

      for (const x of k.staff) {
        const resting = isResting(x, s.week);
        /* Rest is the only thing that clears real fatigue; a normal week
           takes the edge off and no more. */
        x.fatigue = Math.round(
          Math.min(100, recover(x, resting) + (nightFatigue.get(x.id) ?? 0)),
        );
        x.experience = Math.round(
          experienceOf(x) + (resting ? 0 : (nightExperience.get(x.id) ?? 0)),
        );
        /*
         * Morale is now two things at once: the old strain term, which is
         * about how hard the week was, and how the nights actually went,
         * which is about whether the work was any good. A brigade that is
         * run hard on a night the room loved is not the same as one run hard
         * on a night of walkouts.
         */
        const afterNights =
          nights.length > 0 ? moraleAfter(x, roomMood, mistakes) : moraleOf(x);
        const morale = Math.max(
          0,
          Math.min(100, afterNights - strain + (resting ? 4 : 0)),
        );
        /* Loyalty is slower than morale in both directions: one bad week is
           forgiven, a bad month is not. Exhaustion is its own pressure — a
           cook who is never rested leaves even when the food is good. */
        const drift =
          (morale > 60 ? 1.2 : morale < 35 ? -3.2 : -0.4) -
          (fatigueOf(x) > 70 ? 1.6 : 0);
        const loyalty = Math.max(0, Math.min(100, loyaltyOf(x) + drift));
        x.morale = Math.round(morale);
        x.loyalty = Math.round(loyalty);
        if (loyalty <= 0) leaving.push(x);
      }

      for (const x of leaving) {
        pushLog(
          s,
          `${x.name} has handed their jacket back after ${Math.max(1, s.week - (x.since ?? s.week))} weeks.`,
          "bad",
        );
      }
      if (leaving.length > 0) {
        k.staff = k.staff.filter((x) => !leaving.includes(x));
        applyStanding(
          s,
          "service",
          -leaving.length * 0.8,
          `${leaving.length === 1 ? "Somebody" : `${leaving.length} people`} walked out of the brigade`,
        );
      }
    }

    /*
     * WHAT THE ROOM THOUGHT.
     *
     * The pipeline's satisfaction is the night's own verdict — speed for a
     * lunch, the plate for a tasting menu, a complete delivery for catering —
     * and it moves the reviews on top of what the food itself did. Walkouts
     * are counted separately because a table that gave up and left tells
     * people about it.
     */
    if (nights.length > 0) {
      const mood = satisfactionWeighted / Math.max(1, satisfactionCovers);
      applyStanding(
        s,
        "service",
        (mood - 55) / 26,
        `The room's own verdict on the night was ${Math.round(mood)} out of 100`,
      );
      if (walkedOut > 0) {
        const shape = nights[0];
        applyStanding(
          s,
          "service",
          -Math.min(
            3,
            walkedOut * (SERVICE_SHAPES[shape.service]?.walkoutCost ?? 0.08),
          ),
          `${walkedOut} table${walkedOut === 1 ? "" : "s"} gave up waiting and left`,
        );
        pushLog(
          s,
          `${walkedOut} table${walkedOut === 1 ? "" : "s"} gave up waiting and left.`,
          "bad",
        );
      }
      if (mistakes > 0 && mood < 45) {
        pushLog(
          s,
          `${mistakes} plate${mistakes === 1 ? "" : "s"} went back. The room noticed.`,
          "bad",
        );
      }
    }

    /* The supplier penalty wears off as the account is rebuilt. */
    if ((s.r._supplierPenalty ?? 0) > 0) s.r._supplierPenalty -= 1;

    /* Burnout drifts down slowly on its own; kitchens are not restful. */
    s.r.burnout = Math.max(0, s.r.burnout - 1.6);
    s.r.reputation = Math.max(0, Math.min(100, s.r.reputation));

    k.lastService = {
      wanted,
      served,
      turnedAway,
      shortOfFood,
      quality,
      freshness,
      waste: spoiled.covers,
      wasteCost: spoiled.cost,
      revenue,
      lines,
      dishes: [...dishTotals.values()].sort((a, b) => b.covers - a.covers),
      ingredientCost: Math.round(ingredientCost),
      plainCovers,
      nights,
    } satisfies ServiceResult;

    s.r._prep = 0;

    /*
     * WHAT THE CITY MADE OF IT.
     *
     * Reviews, what customers posted, whether a critic came, what the other
     * restaurants did, and what all of it did to the seven parts of your
     * standing. Runs after `lastService` is written, so everything it says
     * happened genuinely happened. See `sceneWeek.ts`.
     */
    resolveScene(s, k, {
      nights,
      scenes,
      quality,
      served,
      mistakes,
      walkedOut,
    });

    /*
     * What the city says about the week that just happened. A stream of its
     * own, like the doctor's post roll, so the phone can never disturb the
     * service dice — and an old save without a phone gains one here.
     */
    generateChefWeek(
      k,
      s.week,
      s.r.reputation,
      makeRng((s.seed ^ (s.week * 0x3c6ef372)) >>> 0),
    );

    return out;
  },

  checkSetbacks: (s) => {
    const out: SetbackKind[] = [];
    if (Math.max(s.r.burnout, s.r._burnoutPeak ?? 0) >= 100) out.push("collapse");
    /* In local money, so "insolvent" means the same thing in every city. */
    if (s.r.cash < -40_000 * cityOf(kitchen(s)).spend) out.push("insolvency");
    if (s.r.reputation <= 2 && s.week > 20) out.push("disgrace");
    if (out.includes("collapse")) s.r._burnoutPeak = 0;
    return out;
  },

  validateData: (data) => {
    if (typeof data !== "object" || data === null) return false;
    const k = (data as { kitchen?: unknown }).kitchen;
    if (typeof k !== "object" || k === null) return false;
    const st = k as KitchenState;
    if (!PREMISES_BY_ID.has(st.premises)) return false;
    if (!Array.isArray(st.larder) || !Array.isArray(st.staff)) return false;
    if (st.larder.some((l) => !PRODUCE_BY_ID.has(l.produce))) return false;
    /* Optional, like the fleet: undefined is a valid older save. */
    if (
      st.equipment !== undefined &&
      (!Array.isArray(st.equipment) ||
        st.equipment.some((e) => !KIT_BY_ID.has(e)))
    ) {
      return false;
    }
    if (st.staff.some((x) => !ROLE_BY_ID.has(x.role))) return false;
    /* Every attribute is optional — an older cook simply reads as average —
       but a present one has to be a number in range. */
    if (
      st.staff.some((x) =>
        [x.skill, x.morale, x.loyalty].some(
          (v) => v !== undefined && (typeof v !== "number" || v < 0 || v > 100),
        ),
      )
    ) {
      return false;
    }
    /* Optional, like the kit: an older save simply has no book. */
    if (st.policy !== undefined && !POLICY_BY_ID.has(st.policy)) return false;
    /*
     * Phase 2's own fields. All optional, all checked when present: a trait
     * the catalogue does not have would render a blank line on a card and
     * apply nothing, and a fatigue of 400 would make somebody permanently
     * useless with no way back.
     */
    if (
      st.staff.some(
        (x) =>
          [x.fatigue, x.experience, x.training].some(
            (v) => v !== undefined && (typeof v !== "number" || v < 0),
          ) ||
          (x.traits !== undefined &&
            (!Array.isArray(x.traits) ||
              x.traits.some((t) => !TRAIT_BY_ID.has(t)))) ||
          (x.restingUntil !== undefined && typeof x.restingUntil !== "number"),
      )
    ) {
      return false;
    }
    if (st.service !== undefined) {
      if (typeof st.service !== "object" || st.service === null) return false;
      if (
        Object.keys(st.service).some(
          (key) => !POLICY_NOTES.some((p) => p.id === key),
        )
      ) {
        return false;
      }
    }
    /* The shortlist is optional too, and holds people who have not been
       hired yet. A malformed one would put a nameless cook on the payroll. */
    if (st.shortlist !== undefined) {
      if (!Array.isArray(st.shortlist)) return false;
      for (const c of st.shortlist) {
        if (
          typeof c !== "object" ||
          c === null ||
          typeof c.id !== "string" ||
          typeof c.name !== "string" ||
          !ROLE_BY_ID.has(c.role) ||
          typeof c.salary !== "number" ||
          !Number.isFinite(c.salary) ||
          typeof c.skill !== "number" ||
          !Number.isFinite(c.skill) ||
          !Array.isArray(c.traits)
        ) {
          return false;
        }
      }
    }

    /* The phone is optional — a save from before it existed simply has none —
       but a present one has to hold the shapes the handset renders. */
    /* The shared validator: the sketch this replaces accepted malformed
       messages and out-of-range answers. Optional stays optional. */
    if (st.phone !== undefined && !validatePhone(st.phone)) return false;
    /* Same again for the city: absent means Lyon, present means real. */
    if (st.city !== undefined && !KITCHEN_CITY_BY_ID.has(st.city)) return false;
    if (
      st.suppliers !== undefined &&
      (typeof st.suppliers !== "object" ||
        Object.keys(st.suppliers).some((id) => !SUPPLIER_BY_ID.has(id)))
    ) {
      return false;
    }

    /*
     * THE DISHES LAYER
     *
     * All three fields are optional, and absent is the correct reading of
     * every save written before this feature: no pantry, no menu, and the
     * dishes any cook already knows. What is *present* has to be real —
     * a menu naming a recipe the catalogue does not have would render a
     * blank row and cook nothing, which is worse than refusing the save.
     */
    if (st.pantry !== undefined) {
      if (!Array.isArray(st.pantry)) return false;
      if (
        st.pantry.some(
          (l) =>
            !INGREDIENT_BY_ID.has(l?.ingredient) ||
            typeof l.qty !== "number" ||
            !Number.isFinite(l.qty) ||
            /* The one invariant the whole inventory rests on. */
            l.qty < 0 ||
            typeof l.unitCost !== "number" ||
            !Number.isFinite(l.unitCost),
        )
      ) {
        return false;
      }
    }
    if (st.recipes !== undefined) {
      if (!Array.isArray(st.recipes)) return false;
      if (
        st.recipes.some(
          (p) =>
            !RECIPE_BY_ID.has(p?.id) ||
            typeof p.served !== "number" ||
            p.served < 0 ||
            typeof p.refined !== "number" ||
            p.refined < 0 ||
            (p.name !== undefined && typeof p.name !== "string"),
        )
      ) {
        return false;
      }
    }
    if (st.menu !== undefined) {
      if (!Array.isArray(st.menu)) return false;
      if (
        st.menu.some(
          (e) =>
            !RECIPE_BY_ID.has(e?.recipe) ||
            typeof e.price !== "number" ||
            !Number.isFinite(e.price) ||
            e.price < 0,
        )
      ) {
        return false;
      }
    }

    /*
     * WHAT THE CITY THINKS
     *
     * Ten more optional fields, and absent is the correct reading of every
     * save written before this phase: no breakdown, no reviews, no rivals,
     * and a reputation that is exactly the single number it always was.
     *
     * What is *present* has to be real, and the bounds are checked as well as
     * the shapes: a standing of 4,000 would render a bar off the side of the
     * screen and make the restaurant untouchable, and an unbounded log would
     * grow a save without limit.
     */
    const num = (v: unknown, min: number, max: number): boolean =>
      typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

    if (st.standing !== undefined) {
      if (typeof st.standing !== "object" || st.standing === null) return false;
      for (const [id, value] of Object.entries(st.standing)) {
        if (!STANDING_BY_ID.has(id as StandingId)) return false;
        if (!num(value, 0, 100)) return false;
      }
    }
    if (st.repLog !== undefined) {
      if (!Array.isArray(st.repLog) || st.repLog.length > MAX_STANDING_LOG) {
        return false;
      }
      if (
        st.repLog.some(
          (c) =>
            !STANDING_BY_ID.has(c?.id) ||
            typeof c.week !== "number" ||
            typeof c.delta !== "number" ||
            !Number.isFinite(c.delta) ||
            typeof c.why !== "string",
        )
      ) {
        return false;
      }
    }
    if (st.repTrend !== undefined) {
      if (!Array.isArray(st.repTrend) || st.repTrend.length > MAX_STANDING_TREND) {
        return false;
      }
      if (
        st.repTrend.some(
          (t) =>
            typeof t?.week !== "number" ||
            typeof t.scores !== "object" ||
            t.scores === null ||
            Object.entries(t.scores).some(
              ([id, v]) => !STANDING_BY_ID.has(id as StandingId) || !num(v, 0, 100),
            ),
        )
      ) {
        return false;
      }
    }
    if (st.qualityLog !== undefined) {
      if (!Array.isArray(st.qualityLog) || st.qualityLog.length > 16) return false;
      if (st.qualityLog.some((q) => !num(q, 0, 100))) return false;
    }
    if (st.reviews !== undefined) {
      if (!Array.isArray(st.reviews) || st.reviews.length > MAX_REVIEWS) {
        return false;
      }
      if (
        st.reviews.some(
          (r) =>
            typeof r?.id !== "string" ||
            typeof r.week !== "number" ||
            typeof r.author !== "string" ||
            typeof r.body !== "string" ||
            !num(r.rating, 0, 5) ||
            !Array.isArray(r.tags),
        )
      ) {
        return false;
      }
    }
    if (st.complaints !== undefined) {
      if (!Array.isArray(st.complaints) || st.complaints.length > MAX_COMPLAINTS) {
        return false;
      }
      if (
        st.complaints.some(
          (c) =>
            typeof c?.id !== "string" ||
            typeof c.week !== "number" ||
            typeof c.author !== "string" ||
            typeof c.body !== "string" ||
            typeof c.accurate !== "boolean" ||
            !STANDING_BY_ID.has(c.about) ||
            !num(c.reach, 0, 10_000_000) ||
            (c.answered !== undefined && !RESPONSE_BY_ID.has(c.answered)),
        )
      ) {
        return false;
      }
    }
    if (st.buzz !== undefined) {
      const b = st.buzz;
      if (typeof b !== "object" || b === null) return false;
      if (!num(b.interest, 0, 3) || !num(b.expectation, 0, 100)) return false;
      if (
        !Array.isArray(b.postWeeks) ||
        !Array.isArray(b.promoted) ||
        !Array.isArray(b.claims)
      ) {
        return false;
      }
      if (b.promoted.some((x) => !RECIPE_BY_ID.has(x?.recipe))) return false;
      if (b.claims.some((c) => !STANDING_BY_ID.has(c?.about))) return false;
    }
    if (st.rivals !== undefined) {
      if (!Array.isArray(st.rivals) || st.rivals.length > 6) return false;
      if (
        st.rivals.some(
          (r) =>
            typeof r?.id !== "string" ||
            typeof r.name !== "string" ||
            !num(r.reputation, 0, 100) ||
            !STRATEGY_BY_ID.has(r.strategy) ||
            !STANDING_BY_ID.has(r.strength) ||
            !STANDING_BY_ID.has(r.weakness) ||
            !Array.isArray(r.targets),
        )
      ) {
        return false;
      }
    }
    if (st.criticWatch !== undefined) {
      const w = st.criticWatch;
      if (typeof w !== "object" || w === null) return false;
      if (!CRITIC_BY_ID.has(w.critic)) return false;
      if (typeof w.dueWeek !== "number" || !Array.isArray(w.clues)) return false;
    }
    if (st.verdicts !== undefined) {
      if (!Array.isArray(st.verdicts) || st.verdicts.length > MAX_VERDICTS) {
        return false;
      }
      if (
        st.verdicts.some(
          (v) => !CRITIC_BY_ID.has(v?.critic) || !num(v.score, 0, 100),
        )
      ) {
        return false;
      }
    }
    /*
     * THE CRAFT, THE CELLAR, THE GUIDE AND THE WORK OUTSIDE
     *
     * Eight more optional fields. Absent is what every save written before
     * Phase 4 says, and it is true of those runs: that chef had learned no
     * technique, held no wine, had no stars and had been offered nothing.
     *
     * What is present is checked for range as well as shape. A technique at
     * 900 points would be permanently unlearnable-past; a star count of 40
     * would multiply every cover in the restaurant by a number the guide
     * cannot produce.
     */
    if (st.techniques !== undefined) {
      if (typeof st.techniques !== "object" || st.techniques === null) {
        return false;
      }
      for (const [id, value] of Object.entries(st.techniques)) {
        const t = TECHNIQUE_BY_ID.get(id);
        if (!t) return false;
        if (!num(value, 0, t.cost)) return false;
      }
    }
    if (st.stages !== undefined) {
      if (!Array.isArray(st.stages)) return false;
      if (st.stages.some((id) => !STAGE_BY_ID.has(id))) return false;
    }
    if (st.stagingUntil !== undefined && typeof st.stagingUntil !== "number") {
      return false;
    }
    if (st.practising !== undefined && !TECHNIQUE_BY_ID.has(st.practising)) {
      return false;
    }
    if (st.cellar !== undefined) {
      if (!Array.isArray(st.cellar)) return false;
      if (
        st.cellar.some(
          (lot) =>
            !WINE_BY_ID.has(lot?.wine) ||
            typeof lot.id !== "string" ||
            /* The invariant the whole cellar rests on, exactly as the
               pantry's is. */
            !num(lot.bottles, 0, 10_000) ||
            typeof lot.unitCost !== "number" ||
            !Number.isFinite(lot.unitCost) ||
            typeof lot.boughtWeek !== "number",
        )
      ) {
        return false;
      }
    }
    if (st.stars !== undefined && !num(st.stars, 0, 3)) return false;
    if (st.guide !== undefined) {
      if (!Array.isArray(st.guide) || st.guide.length > MAX_GUIDE_RECORDS) {
        return false;
      }
      if (
        st.guide.some(
          (g) =>
            typeof g?.week !== "number" ||
            !num(g.from, 0, 3) ||
            !num(g.to, 0, 3) ||
            !num(g.score, 0, 100) ||
            typeof g.note !== "string",
        )
      ) {
        return false;
      }
    }
    if (st.ventures !== undefined) {
      const v = st.ventures;
      if (typeof v !== "object" || v === null) return false;
      if (!Array.isArray(v.done)) return false;
      if (v.done.some((id) => !VENTURE_BY_ID.has(id))) return false;
      if (!num(v.royalties, 0, 1_000_000)) return false;
      if (v.active !== null && v.active !== undefined) {
        const def = VENTURE_BY_ID.get(v.active.id);
        if (!def) return false;
        if (!num(v.active.weeksLeft, 0, def.weeks)) return false;
        if (typeof v.active.startedWeek !== "number") return false;
      }
    }

    if (st.awards !== undefined) {
      if (!Array.isArray(st.awards)) return false;
      if (
        st.awards.some(
          (a) => typeof a?.label !== "string" || typeof a.week !== "number",
        )
      ) {
        return false;
      }
    }

    return true;
  },

  scoreboard: (s) => {
    const k = kitchen(s);
    const stars = starsOf(k);
    return {
      label: "The business",
      value: money(kitchenWorth(s)),
      /* What you are worth, and what you *are* — the two numbers a chef in
         this trade is actually measured by, in that order. */
      sub: `${money(s.r.cash)} cash · ${chefRank(k, s.r.reputation).label}${
        stars > 0 ? ` · ${stars} star${stars === 1 ? "" : "s"}` : ""
      }`,
    };
  },

  briefing: (s, alloc) => {
    const k = kitchen(s);
    const prep = alloc.prep ?? 0;
    const food = larderCovers(k);

    const chosen = SERVICES.map((sv) => ({ sv, blocks: alloc[sv.id] ?? 0 })).filter(
      (x) => x.blocks > 0,
    );

    /*
     * The forecast, per service, as the player will see it before ordering.
     * Prep raises what the brigade can plate, so it is folded into the skill
     * figure the forecast is built from rather than applied afterwards.
     */
    /* What the week is short of, and what arrives whatever happens. */
    const running = venturesOf(k).active;
    const royalty = localRoyalties(k);

    const forecasts = chosen.map((x) => {
      /* The scene the week will actually resolve against, so the number in the
         briefing and the number in the ledger come from the same place. */
      const scene = sceneFor(k, s.r.reputation, s.week, x.sv.id);
      return forecastFor(
        k,
        s.r.reputation,
        x.sv,
        x.blocks,
        s.r.skill * (1 + prep * 0.18),
        { demand: scene.demand, drivers: scene.drivers },
      );
    });

    const low = forecasts.reduce((n, f) => n + f.low, 0);
    const high = forecasts.reduce((n, f) => n + f.high, 0);
    const booked = forecasts.reduce((n, f) => n + f.reservations - f.noShows, 0);

    const expiring = k.larder
      .filter((l) => {
        const p = PRODUCE_BY_ID.get(l.produce);
        return (
          p && s.week - l.boughtWeek >= p.shelfLife + extraShelfLife(k)
        );
      })
      .reduce((n, l) => n + l.left, 0);

    /* The binding constraint of the busiest service is the one worth naming. */
    const worst =
      [...forecasts].sort((a, b) => b.high - a.high)[0] ?? null;

    const shut = SERVICES.map((sv) => ({
      sv,
      why: serviceBlocker(sv, k, s.r.skill),
    })).filter((x) => x.why);

    /*
     * The menu, checked against the pantry at the covers actually forecast.
     *
     * `planDishes` is what the night will do; `consumeForCovers` is what the
     * pantry can carry. This asks the same question without taking anything,
     * so the warning a player sees before committing is produced by the code
     * that will decide it afterwards.
     */
    const menu = menuFactors(k, s.r.skill);
    const short = menuShortfalls(k, high, s.week, s.r.skill).map((x) => ({
      dish: x.dish,
      name: INGREDIENT_BY_ID.get(x.ingredient)?.name ?? x.ingredient,
    }));

    return [
      {
        label: "Covers expected",
        value: chosen.length === 0 ? "Not opening" : `${low}–${high}`,
        tone: chosen.length > 0 ? "good" : "neutral",
        note: worst ? worst.binding : "You have not opened a service.",
      },
      {
        label: "Already booked",
        value: booked > 0 ? `${booked} covers` : "Nothing in the book",
        tone: booked > 0 ? "good" : "neutral",
        note:
          booked > 0
            ? `${policyOf(k).label} — this many are promised before the night.`
            : `${policyOf(k).label} — every cover depends on who walks in.`,
      },
      {
        label: "Food in the larder",
        value: `${food} covers`,
        tone: food < low ? "bad" : "neutral",
        note:
          food < low
            ? "Short of the forecast. Order, or you will turn people away."
            : expiring > 0
              ? `${expiring} covers go in the bin next week — lunch moves the most.`
              : "Enough for the week as forecast.",
      },
      /*
       * The menu, and whether the pantry can actually cook it.
       *
       * Stated before the week is committed because that is when it can still
       * be fixed: a dish with nothing to make it from serves nobody, and the
       * covers fall through to the plain staple at a worse plate.
       */
      {
        label: "On the menu",
        value:
          menu.dishes === 0
            ? "Nothing — staple only"
            : `${menu.dishes} dish${menu.dishes === 1 ? "" : "es"}`,
        tone: menu.dishes === 0 ? "neutral" : short.length > 0 ? "bad" : "good",
        note:
          menu.dishes === 0
            ? "Every cover is the crate on its own. Develop a dish and put it on."
            : short.length > 0
              ? `Short of ${short[0].name} — ${short[0].dish} cannot go out.`
              : `${menu.variety} course${menu.variety === 1 ? "" : "s"}, priced at ${pct(menu.priceIndex)} of what this room expects.`,
      },
      /*
       * What you are not doing this week, and what arrives anyway.
       *
       * Only shown when one of the two is true: a briefing line that says
       * "no venture, no royalties" every week for a hundred and fifty weeks
       * is noise, and this panel is the one the player reads before
       * committing.
       */
      ...(running || royalty > 0
        ? [
            {
              label: running ? "Away from the pass" : "Royalties",
              value: running
                ? `${running.weeksLeft} week${running.weeksLeft === 1 ? "" : "s"} left`
                : `${money(royalty)} a week`,
              tone: (running ? "bad" : "good") as "good" | "bad",
              note: running
                ? `${VENTURE_BY_ID.get(running.id)?.label ?? "A commitment"} — ${VENTURE_BY_ID.get(running.id)?.blocks ?? 0} block${(VENTURE_BY_ID.get(running.id)?.blocks ?? 0) === 1 ? "" : "s"} a week gone from your own kitchen.${royalty > 0 ? ` ${money(royalty)} of royalties arrives regardless.` : ""}`
                : "Money that arrives whether or not you open the doors.",
            },
          ]
        : []),
      {
        label: "Weekly outgoings",
        value: money(weeklyOutgoings(k)),
        tone: "neutral",
        note:
          shut.length > 0
            ? `Charged whether or not you open. ${shut[0].sv.label}: ${shut[0].why}`
            : "Charged whether or not you open.",
      },
    ];
  },

  objective: (s) => {
    const goal = goalFor(s);
    return {
      text: `Clear the fit-out loan and build a business worth ${money(goal)} in ${cityOf(kitchen(s)).name}. Order badly for long enough and neither happens.`,
      progress: Math.max(0, Math.min(1, kitchenWorth(s) / goal)),
    };
  },
};

export const CHEF_GOAL = GOAL;
export {
  PREMISES as CHEF_PREMISES,
  PRODUCE as CHEF_PRODUCE,
  KITCHEN_ROLES,
  KITCHEN_KIT,
  BOOKING_POLICIES,
  SUPPLIERS,
};
