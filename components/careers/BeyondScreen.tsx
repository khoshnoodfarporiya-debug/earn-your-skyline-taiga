"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { kitchen } from "@/lib/game/careers/chef";
import { chefRank, RANKS, rankIndex } from "@/lib/game/careers/craft";
import {
  VENTURES,
  VENTURE_BY_ID,
  localRoyalties,
  ventureBlocker,
  ventureCost,
  ventureFee,
  venturesOf,
} from "@/lib/game/careers/ventures";

/**
 * BEYOND THE KITCHEN
 *
 * The four things every chef in this trade is eventually offered, and the one
 * currency all of them are paid for in: weeks you are not on your own pass.
 *
 * The screen is built around that trade rather than around the money. Every
 * card leads with what it takes out of the week, because the fee is the easy
 * half of the decision and the absence is the half that costs you a
 * restaurant.
 */
export function BeyondScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const ventures = venturesOf(k);
  const active = ventures.active ? VENTURE_BY_ID.get(ventures.active.id) : null;
  const royalty = localRoyalties(k);
  const rank = rankIndex(k, state.r.reputation);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- what is running */}
      {active && ventures.active ? (
        <section
          aria-labelledby="running-h"
          className="rounded-lg border border-chef/45 bg-card p-4"
        >
          <h2 id="running-h" className="text-sm font-semibold text-ink">
            {active.label}
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            {ventures.active.weeksLeft} week
            {ventures.active.weeksLeft === 1 ? "" : "s"} to run ·{" "}
            {active.blocks} block{active.blocks === 1 ? "" : "s"} a week gone
            from your own kitchen
          </p>
          <p className="mt-2 text-xs text-ink-soft">{active.toll}</p>
          <p className="mt-2 text-xs text-ink-faint">
            {money(ventureFee(k, active))} on completion
            {active.royalty > 0
              ? `, then ${money(Math.round(active.royalty))} a week for as long as the run lasts.`
              : "."}
          </p>
          <button
            type="button"
            onClick={() => onCommand("dropVenture", "")}
            className="mt-2.5 rounded border border-rule px-2.5 py-1 text-xs text-ink hover:border-alarm"
          >
            Pull out
          </button>
          <p className="mt-1 text-xs text-ink-faint">
            What you have already spent is gone and nothing is paid. It buys
            your kitchen back.
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-rule bg-card p-4">
          <h2 className="text-sm font-semibold text-ink">
            Nothing on at the moment
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            Every week is your own. That is worth more than it sounds, and it is
            the thing all of this is spent.
          </p>
        </section>
      )}

      {/* -------------------------------------------------------- the royalties */}
      {royalty > 0 && (
        <section className="rounded-lg border border-good/40 bg-card p-4">
          <h2 className="text-sm font-semibold text-ink">
            {money(royalty)} a week, whatever happens
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            Royalties from work already finished. The only money in this career
            that arrives whether or not you opened the doors — which is why a
            chef writes a book.
          </p>
        </section>
      )}

      {/* ---------------------------------------------------------- the offers */}
      <section
        aria-labelledby="offers-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="offers-h" className="text-sm font-semibold text-ink">
            What is on the table
          </h2>
          <p className="text-xs text-ink-faint">
            {chefRank(k, state.r.reputation).label}
          </p>
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          None of this can be bought. Each arrives when the trade thinks you are
          somebody worth asking, which is what the rank on the craft screen
          means.
        </p>
        <ul className="mt-3 space-y-2">
          {VENTURES.map((v) => {
            const why = ventureBlocker(
              v,
              k,
              state.r.reputation,
              state.r.cash,
              state.week,
            );
            const locked = rank < v.needsRank;
            const cost = ventureCost(k, v);
            return (
              <li
                key={v.id}
                className={`rounded border px-3 py-2.5 text-xs ${
                  locked ? "border-rule-soft opacity-70" : "border-rule-soft"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium text-ink">{v.label}</span>
                  <span className="text-ink-faint">
                    {v.weeks} weeks · {v.blocks} block
                    {v.blocks === 1 ? "" : "s"} a week
                  </span>
                </div>
                <p className="mt-1 text-ink-faint">{v.blurb}</p>
                <p className="mt-1 text-ink-soft">{v.toll}</p>
                <p className="mt-1 text-ink-faint">
                  Pays {money(ventureFee(k, v))}
                  {v.royalty > 0
                    ? `, then ${money(Math.round(v.royalty))} a week forever`
                    : ""}
                  {v.followers > 0
                    ? ` · ${v.followers.toLocaleString("en-US")} followers`
                    : ""}
                  {v.expectation > 0
                    ? ` · raises expectations ${v.expectation} points, permanently`
                    : ""}
                </p>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                  <button
                    type="button"
                    disabled={!!why}
                    onClick={() => onCommand("startVenture", v.id)}
                    className="rounded border border-rule px-2.5 py-1 text-ink enabled:hover:border-clinical disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {cost > 0 ? money(cost) : "Take it"}
                  </button>
                  {why && (
                    <span className="text-ink-faint">
                      {locked
                        ? `Requires ${RANKS[v.needsRank].label.toLowerCase()} at least — nobody is offering it yet`
                        : why}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
