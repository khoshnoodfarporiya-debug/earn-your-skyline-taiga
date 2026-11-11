import type { CareerDef, LedgerLine, RunState } from "../types";
import { pushLog } from "../engine";

import { hasMilestone, mark } from "../timeline";
import {
  canPractise,
  setbackEffects,
  type SetbackKind,
} from "../setbacks";
import { ethicsDrift, loyaltyDrift } from "../traits";
import {
  applyRep,
  attritionRisk,
  hiringBonus,
  opportunityScore,
  panelTrustFactor,
  readRep,
  INITIAL_REPUTATION,
} from "../reputation";
import { CAST_BY_ID, FULL_CAST, newArrivals } from "../medical/cast";
import { CHAIN_EVENTS } from "../medical/chains";
import {
  phase2Command,
  phase2Command2,
  runPhase2,
  workContracts,
} from "../medical/phase2";
import { weeksOfCover } from "../medical/supplies";
import { cultureScore, productivityFactor } from "../medical/culture";
import { effectiveFee, marketOf } from "../medical/economy";
import {
  initialPerson,
  personIn,
  remembers,
  touchPerson,
  type PersonRole,
} from "../people";
import {
  EQUIPMENT_BY_ID,
  FACILITY_BY_ID,
  ROLE_BY_ID,
  SPECIALTY_BY_ID,
  nonDoctorName,
  staffName,
} from "../medical/data";
import {
  activeCities,
  assetValue as medAssetValue,
  capacityIn,
  catchmentIn,
  computeCapacity,
  departmentSlots,
  facilityPrice,
  generateCases,
  payroll,
  resolveCases,
  slotsIn,
  totalPanel,
  weeklyUpkeep as medUpkeep,
} from "../medical/sim";
import {
  CITIES,
  CITY_BY_ID,
  HOME_CITY,
  cityOf,
  populationCeiling,
} from "../medical/cities";
import {
  OUTBREAKS,
  OUTBREAK_BY_ID,
  outbreakPressure,
  severityCeiling,
} from "../medical/outbreaks";
import { validateMedicalData } from "../medical/validate";
import { totalOutstanding } from "../finance";
import { FLEET_BY_ID } from "../medical/fleet";
import {
  canPostThisWeek,
  generateWeek,
  initialPhone,
  postContext,
  reactionsFor,
  MAX_FEED,
  MAX_MESSAGES,
  MAX_NEWS,
} from "../medical/phone";
import { POST_BY_ID } from "../medical/posts";
import {
  applySocial,
  commsHazardFactor,
  commsReachBonus,
  commsScrutinyRelief,
  scrutinyRisk,
  sentimentCatchment,
  trustRecruitBonus,
} from "../medical/social";
import {
  TIER_BY_ID,
  consumptionFor,
  drawSupplies,
  initialSupplies,
  supplyThrottle,
  tierCost,
  tierStock,
} from "../medical/supplies";
import { makeRng } from "../rng";
import {
  CAMPAIGN_BY_ID,
  marketingSpend,
} from "../medical/marketing";
import {
  QUALIFICATION_BY_ID,
  enrolBlocker,
  holds,
  recruitBonus,
} from "../medical/progression";
import {
  LIFESTYLE_BY_ID,
  bonusTimeBlocks,
  burnoutRelief,
  lifestyleUpkeep,
  lifestyleValue,
  restBonus,
  statusOf,
  supersedes,
} from "../medical/lifestyle";
import type {
  CampaignId,
  CaseResult,
  CityId,
  CityReport,
  MedicalState,
  PhoneMessage,
  SpecialtyId,
  StaffRoleId,
  TriagePolicy,
} from "../medical/types";
import { weekRng } from "../rng";

/**
 * THE PHYSICIAN
 *
 * You start as one doctor in one rented room and finish, if it goes well,
 * running a regional hospital.
 *
 * The rule that makes this career its own game: **you cannot treat what you
 * are not equipped to treat.** Cases arrive whether or not you can handle
 * them — a stroke walks in and either you have a CT scanner, an ICU bed and a
 * neurologist, or you refer it out and watch the reputation cost. Growth is
 * not "buy the next tier"; it is deciding which medicine you are actually in
 * the business of practising.
 *
 * Capacity needs three things at once, and the scarcest one binds:
 *   - SPACE     (facilities)  — the rooms exist or they don't
 *   - PEOPLE    (staff)       — someone has to do the work
 *   - CAPABILITY(dept + kit)  — the department is open and the machine is on
 *
 * Your own hours matter enormously at week 1 and barely at all by week 100.
 * That handover — from doing the work to running the place — is the arc.
 */

const WEEK_LIMIT = 156;
export const LOAN_RATE = 0.0011;
const STARTING_DEBT = 165_000;
const STARTING_CASH = 24_000;

/**
 * What this run actually borrowed to qualify.
 *
 * The training debt is denominated where you trained, so the objective and
 * the milestone read it from the run rather than from the constant. A save
 * written before the choice existed has no `_startDebt` and falls back to the
 * figure it was written with, which is the right answer for it.
 */
export const startDebtOf = (s: RunState): number =>
  s.r._startDebt && s.r._startDebt > 0 ? s.r._startDebt : STARTING_DEBT;
const NET_WORTH_GOAL = 2_500_000;

/**
 * What the practice has to be worth, in the money of the market you are in.
 *
 * Lyon is 1.0, so the figure every published balance number was measured
 * against is unchanged. A practice billing at 0.4× in Lagos is not asked to
 * reach a New York number.
 */
export const goalFor = (s: RunState): number =>
  Math.round(NET_WORTH_GOAL * cityOf(med(s).homeCity).feeIndex);

// ---------------------------------------------------------------- helpers

export const med = (s: RunState) => s.data.med as MedicalState;

/** Positive lines only — what an administrator would actually take a cut of. */
const ledgerIncome = (ledger: LedgerLine[]) =>
  ledger.reduce((n, l) => n + Math.max(0, l.amount ?? 0), 0);

/**
 * Cast roles onto the phone's existing message roles.
 *
 * The phone had six roles before the cast existed and they are baked into the
 * save contract, so this maps rather than widening that enum — a new value
 * there would reject every existing save for no gain.
 */
const MESSAGE_ROLE_FOR: Record<PersonRole, PhoneMessage["role"]> = {
  mentor: "peer",
  rival: "rival",
  manager: "staff",
  colleague: "peer",
  employee: "staff",
  partner: "peer",
  friend: "peer",
  romantic: "peer",
  journalist: "journalist",
  investor: "recruiter",
};

/**
 * One message a week, from whoever has the most to say.
 *
 * Priority is by how much the relationship has moved, not by role: the person
 * you just disappointed is more interesting than the person who is fine. A
 * week where nothing moved produces nothing, which is what keeps the inbox
 * worth opening.
 */
function weeklyRelationshipMessage(
  s: RunState,
  m: MedicalState,
): PhoneMessage | null {
  const people = s.people ?? [];
  if (people.length === 0) return null;

  /* Only reacts to something that happened this week or last — otherwise the
     same grievance would be re-sent forever. */
  const fresh = people.filter(
    (p) => p.status !== "gone" && p.recent[0] && p.recent[0].week >= s.week - 1,
  );
  if (fresh.length === 0) return null;

  const worst = [...fresh].sort((a, b) => {
    const score = (p: (typeof fresh)[number]) =>
      (p.recent[0].tone === "bad" ? 2 : p.recent[0].tone === "good" ? 1 : 0) * 100 -
      p.warmth;
    return score(b) - score(a);
  })[0];

  const def = CAST_BY_ID.get(worst.id);
  if (!def) return null;

  const id = `msg.rel.${worst.id}.${s.week}`;
  if (m.phone.messages.some((x) => x.id === id)) return null;

  const tone = worst.recent[0].tone;
  const body =
    tone === "bad"
      ? `I wanted to say this directly rather than let it sit: ${worst.recent[0].text}. I am not going to make a thing of it. I did want you to know I noticed.`
      : tone === "good"
        ? `Just so you know — ${worst.recent[0].text}. It was noticed, and by more people than me.`
        : `${worst.recent[0].text}. Nothing needed from you; I would rather you heard it from me than in a corridor.`;

  return {
    id,
    week: s.week,
    from: def.name,
    handle: `@${def.handle}`,
    role: MESSAGE_ROLE_FOR[worst.role],
    body,
    read: false,
  };
}

/**
 * Milestones the simulation can prove.
 *
 * Every one of these is a state check, not a narration: the entry appears
 * because the thing is true, and `mark` makes the second call a no-op. That
 * is the whole guarantee behind the timeline — no entry exists that the run
 * did not earn.
 */
function recordMilestones(s: RunState, m: MedicalState): void {
  if (s.r.debt <= 0) {
    mark(
      s,
      "debt-clear",
      "money",
      "You cleared your student debt",
      `${money(startDebtOf(s))} gone. Half the objective.`,
    );
  }
  if (netWorth(s) >= 1_000_000) {
    mark(
      s,
      "first-million",
      "money",
      "Net worth passed $1,000,000",
      "The practice is worth more than you owe, by a margin.",
    );
  }

  /*
   * THE OLD WIN CONDITION.
   *
   * Debt clear and a practice worth two and a half million used to write
   * `outcome: won` and stop the game. It is now a milestone: the largest one
   * in the career, celebrated, recorded — and then you carry on, because what
   * a person does after they have already succeeded is the interesting half
   * and the old design threw it away.
   */
  if (s.r.debt <= 0 && netWorth(s) >= goalFor(s)) {
    mark(
      s,
      "the-hospital-is-yours",
      "award",
      "The hospital is yours",
      `Debt-free and worth ${money(netWorth(s))}. ${plural(m.departments.length, "department")}, ${plural(m.staff.length, "person", "people")} on the payroll, and nobody above you.`,
    );
  }
  if (netWorth(s) >= 10_000_000) {
    mark(
      s,
      "ten-million",
      "money",
      "Net worth passed $10,000,000",
      "Well past the point where the money was the reason.",
    );
  }
  if (m.cities.length >= 5) {
    mark(
      s,
      "international",
      "expansion",
      "An international group",
      `${m.cities.length} cities, and somebody else runs most of them.`,
    );
  }
  if (m.phone.postsMade.length >= 1) {
    mark(
      s,
      "first-post",
      "social",
      "You said something in public",
      "The first time you put your name to something outside a consulting room.",
    );
  }
  if (m.phone.social.followers >= 25_000) {
    mark(
      s,
      "went-viral",
      "social",
      "Something you wrote got away from you",
      `${Math.round(m.phone.social.followers).toLocaleString("en-US")} people are now reading what you post.`,
    );
  }
  if (m.facilities.length >= 2) {
    mark(
      s,
      "second-site",
      "business",
      "A second site",
      "More than one room with your name on the door.",
    );
  }
  if (s.r.strikes >= 1) {
    mark(
      s,
      `strike-${s.r.strikes}`,
      "failure",
      s.r.strikes === 1 ? "You lost a claim" : `Claim ${s.r.strikes} lost`,
      "It goes on your record. Three and the licence goes with it.",
    );
  }
  if (s.r.burnout >= 90) {
    mark(
      s,
      "near-collapse",
      "crisis",
      "You nearly stopped",
      "Burnout at ninety. Whatever you were proving, it nearly cost the licence.",
    );
  }
  if (s.r.burnout < 35 && hasMilestone(s, "near-collapse")) {
    mark(
      s,
      "recovered",
      "recovery",
      "You came back from it",
      "Burnout back under thirty-five after nearly going under.",
    );
  }
  if (m.outbreaks.length >= 2) {
    mark(
      s,
      "multi-outbreak",
      "crisis",
      "Two outbreaks at once",
      "Two cities burning in the same week.",
    );
  }
}

/**
 * A block spent on the people in your life goes to whoever has waited longest.
 *
 * Picking the most-neglected person rather than a random one is what makes
 * this block a maintenance action instead of a lottery: the player learns that
 * it always does the useful thing, so the decision is *whether* to spend the
 * block, not who to spend it on. Estranged people are included — showing up
 * after a falling-out is exactly when it counts.
 */
function resolveRelationshipBlocks(s: RunState, blocks: number): void {
  if (blocks <= 0) return;
  applyRep(s, "loyalty", 2 * blocks, "you made time for your team", true);

  const seen = new Set<string>();
  for (let i = 0; i < blocks; i++) {
    const candidates = (s.people ?? []).filter(
      (p) => p.status !== "gone" && !seen.has(p.id),
    );
    if (candidates.length === 0) return;
    candidates.sort((a, b) => a.lastSeen - b.lastSeen);
    const target = candidates[0];
    seen.add(target.id);
    touchPerson(
      s,
      target.id,
      { warmth: 6, trust: 3 },
      s.week - target.lastSeen > 20
        ? "you got back in touch after a long silence"
        : "you made time for them",
      "good",
    );
  }
}

/**
 * A visit lifts the city that is doing worst, not the one you like.
 *
 * The fantasy is a principal who turns up where the problem is; mechanically
 * it stops travel from being a flat multiplier on the biggest site, which
 * would have made it strictly better the larger your empire got.
 */
function resolveTravelBlocks(
  s: RunState,
  m: MedicalState,
  blocks: number,
  ledger: LedgerLine[],
): void {
  if (blocks <= 0) return;
  const away = m.cities.filter((c) => c !== m.homeCity);
  if (away.length === 0) return;

  const worst = [...away].sort(
    (a, b) => (m.panels[a] ?? 0) - (m.panels[b] ?? 0),
  );
  for (let i = 0; i < blocks && i < worst.length; i++) {
    const city = worst[i];
    /* Modest and proportional: a visit is worth about a week of ordinary
       growth in that city, not a step change. */
    m.panels[city] = (m.panels[city] ?? 0) * 1.04 + 6;
    applyRep(s, "patients", 1.2, `you were seen in ${cityOf(city).name}`, true);
    ledger.push({
      label: `Visited ${cityOf(city).name}`,
      note: "the site you had not been to",
      kind: "info",
    });
  }
}

const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

/** "1 department" / "3 departments", for the end-of-run write-up. */
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

export const effectiveSkill = (s: RunState) =>
  s.r.skill * (1 - s.r.burnout / 220);

export const assetValue = (s: RunState) =>
  medAssetValue(med(s)) + lifestyleValue(med(s));

/**
 * What the practice is actually worth.
 *
 * Money you have borrowed is money you owe. That sounds obvious, and it was
 * missing: `outstanding` was subtracted inside `borrowingCapacity` and nowhere
 * else, so a bank facility arrived as pure cash and lifted this figure by the
 * full amount drawn. Since the goal is `debt <= 0 && netWorth >= 2,500,000`,
 * the shortest route to winning was to borrow $900,000 and sit on it — and the
 * balance harness found exactly that, which is most of why the leveraged
 * strategy was the only one "succeeding".
 *
 * The student loan and the bank are both debts and both belong here. Nothing
 * about the borrowing *rules* changed: `borrowingCapacity` reconstructs the
 * gross figure so lenders still lend precisely what they lent before.
 */
export const netWorth = (s: RunState) =>
  s.r.cash + assetValue(s) - s.r.debt - totalOutstanding(s);

export const weeklyCosts = (s: RunState) =>
  medUpkeep(med(s)) +
  payroll(med(s)) +
  marketingSpend(med(s)) +
  lifestyleUpkeep(med(s));

export const capacityOf = (s: RunState, clinicBlocks: number) =>
  computeCapacity(med(s), clinicBlocks, s.r.skill, s.r.burnout);

// ---------------------------------------------------------------- career

export const doctor: CareerDef = {
  id: "doctor",
  label: "Physician",
  tagline:
    "You finished residency $165,000 in debt with one rented exam room and your own two hands.",
  distinctRule:
    "Cases arrive whether or not you can treat them. Every department, machine and specialist you buy decides which medicine you are actually in — and what you have to turn away.",
  icon: "stethoscope",
  available: true,
  weekLimit: WEEK_LIMIT,

  /*
   * Crisis work is paid for out of next week's time, not out of thin air.
   *
   * A crisis choice that costs blocks debits `_crisisBlocks`, and this is
   * where that debt is collected — so "sit down with them" genuinely costs
   * you two blocks of clinic, and the floor of one block means a run can
   * never be frozen out of acting entirely.
   */
  timeBudget: (s) =>
    Math.max(
      1,
      Math.round(
        ((s.r.burnout > 75 ? 5 : 6) +
          bonusTimeBlocks(med(s)) -
          Math.min(3, s.r._crisisBlocks ?? 0)) *
          /* Signed off means signed off. The floor of one block above is what
             keeps a collapsed run playable rather than frozen. */
          setbackEffects(s.setbacks ?? []).blocks,
      ),
    ),

  resources: [
    { id: "cash", label: "Cash", hint: "Money on hand.", format: "money", polarity: "higher-better", display: "stat" },
    { id: "debt", label: "Student debt", hint: "Accrues ~5.7% a year. Clearing it is half the goal.", format: "money", min: 0, polarity: "lower-better", display: "stat" },
    { id: "panel", label: "Active patients", hint: "Everyone registered with your practice — the profession calls this your panel. Roughly 28% of them present in any given week.", format: "int", min: 0, polarity: "higher-better", display: "stat" },
    { id: "burnout", label: "Burnout", hint: "Blunts your skill and your own clinical hours. At 100 you are signed off until you recover.", format: "percent", min: 0, max: 100, polarity: "lower-better", display: "meter" },
    { id: "reputation", label: "Professional credibility", hint: "What other clinicians think of your medicine. Built by outcomes, lost by failures and referrals. Drives panel growth.", format: "percent", min: 0, max: 100, polarity: "higher-better", display: "meter" },
    { id: "skill", label: "Your clinical skill", hint: "Your personal ability. Matters most before you have specialists.", format: "percent", min: 0, max: 100, polarity: "higher-better", display: "meter" },
    { id: "risk", label: "Malpractice risk", hint: "Driven by failed outcomes. Three claims lost and your licence is suspended.", format: "percent", min: 0, max: 100, polarity: "lower-better", display: "meter" },
    { id: "cpd", label: "Learning points", hint: "CPD — continuing professional development. Earned by studying, spent on qualifications. Time rather than money is the gate.", format: "int", min: 0, polarity: "higher-better", display: "stat" },
    { id: "strikes", label: "Claims lost", hint: "Three and your licence is suspended pending review.", format: "int", min: 0, max: 3, polarity: "lower-better", display: "stat" },
    /*
     * The five new standing categories.
     *
     * Declared as resources so they inherit clamping and the NaN guard for
     * free, and so `numberMap(s.r)` in the save validator accepts them without
     * a new rule. `display: "hidden"` keeps them out of the generic meter
     * list — they have their own panel, where each one can carry the reason it
     * moved, which a bare meter cannot.
     */
    { id: "repPatients", label: "Patient trust", hint: "Whether the people in your waiting room believe you are on their side.", format: "percent", min: 0, max: 100, polarity: "higher-better", display: "hidden" },
    { id: "repLoyalty", label: "Staff loyalty", hint: "Whether your team would follow you to the next practice.", format: "percent", min: 0, max: 100, polarity: "higher-better", display: "hidden" },
    { id: "repInfluence", label: "Industry influence", hint: "Whether the profession takes your call.", format: "percent", min: 0, max: 100, polarity: "higher-better", display: "hidden" },
    { id: "repPopularity", label: "Public popularity", hint: "Whether the public has heard of you and likes what it heard.", format: "percent", min: 0, max: 100, polarity: "higher-better", display: "hidden" },
    { id: "repEthics", label: "Ethical standing", hint: "Whether you are believed to be straight with people.", format: "percent", min: 0, max: 100, polarity: "higher-better", display: "hidden" },
  ],

  initialResources: () => ({
    cash: STARTING_CASH,
    debt: STARTING_DEBT,
    _startDebt: STARTING_DEBT,
    panel: 90,
    burnout: 18,
    // `reputation` IS professional credibility. See lib/game/reputation.ts.
    reputation: 45,
    skill: 38,
    risk: 8,
    cpd: 0,
    strikes: 0,
    ...INITIAL_REPUTATION,
  }),

  cast: FULL_CAST,

  /*
   * WHERE YOU TRAINED
   *
   * The fourteen markets were always here; what is new is that one of them can
   * be the one your licence already works in. Nothing about the expansion
   * system changes — `entryCost`, licences and the network map are untouched —
   * you simply start holding a different licence.
   *
   * The effects are read off the existing city table rather than written by
   * hand, so a market cannot advertise a fee index it does not have.
   */
  startCities: CITIES.map((c) => ({
    id: c.id,
    name: c.name,
    country: c.country,
    position: c.id,
    blurb: c.blurb,
    effects: [
      `${Math.round(c.feeIndex * 100)}% on every case you bill`,
      `${Math.round(c.costIndex * 100)}% wages and upkeep`,
      `${Math.round(c.propertyIndex * 100)}% on premises`,
      `${(c.population * 1.3).toFixed(1)}k patients is the ceiling here`,
      `${Math.round(c.competition * 100)}% of the market already spoken for`,
      ...(Object.keys(c.bias).length > 0
        ? [`Sends you more ${Object.keys(c.bias).filter((k) => c.bias[k as SpecialtyId]! > 1).join(", ") || "of its own case mix"}`]
        : []),
    ],
    /*
     * Where you trained is where your money is, so the opening scales with the
     * city (see `applyStartCity`) and difficulty is about the *market*: how
     * much of it incumbents already hold, and how thin the margin between the
     * fees and the costs is.
     */
    difficulty:
      c.feeIndex / c.costIndex >= 1.05 && c.competition <= 0.24
        ? ("gentle" as const)
        : c.feeIndex / c.costIndex < 0.92 || c.competition >= 0.38
          ? ("hard" as const)
          : ("even" as const),
  })),

  applyStartCity: (s, cityId) => {
    const city = CITY_BY_ID.get(cityId as CityId);
    if (!city) return;
    const m = med(s);
    m.facilities = m.facilities.map((f) => ({ ...f, city: city.id }));
    m.cities = [city.id];
    m.homeCity = city.id;
    m.panels = { [city.id]: s.r.panel };

    /*
     * Your training debt and your first month's float are in the money of the
     * place you trained in, and both move together.
     *
     * Without this the fixed $165,000 would be a different animal in every
     * market: two years of billing in Lagos and four months of it in New York.
     * The city is meant to change *what the practice is* — the case mix, the
     * ceiling, who already holds the market — not how long you have before the
     * first bank letter. `_startDebt` is recorded because the objective's
     * progress is measured against what you actually owed.
     */
    s.r.debt = Math.round(STARTING_DEBT * city.costIndex);
    s.r.cash = Math.round(STARTING_CASH * city.costIndex);
    s.r._startDebt = s.r.debt;
  },

  initialData: () => {
    const state: MedicalState = {
      facilities: [
        { id: "f1", type: "room", name: "Rented exam room", city: HOME_CITY },
      ],
      staff: [],
      departments: ["general"],
      equipment: [],
      triage: "urgent",
      lastCases: [],
      qualifications: [{ id: "md", specialty: null }],
      campaigns: [],
      lifestyle: [],
      cities: [HOME_CITY],
      homeCity: HOME_CITY,
      panels: { [HOME_CITY]: 90 },
      lastCityReports: [],
      outbreaks: [],
      solved: [],
      phone: initialPhone(),
      supplies: initialSupplies(),
      /* A new run owns no ambulances. Written explicitly rather than left
         undefined so a fresh save and a migrated one have the same shape. */
      fleet: [],
      nextId: 2,
    };
    return { med: state };
  },

  /** Every purchase and roster change in the game routes through here. */
  command: (s, cmd, arg) => {
    const m = med(s);
    /*
     * Phase 2 owns its own commands. Dispatched first and short-circuiting,
     * so this switch stays the practice's own vocabulary rather than growing
     * a second game inside it.
     */
    if (phase2Command(s, cmd, arg)) return;
    if (
      phase2Command2(s, cmd, arg, {
        netWorth: netWorth(s),
        weeklyRevenue: Math.max(0, s.r._lastRevenue ?? 0),
      })
    ) {
      return;
    }
    switch (cmd) {
      case "triage":
        m.triage = arg as TriagePolicy;
        break;

      case "buyFacility": {
        // arg is "type" (home city) or "type:city".
        const [typeId, cityArg] = arg.split(":") as [string, CityId | undefined];
        const type = FACILITY_BY_ID.get(typeId as never);
        if (!type) return;
        const city = cityArg ?? m.homeCity;
        if (!m.cities.includes(city)) return;
        const price = facilityPrice(type.id, city);
        if (s.r.cash < price) return;
        s.r.cash -= price;
        m.facilities.push({
          id: `f${m.nextId++}`,
          type: type.id,
          name: `${type.label}, ${cityOf(city).name}`,
          city,
        });
        // Opening in a new market is not opening from nothing: a practice
        // with a reputation arrives with patients already waiting. Without
        // this seed the upkeep starts immediately while the panel takes
        // twenty weeks to fill, and expanding reliably bankrupts you.
        if ((m.panels[city] ?? 0) === 0) {
          const arriving = catchmentIn(m, city, s.r.reputation);
          m.panels[city] = arriving * (0.15 + s.r.reputation / 320);
        }
        break;
      }

      case "enterCity": {
        const city = CITY_BY_ID.get(arg as CityId);
        if (!city || m.cities.includes(city.id)) return;
        if (s.r.cash < city.entryCost) return;
        s.r.cash -= city.entryCost;
        m.cities.push(city.id);
        m.panels[city.id] ??= 0;
        mark(
          s,
          m.cities.length === 2 ? "first-city" : `city-${city.id}`,
          "expansion",
          m.cities.length === 2
            ? "You became more than one address"
            : `Opened in ${city.name}`,
          `A licence in ${city.name}. ${m.cities.length} cities now.`,
        );
        /* Expansion is the signal an investor watches for. He is not being
           friendly; he is doing his job, and the player should feel that. */
        touchPerson(
          s,
          "thorne",
          { warmth: 3, respect: 6 },
          `you opened in ${city.name}`,
          "neutral",
        );
        break;
      }

      case "relocate": {
        // Where you personally practise. Your own clinical hours only count
        // in one city, so this is a real choice once the network spreads.
        const city = CITY_BY_ID.get(arg as CityId);
        if (!city || !m.cities.includes(city.id)) return;
        m.homeCity = city.id;
        break;
      }

      case "openDepartment": {
        const spec = SPECIALTY_BY_ID.get(arg as SpecialtyId);
        if (!spec || m.departments.includes(spec.id)) return;
        if (m.departments.length >= departmentSlots(m)) return;
        if (s.r.cash < spec.unlockCost) return;
        s.r.cash -= spec.unlockCost;
        m.departments.push(spec.id);
        break;
      }

      case "buyEquipment": {
        const eq = EQUIPMENT_BY_ID.get(arg as never);
        if (!eq || m.equipment.includes(eq.id)) return;
        if (s.r.cash < eq.cost) return;
        s.r.cash -= eq.cost;
        m.equipment.push(eq.id);
        break;
      }

      case "buyVehicle": {
        const v = FLEET_BY_ID.get(arg);
        if (!v) return;
        /* One of each. A second identical ambulance would be a pure
           multiplier on reach with no new decision attached to it, and the
           three tiers already cover "I want more range". */
        if ((m.fleet ?? []).includes(v.id)) return;
        if (s.r.cash < v.cost) return;
        s.r.cash -= v.cost;
        m.fleet = [...(m.fleet ?? []), v.id];
        break;
      }

      case "hire": {
        // arg is "role" or "role:specialty" for specialised hires.
        const [roleId, specialty] = arg.split(":") as [
          StaffRoleId,
          SpecialtyId | undefined,
        ];
        const role = ROLE_BY_ID.get(roleId);
        if (!role || s.r.cash < role.hireCost) return;
        if (role.specialised && !specialty) return;
        s.r.cash -= role.hireCost;
        const seed = m.nextId++;
        // Who is willing to work for you: your standing in the profession
        // (reputation), your academic weight (doctorate, a chair), and — quite
        // separately — how successful you visibly are (status).
        // Professional trust and a banked hiring announcement both land here.
        // Both are zero on a run that never posts, so the recruit roll is
        // unchanged from before the phone existed.
        const skill = Math.round(
          Math.min(
            97,
            34 +
              s.r.reputation * 0.35 +
              recruitBonus(m) +
              statusOf(m) * 0.12 +
              trustRecruitBonus(m) +
              m.phone.recruitBoost +
              /* Who the profession sends you. Influence gets your call
                 returned; loyalty means the people already here say yes when
                 asked whether it is a good place to work. */
              hiringBonus(s) +
              ((seed * 37) % 17) -
              6,
          ),
        );
        // A hiring post improves the very next recruit, then is spent.
        m.phone.recruitBoost = 0;
        const first = m.staff.length === 0;
        m.staff.push({
          id: `s${seed}`,
          role: roleId,
          // Listed by who *is* a doctor rather than who is not, so a new
          // non-clinical role does not silently inherit the title.
          name: ["gp", "specialist", "surgeon"].includes(roleId)
            ? staffName(seed)
            : nonDoctorName(seed),
          specialty: role.specialised ? (specialty as SpecialtyId) : null,
          skill,
          salary: role.salary,
        });
        if (first) {
          mark(
            s,
            "first-hire",
            "people",
            "You stopped being the whole practice",
            `${m.staff[0].name} joined as your first ${role.label.toLowerCase()}.`,
          );
        }
        break;
      }

      case "fire": {
        const idx = m.staff.findIndex((x) => x.id === arg);
        if (idx === -1) return;
        const [gone] = m.staff.splice(idx, 1);
        // Severance, and people notice how you treat colleagues.
        s.r.cash -= gone.salary * 2;
        s.r.reputation -= 0.4;
        /* The rest of the team watches this happen. Letting someone go is a
           legitimate move and it is never free — which is the whole reason
           loyalty is a separate number from credibility. */
        applyRep(s, "loyalty", -5, `you let ${gone.name} go`);
        touchPerson(
          s,
          "mbeki",
          { warmth: -7, trust: -5, remember: ["saw-a-firing"] },
          `you let ${gone.name} go`,
          "bad",
        );
        break;
      }

      case "payLoan": {
        const amount = Math.min(10_000, s.r.debt, s.r.cash);
        if (amount <= 0) return;
        s.r.cash -= amount;
        s.r.debt -= amount;
        break;
      }

      case "enrol": {
        // arg is "qualificationId" or "qualificationId:specialty".
        const [qid, specialty] = arg.split(":") as [
          string,
          SpecialtyId | undefined,
        ];
        const q = QUALIFICATION_BY_ID.get(qid as never);
        if (!q) return;
        const blocked = enrolBlocker(
          m,
          q,
          s.r.cash,
          s.r.cpd,
          s.r.skill,
          specialty ?? null,
        );
        if (blocked) return;
        s.r.cash -= q.tuition;
        mark(
          s,
          `qual-${q.id}`,
          "qualification",
          q.label,
          `${q.postNominal} — ${q.blurb}`,
        );
        applyRep(s, "influence", 4 + q.cpd * 0.05, `you earned ${q.postNominal}`);
        touchPerson(
          s,
          "hallam",
          { respect: 8, warmth: 3, remember: [`saw-${q.id}`] },
          `you earned ${q.postNominal}`,
          "good",
        );
        s.r.cpd -= q.cpd;
        m.qualifications.push({
          id: q.id,
          specialty: q.specialised ? (specialty as SpecialtyId) : null,
        });
        if (q.id === "doctorate") s.r.reputation += 3;
        if (q.id === "professorship") s.r.reputation += 6;
        break;
      }

      case "toggleCampaign": {
        const c = CAMPAIGN_BY_ID.get(arg as CampaignId);
        if (!c) return;
        const idx = m.campaigns.indexOf(c.id);
        if (idx >= 0) {
          m.campaigns.splice(idx, 1);
          return;
        }
        if (c.minReputation && s.r.reputation < c.minReputation) return;
        if (s.r.cash < c.setupCost) return;
        s.r.cash -= c.setupCost;
        m.campaigns.push(c.id);
        break;
      }

      case "buyLifestyle": {
        const item = LIFESTYLE_BY_ID.get(arg);
        if (!item || m.lifestyle.includes(item.id)) return;
        if (s.r.cash < item.cost) return;
        s.r.cash -= item.cost;
        // A new house replaces the old one, at its retained value.
        for (const oldId of supersedes(m, item)) {
          const old = LIFESTYLE_BY_ID.get(oldId);
          if (old) s.r.cash += old.cost * old.retention;
          m.lifestyle.splice(m.lifestyle.indexOf(oldId), 1);
        }
        m.lifestyle.push(item.id);
        break;
      }

      case "contain": {
        // Cheap and immediate. Blunts the surge without ending it — isolation
        // wards, screening at the door, cancelled elective lists.
        const active = m.outbreaks.find((o) => `${o.id}:${o.city}` === arg);
        if (!active || active.contained) return;
        const def = OUTBREAK_BY_ID.get(active.id);
        if (!def || s.r.cash < def.containCost) return;
        s.r.cash -= def.containCost;
        active.contained = true;
        s.r.burnout += 3;
        break;
      }

      case "research": {
        // Costs your own CPD as well as money: this is you at the bench
        // instead of in clinic. Solves the pathogen permanently.
        const active = m.outbreaks.find((o) => `${o.id}:${o.city}` === arg);
        if (!active) return;
        const def = OUTBREAK_BY_ID.get(active.id);
        if (!def) return;
        if (s.r.cash < def.researchCost || s.r.cpd < def.researchCpd) return;
        s.r.cash -= def.researchCost;
        s.r.cpd -= def.researchCpd;
        s.r.burnout += 8;
        s.r.skill += 2;
        s.r.reputation += 3 + def.severity;
        applyRep(s, "influence", 5 + def.severity, `you published on ${def.pathogen}`);
        applyRep(s, "ethics", 3, "you spent your own time on a public problem");
        mark(
          s,
          `solved-${def.id}`,
          "award",
          `You published on ${def.pathogen}`,
          `${def.label} will not return to any of your cities.`,
        );
        touchPerson(
          s,
          "vasquez",
          { warmth: 12, trust: 10, respect: 14, remember: ["published"] },
          `you published on ${def.pathogen} instead of sitting on it`,
          "good",
        );
        touchPerson(
          s,
          "hallam",
          { respect: 10, trust: 5 },
          "you did the work properly and wrote it up",
          "good",
        );
        if (!m.solved.includes(def.id)) m.solved.push(def.id);
        // Publishing ends it everywhere it is running, not just here.
        m.outbreaks = m.outbreaks.filter((o) => o.id !== def.id);
        break;
      }

      case "vaccinate": {
        // Expensive, needs a dispensing pharmacy, and nothing else moves
        // public standing like ending an epidemic.
        const active = m.outbreaks.find((o) => `${o.id}:${o.city}` === arg);
        if (!active) return;
        const def = OUTBREAK_BY_ID.get(active.id);
        if (!def || def.vaccineCost <= 0) return;
        if (!m.equipment.includes("pharmacy")) return;
        if (s.r.cash < def.vaccineCost) return;
        s.r.cash -= def.vaccineCost;
        s.r.reputation += 5 + def.severity * 1.5;
        applyRep(s, "patients", 8, `you vaccinated ${cityOf(active.city).name}`);
        applyRep(s, "popularity", 10, "you ended an epidemic in public");
        applyRep(s, "ethics", 4, "you paid for it yourself");
        mark(
          s,
          `vaccinated-${def.id}-${active.city}`,
          "award",
          `You vaccinated ${cityOf(active.city).name}`,
          `${def.label}, ended by a programme you funded.`,
        );
        touchPerson(
          s,
          "vasquez",
          { warmth: 15, trust: 12, respect: 10, remember: ["funded-a-programme"] },
          "you funded a vaccination programme she could not",
          "good",
        );
        m.outbreaks = m.outbreaks.filter(
          (o) => !(o.id === active.id && o.city === active.city),
        );
        break;
      }

      case "post": {
        /*
         * The whole Pulse transaction, in the audited command path.
         *
         * Every gate is re-checked here rather than trusted to the composer:
         * a disabled button is a hint, not a rule, and the one-post-per-week
         * limit is the main thing stopping the social layer from being a free
         * lever you pull six times a week.
         */
        const def = POST_BY_ID.get(arg);
        if (!def) return;
        if (!canPostThisWeek(m, s.week)) return;
        if (def.once && m.phone.postsMade.includes(def.id)) return;

        const ctx = postContext(m, { week: s.week, panel: s.r.panel });
        if (!def.available(ctx)) return;

        // A stream of its own, so publishing never disturbs the event rolls.
        const rng = makeRng((s.seed ^ (s.week * 0x2f6f2b79)) >>> 0);
        // A communications manager reads it before it goes out.
        const hazard =
          def.hazard === undefined
            ? undefined
            : def.hazard * commsHazardFactor(m);
        const misfired = hazard !== undefined && rng.chance(hazard);
        const base = misfired && def.backfire ? def.backfire.effect : def.effect;
        // ...and knows how to make it travel.
        const outcome = {
          ...base,
          followers: base.followers
            ? Math.round(base.followers * commsReachBonus(m))
            : base.followers,
        };

        applySocial(m.phone.social, outcome);
        if (outcome.reputation) s.r.reputation += outcome.reputation;
        if (outcome.cpd) s.r.cpd += outcome.cpd;
        if (outcome.panel) s.r._panelPending = (s.r._panelPending ?? 0) + outcome.panel;
        if (outcome.recruitBoost) m.phone.recruitBoost += outcome.recruitBoost;

        const reactions = reactionsFor(
          m,
          { week: s.week, reputation: s.r.reputation },
          rng,
        );
        m.phone.feed = [
          {
            id: `feed.player.${def.id}.${s.week}`,
            week: s.week,
            author: "You",
            handle: "@you",
            kind: "player" as const,
            body: def.body(ctx),
            likes: reactions.likes,
            comments: reactions.comments,
            tone: (misfired ? "bad" : "good") as "bad" | "good",
          },
          ...m.phone.feed,
        ].slice(0, MAX_FEED);

        m.phone.lastPostWeek = s.week;
        if (!m.phone.postsMade.includes(def.id)) m.phone.postsMade.push(def.id);

        if (misfired && def.backfire) {
          m.phone.messages = [
            {
              id: `msg.backfire.${def.id}.${s.week}`,
              week: s.week,
              from: "Professional Standards Board",
              handle: "@standards",
              role: "regulator" as const,
              body: def.backfire.note,
              read: false,
            },
            ...m.phone.messages,
          ].slice(0, MAX_MESSAGES);
          pushLog(s, `Your post backfired. ${def.backfire.note}`, "bad");
        } else {
          pushLog(s, `You posted on Pulse: ${def.label.toLowerCase()}.`, "good");
        }
        break;
      }

      case "buySupplies": {
        // arg is a tier id. Cost is sized from last week's actual draw, so an
        // order always means "this many weeks of cover" rather than a number
        // that stops meaning anything as the practice grows.
        const tier = TIER_BY_ID.get(arg);
        if (!tier) return;
        const cost = tierCost(m, tier.id);
        if (cost <= 0 || s.r.cash < cost) return;
        const added = tierStock(m, tier.id);
        if (added <= 0) return;
        s.r.cash -= cost;
        m.supplies.stock += added;
        // Restocking ends the shortage. Only a delivery that actually put
        // usable stock on the shelf clears it — a refused or unaffordable
        // order leaves the practice throttled, which is what the Supplies
        // screen promises when it says "Restock to clear it".
        m.supplies.throttleWeeks = 0;
        break;
      }

      case "toggleAutoOrder": {
        m.supplies.autoOrder = !m.supplies.autoOrder;
        break;
      }

      case "readMessages": {
        for (const msg of m.phone.messages) msg.read = true;
        break;
      }

      case "readNews": {
        for (const item of m.phone.news) item.read = true;
        break;
      }

      case "answerMessage": {
        // arg is "messageId:choiceIndex".
        const [msgId, rawIndex] = arg.split("|");
        const msg = m.phone.messages.find((x) => x.id === msgId);
        if (!msg || !msg.choices || msg.answered !== undefined) return;
        const index = Number(rawIndex);
        const choice = msg.choices[index];
        if (!choice) return;
        applySocial(m.phone.social, choice.effect);
        if (choice.effect.reputation) s.r.reputation += choice.effect.reputation;
        if (choice.effect.cpd) s.r.cpd += choice.effect.cpd;
        if (choice.effect.recruitBoost) {
          m.phone.recruitBoost += choice.effect.recruitBoost;
        }
        msg.answered = index;
        msg.read = true;
        break;
      }

      case "sellLifestyle": {
        const item = LIFESTYLE_BY_ID.get(arg);
        if (!item || !m.lifestyle.includes(item.id)) return;
        s.r.cash += item.cost * item.retention;
        m.lifestyle.splice(m.lifestyle.indexOf(item.id), 1);
        break;
      }
    }
  },

  actions: [
    {
      id: "clinic",
      label: "See patients yourself",
      blurb: "Take a list of your own. Early on this is most of your capacity.",
      timeCost: 1,
      cashCost: 0,
      preview: (s) => [
        `+${Math.round(10 + s.r.skill / 8)} treatment units`,
        `+${Math.max(2.5, 6.5 - med(s).staff.filter((x) => x.role === "nurse").length * 0.6).toFixed(1)} burnout`,
      ],
    },
    {
      id: "study",
      label: "Study & CME",
      blurb: "Journals, courses, a hard look at your own outcomes.",
      timeCost: 1,
      cashCost: 260,
      preview: () => [
        "+5 your skill",
        "+8 CPD points",
        "-1.5 malpractice risk",
        "+3 burnout",
      ],
    },
    {
      id: "rest",
      label: "Rest",
      blurb: "Close the laptop. The only thing that refills your own tank.",
      timeCost: 1,
      cashCost: 0,
      preview: (s) => [`-${15 + restBonus(med(s))} burnout`],
    },
    {
      id: "manage",
      label: "Run the practice",
      blurb: "Rotas, audits, coding, compliance. Makes the whole building work better.",
      timeCost: 1,
      cashCost: 0,
      preview: () => ["-6 malpractice risk", "+3% staff output this week", "+2.5 burnout"],
    },
    {
      id: "outreach",
      label: "Grow the panel",
      blurb: "Talks, screenings, referral relationships. This is how demand grows.",
      timeCost: 1,
      cashCost: 320,
      preview: (s) => [
        `+${Math.round(14 + s.r.panel * 0.05)} patients, joining next week`,
        "+0.4 credibility",
        "+4 burnout",
      ],
    },
    {
      id: "people",
      label: "See the people who matter",
      blurb:
        "A drink with your old supervisor. Ten minutes with the nurse who has been carrying the rota.",
      timeCost: 1,
      cashCost: 0,
      /* Two is the point at which you have seen everyone who needed seeing.
         A third block would be the player farming warmth, not maintaining a
         relationship. */
      maxPerWeek: 2,
      preview: () => [
        "warmth and trust with whoever needs it most",
        "+2 staff loyalty",
        "−2 burnout",
      ],
    },
    {
      id: "network",
      label: "Work the profession",
      blurb:
        "Committees, conferences, the corridor conversation that decides who gets asked.",
      timeCost: 1,
      cashCost: 180,
      maxPerWeek: 2,
      preview: () => [
        "+1.6 industry influence",
        "opens contracts, chairs and board seats",
        "+2 burnout",
      ],
    },
    {
      id: "exercise",
      label: "Look after yourself",
      blurb:
        "Running, swimming, the gym you keep paying for. Slow, and it compounds.",
      timeCost: 1,
      cashCost: 0,
      maxPerWeek: 2,
      preview: (s) => [
        "−5 burnout now",
        `+1.5 fitness — a permanent −${((s.r._fitness ?? 0) * 0.12).toFixed(1)}/wk on burnout`,
      ],
    },
    {
      id: "content",
      label: "Feed the feed",
      blurb:
        "Replies, captions, being visible. Not the one post that matters — the other six days.",
      timeCost: 1,
      cashCost: 0,
      maxPerWeek: 2,
      unlocked: (s) => s.week >= 4,
      preview: () => [
        "+2.2 public popularity",
        "wider catchment, more reach on what you publish",
        "+1.5 burnout",
      ],
    },
    {
      id: "casework",
      label: "Work your live cases",
      blurb:
        "The contracts you took on. They do not progress because you accepted them.",
      timeCost: 1,
      cashCost: 0,
      maxPerWeek: 3,
      /* Only when there is something to work on. An action that does nothing
         is worse than an action that is absent. */
      unlocked: (s) => (s.contracts ?? []).length > 0,
      preview: (s) => {
        const live = (s.contracts ?? []).length;
        return [
          `progress on ${live} live ${live === 1 ? "assignment" : "assignments"}`,
          "unworked assignments fail on their deadline",
        ];
      },
    },
    {
      id: "travel",
      label: "Visit another site",
      blurb:
        "Be in the building. Sign things in person. Remind them you exist.",
      timeCost: 1,
      cashCost: 900,
      maxPerWeek: 2,
      /* Pointless with one site, so it is not offered until there are two —
         an action that does nothing is worse than an action that is absent. */
      unlocked: (s) => med(s).cities.length >= 2,
      preview: () => [
        "lifts one other city's panel and staff",
        "+2 patient trust there",
        "+3.5 burnout",
      ],
    },
  ],

  applyAction: (s, id) => {
    const m = med(s);
    switch (id) {
      case "clinic": {
        const nurses = m.staff.filter((x) => x.role === "nurse").length;
        s.r.burnout += Math.max(2.5, 6.5 - nurses * 0.6);
        s.r._clinicBlocks = (s.r._clinicBlocks ?? 0) + 1;
        break;
      }
      case "study":
        s.r.skill += 5;
        s.r.cpd += 8;
        s.r.risk -= 1.5;
        s.r.burnout += 3;
        break;
      case "rest":
        s.r.burnout -= 15 + restBonus(m);
        break;
      case "manage":
        s.r.risk -= 6;
        s.r.burnout += 2.5;
        s.r._manageBlocks = (s.r._manageBlocks ?? 0) + 1;
        break;
      case "outreach":
        // Registrations land on next week's list, not this one, so the
        // forecast the player was just shown stays true.
        s.r._panelPending = (s.r._panelPending ?? 0) + 14 + s.r.panel * 0.05;
        s.r.reputation += 0.4;
        s.r.burnout += 4;
        break;

      /* ------------------------------------------------------ new blocks
       *
       * Each of these exists because a reputation category or a relationship
       * had no way to be moved deliberately. A category the player can only
       * watch is a scoreboard; a category with a block attached to it is a
       * decision about what kind of career this is.
       *
       * All five are capped per week. Without caps the dominant line is
       * always "put six blocks into whichever number is currently cheapest",
       * which is not a plan, it is an exploit — and the balance harness would
       * find it before the player did.
       */

      case "network":
        /* Who takes your call. Deliberately slow: influence is the category
           that gates chairs, contracts and investor interest, so buying it
           quickly would trivialise the back half of the run. */
        applyRep(s, "influence", 1.6, "time spent with the profession", true);
        s.r._networkBlocks = (s.r._networkBlocks ?? 0) + 1;
        s.r.burnout += 2;
        break;

      case "exercise":
        /* The only block that lowers the burnout *floor* rather than the
           current value: rest treats the symptom, this raises the ceiling.
           Capped at two so it cannot substitute for rest entirely. */
        s.r.burnout -= 5;
        s.r._fitness = Math.min(20, (s.r._fitness ?? 0) + 1.5);
        break;

      case "people":
        /* Relationships. Handled in resolveWeek, where it can pick the
           person who most needs it rather than a random one. */
        s.r._peopleBlocks = (s.r._peopleBlocks ?? 0) + 1;
        s.r.burnout -= 2;
        break;

      case "content":
        /* Public profile, without opening the phone. The phone's one-post-a-
           week rule is untouched: this is the unglamorous half — replying,
           captioning, being visible — and it moves popularity, not reach. */
        applyRep(s, "popularity", 2.2, "steady public presence", true);
        s.r._contentBlocks = (s.r._contentBlocks ?? 0) + 1;
        s.r.burnout += 1.5;
        break;

      case "casework":
        /* Accumulated rather than applied per unit: `workContracts` needs the
           whole week's blocks at once so it can spend them on the deadline
           that is closest, which a per-unit call cannot see. */
        s.r._caseworkBlocks = (s.r._caseworkBlocks ?? 0) + 1;
        break;

      case "travel":
        /* Only useful with somewhere to go. Being present in a city you own
           lifts its own numbers, which is what stops a fourteen-city empire
           from running itself. */
        s.r._travelBlocks = (s.r._travelBlocks ?? 0) + 1;
        s.r.burnout += 3.5;
        break;
    }
  },

  resolveWeek: (s, rng) => {
    const m = med(s);
    const ledger: LedgerLine[] = [];
    const clinicBlocks = s.r._clinicBlocks ?? 0;
    const manageBlocks = s.r._manageBlocks ?? 0;
    const peopleBlocks = s.r._peopleBlocks ?? 0;
    const networkBlocks = s.r._networkBlocks ?? 0;
    const contentBlocks = s.r._contentBlocks ?? 0;
    const travelBlocks = s.r._travelBlocks ?? 0;
    s.r._clinicBlocks = 0;
    s.r._manageBlocks = 0;
    s.r._peopleBlocks = 0;
    s.r._networkBlocks = 0;
    s.r._contentBlocks = 0;
    s.r._travelBlocks = 0;

    /*
     * BLOCKS THAT NEED THE WHOLE WEEK
     *
     * `applyAction` runs once per unit and cannot see the run — it does not
     * know which colleague has been neglected longest or which city is
     * furthest behind. These resolve here, where they can pick.
     */
    resolveRelationshipBlocks(s, peopleBlocks);
    workContracts(s, s.r._caseworkBlocks ?? 0);
    s.r._caseworkBlocks = 0;
    resolveTravelBlocks(s, m, travelBlocks, ledger);
    if (networkBlocks > 0 || contentBlocks > 0) {
      // The soft edge of both: they warm the people whose whole job is being
      // reachable, which is how a networking habit turns into an opportunity.
      if (networkBlocks > 0) {
        touchPerson(
          s,
          "duarte",
          { warmth: 1.5 * networkBlocks, respect: 1 * networkBlocks },
          "you have been showing up to things",
          "good",
        );
      }
      if (contentBlocks > 0) {
        touchPerson(
          s,
          "raman",
          { warmth: 0.8 * contentBlocks, trust: 0.5 * contentBlocks },
          "you are easier to reach than most clinicians",
          "neutral",
        );
      }
    }

    // --- outbreaks -------------------------------------------------------
    // Tick down what is running, then decide whether something new starts.
    // This happens before the caseload so a new outbreak surges immediately.
    const cityList = activeCities(m);
    for (const active of m.outbreaks) {
      const def = OUTBREAK_BY_ID.get(active.id);
      if (!def) continue;
      // Containment buys time as well as blunting the surge.
      active.weeksLeft -= active.contained ? 0.6 : 1;
      s.r.risk += def.riskPerWeek * (active.contained ? 0.4 : 1);
      s.r.reputation += def.reputationPerWeek * (active.contained ? 0.4 : 1);
    }
    const ended = m.outbreaks.filter((o) => o.weeksLeft <= 0);
    m.outbreaks = m.outbreaks.filter((o) => o.weeksLeft > 0);
    for (const gone of ended) {
      const def = OUTBREAK_BY_ID.get(gone.id);
      ledger.push({
        label: `${def?.label ?? "Outbreak"} has burned out`,
        note: `${cityOf(gone.city).name} · it ran its course`,
        kind: "info",
      });
    }

    /*
     * OUTBREAK PRESSURE
     *
     * Not a flat die-roll gated behind week eight, which made outbreaks feel
     * like an unrelated subsystem that switched on one day. Pressure now rises
     * with the run itself and with how much of the world you touch, so the
     * back half of a career is genuinely more dangerous than the front half —
     * and week three is no longer safe by decree.
     *
     * `outbreakPressure` and `severityCeiling` are pure and exported so the
     * interface can tell the player where the threat currently stands rather
     * than leaving it as a hidden roll.
     */
    if (cityList.length > 0) {
      const chance = outbreakPressure(s.week, cityList.length);
      if (rng.chance(chance)) {
        const city = rng.pick(cityList);
        /*
         * Severity is capped by how far into the run you are. An early
         * outbreak is something you can absorb; the ones that can end a career
         * only appear once you have had time to build for them. That ramp is
         * what makes this read as progression rather than as noise.
         */
        const ceiling = severityCeiling(s.week);
        const candidates = OUTBREAKS.filter(
          (o) =>
            o.severity <= ceiling &&
            !m.solved.includes(o.id) &&
            !m.outbreaks.some((a) => a.id === o.id && a.city === city),
        );
        if (candidates.length > 0) {
          const def = rng.pick(candidates);
          m.outbreaks.push({
            id: def.id,
            city,
            weeksLeft: def.duration,
            startedWeek: s.week,
            contained: false,
          });
          pushLog(
            s,
            `${def.label} declared in ${cityOf(city).name}. ${def.pathogen}.`,
            "bad",
          );
          ledger.push({
            label: `OUTBREAK: ${def.label}`,
            note: `${cityOf(city).name} · see the Outbreaks tab`,
            kind: "info",
          });
        }
      }
    }

    // --- the caseload, city by city --------------------------------------
    // Each city has its own panel, its own epidemiology and its own fees, so
    // a week is resolved separately in each and then summed.
    const cities = activeCities(m);
    const reports: CityReport[] = [];
    const merged = new Map<string, CaseResult>();
    let revenue = 0;
    let treatedTotal = 0;
    let arrivedTotal = 0;
    let turnedAwayTotal = 0;
    let capacityTotal = 0;
    const blockTally: Record<string, number> = {};
    let worstLimit: "space" | "people" = "people";
    let reputationDelta = 0;

    // Running dry on consumables throttles every site until restocked.
    const stockFactor = supplyThrottle(m);

    /*
     * WHAT IT IS LIKE TO WORK HERE, AS A NUMBER
     *
     * Culture multiplies output between 0.86 and 1.14. That range is
     * deliberately narrow — it is a real edge and it is never the whole
     * game, because a wider band would make every other decision secondary
     * to keeping morale up.
     */
    const cultureFactor = productivityFactor(cultureScore(m, s.week).score);

    for (const city of cities) {
      /* Your own hours only count if you are allowed to work. A suspension
         does not close the practice — it removes you from it. */
      const cap = capacityIn(
        m,
        city,
        canPractise(s) ? clinicBlocks : 0,
        s.r.skill,
        s.r.burnout,
      );
      cap.effective *= (1 + manageBlocks * 0.03) * stockFactor * cultureFactor;
      capacityTotal += cap.effective;
      if (cap.limitedBy === "space") worstLimit = "space";

      /* Demand is the city's own market now, not a constant: a downturn in
         London shows up as fewer people through the door there while Lyon
         carries on. */
      const panelHere = (m.panels[city] ?? 0) * marketOf(m.markets, city).demand;
      const arrivals = generateCases(m, panelHere, s.r.reputation, rng, city);
      const out = resolveCases(
        m,
        arrivals,
        cap,
        s.r.skill,
        rng,
        // Billing at what the work is worth here THIS week.
        effectiveFee(m.markets, city),
      );

      revenue += out.revenue;
      reputationDelta += out.reputationDelta;
      s.r.risk += out.riskDelta;
      treatedTotal += out.treatedTotal;
      arrivedTotal += out.arrivedTotal;
      turnedAwayTotal += out.turnedAwayTotal;
      for (const [k, v] of Object.entries(out.blockedBy)) {
        blockTally[k] = (blockTally[k] ?? 0) + v;
      }

      // Fold each city's rows into one network-wide caseload table.
      for (const r of out.results) {
        const prev = merged.get(r.conditionId);
        if (!prev) {
          merged.set(r.conditionId, { ...r });
        } else {
          prev.arrived += r.arrived;
          prev.treated += r.treated;
          prev.succeeded += r.succeeded;
          prev.failed += r.failed;
          prev.turnedAway += r.turnedAway;
          prev.revenue += r.revenue;
          prev.blockedBy = prev.blockedBy ?? r.blockedBy;
        }
      }

      reports.push({
        city,
        slots: slotsIn(m, city),
        capacity: cap.effective,
        panel: panelHere,
        catchment: catchmentIn(m, city, s.r.reputation),
        arrived: out.arrivedTotal,
        treated: out.treatedTotal,
        turnedAway: out.turnedAwayTotal,
        revenue: out.revenue,
      });
    }

    m.lastCases = [...merged.values()].sort((a, b) => b.arrived - a.arrived);
    m.lastCityReports = reports.sort((a, b) => b.revenue - a.revenue);
    s.r.cash += revenue;

    ledger.push({
      label: `Treated ${treatedTotal} of ${arrivedTotal} cases`,
      amount: revenue,
      note: `${cities.length} ${cities.length === 1 ? "city" : "cities"} · ${Math.round(capacityTotal)} capacity`,
      kind: "income",
    });

    if (turnedAwayTotal > 0) {
      // Name the reason that actually stopped the most patients. Reporting a
      // capacity problem when the real gap is a missing department sends the
      // player off to hire staff who will have nothing to do.
      const topBlocker = Object.entries(blockTally)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      const reason =
        topBlocker === "department"
          ? "no department for them — see Build"
          : topBlocker === "equipment"
            ? "you lack the equipment — see Build"
            : topBlocker === "staff"
              ? "nobody qualified on the rota — see Staff"
              : worstLimit === "space"
                ? "out of physical space — see Build"
                : "out of clinical hours — see Staff";
      ledger.push({
        label: `${turnedAwayTotal} referred elsewhere`,
        note: reason,
        kind: "info",
      });
    }


    // --- the bills -------------------------------------------------------
    const upkeep = medUpkeep(m);
    const wages = payroll(m);
    s.r.cash -= upkeep + wages;
    ledger.push({
      label: "Premises, departments & equipment",
      amount: -upkeep,
      note: `${m.facilities.length} site${m.facilities.length === 1 ? "" : "s"}, ${m.departments.length} department${m.departments.length === 1 ? "" : "s"}, ${m.equipment.length} machine${m.equipment.length === 1 ? "" : "s"}`,
      kind: "expense",
    });
    if (wages > 0) {
      ledger.push({
        label: "Payroll",
        amount: -wages,
        note: `${m.staff.length} on staff`,
        kind: "expense",
      });
    }

    // --- consumables -------------------------------------------------------
    // Charged on what was actually billed, drawn from stock first. Auto-order
    // covers any gap at spot price; without it the practice runs dry.
    const draw = drawSupplies(m, consumptionFor(m.lastCases));
    if (draw.emergencySpend > 0) {
      s.r.cash -= draw.emergencySpend;
      ledger.push({
        label: "Consumables bought at short notice",
        amount: -draw.emergencySpend,
        note: "stock ran out — auto-order covered it at full price",
        kind: "expense",
      });
    } else if (draw.consumed > 0) {
      ledger.push({
        label: "Consumables used",
        note: `${money(draw.consumed)} drawn from stock · ${money(m.supplies.stock)} left`,
        kind: "info",
      });
    }
    if (draw.stockedOut) {
      pushLog(
        s,
        "The clinic ran out of consumables. Capacity is cut until you restock.",
        "bad",
      );
      ledger.push({
        label: "Stocked out",
        note: "capacity reduced for the next two weeks",
        kind: "info",
      });
    }

    const marketing = marketingSpend(m);
    if (marketing > 0) {
      s.r.cash -= marketing;
      ledger.push({
        label: "Marketing",
        amount: -marketing,
        note: `${m.campaigns.length} campaign${m.campaigns.length === 1 ? "" : "s"} running`,
        kind: "expense",
      });
    }

    const living = lifestyleUpkeep(m);
    if (living > 0) {
      s.r.cash -= living;
      ledger.push({
        label: "Living costs",
        amount: -living,
        note: `${m.lifestyle.length} item${m.lifestyle.length === 1 ? "" : "s"} to keep`,
        kind: "expense",
      });
    }

    const interest = s.r.debt * LOAN_RATE;
    if (interest > 0) {
      s.r.debt += interest;
      ledger.push({
        label: "Student loan interest",
        amount: -interest,
        note: `balance ${money(s.r.debt)}`,
        kind: "expense",
      });
    }

    // --- teaching --------------------------------------------------------
    // A chair turns the practice into somewhere people train. This is the
    // only way staff skill improves after they are hired.
    if (holds(m, "professorship")) {
      let taught = 0;
      for (const st of m.staff) {
        if (st.role === "admin" || st.skill >= 97) continue;
        st.skill = Math.min(97, st.skill + 0.5);
        taught++;
      }
      if (taught > 0) {
        ledger.push({
          label: "Teaching",
          note: `${taught} clinician${taught === 1 ? "" : "s"} improving under your chair`,
          kind: "info",
        });
      }
    }

    // --- reputation drift ------------------------------------------------
    // Credibility is one thing across the whole network: a failure in New York
    // is heard about in Paris. (`s.r.reputation` IS credibility — see the
    // migration note at the head of lib/game/reputation.ts.)
    s.r.reputation += reputationDelta;
    if (s.r.burnout > 65) s.r.reputation -= 0.5;
    if (s.r.reputation < 30) s.r.reputation += 0.5; // people still need a doctor

    /*
     * THE OTHER FIVE
     *
     * Each one is moved by the thing it is about, and by nothing else. The
     * temptation is to nudge all six on every action, which would make them a
     * single number wearing six hats — so these are the only routine writes,
     * and each names its cause.
     */

    /*
     * Patients judge you on whether you could see them — as a *share*, not a
     * count.
     *
     * The first version of this subtracted 0.02 per person turned away, which
     * meant a large practice turning away 5% of a huge list was punished far
     * harder than a small one turning away half of a small list. Because
     * patient trust feeds the catchment ceiling, that compounded into an
     * economy-wide penalty for growing at all: it cost every strategy roughly
     * thirty points of win rate, which the balance harness caught immediately.
     */
    if (arrivedTotal > 0) {
      const missed = turnedAwayTotal / arrivedTotal;
      /*
       * Calibrated against what actually happens, not against what sounds
       * right. Referring work out is the *normal* state of this game — cases
       * arrive whether or not you can treat them — so a threshold of 12%
       * fired every single week and pinned patient trust at zero for entire
       * 156-week runs. Since trust feeds the catchment ceiling, that was a
       * permanent 7% tax on the whole economy, worth about twenty points of
       * win rate. Measured, not guessed: a probe run printed `pat=0` from
       * week 60 onward.
       *
       * A third of arrivals referred elsewhere is the neutral point. Below
       * that you are visibly coping; above it people notice.
       */
      const drift = (0.34 - missed) * 3;
      applyRep(
        s,
        "patients",
        Math.max(-2, Math.min(0.8, drift)),
        missed > 0.34
          ? "too many people were turned away"
          : "nearly everyone who came was seen",
        true,
      );
    }

    // Staff judge you on the rota. Burnout is your own, but they work it too.
    if (s.r.burnout > 72) {
      applyRep(s, "loyalty", -1.1, "the rota is punishing everyone", true);
    } else if (s.r.burnout < 40 && m.staff.length > 0) {
      applyRep(s, "loyalty", 0.3, "the practice is running calmly", true);
    }
    if (m.staff.length > 0 && s.r.cash < 0) {
      applyRep(s, "loyalty", -1.6, "payroll was late", true);
    }

    // Ethics recovers slowly if nothing is going wrong, and scrutiny bleeds it.
    const scrutiny = m.phone.social.scrutiny;
    if (scrutiny >= 45) {
      applyRep(s, "ethics", -0.6, "you are under scrutiny", true);
    } else if (s.r.repEthics < 70) {
      applyRep(s, "ethics", 0.25, "time passing without incident", true);
    }

    // Popularity tracks the public mood the phone already models, and decays
    // without anything to feed it — attention is not a stock.
    const sentimentPull = (m.phone.social.sentiment - 50) * 0.04;
    if (Math.abs(sentimentPull) > 0.05) {
      applyRep(s, "popularity", sentimentPull, "public mood", true);
    }
    applyRep(s, "popularity", -0.35, "attention fading", true);

    // Influence follows credentials — a chair is influence by definition.
    const credentialWeight = m.qualifications.length * 0.12;
    if (credentialWeight > 0) {
      applyRep(s, "influence", credentialWeight, "your credentials", true);
    }

    /*
     * STAFF LEAVE.
     *
     * The consequence that makes loyalty a real number rather than a mood
     * ring. Below 40 there is a weekly chance someone walks, and they take
     * their salary line and their capacity with them.
     */
    const attrition = attritionRisk(s);
    if (attrition > 0 && m.staff.length > 0 && rng.chance(attrition)) {
      const leaver = m.staff[m.staff.length - 1];
      m.staff = m.staff.filter((x) => x.id !== leaver.id);
      ledger.push({
        label: `${leaver.name} resigned`,
        note: "staff loyalty is too low to hold a team",
        kind: "info",
      });
      pushLog(s, `${leaver.name} handed in notice.`, "bad");
      touchPerson(
        s,
        "lindqvist",
        { warmth: -6, trust: -4 },
        "she warned you about the rota before this happened",
        "bad",
      );
    }
    // Below a tenth this renders as a meaningless "-0.0".
    ledger.push({
      label: "Reputation",
      note:
        Math.abs(reputationDelta) < 0.05
          ? "unchanged by this week's outcomes"
          : `${reputationDelta > 0 ? "+" : "−"}${Math.abs(reputationDelta).toFixed(1)} from this week's outcomes`,
      kind: "info",
    });

    // --- panel drift, per city -------------------------------------------
    // Each city's panel approaches its own ceiling rather than compounding.
    // Outreach lands where you personally are, since that is where you did it.
    const joining = s.r._panelPending ?? 0;
    s.r._panelPending = 0;
    let networkCeiling = 0;
    let panelDelta = 0;

    // Public feeling widens or narrows the catchment on top of marketing.
    // Exactly 1.0 at the starting sentiment of 50.
    /*
     * How many people are willing to be your patients.
     *
     * Three separate things now, and they can disagree: the public mood the
     * phone models, and whether the patients you already have think you are
     * on their side. A practice with a big following and long waits grows
     * slower than its follower count suggests, which is the intended lesson.
     */
    const publicMood = sentimentCatchment(m) * panelTrustFactor(s);

    for (const city of cities) {
      const ceiling = catchmentIn(m, city, s.r.reputation) * publicMood;
      networkCeiling += ceiling;
      const here = m.panels[city] ?? 0;
      const drift = (ceiling - here) * 0.08;
      const local = city === m.homeCity ? joining : 0;
      // Outreach recruits real people, so it cannot push a city's panel past
      // the number who live there. Without this cap a single mid-size city
      // grows without limit and expanding to Paris or Tokyo never pays.
      const next = Math.min(
        populationCeiling(city),
        Math.max(0, here + drift + local),
      );
      panelDelta += next - here;
      m.panels[city] = next;
    }

    // Panels in cities you have licensed but not built in decay away.
    for (const key of Object.keys(m.panels)) {
      if (!cities.includes(key as CityId)) m.panels[key] = 0;
    }

    s.r.panel = totalPanel(m);
    const movement = `${panelDelta > 0 ? "+" : panelDelta < 0 ? "−" : ""}${Math.abs(panelDelta).toFixed(1)}`;
    ledger.push({
      label: "Panel movement",
      note:
        joining > 0
          ? `${movement} patients, incl. ${Math.round(joining)} from outreach · catchment ~${Math.round(networkCeiling)}`
          : `${movement} patients · catchment ~${Math.round(networkCeiling)}`,
      kind: "info",
    });

    // --- the phone ---------------------------------------------------------
    // Its own RNG stream: the engine rolls events from the shared one *after*
    // this returns, so drawing from that here would shift every event in the
    // game and silently move the balance.
    const phoneRng = makeRng((s.seed ^ (s.week * 0x5bf03635)) >>> 0);
    const phoneWeek = generateWeek(
      m,
      {
        week: s.week,
        burnout: s.r.burnout,
        risk: s.r.risk,
        reputation: s.r.reputation,
        cash: s.r.cash,
      },
      phoneRng,
    );
    for (const line of phoneWeek.logLines) pushLog(s, line, "neutral");

    /*
     * --- who has arrived ---------------------------------------------------
     *
     * Checked weekly rather than once at the start, so a person whose entry
     * condition is "you have staff" or "you run two cities" joins the run at
     * the moment it becomes true. It also means a save migrated from a build
     * before someone existed picks them up on the next resolved week.
     */
    for (const def of newArrivals(s)) {
      s.people = [...(s.people ?? []), initialPerson(def)];
      pushLog(s, `${def.name} is now someone you deal with.`, "neutral");
      m.phone.messages = [
        {
          id: `msg.meet.${def.id}`,
          week: s.week,
          from: def.name,
          handle: `@${def.handle}`,
          role: MESSAGE_ROLE_FOR[def.role],
          body: def.bio,
          read: false,
        },
        ...m.phone.messages,
      ].slice(0, MAX_MESSAGES);
    }

    /*
     * --- what your people are saying --------------------------------------
     *
     * The phone carries relationships, not just chatter. At most one of these
     * a week: an inbox that fills up every week is one the player learns to
     * ignore, and the whole point is that a message from a named person
     * should be worth opening.
     */
    const relationshipNote = weeklyRelationshipMessage(s, m);
    if (relationshipNote) {
      m.phone.messages = [relationshipNote, ...m.phone.messages].slice(
        0,
        MAX_MESSAGES,
      );
    }

    // --- opportunities ----------------------------------------------------
    // Standing has to open doors or it is a scoreboard. This is the cheap,
    // frequent version; the chairs and partnerships are the expensive one.
    if (
      opportunityScore(s) >= 62 &&
      s.week % 12 === 0 &&
      m.phone.news.length < MAX_NEWS
    ) {
      applyRep(s, "influence", 1.5, "you were asked to contribute", true);
      const offer: PhoneMessage = {
        id: `msg.opportunity.${s.week}`,
        week: s.week,
        from: "Ines Duarte",
        handle: "@i.duarte",
        role: "recruiter",
        body: "Two things crossed my desk that I would only send to you. A regional advisory seat, and a private group that wants a clinical director. Neither is advertised. Say the word and I will make an introduction.",
        read: false,
      };
      m.phone.messages = [offer, ...m.phone.messages].slice(0, MAX_MESSAGES);
    }

    // --- milestones the simulation can prove ------------------------------
    recordMilestones(s, m);

    // --- drift on you ----------------------------------------------------
    s.r.risk -= m.staff.filter((x) => x.role === "admin").length * 1.1;
    s.r.risk -= 0.4;
    // Being watched closely makes claims more likely. Zero at scrutiny 0.
    s.r.risk += scrutinyRisk(m);
    // A communications team closes stories rather than letting them run.
    m.phone.social.scrutiny = Math.max(
      0,
      m.phone.social.scrutiny - commsScrutinyRelief(m),
    );
    /*
     * FITNESS
     *
     * The compounding half of burnout. Rest is acute — it spends a block to
     * remove fifteen points now. Fitness is a stock: each block adds 1.5, it
     * caps at 20, and it pays out every single week thereafter, so by the
     * back half of a run it is worth about −2.4/wk without spending anything.
     *
     * It decays if you stop, or it would be a one-off purchase rather than a
     * habit — and the whole point of putting it in the planner was to make
     * looking after yourself a recurring decision.
     */
    /*
     * THE PEAK, NOT THE RESIDUE.
     *
     * Burnout is checked for collapse *after* the week resolves, and the week
     * always ends with several points of recovery. So a run that genuinely hit
     * the ceiling mid-week arrived at the check reading 96 and never collapsed
     * at all — the setback was unreachable. Recording the peak before the
     * drift is what makes the threshold mean what it says.
     */
    s.r._burnoutPeak = Math.max(s.r._burnoutPeak ?? 0, s.r.burnout);

    s.r._fitness = Math.max(0, (s.r._fitness ?? 0) - 0.12);
    s.r.burnout -=
      (s.r.burnout < 50 ? 3.5 : 2) + burnoutRelief(m) + (s.r._fitness ?? 0) * 0.12;

    /*
     * --- PHASE 3 -------------------------------------------------------
     *
     * Setbacks bite, personality shows, and the ambition read-outs get the
     * numbers they need. All three read state that already exists; none of
     * them can end the run.
     */
    const sb = setbackEffects(s.setbacks ?? []);
    if (sb.income < 1) {
      const lost = Math.round(ledgerIncome(ledger) * (1 - sb.income));
      if (lost > 0) {
        s.r.cash -= lost;
        ledger.push({
          label: "Taken by the administrator",
          amount: -lost,
          kind: "expense",
        });
      }
    }
    if (sb.standingDrag > 0) {
      applyRep(s, "credibility", -sb.standingDrag, "you are in serious trouble", true);
    }

    // Personality: earned by behaviour, and it costs as well as pays.
    applyRep(s, "loyalty", loyaltyDrift(s), "how you are known to operate", true);
    applyRep(s, "ethics", ethicsDrift(s), "how you are known to operate", true);

    /* The ambition read-outs are pure over state, so they need the derived
       figures mirrored onto the resource bag. Cheap, and it keeps
       `ambitions.ts` career-agnostic. */
    s.r._netWorth = netWorth(s);
    s.r._sites = m.facilities.length;
    s.r._headcount = m.staff.length;
    s.r._cities = m.cities.length;
    s.r._credentials = m.qualifications.length;
    s.r._followers = m.phone.social.followers;
    s.r._equitySold = (s.obligations ?? []).reduce((n, o) => n + o.equity, 0);
    s.r._hasDeputy = m.staff.some((x) => x.lead) ? 1 : 0;

    /*
     * --- PHASE 2 ---------------------------------------------------------
     *
     * The living world: markets drift, the team's morale moves, rivals take
     * their turn, news lands with real effects, contracts progress and
     * resolve, financing charges interest, and crises escalate.
     *
     * Deliberately last, and deliberately one call. Everything above is this
     * practice's own arithmetic; everything inside is the world reacting to
     * it, and keeping the boundary sharp is what stopped this file growing
     * another eight hundred lines.
     */
    const profit = ledger.reduce((n, l) => n + (l.amount ?? 0), 0);
    runPhase2(s, {
      m,
      ledger,
      netWorth: netWorth(s),
      profit,
      cashWeeks: weeklyCosts(s) > 0 ? s.r.cash / weeklyCosts(s) : 99,
      supplyWeeks: weeksOfCover(m),
    });

    return ledger;
  },

  /* The save contract for everything above, kept beside the career. */
  validateData: validateMedicalData,

  /**
   * WHERE THE DELAYED CONSEQUENCES LAND
   *
   * A pending item is data, not a closure, so this is the switch that turns
   * a kind back into an effect. Two properties it must have:
   *
   *   - **An unknown kind is ignored.** A save carrying a consequence from a
   *     build where that storyline existed must not crash a run in a build
   *     where it does not.
   *   - **The world may have moved on.** Several of these re-check the state
   *     that armed them, and fizzle if it changed. A threat that fires
   *     regardless of whether you fixed the thing is not a consequence, it is
   *     a timer.
   */
  resolvePending: (s, p) => {
    switch (p.kind) {
      case "registrar.supervised":
        return { raiseEvent: "chain.registrar.assessment" };

      case "registrar.reported":
        applyRep(s, "ethics", 3, "the trust upheld your report");
        return {
          log: "The trust upheld your report on Dr Kaya. He has left the programme.",
        };

      case "registrar.buried": {
        /* Only if the miss was never made good. A player who later took the
           ethical route in another chain has not un-done this, but one whose
           ethics recovered above the line has visibly changed how the
           practice runs, and the complaint finds a better-documented file. */
        if (readRep(s, "ethics") >= 72) {
          return {
            log: "A family asked about a delayed diagnosis from the spring. The notes were in order.",
          };
        }
        return { raiseEvent: "chain.registrar.fallout" };
      }

      case "audit.clean":
        return { raiseEvent: "chain.audit.vindicated" };

      case "audit.contested": {
        /* Paying for a proper review afterwards genuinely changes the
           outcome — the second reviewer sees a practice that fixed it. */
        if (readRep(s, "ethics") >= 74) {
          return {
            log: "The insurer closed the audit without adjustment. Elena did not say she had told you so.",
          };
        }
        return { raiseEvent: "chain.audit.recovery" };
      }

      case "partner.pressure":
        /* If he is gone, there is nobody to apply pressure. */
        if (personIn(s, "thorne")?.status === "distant") return;
        return { raiseEvent: "chain.partner.squeeze" };

      case "partner.clinical":
        applyRep(s, "loyalty", 6, "your partner has been running good lists");
        touchPerson(
          s,
          "adeyemi",
          { warmth: 6, respect: 5 },
          "a year of working together",
          "good",
        );
        return {
          log: "Tolu has quietly fixed three things you had stopped noticing.",
        };

      case "chair.decision": {
        /*
         * The appointment is decided by the categories, not by a die.
         *
         * This is the clearest place in the game where reputation is
         * mechanical: the panel is reading influence, credibility and ethics,
         * and a nomination from Hallam is worth real points. A player who
         * built popularity instead will lose here, and should.
         */
        const unaided = p.payload?.unaided === true;
        const score =
          opportunityScore(s) +
          (unaided ? 0 : (personIn(s, "hallam")?.respect ?? 0) * 0.25) +
          (remembers(s, "hallam", "nominated-you") ? 6 : 0);
        return {
          raiseEvent:
            score >= 72 ? "chain.chair.appointed" : "chain.chair.passed",
        };
      }

      case "chair.rematch":
        /* Only if you were gracious, and only if you have not already got it
           by some other route. */
        if (s.r._chair === 1) return;
        if (!remembers(s, "okoro", "was-gracious")) return;
        return { raiseEvent: "chain.chair.rematch" };

      default:
        return;
    }
  },

  /**
   * WHAT GOES WRONG, AND THE FACT THAT YOU SURVIVE IT
   *
   * This used to be `checkOutcome`, and it ended runs four different ways.
   * Every one of those is now a setback the player climbs out of:
   *
   *   burnout 100      → signed off. The practice runs badly without you.
   *   three claims     → practising rights suspended, not revoked forever.
   *   deep insolvency  → administration. Creditors take a cut; you rebuild.
   *   ethics collapse  → public disgrace, which time and work undo.
   *
   * Reaching the old net-worth "win" is now a milestone recorded in the
   * timeline, and the run carries on — see `recordMilestones`.
   *
   * The thresholds are deliberately *worse* than the old ones. A setback you
   * can shrug off is not a consequence, and these are meant to cost a player
   * twenty weeks of their life.
   */
  checkSetbacks: (s) => {
    const out: SetbackKind[] = [];
    /* The peak reached during the week, not what is left after the week's
       recovery — see the note where `_burnoutPeak` is written. */
    if (Math.max(s.r.burnout, s.r._burnoutPeak ?? 0) >= 100) out.push("collapse");
    if (s.r.strikes >= 3) out.push("suspension");
    if (s.r.cash < -60_000) out.push("insolvency");
    if ((s.r.repEthics ?? 70) <= 12) out.push("disgrace");
    /* Cleared here so one bad week produces one collapse rather than a
       collapse every week until burnout drifts down. */
    if (out.includes("collapse")) s.r._burnoutPeak = 0;
    return out;
  },

  scoreboard: (s) => ({
    label: "Net worth",
    value: money(netWorth(s)),
    sub: `${money(s.r.cash)} cash · ${money(s.r.debt)} owed`,
  }),

  briefing: (s, alloc) => {
    const m = med(s);
    const clinicBlocks = alloc.clinic ?? 0;
    // Capacity has to be summed the same way the week resolves it — city by
    // city, each capped by its own space — or the forecast overstates what
    // you can actually get through.
    const cities = activeCities(m);
    let effective = 0;
    let spaceBound = 0;
    let peopleBound = 0;
    for (const c of cities) {
      const cap = capacityIn(m, c, clinicBlocks, s.r.skill, s.r.burnout);
      effective += cap.effective;
      if (cap.limitedBy === "space") spaceBound += cap.effective;
      else peopleBound += cap.effective;
    }
    const capacity = {
      effective,
      limitedBy: spaceBound >= peopleBound ? "space" : "people",
      facilitySlots: cities.reduce((n, c) => n + slotsIn(m, c), 0),
      staffUnits: computeCapacity(m, 0, s.r.skill, s.r.burnout).staffUnits,
      personalUnits: clinicBlocks * (10 + s.r.skill / 8) * (1 - s.r.burnout / 200),
    };
    const rate = 0.28 * (0.85 + s.r.reputation / 330);
    const expectedCases = Math.round(s.r.panel * rate);
    const costs = weeklyCosts(s);
    const outlay = (alloc.study ?? 0) * 260 + (alloc.outreach ?? 0) * 320;
    const interest = s.r.debt * LOAN_RATE;

    const nurses = m.staff.filter((x) => x.role === "nurse").length;
    const burnDelta =
      clinicBlocks * Math.max(2.5, 6.5 - nurses * 0.6) +
      (alloc.study ?? 0) * 3 +
      (alloc.manage ?? 0) * 2.5 +
      (alloc.outreach ?? 0) * 4 -
      (alloc.rest ?? 0) * (15 + restBonus(m)) -
      (s.r.burnout < 50 ? 3.5 : 2) -
      burnoutRelief(m);

    return [
      {
        label: "Cases expected",
        value: `${expectedCases}`,
        tone: "neutral",
        note: `panel of ${Math.round(s.r.panel)} across ${cities.length} ${cities.length === 1 ? "city" : "cities"}`,
      },
      {
        label: "Treatment capacity",
        value: `${Math.round(capacity.effective)}`,
        tone: capacity.effective <= 0 ? "bad" : "neutral",
        note:
          capacity.limitedBy === "space"
            ? `limited by space — ${Math.round(capacity.facilitySlots)} slots`
            : `limited by people — ${Math.round(capacity.staffUnits + capacity.personalUnits)} units`,
      },
      {
        label: "Fixed costs",
        value: money(costs + outlay + interest),
        tone: "neutral",
        note: `${money(medUpkeep(m))} premises · ${money(payroll(m))} payroll · ${money(marketingSpend(m) + lifestyleUpkeep(m))} other`,
      },
      {
        label: "Burnout change",
        value: `${burnDelta >= 0 ? "+" : ""}${burnDelta.toFixed(1)}`,
        tone:
          s.r.burnout + burnDelta > 80
            ? "bad"
            : burnDelta <= 0
              ? "good"
              : "neutral",
        note: `ends the week at ${Math.max(0, Math.round(s.r.burnout + burnDelta))}`,
      },
    ];
  },

  objective: (s) => {
    const goal = goalFor(s);
    return {
      text: `Clear your student debt and build a practice worth ${money(goal)} in ${cityOf(med(s).homeCity).name}. A strong first three years gets there by week ${WEEK_LIMIT}; there is no deadline, and reaching it is a milestone rather than an ending.`,
      progress: Math.min(
        1 - s.r.debt / startDebtOf(s),
        Math.max(0, Math.min(1, netWorth(s) / goal)),
      ),
    };
  },

  events: [
    /*
     * The storylines come first, which is not cosmetic: `rollEvent` walks the
     * pool in order when distributing the weighted roll, and a chain beat that
     * has become eligible should get its shot before the ambient pool of
     * one-off alerts it is competing with.
     */
    ...CHAIN_EVENTS,
    {
      id: "malpractice_claim",
      title: "A claim has been filed",
      tone: "bad",
      cooldown: 8,
      eligible: (s) => s.r.risk > 12,
      weight: (s) => s.r.risk / 900,
      body: (s) =>
        `A family has filed over an outcome eleven weeks ago. Your lawyer says the notes are ${s.r.risk > 45 ? "thin" : "defensible"}, and that these things are rarely about the medicine.`,
      choices: [
        {
          label: "Settle quietly",
          detail: "Pay now. No strike, no admission, no headlines.",
          apply: (s) => {
            const paid = 18_000 + s.r.risk * 420;
            s.r.cash -= paid;
            s.r.risk -= 8;
            return `Settled for ${money(paid)}. It never reached a courtroom.`;
          },
        },
        {
          label: "Contest it",
          detail: "Your record defends you — or it doesn't.",
          apply: (s, rng) => {
            const odds = Math.min(0.9, 0.25 + effectiveSkill(s) / 130);
            if (rng.chance(odds)) {
              s.r.risk -= 14;
              s.r.reputation += 2;
              return "The claim was dismissed. Your notes held up, and word got round that they did.";
            }
            const paid = 42_000 + s.r.risk * 500;
            s.r.cash -= paid;
            s.r.strikes += 1;
            s.r.reputation -= 6;
            s.r.burnout += 8;
            return `Upheld. ${money(paid)} in damages and a strike on your record. That is ${3 - s.r.strikes} left.`;
          },
        },
      ],
    },
    {
      id: "burnout_wall",
      title: "You are not okay",
      tone: "bad",
      cooldown: 12,
      eligible: (s) => s.r.burnout > 78,
      weight: () => 0.3,
      body: () =>
        "You read the same line of a chart four times this morning. Someone asked, carefully, whether you had taken a day off this year. You could not remember.",
      choices: [
        {
          label: "Take three weeks off",
          detail: "Hand over. Lose the income. Come back a person.",
          apply: (s) => {
            const lost = weeklyCosts(s) * 3;
            s.r.cash -= lost;
            s.r.burnout -= 34;
            s.r.reputation -= 2;
            return `Three weeks away. ${money(lost)} in bills carried on without you — but you slept.`;
          },
        },
        {
          label: "Push through",
          detail: "There is nobody else who can carry it.",
          apply: (s) => {
            s.r.burnout += 4;
            s.r.risk += 6;
            return "You pushed through. The list got seen. Something is going to give.";
          },
        },
      ],
    },
    {
      id: "consultant_approach",
      title: "An approach",
      tone: "good",
      cooldown: 22,
      eligible: (s) => s.r.reputation > 58 && med(s).departments.length > 2,
      weight: () => 0.06,
      body: () =>
        "A well-regarded consultant has heard what you are building and would join — below market rate — if you can take them now.",
      choices: [
        {
          label: "Take them on",
          detail: "$9,000 to sign. A stronger bench than you could normally hire.",
          affordable: (s) => s.r.cash >= 9_000,
          apply: (s) => {
            const m = med(s);
            const spec =
              m.departments.find((d) => d !== "general") ?? "general";
            s.r.cash -= 9_000;
            const seed = m.nextId++;
            m.staff.push({
              id: `s${seed}`,
              role: "specialist",
              name: staffName(seed),
              specialty: spec,
              skill: Math.min(96, 62 + Math.round(s.r.reputation * 0.25)),
              salary: 3_400,
            });
            return `They start Monday in ${SPECIALTY_BY_ID.get(spec)?.label}. Better than anyone you have hired yet.`;
          },
        },
        {
          label: "Decline",
          detail: "You cannot carry another salary.",
          apply: () => "You declined, politely, and thought about it all week.",
        },
      ],
    },
    {
      id: "equipment_failure",
      title: "Something broke",
      tone: "bad",
      cooldown: 18,
      eligible: (s) => med(s).equipment.length > 0,
      weight: (s) => 0.02 + med(s).equipment.length * 0.006,
      body: (s) => {
        const m = med(s);
        const eq = EQUIPMENT_BY_ID.get(m.equipment[m.equipment.length - 1]);
        return `The ${eq?.label.toLowerCase() ?? "equipment"} has failed mid-list. The engineer's first question is whether you have a service contract.`;
      },
      choices: [
        {
          label: "Emergency repair",
          detail: "Expensive, immediate, done properly.",
          apply: (s) => {
            const cost = 8_000 + med(s).equipment.length * 1_600;
            s.r.cash -= cost;
            return `${money(cost)} and it was back running by Thursday.`;
          },
        },
        {
          label: "Work around it",
          detail: "Refer those cases out until it's fixed cheaply.",
          apply: (s) => {
            s.r.cash -= 1_800;
            s.r.reputation -= 3;
            return "You referred a fortnight of cases elsewhere. Cheaper, and people noticed.";
          },
        },
      ],
    },
    {
      id: "flu_surge",
      title: "Seasonal surge",
      tone: "neutral",
      cooldown: 22,
      eligible: () => true,
      weight: () => 0.05,
      body: () =>
        "Something is going round the schools. The phones have not stopped since Monday.",
      choices: [
        {
          label: "Absorb it",
          detail: "Long days, full tills, a reputation for being there.",
          apply: (s) => {
            const bonus = 220 * (1 + med(s).staff.length);
            s.r.cash += bonus;
            s.r.burnout += 9;
            s.r.reputation += 3;
            // Queued rather than written to s.r.panel directly: the panel is
            // derived from m.panels every week, so a direct write is erased
            // by the next resolution. Pending registrations land in the home
            // city, exactly as outreach does.
            s.r._panelPending = (s.r._panelPending ?? 0) + 18;
            return `${money(bonus)} in extra billing, eighteen new registrations, and a very tired week.`;
          },
        },
        {
          label: "Hold the normal list",
          detail: "Protect the schedule. Some people will be turned away.",
          apply: (s) => {
            s.r.reputation -= 2.5;
            return "You held your usual capacity. Some families found someone who would see them sooner.";
          },
        },
      ],
    },
    {
      id: "inspection",
      title: "Regulatory inspection",
      tone: "bad",
      cooldown: 26,
      eligible: (s) => s.r.risk > 22 || med(s).facilities.length > 1,
      weight: (s) => (s.r.risk > 45 ? 0.06 : 0.02),
      body: () =>
        "An unannounced inspection. They want records, rotas, and the maintenance log for every machine on site.",
      choices: [
        {
          label: "Cooperate fully",
          detail: "Whatever is in the file is in the file.",
          apply: (s) => {
            const fine = Math.round(s.r.risk * 340);
            s.r.cash -= fine;
            s.r.risk -= 6;
            return fine > 8_000
              ? `Findings against you. ${money(fine)} in penalties and a follow-up visit booked.`
              : `Mostly clean. ${money(fine)} in adjustments and a note about documentation.`;
          },
        },
        {
          label: "Shut the list and prepare",
          detail: "Lose a week of treatment. Cut the exposure.",
          apply: (s) => {
            s.r.risk -= 16;
            s.r.burnout += 8;
            s.r.cash -= weeklyCosts(s);
            return "A week of nothing but paperwork. The inspection closed with no findings, and the files are genuinely better.";
          },
        },
      ],
    },
    {
      id: "staff_resignation",
      title: "A resignation",
      tone: "bad",
      cooldown: 15,
      eligible: (s) => med(s).staff.length > 2,
      weight: (s) => 0.03 + s.r.burnout / 1600,
      body: () =>
        "One of your team is leaving. The reason given is a shorter commute. The real one is that this place has been running hot for months.",
      choices: [
        {
          label: "Let them go",
          detail: "You cannot counter every offer.",
          apply: (s) => {
            const m = med(s);
            const idx = m.staff.length - 1;
            const [gone] = m.staff.splice(idx, 1);
            return `${gone.name} worked their notice properly. The rota is thinner without them.`;
          },
        },
        {
          label: "Counter-offer",
          detail: "Raise them, and everyone doing the same job.",
          affordable: (s) => s.r.cash >= 12_000,
          apply: (s) => {
            const m = med(s);
            s.r.cash -= 12_000;
            for (const st of m.staff) st.salary = Math.round(st.salary * 1.04);
            s.r.reputation += 1;
            return "They stayed. It cost $12,000 up front and 4% on the payroll, permanently.";
          },
        },
      ],
    },
    {
      id: "insurer_contract",
      title: "An insurer wants a deal",
      tone: "good",
      cooldown: 30,
      eligible: (s) => s.r.reputation > 55 && med(s).departments.length >= 3,
      weight: () => 0.05,
      body: () =>
        "A regional insurer will route their members to you. Guaranteed volume, at a rate below what you currently bill.",
      choices: [
        {
          label: "Sign it",
          detail: "A much larger panel. They will expect to be seen.",
          apply: (s) => {
            // Sized off the current network panel, delivered to the home city
            // through the pending queue so it survives weekly resolution.
            const gained = Math.round(60 + s.r.panel * 0.18);
            s.r._panelPending = (s.r._panelPending ?? 0) + gained;
            s.r.reputation += 1;
            return `${gained} members added to your list. Capacity is now your problem.`;
          },
        },
        {
          label: "Hold out for a better rate",
          detail: "Walk away and keep your margins.",
          apply: (s) => {
            s.r.cash += 4_000;
            return "You declined. They paid a small cancellation courtesy and went elsewhere.";
          },
        },
      ],
    },
  ],
};

/** Re-exported so the balance harness can drive a week without the UI. */
export { weekRng };
