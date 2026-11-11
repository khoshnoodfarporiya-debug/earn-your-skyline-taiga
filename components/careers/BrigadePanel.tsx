"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import {
  ROLE_BY_ID,
  SERVICE_BY_ID,
  activeMenu,
  loyaltyOf,
  moraleOf,
  premisesOf,
} from "@/lib/game/careers/kitchen";
import { kitchen, localSum } from "@/lib/game/careers/chef";
import {
  TRAINING_COST,
  currentSkill,
  experienceOf,
  fatigueOf,
  isBurntOut,
  isResting,
  promotionFor,
  readyOf,
  stationLoads,
  staffingWarnings,
  trainingOf,
  traitsOf,
} from "@/lib/game/careers/brigade";
import { STATION_BY_ID } from "@/lib/game/careers/service";

/**
 * THE BRIGADE, IN DEPTH
 *
 * Phase 1's roster was a list of salaries with morale attached. This is the
 * screen where a *position* means something: who is standing at which station,
 * how much of them is turning up tonight, and which of the six sections will
 * fail first if nothing changes.
 *
 * The rule the layout was written to: a warning must name the person or the
 * station, and offer the thing that fixes it. "Understaffed" is not
 * actionable; "nobody is on the pass but you, and a sous chef runs the pass"
 * is.
 */

/** Fatigue as a word. A number out of a hundred is not a decision. */
function tiredness(x: number): { word: string; cls: string } {
  if (x >= 70) return { word: "Running on empty", cls: "text-alarm" };
  if (x >= 45) return { word: "Tired", cls: "text-chef" };
  if (x >= 20) return { word: "Feeling it", cls: "text-ink-soft" };
  return { word: "Fresh", cls: "text-good" };
}

export function BrigadePanel({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const week = state.week;
  /* The stations as they would stand for the busiest service this kitchen can
     run, which is the one worth being ready for. */
  const sv =
    SERVICE_BY_ID.get(k.lastService?.lines?.[0]?.id ?? "dinner") ??
    SERVICE_BY_ID.get("dinner")!;
  const loads = stationLoads(k, sv, k.service ?? {}, state.r.skill, week);
  const warnings = staffingWarnings(k, sv, k.service ?? {}, state.r.skill, week);
  const menuIsOn = activeMenu(k).length > 0;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------ the sections */}
      <section
        aria-labelledby="stations-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="stations-h" className="text-sm font-semibold text-ink">
          The sections
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          What each part of the kitchen can move in a quarter of an hour, for a{" "}
          {sv.label.toLowerCase()}. The smallest number is the one that decides
          your night.
          {!menuIsOn &&
            " Nothing is on the menu yet, so tickets are not being cooked — put a dish on and these start to bite."}
        </p>
        <ul className="mt-3 space-y-2">
          {loads.map((load) => {
            const station = STATION_BY_ID.get(load.station);
            const thin = load.capacity <= 2;
            const peak = Math.max(...loads.map((l) => l.capacity), 1);
            return (
              <li
                key={load.station}
                className={`rounded border px-3 py-2 text-xs ${
                  thin ? "border-chef/40" : "border-rule-soft"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium text-ink">{station?.label}</span>
                  <span className={thin ? "text-chef" : "text-ink-faint"}>
                    {load.capacity} tickets a quarter-hour
                  </span>
                </div>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-rule">
                  <span
                    className={`block h-1.5 rounded-full ${thin ? "bg-chef" : "bg-good"}`}
                    style={{ width: `${Math.round((load.capacity / peak) * 100)}%` }}
                  />
                </span>
                <p className="mt-1 text-ink-faint">{load.cause}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* -------------------------------------------------------- warnings */}
      {warnings.length > 0 && (
        <section
          aria-labelledby="warn-h"
          className="rounded-lg border border-chef/45 bg-card p-4"
        >
          <h2 id="warn-h" className="text-sm font-semibold text-ink">
            Where this kitchen will fail first
          </h2>
          <ul className="mt-2 space-y-2">
            {warnings.map((w) => (
              <li key={w.station} className="text-xs">
                <p className="text-ink">
                  <span className="font-medium">
                    {STATION_BY_ID.get(w.station)?.label}
                  </span>{" "}
                  — {w.why}
                </p>
                <p className="mt-0.5 text-ink-faint">{w.fix}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------------------------------------------------- people */}
      <section
        aria-labelledby="people-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="people-h" className="text-sm font-semibold text-ink">
          Your people
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Skill is what they can do, morale how much of it they want to give,
          and fatigue how much of it is left. A week off clears the third and
          costs you the week.
        </p>

        {k.staff.length === 0 ? (
          <p className="mt-3 rounded border border-dashed border-rule px-3 py-4 text-center text-xs text-ink-faint">
            Nobody but you — every station is yours, and the pass is where you
            will fall behind first.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {k.staff.map((person) => {
              const role = ROLE_BY_ID.get(person.role);
              const resting = isResting(person, week);
              const tired = tiredness(fatigueOf(person));
              const up = promotionFor(person);
              const train = localSum(state, TRAINING_COST);
              const traits = traitsOf(person);
              return (
                <li
                  key={person.id}
                  className={`rounded border px-3 py-2.5 text-xs ${
                    isBurntOut(person) || loyaltyOf(person) < 35
                      ? "border-alarm/45"
                      : resting
                        ? "border-rule-soft opacity-75"
                        : "border-rule-soft"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium text-ink">
                      {person.name}
                      {resting && (
                        <span className="ml-2 text-ink-faint">— off this week</span>
                      )}
                    </span>
                    <span className="text-ink-faint">
                      {role?.label ?? person.role} · {money(person.salary)}/wk
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-ink-faint">
                    <span>
                      Skill <span className="text-ink">{currentSkill(person)}</span>
                    </span>
                    <span>
                      Morale{" "}
                      <span
                        className={moraleOf(person) < 40 ? "text-alarm" : "text-ink"}
                      >
                        {moraleOf(person)}
                      </span>
                    </span>
                    <span>
                      Loyalty{" "}
                      <span
                        className={loyaltyOf(person) < 35 ? "text-alarm" : "text-ink"}
                      >
                        {loyaltyOf(person)}
                      </span>
                    </span>
                    <span>
                      Fatigue <span className={tired.cls}>{tired.word}</span>
                    </span>
                    <span>
                      Turning up{" "}
                      <span className="text-ink">
                        {Math.round(readyOf(person) * 100)}%
                      </span>
                    </span>
                  </div>

                  {traits.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {traits.map((t) => (
                        <li
                          key={t.id}
                          className={t.good ? "text-ink-soft" : "text-caution"}
                        >
                          <span className="font-medium">{t.label}</span> —{" "}
                          {t.effect}
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="mt-1 text-ink-faint">
                    {experienceOf(person)} services worked
                    {trainingOf(person) > 0
                      ? ` · ${trainingOf(person)}% towards the next skill point`
                      : ""}
                  </p>

                  {isBurntOut(person) && !resting && (
                    <p className="mt-1 text-alarm">
                      Running on empty. They will start making mistakes, and
                      then they will start looking elsewhere.
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={resting}
                      onClick={() => onCommand("restStaff", person.id)}
                      className="rounded border border-rule px-2.5 py-1 text-ink transition enabled:hover:border-chef disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {resting ? "Off this week" : "Give them the week"}
                    </button>
                    <button
                      type="button"
                      disabled={state.r.cash < train}
                      onClick={() => onCommand("trainStaff", person.id)}
                      className="rounded border border-rule-soft px-2.5 py-1 text-ink-soft transition enabled:hover:border-chef enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Train · {money(train)}
                    </button>
                    {up && (
                      <button
                        type="button"
                        onClick={() => onCommand("promoteStaff", person.id)}
                        className="rounded border border-chef/60 px-2.5 py-1 text-chef transition hover:bg-chef-tint"
                      >
                        Make them {up.label.toLowerCase()}
                      </button>
                    )}
                  </div>
                  {up && (
                    <p className="mt-1 text-ink-faint">
                      Earned it: {experienceOf(person)} services on the line.
                      The wage goes to {money(localSum(state, up.salary))} a week.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 border-t border-rule-soft pt-3 text-xs text-ink-faint">
          {money(
            k.staff.reduce((n, x) => n + x.salary, 0),
          )}{" "}
          a week in wages · room seats {Math.round(premisesOf(k).capacity / 2)} a
          service
        </p>
      </section>
    </div>
  );
}
