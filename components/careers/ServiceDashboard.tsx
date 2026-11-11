"use client";

import { useState } from "react";
import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { Stat } from "./Shelf";
import { ChefScene } from "./ChefScene";
import { serviceArt } from "@/lib/ui/chefArt";
import { SERVICE_BY_ID } from "@/lib/game/careers/kitchen";
import { kitchen } from "@/lib/game/careers/chef";
import { bottleneckFix } from "@/lib/game/careers/brigade";
import {
  POLICY_NOTES,
  STATION_BY_ID,
  shapeOf,
  tickLabel,
  type OrderStage,
  type ServiceReport,
} from "@/lib/game/careers/service";

/**
 * THE SERVICE DASHBOARD
 *
 * What happened on the night, tick by tick, and why.
 *
 * ------------------------------------------------------------- a recording
 *
 * This is not a live screen and it is not pretending to be one. The service
 * ran when the week resolved — deterministically, on the run's own seed — and
 * every tick of it was recorded. What the player does here is *step through*
 * it: watch the queues build, see the moment the pass fell behind, and read
 * the station that caused it.
 *
 * That is a deliberate trade. A live service would need a timer, and a timer
 * cannot be paused, saved, reloaded or tested — and this game is played a week
 * at a time on a save that has to survive being closed. A recording can be
 * left and returned to a month later and shows the same night.
 *
 * The decisions are on the same screen, under the report: how the kitchen runs
 * *next* time. That is the management game — the player is not clicking
 * tickets, they are deciding how their brigade behaves when the tickets come.
 */

const STAGES: { id: OrderStage; label: string }[] = [
  { id: "ordered", label: "Ordered" },
  { id: "preparing", label: "Preparing" },
  { id: "cooking", label: "Cooking" },
  { id: "plating", label: "Plating" },
  { id: "served", label: "Served" },
  { id: "walked", label: "Walked out" },
];

export function ServiceDashboard({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const nights = k.lastService?.nights ?? [];
  const [which, setWhich] = useState(0);
  const night = nights[Math.min(which, Math.max(0, nights.length - 1))];

  return (
    <div className="space-y-6">
      {night ? (
        <NightReport
          night={night}
          state={state}
          nights={nights}
          which={which}
          onPick={setWhich}
        />
      ) : (
        <section className="rounded-lg border border-rule bg-card p-4">
          <h2 className="text-sm font-semibold text-ink">The service</h2>
          <p className="mt-1 text-xs text-ink-faint">
            No night has run yet. Put a dish on the menu, buy what it is made
            of, and give a block of the week to a service — the kitchen will
            cook it and every ticket will be recorded here.
          </p>
        </section>
      )}

      <PolicyPanel state={state} onCommand={onCommand} />
    </div>
  );
}

function NightReport({
  night,
  state,
  nights,
  which,
  onPick,
}: {
  night: ServiceReport;
  state: RunState;
  nights: ServiceReport[];
  which: number;
  onPick: (i: number) => void;
}) {
  const k = kitchen(state);
  const sv = SERVICE_BY_ID.get(night.service);
  const shape = sv ? shapeOf(sv) : null;
  /* Which tick the player is looking at. The last one is the end of service,
     which is the sensible place to open. */
  const [tick, setTick] = useState(night.ticks.length - 1);
  const at = night.ticks[Math.min(tick, night.ticks.length - 1)];
  const station = night.bottleneck ? STATION_BY_ID.get(night.bottleneck) : null;

  return (
    <>
      {nights.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {nights.map((n, i) => (
            <button
              key={`${n.service}-${i}`}
              type="button"
              onClick={() => onPick(i)}
              aria-pressed={i === which}
              className={`rounded-form border px-2.5 py-1 text-xs transition ${
                i === which
                  ? "border-chef bg-chef-tint text-ink"
                  : "border-rule text-ink-soft hover:border-chef/60"
              }`}
            >
              {SERVICE_BY_ID.get(n.service)?.label ?? n.service}
            </button>
          ))}
        </div>
      )}

      <ChefScene
        art={serviceArt(night.service)}
        kicker={sv?.label ?? night.service}
        title={`${night.served} served, ${night.walked} walked out`}
        note={
          night.bottleneck
            ? `${station?.label} held the night up. ${night.bottleneckCause}`
            : "Nothing held the night up. The kitchen kept ahead of the room."
        }
        tone={night.satisfaction >= 65 ? "live" : "warning"}
        priority
      >
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat
            label="Satisfaction"
            value={`${night.satisfaction}`}
            tone={night.satisfaction >= 60 ? "good" : "bad"}
          />
          <Stat label="Average wait" value={`${night.averageWait} ticks`} />
          <Stat
            label="Mistakes"
            value={`${night.mistakes}`}
            tone={night.mistakes > night.served * 0.08 ? "bad" : "good"}
          />
          <Stat label="On the plate" value={`${night.quality}`} />
        </dl>
        {shape && (
          <p className="mt-3 border-t border-rule-soft pt-3 text-xs text-ink-faint">
            {shape.expects === "speed"
              ? "A lunch crowd is judging how fast it was, and forgives a plain plate."
              : shape.expects === "presentation"
                ? "A tasting menu is judged on the plate. They will wait; they will not forgive."
                : shape.expects === "delivery"
                  ? "Catering is judged on whether the order was complete and on time."
                  : shape.expects === "contract"
                    ? "A private event paid for a stated number of covers. Everybody eats or it was a failure."
                    : "Dinner is judged on the whole thing: the wait, the plate and the room."}
          </p>
        )}
      </ChefScene>

      {/* ------------------------------------------------ the night, stepped */}
      <section
        aria-labelledby="pipeline-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="pipeline-h" className="text-sm font-semibold text-ink">
            The pass, {tickLabel(at?.tick ?? 0)}
          </h2>
          <span className="text-xs text-ink-faint">
            {at?.served ?? 0} out · longest wait {at?.worstWait ?? 0}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          Every ticket, where it was, and what was holding it. Recorded when the
          week resolved — stepping through it changes nothing.
        </p>

        {/* Tickets at each stage, as bars against the busiest stage. */}
        <ul className="mt-3 space-y-1.5">
          {STAGES.map(({ id, label }) => {
            const count = at?.queues[id] ?? 0;
            const peak = Math.max(
              1,
              ...night.ticks.flatMap((t) =>
                STAGES.map((s) => t.queues[s.id] ?? 0),
              ),
            );
            return (
              <li key={id} className="flex items-center gap-3 text-xs">
                <span className="w-20 shrink-0 text-ink-faint">{label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-rule">
                  <span
                    className={`block h-2 rounded-full ${
                      id === "walked"
                        ? "bg-alarm"
                        : id === "served"
                          ? "bg-good"
                          : "bg-chef"
                    }`}
                    style={{ width: `${Math.round((count / peak) * 100)}%` }}
                  />
                </span>
                <span className="num w-10 shrink-0 text-right text-ink">
                  {count}
                </span>
              </li>
            );
          })}
        </ul>

        {/* The scrubber. A range input so it is draggable, arrow-key operable
            and announced as a slider without any custom key handling. */}
        <label className="mt-4 block">
          <span className="text-xs text-ink-faint">
            Step through the night
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0, night.ticks.length - 1)}
            value={Math.min(tick, night.ticks.length - 1)}
            onChange={(e) => setTick(Number(e.target.value))}
            className="mt-1 w-full accent-chef"
          />
        </label>
        {at?.bottleneck && (
          <p className="mt-1 text-xs text-chef">
            {STATION_BY_ID.get(at.bottleneck)?.label} is behind at this point.
          </p>
        )}
      </section>

      {/* ------------------------------------------------------ the money */}
      <section
        aria-labelledby="night-money-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="night-money-h" className="text-sm font-semibold text-ink">
          What the night made
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat label="Tickets" value={`${night.arrived}`} />
          <Stat label="Revenue" value={money(night.revenue)} />
          <Stat label="Ingredients" value={money(night.ingredientCost)} tone="bad" />
          <Stat
            label="Comped"
            value={night.comped > 0 ? `${night.comped}` : "None"}
            tone={night.comped > 0 ? "bad" : "good"}
          />
        </dl>
        {night.dishes.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-rule-soft pt-3 text-xs">
            {night.dishes.map((dish) => (
              <li
                key={dish.dish}
                className="flex flex-wrap items-baseline justify-between gap-x-3"
              >
                <span className="text-ink">{dish.name}</span>
                <span className="text-ink-faint">
                  {dish.covers} out · plate {Math.round(dish.quality)}
                </span>
                <span className="text-ink">{money(dish.revenue)}</span>
              </li>
            ))}
          </ul>
        )}
        {night.walked > 0 && (
          <p className="mt-3 text-xs text-caution">
            {night.walked} ticket{night.walked === 1 ? "" : "s"} never left the
            kitchen. You bought the food and nobody paid for it.
          </p>
        )}
      </section>

      {/* -------------------------------------------------- what to do next */}
      {night.bottleneck && (
        <section
          aria-labelledby="fix-h"
          className="rounded-lg border border-chef/45 bg-card p-4"
        >
          <h2 id="fix-h" className="text-sm font-semibold text-ink">
            {station?.label} is the bottleneck
          </h2>
          <p className="mt-1 text-xs text-ink-faint">{station?.blurb}</p>
          <p className="mt-2 text-xs text-ink">{night.bottleneckCause}</p>
          <p className="mt-2 rounded border border-rule-soft px-3 py-2 text-xs text-ink">
            <span className="text-ink-faint">The fix: </span>
            {bottleneckFix(night.bottleneck, k)}
          </p>
        </section>
      )}
    </>
  );
}

/**
 * How the kitchen is told to run.
 *
 * Five standing decisions, each with its gain and its cost written on the
 * card. They hold until changed, which is what makes them management rather
 * than reflex — and it is why the screen can be left alone for twenty weeks
 * without the kitchen forgetting how it is supposed to behave.
 */
function PolicyPanel({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const policy = k.service ?? {};

  return (
    <section
      aria-labelledby="policy-h"
      className="rounded-lg border border-rule bg-card p-4"
    >
      <h2 id="policy-h" className="text-sm font-semibold text-ink">
        How the kitchen runs
      </h2>
      <p className="mt-1 text-xs text-ink-faint">
        Set once and held until you change it. Every one of these is a trade —
        there is no setting here that is simply better.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {POLICY_NOTES.map((note) => {
          const on = !!policy[note.id];
          return (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => onCommand("setServicePolicy", note.id)}
                aria-pressed={on}
                className={`w-full rounded border p-3 text-left text-xs transition ${
                  on
                    ? "border-chef bg-chef-tint text-ink"
                    : "border-rule-soft text-ink-faint hover:border-chef/60 hover:text-ink"
                }`}
              >
                <span className="block font-medium text-ink">{note.label}</span>
                <span className="mt-1 block text-good">{note.gain}</span>
                <span className="mt-0.5 block text-caution">{note.cost}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
