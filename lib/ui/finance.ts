import type { RunState } from "../game/types";
import { LOAN_RATE, med } from "../game/careers/doctor";
import { payroll, weeklyUpkeep } from "../game/medical/sim";
import { marketingSpend } from "../game/medical/marketing";
import { lifestyleUpkeep } from "../game/medical/lifestyle";
import { obligations, totalOutstanding, weeklyDebtService } from "../game/finance";
import { setbackEffects } from "../game/setbacks";
import type { ScreenId } from "./navigation";

/**
 * WHERE THE MONEY GOES, EVERY WEEK
 *
 * A waterfall rather than a balance: the useful question is not "how much cash
 * do I have" — the strip at the top of the Overview answers that — but "what
 * is the shape of a normal week, and which line is eating it".
 *
 * ---------------------------------------------------------- what is measured
 *
 * Standing weekly figures, not a replay of one committed week. Every line here
 * is what the practice costs *as it currently stands*: payroll at today's
 * headcount, upkeep on today's estate, consumables at last week's draw rate.
 *
 * The one backward-looking line is clinical revenue, because there is no such
 * thing as a forward-looking one — it depends on who walks through the door.
 * It is labelled as last week's, and the runway calculation says so.
 *
 * That choice is what makes the runway honest. Replaying a single ledger would
 * make a week that happened to carry a one-off equipment purchase look like a
 * practice burning £40,000 a week, and the "seven weeks of cash" sentence
 * beneath it would be nonsense.
 *
 * ------------------------------------------------------------------ not here
 *
 * Crisis costs and contract payouts are one-off transactions rather than a
 * weekly rate, so they appear as upcoming obligations rather than as lines in
 * the waterfall. Putting an irregular payment into a per-week average is how
 * you get a runway figure that is wrong in both directions.
 */

export interface FlowLine {
  id: string;
  label: string;
  /** Positive for income, negative for cost. */
  amount: number;
  /** What this is, and what changes it. */
  detail: string;
  /** Fixed costs are charged whatever happens; variable ones track activity. */
  nature: "income" | "fixed" | "variable";
  destination?: ScreenId;
}

export interface WeeklyFinance {
  income: FlowLine[];
  costs: FlowLine[];
  totalIncome: number;
  totalCost: number;
  net: number;
  /** Costs charged whether or not you treat anybody. */
  fixed: number;
  variable: number;
  /** Weeks of cash at the current net burn. Infinity when profitable. */
  runwayWeeks: number;
  /** One sentence, always present, never only a chart. */
  summary: string;
  /** What is owed and when. */
  upcoming: { label: string; amount: number; when: string; urgent: boolean }[];
  /** What a week of profit would buy, so expansion is a decision not a guess. */
  affordability: { label: string; weeks: number; cost: number }[];
}

export function weeklyFinance(state: RunState): WeeklyFinance {
  const m = med(state);
  const sb = setbackEffects(state.setbacks ?? []);

  /* Revenue is reported after the setback haircut, because that is what
     actually landed in the account — showing the gross would make the
     waterfall disagree with the cash line beside it. */
  const revenue = Math.max(0, state.r._lastRevenue ?? 0);

  const income: FlowLine[] = [
    {
      id: "clinical",
      label: "Clinical revenue",
      amount: revenue,
      detail:
        sb.income < 1
          ? `What last week's treated cases billed, after the ${Math.round((1 - sb.income) * 100)}% creditors are taking.`
          : "What last week's treated cases billed. Rises with capacity, panel and fee index.",
      nature: "income",
      destination: "caseload",
    },
  ];

  const upkeep = weeklyUpkeep(m);
  const wages = payroll(m);
  const campaigns = marketingSpend(m);
  const living = lifestyleUpkeep(m);
  const consumables = m.supplies.lastConsumption;
  const studentInterest = state.r.debt * LOAN_RATE;
  const facilityService = weeklyDebtService(state);

  const costs: FlowLine[] = [
    {
      id: "payroll",
      label: "Payroll",
      amount: -wages,
      detail: `${m.staff.length} on staff, adjusted for what wages cost in the cities you operate in.`,
      nature: "fixed",
      destination: "staff",
    },
    {
      id: "premises",
      label: "Premises, departments & equipment",
      amount: -upkeep,
      detail: `${m.facilities.length} site${m.facilities.length === 1 ? "" : "s"}, ${m.departments.length} department${m.departments.length === 1 ? "" : "s"}, ${m.equipment.length} machine${m.equipment.length === 1 ? "" : "s"}. Charged in a quiet week too.`,
      nature: "fixed",
      destination: "build",
    },
    {
      id: "supplies",
      label: "Consumables",
      amount: -consumables,
      detail:
        "Drawn from stock at the rate last week's treated cases burned. The only major cost that falls when you treat fewer people.",
      nature: "variable",
      destination: "supplies",
    },
    {
      id: "student",
      label: "Student loan interest",
      amount: -studentInterest,
      detail: `${(LOAN_RATE * 5200).toFixed(1)}% a year on ${money0(state.r.debt)}. It compounds until the balance is cleared.`,
      nature: "fixed",
      destination: "money",
    },
    {
      id: "facilities",
      label: "Borrowing",
      amount: -facilityService,
      detail: `Interest on ${money0(totalOutstanding(state))} of outstanding facilities.`,
      nature: "fixed",
      destination: "money",
    },
    {
      id: "campaigns",
      label: "Campaigns",
      amount: -campaigns,
      detail: "Marketing you are currently running. Stops the week you stop it.",
      nature: "variable",
      destination: "growth",
    },
    {
      id: "living",
      label: "How you live",
      amount: -living,
      detail: "Homes, cars and everything else you have bought yourself.",
      nature: "variable",
      destination: "life",
    },
  ].filter((l) => Math.abs(l.amount) >= 0.5) as FlowLine[];

  const totalIncome = income.reduce((n, l) => n + l.amount, 0);
  const totalCost = costs.reduce((n, l) => n + l.amount, 0);
  const net = totalIncome + totalCost;
  const fixed = -costs
    .filter((l) => l.nature === "fixed")
    .reduce((n, l) => n + l.amount, 0);
  const variable = -costs
    .filter((l) => l.nature === "variable")
    .reduce((n, l) => n + l.amount, 0);

  const burn = net < 0 ? -net : 0;
  const runwayWeeks = burn > 0 ? state.r.cash / burn : Infinity;

  const summary =
    net >= 0
      ? `At last week's takings the practice makes ${money0(net)} a week. Fixed costs of ${money0(fixed)} are covered ${(totalIncome / Math.max(1, fixed)).toFixed(1)} times over.`
      : state.r.cash <= 0
        ? `You are overdrawn and losing ${money0(burn)} a week. Cutting a fixed cost is the only thing that changes this.`
        : `At the current burn rate, available cash covers approximately ${Math.floor(runwayWeeks)} more week${Math.floor(runwayWeeks) === 1 ? "" : "s"}.`;

  // ------------------------------------------------------------- upcoming
  const upcoming: WeeklyFinance["upcoming"] = [];
  for (const o of obligations(state)) {
    if (o.outstanding <= 0) continue;
    const due = o.dueWeek;
    upcoming.push({
      label: o.condition ?? "Repayable facility",
      amount: o.outstanding,
      when:
        due === undefined
          ? "No fixed date"
          : due <= state.week
            ? "Overdue"
            : `Week ${due} — ${due - state.week} week${due - state.week === 1 ? "" : "s"}`,
      urgent: due !== undefined && due - state.week <= 8,
    });
  }

  // -------------------------------------------------------- affordability
  const weeksTo = (cost: number) =>
    net > 0 ? Math.ceil(Math.max(0, cost - state.r.cash) / net) : Infinity;
  const affordability = [
    { label: "A nurse", cost: 2_200 },
    { label: "A community clinic", cost: 34_000 },
    { label: "A medical centre", cost: 185_000 },
    { label: "A regional hospital", cost: 520_000 },
  ].map((x) => ({ ...x, weeks: weeksTo(x.cost) }));

  return {
    income,
    costs,
    totalIncome,
    totalCost,
    net,
    fixed,
    variable,
    runwayWeeks,
    summary,
    upcoming,
    affordability,
  };
}

/** Whole pounds, for prose. `money` from format is for figures in tables. */
const money0 = (n: number) =>
  `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
