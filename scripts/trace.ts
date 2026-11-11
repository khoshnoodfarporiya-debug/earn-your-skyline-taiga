/**
 * Week-by-week trace of one run, so a broken economy shows where it breaks.
 *
 * Run: npx tsx scripts/trace.ts [strategy] [seed]
 */

import { doctor, med, netWorth, weeklyCosts } from "../lib/game/careers/doctor";
import {
  advanceWeek,
  resolveEventChoice,
  runCommand,
  startRun,
} from "../lib/game/engine";
import { computeCapacity } from "../lib/game/medical/sim";
import { cityOf } from "../lib/game/medical/cities";
import { strategies } from "./strategy";

const wanted = (process.argv[2] ?? "builder").toLowerCase();
const strategy =
  strategies.find((st) => st.name.toLowerCase().startsWith(wanted)) ??
  strategies[strategies.length - 1];
const seed = Number(process.argv[3] ?? 4242);

let s = startRun(doctor, seed);
const pad = (v: string | number, n: number) => String(v).padStart(n);

console.log(`\n${strategy.name} · seed ${seed}`);
console.log(
  "\nwk  cash      debt    panel  cap  used dept staff eq burn  rep skill risk   net/wk",
);
console.log("─".repeat(88));

let lastCash = s.r.cash;
while (!s.outcome && s.week <= 160) {
  for (const c of strategy.shop(s)) {
    s = runCommand(doctor, s, c.cmd, c.arg);
  }
  const budget = doctor.timeBudget(s);
  const alloc = strategy.plan(s, budget);
  const m = med(s);
  const cap = computeCapacity(m, alloc.clinic ?? 0, s.r.skill, s.r.burnout);

  const result = advanceWeek(doctor, s, alloc);
  s = result.state;
  if (result.event && !s.outcome) {
    s = resolveEventChoice(doctor, s, result.event.def, 0);
  }

  if (s.week % 8 === 1 || s.outcome) {
    const mm = med(s);
    const used = mm.lastCases.reduce((sum, c) => sum + c.treated, 0);
    const arrived = mm.lastCases.reduce((sum, c) => sum + c.arrived, 0);
    console.log(
      [
        pad(s.week, 3),
        pad(Math.round(s.r.cash), 9),
        pad(Math.round(s.r.debt), 8),
        pad(Math.round(s.r.panel), 6),
        pad(Math.round(cap.effective), 5),
        pad(`${used}/${arrived}`, 6),
        pad(mm.departments.length, 4),
        pad(mm.staff.length, 5),
        pad(mm.equipment.length, 3),
        pad(Math.round(s.r.burnout), 4),
        pad(Math.round(s.r.reputation), 4),
        pad(Math.round(s.r.skill), 5),
        pad(Math.round(s.r.risk), 4),
        pad(Math.round(s.r.cash - lastCash), 8),
      ].join(" "),
    );
  }
  lastCash = s.r.cash;
}

const m = med(s);
console.log(
  `\nended week ${s.week}: ${s.outcome?.title ?? "—"} · net worth $${Math.round(netWorth(s)).toLocaleString("en-US")}`,
);
console.log(
  `costs $${Math.round(weeklyCosts(s)).toLocaleString("en-US")}/wk · departments: ${m.departments.join(", ")}`,
);
console.log(`equipment: ${m.equipment.join(", ") || "none"}`);
console.log(
  `cities: ${m.lastCityReports
    .map(
      (r) =>
        `${cityOf(r.city).name} (${Math.round(r.panel)} panel, $${Math.round(r.revenue).toLocaleString("en-US")}/wk)`,
    )
    .join(" · ")}\n`,
);
