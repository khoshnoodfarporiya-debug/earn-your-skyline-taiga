/**
 * DETERMINISTIC BROWSER FIXTURES
 *
 * Saves the end-to-end tests preload into localStorage, written by the real
 * engine so they are always a shape the validator accepts. Nothing here is a
 * hand-built object literal: a fixture that drifts from the save contract
 * would make the browser tests pass while the app was broken.
 *
 * Regenerate with `npm run fixtures`. The output is committed so a test run
 * needs no build step of its own.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { doctor, med } from "../lib/game/careers/doctor";
import {
  advanceWeek,
  resolveEventChoice,
  runCommand,
  startRun,
} from "../lib/game/engine";
import { lawyer, practice } from "../lib/game/careers/lawyer";
import { stageOf, startCrisis } from "../lib/game/crisis";
import { retainerOffersOf } from "../lib/game/careers/casework";
import { EVENT_VISUALS } from "../lib/ui/visuals";
import { postContext } from "../lib/game/medical/phone";
import { POSTS } from "../lib/game/medical/posts";
import type { RunState } from "../lib/game/types";

const OUT = join("e2e", "fixtures");
mkdirSync(OUT, { recursive: true });

const write = (name: string, state: RunState) => {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(state));
  console.log(
    `${name}: week ${state.week}, ${state.outcome ? state.outcome.kind : "in play"}`,
  );
};

const cmd = (s: RunState, c: string, a: string) => runCommand(doctor, s, c, a);

/* ------------------------------------------------- a run part-way through */
{
  let s = startRun(doctor, 21);
  s.r.cash = 500_000;
  s = cmd(s, "enterCity", "madrid");
  s = cmd(s, "buyFacility", "clinic:madrid");
  s = cmd(s, "hire", "nurse");
  s = cmd(s, "openDepartment", "paediatrics");
  for (let i = 0; i < 3; i++) s = advanceWeek(doctor, s, { clinic: 4 }).state;
  write("midrun", s);
}

/* ------------------------------- one week short of the real win condition */
{
  const s = startRun(doctor, 55);
  s.week = 120;
  // The genuine condition: debt cleared AND net worth over the goal.
  s.r.debt = 0;
  s.r.cash = 3_000_000;
  if (s.outcome) throw new Error("fixture must not already carry an outcome");
  write("nearly-won", s);
}

/* --------------------------------- one week short of a serious setback
 *
 * This fixture used to assert the run LOST. Nothing loses any more: the four
 * automatic terminators became recoverable setbacks, so the useful fixture is
 * a run about to fall into one — which gives the browser suite something to
 * drive the recovery interface against.
 *
 * Insolvency rather than burnout: the weekly resolution *reduces* burnout by
 * a couple of points, so a run sitting at 99 recovers faster than a week of
 * clinic can push it. Overdraft has no such counter-force.
 */
{
  const s = startRun(doctor, 55);
  s.week = 60;
  s.r.cash = -59_800; // insolvency begins below -$60,000
  const probe = advanceWeek(doctor, JSON.parse(JSON.stringify(s)), { rest: 4 });
  const fell = (probe.state.setbacks ?? []).some((x) => x.kind === "insolvency");
  if (!fell) {
    throw new Error(
      `nearly-lost fixture does not enter insolvency: cash ${probe.state.r.cash}`,
    );
  }
  if (probe.state.outcome) {
    throw new Error(
      "nearly-lost fixture ENDED the run — the sandbox rule has regressed",
    );
  }
  console.log("  (falls into insolvency, and keeps playing)");
  write("nearly-lost", s);
}

/* ------------------------- the week before an event that carries artwork */
{
  const illustrated = new Set(Object.keys(EVENT_VISUALS));
  let found: RunState | null = null;

  outer: for (let seed = 1; seed <= 80 && !found; seed++) {
    let s = startRun(doctor, seed);
    s.r.cash = 300_000;
    for (let w = 0; w < 60; w++) {
      const before = JSON.parse(JSON.stringify(s)) as RunState;
      const { state, event } = advanceWeek(doctor, s, { rest: 4 });
      if (event && illustrated.has(event.def.id)) {
        console.log(`  (event ${event.def.id} at seed ${seed} week ${before.week})`);
        found = before;
        break outer;
      }
      if (state.outcome) break;
      s = state;
    }
  }
  if (!found) throw new Error("no illustrated event found in 80 seeds");
  write("before-event", found);
}

/* ------------------- a run with something worth posting about and no post
   yet made, so the once-a-week rule can be exercised in a single week */
{
  let s = startRun(doctor, 7);
  s.r.cash = 200_000;
  s = cmd(s, "hire", "nurse");
  s = cmd(s, "openDepartment", "paediatrics");
  s = cmd(s, "buyEquipment", "lab");
  s = advanceWeek(doctor, s, { clinic: 4 }).state;

  const m = med(s);
  if (m.phone.lastPostWeek !== 0) {
    throw new Error("fixture expects no post made yet");
  }
  // The composer is only useful if it has something in it.
  const ctx = postContext(m, { week: s.week, panel: s.r.panel });
  const available = POSTS.filter(
    (p) => p.available(ctx) && !(p.once && m.phone.postsMade.includes(p.id)),
  );
  if (available.length === 0) {
    throw new Error("phone fixture has nothing available to post");
  }
  console.log(`  (${available.length} posts available: ${available.map((p) => p.label).join(", ")})`);
  write("phone-ready", s);
}

/* ------------------------------------------------------------ the Solicitor
 *
 * A practice one week away from a hearing, with money already owed to it.
 *
 * The browser suite needs to press Commit once and watch a court decide
 * something — playing eight weeks of casework through the interface to reach
 * the same place would be a slow test of the commit button rather than a test
 * of the career. It also needs a judgment sitting on the books so the factoring
 * control on the Books screen is reachable.
 *
 * Nothing is hand-edited: this is a real run, played forward by a plain bot
 * until it happens to be in that state, and the candidate is *probed* — a
 * throwaway copy is advanced a week and rejected unless a verdict genuinely
 * lands. A hearing can be relisted, so "the date is next week" is not by
 * itself a promise that anything will be decided, and a fixture that only
 * usually resolves would make the browser test flaky rather than wrong.
 */
{
  let found: RunState | null = null;

  outer: for (let seed = 1; seed <= 240 && !found; seed++) {
    let s = startRun(lawyer, seed);
    for (let w = 0; w < 70; w++) {
      /* Take whatever is on the table that the firm can still carry. */
      for (const offer of [...practice(s).offers]) {
        if (practice(s).cases.length >= 3) break;
        s = runCommand(lawyer, s, "takeCase", offer.id);
      }

      const p = practice(s);
      const due = p.cases.find((c) => c.dueWeek === s.week + 1);
      if (due && (p.bills ?? []).length > 0 && p.offers.length > 0) {
        const probe = advanceWeek(
          lawyer,
          JSON.parse(JSON.stringify(s)) as RunState,
          { casework: 4 },
        );
        const decided = practice(probe.state).lastVerdicts.length >
          p.lastVerdicts.length;
        if (decided && !probe.state.outcome) {
          console.log(
            `  (seed ${seed}, week ${s.week}: ${p.cases.length} live, ${(p.bills ?? []).length} billed, ${p.offers.length} on the table)`,
          );
          found = s;
          break outer;
        }
      }

      const out = advanceWeek(lawyer, s, { casework: 4, pitch: 1, network: 1 });
      s = out.state;
      if (out.event) s = resolveEventChoice(lawyer, s, out.event.def, 0);
      if (s.outcome) break;
    }
  }

  if (!found) {
    throw new Error("no solicitor state found with a hearing next week and a bill on the books");
  }
  write("solicitor-listed", found);
}

/* ------------------------------------------------- a practice mid-crisis
 *
 * A real run, played forward, with a client-account review attached at the
 * point the browser suite needs to see one. Constructed through `startCrisis`
 * rather than written as a literal — the same treatment `nearly-lost` gets,
 * for the same reason: a hand-built object would drift from the save contract
 * and let a browser test pass against a broken app.
 *
 * Waiting for `practiceCrisisRisk` to raise one naturally would work and would
 * make the fixture depend on a die roll, which is the one thing a fixture must
 * not do.
 */
{
  let s = startRun(lawyer, 31);
  for (let w = 0; w < 12; w++) {
    const offer = practice(s).offers[0];
    if (offer) s = runCommand(lawyer, s, "takeCase", offer.id);
    /* Rest in the plan on purpose. Three casework blocks and no rest burns a
       solicitor to 98 in twelve weeks, and the fixture then arrives carrying a
       burnout setback whose panel sits above the crisis — which is a fine
       thing for the game to do and a terrible thing for a fixture about
       crises to be testing. */
    const out = advanceWeek(lawyer, s, { casework: 2, pitch: 1, rest: 2 });
    s = out.state;
    if (out.event) s = resolveEventChoice(lawyer, s, out.event.def, 0);
  }

  /* Enough in hand that every choice on the stage is affordable — the point
     of the fixture is the decision, not the affordability gate, which has its
     own assertions in `npm run check`. */
  s.r.cash = 180_000;
  s.crises = [startCrisis("inspection", s.week, 65, undefined, "lawyer")];

  const stage = stageOf(s.crises[0]);
  if (stage.choices.length < 2) {
    throw new Error("crisis fixture has nothing to decide");
  }
  if ((s.setbacks ?? []).length > 0) {
    throw new Error(
      `crisis fixture is also in a setback (${(s.setbacks ?? []).map((x) => x.kind).join(", ")})`,
    );
  }
  if (s.outcome) throw new Error("crisis fixture must not carry an outcome");
  console.log(`  (${stage.choices.length} choices on "${stage.title}")`);
  write("solicitor-crisis", s);
}

/* ------------------------------------------- a practice offered a retainer
 *
 * Played forward by a plain bot until somebody asks to put it on a standing
 * arrangement. Retainer offers only come from clients you have actually acted
 * for and only once your standing warrants one, so this is a real run rather
 * than a constructed state — and the browser suite needs the decision itself,
 * which is on the Instructions screen.
 */
{
  let found: RunState | null = null;
  outer: for (let seed = 1; seed <= 120 && !found; seed++) {
    let s = startRun(lawyer, seed);
    for (let w = 0; w < 80; w++) {
      for (const offer of [...practice(s).offers]) {
        if (practice(s).cases.length >= 3) break;
        s = runCommand(lawyer, s, "takeCase", offer.id);
      }
      if (retainerOffersOf(practice(s)).length > 0) {
        console.log(
          `  (seed ${seed}, week ${s.week}: ${retainerOffersOf(practice(s))[0].kind} offered by ${retainerOffersOf(practice(s))[0].client})`,
        );
        found = s;
        break outer;
      }
      const out = advanceWeek(lawyer, s, { casework: 2, pitch: 1, rest: 2 });
      s = out.state;
      if (out.event) s = resolveEventChoice(lawyer, s, out.event.def, 0);
      if (s.outcome) break;
    }
  }
  if (!found) throw new Error("no practice was ever offered a retainer");
  found.r.cash = 60_000;
  write("solicitor-retainer", found);
}
