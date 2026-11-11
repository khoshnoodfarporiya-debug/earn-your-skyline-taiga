/**
 * Balance harness. Plays the Physician career to completion under fixed
 * strategies and checks the design's claims hold:
 *
 *   1. Grinding alone must LOSE — one person cannot outwork an organisation.
 *   2. Resting alone must LOSE — the bills do not stop.
 *   3. Buying capacity without opening new medicine must FALL SHORT.
 *   4. Following the caseload signal must be able to WIN.
 *
 * Claim 3 is the important one: it is what makes the medical layer a game
 * rather than decoration.
 *
 * Run: npx tsx scripts/balance.ts
 */

import { capacityOf, doctor, med, netWorth } from "../lib/game/careers/doctor";
import {
  advanceWeek,
  resolveEventChoice,
  runCommand,
  startRun,
} from "../lib/game/engine";
import { canAfford, strategies, type Strategy } from "./strategy";
import { hasMilestone } from "../lib/game/timeline";
import { SETBACK_LABEL } from "../lib/game/setbacks";

/**
 * The horizon.
 *
 * The game no longer ends, so a run has to be *stopped* to be measured. 156
 * weeks is the old week limit, chosen deliberately: every balance figure in
 * the README was produced under it, so the numbers stay comparable across the
 * change that removed it.
 */
const HORIZON = 156;

/**
 * What "success" means now that nothing wins.
 *
 * The old measure was `outcome.kind === "won"`, which the sandbox change
 * deleted — and with it, briefly, every figure in the harness went to zero.
 * The replacement is the milestone that *used* to be the win: debt cleared and
 * the practice worth the goal. Same threshold, same meaning, no ending.
 */
const REACHED = "the-hospital-is-yours";

/**
 * What one run did, beyond whether it got there.
 *
 * A pass/fail rate says a strategy is losing; it never says why. These are the
 * numbers that separate "the economy is too hard" from "the bot plays badly"
 * from "the money is going somewhere nobody intended".
 */
/**
 * A ledger label, reduced to the thing it is an instance of.
 *
 * Several labels carry the week's own numbers — "Treated 15 of 21 cases" — so
 * summing by raw label produces one bucket per week and a "top expenses" list
 * of three arbitrary Tuesdays. Stripping the digits is what makes the totals
 * mean anything.
 */
const category = (label: string) =>
  label
    .replace(/\d[\d,.]*/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+of\s+cases/i, " cases")
    .trim();

interface Trace {
  reachedWeek: number | null;
  /** Week the first setback began, or null if the run never tripped one. */
  troubleWeek: number | null;
  /** Cash at the moment trouble began — the balance that failed to absorb it. */
  cashAtTrouble: number | null;
  /** Money in, by ledger label, summed over the run. */
  income: Record<string, number>;
  /** Money out, by ledger label. */
  expense: Record<string, number>;
  /** Interest specifically, since it compounds and hides inside "expense". */
  interestPaid: number;
  /** Capacity the practice had but did not use, summed weekly. */
  idleCapacity: number;
  /** Capacity the practice used. */
  usedCapacity: number;
  /** Patients who arrived and were not treated. */
  turnedAway: number;
  arrived: number;
  /** Week of the first hire and the first department beyond the starting one. */
  firstHireWeek: number | null;
  firstDeptWeek: number | null;
  firstSiteWeek: number | null;
  /** Weeks spent carrying at least one setback. */
  weeksInTrouble: number;
  /** Weeks the run was cash-negative. */
  weeksOverdrawn: number;
  /** Lowest cash the run ever saw. */
  troughCash: number;
}

/**
 * Which market the bots practise in.
 *
 * `npm run balance -- 40 --city=lagos` re-runs the whole table from a
 * different start. Absent, it is Lyon — every published figure was measured
 * there and must stay comparable.
 */
const CITY =
  process.argv.find((a) => a.startsWith("--city="))?.slice("--city=".length) ??
  undefined;

function play(strategy: Strategy, seed: number) {
  let s = startRun(doctor, seed, { city: CITY });
  /* The week the goal was first reached, or null. Recorded rather than
     inferred, because the run keeps going afterwards and the state at the
     horizon no longer tells you when it happened. */
  let reachedWeek: number | null = null;

  const t: Trace = {
    reachedWeek: null,
    troubleWeek: null,
    cashAtTrouble: null,
    income: {},
    expense: {},
    interestPaid: 0,
    idleCapacity: 0,
    usedCapacity: 0,
    turnedAway: 0,
    arrived: 0,
    firstHireWeek: null,
    firstDeptWeek: null,
    firstSiteWeek: null,
    weeksInTrouble: 0,
    weeksOverdrawn: 0,
    troughCash: Infinity,
  };
  const startingDepts = med(s).departments.length;
  const startingSites = med(s).facilities.length;

  for (let i = 0; i < HORIZON; i++) {
    /*
     * Each command is attempted independently: one unaffordable purchase must
     * not mask the ones listed after it. `canAfford` is asked against the state
     * as it stands at that moment, so money spent earlier in the week is gone
     * and money *raised* earlier in the week is available — which is what a
     * player is forced to do and what the strategies were not doing.
     */
    for (const c of strategy.shop(s)) {
      if (!canAfford(s, c)) continue;
      s = runCommand(doctor, s, c.cmd, c.arg);
    }

    const budget = doctor.timeBudget(s);
    const plan = strategy.plan(s, budget);
    /* Capacity the week was about to have, before it is spent. The gap
       between this and what the caseload consumed is idle capacity — staff
       and rooms paid for and not used. */
    const cap = capacityOf(s, plan.clinic ?? 0).effective;
    const result = advanceWeek(doctor, s, plan);
    s = result.state;

    // Always takes the first option, so this measures a floor not a ceiling.
    if (result.event) {
      s = resolveEventChoice(doctor, s, result.event.def, 0);
    }

    for (const line of result.ledger) {
      if (line.amount === undefined) continue;
      const key = category(line.label);
      if (line.amount > 0) {
        t.income[key] = (t.income[key] ?? 0) + line.amount;
      } else if (line.amount < 0) {
        t.expense[key] = (t.expense[key] ?? 0) - line.amount;
        if (/interest/i.test(key)) t.interestPaid += -line.amount;
      }
    }

    const m = med(s);
    const treated = m.lastCases.reduce((n, c) => n + c.treated, 0);
    const arrived = m.lastCases.reduce((n, c) => n + c.arrived, 0);
    t.arrived += arrived;
    t.turnedAway += arrived - treated;
    t.usedCapacity += Math.min(cap, treated);
    t.idleCapacity += Math.max(0, cap - treated);

    if (t.firstHireWeek === null && m.staff.length > 0) t.firstHireWeek = s.week;
    if (t.firstDeptWeek === null && m.departments.length > startingDepts) {
      t.firstDeptWeek = s.week;
    }
    if (t.firstSiteWeek === null && m.facilities.length > startingSites) {
      t.firstSiteWeek = s.week;
    }

    const setbacks = s.setbacks ?? [];
    if (setbacks.length > 0) {
      t.weeksInTrouble++;
      if (t.troubleWeek === null) {
        t.troubleWeek = s.week;
        t.cashAtTrouble = s.r.cash;
      }
    }
    if (s.r.cash < 0) t.weeksOverdrawn++;
    t.troughCash = Math.min(t.troughCash, s.r.cash);

    if (reachedWeek === null && hasMilestone(s, REACHED)) reachedWeek = s.week;
  }
  t.reachedWeek = reachedWeek;
  return { state: s, reachedWeek, trace: t };
}

/**
 * Seeds per strategy. 40 is a fast default for iterating; pass a larger
 * number to separate signal from sampling noise:
 *
 *   npm run balance -- 200
 *
 * At 40 seeds the standard error on a ~65% rate is about 7.5 points, so
 * mid-table gaps under ~15 points mean nothing. At 200 it falls to ~3.4.
 */
const RUNS = Math.max(1, Number(process.argv[2]) || 40);
/** 95% confidence half-width for a rate p over n runs, in percentage points. */
const margin = (wins: number, n: number) => {
  const p = wins / n;
  return 1.96 * Math.sqrt((p * (1 - p)) / n) * 100;
};

console.log(
  `\nPhysician — ${RUNS} runs per strategy, from ${CITY ?? "lyon"}\n${"─".repeat(70)}`,
);

for (const strategy of strategies) {
  let wins = 0;
  const endWeeks: number[] = [];
  const worths: number[] = [];
  const depts: number[] = [];
  const staff: number[] = [];
  const causes: Record<string, number> = {};

  const traces: Trace[] = [];

  for (let i = 0; i < RUNS; i++) {
    const { state: s, reachedWeek, trace } = play(strategy, 1000 + i * 37);
    traces.push(trace);
    if (reachedWeek !== null) {
      wins++;
      endWeeks.push(reachedWeek);
    }
    /* What the run was carrying at the horizon. A setback is no longer an
       ending, so this is a snapshot of trouble rather than a cause of death —
       and "clear" is now a real and common answer. */
    const carrying =
      (s.setbacks ?? []).map((x) => SETBACK_LABEL[x.kind]).join(" + ") || "clear";
    causes[carrying] = (causes[carrying] ?? 0) + 1;
    worths.push(netWorth(s));
    depts.push(med(s).departments.length);
    staff.push(med(s).staff.length);
  }

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(`\n${strategy.name}`);
  console.log(
    `  reached goal  ${((wins / RUNS) * 100).toFixed(0)}% ±${margin(wins, RUNS).toFixed(1)}`,
  );
  console.log(
    `  avg week      ${endWeeks.length ? avg(endWeeks).toFixed(0) : "—"} (when reached)`,
  );
  console.log(
    `  avg net worth $${Math.round(avg(worths)).toLocaleString("en-US")}`,
  );
  console.log(
    `  built         ${avg(depts).toFixed(1)} departments, ${avg(staff).toFixed(1)} staff`,
  );
  console.log(
    `  at week ${HORIZON}   ${Object.entries(causes)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ×${v}`)
      .join(", ")}`,
  );

  /* ------------------------------------------------------- diagnostics */
  const sum = (pick: (t: Trace) => number) => traces.reduce((n, t) => n + pick(t), 0);
  const mean = (pick: (t: Trace) => number) => sum(pick) / traces.length;
  const meanOf = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

  const troubled = traces.filter((t) => t.troubleWeek !== null);
  const firstTrouble = meanOf(troubled.map((t) => t.troubleWeek!));
  const cashAt = meanOf(troubled.map((t) => t.cashAtTrouble!));
  console.log(
    `  first setback ${
      firstTrouble === null
        ? "never"
        : `wk ${firstTrouble.toFixed(0)} in ${troubled.length}/${RUNS} runs · ${money(cashAt ?? 0)} in hand at the time`
    }`,
  );
  console.log(
    `  cash          trough ${money(mean((t) => t.troughCash))} · ${mean((t) => t.weeksOverdrawn).toFixed(0)} wks overdrawn · ${mean((t) => t.weeksInTrouble).toFixed(0)} wks in a setback`,
  );

  const top = (rec: Record<string, number>, n: number) =>
    Object.entries(rec)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `${k} ${money(v / RUNS)}`)
      .join(" · ");
  const merged = (pick: (t: Trace) => Record<string, number>) => {
    const out: Record<string, number> = {};
    for (const t of traces) {
      for (const [k, v] of Object.entries(pick(t))) out[k] = (out[k] ?? 0) + v;
    }
    return out;
  };
  console.log(`  revenue       ${top(merged((t) => t.income), 3) || "none"}`);
  console.log(`  expenses      ${top(merged((t) => t.expense), 4) || "none"}`);
  console.log(
    `  interest      ${money(mean((t) => t.interestPaid))} paid over the run`,
  );

  const arrived = sum((t) => t.arrived);
  const away = sum((t) => t.turnedAway);
  const idle = sum((t) => t.idleCapacity);
  const used = sum((t) => t.usedCapacity);
  console.log(
    `  caseload      ${Math.round(arrived / RUNS)} arrived · ${((away / Math.max(1, arrived)) * 100).toFixed(0)}% turned away`,
  );
  console.log(
    `  capacity      ${((idle / Math.max(1, idle + used)) * 100).toFixed(0)}% idle`,
  );

  const wk = (pick: (t: Trace) => number | null) => {
    const xs = traces.map(pick).filter((x): x is number => x !== null);
    return xs.length
      ? `wk ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(0)} (${xs.length}/${RUNS})`
      : "never";
  };
  console.log(
    `  first moves   hire ${wk((t) => t.firstHireWeek)} · dept ${wk((t) => t.firstDeptWeek)} · site ${wk((t) => t.firstSiteWeek)}`,
  );
}
console.log("");
