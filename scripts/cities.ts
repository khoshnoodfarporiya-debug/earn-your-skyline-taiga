/**
 * DOES EVERY CITY PLAY?
 *
 * The start city moves rent, takings, demand, produce prices, shelf life,
 * fees, chambers and the ceiling on the work a market offers. Numbers that
 * interlocking cannot be checked by reading them, so this plays every city of
 * the Chef and the Solicitor with one plain competent bot and reports what
 * happened.
 *
 * ------------------------------------------------------------- what it is for
 *
 * Not to prove the cities are *equal* — they are not meant to be. It is to
 * catch the two failures that would make a choice a trap:
 *
 *   1. a city where the bot is insolvent for most of the run, and
 *   2. a city that reaches the target so early that nothing else matters.
 *
 * The bot is deliberately unclever and identical in every city: it is a
 * control, not a player. A city looking bad here means the city is hard for
 * an ordinary approach, which is a design statement worth making on purpose
 * rather than by accident.
 *
 * Run: npx tsx scripts/cities.ts [runs]
 */

import {
  advanceWeek,
  resolveEventChoice,
  runCommand,
  startRun,
} from "../lib/game/engine";
import { chef, kitchen, kitchenWorth, goalFor as chefGoal } from "../lib/game/careers/chef";
import {
  KITCHEN_CITIES,
  SERVICE_BY_ID,
  brigadeCovers,
  forecastFor,
  larderCovers,
  premisesPrice,
  PREMISES,
} from "../lib/game/careers/kitchen";
import {
  lawyer,
  practice,
  firmWorth,
  goalFor as firmGoal,
} from "../lib/game/careers/lawyer";
import {
  CASE_BY_ID,
  LEGAL_CITIES,
  billsOf,
  factorValue,
  LEGAL_ROLE_BY_ID,
  legalLabourIndex,
  retainerOffersOf,
  retainersOf,
  chambersRent,
  hoursOutstanding,
  chambersPrice,
  nextChambers,
  oddsFor,
  seatsFree,
  staffHours,
} from "../lib/game/careers/casework";
import {
  WINES,
  bottlesHeld,
  casePrice,
  pourRate,
  cellarFull,
} from "../lib/game/careers/cellar";
import {
  TECHNIQUES,
  canLearn,
  knowsTechnique,
} from "../lib/game/careers/craft";
import {
  VENTURES,
  ventureBlocker,
  ventureFee,
  venturesOf,
} from "../lib/game/careers/ventures";
import { weeklyOutgoings } from "../lib/game/careers/chef";
import { localOf } from "../lib/game/careers/kitchen";
import { founder } from "../lib/game/careers/founder";
import {
  EXPERIMENTS,
  ROUNDS,
  STARTUP_CITIES,
  STARTUP_ROLE_BY_ID,
  burnOf,
  defaultAlive,
  experimentCost,
  experimentsOf,
  insightOf,
  roundBlocker,
  runwayOf,
  rolePrice,
  stanceOf,
  techDebtOf,
  venture,
} from "../lib/game/careers/startup";
import { politician } from "../lib/game/careers/politician";
import {
  FOCUS_GROUP_COST,
  SEATS,
  campaign,
  projectedShare,
  selectionBlocker,
  thresholdFor,
  volunteersOf,
  warchestOf,
  weeksToPoll,
} from "../lib/game/careers/constituency";
import { architect } from "../lib/game/careers/architect";
import {
  STUDIO_CITIES,
  STUDIO_CITY_BY_ID,
  consentCost,
  KIND_BY_ID as PROJECT_BY_ID,
  overBudget,
  revisionRisk,
  studio,
} from "../lib/game/careers/studio";
import { engineer } from "../lib/game/careers/engineer";
import {
  RIGS,
  WORKSHOP_CITIES,
  benchOf,
  designNeeded,
  designNeededFor,
  estimateOf,
  prototypeCost,
  rigCost,
  rigsOf,
  kindOf,
  shippedProducts,
  workshop,
  workshopCityOf,
} from "../lib/game/careers/workshop";
import { money } from "../lib/game/format";

const RUNS = Math.max(1, Number(process.argv[2]) || 24);
/*
 * Optional focus: `npx tsx scripts/cities.ts 40 founder,architect` runs only
 * the named reports. The chef's service pipeline makes its bots by far the
 * slowest, and retuning any one career should not cost a full-suite wait.
 */
const ONLY = (process.argv[3] ?? "")
  .split(",")
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);
const wanted = (title: string): boolean =>
  ONLY.length === 0 || ONLY.some((o) => title.toLowerCase().includes(o));
/*
 * What `payLoan` moves in one press, and the buffer both bots keep behind it.
 *
 * Paying down to the last note is not prudence, it is the same over-commitment
 * the career is about: the first version of this rule left about two thousand
 * pounds in the account and the next event that cost eleven hundred started a
 * spiral that ran for a hundred and eighteen weeks. Six weeks of standing
 * costs is what an operator actually keeps.
 */
const LOAN_STEP = 10_000;
const HORIZON = 120;

interface Result {
  reached: boolean;
  worth: number;
  weeksBroke: number;
  troughCash: number;
  /**
   * The career's own objective, 0..1, read off `career.objective` at the
   * end of the run — the same number the goal card shows the player.
   * Careers whose worth is not money (the Politician) are judged on
   * this rather than on a balance.
   */
  progress: number;
}

/* ------------------------------------------------------------------- chef */

/**
 * A plain kitchen.
 *
 * Orders against the forecast rather than by habit, opens dinner with a block
 * of prep, takes the next room when it can comfortably afford it, and hires
 * when there is more demand than hands. No city-specific cleverness: the same
 * rules run in Mumbai and in Paris, which is the point.
 */
function playChef(cityId: string, seed: number): Result {
  let s = startRun(chef, seed, { city: cityId });
  let weeksBroke = 0;
  let troughCash = s.r.cash;
  let reached = false;

  for (let week = 1; week <= HORIZON; week++) {
    const k = kitchen(s);

    /*
     * Order to the *low* end of the forecast, not the high one.
     *
     * The first version of this bot ordered to the top of the band and went
     * insolvent in five cities out of seven — including Lyon, whose economy
     * has not changed and is known to be playable. Over-ordering is the
     * mistake this career is built around, so a bot that makes it every week
     * measures the mistake rather than the market.
     */
    const dinner = SERVICE_BY_ID.get("dinner")!;
    const fc = forecastFor(k, s.r.reputation, dinner, 3, s.r.skill);
    /*
     * Capped by what the brigade can actually plate.
     *
     * The forecast is *demand*, and in a busy city demand is far past what a
     * solo kitchen can cook — the second version of this bot bought to it
     * anyway and binned the difference every week in Mumbai and New York,
     * which is the mistake the career is about rather than a fact about
     * those cities. The screen names the binding constraint; the bot now
     * reads it.
     */
    const hands = Math.round(brigadeCovers(k, s.r.skill) * 1.18);
    const want = Math.min(Math.round(fc.low * 1.1), hands);
    for (let i = 0; i < 3; i++) {
      if (larderCovers(kitchen(s)) >= want) break;
      const before = s.r.cash;
      s = runCommand(chef, s, "buyProduce", "market:basic");
      if (s.r.cash === before) break; /* refused — too dear, or below minimum */
      if (s.r.cash < 2_500) break;
    }

    /*
     * A bigger room only when the covers are there to fill it and the cash is
     * there to carry it for a while. Rent arrives every week afterwards and a
     * room taken too early is how a good kitchen dies.
     */
    const here = kitchen(s);
    const next = PREMISES[PREMISES.findIndex((p) => p.id === here.premises) + 1];
    const full = (here.lastService?.turnedAway ?? 0) > 0 || here.streak > 0;
    if (next && full && s.r.cash > premisesPrice(here, next) * 3) {
      s = runCommand(chef, s, "takePremises", next.id);
    } else if (
      s.r.cash > 60_000 &&
      !(kitchen(s).equipment ?? []).includes("coldroom")
    ) {
      s = runCommand(chef, s, "buyKit", "coldroom");
    } else if (s.r.cash > 25_000 && kitchen(s).staff.length < 3) {
      s = runCommand(chef, s, "hireKitchen", "partie");
    }

    const rest = s.r.burnout > 70 ? 1 : 0;
    const out = advanceWeek(chef, s, {
      dinner: 3,
      lunch: 1,
      prep: 1,
      ...(rest > 0 ? { rest } : { room: 1 }),
    });
    s = out.state;
    /*
     * The control does *not* service the fit-out loan, and that is deliberate.
     *
     * It has been the baseline three phases of work were measured against, and
     * changing what it does invalidates every reading taken before now. It
     * also turns out to be delicate: an earlier version of this bot repaid
     * down to a small float and then could not absorb a $1,100 event, and it
     * spiralled for a hundred and eighteen weeks. What the loan does to a run
     * is measured by the ambitious bot below, which does service it.
     */
    /* The harness always takes the first option, as the Physician's does, so
       every figure here is a floor rather than a ceiling. */
    if (out.event) s = resolveEventChoice(chef, s, out.event.def, 0);

    if (s.r.cash < 0) weeksBroke++;
    troughCash = Math.min(troughCash, s.r.cash);
    if (!reached && s.r.debt <= 0 && kitchenWorth(s) >= chefGoal(s)) reached = true;
  }

  return { reached, worth: kitchenWorth(s), weeksBroke, troughCash, progress: chef.objective(s).progress };
}

/**
 * THE AMBITIOUS KITCHEN
 *
 * The plain bot above never learns a technique, never buys a bottle and never
 * takes an offer, which means it proves the Phase 4 systems are *optional* and
 * nothing whatever about whether they are balanced.
 *
 * This one takes all of it. Same ordering discipline, same room rule, same
 * refusal to be clever about the city — and on top of that it practises every
 * week it can afford to, buys wine when it has a cellar to keep it in, hires a
 * sommelier once there is a list worth selling, and accepts whatever venture
 * it is offered.
 *
 * ------------------------------------------------------------ what it checks
 *
 * Two failures, and they are the opposite of each other:
 *
 *   1. **A trap.** If this bot is materially worse off than the plain one,
 *      the new systems are a way to lose, and a player who engages with the
 *      career as designed is being punished for it.
 *   2. **A free lunch.** If it is dramatically better in every city, the
 *      cellar or the ventures are printing money and the trade is not a trade.
 *
 * Somewhere in between is the answer, and the report prints both bots so the
 * gap is visible rather than asserted.
 */
function playAmbitiousChef(cityId: string, seed: number): Result {
  let s = startRun(chef, seed, { city: cityId });
  let weeksBroke = 0;
  let troughCash = s.r.cash;
  let reached = false;

  for (let week = 1; week <= HORIZON; week++) {
    const k = kitchen(s);

    /*
     * How much of the week is actually going to be spent cooking, worked out
     * before the food is bought rather than after — the first version of this
     * bot bought for three blocks and opened four, which measures a bot that
     * cannot count rather than anything about the craft.
     */
    /*
     * A buffer, measured in weeks of standing costs.
     *
     * Everything the ambitious bot does beyond cooking — the cellar, the
     * sommelier, a block of practice, a commitment — is paid for out of
     * *slack*, and a kitchen with no slack has none to spend. Without this
     * the bot bought a wine store in New York while two weeks from insolvent
     * and spiralled, which measures a bot that cannot read its own bank
     * balance rather than anything about the craft.
     */
    const weekly = Math.max(1, weeklyOutgoings(k));
    const slack = s.r.cash / weekly;

    const learning =
      slack > 6 &&
      TECHNIQUES.some((t) => canLearn(k, t) && !knowsTechnique(k, t.id));
    /*
     * THE SAME WEEK THE PLAIN BOT RUNS, MINUS WHAT IT SPENDS ELSEWHERE.
     *
     * Three dinners and a lunch, not four dinners. A dinner block seats about
     * a third of the room, so a fourth of them is largely empty — and the bot
     * buys food for every block it opens, so an empty block is a week of
     * produce in the bin. Doing that in New York, where produce is half as
     * dear again, put this bot a million behind and overdrawn for a hundred
     * weeks out of a hundred and twenty. It was measuring its own arithmetic.
     */
    const dinners = 3;

    /* Food, on exactly the same rule the plain bot uses. */
    const dinner = SERVICE_BY_ID.get("dinner")!;
    const fc = forecastFor(k, s.r.reputation, dinner, dinners, s.r.skill);
    const hands = Math.round(brigadeCovers(k, s.r.skill) * 1.18);
    const want = Math.min(Math.round(fc.low * 1.1), hands);
    for (let i = 0; i < 3; i++) {
      if (larderCovers(kitchen(s)) >= want) break;
      const before = s.r.cash;
      s = runCommand(chef, s, "buyProduce", "market:basic");
      if (s.r.cash === before) break;
      if (s.r.cash < 2_500) break;
    }

    /* The room, the cold room, the brigade — all as before. */
    const here = kitchen(s);
    const next = PREMISES[PREMISES.findIndex((p) => p.id === here.premises) + 1];
    const full = (here.lastService?.turnedAway ?? 0) > 0 || here.streak > 0;
    if (next && full && s.r.cash > premisesPrice(here, next) * 3) {
      s = runCommand(chef, s, "takePremises", next.id);
    } else if (
      s.r.cash > 60_000 &&
      !(kitchen(s).equipment ?? []).includes("coldroom")
    ) {
      s = runCommand(chef, s, "buyKit", "coldroom");
    } else if (s.r.cash > 25_000 && kitchen(s).staff.length < 3) {
      s = runCommand(chef, s, "hireKitchen", "partie");
    }

    /* ------------------------------------------------------- the additions */

    /*
     * The cellar, once there is somewhere to keep it. Buys the best case it
     * can comfortably afford, which is the decision a chef building a list
     * actually makes — and it is money off the floor either way.
     */
    if (
      slack > 10 &&
      s.r.cash > 90_000 &&
      !(kitchen(s).equipment ?? []).includes("cellar")
    ) {
      s = runCommand(chef, s, "buyKit", "cellar");
    } else if ((kitchen(s).equipment ?? []).includes("cellar")) {
      /*
       * Buy to what the room will actually drink, not to what the bank will
       * allow.
       *
       * A rack is money off the floor, and a bot that puts six per cent of its
       * cash into wine every week regardless of how much it pours is making
       * the over-ordering mistake this whole career is about — in wine rather
       * than in produce. It went insolvent in five cities out of seven doing
       * exactly that. Six weeks of stock is a cellar; sixty is a hobby.
       */
      const drinkers = kitchen(s).lastService?.served ?? 0;
      const weeklyPour = Math.floor(
        (drinkers * pourRate(kitchen(s), true)) / 2.4,
      );
      const affordable = WINES.filter(
        (w) => casePrice(kitchen(s), w) < s.r.cash * 0.05,
      ).sort((a, b) => b.prestige - a.prestige)[0];
      if (
        affordable &&
        slack > 6 &&
        !cellarFull(kitchen(s)) &&
        bottlesHeld(kitchen(s)) < Math.max(24, weeklyPour * 6)
      ) {
        s = runCommand(chef, s, "buyWine", affordable.id);
      }
      /* And somebody to sell it, once there is a list worth selling. */
      if (
        bottlesHeld(kitchen(s)) > 60 &&
        slack > 8 &&
        s.r.cash > 30_000 &&
        !kitchen(s).staff.some((x) => x.role === "somm")
      ) {
        s = runCommand(chef, s, "hireKitchen", "somm");
      }
    }

    /* Whatever is on the table. A bot that takes everything is the honest
       upper bound on what the ventures are worth. */
    if (slack > 8 && !venturesOf(kitchen(s)).active) {
      const offer = VENTURES.filter(
        (v) => !ventureBlocker(v, kitchen(s), s.r.reputation, s.r.cash, week),
      ).sort((a, b) => ventureFee(kitchen(s), b) - ventureFee(kitchen(s), a))[0];
      if (offer) s = runCommand(chef, s, "startVenture", offer.id);
    }

    /* Practice goes into the cheapest thing still open, every week the block
       is there to spend. */
    const open = TECHNIQUES.filter(
      (t) => canLearn(kitchen(s), t) && !knowsTechnique(kitchen(s), t.id),
    ).sort((a, b) => a.cost - b.cost)[0];
    if (open) s = runCommand(chef, s, "setPractice", open.id);

    /*
     * The whole week, every week.
     *
     * A bot that leaves a block unspent is measuring its own arithmetic
     * rather than the systems it is supposed to be testing — and the point of
     * this bot is the *comparison*, so it has to work as hard as the plain
     * one does.
     */
    /*
     * EXACTLY THE PLAIN BOT'S WEEK, WITH ONE BLOCK SPENT DIFFERENTLY.
     *
     * Three dinners, a lunch and a block of prep — the same four service
     * blocks the control runs — and then the sixth block goes on practice
     * instead of working the room. That is the honest cost of learning
     * something: not a service, but the hour you would have spent in the
     * dining room being charming.
     *
     * Getting this wrong was worth about a quarter of a million pounds a run.
     * The first version dropped the *lunch* whenever burnout called for a
     * rest, which the control never does, and the missing service block
     * compounded across a hundred and twenty weeks into a bankruptcy that had
     * nothing to do with anything this bot was meant to be testing.
     */
    const rest = s.r.burnout > 70 ? 1 : 0;
    const budget = chef.timeBudget(s);
    const practising = learning && rest === 0 ? 1 : 0;
    /* A running commitment eats the week from the bottom: the sixth block
       first, then the lunch, and only then a dinner. */
    const spare = budget - dinners - 1;
    const sixth = spare >= 2 ? 1 : 0;
    const lunch = spare >= 1 ? 1 : 0;
    const dinnersNow = Math.max(1, Math.min(dinners, budget - 1));

    const out = advanceWeek(chef, s, {
      dinner: dinnersNow,
      prep: 1,
      ...(lunch > 0 ? { lunch } : {}),
      ...(sixth > 0
        ? rest > 0
          ? { rest }
          : practising > 0
            ? { practise: 1 }
            : { room: 1 }
        : {}),
    });
    s = out.state;
    /* And it pays the loan down, because a kitchen holding six figures and a
       fit-out debt is not a decision anybody makes. */
    /*
     * Services the loan, but only from genuine surplus.
     *
     * The buffer is flat and local rather than a multiple of `weeklyOutgoings`,
     * because standing costs are almost nothing at a market stall while food
     * and events are not — a buffer sized on rent alone is no buffer at all in
     * the weeks it is most needed.
     */
    if (s.r.debt > 0 && s.r.cash - LOAN_STEP > localOf(kitchen(s), 30_000)) {
      s = runCommand(chef, s, "payLoan", "");
    }
    if (out.event) s = resolveEventChoice(chef, s, out.event.def, 0);

    if (s.r.cash < 0) weeksBroke++;
    troughCash = Math.min(troughCash, s.r.cash);
    if (!reached && s.r.debt <= 0 && kitchenWorth(s) >= chefGoal(s)) reached = true;
  }

  return { reached, worth: kitchenWorth(s), weeksBroke, troughCash, progress: chef.objective(s).progress };
}

/* -------------------------------------------------------------- solicitor */

/**
 * A plain firm.
 *
 * Takes what it can staff, works the files, settles anything whose odds have
 * gone bad with the deadline close, and hires when the hours outstanding are
 * more than it can find. Again: identical rules in every market.
 */
function playLawyer(cityId: string, seed: number): Result {
  let s = startRun(lawyer, seed, { city: cityId });
  let weeksBroke = 0;
  let troughCash = s.r.cash;
  let reached = false;

  for (let week = 1; week <= HORIZON; week++) {
    const p = practice(s);

    /*
     * Accept only what the firm has the hours to finish.
     *
     * The first version took four files regardless and was overdrawn for
     * ninety weeks in every market — it was measuring an over-committed firm,
     * not the cities. A practice finances its own work in progress, so the
     * bot carries what it can actually deliver.
     */
    const capacity = 12 + s.r.skill * 0.12 * 4 + staffHours(p);
    for (const offer of [...p.offers]) {
      const kind = CASE_BY_ID.get(offer.kind);
      if (!kind) continue;
      const live = practice(s);
      /*
       * The cap grows with the payroll. A flat three-case cap next to a
       * hire rule was how this bot drowned in New York: it took on a
       * $4,700-a-week associate and then kept refusing the work that would
       * have paid for them — salaries were 60% of all money out over 120
       * weeks. The hours check below still does the real gating.
       */
      if (live.cases.length >= 3 + live.staff.length * 2) break;
      if (hoursOutstanding(live) + kind.hours > capacity * 10) continue;
      s = runCommand(lawyer, s, "takeCase", offer.id);
    }

    /* Settle what is going badly and is nearly due; carry the rest. */
    for (const c of [...practice(s).cases]) {
      const kind = CASE_BY_ID.get(c.kind);
      if (!kind) continue;
      const near = c.dueWeek - s.week <= 2;
      const ready = c.hoursDone / kind.hours;
      if (near && ready < 0.85 && oddsFor(c, practice(s), s.r.skill) < 0.55) {
        s = runCommand(lawyer, s, "settleCase", c.id);
      }
    }

    /*
     * Move when the rooms are full and there is slack to pay the rent.
     *
     * Chambers cap the payroll now, so a bot that never moves is a bot that
     * never has more than two people — which would make every figure in this
     * table a measurement of the cap rather than of the city.
     */
    {
      const q = practice(s);
      const up = nextChambers(q);
      const weekly = chambersRent(q) + q.staff.reduce((n, x) => n + x.salary, 0);
      if (
        up &&
        seatsFree(q) === 0 &&
        /* Twelve weeks of cover, not eight: the mid-run overdrafts sat right
           after chambers moves in the histogram. */
        s.r.cash > chambersPrice(q, up) + weekly * 12
      ) {
        s = runCommand(lawyer, s, "takeChambers", up.id);
      }
    }

    /*
     * A retainer when the account cannot see past Friday. The catalogue's
     * own design note says which firms should hold them, and this bot was
     * the textbook case: lumpy income months out, salaries weekly, and the
     * one instrument in the career that pays every week left on the table.
     * Two at most — a third would starve the instruction flow the cases
     * come from.
     */
    {
      const q = practice(s);
      const weekly =
        chambersRent(q) + q.staff.reduce((n, x) => n + x.salary, 0) + 255;
      /*
       * One retainer always, a second only when thin. Holding a single
       * modest retainer is ordinary practice management, not desperation —
       * and the histogram showed the panic-only version arriving after the
       * overdraft rather than before it.
       */
      const held = retainersOf(q).length;
      const thin = s.r.cash < weekly * 10;
      if (held < 1 || (thin && held < 2)) {
        const offer = retainerOffersOf(q)[0];
        if (offer) s = runCommand(lawyer, s, "takeRetainer", offer.id);
      }
    }

    /*
     * Factor a bill rather than sit overdrawn. The practice has had invoice
     * factoring since the working-capital rework, and a bot that ignores it
     * measures a firm refusing its own banking: the median run sat 34-60
     * weeks in overdraft with money on its own ledger maturing three weeks
     * out. Sell the oldest bill whenever the account is actually dry.
     */
    {
      const q0 = practice(s);
      const weekly0 =
        chambersRent(q0) + q0.staff.reduce((n, x) => n + x.salary, 0) + 255;
      /* One week of cover. Three weeks proved too eager — the discount on
         every factored bill compounded in the expensive markets and London
         went four points backwards. Factoring is a bridge, not an income. */
      if (s.r.cash < weekly0) {
        const owed = billsOf(q0);
        if (owed.length > 0) {
          const oldest = [...owed].sort((a, b) => a.dueWeek - b.dueWeek)[0];
          if (factorValue(oldest, s.week) > 0) {
            s = runCommand(lawyer, s, "factorBill", oldest.id);
          }
        }
      }
    }

    /* Hire against the work in the building, not against the balance: an
       associate is $2,900 a week whether or not there is a file for them. */
    /*
     * Sixteen weeks of the LOCAL salary in hand, not a flat number. The flat
     * $45,000 gate was under ten weeks of a New York associate — the bot
     * hired into the most expensive payroll on the board with the least
     * cover, and New York's overdraft was the graph of that decision.
     */
    {
      const q = practice(s);
      const localSalary = Math.round(
        (LEGAL_ROLE_BY_ID.get("associate")?.salary ?? 2_900) *
          legalLabourIndex(q),
      );
      /* The second and third hire wait for steady income: a payroll scaled
         on lumpy fees is exactly the London/New York overdraft signature. */
      const steady = retainersOf(q).length >= 2;
      if (
        s.r.cash > localSalary * 16 &&
        q.staff.length < (steady ? 3 : 1) &&
        hoursOutstanding(q) > staffHours(q) * 6
      ) {
        s = runCommand(lawyer, s, "hireLegal", "associate");
      }
    }

    const rest = s.r.burnout > 72 ? 1 : 0;
    const out = advanceWeek(lawyer, s, {
      casework: 4,
      pitch: 1,
      ...(rest > 0 ? { rest } : { network: 1 }),
    });
    s = out.state;
    if (out.event) s = resolveEventChoice(lawyer, s, out.event.def, 0);

    if (s.r.cash < 0) weeksBroke++;
    troughCash = Math.min(troughCash, s.r.cash);
    if (!reached && s.r.debt <= 0 && firmWorth(s) >= firmGoal(s)) reached = true;
  }

  return { reached, worth: firmWorth(s), weeksBroke, troughCash, progress: lawyer.objective(s).progress };
}


/* ---------------------------------------------------------------- founder */

/**
 * A plain company.
 *
 * Builds until there is something to sell, sells while building, raises the
 * pre-seed as soon as a room would take the meeting, and hires exactly once —
 * an engineer, after money is in the bank. The same rules in Mumbai and in
 * New York, which is the point: the cities are supposed to differ in how far
 * eleven weeks of savings stretch, not in whether the rules work.
 */
function playFounder(cityId: string, seed: number): Result {
  let s = startRun(founder, seed, { city: cityId });
  let weeksBroke = 0;
  let troughCash = s.r.cash;
  let reached = false;

  for (let week = 1; week <= HORIZON; week++) {
    const v = venture(s);

    /* Raise when a round is open and the runway is not comfortable. */
    if (!v.pitchRound) {
      const round = ROUNDS.find(
        (r) => !v.roundsClosed.includes(r.id) && roundBlocker(v, r) === null,
      );
      const weeks = runwayOf(s.r.cash, v);
      if (round && Number.isFinite(weeks) && weeks < 26) {
        s = runCommand(founder, s, "startRaise", round.id);
      }
    }

    /* One engineer, once funded — capacity bought out of raised money, never
       out of the last weeks of savings. */
    {
      const now = venture(s);
      const eng = STARTUP_ROLE_BY_ID.get("engineer")!;
      const { hireCost } = rolePrice(now, eng);
      const after = runwayOf(s.r.cash - hireCost, {
        ...now,
        team: [...now.team, { id: "x", name: "x", role: "engineer", salary: rolePrice(now, eng).salary, since: 0 }],
      });
      if (
        now.team.length === 0 &&
        now.roundsClosed.length > 0 &&
        s.r.cash > hireCost &&
        (!Number.isFinite(after) || after > 20)
      ) {
        s = runCommand(founder, s, "hireVenture", "engineer");
      }
    }

    const pitching = venture(s).pitchRound !== undefined;
    const rest = s.r.burnout > 75 ? 1 : 0;
    const out = advanceWeek(founder, s, {
      build: 2,
      sell: pitching ? 1 : 2,
      ...(pitching ? { pitch: 2 } : { market: 1 }),
      ...(rest > 0 ? { rest } : {}),
    });
    s = out.state;
    if (out.event) s = resolveEventChoice(founder, s, out.event.def, 0);

    if (s.r.cash < 0) weeksBroke++;
    troughCash = Math.min(troughCash, s.r.cash);
    if (!reached && founder.objective(s).progress >= 1) reached = true;
  }

  const v = venture(s);
  return {
    reached,
    worth: Math.round(s.r.cash + (defaultAlive(v) ? 100_000 : 0)),
    weeksBroke,
    troughCash,
    progress: founder.objective(s).progress,
  };
}

/**
 * THE SAME FOUNDER, PLAYING THE PRODUCT SLICE.
 *
 * Identical financing and hiring rules to the plain bot — raise when short,
 * one engineer once funded — plus everything Phase 5 added: it interviews
 * until it knows the market, ships fast while the debt is cheap and swings
 * to stability when it is not, and runs each experiment once it can afford
 * to. One block a week moves from selling to interviewing early on, which
 * is the real price of discovery.
 *
 * Two failures, opposite ways, same as the ambitious Chef: materially worse
 * than the plain bot means the product work is a trap; dramatically better
 * everywhere means it is a free lunch. The gap is printed, not asserted.
 */
function playAmbitiousFounder(cityId: string, seed: number): Result {
  let s = startRun(founder, seed, { city: cityId });
  let weeksBroke = 0;
  let troughCash = s.r.cash;
  let reached = false;

  for (let week = 1; week <= HORIZON; week++) {
    const v = venture(s);

    /* Raise when a round is open and the runway is not comfortable. */
    if (!v.pitchRound) {
      const round = ROUNDS.find(
        (r) => !v.roundsClosed.includes(r.id) && roundBlocker(v, r) === null,
      );
      const weeks = runwayOf(s.r.cash, v);
      if (round && Number.isFinite(weeks) && weeks < 26) {
        s = runCommand(founder, s, "startRaise", round.id);
      }
    }

    /* One engineer, once funded — same rule as the plain bot. */
    {
      const now = venture(s);
      const eng = STARTUP_ROLE_BY_ID.get("engineer")!;
      const { hireCost } = rolePrice(now, eng);
      const after = runwayOf(s.r.cash - hireCost, {
        ...now,
        team: [...now.team, { id: "x", name: "x", role: "engineer", salary: rolePrice(now, eng).salary, since: 0 }],
      });
      if (
        now.team.length === 0 &&
        now.roundsClosed.length > 0 &&
        s.r.cash > hireCost &&
        (!Number.isFinite(after) || after > 20)
      ) {
        s = runCommand(founder, s, "hireVenture", "engineer");
      }
    }

    /* ------------------------------------------------- the product slice */
    {
      const now = venture(s);
      const debt = techDebtOf(now);
      /* Ship while the bill is small, refactor when it compounds. */
      if (debt > 60 && stanceOf(now) !== "stability") {
        s = runCommand(founder, s, "setRoadmap", "stability");
      } else if (debt < 15 && stanceOf(now) !== "ship") {
        s = runCommand(founder, s, "setRoadmap", "ship");
      }
      /* An experiment when the float can carry one — never out of the last
         weeks of savings, same discipline as the hire. */
      const next = EXPERIMENTS.find(
        (e) => !experimentsOf(now).some((d) => d.id === e.id),
      );
      if (
        next &&
        !now.experimentRun &&
        s.r.cash > experimentCost(now, next) + burnOf(now) * 10
      ) {
        s = runCommand(founder, s, "runExperiment", next.id);
      }
    }

    const now = venture(s);
    const pitching = now.pitchRound !== undefined;
    const learning = insightOf(now) < 60;
    const rest = s.r.burnout > 75 ? 1 : 0;
    const out = advanceWeek(founder, s, {
      build: 2,
      /* The interview block comes out of selling, which is the honest
         trade: discovery costs revenue now for product later. */
      sell: pitching ? 1 : learning ? 1 : 2,
      ...(learning ? { interview: 1 } : {}),
      ...(pitching ? { pitch: 2 } : { market: 1 }),
      ...(rest > 0 ? { rest } : {}),
    });
    s = out.state;
    if (out.event) s = resolveEventChoice(founder, s, out.event.def, 0);

    if (s.r.cash < 0) weeksBroke++;
    troughCash = Math.min(troughCash, s.r.cash);
    if (!reached && founder.objective(s).progress >= 1) reached = true;
  }

  const v = venture(s);
  return {
    reached,
    worth: Math.round(s.r.cash + (defaultAlive(v) ? 100_000 : 0)),
    weeksBroke,
    troughCash,
    progress: founder.objective(s).progress,
  };
}

/* ------------------------------------------------------------- politician */

/**
 * A plain campaign.
 *
 * Takes the two positions that favour the blocs that actually vote, does the
 * unglamorous work between elections, and campaigns hard only in the last
 * ten weeks — which is what the drift makes correct. Stands again after a
 * loss, and asks the party for the next rung when it is holding comfortably.
 */
function playPolitician(cityId: string, seed: number): Result {
  let s = startRun(politician, seed, { city: cityId });
  let weeksBroke = 0;
  let troughCash = s.r.cash;
  let reached = false;

  /* Where you stand, decided once, like a person rather than a weathervane. */
  s = runCommand(politician, s, "takePosition", "care:fund");
  s = runCommand(politician, s, "takePosition", "tax:hold");

  for (let week = 1; week <= HORIZON; week++) {
    const c = campaign(s);

    if (c.outOfOffice) {
      s = runCommand(politician, s, "standAgain", "");
    } else if (
      selectionBlocker(c) === null &&
      projectedShare(c) > thresholdFor(c) + 0.04
    ) {
      /* The next rung, only from a position of strength. */
      s = runCommand(politician, s, "seekSelection", "");
    }

    const out = weeksToPoll(campaign(s), s.week);
    const late = out <= 10;
    const rest = s.r.burnout > 75 ? 1 : 0;
    const result = advanceWeek(politician, s, {
      ...(late
        ? { canvass: s.r.cash > 1_200 ? 4 : 2, casework: 2 }
        : { casework: 2, party: 2, canvass: s.r.cash > 3_000 ? 1 : 0, rest: 1 }),
      ...(rest > 0 ? { rest } : {}),
    });
    s = result.state;
    if (result.event) s = resolveEventChoice(politician, s, result.event.def, 0);

    if (s.r.cash < 0) weeksBroke++;
    troughCash = Math.min(troughCash, s.r.cash);
    if (!reached && politician.objective(s).progress >= 1) reached = true;
  }

  return {
    reached,
    worth: s.r.cash,
    weeksBroke,
    troughCash,
    progress: politician.objective(s).progress,
  };
}

/**
 * THE SAME CAMPAIGN, PLAYING THE GROUND GAME.
 *
 * Identical positions and the same late-campaign discipline as the plain
 * bot, plus everything Phase 5 added: it organises a volunteer base early,
 * fundraises when the war chest runs thin, buys a focus group as polling
 * day nears, and keeps a surgery block on the postbag throughout — which
 * is also what builds the record.
 *
 * Trap or free lunch, printed side by side with the plain campaign.
 */
function playAmbitiousPolitician(cityId: string, seed: number): Result {
  let s = startRun(politician, seed, { city: cityId });
  let weeksBroke = 0;
  let troughCash = s.r.cash;
  let reached = false;

  s = runCommand(politician, s, "takePosition", "care:fund");
  s = runCommand(politician, s, "takePosition", "tax:hold");

  for (let week = 1; week <= HORIZON; week++) {
    const c = campaign(s);

    if (c.outOfOffice) {
      s = runCommand(politician, s, "standAgain", "");
    } else if (
      selectionBlocker(c) === null &&
      projectedShare(c) > thresholdFor(c) + 0.04
    ) {
      s = runCommand(politician, s, "seekSelection", "");
    }

    /* Read the room once, as the poll comes into range. */
    {
      const now = campaign(s);
      if (
        weeksToPoll(now, s.week) <= 6 &&
        (now.focusUntil ?? -1) < s.week &&
        warchestOf(now) >= FOCUS_GROUP_COST
      ) {
        s = runCommand(politician, s, "focusGroup", "");
      }
    }

    const now = campaign(s);
    const out = weeksToPoll(now, s.week);
    const late = out <= 10;
    const thinFund = warchestOf(now) < 1_500;
    const thinBase = volunteersOf(now) < 40;
    const rest = s.r.burnout > 75 ? 1 : 0;
    const result = advanceWeek(politician, s, {
      ...(late
        ? { canvass: s.r.cash > 1_200 ? 3 : 2, casework: 1, organise: thinBase ? 1 : 0 }
        : {
            casework: 2,
            party: 1,
            organise: thinBase ? 1 : 0,
            fundraise: thinFund ? 1 : 0,
            canvass: s.r.cash > 3_000 ? 1 : 0,
          }),
      ...(rest > 0 ? { rest } : {}),
    });
    s = result.state;
    if (result.event) s = resolveEventChoice(politician, s, result.event.def, 0);

    if (s.r.cash < 0) weeksBroke++;
    troughCash = Math.min(troughCash, s.r.cash);
    if (!reached && politician.objective(s).progress >= 1) reached = true;
  }

  return {
    reached,
    worth: s.r.cash,
    weeksBroke,
    troughCash,
    progress: politician.objective(s).progress,
  };
}

/* -------------------------------------------------------------- architect */

/**
 * A plain practice.
 *
 * Takes what it is offered while it has room for it, draws four days a week,
 * and — the discipline the career is about — goes and sees the client the
 * moment the brief-change risk climbs. No competitions: they are the
 * ambitious move, and this bot is the floor.
 */
function playArchitect(cityId: string, seed: number): Result {
  let s = startRun(architect, seed, { city: cityId });
  let weeksBroke = 0;
  let troughCash = s.r.cash;
  let reached = false;

  for (let week = 1; week <= HORIZON; week++) {
    const a = studio(s);

    /* Take work while there is bench for it. */
    for (const offer of [...a.offers]) {
      if (studio(s).commissions.filter((c) => !c.done).length >= 2) break;
      s = runCommand(architect, s, "takeCommission", offer.id);
    }

    /* One assistant once the practice can carry a salary. */
    if (
      s.r.cash > 25_000 &&
      studio(s).team.length === 0 &&
      studio(s).commissions.filter((c) => !c.done).length >= 2
    ) {
      s = runCommand(architect, s, "hireStudio", "assistant");
    }

    /* See the client when neglect is starting to show. */
    const live = studio(s).commissions.filter((c) => !c.done);
    const risky = live.some(
      (c) => revisionRisk(studio(s), c, s.week) > 0.08,
    );

    const rest = s.r.burnout > 75 ? 1 : 0;
    const out = advanceWeek(architect, s, {
      draw: risky ? 3 : 4,
      ...(risky ? { client: 1 } : {}),
      court: live.length < 2 ? 1 : 0,
      ...(rest > 0 ? { rest } : {}),
    });
    s = out.state;
    if (out.event) s = resolveEventChoice(architect, s, out.event.def, 0);

    if (s.r.cash < 0) weeksBroke++;
    troughCash = Math.min(troughCash, s.r.cash);
    if (!reached && architect.objective(s).progress >= 1) reached = true;
  }

  return {
    reached,
    worth: s.r.cash - s.r.debt,
    weeksBroke,
    troughCash,
    progress: architect.objective(s).progress,
  };
}

/**
 * THE SAME PRACTICE, MAKING THE DECISIONS.
 *
 * Identical intake, hiring and client discipline to the plain bot, plus the
 * Phase 5 decisions: it briefs signature — measured first as economy
 * everywhere, which lost eight points of fee and a point of prestige per
 * building and fell twenty points behind in Tokyo; the standing economy
 * runs on offers, and offers run on the name — lodges planning when it can
 * afford to, builds timber where the market prices carbon and brick where
 * it does not, and value-engineers what tender would otherwise fight.
 *
 * Trap or free lunch, printed beside the plain practice.
 */
function playDecisiveArchitect(cityId: string, seed: number): Result {
  let s = startRun(architect, seed, { city: cityId });
  let weeksBroke = 0;
  let troughCash = s.r.cash;
  let reached = false;
  const lowCarbon = STUDIO_CITY_BY_ID.get(cityId)?.lowCarbon === true;

  for (let week = 1; week <= HORIZON; week++) {
    const a = studio(s);

    for (const offer of [...a.offers]) {
      if (studio(s).commissions.filter((c) => !c.done).length >= 2) break;
      s = runCommand(architect, s, "takeCommission", offer.id);
    }

    if (
      s.r.cash > 25_000 &&
      studio(s).team.length === 0 &&
      studio(s).commissions.filter((c) => !c.done).length >= 2
    ) {
      s = runCommand(architect, s, "hireStudio", "assistant");
    }

    /* ------------------------------------------------- the decisions */
    for (const c of studio(s).commissions.filter((x) => !x.done)) {
      if (c.brief === undefined && c.stage <= 1) {
        s = runCommand(architect, s, "setBrief", `${c.id}:signature`);
      }
      if (c.material === undefined && c.stage <= 2) {
        s = runCommand(
          architect,
          s,
          "chooseMaterial",
          `${c.id}:${lowCarbon ? "timber" : "brick"}`,
        );
      }
      const kind = PROJECT_BY_ID.get(c.kind);
      if (
        c.consent === undefined &&
        c.stage <= 1 &&
        kind &&
        s.r.cash > consentCost(studio(s), kind) + 12_000
      ) {
        s = runCommand(architect, s, "lodgeConsent", c.id);
      }
      if (overBudget(c) && !c.valueEngineered && c.stage >= 2) {
        s = runCommand(architect, s, "valueEngineer", c.id);
      }
    }

    const live = studio(s).commissions.filter((c) => !c.done);
    const risky = live.some(
      (c) => revisionRisk(studio(s), c, s.week) > 0.08,
    );

    const rest = s.r.burnout > 75 ? 1 : 0;
    const out = advanceWeek(architect, s, {
      draw: risky ? 3 : 4,
      ...(risky ? { client: 1 } : {}),
      court: live.length < 2 ? 1 : 0,
      ...(rest > 0 ? { rest } : {}),
    });
    s = out.state;
    if (out.event) s = resolveEventChoice(architect, s, out.event.def, 0);

    if (s.r.cash < 0) weeksBroke++;
    troughCash = Math.min(troughCash, s.r.cash);
    if (!reached && architect.objective(s).progress >= 1) reached = true;
  }

  return {
    reached,
    worth: s.r.cash - s.r.debt,
    weeksBroke,
    troughCash,
    progress: architect.objective(s).progress,
  };
}

/* --------------------------------------------------------------- engineer */

/**
 * A plain workshop.
 *
 * Builds the simple thing first, tests until the *estimate* clears the local
 * certifier — the honest read, since the truth is hidden — submits, sells
 * what ships, and answers what fails. Starts the next product only when the
 * last one is out of the building.
 */
function playEngineer(cityId: string, seed: number): Result {
  let s = startRun(engineer, seed, { city: cityId });
  let weeksBroke = 0;
  let troughCash = s.r.cash;
  let reached = false;

  s = runCommand(engineer, s, "startProduct", "bracket");

  for (let week = 1; week <= HORIZON; week++) {
    const w = workshop(s);
    const live = w.products.filter((x) => x.stage !== "withdrawn");
    const bench = live.find(
      (x) => x.stage === "design" || x.stage === "testing",
    );

    if (bench) {
      const kind = kindOf(bench)!;
      if (bench.stage === "design" && bench.design >= designNeeded(kind)) {
        s = runCommand(engineer, s, "beginTesting", bench.id);
      } else if (
        bench.stage === "testing" &&
        estimateOf(bench).high <= workshopCityOf(w).certTolerance &&
        s.r.cash > kind.certCost
      ) {
        s = runCommand(engineer, s, "submitForCertification", bench.id);
      }
    } else if (live.length < 2) {
      /* The next product, by what craft allows. */
      const next = s.r.skill >= 42 ? "controller" : s.r.skill >= 25 ? "sensor" : "bracket";
      s = runCommand(engineer, s, "startProduct", next);
    }

    const now = workshop(s);
    const onBench = now.products.find(
      (x) => x.stage === "design" || x.stage === "testing",
    );
    const surfaced = shippedProducts(now).some((x) => x.surfaced > 0);
    const shipping = shippedProducts(now).length > 0;
    const rest = s.r.burnout > 75 ? 1 : 0;
    const out = advanceWeek(engineer, s, {
      ...(onBench
        ? onBench.stage === "design"
          ? { design: 3, test: 1 }
          : { test: 3 }
        : {}),
      ...(shipping ? { sell: 2 } : {}),
      ...(surfaced ? { support: 1 } : {}),
      ...(rest > 0 ? { rest } : {}),
    });
    s = out.state;
    if (out.event) s = resolveEventChoice(engineer, s, out.event.def, 0);

    if (s.r.cash < 0) weeksBroke++;
    troughCash = Math.min(troughCash, s.r.cash);
    if (!reached && engineer.objective(s).progress >= 1) reached = true;
  }

  return {
    reached,
    worth: s.r.cash - s.r.debt,
    weeksBroke,
    troughCash,
    progress: engineer.objective(s).progress,
  };
}

/* -------------------------------------------------------------- contracts */

/**
 * WHAT "BALANCED" MEANS, WRITTEN DOWN
 *
 * Three claims per career, and the suite fails when any of them does. They
 * are deliberately about the *floor* — the plain bot — because the floor is
 * what a first-time player lands on:
 *
 *   solvency   the median run is overdrawn for at most `maxBrokeWeeks` of
 *              the horizon. Being broke sometimes is the game; being broke
 *              routinely is a trap.
 *   progress   the median run ends with at least `minProgress` of the goal.
 *              The goals are three-year yardsticks and the horizon is 120
 *              weeks, so this is far below 1 — the claim is "a competent
 *              ordinary approach visibly gets somewhere in every city",
 *              not "wins".
 *   honesty    no run reaches the objective while its cash trough was below
 *              the career's own insolvency-setback floor. A milestone bought
 *              with catastrophic debt is a failed balance outcome, exactly
 *              as the audit put it.
 */
interface Contract {
  maxBrokeWeeks: number;
  minProgress: number;
  /** The career's own insolvency floor, from its `checkSetbacks`. */
  catastrophicTrough: number;
}

const VIOLATIONS: string[] = [];

function enforce(
  title: string,
  city: string,
  rs: Result[],
  c: Contract,
): void {
  const broke = median(rs.map((r) => r.weeksBroke));
  const prog = median(rs.map((r) => r.progress));
  if (broke > c.maxBrokeWeeks) {
    VIOLATIONS.push(
      `${title} / ${city}: median ${broke.toFixed(0)} weeks overdrawn (limit ${c.maxBrokeWeeks})`,
    );
  }
  if (prog < c.minProgress) {
    VIOLATIONS.push(
      `${title} / ${city}: median progress ${(prog * 100).toFixed(0)}% (floor ${Math.round(c.minProgress * 100)}%)`,
    );
  }
  for (const r of rs) {
    if (r.reached && r.troughCash < c.catastrophicTrough) {
      VIOLATIONS.push(
        `${title} / ${city}: objective reached through catastrophic debt (trough ${money(r.troughCash)})`,
      );
      break;
    }
  }
}

/**
 * THE SAME WORKSHOP, RUN LIKE AN ENGINEERING COMPANY.
 *
 * The plain bot's product line and shipping discipline, plus the Phase 5
 * decisions — engaged where they pay, which the first measurement had to
 * teach: hardened-and-modular on EVERYTHING was a trap (progress 40%->12%;
 * a bracket does not need a hardened spec, and the stacked design time ate
 * the horizon). Now: complex, expensive-to-fail products get the hardened
 * spec and the modular architecture; simple ones ship standard. The
 * thermal chamber comes when there is testing to speed, the prototype only
 * where certification money is worth protecting, and the first two
 * disciplines once revenue is real — and, the second lesson the first
 * measurement taught: hired only while the bench has work. Two salaries
 * against an empty bench for a hundred weeks was the entire gap between
 * the tables, and the fix is the ambition the staff make possible: this
 * bot runs three products where the plain one stops at two.
 */
function playDisciplinedEngineer(cityId: string, seed: number): Result {
  let s = startRun(engineer, seed, { city: cityId });
  let weeksBroke = 0;
  let troughCash = s.r.cash;
  let reached = false;

  s = runCommand(engineer, s, "startProduct", "bracket");

  for (let week = 1; week <= HORIZON; week++) {
    const w = workshop(s);
    const live = w.products.filter((x) => x.stage !== "withdrawn");
    const bench = live.find(
      (x) => x.stage === "design" || x.stage === "testing",
    );

    /* ------------------------------------------------- the decisions */
    if (bench && bench.stage === "design") {
      const kind = kindOf(bench)!;
      const dangerous = kind.complexity > 2 || kind.faultCost >= 4_000;
      if (bench.spec === undefined && dangerous) {
        s = runCommand(engineer, s, "setSpec", `${bench.id}:hardened`);
      }
      if (bench.architecture === undefined && dangerous) {
        s = runCommand(engineer, s, "setArchitecture", `${bench.id}:modular`);
      }
    }
    {
      const now = workshop(s);
      const rig = RIGS[0];
      if (
        !rigsOf(now).includes(rig.id) &&
        s.r.cash > rigCost(now, rig) + 14_000
      ) {
        s = runCommand(engineer, s, "buyRig", rig.id);
      }
      for (const role of ["mechanical", "electrical"]) {
        if (
          !benchOf(workshop(s)).some((h) => h.role === role) &&
          s.r.cash > 30_000 &&
          workshop(s).products.some(
            (x) => x.stage === "design" || x.stage === "testing",
          )
        ) {
          s = runCommand(engineer, s, "hireBench", role);
        }
      }
    }

    {
      const now = workshop(s);
      const b = now.products.find(
        (x) => x.stage === "design" || x.stage === "testing",
      );
      if (b) {
        const kind = kindOf(b)!;
        if (b.stage === "design" && b.design >= designNeededFor(b, kind)) {
          s = runCommand(engineer, s, "beginTesting", b.id);
        } else if (
          b.stage === "testing" &&
          !b.prototyped &&
          kind.certCost >= 6_000 &&
          s.r.cash > prototypeCost(now, kind) + 8_000
        ) {
          s = runCommand(engineer, s, "buildPrototype", b.id);
        } else if (
          b.stage === "testing" &&
          estimateOf(b).high <= workshopCityOf(now).certTolerance &&
          s.r.cash > kind.certCost
        ) {
          s = runCommand(engineer, s, "submitForCertification", b.id);
        }
      } else if (live.length < 3) {
        /* The third product is what the disciplines are FOR. */
        const next =
          s.r.skill >= 42 ? "controller" : s.r.skill >= 25 ? "sensor" : "bracket";
        s = runCommand(engineer, s, "startProduct", next);
      }
    }

    const now = workshop(s);
    const onBench = now.products.find(
      (x) => x.stage === "design" || x.stage === "testing",
    );
    const surfaced = shippedProducts(now).some((x) => x.surfaced > 0);
    const shipping = shippedProducts(now).length > 0;
    const rest = s.r.burnout > 75 ? 1 : 0;
    const out = advanceWeek(engineer, s, {
      ...(onBench
        ? onBench.stage === "design"
          ? { design: 3, test: 1 }
          : { test: 3 }
        : {}),
      ...(shipping ? { sell: 2 } : {}),
      ...(surfaced ? { support: 1 } : {}),
      ...(rest > 0 ? { rest } : {}),
    });
    s = out.state;
    if (out.event) s = resolveEventChoice(engineer, s, out.event.def, 0);

    if (s.r.cash < 0) weeksBroke++;
    troughCash = Math.min(troughCash, s.r.cash);
    if (!reached && engineer.objective(s).progress >= 1) reached = true;
  }

  return {
    reached,
    worth: s.r.cash - s.r.debt,
    weeksBroke,
    troughCash,
    progress: engineer.objective(s).progress,
  };
}

/* ------------------------------------------------------------------ report */

const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};

function report(
  title: string,
  cities: { id: string; name: string; difficulty: string }[],
  play: (cityId: string, seed: number) => Result,
  contract?: Contract,
) {
  if (!wanted(title)) return;
  console.log(`\n${title} — ${RUNS} runs per city, ${HORIZON} weeks\n${"─".repeat(76)}`);
  console.log(
    `${"city".padEnd(12)}${"stated".padEnd(9)}${"reached".padEnd(9)}${"progress".padEnd(10)}${"median worth".padEnd(15)}${"wks overdrawn".padEnd(15)}trough`,
  );
  for (const city of cities) {
    const rs = Array.from({ length: RUNS }, (_, i) => play(city.id, 500 + i * 41));
    const reached = rs.filter((r) => r.reached).length;
    if (contract) enforce(title, city.name, rs, contract);
    console.log(
      city.name.padEnd(12) +
        city.difficulty.padEnd(9) +
        `${Math.round((reached / RUNS) * 100)}%`.padEnd(9) +
        `${Math.round(median(rs.map((r) => r.progress)) * 100)}%`.padEnd(10) +
        money(median(rs.map((r) => r.worth))).padEnd(15) +
        median(rs.map((r) => r.weeksBroke)).toFixed(0).padEnd(15) +
        money(median(rs.map((r) => r.troughCash))),
    );
  }
}

/*
 * The contracts. Solvency limits are 5% of the horizon; progress floors
 * are set per career from what the goals actually are — three-year
 * yardsticks measured at week 120. The catastrophic floors are each
 * career's own insolvency-setback threshold from `checkSetbacks`.
 */
const SOLVENT = Math.round(HORIZON * 0.05);

report("Chef — a plain kitchen", KITCHEN_CITIES, playChef, {
  maxBrokeWeeks: SOLVENT,
  /*
   * Solvency only. This bot deliberately never services its fit-out loan —
   * it is the baseline every phase of chef work was measured against — and
   * the objective gates on that loan, so a progress floor here would fail
   * the control for doing its job. The ambitious bot below carries the
   * progress claim.
   */
  minProgress: 0,
  catastrophicTrough: -40_000,
});
report("Chef — the ambitious kitchen", KITCHEN_CITIES, playAmbitiousChef, {
  maxBrokeWeeks: SOLVENT,
  minProgress: 0.2,
  catastrophicTrough: -40_000,
});
report("Solicitor", LEGAL_CITIES, playLawyer, {
  maxBrokeWeeks: SOLVENT,
  /*
   * 0.1, not the 0.2 the other careers carry: the card names this career
   * Punishing, and the floor bot building a $90k-$430k firm from a borrowed
   * desk by week 120 is visible progress at a tenth of a goal that is
   * deliberately enormous. The solvency limit is not relaxed to match —
   * punishing means lumpy, not routinely insolvent.
   */
  minProgress: 0.1,
  catastrophicTrough: -60_000,
});
report("Founder", STARTUP_CITIES, playFounder, {
  maxBrokeWeeks: SOLVENT,
  minProgress: 0.15,
  catastrophicTrough: -20_000,
});
/* The product slice, played as designed. Same thresholds as the plain
   founder on purpose: engaging with discovery, the roadmap and the
   experiments must never make the career less survivable (a trap), and the
   two tables printing together is how a free lunch would show. */
report("Founder (product-led)", STARTUP_CITIES, playAmbitiousFounder, {
  maxBrokeWeeks: SOLVENT,
  minProgress: 0.15,
  catastrophicTrough: -20_000,
});
report("Politician", SEATS, playPolitician, {
  maxBrokeWeeks: SOLVENT,
  minProgress: 0.3,
  catastrophicTrough: -30_000,
});
/* The ground game, played as designed. Same thresholds as the plain
   campaign: engaging must never be a trap, and the two tables printing
   together is how a free lunch would show. */
report("Politician (ground game)", SEATS, playAmbitiousPolitician, {
  maxBrokeWeeks: SOLVENT,
  minProgress: 0.3,
  catastrophicTrough: -30_000,
});
report("Architect", STUDIO_CITIES, playArchitect, {
  maxBrokeWeeks: SOLVENT,
  minProgress: 0.15,
  catastrophicTrough: -35_000,
});
/* The decisions, made as designed. Same thresholds — a trap or a free
   lunch would show against the plain table above. */
report("Architect (decisive)", STUDIO_CITIES, playDecisiveArchitect, {
  maxBrokeWeeks: SOLVENT,
  minProgress: 0.15,
  catastrophicTrough: -35_000,
});
report("Engineer", WORKSHOP_CITIES, playEngineer, {
  maxBrokeWeeks: SOLVENT,
  minProgress: 0.15,
  catastrophicTrough: -40_000,
});
/* The disciplines, run as designed. Same thresholds — the two tables
   printing together is the trap-or-free-lunch reading. */
report("Engineer (disciplined)", WORKSHOP_CITIES, playDisciplinedEngineer, {
  maxBrokeWeeks: SOLVENT,
  minProgress: 0.15,
  catastrophicTrough: -40_000,
});

if (VIOLATIONS.length > 0) {
  console.log(`\nBALANCE CONTRACT VIOLATIONS\n${"─".repeat(76)}`);
  for (const v of VIOLATIONS) console.log("  " + v);
  console.log("");
  process.exitCode = 1;
} else {
  console.log("\nall balance contracts hold\n");
}
