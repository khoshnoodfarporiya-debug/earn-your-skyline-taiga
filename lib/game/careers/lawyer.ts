import type { CareerDef, LedgerLine, RunState } from "../types";
import type { SetbackKind } from "../setbacks";
import { money } from "../format";
import { pushLog } from "../engine";
import { makeRng } from "../rng";
import { applySocial } from "../medical/social";
import {
  CRISIS_LABEL,
  MAX_CRISES,
  isResolved,
  stageOf,
  startCrisis,
  tickCrisis,
} from "../crisis";
import { mark } from "../timeline";
import { touchPerson } from "../people";
import {
  LAWYER_CAST,
  briefDiscount,
  conductGrace,
  costsRelief,
  mentorBonus,
  offerGoodwill,
  referralPull,
} from "./lawyerCast";
import { LAWYER_CRISIS_KINDS, practiceCrisisRisk } from "./lawyerCrises";
import {
  CASE_BY_ID,
  CASE_KINDS,
  LEGAL_CITIES,
  LEGAL_CITY_BY_ID,
  LEGAL_ROLES,
  LEGAL_ROLE_BY_ID,
  MAX_ADJOURNMENTS,
  MAX_PRESSURE,
  PAYER_BY_ID,
  RELIST_WEEKS,
  type Bill,
  feeIn,
  legalCityOf,
  legalLabourIndex,
  type PracticeState,
  type Verdict,
  COUNSEL_BY_ID,
  type CounselId,
  billDoubt,
  billWeeks,
  counselAvailable,
  counselOf,
  creditArea,
  billsOf,
  billsOwed,
  LEGAL_PREMISES,
  PREMISES_BY_ID,
  MAX_RETAINERS,
  RETAINERS,
  RETAINER_BY_ID,
  chambersRent,
  retainerHours,
  retainerIncome,
  retainerOffersOf,
  retainersOf,
  chambersOf,
  chambersPrice,
  seatsFree,
  costsOrder,
  counselFee,
  factorValue,
  firmWeight,
  hoursNeededFor,
  hoursOutstanding,
  initialPractice,
  legalWages,
  newOffers,
  oddsFor,
  payerOf,
  relistChance,
  settlementFor,
  staffHours,
  workInProgress,
} from "./casework";
import {
  LEGAL_POST_BY_ID,
  canPostLawyerWeek,
  decayPressure,
  ensureLawyerPhone,
  generateLawyerWeek,
  lawyerInitialPhone,
  lawyerPostContext,
  type PracticeWeek,
} from "./lawyerPhone";

/**
 * THE SOLICITOR
 *
 * Nothing pays until it settles, and it might not settle your way.
 *
 * The Physician's week is self-funding — you treat people, you get paid, the
 * question is only how many you can take. The Solicitor's week produces no
 * money at all. It produces *hours*, banked against outcomes months away, and
 * the rent falls due the whole time. A firm can be doing brilliant work and
 * three weeks from insolvency, which is a thing that does not happen in either
 * of the other two careers and is the whole reason this one exists.
 *
 * ----------------------------------------------------------- the two levers
 *
 * **Which instructions you accept.** Big cases pay for the firm and starve it
 * first: a group claim is 190 hours before a penny, against a window that can
 * expire. Small ones pay quickly and never build anything.
 *
 * **When you settle.** Every live case carries an offer that rises as your
 * position improves. Taking it is certain money at a discount; refusing it is
 * how you get the fee that changes the firm, and how you lose four months of
 * work. The odds are shown honestly — this career asks the player to make
 * repeated decisions under stated risk, and hiding the number would make that
 * a guess instead of a judgement.
 *
 * ------------------------------------------------- what the court does to you
 *
 * Three things were added once the career had screens to show them on, and
 * every one of them presses the same constraint rather than adding a second:
 *
 *   **the date moves.** A hearing can be relisted, which spends nothing and
 *   costs everything — the fee goes further away while the rent does not. A
 *   practice clerk is what stops it, which is finally a reason to hire one.
 *
 *   **losing costs money.** The other side's costs follow the event. Before
 *   that, running every matter to the door was a free option, because the
 *   worst outcome was a blank week. It is not a blank week.
 *
 *   **winning is not being paid.** A judgment against a slow payer is a bill,
 *   not cash. It can be sold to a factor at a discount that gets worse the
 *   further off it is, which is this career's binding constraint expressed as
 *   a button rather than as a warning.
 *
 * ---------------------------------------------------------- what it costs
 *
 * Measured, not felt. A bot that scales the firm — takes what it can staff,
 * hires against the pipeline — was played 16 times in each of the six markets
 * over 120 weeks, against the same bot on a build with none of the three
 * systems above:
 *
 *                      without          with
 *   London             128% of goal     112%
 *   Madrid              98%              85%
 *   Amsterdam           95%              78%
 *   New York           126%              95%
 *   Singapore          116%              99%
 *   Lagos               96%              87%
 *
 * So the court costs a well-run firm about fifteen points of its target and a
 * handful more weeks overdrawn. It is a real tightening and it is not a wall:
 * every market still reaches its goal inside the career's own horizon, and no
 * market spends most of the run insolvent.
 *
 * Two things the same runs settled, both of which had been wrong first time:
 *
 *   Counsel was priced at +0.07 odds for 11% of the fee, which works out to an
 *   expected return of about 10.6% — a bet that looked like an investment and
 *   was quietly a loss. It is +0.10 for 9% now. See `COUNSEL_ODDS`.
 *
 *   The practice clerk's only job was fewer adjournments, worth roughly £160 a
 *   week against a salary of £820. Nobody would ever have noticed they were
 *   losing money on it. The clerk now also collects: see `billWeeks`.
 *
 * Beware the plain bot in `scripts/cities.ts`: it carries three files and no
 * more, which caps its income at what three windows can pay and puts every
 * market at 0–4% of goal whatever the rules are. That is a property of the
 * bot, not of the career — it was so before any of this was written.
 *
 * ------------------------------------------------------ and what crises cost
 *
 * The same bot never answers a crisis, so `npm run cities` measures the price
 * of ignoring the system completely. Weeks overdrawn out of 120, before the
 * five crises existed and after:
 *
 *   London 26 → 34 · Madrid 20 → 31 · Amsterdam 22 → 30
 *   New York 68 → 72 · Singapore 50 → 56 · Lagos 25 → 28
 *
 * Three to eleven extra weeks in the red for a whole system left alone, which
 * is a cost rather than a different game. Two shapes had to be fixed to get
 * there, and both were spirals rather than difficulty:
 *
 *   The cash-emergency driver was unclamped, so a practice fifty weeks
 *   overdrawn pinned the weekly chance at its ceiling for ever — a crisis
 *   every six weeks, each making the next likelier. 101 of 120 weeks
 *   overdrawn in every market. See `practiceCrisisRisk`.
 *
 *   The neglect charge was flat, and calibrated for a firm that could have
 *   afforded the terminal choice it declined. On a one-room practice it was
 *   most of a year's rent. It scales with the practice now, bounded at both
 *   ends, and there is a quiet spell after one ends — `CRISIS_CALM`.
 *
 * ------------------------------------------------------ and practice areas
 *
 * Finished hours in a kind of work make a firm faster, better and dearer at
 * that work, and make the market send more of it — see `areaSkill`. The same
 * scaling bot, 24 runs in each of six markets, with the system off and on:
 *
 *   London  101% → 112%   Madrid 77% → 104%   Amsterdam 73% → 94%
 *   New York 85% → 103%   Singapore 92% → 115%   Lagos 75% → 95%
 *
 * A twenty-point lift, and it is a correction rather than a windfall: this
 * career measured 110% before crises were added, 93% after, and 84% by the
 * time the cast landed. It is back to reaching its goal around the horizon in
 * every market, which is where a goal should sit.
 *
 * It took four passes to get there and the first three are worth knowing
 * about. The reward began at 25% fewer hours, 15% on fees and 8 points of
 * odds, which measured at +45 points — a well-run firm blowing past its
 * target everywhere. Hours are the term that compounds, because fewer hours
 * per matter means more matters, which means more hours banked, which means
 * fewer hours per matter. It is 8% now, against 6 and 6, and full specialism
 * takes 1,400 finished hours rather than 600 so that it is a late-run
 * achievement instead of something reached by week forty.
 *
 * ------------------------------------------------------ and the chambers
 *
 * Rooms were derived from headcount, which made them an expense rather than a
 * decision and left money in this career with nowhere to go but payroll. The
 * ladder in `LEGAL_PREMISES` caps the payroll instead: rooms hold a fixed
 * number of fee earners and charge a fixed rent whether or not anybody is in
 * them, so moving up is a bet on filling the space.
 *
 * A scaling bot that moves when the rooms fill, against the same bot that
 * never moves — 24 runs in each of six markets:
 *
 *                     never moves    moves
 *   London               56%          83%
 *   Madrid               92%          95%
 *   Amsterdam            73%          95%
 *   New York             56%          81%
 *   Singapore            77%          98%
 *   Lagos                90%          86%
 *
 * Sixteen points on average, and the shape is the point: expanding pays where
 * there is work to fill the rooms and costs you where there is not. Lagos —
 * cheap fees, low reach, always busy — is the one market where taking a
 * bigger floor is overreach, which is a regional decision the career did not
 * previously contain.
 *
 * The top two rungs were priced twice. At 4,600 and 11,000 a week the moving
 * bot finished on 81% and had twenty-five people paying for a floor it could
 * not keep busy; at 3,300 and 6,800 it finishes on 90% across the board. The
 * cap is still a net tightening — a career that reached about 104% of goal
 * with free hiring now reaches about 90% — which is the correct direction for
 * a system whose whole purpose is that growth has to be paid for.
 *
 * ---------------------------------------------------------- and retainers
 *
 * The premise's opposite number: money that arrives on a day you can name,
 * paid for in hours reserved off the top of every week and in that client no
 * longer instructing you. A bot that accepts every arrangement offered
 * against the same bot that ignores them, 24 runs in each of six markets:
 *
 *                     ignores          takes
 *   worth             90% of goal      85%
 *   weeks overdrawn   9.7              5.8
 *
 * Which is the shape this had to have: retainers cost a little wealth and buy
 * real safety. A practice that is comfortable should be taking matters; one
 * that cannot see past Friday should be taking retainers. The regional split
 * says the same thing from the other side — Amsterdam and New York, where
 * matters pay best, are punished for retaining; Lagos, where they pay worst,
 * is rewarded.
 *
 * It took three passes and the first two were the same mistake twice. At
 * £900/£2,000/£4,000 a week with no ceiling, a bot taking everything finished
 * on 120% against 90% and with a third of the overdrawn weeks — better on
 * *both* axes, which is not a trade but a strictly better button. Capping at
 * three and cutting the rate to about £130 an hour halved it and left it
 * still dominant.
 *
 * The reason neither worked is worth keeping: **a growing firm is hours-rich
 * and work-poor.** The pipeline cannot always fill the week, so "hours
 * reserved" was being paid out of hours that would otherwise have idled — no
 * cost at all, at exactly the scale where the income mattered most. The fix
 * had to be denominated in the thing the firm actually lives on, so holding
 * retainers now cuts the rate at which new instructions arrive
 * (`retainerDrag`), which is a cost that grows as the firm does.
 *
 * See `casework.ts` for the model and `lawyerPhone.ts` for the handset.
 */

const GOAL = 2_500_000;
/*
 * RE-CAPITALISED 27 AUG 2026, FROM MEASUREMENT.
 *
 * Nine thousand of float was nine weeks of London's fixed costs, and the
 * first fee in this career lands months out by design — the balance
 * histogram showed every market underwater in weeks 1-20 before a single
 * growth decision was taken. The loan buys the float, so the debt rises by
 * the same amount: the practice starts with more room, not more money.
 */
const START_DEBT = 51_000;
const START_CASH = 14_000;

/**
 * How long a record the firm keeps.
 *
 * Eight was enough while the only reader was a scoreboard line. The Casework
 * and Books screens now print a history the player is meant to reason about —
 * how often the odds actually held, what fighting has cost — and eight weeks
 * of that is an anecdote rather than a record. Still bounded, because a
 * 156-week save must not grow without limit.
 */
const MAX_VERDICTS = 24;

/** Weeks of quiet a practice gets after one crisis before another can start. */
const CRISIS_CALM = 8;

/** The largest instruction a market with this reach ever sends. */
const biggestWorkIn = (reach: number): string =>
  [...CASE_KINDS]
    .filter((k) => k.prestige <= reach)
    .sort((a, b) => b.prestige - a.prestige)[0]
    ?.label.toLowerCase() ?? "nothing worth having";

export const practice = (s: RunState) => s.data.practice as PracticeState;

const NAMES = [
  "Priya Raman", "Douglas Mbeki", "Elena Sarkis", "Tom Whitfield",
  "Aisha Nuru", "Karl Brandt", "Nina Costa", "Ravi Anand",
];

/**
 * A sum quoted in London money, in the money of the market this firm is in.
 * Same reason as the Chef's: everything else about the run is local, so a
 * flat windfall or a flat demand was a different animal in every city.
 */
export const localSum = (s: RunState, amount: number): number =>
  Math.round(amount * legalCityOf(practice(s)).fee);

/**
 * What the firm is worth.
 *
 * Three assets and one liability, and the middle term is the one that had to
 * be added: judgments the firm is owed. Without it, *winning a case reduced
 * the firm's value* — the work in progress vanished at the verdict and
 * nothing replaced it until the money arrived weeks later. A player watching
 * the scoreboard would have seen their best week of the run as a loss.
 */
export const firmWorth = (s: RunState): number => {
  const p = practice(s);
  return s.r.cash + workInProgress(p) + billsOwed(p) - s.r.debt;
};

/**
 * What the firm has to be worth, here.
 *
 * Two terms, because a legal market has two ceilings. The first is the money
 * — a fixed two and a half million would make Lagos, where the same case
 * bills 45%, a longer version of London rather than a different practice. The
 * second is `reach`: a market that never sends a group claim cannot build the
 * same firm however well it is run, so asking it for the same number would
 * make the small markets a trap wearing a lower rate card.
 *
 * The reach term is deliberately gentle — a market with a quarter of the
 * ladder is not a quarter of the target — because the ceiling is meant to be
 * a real cost of choosing a quiet city, not a discount that erases it.
 */
export const goalFor = (s: RunState): number => {
  const city = legalCityOf(practice(s));
  const biggest = Math.max(...CASE_KINDS.map((k) => k.prestige));
  const reach = 0.55 + 0.45 * (Math.min(city.reach, biggest) / biggest);
  return Math.round(GOAL * city.fee * reach);
};

export const lawyer: CareerDef = {
  id: "lawyer",
  label: "Solicitor",
  tagline:
    "A practising certificate, a borrowed desk, and no clients who can pay yet.",
  distinctRule:
    "Your constraint is the case pipeline. Work is paid on settlement, so you finance months of your own hours and gamble them on outcomes you only partly control.",
  icon: "scales",
  available: true,
  weekLimit: 156,

  /*
   * Crisis work is paid for in time, not out of thin air.
   *
   * A choice that costs blocks debits `_crisisBlocks` and this is where the
   * debt is collected — so answering the regulator properly genuinely costs
   * hours that would have gone into files. The floor of two keeps a practice
   * in the worst week of its life still able to act.
   */
  timeBudget: (s) =>
    Math.max(
      2,
      (s.r.burnout > 80 ? 5 : 6) - Math.min(3, s.r._crisisBlocks ?? 0),
    ),

  resources: [
    {
      id: "cash",
      label: "Cash",
      hint: "What is actually in the client account. Fees land in lumps, months apart.",
      format: "money",
      polarity: "higher-better",
      display: "stat",
    },
    {
      id: "debt",
      label: "Practice loan",
      hint: "The certificate, the indemnity cover and the desk.",
      format: "money",
      polarity: "lower-better",
      display: "stat",
    },
    {
      id: "reputation",
      label: "Standing",
      hint: "Decides the size of work you are offered, not how much of it.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "higher-better",
      display: "meter",
    },
    {
      id: "skill",
      label: "Advocacy",
      hint: "Moves the odds on every case you run.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "higher-better",
      display: "meter",
    },
    {
      id: "burnout",
      label: "Burnout",
      hint: "Billable hours have a floor price and it is paid in these.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "lower-better",
      display: "meter",
    },
    {
      id: "_lastRevenue",
      label: "",
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
    {
      id: "casework",
      label: "Casework",
      blurb:
        "Heads down on the files. This is the work, and none of it pays today.",
      timeCost: 1,
      cashCost: 0,
      preview: (s) => [
        `+${Math.round(12 + s.r.skill * 0.12)} hours into the pipeline`,
        "Spread across every live case, oldest deadline first",
      ],
    },
    {
      id: "pitch",
      label: "Pitch for work",
      blurb: "Lunches, referrals, and asking people directly. It fills the pipeline.",
      timeCost: 1,
      cashCost: 250,
      preview: () => ["More instructions on the table", "+0.5 standing"],
    },
    {
      id: "research",
      label: "Research",
      blurb:
        "The authorities, the precedent, the thing the other side has not noticed yet.",
      timeCost: 1,
      cashCost: 0,
      preview: () => ["+1.5 advocacy", "Better odds on everything you run"],
    },
    {
      id: "network",
      label: "Build a reputation",
      blurb: "Talks, articles, sitting on the committee nobody wants to sit on.",
      timeCost: 1,
      cashCost: 150,
      preview: () => ["+1.8 standing", "Bigger instructions become reachable"],
    },
    {
      id: "rest",
      label: "Rest",
      blurb: "Leave the files on the desk for one evening.",
      timeCost: 1,
      cashCost: 0,
      preview: () => ["−10 burnout"],
    },
  ],

  events: [
    {
      id: "counsel_offer",
      title: "The other side has made an offer",
      body: () =>
        "It arrived by email at ten to five, open until Monday, and it is not quite enough.",
      weight: () => 3,
      cooldown: 12,
      eligible: (s) => practice(s).cases.length > 0,
      tone: "neutral",
      choices: [
        {
          label: "Push for the full fee",
          detail: "No change — the case runs on",
          apply: () =>
            "You let it expire. Their next one will be better, or there will not be one.",
        },
        {
          label: "Settle the oldest case now",
          detail: "Certain money, at a discount",
          apply: (s) => {
            const p = practice(s);
            const c = [...p.cases].sort((a, b) => a.dueWeek - b.dueWeek)[0];
            if (!c) return "There was nothing on the books to settle.";
            const paid = settlementFor(c, p, s.r.skill);
            s.r.cash += paid;
            creditArea(p, c.kind, c.hoursDone);
            p.cases = p.cases.filter((x) => x.id !== c.id);
            return `Settled for ${money(paid)}. Nobody is delighted, which is what a settlement is.`;
          },
        },
      ],
    },
    {
      id: "conflict",
      title: "A conflict of interest",
      body: () =>
        "The new instruction is against a company you acted for two years ago. Technically it is arguable. Technically.",
      weight: () => 2,
      cooldown: 26,
      eligible: (s) => s.week > 20,
      tone: "bad",
      choices: [
        {
          label: "Decline the instruction",
          detail: "Lose the work, keep the record clean",
          apply: (s) => {
            s.r.reputation += 1.5;
            return "You sent it to a firm across town. They will remember that.";
          },
        },
        {
          label: "Take it anyway",
          detail: "Money now, risk later",
          apply: (s, rng) => {
            s.r.cash += localSum(s, 14_000);
            if (rng.chance(0.4)) {
              s.r.reputation -= 12;
              return "It was raised with the regulator. The file is now somebody else's reading.";
            }
            return "Nobody said anything. You noticed that you had been waiting for them to.";
          },
        },
      ],
    },
    {
      id: "referral",
      title: "A referral you did not expect",
      body: () =>
        "Somebody you acted for years ago has given your name to their employer.",
      weight: () => 3,
      cooldown: 16,
      eligible: (s) => s.r.reputation > 22,
      tone: "good",
      choices: [
        {
          label: "Take the meeting",
          detail: "+3 standing",
          apply: (s) => {
            s.r.reputation += 3;
            return "It came to nothing immediately and to a great deal eventually.";
          },
        },
      ],
    },
  ],

  initialResources: () => ({
    cash: START_CASH,
    debt: START_DEBT,
    reputation: 10,
    skill: 38,
    burnout: 12,
    _lastRevenue: 0,
    _burnoutPeak: 0,
    _hours: 0,
    _pitch: 0,
    _crisisBlocks: 0,
    _crisisCalm: 0,
  }),

  cast: LAWYER_CAST,

  initialData: () => {
    const p = initialPractice();
    p.phone = lawyerInitialPhone();
    return { practice: p };
  },

  /*
   * Generated from the table, so a card cannot promise a market the
   * simulation does not have. `reach` is stated as the work itself rather
   * than as a number, because "prestige 7" means nothing and "never a group
   * claim" means everything.
   */
  startCities: LEGAL_CITIES.map((c) => ({
    id: c.id,
    name: c.name,
    country: c.country,
    position: c.position,
    blurb: c.blurb,
    effects: [
      `${Math.round(c.fee * 100)}% on every fee`,
      `${Math.round(c.rent * 100)}% chambers rent`,
      c.flow === 1
        ? "Instructions arrive at the ordinary rate"
        : c.flow > 1
          ? `${Math.round((c.flow - 1) * 100)}% more instructions in the door`
          : `${Math.round((1 - c.flow) * 100)}% fewer instructions in the door`,
      `Biggest work here: ${biggestWorkIn(c.reach)}`,
    ],
    difficulty: c.difficulty,
  })),

  applyStartCity: (s, cityId) => {
    const city = LEGAL_CITY_BY_ID.get(cityId);
    if (!city) return;
    practice(s).city = cityId;
    /* The opening is in local money, like the Chef's: what a practising
       certificate, a desk and three months of chambers cost here. */
    s.r.debt = Math.round(START_DEBT * city.rent);
    s.r.cash = Math.round(START_CASH * city.rent);
  },

  command: (s, cmd, arg) => {
    const p = practice(s);
    switch (cmd) {
      case "takeCase": {
        const offer = p.offers.find((o) => o.id === arg);
        if (!offer) return;
        const k = CASE_BY_ID.get(offer.kind);
        if (!k) return;
        p.offers = p.offers.filter((o) => o.id !== arg);
        p.cases.push({
          id: `c-${p.nextId++}`,
          kind: k.id,
          client: offer.client,
          openedWeek: s.week,
          dueWeek: s.week + k.window,
          hoursDone: 0,
          settlementOffer: 0,
          payer: offer.payer ?? "prompt",
          ...(offer.conflict
            ? { conflicted: true, opponent: offer.opponent }
            : {}),
        });
        /*
         * Every client you act for becomes somebody you can later be
         * conflicted out of acting against. Bounded, because a 156-week run
         * would otherwise carry an unbounded list of names into the save.
         */
        p.actedFor = [...new Set([...(p.actedFor ?? []), offer.client])].slice(
          -14,
        );
        pushLog(s, `Instructed by ${offer.client} — ${k.label.toLowerCase()}.`, "good");
        if (/okonjo/i.test(offer.client)) {
          touchPerson(
            s,
            "okonjo",
            { warmth: 4, trust: 2 },
            "She sent you another one.",
            "good",
          );
        }
        if (offer.conflict) {
          pushLog(
            s,
            `That one is against ${offer.opponent}, who you have acted for.`,
            "bad",
          );
        }
        break;
      }
      case "settleCase": {
        const c = p.cases.find((x) => x.id === arg);
        if (!c) return;
        const paid = settlementFor(c, p, s.r.skill);
        s.r.cash += paid;
        /* A matter you finished is a matter you learned from, however it
           finished. Settling teaches you as much about the work as a hearing
           does — arguably more. */
        creditArea(p, c.kind, c.hoursDone);
        p.cases = p.cases.filter((x) => x.id !== arg);
        p.lastVerdicts = [
          ...p.lastVerdicts,
          {
            caseId: c.id,
            kind: c.kind,
            won: true,
            fee: paid,
            odds: oddsFor(c, p, s.r.skill),
            settled: true,
            week: s.week,
          },
        ].slice(-MAX_VERDICTS);
        pushLog(s, `Settled with ${c.client} for ${money(paid)}.`, "neutral");
        /* Settling is the professional thing to do and he knows it. It is
           also, from his side, a win — which is why respect goes up and
           warmth barely moves. */
        touchPerson(
          s,
          "farrow",
          { warmth: 1, respect: 3 },
          `Settled ${c.client} without either of you wasting a day in court.`,
          "good",
        );
        break;
      }
      case "dropCase": {
        const c = p.cases.find((x) => x.id === arg);
        if (!c) return;
        p.cases = p.cases.filter((x) => x.id !== arg);
        s.r.reputation -= 2;
        pushLog(s, `You have come off the record for ${c.client}.`, "bad");
        touchPerson(
          s,
          "ellory",
          { respect: -4 },
          `You came off the record for ${c.client}.`,
          "bad",
        );
        if (/okonjo/i.test(c.client)) {
          touchPerson(
            s,
            "okonjo",
            { warmth: -14, trust: -8 },
            "You dropped her matter.",
            "bad",
          );
        }
        break;
      }
      /*
       * BRIEFING COUNSEL
       *
       * Certain cash out now against better odds at a hearing that may be
       * months away, on a case that may still be lost. Nothing else in the
       * game asks the player to spend money this precisely against this much
       * delay, which is why it is the Solicitor's own transaction.
       */
      case "briefCounsel": {
        /*
         * arg is "caseId" or "caseId:tier". The bare form is what the command
         * took before there was a ladder, and it still means the senior
         * junior — so an older interface, or a replayed command from a save
         * written then, buys exactly what it used to.
         */
        const [caseId, tierId] = arg.split(":");
        const c = p.cases.find((x) => x.id === caseId);
        if (!c || c.counsel) return;
        const k = CASE_BY_ID.get(c.kind);
        if (!k) return;
        const tier = counselOf(tierId as CounselId | undefined);
        if (tierId && !COUNSEL_BY_ID.has(tierId as CounselId)) return;
        /* Chambers will not put a silk on a house purchase, and the card does
           not offer it — this is the rule behind the card. */
        if (!counselAvailable(tier, k)) return;
        /* A clerk who rates you quotes better. Same function the Listings
           app shows the price through, so the card cannot promise a figure
           the command does not take. */
        const fee = Math.round(counselFee(p, k, tier.id) * briefDiscount(s));
        if (s.r.cash < fee) return;
        s.r.cash -= fee;
        c.counsel = true;
        c.counselTier = tier.id;
        pushLog(
          s,
          `${tier.label} briefed on ${c.client} — ${money(fee)} on the brief.`,
          "neutral",
        );
        touchPerson(
          s,
          "nakamura",
          { warmth: 3, respect: 2 },
          `You briefed her chambers on ${c.client}.`,
          "good",
        );
        break;
      }
      /*
       * SELLING A JUDGMENT
       *
       * The constraint as a button. You are owed the money and a court has
       * said so; you cannot pay chambers with that sentence. A factor will
       * buy the wait off you, and the price of the wait is the whole point.
       */
      case "factorBill": {
        const bills = billsOf(p);
        const b = bills.find((x) => x.id === arg);
        if (!b) return;
        const paid = factorValue(b, s.week);
        s.r.cash += paid;
        p.bills = bills.filter((x) => x.id !== arg);
        pushLog(
          s,
          `Sold the ${b.client} judgment for ${money(paid)} against ${money(b.amount)} on its face.`,
          "neutral",
        );
        break;
      }
      case "hireLegal": {
        const role = LEGAL_ROLE_BY_ID.get(arg);
        if (!role) return;
        /* Rooms hold people. A firm that has run out of chambers cannot hire
           its way past the walls — moving is the answer, and the Roll says so
           rather than greying a button with no reason. */
        if (seatsFree(p) <= 0) return;
        /* Local money: this market's salary goes on the payroll, and stays
           that person's from then on. */
        const labour = legalLabourIndex(p);
        const hireCost = Math.round(role.hireCost * labour);
        if (s.r.cash < hireCost) return;
        s.r.cash -= hireCost;
        p.staff.push({
          id: `s-${p.nextId}`,
          name: NAMES[p.nextId++ % NAMES.length],
          role: role.id,
          salary: Math.round(role.salary * labour),
        });
        p.rooms = Math.max(1, Math.ceil((p.staff.length + 1) / 3));
        break;
      }
      /*
       * ANSWERING A CRISIS
       *
       * The Physician's copy of this lives in `medical/phase2.ts` and applies
       * the six medical reputation categories and a medical cast. A practice
       * has neither, so this applies what a practice actually has: cash,
       * borrowing, standing and next week's hours.
       *
       * Every gate is re-checked here. The card's disabled state is a hint.
       */
      case "crisisChoice": {
        // arg is "crisisId:choiceId", as the card sends it.
        const [crisisId, choiceId] = arg.split(":");
        const c = (s.crises ?? []).find((x) => x.id === crisisId);
        if (!c) return;
        const choice = stageOf(c).choices.find((x) => x.id === choiceId);
        if (!choice) return;
        /* One choice per stage. Without this a player takes every option on a
           stage and stacks the severity reductions. */
        if (c.taken.includes(choiceId)) return;

        /* London figures, charged in this market's money — the same rule
           every other sum in this career follows, and the same function the
           card quotes through. */
        const cost = choice.cost ? localSum(s, choice.cost) : 0;
        if (cost > s.r.cash) return;

        if (cost > 0) s.r.cash -= cost;
        if (choice.debt) s.r.debt += localSum(s, choice.debt);
        if (choice.blocks) {
          s.r._crisisBlocks = (s.r._crisisBlocks ?? 0) + choice.blocks;
        }
        if (choice.standing) {
          s.r.reputation = Math.max(
            0,
            Math.min(100, s.r.reputation + choice.standing),
          );
        }
        c.severity = Math.max(0, Math.min(100, c.severity + choice.severity));
        c.taken.push(choiceId);
        c.ignored = 0;
        if (choice.next !== undefined) c.stage = choice.next;
        pushLog(s, choice.result, choice.severity < 0 ? "good" : "bad");
        break;
      }
      /*
       * MOVING
       *
       * The one place in this career money can go that is not a salary. Rent
       * is due whether or not the rooms are full, so taking a floor you cannot
       * yet staff is a bet on filling it — the same bet the whole career is,
       * in property.
       *
       * Up the ladder only. Downsizing is a real thing a struggling practice
       * does and it is not built: it would need a rule for who loses their
       * desk, and picking that for the player is worse than not offering it.
       */
      case "takeChambers": {
        const to = PREMISES_BY_ID.get(arg);
        if (!to) return;
        const here = chambersOf(p);
        if (
          LEGAL_PREMISES.indexOf(to) <= LEGAL_PREMISES.indexOf(here)
        ) {
          return;
        }
        const price = chambersPrice(p, to);
        if (s.r.cash < price) return;
        s.r.cash -= price;
        p.premises = to.id;
        pushLog(
          s,
          `Moved into ${to.label.toLowerCase()} — ${money(price)}, and the rent from now on.`,
          "good",
        );
        touchPerson(
          s,
          "ellory",
          { respect: 3, warmth: 2 },
          `You took ${to.label.toLowerCase()}.`,
          "good",
        );
        break;
      }
      /*
       * TAKING ONE ON
       *
       * The only money in this career that arrives on a day you can name. It
       * costs hours off the top of every week and it stops that client
       * sending you instructions — see `RETAINERS`.
       */
      case "takeRetainer": {
        const offer = retainerOffersOf(p).find((o) => o.id === arg);
        if (!offer) return;
        const kind = RETAINER_BY_ID.get(offer.kind);
        if (!kind) return;
        /* A practice can only hold so many. See MAX_RETAINERS for what the
           simulation said about what happens without a ceiling. */
        if (retainersOf(p).length >= MAX_RETAINERS) return;
        p.retainerOffers = retainerOffersOf(p).filter((o) => o.id !== arg);
        p.retainers = [
          ...retainersOf(p),
          {
            id: `r-${p.nextId++}`,
            kind: kind.id,
            client: offer.client,
            fromWeek: s.week,
            weeks: kind.weeks,
          },
        ];
        pushLog(
          s,
          `${offer.client} have put you on ${kind.label.toLowerCase()} — ${money(localSum(s, kind.fee))} a week, and ${kind.hours} hours of yours a week.`,
          "good",
        );
        break;
      }

      /*
       * Giving notice. Costs standing rather than money: you are the one
       * walking away, and the profession is small.
       */
      case "endRetainer": {
        const held = retainersOf(p).find((x) => x.id === arg);
        if (!held) return;
        p.retainers = retainersOf(p).filter((x) => x.id !== arg);
        s.r.reputation = Math.max(0, s.r.reputation - 3);
        pushLog(s, `You have given ${held.client} notice.`, "bad");
        touchPerson(
          s,
          "ellory",
          { respect: -2 },
          `You came off ${held.client}'s retainer.`,
          "bad",
        );
        break;
      }
      case "payLoan": {
        const pay = Math.min(10_000, s.r.debt, Math.max(0, s.r.cash));
        if (pay <= 0) return;
        s.r.cash -= pay;
        s.r.debt -= pay;
        break;
      }

      /* ------------------------------------------------------- the handset */

      case "post": {
        /*
         * The Pulse transaction, mirrored from the other two careers but
         * running on the legal catalogue. Every gate is re-checked here: the
         * composer's disabled state is a hint, not a rule.
         */
        const def = LEGAL_POST_BY_ID.get(arg);
        if (!def) return;
        if (!canPostLawyerWeek(p, s.week)) return;
        const phone = ensureLawyerPhone(p);
        if (def.once && phone.postsMade.includes(def.id)) return;
        const ctx = lawyerPostContext(p, s.week);
        if (!def.available(ctx)) return;

        /* Its own derived stream, so publishing can never disturb the
           listing, verdict or recovery dice. */
        const rng = makeRng((s.seed ^ (s.week * 0x6a09e667)) >>> 0);
        const misfired = def.hazard !== undefined && rng.chance(def.hazard);
        const outcome = misfired && def.backfire ? def.backfire.effect : def.effect;
        applySocial(phone.social, outcome);

        /*
         * The practice-side effect lands whether or not it misfired, and that
         * is deliberate: a matter that is in the papers is in the papers. What
         * a backfire costs you is the profession's opinion, not the leverage —
         * otherwise "take it to the press" would be a coin toss rather than a
         * priced risk.
         */
        const law = def.law;
        if (law) {
          if (law.instructions) p.echo = (p.echo ?? 0) + law.instructions;
          if (law.pressure) {
            p.pressure = Math.min(
              MAX_PRESSURE,
              (p.pressure ?? 0) + law.pressure,
            );
          }
          if (law.standing) s.r.reputation += law.standing;
        }

        phone.feed = [
          {
            id: `you-${s.week}`,
            week: s.week,
            author: "You",
            handle: "@you",
            kind: "player" as const,
            body: def.body(ctx),
            likes: Math.round(3 + phone.social.followers / 60),
            comments:
              misfired && def.backfire
                ? [
                    {
                      author: "Julian Farrow",
                      handle: "@farrow_defence",
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
        for (const msg of ensureLawyerPhone(p).messages) msg.read = true;
        break;
      }

      case "readNews": {
        for (const item of ensureLawyerPhone(p).news) item.read = true;
        break;
      }

      case "answerMessage": {
        // arg is "messageId|choiceIndex", as the messages app sends it.
        const [msgId, rawIndex] = arg.split("|");
        const phone = ensureLawyerPhone(p);
        const msg = phone.messages.find((x) => x.id === msgId);
        if (!msg || !msg.choices || msg.answered !== undefined) return;
        const index = Number(rawIndex);
        const choice = msg.choices[index];
        if (!choice) return;
        applySocial(phone.social, choice.effect);

        /*
         * Opposing counsel's offer is a real transaction, not a conversation.
         *
         * The figure is carried in the message id — `offer-c-3-14250` is the
         * case c-3 at the sum quoted when it was written — so accepting pays
         * exactly what was on the table rather than whatever the number has
         * since drifted to. The id is parsed from the right, because a case
         * id contains a hyphen of its own and a single split ate it.
         */
        if (msg.id.startsWith("offer-") && index === 0) {
          const rest = msg.id.slice("offer-".length);
          const cut = rest.lastIndexOf("-");
          const caseId = rest.slice(0, cut);
          const amount = Number(rest.slice(cut + 1));
          const c = p.cases.find((x) => x.id === caseId);
          if (c && Number.isFinite(amount) && amount > 0) {
            s.r.cash += amount;
            creditArea(p, c.kind, c.hoursDone);
            p.cases = p.cases.filter((x) => x.id !== caseId);
            p.lastVerdicts = [
              ...p.lastVerdicts,
              {
                caseId,
                kind: c.kind,
                won: true,
                fee: amount,
                odds: oddsFor(c, p, s.r.skill),
                settled: true,
                week: s.week,
              },
            ].slice(-MAX_VERDICTS);
            pushLog(
              s,
              `Settled with ${c.client} for ${money(amount)} on their offer.`,
              "neutral",
            );
          }
        }

        msg.answered = index;
        break;
      }
    }
  },

  applyAction: (s, id) => {
    switch (id) {
      case "casework":
        s.r._hours = (s.r._hours ?? 0) + 12 + s.r.skill * 0.12;
        s.r.burnout += 4;
        break;
      case "pitch":
        s.r._pitch = (s.r._pitch ?? 0) + 1;
        s.r.reputation += 0.5;
        s.r.burnout += 1.8;
        break;
      case "research":
        /* An hour of reading, plus whatever an hour of Margaret is worth —
           which is nothing at all until she trusts you. */
        s.r.skill += 1.5 + mentorBonus(s);
        s.r.burnout += 2;
        break;
      case "network":
        s.r.reputation += 1.8;
        s.r.burnout += 1.6;
        break;
      case "rest":
        s.r.burnout -= 10;
        break;
    }
  },

  resolveWeek: (s, rng) => {
    const p = practice(s);
    const out: LedgerLine[] = [];

    /*
     * Derived streams, one per subsystem.
     *
     * The verdict dice stay on the week's own `rng`, which is what they have
     * always run on. Everything added since gets a stream of its own, so that
     * a court moving a date cannot shift which cases are won — two runs on
     * the same seed have to be the same run, and a shared stream makes every
     * new mechanic a silent rebalance of every old one.
     */
    /* The crisis-time debt is collected by `timeBudget` and cleared here, so
       answering one costs exactly one week rather than compounding. */
    s.r._crisisBlocks = 0;

    const listRng = makeRng((s.seed ^ (s.week * 0x5b7f4d21)) >>> 0);
    const recoverRng = makeRng((s.seed ^ (s.week * 0x1f3a77c5)) >>> 0);
    const conductRng = makeRng((s.seed ^ (s.week * 0x2c9e51b7)) >>> 0);

    /*
     * 1. Hours go into the files, nearest deadline first.
     *
     * Your blocks plus whatever the firm contributes. Spreading by deadline
     * rather than evenly is the behaviour a competent practice actually has,
     * and it means a player who over-commits watches the far cases starve
     * rather than everything degrading equally.
     */
    /* Retained hours come off the top, before a single one reaches a live
       matter, and they are gone whether or not the client rang this week. */
    const reserved = retainerHours(p);
    let hours = Math.max(0, (s.r._hours ?? 0) + staffHours(p) - reserved);
    const byDeadline = [...p.cases].sort((a, b) => a.dueWeek - b.dueWeek);
    for (const c of byDeadline) {
      if (hours <= 0) break;
      const k = CASE_BY_ID.get(c.kind);
      if (!k) continue;
      /* Fill to the minimum first; anything past that is preparation and
         improves the odds rather than being wasted. */
      const need = hoursNeededFor(p, k);
      const want = Math.max(0, need - c.hoursDone);
      const take = want > 0 ? Math.min(hours, want) : Math.min(hours, need * 0.1);
      c.hoursDone += take;
      hours -= take;
    }

    /* 2. Deadlines. A case that reaches its date resolves — ready or not,
          unless the court has other ideas. */
    const verdicts: Verdict[] = [];
    const survivors = [];
    const relisted: PracticeWeek["relisted"] = [];
    /* What each loss actually cost, so the ledger line and the record print
       the same number rather than each recomputing it. */
    const settled_costs = new Map<string, number>();
    /** Fees that arrived as money this week. */
    let collected = 0;
    /** Fees a court awarded that are now somebody's promise instead. */
    let billedOut = 0;
    let costsPaid = 0;
    let conflictRaised = false;

    for (const c of p.cases) {
      const k = CASE_BY_ID.get(c.kind);
      if (!k) continue;
      if (s.week < c.dueWeek) {
        c.settlementOffer = settlementFor(c, p, s.r.skill);
        survivors.push(c);
        continue;
      }

      /*
       * THE DATE MOVES.
       *
       * Rolled at the hearing rather than in advance, so the player has
       * already committed the hours before finding out. Capped, because a
       * matter that can be put off for ever is not a decision, it is a leak
       * — and the cap is what makes a clerk an improvement rather than the
       * difference between finishing and not.
       */
      if (
        (c.adjournments ?? 0) < MAX_ADJOURNMENTS &&
        listRng.chance(relistChance(p, k))
      ) {
        const by = listRng.int(RELIST_WEEKS[0], RELIST_WEEKS[1]);
        c.dueWeek = s.week + by;
        c.adjournments = (c.adjournments ?? 0) + 1;
        c.settlementOffer = settlementFor(c, p, s.r.skill);
        relisted.push({ client: c.client, kind: c.kind, weeks: by });
        survivors.push(c);
        pushLog(
          s,
          `${k.label} for ${c.client} — relisted, put back ${by} weeks. The rent is not.`,
          "bad",
        );
        continue;
      }

      /* Underprepared cases are not merely less likely to win — arriving at
         court without the hours is close to conceding. */
      const ready = Math.min(1, c.hoursDone / hoursNeededFor(p, k));
      const odds = ready < 1 ? oddsFor(c, p, s.r.skill) * ready * 0.6 : oddsFor(c, p, s.r.skill);
      const won = rng.chance(odds);
      /* What it bills here, not what the catalogue says — the catalogue is
         London's rate card and the firm may not be in London.
         Read *before* the area is credited below, so a matter pays what the
         firm was worth while it was doing it rather than what finishing it
         turned the firm into. */
      const fee = feeIn(p, k);

      if (won) {
        /*
         * WINNING IS NOT BEING PAID.
         *
         * A prompt payer hands over money. Anybody else hands over a
         * judgment, which sits on the books doing nothing until it matures
         * or you sell it. The player was told which they were dealing with
         * before they accepted the instruction.
         */
        const payer = payerOf(c.payer);
        const wait = billWeeks(p, payer);
        if (wait === 0) {
          collected += fee;
        } else {
          billedOut += fee;
          const bill: Bill = {
            id: `b-${p.nextId++}`,
            client: c.client,
            kind: c.kind,
            amount: fee,
            dueWeek: s.week + wait,
            payer: payer.id,
          };
          p.bills = [...billsOf(p), bill];
        }
        s.r.reputation += k.prestige;
        touchPerson(
          s,
          "ellory",
          { respect: 2 + k.prestige * 0.2 },
          `You won ${k.label.toLowerCase()} for ${c.client}.`,
          "good",
        );
        if (/okonjo/i.test(c.client)) {
          touchPerson(
            s,
            "okonjo",
            { warmth: 6, trust: 4 },
            "You won hers.",
            "good",
          );
        }
        pushLog(
          s,
          wait === 0
            ? `${k.label} for ${c.client} — won. ${money(fee)}.`
            : `${k.label} for ${c.client} — won. ${money(fee)} billed, due week ${s.week + wait}.`,
          "good",
        );
      } else {
        /*
         * COSTS FOLLOW THE EVENT.
         *
         * The single change that makes settling a decision instead of a
         * concession: losing is no longer a blank week, it is a bill.
         */
        /* Derek argues them down, if he trusts you enough to be asked. */
        const costs = Math.round(
          costsOrder(p, k, Boolean(c.counsel), c.counselTier) * costsRelief(s),
        );
        costsPaid += costs;
        settled_costs.set(c.id, costs);
        s.r.reputation -= k.prestige * 0.5;
        /* He is now involved whether either of you wanted it. */
        touchPerson(
          s,
          "oyelaran",
          { warmth: 2, trust: 1 },
          `He took their bill of costs on ${c.client} apart for you.`,
          "neutral",
        );
        if (/okonjo/i.test(c.client)) {
          touchPerson(
            s,
            "okonjo",
            { warmth: -8, trust: -5 },
            "You lost hers.",
            "bad",
          );
        }
        pushLog(
          s,
          `${k.label} for ${c.client} — lost. Nothing to bill, and ${money(costs)} of their costs.`,
          "bad",
        );
      }

      /*
       * A conflicted matter is read by somebody eventually, and the eventually
       * is the verdict. Standing rather than cash, because standing is what
       * decides the size of work this firm is ever sent again.
       */
      if (c.conflicted && conductRng.chance(0.35 * conductGrace(s))) {
        s.r.reputation -= 10;
        conflictRaised = true;
        pushLog(
          s,
          `Acting against ${c.opponent ?? "a former client"} has been raised with the regulator.`,
          "bad",
        );
        touchPerson(
          s,
          "whitcombe",
          { trust: -12, remember: ["conflict-raised"] },
          `She read your file on ${c.client}.`,
          "bad",
        );
      }

      /* Finished, either way, and the firm is a little more the kind of firm
         that does this. */
      creditArea(p, c.kind, c.hoursDone);

      verdicts.push({
        caseId: c.id,
        kind: c.kind,
        won,
        fee: won ? fee : 0,
        odds,
        settled: false,
        week: s.week,
        costs: won ? 0 : (settled_costs.get(c.id) ?? 0),
        billed: won && billWeeks(p, payerOf(c.payer)) > 0,
      });
    }
    p.cases = survivors;

    if (verdicts.length > 0) {
      p.lastVerdicts = [...p.lastVerdicts, ...verdicts].slice(-MAX_VERDICTS);
      const wins = verdicts.filter((v) => v.won).length;
      out.push({
        label:
          verdicts.length === 1
            ? wins === 1
              ? "Case won"
              : "Case lost"
            : `${wins} of ${verdicts.length} cases won`,
        amount: collected,
        kind: "income",
        note:
          billedOut > 0
            ? `${money(billedOut)} awarded and billed — not money yet.`
            : collected === 0
              ? "Months of work, nothing to bill."
              : undefined,
      });
    }
    if (costsPaid > 0) {
      out.push({
        label: "Costs order",
        amount: -costsPaid,
        kind: "expense",
        note: "The other side's solicitors, paid by you.",
      });
    }

    /*
     * 3. Judgments that have come good.
     *
     * A doubtful payer gets one roll at maturity, and losing it does not
     * write the debt off — it writes it *down*, because a client arguing
     * about a bill still pays something and a career with no recovery route
     * is a career with a game over in it.
     */
    const billsPaid: PracticeWeek["billsPaid"] = [];
    const matured = billsOf(p).filter((b) => b.dueWeek <= s.week);
    if (matured.length > 0) {
      let recovered = 0;
      for (const b of matured) {
        const payer = payerOf(b.payer);
        const doubt = billDoubt(p, payer);
        const short = doubt > 0 && recoverRng.chance(doubt);
        const paid = short ? Math.round(b.amount * payer.recovers) : b.amount;
        recovered += paid;
        billsPaid.push({ client: b.client, amount: paid, writtenDown: short });
        if (short) {
          pushLog(
            s,
            `${b.client} settled their account at ${money(paid)} against ${money(b.amount)}. A judgment is not a payment.`,
            "bad",
          );
        }
      }
      p.bills = billsOf(p).filter((b) => b.dueWeek > s.week);
      collected += recovered;
      out.push({
        label: matured.length === 1 ? "Bill collected" : `${matured.length} bills collected`,
        amount: recovered,
        kind: "income",
        note: billsPaid.some((b) => b.writtenDown)
          ? "One of them argued, and won some of the argument."
          : undefined,
      });
    }

    /* 4. New instructions, and old offers going cold. */
    p.offers = p.offers.filter((o) => o.expiresWeek > s.week);
    /* Being recommended is not the same as being better regarded, so the
       referral is added at the gate rather than to standing itself. */
    p.offers.push(
      ...newOffers(
        p,
        s.r.reputation + referralPull(s),
        s.week,
        s.r._pitch ?? 0,
        rng,
      ),
    );
    p.offers = p.offers.slice(0, 6);

    /*
     * And somebody occasionally asks to put you on a retainer.
     *
     * Only from a client you have actually acted for — nobody hands a
     * standing arrangement to a stranger — and only what your standing
     * warrants. Its own stream, so an arrangement being offered can never
     * disturb the court's dice.
     */
    p.retainerOffers = retainerOffersOf(p).filter(
      (o) => o.expiresWeek > s.week,
    );
    {
      const retainRng = makeRng((s.seed ^ (s.week * 0x4d3f8b17)) >>> 0);
      const held = new Set(retainersOf(p).map((x) => x.client));
      const offered = new Set(retainerOffersOf(p).map((x) => x.client));
      const candidates = (p.actedFor ?? []).filter(
        (c) => !held.has(c) && !offered.has(c),
      );
      const reachable = RETAINERS.filter((k) => k.needs <= s.r.reputation);
      if (
        candidates.length > 0 &&
        reachable.length > 0 &&
        retainersOf(p).length < MAX_RETAINERS &&
        retainerOffersOf(p).length < 2 &&
        retainRng.chance(0.07)
      ) {
        const kind = reachable[reachable.length - 1];
        p.retainerOffers = [
          ...retainerOffersOf(p),
          {
            id: `ro-${p.nextId++}`,
            kind: kind.id,
            client: retainRng.pick(candidates),
            expiresWeek: s.week + 3,
          },
        ];
      }
    }

    /*
     * 5. The money that does not care either.
     *
     * Booked before the costs below rather than after, because that is the
     * order it matters in: this is the only line in the career that is there
     * whatever the week did.
     */
    const retained = retainerIncome(p);
    if (retained > 0) {
      out.push({
        label:
          retainersOf(p).length === 1
            ? "Retainer"
            : `${retainersOf(p).length} retainers`,
        amount: retained,
        kind: "income",
        note: `${reserved} hours a week reserved for them.`,
      });
    }

    /* Arrangements run down, and none of them lasts for ever. */
    for (const held of [...retainersOf(p)]) {
      held.weeks -= 1;
      if (held.weeks <= 0) {
        p.retainers = retainersOf(p).filter((x) => x !== held);
        pushLog(
          s,
          `${held.client}'s retainer has come to its end. Their hours are yours again.`,
          "neutral",
        );
      }
    }

    /* 5. The costs that do not care whether anything settled this week. */
    const r = chambersRent(p);
    out.push({ label: "Chambers", amount: -r, kind: "expense" });
    const w = legalWages(p);
    if (w > 0) out.push({ label: "Salaries", amount: -w, kind: "expense" });

    if (s.r.debt > 0) {
      const interest = Math.round(s.r.debt * 0.0018);
      s.r.debt += interest;
      out.push({ label: "Practice loan interest", amount: -interest, kind: "expense" });
    }

    /* What falls due every week whatever happens — the denominator for how
       much cover the office account actually has. */
    const weekly = r + w;
    s.r.cash += collected + retained - costsPaid - r - w;
    s.r._lastRevenue = collected;
    s.r._burnoutPeak = Math.max(s.r._burnoutPeak ?? 0, s.r.burnout);
    s.r.burnout = Math.max(0, s.r.burnout - 2);
    s.r.reputation = Math.max(0, Math.min(100, s.r.reputation));
    s.r._hours = 0;
    s.r._pitch = 0;


    /*
     * 6. THE BAD FORTNIGHTS.
     *
     * A crisis is a state machine that lives on the run rather than an event
     * with two buttons — see `crisis.ts` for the machinery and
     * `lawyerCrises.ts` for the five a practice can actually suffer.
     *
     * Neglect compounds and then ends it badly, which is what stops "I will
     * deal with it later" being a free delay. Prevention is modelled: every
     * term in `practiceCrisisRisk` is something the player controls, so a
     * careful practice sees fewer of these and the ones it sees start
     * smaller.
     */
    const crisisRng = makeRng((s.seed ^ (s.week * 0x7f4a7c15)) >>> 0);

    for (const c of [...(s.crises ?? [])]) {
      const { escalated, burnedOut } = tickCrisis(c);
      if (escalated) {
        pushLog(
          s,
          `${CRISIS_LABEL[c.kind]}: you left it too long, and it has moved on without you.`,
          "bad",
        );
      }
      if (burnedOut) {
        /*
         * The bill for having done nothing, and then it is over.
         *
         * Scaled to the practice rather than flat, and bounded at both ends.
         * A flat charge is the terminal choice's price, which is calibrated
         * for a firm that could have afforded the terminal choice — on a
         * one-room practice it was most of a year's rent and started the
         * spiral it was supposed to punish. This career has no self-healing
         * cash: a doctor who ignores a crisis still bills patients every
         * week, and a solicitor does not, so the same penalty is a different
         * animal here.
         */
        s.crises = (s.crises ?? []).filter((x) => x !== c);
        const neglected = Math.max(
          localSum(s, 6_000),
          Math.min(localSum(s, 30_000), weekly * 6),
        );
        s.r.cash -= neglected;
        s.r.reputation = Math.max(0, s.r.reputation - 5);
        s.r._crisisCalm = CRISIS_CALM;
        pushLog(
          s,
          `The ${CRISIS_LABEL[c.kind].toLowerCase()} resolved itself, in the worst available way.`,
          "bad",
        );
        touchPerson(
          s,
          "whitcombe",
          { trust: -8 },
          `The ${CRISIS_LABEL[c.kind].toLowerCase()} ran for ${s.week - c.startedWeek} weeks unanswered.`,
          "bad",
        );
        touchPerson(
          s,
          "ellory",
          { respect: -5 },
          "She heard how you handled it, which was not at all.",
          "bad",
        );
        mark(
          s,
          `crisis-burned-${c.id}`,
          "failure",
          `You let the ${CRISIS_LABEL[c.kind].toLowerCase()} run`,
          `${s.week - c.startedWeek} weeks, and you never answered it.`,
        );
        continue;
      }
      if (isResolved(c)) {
        s.crises = (s.crises ?? []).filter((x) => x !== c);
        s.r.reputation = Math.min(100, s.r.reputation + 3);
        s.r._crisisCalm = CRISIS_CALM;
        pushLog(
          s,
          `The ${CRISIS_LABEL[c.kind].toLowerCase()} is closed. It took ${s.week - c.startedWeek} weeks.`,
          "good",
        );
        touchPerson(
          s,
          "ellory",
          { respect: 4, trust: 2 },
          `You came through the ${CRISIS_LABEL[c.kind].toLowerCase()}.`,
          "good",
        );
        mark(
          s,
          `crisis-${c.id}`,
          "recovery",
          `You came through the ${CRISIS_LABEL[c.kind].toLowerCase()}`,
          `${s.week - c.startedWeek} weeks of it.`,
        );
      }
    }

    s.r._crisisCalm = Math.max(0, (s.r._crisisCalm ?? 0) - 1);

    /*
     * One bad fortnight at a time.
     *
     * Without the quiet spell the week a crisis ended was a week that could
     * start another, and since ending one usually leaves the practice poorer
     * than it began, the next was likelier than the last. That is a spiral
     * rather than a system, and the recovery route this game promises has to
     * be long enough to actually walk down.
     */
    if ((s.crises ?? []).length < MAX_CRISES && (s.r._crisisCalm ?? 0) <= 0) {
      const soon = p.cases.filter((c) => c.dueWeek - s.week <= 3);
      const risk = practiceCrisisRisk({
        week: s.week,
        cashWeeks: weekly > 0 ? s.r.cash / weekly : 99,
        lost: p.lastVerdicts.filter((v) => !v.won && !v.settled).length,
        unprepared: soon.filter((c) => {
          const k = CASE_BY_ID.get(c.kind);
          return k ? c.hoursDone < k.hours : false;
        }).length,
        conflicted: p.cases.filter((c) => c.conflicted).length,
        scrutiny: p.phone?.social.scrutiny ?? 0,
        staff: p.staff.length,
        burnout: s.r.burnout,
      });

      /* One of each kind at a time: two simultaneous client-account audits is
         not a harder game, it is the same card twice. */
      const running = new Set((s.crises ?? []).map((c) => c.kind));
      if (
        risk.kind &&
        LAWYER_CRISIS_KINDS.includes(risk.kind) &&
        !running.has(risk.kind) &&
        crisisRng.chance(risk.chance)
      ) {
        /* A practice that is not running itself into the ground gets the
           milder version. Prevention is not only "fewer of them". */
        const severity =
          40 + Math.max(0, s.r.burnout - 40) * 0.35 + crisisRng.int(0, 20);
        const crisis = startCrisis(
          risk.kind,
          s.week,
          severity,
          undefined,
          "lawyer",
        );
        s.crises = [...(s.crises ?? []), crisis];
        pushLog(
          s,
          `${CRISIS_LABEL[risk.kind]}. This one will not resolve itself.`,
          "bad",
        );
        mark(
          s,
          `crisis-began-${crisis.id}`,
          "crisis",
          CRISIS_LABEL[risk.kind],
          risk.drivers.length
            ? `It came out of ${risk.drivers.slice(0, 2).join(" and ")}.`
            : "It came out of nowhere.",
        );
      }
    }

    /*
     * 7. What the profession says about the week that just happened, and
     * what the publicity you bought is worth one week later. A stream of its
     * own, like the Chef's, so the phone can never disturb the court's dice
     * — and an old save without a phone gains one here.
     */
    generateLawyerWeek(
      p,
      s.week,
      s.r.reputation,
      s.r.skill,
      offerGoodwill(s),
      { verdicts, relisted, billsPaid, costsPaid, conflictRaised },
      makeRng((s.seed ^ (s.week * 0x3f83a1c9)) >>> 0),
    );
    decayPressure(p);

    return out;
  },

  checkSetbacks: (s) => {
    const out: SetbackKind[] = [];
    if (Math.max(s.r.burnout, s.r._burnoutPeak ?? 0) >= 100) out.push("collapse");
    /* In local money, so "insolvent" means the same thing in every market. */
    if (s.r.cash < -50_000 * legalCityOf(practice(s)).fee) {
      out.push("insolvency");
    }
    if (s.r.reputation <= 2 && s.week > 24) out.push("disgrace");
    if (out.includes("collapse")) s.r._burnoutPeak = 0;
    return out;
  },

  validateData: (data) => {
    if (typeof data !== "object" || data === null) return false;
    const raw = (data as { practice?: unknown }).practice;
    if (typeof raw !== "object" || raw === null) return false;
    const p = raw as PracticeState;
    if (!Array.isArray(p.cases) || !Array.isArray(p.offers)) return false;
    if (!Array.isArray(p.staff)) return false;
    if (p.cases.some((c) => !CASE_BY_ID.has(c.kind))) return false;
    if (p.offers.some((o) => !CASE_BY_ID.has(o.kind))) return false;
    if (p.staff.some((x) => !LEGAL_ROLE_BY_ID.has(x.role))) return false;
    /* Optional: absent means London, present means a market that exists. */
    if (p.city !== undefined && !LEGAL_CITY_BY_ID.has(p.city)) return false;

    /*
     * Everything below arrived after the career shipped. All optional, all
     * checked only when present — an absent field is a valid older save, and
     * a present one that the catalogue does not recognise would render a
     * blank line and apply nothing, which is worse than a rejected save.
     */
    if (
      p.cases.some((c) => c.payer !== undefined && !PAYER_BY_ID.has(c.payer))
    ) {
      return false;
    }
    if (
      p.offers.some((o) => o.payer !== undefined && !PAYER_BY_ID.has(o.payer))
    ) {
      return false;
    }
    if (
      p.cases.some(
        (c) =>
          c.adjournments !== undefined &&
          (typeof c.adjournments !== "number" ||
            c.adjournments < 0 ||
            c.adjournments > MAX_ADJOURNMENTS),
      )
    ) {
      return false;
    }
    if (p.bills !== undefined) {
      if (!Array.isArray(p.bills)) return false;
      if (
        p.bills.some(
          (b) =>
            !CASE_BY_ID.has(b.kind) ||
            !PAYER_BY_ID.has(b.payer) ||
            typeof b.amount !== "number" ||
            !Number.isFinite(b.amount) ||
            typeof b.dueWeek !== "number",
        )
      ) {
        return false;
      }
    }
    if (p.actedFor !== undefined && !Array.isArray(p.actedFor)) return false;
    if (p.retainers !== undefined) {
      if (!Array.isArray(p.retainers)) return false;
      if (
        p.retainers.some(
          (x) =>
            !RETAINER_BY_ID.has(x.kind) ||
            typeof x.weeks !== "number" ||
            !Number.isFinite(x.weeks),
        )
      ) {
        return false;
      }
    }
    if (p.retainerOffers !== undefined) {
      if (!Array.isArray(p.retainerOffers)) return false;
      if (p.retainerOffers.some((x) => !RETAINER_BY_ID.has(x.kind))) {
        return false;
      }
    }
    if (p.premises !== undefined && !PREMISES_BY_ID.has(p.premises)) {
      return false;
    }
    if (
      p.cases.some(
        (c) =>
          c.counselTier !== undefined && !COUNSEL_BY_ID.has(c.counselTier),
      )
    ) {
      return false;
    }
    if (p.areas !== undefined) {
      if (typeof p.areas !== "object" || p.areas === null) return false;
      if (
        Object.entries(p.areas).some(
          ([id, hours]) =>
            !CASE_BY_ID.has(id) ||
            typeof hours !== "number" ||
            !Number.isFinite(hours) ||
            hours < 0,
        )
      ) {
        return false;
      }
    }
    if (
      p.echo !== undefined &&
      (typeof p.echo !== "number" || !Number.isFinite(p.echo) || p.echo < 0)
    ) {
      return false;
    }
    if (
      p.pressure !== undefined &&
      (typeof p.pressure !== "number" ||
        !Number.isFinite(p.pressure) ||
        p.pressure < 0 ||
        p.pressure > 1)
    ) {
      return false;
    }
    /* The phone is optional — a save from before it existed simply has none —
       but a present one has to hold the shapes the handset renders. */
    if (p.phone !== undefined) {
      const ph = p.phone;
      if (typeof ph !== "object" || ph === null) return false;
      if (
        !Array.isArray(ph.feed) ||
        !Array.isArray(ph.messages) ||
        !Array.isArray(ph.news)
      ) {
        return false;
      }
      const soc = ph.social;
      if (
        typeof soc !== "object" ||
        soc === null ||
        [soc.followers, soc.trust, soc.sentiment, soc.scrutiny].some(
          (v) => typeof v !== "number" || !Number.isFinite(v),
        )
      ) {
        return false;
      }
    }
    return true;
  },

  scoreboard: (s) => {
    const p = practice(s);
    const owed = billsOwed(p);
    return {
      label: "The firm",
      value: money(firmWorth(s)),
      sub: `${money(s.r.cash)} cash · ${p.cases.length} live · ${money(owed)} billed · ${money(workInProgress(p))} unbilled`,
    };
  },

  briefing: (s, alloc) => {
    const p = practice(s);
    const mine = (alloc.casework ?? 0) * (12 + s.r.skill * 0.12);
    const total = Math.round(
      Math.max(0, mine + staffHours(p) - retainerHours(p)),
    );
    const need = hoursOutstanding(p);
    const soonest = [...p.cases].sort((a, b) => a.dueWeek - b.dueWeek)[0];
    const weekly = chambersRent(p) + legalWages(p);
    const owed = billsOwed(p);
    const nextBill = [...billsOf(p)].sort((a, b) => a.dueWeek - b.dueWeek)[0];

    return [
      {
        label: "Hours into the files",
        value: `${total}`,
        tone: total > 0 ? "good" : "neutral",
        note:
          retainerHours(p) > 0
            ? `${retainerHours(p)} reserved for retainers first · ${need > 0 ? `${Math.round(need)} still owed` : "nothing on the books"}`
            : need > 0
              ? `${Math.round(need)} still owed across the pipeline`
              : "Nothing on the books",
      },
      {
        label: "Next hearing",
        value: soonest ? `Week ${soonest.dueWeek}` : "—",
        tone: soonest && soonest.dueWeek - s.week <= 3 ? "bad" : "neutral",
        note: soonest
          ? `${CASE_BY_ID.get(soonest.kind)?.label} · ${Math.round(oddsFor(soonest, p, s.r.skill) * 100)}% as it stands${
              (soonest.adjournments ?? 0) > 0
                ? ` · put back ${soonest.adjournments} time${soonest.adjournments === 1 ? "" : "s"}`
                : ""
            }`
          : undefined,
      },
      {
        label: "Unbilled work",
        value: money(workInProgress(p)),
        tone: "neutral",
        note: "Real work. Not money yet, and not certain to be.",
      },
      {
        label: "Owed to you",
        value: money(owed),
        tone: owed > 0 && s.r.cash < weekly * 3 ? "bad" : "neutral",
        note: nextBill
          ? `Next lands week ${nextBill.dueWeek}. Sellable today at a discount.`
          : "Nothing billed out. A judgment is not a payment.",
      },
      {
        label: "Costs this week",
        value: money(weekly),
        tone: s.r.cash < weekly * 3 ? "bad" : "neutral",
        note:
          retainerIncome(p) > 0
            ? `Due whether or not anything settles — ${money(retainerIncome(p))} of it is covered by retainers.`
            : "Due whether or not anything settles.",
      },
    ];
  },

  objective: (s) => {
    const goal = goalFor(s);
    return {
      text: `Clear the practice loan and build a firm worth ${money(goal)} in ${legalCityOf(practice(s)).name}. Everything you are owed is only worth what a court says it is.`,
      progress: Math.max(0, Math.min(1, firmWorth(s) / goal)),
    };
  },
};

export const LAWYER_GOAL = GOAL;
export { CASE_KINDS, LEGAL_ROLES, firmWeight, MAX_VERDICTS };
