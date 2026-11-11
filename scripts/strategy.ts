/**
 * Reference strategies, shared by the balance harness and the tracer.
 *
 * These are deliberately mechanical — no lookahead, no event judgement. They
 * establish the floor: what a competent-but-unimaginative operator achieves.
 */

import { doctor, med, netWorth } from "../lib/game/careers/doctor";
import {
  CONDITIONS,
  EQUIPMENT_BY_ID,
  ROLE_BY_ID,
  SPECIALTY_BY_ID,
} from "../lib/game/medical/data";
import { CAMPAIGN_BY_ID } from "../lib/game/medical/marketing";
import { LIFESTYLE_BY_ID } from "../lib/game/medical/lifestyle";
import {
  QUALIFICATION_BY_ID,
  enrolBlocker,
} from "../lib/game/medical/progression";
import {
  activeCities,
  blockerFor,
  catchmentIn,
  computeCapacity,
  departmentSlots,
  facilityPrice,
  facilitySlots,
  slotsIn,
  techniciansNeeded,
} from "../lib/game/medical/sim";
import { CITIES, CITY_BY_ID, cityOf } from "../lib/game/medical/cities";
import { OUTBREAK_BY_ID } from "../lib/game/medical/outbreaks";
import { tierCost, weeksOfCover } from "../lib/game/medical/supplies";
import type { RunState } from "../lib/game/types";
import type { CityId } from "../lib/game/medical/types";
import { stageOf } from "../lib/game/crisis";
import { RECOVERY } from "../lib/game/setbacks";
import { CONTRACT_BY_ID } from "../lib/game/medical/contractList";
import { cultureScore, hydrateStaff } from "../lib/game/medical/culture";
import { effectiveFee, marketOf } from "../lib/game/medical/economy";
import { borrowingCapacity, totalOutstanding } from "../lib/game/finance";

export interface Command {
  cmd: string;
  arg: string;
}

export interface Strategy {
  name: string;
  plan: (s: RunState, budget: number) => Record<string, number>;
  /** Commands attempted in order, before the week runs. */
  shop: (s: RunState) => Command[];
}

const cmd = (c: string, a = ""): Command => ({ cmd: c, arg: a });

/**
 * THE UPKEEP A COMPETENT OPERATOR DOES
 *
 * Every strategy below existed before the planner had relationship, fitness,
 * networking and content blocks, so left alone they would take all of the new
 * penalties — staff attrition, patient trust, popularity decay — and none of
 * the new benefits. That is not a measurement of the design, it is a
 * measurement of an out-of-date bot, and it made every strategy look 30 points
 * worse than it is.
 *
 * So each strategy now spends its first blocks here, on the things any
 * competent person does before deciding what kind of career they are having.
 * It is deliberately *minimal* — one or two blocks, only when a number is
 * actually in trouble — because the point is to measure whether the specialist
 * lines still work, not to hand every bot the optimal opening.
 *
 * Returns the blocks it took, so the caller keeps its own budget arithmetic.
 */
export function upkeep(
  s: RunState,
  plan: Record<string, number>,
  budget: number,
): number {
  let used = 0;
  const take = (id: string, n = 1) => {
    if (used + n > Math.max(1, budget - 2)) return;
    plan[id] = (plan[id] ?? 0) + n;
    used += n;
  };

  // Staff walk out below 40. Seeing your people is how that is prevented.
  if ((s.r.repLoyalty ?? 50) < 46 && med(s).staff.length > 0) take("people");

  // Fitness is the compounding half of burnout management; rest is the acute
  // half and each strategy handles that in its own way.
  if (s.r.burnout > 45 && (s.r._fitness ?? 0) < 9) take("exercise");

  return used;
}

/**
 * Cash a sane operator keeps back before committing to anything: about a
 * month of running costs. Fixed thresholds do not work here because weekly
 * costs span three orders of magnitude between week 1 and a full hospital.
 */
/**
 * WHAT A COMMAND ACTUALLY COSTS
 *
 * Read from the same tables the engine charges against, so a budget built on
 * these cannot disagree with what the purchase does.
 *
 * Zero for anything free — recovery steps, crisis choices, triage, toggles.
 * Those are decisions, not purchases, and must never be squeezed out of a week
 * by a spending cap.
 */
function costOf(s: RunState, c: Command): number {
  const m = med(s);
  switch (c.cmd) {
    case "buyFacility": {
      const [type, city] = c.arg.split(":");
      return facilityPrice(type, (city as CityId) ?? m.homeCity);
    }
    case "hire":
      return ROLE_BY_ID.get(c.arg.split(":")[0] as never)?.hireCost ?? 0;
    case "openDepartment":
      return SPECIALTY_BY_ID.get(c.arg as never)?.unlockCost ?? 0;
    case "buyEquipment":
      return EQUIPMENT_BY_ID.get(c.arg as never)?.cost ?? 0;
    case "buySupplies":
      return tierCost(m, c.arg);
    case "enterCity":
      return CITY_BY_ID.get(c.arg as CityId)?.entryCost ?? 0;
    case "payLoan":
      return Math.min(10_000, s.r.debt, Math.max(0, s.r.cash));
    case "buyLifestyle":
      return LIFESTYLE_BY_ID.get(c.arg)?.cost ?? 0;
    /*
     * A rise deducts nothing today — it raises payroll from next week. The
     * engine's `cash >= rise * 8` is a prudence gate, not a price, and
     * charging it here spent a budget that was never actually spent: it
     * starved departments of money the practice still had. Zero, and the
     * engine's own gate decides.
     */
    case "rewardStaff":
      return 0;
    case "trainStaff":
      return 9_000;
    default:
      return 0;
  }
}

/**
 * Can this command be paid for out of the money on hand, right now?
 *
 * ------------------------------------------------------------- the bug this fixes
 *
 * Every `shop()` computed `spendable(s)` once and then tested that same stale
 * figure in every branch below it. So a single week could emit "buy a clinic"
 * *and* "hire a GP" *and* "hire a nurse" *and* "open a department" — each one
 * individually affordable against a balance that the previous three had
 * already spent. The engine refuses whatever is genuinely unaffordable when it
 * arrives, so nothing went negative directly; what happened instead is that
 * the bot drained itself to near-zero every week and had nothing left when the
 * payroll and upkeep landed.
 *
 * ------------------------------------------------------------ why it is live
 *
 * The first fix trimmed the whole week's list up front against one budget.
 * That is wrong in the other direction: a week that raises a bank facility and
 * then spends it would have had the spending trimmed against the balance from
 * *before* the money arrived. Asking the question one command at a time,
 * against the state as it actually stands, is the only version that survives
 * both cases.
 *
 * Applied centrally rather than inside each strategy: not spending money you
 * do not have is a property of playing the game, not of a strategy, and doing
 * it in one place means a new strategy inherits it.
 */
export function canAfford(s: RunState, c: Command): boolean {
  const cost = costOf(s, c);
  /* Free actions — and the ones the engine prices itself — always pass. */
  return cost === 0 || cost <= spendable(s);
}

function spendable(s: RunState): number {
  const m = med(s);
  const weekly =
    m.staff.reduce((sum, x) => sum + x.salary, 0) +
    m.facilities.length * 500 +
    m.equipment.length * 1_000;
  // Two weeks of cover, capped: a four-week reserve looks prudent early and
  // becomes a straitjacket once payroll is five figures, freezing the bot out
  // of every purchase for the rest of the run.
  return s.r.cash - Math.min(weekly * 2 + 5_000, 45_000);
}

/**
 * BORROWING TO BUILD
 *
 * Sixteen of the eighteen strategies never raised a penny of outside money.
 * They funded a capital-intensive business out of retained earnings, starting
 * from $165,000 of student debt and one rented room — and the traces show what
 * that costs: overdrawn from about week 45 to the horizon, stuck at two
 * departments, payroll spent and no staff left to show for it. Financing is a
 * built mechanic with a screen of its own, and a competent operator uses it.
 *
 * This is deliberately not `borrower`'s "take everything, every week". That
 * strategy is the leverage stress test and has to stay one. This is the
 * ordinary version: borrow when there is a specific thing to build, the money
 * is not already there, and the practice is big enough that a lender would
 * actually say yes.
 *
 * Bank only. The investor and the partner cost equity, and how much of your
 * practice you are willing to sell is a judgement call that belongs to a
 * strategy rather than to the baseline every strategy inherits.
 */
function financeGrowth(s: RunState): Command[] {
  /* Nothing worth building means nothing worth borrowing for. */
  if (bestInvestment(s).length === 0) return [];
  /* The money is already on hand — a facility here would just accrue. */
  if (spendable(s) > 60_000) return [];

  const revenue = Math.max(0, s.r._lastRevenue ?? 0);
  /*
   * Interest compounds on the balance and nothing forces repayment, so debt
   * taken against a practice that is not yet earning quietly grows for the
   * rest of the run. Borrow against a business that exists.
   *
   * $1,500 was tried, on the theory that the lender's own floor was the only
   * gate needed. It measured worse across the board — Epidemiologist went from
   * +$1.7M to -$639k — because money borrowed against a practice that cannot
   * yet convert it compounds for the rest of the run. The higher floor is kept
   * on that evidence.
   */
  if (revenue < 4_000) return [];
  /*
   * Keep the balance inside a quarter of the income the bank itself
   * underwrites. Past that the practice is carrying more debt than its own
   * lender's view of it comfortably supports.
   */
  if (totalOutstanding(s) > revenue * 13) return [];
  /* Below the bank's own floor the offer comes back blocked anyway. */
  if (borrowingCapacity(s, netWorth(s), revenue) < 25_000) return [];

  return [cmd("raiseFunds", "bank")];
}

/**
 * Ranks what to buy next by what last week's referrals were actually worth.
 * This is the decision the whole career is built around, so the reference
 * strategy has to make it the same way a thoughtful player would.
 */
function bestInvestment(s: RunState): Command[] {
  const m = med(s);
  const out: Command[] = [];

  // Machines are useless without someone to run them.
  const techs = m.staff.filter((x) => x.role === "technician").length;
  if (techs < techniciansNeeded(m)) out.push(cmd("hire", "technician"));

  // Value up every blocked condition, grouped by what is blocking it.
  const lostByDept = new Map<string, number>();
  const lostByEquip = new Map<string, number>();
  const lostByStaff = new Map<string, number>();

  for (const cond of CONDITIONS) {
    const block = blockerFor(m, cond);
    if (!block) continue;
    const value = cond.fee * cond.prevalence;
    if (block === "department") {
      lostByDept.set(cond.specialty, (lostByDept.get(cond.specialty) ?? 0) + value);
    } else if (block === "equipment") {
      for (const e of cond.equipment ?? []) {
        if (!m.equipment.includes(e)) {
          lostByEquip.set(e, (lostByEquip.get(e) ?? 0) + value);
        }
      }
    } else if (block === "staff") {
      lostByStaff.set(cond.specialty, (lostByStaff.get(cond.specialty) ?? 0) + value);
    }
  }

  /*
   * ONE RANKING, ACROSS ALL THREE
   *
   * This function's job is to buy whatever unblocks the most money per dollar.
   * It used to emit a fixed order instead — every affordable specialist, then
   * equipment, then a department last — on the reasoning that staffing an open
   * department is the cheapest unlock. That reasoning is fine in isolation and
   * wrong in aggregate: with a live budget the department is the item the week
   * always runs out of money before reaching, so the practice hired people it
   * then had nothing profitable for. The traces are unambiguous about the
   * result — 43% of capacity idle while a third of arrivals were turned away,
   * and payroll at two thirds of revenue.
   *
   * So the three categories compete on the same measure, value per dollar, and
   * the winner goes first. Ties and near-ties sort themselves out over weeks.
   */
  const best = <K,>(
    map: Map<K, number>,
    costOfKey: (k: K) => number,
  ): { key: K; value: number; cost: number } | null => {
    let win: { key: K; value: number; cost: number } | null = null;
    for (const [key, value] of map) {
      const cost = Math.max(1, costOfKey(key));
      if (!win || value / cost > win.value / win.cost) win = { key, value, cost };
    }
    return win;
  };

  const candidates: { cmd: Command; value: number; cost: number }[] = [];

  const staffGap = best(lostByStaff, (k) =>
    ROLE_BY_ID.get("specialist" as never)?.hireCost ?? SPECIALTY_BY_ID.get(k as never)?.unlockCost ?? 1,
  );
  if (staffGap) {
    candidates.push({
      cmd: cmd("hire", `specialist:${staffGap.key}`),
      value: staffGap.value,
      cost: staffGap.cost,
    });
  }

  const equipGap = best(
    lostByEquip,
    (k) => EQUIPMENT_BY_ID.get(k as never)?.cost ?? 1,
  );
  if (equipGap) {
    candidates.push({
      cmd: cmd("buyEquipment", equipGap.key),
      value: equipGap.value,
      cost: equipGap.cost,
    });
  }

  /* A department still needs somewhere to put it. */
  if (m.departments.length < departmentSlots(m)) {
    const deptGap = best(
      lostByDept,
      (k) => SPECIALTY_BY_ID.get(k as never)?.unlockCost ?? 1,
    );
    if (deptGap) {
      candidates.push({
        cmd: cmd("openDepartment", deptGap.key),
        value: deptGap.value,
        cost: deptGap.cost,
      });
    }
  }

  candidates.sort((a, b) => b.value / b.cost - a.value / a.cost);
  out.push(...candidates.map((c) => c.cmd));

  return out;
}

export const grind: Strategy = {
  name: "Grind (all clinic, no hiring)",
  plan: (_s, budget) => ({ clinic: budget }),
  shop: () => [],
};

export const coast: Strategy = {
  name: "Coast (all rest)",
  plan: (_s, budget) => ({ rest: budget }),
  shop: () => [],
};

/** Buys capacity but never opens new medicine — the "just work harder" trap. */
export const generalist: Strategy = {
  name: "Generalist (capacity only)",
  plan: (s, budget) => {
    const plan: Record<string, number> = {};
    let left = budget;
    left -= upkeep(s, plan, budget);
    if (s.r.burnout > 55) {
      plan.rest = Math.min(2, left);
      left -= plan.rest;
    }
    if (left > 1) {
      plan.outreach = 1;
      left -= 1;
    }
    if (left > 0) plan.clinic = left;
    return plan;
  },
  shop: (s) => {
    const m = med(s);
    const out: Command[] = [];
    const free = spendable(s);
    const cap = computeCapacity(m, 3, s.r.skill, s.r.burnout);
    if (cap.limitedBy === "space" && free > 34_000) {
      out.push(cmd("buyFacility", "clinic"));
    } else if (free > 6_000) {
      out.push(cmd("hire", "gp"));
    }
    if (free > 2_200) out.push(cmd("hire", "nurse"));
    if (free > 40_000 && s.r.debt > 0) out.push(cmd("payLoan"));
    return out;
  },
};

/** Invests along the blocked-revenue signal — the intended line of play. */
export const builder: Strategy = {
  name: "Builder (follows the caseload)",
  plan: (s, budget) => {
    const plan: Record<string, number> = {};
    let left = budget;
    left -= upkeep(s, plan, budget);

    if (s.r.burnout > 60) {
      plan.rest = Math.min(2, left);
      left -= plan.rest;
    } else if (s.r.burnout > 38) {
      plan.rest = 1;
      left -= 1;
    }
    if (s.r.risk > 35 && left > 1) {
      plan.manage = 1;
      left -= 1;
    }
    if (s.r.skill < 62 && s.week < 50 && left > 1) {
      plan.study = 1;
      left -= 1;
    }

    // Grow demand only while there is somewhere to put it.
    const m = med(s);
    const cap = computeCapacity(m, left, s.r.skill, s.r.burnout);
    const expected = s.r.panel * 0.28 * 1.5;
    if (cap.effective > expected && left > 1) {
      plan.outreach = 1;
      left -= 1;
    }

    if (left > 0) plan.clinic = left;
    return plan;
  },
  shop: (s) => {
    const m = med(s);
    /* Trouble first, always. Everything downstream assumes a practice that is
       operating, and a setback is the state where it is not. Then the team:
       replacing somebody costs more than keeping them. */
    const out: Command[] = [...handleTrouble(s), ...keepStaff(s)];
    /* Before any of the spending below, decide whether to fund it. */
    out.push(...financeGrowth(s));
    const free = spendable(s);

    // Keep enough physical space and enough people to use it.
    const cap = computeCapacity(m, 3, s.r.skill, s.r.burnout);
    const expected = s.r.panel * 0.28 * 2.2;

    /*
     * CAPABILITY BEFORE CAPACITY
     *
     * This used to come last, after premises, hiring and supplies had taken
     * their share — so with a real budget the department never got bought at
     * all. The diagnostics say plainly why that is the wrong order: the
     * practice ran at ~49% idle capacity while turning away ~36% of arrivals.
     * Those are only compatible if the patients are being turned away for
     * want of a *department*, not for want of room or hours. Buying more
     * capacity in that state buys nothing.
     *
     * So the blocked-revenue signal goes first, which is what this strategy's
     * name always claimed it did. It is also what the Caseload screen tells a
     * human player, in those words, under "your main limit this week".
     */
    if (free > 8_000) out.push(...bestInvestment(s));

    /*
     * And only add capacity when capacity is genuinely the constraint. Being
     * short of *space* is a real reason to build; being short of nothing is
     * not, and this branch fired unconditionally whenever demand outran a
     * capacity figure the practice could not use anyway.
     */
    const blockedOnCapacity =
      m.lastCases.reduce(
        (n, c) => n + (c.blockedBy === "capacity" ? c.turnedAway : 0),
        0,
      ) >
      m.lastCases.reduce(
        (n, c) => n + (c.blockedBy === "department" ? c.turnedAway : 0),
        0,
      );

    /*
     * Premises are also how you get somewhere to *put* a department: a rented
     * room holds one, a clinic three, a centre six. So when every slot is full
     * and departments are what the caseload is short of, building is the move
     * even though patient capacity is not the binding constraint.
     */
    const outOfSlots = m.departments.length >= departmentSlots(m);

    if (
      (cap.effective < expected &&
        (blockedOnCapacity || m.lastCases.length === 0)) ||
      (outOfSlots && !blockedOnCapacity && m.lastCases.length > 0)
    ) {
      if (cap.limitedBy === "space" || outOfSlots) {
        const slots = facilitySlots(m);
        if (free > 520_000 && slots > 350) out.push(cmd("buyFacility", "hospital"));
        else if (free > 185_000) out.push(cmd("buyFacility", "centre"));
        else if (free > 34_000) out.push(cmd("buyFacility", "clinic"));
        else if (free > 9_000) out.push(cmd("buyFacility", "room"));
      } else {
        if (free > 6_000) out.push(cmd("hire", "gp"));
        if (free > 2_200) out.push(cmd("hire", "nurse"));
      }
    }

    // Keep consumables stocked, taking the largest discount affordable.
    // A fixed 12-week rule looked prudent but priced high-volume practices
    // out of bulk entirely — their weekly draw is large enough that a
    // quarter's order never cleared the reserve, so they paid spot forever.
    if (weeksOfCover(m) < 5) {
      for (const tier of ["weeks12", "weeks4"]) {
        if (free > tierCost(m, tier) * 1.3) {
          out.push(cmd("buySupplies", tier));
          break;
        }
      }
    }

    if (free > 2_600 && m.staff.filter((x) => x.role === "admin").length < 2) {
      out.push(cmd("hire", "admin"));
    }
    // Clearing the loan is half the objective, so sweep spare cash into it
    // rather than treating it as an afterthought.
    if (free > 25_000 && s.r.debt > 0) out.push(cmd("payLoan"));
    return out;
  },
};

/**
 * Builder plus marketing. Isolates one question: does buying demand pay for
 * itself, or is it a money fire?
 */
export const marketer: Strategy = {
  name: "Marketer (builder + campaigns)",
  plan: builder.plan,
  shop: (s) => {
    const m = med(s);
    const out = [...builder.shop(s)];
    const free = spendable(s);
    // Only buy demand when there is capacity to serve it — the whole point of
    // the catchment system is that unmet demand is actively harmful.
    // Capacity in practice tracks demand closely rather than running far
    // ahead of it, so this only needs a little headroom — an earlier 1.6x bar
    // was never met once in 126 weeks and silently disabled the whole branch.
    const cap = computeCapacity(m, 3, s.r.skill, s.r.burnout);
    if (cap.effective < s.r.panel * 0.28 * 1.3) return out;

    // Word-of-mouth channels first while well regarded; they are cheap and
    // scale with reputation rather than spend.
    const order =
      s.r.reputation > 60
        ? ["reviews", "socialMedia", "website", "referralNetwork", "healthCamps", "billboards", "broadcast"]
        : ["flyers", "website", "localPress"];
    for (const id of order) {
      const c = CAMPAIGN_BY_ID.get(id as never);
      if (!c || m.campaigns.includes(c.id)) continue;
      if (c.minReputation && s.r.reputation < c.minReputation) continue;
      if (free > c.setupCost + c.weeklyCost * 8) {
        out.push(cmd("toggleCampaign", c.id));
        break;
      }
    }
    return out;
  },
};

/**
 * Climbs the qualification ladder instead of buying every consultant.
 * Isolates: is becoming the specialist a real alternative to employing one?
 */
export const academic: Strategy = {
  name: "Academic (builder + qualifications)",
  plan: (s, budget) => {
    const plan = builder.plan(s, budget);
    // Study harder than the baseline: CPD is the gate on the whole ladder.
    if ((plan.clinic ?? 0) > 1 && s.r.cpd < 200) {
      plan.clinic = (plan.clinic ?? 0) - 1;
      plan.study = (plan.study ?? 0) + 1;
    }
    return plan;
  },
  shop: (s) => {
    const m = med(s);
    const out = [...builder.shop(s)];
    const free = spendable(s);
    const main = m.departments.find((d) => d !== "general") ?? "general";
    const ladder: [string, string | null][] = [
      ["membership", main],
      ["doctorate", null],
      ["fellowship", main],
      ["surgical", main],
      ["professorship", null],
    ];
    for (const [id, specialty] of ladder) {
      const q = QUALIFICATION_BY_ID.get(id as never);
      if (!q) continue;
      const blocked = enrolBlocker(
        m,
        q,
        free,
        s.r.cpd,
        s.r.skill,
        specialty as never,
      );
      if (!blocked) {
        out.push(cmd("enrol", specialty ? `${id}:${specialty}` : id));
        break;
      }
    }
    return out;
  },
};

/**
 * Builder, but spends on lifestyle the moment it can. Isolates: does the
 * trophy cabinet actually cost you the game? It should — most of it destroys
 * net worth, which is half the win condition.
 */
export const baller: Strategy = {
  name: "Baller (builder + lifestyle)",
  plan: builder.plan,
  shop: (s) => {
    const m = med(s);
    const out = [...builder.shop(s)];
    const free = spendable(s);
    const wishlist = [
      "gym",
      "housekeeper",
      "chauffeur",
      "townhouse",
      "luxury_saloon",
      "private_chef",
      "suburban_house",
      "sports_car",
      "penthouse",
      "holiday_home",
      "yacht",
      "country_estate",
      "private_jet",
    ];
    for (const id of wishlist) {
      const item = LIFESTYLE_BY_ID.get(id);
      if (!item || m.lifestyle.includes(id)) continue;
      if (free > item.cost + item.upkeep * 10) {
        out.push(cmd("buyLifestyle", id));
        break;
      }
    }
    return out;
  },
};

/**
 * Expands into new markets once the current ones are full. Isolates: does
 * going to Paris and London actually beat staying where you trained?
 *
 * It should, decisively — a single mid-size city hard-caps your panel at its
 * population, so a home-only practice hits a wall no amount of hiring clears.
 */
export const empire: Strategy = {
  name: "Empire (builder + cities)",
  plan: builder.plan,
  shop: (s) => {
    const m = med(s);
    const out = [...builder.shop(s)];
    const free = spendable(s);

    // Is the network running out of room to grow into?
    const running = activeCities(m);
    const saturated = running.every((c) => {
      const ceiling = catchmentIn(m, c, s.r.reputation);
      return ceiling <= 0 || (m.panels[c] ?? 0) > ceiling * 0.75;
    });

    if (saturated) {
      // Rank by what the market yields, not by what it costs to get in.
      // Entry is one-off; fees and population are forever.
      //
      // Crucially this picks the best market and then *waits* to afford it,
      // rather than taking the best currently-affordable one. Filtering by
      // affordability first makes the bot permanently settle for cheap,
      // low-fee cities and it never reaches Paris or Tokyo at all.
      const best = CITIES.filter((c) => !m.cities.includes(c.id)).sort(
        (a, b) =>
          b.population * b.feeIndex * (1 - b.competition) -
          a.population * a.feeIndex * (1 - a.competition),
      )[0];
      if (
        best &&
        free > best.entryCost + facilityPrice("clinic", best.id) * 1.3
      ) {
        out.push(cmd("enterCity", best.id));
      }
    }

    // Put premises in any licensed market that has none yet, then keep the
    // biggest markets growing.
    const empty = m.cities.filter((c) => slotsIn(m, c) === 0);
    for (const c of empty) {
      if (free > facilityPrice("clinic", c)) {
        out.push(cmd("buyFacility", `clinic:${c}`));
        break;
      }
    }

    const hungry = running
      .filter((c) => {
        const ceiling = catchmentIn(m, c, s.r.reputation);
        return ceiling > 0 && (m.panels[c] ?? 0) > ceiling * 0.7;
      })
      .sort(
        (a, b) => cityOf(b).population - cityOf(a).population,
      )[0];
    if (hungry) {
      for (const tier of ["hospital", "centre", "clinic", "room"]) {
        const price = facilityPrice(tier, hungry);
        if (free > price * 1.4) {
          out.push(cmd("buyFacility", `${tier}:${hungry}`));
          break;
        }
      }
    }

    return out;
  },
};

/**
 * Cities and campaigns together. Marketing alone now underperforms because a
 * capped market cannot absorb the demand you buy — this checks whether the
 * two combine, which is the design's claim: reach is only worth paying for
 * when there are both people and capacity to serve.
 */
export const magnate: Strategy = {
  name: "Magnate (cities + campaigns)",
  plan: builder.plan,
  shop: (s) => [...empire.shop(s), ...marketer.shop(s).slice(builder.shop(s).length)],
};

/**
 * Magnate that also answers outbreaks. Isolates: is responding worth it, or
 * is riding out a surge — which is, after all, billable work — the better
 * play?
 */
export const epidemiologist: Strategy = {
  name: "Epidemiologist (magnate + response)",
  plan: (s, budget) => {
    const plan = magnate.plan(s, budget);
    // Research is paid for in CPD, so keep studying while anything is running.
    const m = med(s);
    if (m.outbreaks.length > 0 && s.r.cpd < 120 && (plan.clinic ?? 0) > 1) {
      plan.clinic = (plan.clinic ?? 0) - 1;
      plan.study = (plan.study ?? 0) + 1;
    }
    return plan;
  },
  shop: (s) => {
    const m = med(s);
    const out = [...magnate.shop(s)];
    const free = spendable(s);

    for (const active of m.outbreaks) {
      const def = OUTBREAK_BY_ID.get(active.id);
      if (!def) continue;
      const key = `${active.id}:${active.city}`;

      // Publishing is the best value: it ends the pathogen everywhere and
      // never lets it back.
      if (free > def.researchCost && s.r.cpd >= def.researchCpd) {
        out.push(cmd("research", key));
        continue;
      }
      // Otherwise vaccinate if we can dispense, for the standing.
      if (
        def.vaccineCost > 0 &&
        m.equipment.includes("pharmacy") &&
        free > def.vaccineCost * 1.5
      ) {
        out.push(cmd("vaccinate", key));
        continue;
      }
      // Failing both, contain the serious ones and ride out the mild.
      if (!active.contained && def.severity >= 3 && free > def.containCost) {
        out.push(cmd("contain", key));
      }
    }
    return out;
  },
};

/**
 * THE EXPLOIT CHECK
 *
 * Leans as hard as the caps allow on the blocks added with the planner —
 * networking, content, relationships, fitness — and buys nothing clever.
 *
 * This exists to fail. If soft standing were a shortcut, a bot that does
 * nothing but build standing would beat one that builds a practice, and the
 * whole reputation system would be an exploit wearing six labels. It is in
 * the harness permanently so that stays true after later tuning.
 */
export const influencer: Strategy = {
  name: "Influencer (standing over substance)",
  plan: (s, budget) => {
    const plan: Record<string, number> = {};
    let left = budget;

    if (s.r.burnout > 55) {
      plan.rest = Math.min(2, left);
      left -= plan.rest;
    }
    // Every soft block, to its cap, before any clinical work.
    for (const id of ["network", "content", "people", "exercise"] as const) {
      if (left <= 1) break;
      const action = doctor.actions.find((a) => a.id === id);
      const cap = Math.min(action?.maxPerWeek ?? 2, left - 1);
      if (cap > 0) {
        plan[id] = cap;
        left -= cap;
      }
    }
    if (left > 0) plan.clinic = left;
    return plan;
  },
  shop: (s) => {
    const out: Command[] = [];
    const free = spendable(s);
    // Minimal, competent capacity — enough that this is not simply the Grind
    // strategy with extra steps.
    if (free > 34_000) out.push(cmd("buyFacility", "clinic"));
    if (free > 2_200) out.push(cmd("hire", "nurse"));
    if (free > 60_000 && s.r.debt > 0) out.push(cmd("payLoan"));
    return out;
  },
};


/* ==================================================================== */
/* PHASE 2 STRATEGIES                                                    */
/*                                                                       */
/* Eight lines of play across the systems Phase 2 added. Each exists to  */
/* answer one question the design has to be able to answer:              */
/*                                                                       */
/*   conservative  does never borrowing still work?                      */
/*   borrower      can leverage be farmed into a guaranteed win?         */
/*   manager       is culture worth the blocks it costs?                 */
/*   contractor    can assignments replace the caseload entirely?        */
/*   expander      does the city economy punish or reward spreading?     */
/*   antagonist    is picking fights with rivals a strategy?             */
/*   reputable     can standing alone carry a run?                       */
/*   allrounder    does doing a bit of everything beat specialising?     */
/*                                                                       */
/* The answers that matter are the negative ones. If `borrower` wins at  */
/* a materially higher rate than the rest, financing is an exploit; if   */
/* `contractor` does, the caseload has stopped being the game.           */
/* ==================================================================== */

/**
 * When a strategy is allowed to start being clever.
 *
 * Every Phase 2 line originally diverted blocks from week one and all four of
 * them returned 0% — because at week one there are no contracts to work, no
 * staff to manage and no profession that has heard of you, so the blocks were
 * being spent on nothing while the caseload starved. Measured, not guessed:
 * the first 40-seed pass had manager, contractor, antagonist and reputable all
 * on zero while conservative sat at 70%.
 *
 * A real player does the same thing — you build the practice, then you start
 * playing the meta-game — so the ramp is a fix to the bots rather than a
 * concession from the design.
 */
const established = (s: RunState): boolean =>
  s.week >= 24 && med(s).facilities.length >= 2 && med(s).staff.length >= 2;

/**
 * Start from the reference planner, then swap a block or two.
 *
 * The first version of these strategies each hand-wrote a whole `plan`, and
 * all four returned 0% while `conservative` — which builds on `builder.plan`
 * — returned 70%. A trace showed why: they were not testing their own idea,
 * they were testing a much worse planner. `builder.plan` carries the rest
 * thresholds, the risk management and the capacity-aware outreach that keep a
 * practice solvent; writing that again badly measures nothing.
 *
 * So each strategy now takes the reference plan and *substitutes* — which is
 * also what a player does. The strategy is in the substitution and in what it
 * buys, not in re-deriving how to run a clinic.
 */
function swap(
  plan: Record<string, number>,
  from: string,
  to: string,
  n: number,
): void {
  const have = plan[from] ?? 0;
  const moved = Math.min(n, Math.max(0, have - 1));
  if (moved <= 0) return;
  plan[from] = have - moved;
  plan[to] = (plan[to] ?? 0) + moved;
}

/**
 * Deal with whatever is currently wrong: crises, and now setbacks.
 *
 * The setback half is not optional. Phase 3 removed the automatic
 * terminators, so a run that goes insolvent no longer stops — it keeps
 * playing, underwater, for as long as the horizon allows. A bot that never
 * calls `recoverSetback` therefore spirals, and the first harness pass after
 * the change showed exactly that: every strategy fell to single digits
 * because none of them knew how to climb out.
 *
 * A player has the recovery panel in front of them. The bots get the same
 * routes, taken greedily.
 */
function handleTrouble(s: RunState): Command[] {
  const out: Command[] = [];
  for (const c of s.crises ?? []) {
    const stage = stageOf(c);
    const pick = stage.choices.find(
      (ch) => !c.taken.includes(ch.id) && (!ch.cost || s.r.cash >= ch.cost),
    );
    if (pick) out.push(cmd("crisisChoice", `${c.id}:${pick.id}`));
  }
  for (const sb of s.setbacks ?? []) {
    const step = (RECOVERY[sb.kind] ?? []).find(
      (x) => !sb.done.includes(x.id) && x.available(s),
    );
    if (step) out.push(cmd("recoverSetback", `${sb.kind}:${step.id}`));
  }
  return out;
}

/** Kept for readability at the call sites; both kinds of trouble, one call. */
const handleCrises = handleTrouble;

/**
 * KEEPING THE PEOPLE YOU HIRED
 *
 * Expectations creep every week — `culture.ts` raises `expects` with skill and
 * ambition — while salary is fixed at the moment of hire. Left alone the gap
 * widens, culture falls under 25, and staff resign. The counter-play is
 * `rewardStaff`, which closes the gap exactly and permanently.
 *
 * Only one strategy used it, and behind `cash > 200_000` — a balance no run
 * ever reached. So every other strategy hired continuously, lost everyone to
 * churn, and paid the hiring cost again: that is where the payroll went in a
 * practice that ends the run with no staff.
 *
 * This is the floor, not a strategy: retaining somebody you are already paying
 * is cheaper than replacing them, and any competent player does it. Strategies
 * that want to spend *more* on their team still can, and `manager` still does.
 *
 * Deliberately conservative — it acts on a gap of 12% or more, and the engine
 * enforces its own eight-weeks-of-cover guard on top.
 */
function keepStaff(s: RunState): Command[] {
  const m = med(s);
  if (m.staff.length === 0) return [];
  const out: Command[] = [];

  /* Workload is practice-wide and free, so it comes first. */
  if (cultureScore(m, s.week).score < 45) out.push(cmd("easeWorkload"));

  /* Worst-underpaid first, so a tight week fixes the person closest to
     leaving rather than whoever happens to be first in the array. */
  const behind = m.staff
    .map((raw) => hydrateStaff(raw))
    .filter((x) => x.expects > x.salary * 1.12)
    .sort((a, b) => b.expects - b.salary - (a.expects - a.salary));
  for (const x of behind) out.push(cmd("rewardStaff", x.id));
  return out;
}

/** Accept offers matching a filter, and pass on the rest so they do not clog. */
function takeOffers(
  s: RunState,
  want: (kind: string, ethicalRisk: number) => boolean,
): Command[] {
  const out: Command[] = [];
  for (const o of s.offers ?? []) {
    const def = CONTRACT_BY_ID.get(o.defId);
    if (!def) continue;
    out.push(
      want(def.kind, def.ethicalRisk)
        ? cmd("acceptContract", o.defId)
        : cmd("declineContract", o.defId),
    );
  }
  return out;
}

/** Blocks kept back for live assignments, so they do not fail unworked. */
function caseworkBlocks(s: RunState, left: number): number {
  const live = s.contracts ?? [];
  if (live.length === 0) return 0;
  const urgent = live.filter((c) => c.dueWeek - s.week <= 2).length;
  return Math.min(left - 1, Math.max(1, urgent));
}

/** Never borrows, never sells equity, grows only out of retained profit. */
export const conservative: Strategy = {
  name: "Conservative operator (no outside money)",
  plan: (s, budget) => {
    const plan = builder.plan(s, budget);
    const spent = Object.values(plan).reduce((n, x) => n + x, 0);
    const work = caseworkBlocks(s, budget - spent + (plan.clinic ?? 0));
    if (work > 0 && (plan.clinic ?? 0) > work) {
      plan.clinic = (plan.clinic ?? 0) - work;
      plan.casework = work;
    }
    return plan;
  },
  /*
   * The control, and it has to stay one. `builder` now raises a bank facility
   * when growth needs funding, and this strategy inherits `builder.shop`
   * wholesale — so the borrowing is filtered back out here rather than by
   * keeping a second copy of the shopping logic in step by hand. If somebody
   * later teaches `builder` a new way to raise money, this still never takes
   * it, which is the whole point of the comparison.
   */
  shop: (s) => [
    ...handleCrises(s),
    ...takeOffers(s, (_k, risk) => risk < 0.3),
    ...builder.shop(s).filter((c) => c.cmd !== "raiseFunds"),
  ],
};

/** Borrows at every opportunity and spends it. The leverage stress test. */
export const borrower: Strategy = {
  name: "Aggressive borrower (leverage everything)",
  plan: (s, budget) => conservative.plan(s, budget),
  shop: (s) => {
    const out: Command[] = [...handleCrises(s)];
    out.push(...takeOffers(s, () => true));
    /* Take whatever is on the table, every week. If financing can be farmed,
       this is the strategy that finds it. */
    for (const kind of ["bank", "investor", "partner", "grant"]) {
      out.push(cmd("raiseFunds", kind));
    }
    out.push(...builder.shop(s));
    return out;
  },
};

/** Pays, trains and promotes. Spends blocks on people rather than on clinic. */
export const manager: Strategy = {
  name: "Staff-focused manager (culture first)",
  plan: (s, budget) => {
    const plan = builder.plan(s, budget);
    if (med(s).staff.length >= 2) swap(plan, "clinic", "people", established(s) ? 2 : 1);
    const live = (s.contracts ?? []).length;
    if (live > 0) swap(plan, "clinic", "casework", 1);
    return plan;
  },
  shop: (s) => {
    const m = med(s);
    const out: Command[] = [...handleCrises(s)];
    out.push(...takeOffers(s, (_k, risk) => risk < 0.3));
    const culture = cultureScore(m, s.week).score;
    if (culture < 55 && m.staff.length > 0) out.push(cmd("easeWorkload"));
    for (const raw of m.staff) {
      const x = hydrateStaff(raw);
      if (x.expects > x.salary * 1.1 && s.r.cash > 200_000) {
        out.push(cmd("rewardStaff", x.id));
      } else if (x.training === 0 && x.skill < 80 && s.r.cash > 150_000) {
        out.push(cmd("trainStaff", x.id));
      }
    }
    out.push(...builder.shop(s));
    return out;
  },
};

/** Takes every assignment going and works them hard. */
export const contractor: Strategy = {
  name: "Contract specialist (assignments over caseload)",
  plan: (s, budget) => {
    const plan = builder.plan(s, budget);
    const live = (s.contracts ?? []).length;
    if (live > 0) swap(plan, "clinic", "casework", established(s) ? 3 : 1);
    if (established(s) && (s.r.repInfluence ?? 20) < 60) {
      swap(plan, "clinic", "network", 1);
    }
    return plan;
  },
  shop: (s) => [
    ...handleCrises(s),
    ...takeOffers(s, (_k, risk) => risk < 0.6),
    ...builder.shop(s),
  ],
};

/** Opens cities and reads the market before choosing. */
export const expander: Strategy = {
  name: "City expansion (reads the market)",
  plan: (s, budget) => conservative.plan(s, budget),
  shop: (s) => {
    const m = med(s);
    const out: Command[] = [...handleCrises(s)];
    out.push(...takeOffers(s, (_k, risk) => risk < 0.3));
    /* The Phase 2 addition: pick the city whose CURRENT market is best, not
       whose static definition is. A recession makes a good city a bad buy. */
    const free = s.r.cash - 120_000;
    if (free > 0) {
      const candidates = CITIES.filter((c) => !m.cities.includes(c.id))
        .map((c) => {
          const mk = marketOf(m.markets, c.id);
          return {
            id: c.id,
            cost: c.entryCost,
            score:
              c.population * mk.demand * effectiveFee(m.markets, c.id) -
              c.entryCost / 90_000,
          };
        })
        .filter((c) => c.cost < free)
        .sort((a, b) => b.score - a.score);
      if (candidates[0]) {
        out.push(cmd("enterCity", candidates[0].id));
        out.push(cmd("buyFacility", `clinic:${candidates[0].id}`));
      }
    }
    out.push(...builder.shop(s));
    return out;
  },
};

/** Goes after whatever a rival wants. Tests whether grudges are a strategy. */
export const antagonist: Strategy = {
  name: "Rival-focused competitor (contest everything)",
  plan: (s, budget) => contractor.plan(s, budget),
  shop: (s) => {
    const out: Command[] = [...handleCrises(s)];
    /* Only the contested ones, and only once there is a practice behind the
       bid — contesting from week one loses every time and wastes the offer. */
    for (const o of s.offers ?? []) {
      out.push(
        o.rivalBid > 0 && established(s)
          ? cmd("acceptContract", o.defId)
          : cmd("declineContract", o.defId),
      );
    }
    out.push(...builder.shop(s));
    return out;
  },
};

/** Standing above all: networking, content, public work, no grey money. */
export const reputable: Strategy = {
  name: "Reputation-focused (standing above all)",
  plan: (s, budget) => {
    const plan = builder.plan(s, budget);
    if (established(s)) {
      swap(plan, "clinic", "network", 1);
      swap(plan, "clinic", "content", 1);
    }
    if ((s.contracts ?? []).length > 0) swap(plan, "clinic", "casework", 1);
    return plan;
  },
  shop: (s) => [
    ...handleCrises(s),
    // Public and research work only. Never the grey money.
    ...takeOffers(s, (kind, risk) => risk < 0.2 && kind !== "grey"),
    ...builder.shop(s),
  ],
};

/** A bit of everything, which is what most players will actually do. */
export const allrounder: Strategy = {
  name: "Balanced (a bit of everything)",
  plan: (s, budget) => {
    const plan = builder.plan(s, budget);
    if ((s.contracts ?? []).length > 0) swap(plan, "clinic", "casework", 1);
    if (established(s)) swap(plan, "clinic", "network", 1);
    return plan;
  },
  shop: (s) => {
    const out: Command[] = [...handleCrises(s)];
    out.push(...takeOffers(s, (_k, risk) => risk < 0.4));
    // One bank facility, once, when there is something to build with it.
    if (
      (s.obligations ?? []).length === 0 &&
      s.week > 30 &&
      med(s).facilities.length >= 2
    ) {
      out.push(cmd("raiseFunds", "bank"));
    }
    out.push(...builder.shop(s));
    return out;
  },
};

export const strategies = [
  grind,
  coast,
  generalist,
  influencer,
  builder,
  marketer,
  academic,
  baller,
  empire,
  magnate,
  epidemiologist,
  // Phase 2.
  conservative,
  borrower,
  manager,
  contractor,
  expander,
  antagonist,
  reputable,
  allrounder,
];
