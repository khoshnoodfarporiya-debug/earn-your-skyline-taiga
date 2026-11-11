"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { kitchen } from "@/lib/game/careers/chef";
import {
  WINES,
  WINE_BY_ID,
  bottlesHeld,
  casePrice,
  cellarCapacity,
  cellarOf,
  cellarValue,
  listPrestige,
  maturityOf,
  maturityWord,
  pourRate,
  sellPrice,
  wineBlocker,
} from "@/lib/game/careers/cellar";

/**
 * THE CELLAR
 *
 * The one thing in this restaurant that gets better while it sits there, and
 * the screen is built to say so: every case shows what it cost, what it is
 * worth now, and how far it is from the point where holding it stops paying.
 *
 * It sits on the Larder screen because it is stock. It reads nothing like the
 * larder above it because it behaves nothing like it — food rots, wine
 * climbs, and the decision is the opposite one.
 */
export function CellarPanel({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const lots = cellarOf(k);
  const held = bottlesHeld(k);
  const capacity = cellarCapacity(k);
  const value = cellarValue(k, state.week);
  const cost = lots.reduce((n, l) => n + l.bottles * l.unitCost, 0);
  const hasStore = (k.equipment ?? []).includes("cellar");
  const somm = k.staff.some((x) => x.role === "somm");
  const prestige = listPrestige(k);

  return (
    <section
      aria-labelledby="cellar-h"
      className="rounded-lg border border-rule bg-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="cellar-h" className="text-sm font-semibold text-ink">
          The cellar
        </h2>
        <p className="text-xs text-ink-faint">
          {held} of {capacity} bottles
          {value > 0 && (
            <>
              {" · "}
              <span className={value > cost ? "text-good" : "text-ink-faint"}>
                {money(value)}
              </span>{" "}
              against {money(Math.round(cost))} paid
            </>
          )}
        </p>
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        Everything else in this building rots. Wine climbs — money you take off
        the floor and put in a rack, worth more every week you leave it and
        worth nothing at all if you needed it on Tuesday.
      </p>

      {!hasStore && (
        <p className="mt-2 rounded border border-caution/50 px-3 py-1.5 text-xs text-caution">
          Without the wine store you have a rack behind the bar: {capacity}{" "}
          bottles, and nothing you would age. Buy the store on the room screen.
        </p>
      )}
      {lots.length > 0 && !somm && (
        <p className="mt-2 rounded border border-rule-soft px-3 py-1.5 text-xs text-ink-faint">
          Nobody is selling it. A sommelier sells about half again as much wine
          as a room without one, and sells it from the top of the list rather
          than the bottom. Currently pouring for{" "}
          {Math.round(pourRate(k, somm) * 100)}% of the room.
        </p>
      )}

      {/* -------------------------------------------------------- what is held */}
      {lots.length > 0 && (
        <ul className="mt-3 space-y-2">
          {lots.map((lot) => {
            const wine = WINE_BY_ID.get(lot.wine);
            if (!wine) return null;
            const age = state.week - lot.boughtWeek;
            const matured = maturityOf(wine, age);
            const now = Math.round(lot.bottles * lot.unitCost * matured);
            const paid = Math.round(lot.bottles * lot.unitCost);
            return (
              <li
                key={lot.id}
                className="rounded border border-rule-soft px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium text-ink">{wine.label}</span>
                  <span className="text-ink-faint">
                    {lot.bottles} bottle{lot.bottles === 1 ? "" : "s"} · held{" "}
                    {age} week{age === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-0.5 text-ink-soft">
                  {maturityWord(wine, age)} ·{" "}
                  <span className={now > paid ? "text-good" : "text-ink-faint"}>
                    {money(now)}
                  </span>{" "}
                  <span className="text-ink-faint">
                    against {money(paid)} paid
                  </span>
                </p>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                  <button
                    type="button"
                    onClick={() => onCommand("sellWine", lot.id)}
                    className="rounded border border-rule px-2.5 py-1 text-ink hover:border-clinical"
                  >
                    Sell for {money(sellPrice(k, lot, state.week))}
                  </button>
                  <span className="text-ink-faint">
                    A merchant pays less than a diner. Pouring it is always
                    worth more.
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ------------------------------------------------------------ the list */}
      <h3 className="mt-4 sign text-[11.5px] text-ink-soft">
        Buy by the case
        {prestige > 0 && (
          <span className="ml-2 font-normal normal-case tracking-normal text-ink-faint">
            your list reads {Math.round(prestige)} out of 100
          </span>
        )}
      </h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {WINES.map((wine) => {
          const why = wineBlocker(k, wine, state.r.cash);
          return (
            <li
              key={wine.id}
              className="flex flex-col justify-between gap-2 rounded border border-rule-soft p-3 text-xs"
            >
              <div>
                <p className="font-medium text-ink">{wine.label}</p>
                <p className="mt-0.5 text-ink-faint">
                  {wine.region} · {wine.style} · {wine.caseSize} bottles
                </p>
                <p className="mt-1 text-ink-faint">{wine.blurb}</p>
                <p className="mt-1 text-ink-soft">
                  At its best in about {Math.round(wine.peak / 52)} year
                  {Math.round(wine.peak / 52) === 1 ? "" : "s"}, when it is worth
                  roughly{" "}
                  {Math.round(maturityOf(wine, wine.peak) * 100)}% of what you
                  paid.
                </p>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <button
                  type="button"
                  disabled={!!why}
                  onClick={() => onCommand("buyWine", wine.id)}
                  className="rounded border border-rule px-2.5 py-1 text-ink enabled:hover:border-clinical disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {money(casePrice(k, wine))}
                </button>
                {why && <span className="text-ink-faint">{why}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
