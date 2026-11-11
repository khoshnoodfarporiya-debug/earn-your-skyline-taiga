"use client";

import type { RunState } from "@/lib/game/types";
import { kitchen } from "@/lib/game/careers/chef";
import { cityOf } from "@/lib/game/careers/kitchen";
import { seasonOf, bestDishFor, topWant, whySegment } from "@/lib/game/careers/diners";
import { sceneFor } from "@/lib/game/careers/scene";
import {
  PRICE_LABEL,
  STRATEGY_BY_ID,
  cityRank,
  openingAgainst,
  rivalsFor,
} from "@/lib/game/careers/competitors";
import { sceneScore, STANDING_BY_ID } from "@/lib/game/careers/standing";
import { CRITICS } from "@/lib/game/careers/critics";

/**
 * THE SCENE
 *
 * Who eats out in this city, what the season is doing to them, and the three
 * restaurants competing for the same tables.
 *
 * It sits under Map rather than under Kitchen because everything on it is a
 * property of *where you are* rather than of what you cook. Move the same
 * restaurant to Mumbai and every number on this screen changes; that is the
 * point of it existing.
 *
 * Nothing here is a control. It is the briefing you read before deciding what
 * to put on the menu and what to charge for it, and every line ends in
 * something the player can act on — a segment to chase, a rival's weakness, a
 * critic's taste.
 */
export function SceneScreen({ state }: { state: RunState }) {
  const k = kitchen(state);
  const city = cityOf(k);
  const season = seasonOf(state.week);
  /* Read, never written: the screen must not create the rivals as a side
     effect of being opened. A run that has not resolved a week yet sees the
     city's opening line-up computed the same way the simulation will. */
  const rivals = k.rivals ?? rivalsFor(city.id, state.week);
  const scene = sceneFor(k, state.r.reputation, state.week);
  const rank = cityRank(k, sceneScore(k, state.r.reputation));

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------ the city */}
      <section
        aria-labelledby="city-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="city-h" className="text-sm font-semibold text-ink">
            {city.name} in {season.label.toLowerCase()}
          </h2>
          <p className="text-xs text-ink-faint">
            {ordinal(rank.rank)} of {rank.of} restaurants here
          </p>
        </div>
        <p className="mt-1 text-xs text-ink-faint">{season.note}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
          <Figure label="Rent here" value={pct(city.rent)} />
          <Figure label="Spend a head" value={pct(city.spend)} />
          <Figure label="Looking for a table" value={pct(city.demand)} />
          <Figure
            label="Produce keeps"
            value={
              city.shelfLife === 0
                ? "as normal"
                : city.shelfLife > 0
                  ? `+${city.shelfLife} week`
                  : `${city.shelfLife} week`
            }
          />
        </dl>
        {scene.drivers.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs">
            {scene.drivers.map((driver, i) => (
              <li key={i}>
                <span
                  className={
                    driver.effect === "up"
                      ? "text-good"
                      : driver.effect === "down"
                        ? "text-alarm"
                        : "text-ink-faint"
                  }
                >
                  {driver.label}
                </span>{" "}
                <span className="text-ink-faint">{driver.note}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------- the segments */}
      <section
        aria-labelledby="who-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="who-h" className="text-sm font-semibold text-ink">
          Who is in the room
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Eight kinds of people, and the thing that separates them is which part
          of your standing they weigh. A kitchen built to please one of them is
          visibly not built to please another.
        </p>
        <ul className="mt-3 space-y-2">
          {scene.mix.map((share) => {
            const dish = bestDishFor(share.segment, k);
            return (
              <li
                key={share.segment.id}
                className="rounded border border-rule-soft px-3 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium text-ink">
                    {share.segment.label}
                  </span>
                  <span className="text-ink-faint">
                    {Math.round(share.share * 100)}% of the room · they rate you{" "}
                    <span
                      className={
                        share.appeal >= 60
                          ? "text-good"
                          : share.appeal <= 38
                            ? "text-alarm"
                            : ""
                      }
                    >
                      {Math.round(share.appeal)}
                    </span>
                  </span>
                </div>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-rule">
                  <span
                    className="block h-1.5 rounded-full bg-clinical/70"
                    style={{
                      width: `${Math.round(Math.max(2, share.share * 100 * 2.4))}%`,
                    }}
                  />
                </span>
                <p className="mt-1 text-ink-faint">{share.segment.blurb}</p>
                <p className="mt-1 text-ink-soft">
                  Judged on {topWant(share.segment).toLowerCase()}. Pays about{" "}
                  {Math.round(share.segment.spend * 100)}% of the room&rsquo;s
                  ordinary spend.
                </p>
                <p className="mt-1 text-ink-faint">
                  {whySegment(share, k, state.week)}
                </p>
                {dish && (
                  <p className="mt-1 text-ink-faint">
                    On your menu they come for the {dish.name.toLowerCase()} —{" "}
                    {dish.why}.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ----------------------------------------------------- the rivals */}
      <section
        aria-labelledby="rivals-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="rivals-h" className="text-sm font-semibold text-ink">
          The other kitchens
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Three of them, and no more. Two hundred invisible restaurants would be
          a number you cannot argue with; three named ones are a decision.
        </p>
        <ul className="mt-3 space-y-2">
          {rivals.map((rival) => (
            <li
              key={rival.id}
              className="rounded border border-rule-soft px-3 py-2.5 text-xs"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium text-ink">{rival.name}</span>
                <span className="text-ink-faint">
                  {rival.cuisine} · {PRICE_LABEL[rival.price]} ·{" "}
                  {Math.round(rival.reputation)}
                </span>
              </div>
              <p className="mt-1 text-ink-faint">{rival.concept}.</p>
              <p className="mt-1 text-ink-soft">
                <span className="text-good">
                  Strong on {STANDING_BY_ID.get(rival.strength)?.label.toLowerCase()}
                </span>
                {" · "}
                <span className="text-alarm">
                  weak on {STANDING_BY_ID.get(rival.weakness)?.label.toLowerCase()}
                </span>
              </p>
              <p className="mt-1 text-ink-faint">
                After: {rival.targets.join(", ")}.
              </p>
              <p className="mt-1 text-ink">
                {STRATEGY_BY_ID.get(rival.strategy)?.note}
              </p>
              <p className="mt-1 text-ink-faint">
                {openingAgainst(rival, k, state.r.reputation)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------- the critics */}
      <section
        aria-labelledby="critics-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="critics-h" className="text-sm font-semibold text-ink">
          Who writes about restaurants here
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          None of them will tell you what they want. What is printed here is
          what everybody in the trade already knows about them — which is not
          the same as knowing which night they are coming.
        </p>
        <ul className="mt-3 space-y-2">
          {CRITICS.map((critic) => (
            <li
              key={critic.id}
              className="rounded border border-rule-soft px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium text-ink">{critic.name}</span>
                <span className="text-ink-faint">{critic.outlet}</span>
              </div>
              <p className="mt-0.5 text-ink-faint">{critic.blurb}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-faint">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

const ordinal = (n: number): string => {
  if (n === 1) return "first";
  if (n === 2) return "second";
  if (n === 3) return "third";
  if (n === 4) return "fourth";
  return `${n}th`;
};
