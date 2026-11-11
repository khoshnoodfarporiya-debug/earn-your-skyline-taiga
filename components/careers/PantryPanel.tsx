"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { Stat } from "./Shelf";
import { ChefThumb } from "./ChefScene";
import { SUPPLIER_ART } from "@/lib/ui/chefArt";
import {
  SUPPLIERS,
  arrivalOdds,
  ingredientLifeLeft,
  ingredientPrice,
  ingredientState,
  pantryOf,
  pantryValue,
  menuShortfalls,
  premisesOf,
  type FreshnessState,
  standingWith,
  supplierBlocker,
} from "@/lib/game/careers/kitchen";
import { kitchen } from "@/lib/game/careers/chef";
import {
  INGREDIENTS,
  INGREDIENT_BY_ID,
  inSeason,
} from "@/lib/game/careers/recipes";

/**
 * THE PANTRY
 *
 * What the named ingredients are, how long each has left, and where more
 * comes from. The crates upstairs meter covers; this meters the things a
 * recipe asks for by name, and it is the screen where a spoilage problem is
 * visible a week before it is a spoilage cost.
 *
 * The four states are words, not a percentage, because "62% fresh" is not a
 * decision and "use it this week" is. Nothing here is red by default — the
 * copper accent carries "worth your attention" and the alarm colour is spent
 * only on stock that is already lost.
 */

const BAND: Record<FreshnessState, { word: string; cls: string }> = {
  fresh: { word: "Fresh", cls: "text-good" },
  acceptable: { word: "Fine", cls: "text-ink-soft" },
  expiring: { word: "Use this week", cls: "text-chef" },
  spoiled: { word: "Gone", cls: "text-alarm" },
};

export function PantryPanel({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const lots = pantryOf(k);
  const week = state.week;

  /* Grouped by ingredient: a player thinks in "how much chicken", not in
     "which of my four boxes of chicken". The oldest box still decides the
     warning, because that is the one that goes first and dies first. */
  const rows = INGREDIENTS.map((ing) => {
    const mine = lots.filter((l) => l.ingredient === ing.id);
    if (mine.length === 0) return null;
    const qty = mine.reduce((n, l) => n + l.qty, 0);
    const worst = mine.reduce<FreshnessState>((acc, l) => {
      const st = ingredientState(l, week, k);
      const order: FreshnessState[] = ["fresh", "acceptable", "expiring", "spoiled"];
      return order.indexOf(st) > order.indexOf(acc) ? st : acc;
    }, "fresh");
    const soonest = Math.min(...mine.map((l) => ingredientLifeLeft(l, week, k)));
    const value = mine.reduce((n, l) => n + l.qty * l.unitCost, 0);
    return { ing, qty, worst, soonest, value };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const spoiled = rows.filter((r) => r.worst === "spoiled");
  const urgent = rows.filter((r) => r.worst === "expiring");

  /* What tonight would need, so an order is made against the menu rather than
     against a hunch. */
  const covers = Math.round(premisesOf(k).capacity / 2);
  const shortfalls = menuShortfalls(k, covers, week, state.r.skill);

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="pantry-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="pantry-h" className="text-sm font-semibold text-ink">
          The pantry
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          What the menu is made of. Ingredients are drawn oldest first, and
          nothing past its life can reach a plate — it is written off before
          service, not served.
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <Stat label="Lines held" value={`${rows.length}`} />
          <Stat label="Stock value" value={money(pantryValue(k, week))} />
          <Stat
            label="Use this week"
            value={urgent.length > 0 ? `${urgent.length} line${urgent.length === 1 ? "" : "s"}` : "None"}
            tone={urgent.length > 0 ? "bad" : "good"}
          />
        </dl>

        {rows.length === 0 ? (
          <p className="mt-3 rounded border border-dashed border-rule px-3 py-4 text-center text-xs text-ink-faint">
            Nothing but the staple crates. A dish on the menu with no
            ingredients behind it cannot go out — order below.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map(({ ing, qty, worst, soonest, value }) => (
              <li
                key={ing.id}
                className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded border px-3 py-2 text-xs ${
                  worst === "spoiled"
                    ? "border-alarm/45"
                    : worst === "expiring"
                      ? "border-chef/40"
                      : "border-rule-soft"
                }`}
              >
                <span className="font-medium text-ink">{ing.name}</span>
                <span className="text-ink-faint">
                  {Math.round(qty * 10) / 10} {ing.unit} · {money(value)}
                </span>
                <span className={BAND[worst].cls}>
                  {BAND[worst].word}
                  {worst !== "spoiled" && soonest > 0
                    ? ` · ${soonest} week${soonest === 1 ? "" : "s"} left`
                    : ""}
                </span>
                <span className="w-full text-ink-faint">
                  {ing.category} · kept {ing.storage}
                  {!inSeason(ing, week) ? " · out of season, and dearer for it" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}

        {spoiled.length > 0 && (
          <div className="mt-3 rounded border border-alarm/45 bg-alarm-tint/40 px-3 py-2.5 text-xs">
            <p className="text-ink">
              {spoiled.map((r) => r.ing.name).join(", ")} — past its life and
              already out of use.
            </p>
            <p className="mt-0.5 text-ink-faint">
              The week clears it before service either way. Doing it now costs
              the same and keeps the number honest.
            </p>
            <button
              type="button"
              onClick={() => onCommand("dumpSpoiled", "")}
              className="mt-2 rounded border border-rule px-2.5 py-1 text-ink transition hover:border-alarm hover:text-alarm"
            >
              Throw it out
            </button>
          </div>
        )}

        {shortfalls.length > 0 && (
          <p className="mt-3 rounded border border-chef/40 px-3 py-2 text-xs text-ink">
            Short of{" "}
            {(
              INGREDIENT_BY_ID.get(shortfalls[0].ingredient)?.name ??
              shortfalls[0].ingredient
            ).toLowerCase()}{" "}
            for{" "}
            {shortfalls[0].dish.toLowerCase()}
            {shortfalls.length > 1
              ? `, and ${shortfalls.length - 1} more like it.`
              : "."}{" "}
            <span className="text-ink-faint">
              Those covers fall through to the staple crate at a worse plate.
            </span>
          </p>
        )}
      </section>

      {/* ------------------------------------------------------- ordering */}
      <section
        aria-labelledby="ingredients-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <div className="flex items-start gap-3">
          <ChefThumb art={SUPPLIER_ART} className="hidden w-28 shrink-0 sm:block" />
          <div className="min-w-0 flex-1">
            <h2 id="ingredients-h" className="text-sm font-semibold text-ink">
              Order ingredients
            </h2>
            <p className="mt-1 text-xs text-ink-faint">
              One delivery at a time, at what this city charges and what the
              season allows. A better supplier lands a box with more life in
              it — the same trade the crates make.
            </p>
          </div>
        </div>

        <ul className="mt-3 space-y-3">
          {SUPPLIERS.map((sup) => {
            const standing = standingWith(k, sup.id);
            const shut = supplierBlocker(sup, k, state.r.reputation, null);
            /* A merchant carries what a merchant carries: the seafood
               specialist has no flour, and the wholesaler has no truffle. */
            const carries = INGREDIENTS.filter((ing) =>
              sup.carries.includes("luxury")
                ? true
                : sup.carries.includes("market")
                  ? ing.price < 30
                  : ing.price < 12,
            );
            if (carries.length === 0) return null;

            return (
              <li key={sup.id} className="rounded border border-rule-soft p-3 text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium text-ink">{sup.label}</span>
                  <span className="text-ink-faint">
                    {shut
                      ? shut
                      : `${Math.round(arrivalOdds(sup, standing) * 100)}% of orders arrive · standing ${Math.round(standing)}`}
                  </span>
                </div>
                {!shut && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {carries.map((ing) => {
                      const price = ingredientPrice(k, sup, ing, standing, week);
                      const life = Math.max(1, ing.life + sup.freshness);
                      const tooSmall = price < sup.minimum;
                      const tooDear = state.r.cash < price;
                      return (
                        <button
                          key={ing.id}
                          type="button"
                          disabled={tooSmall || tooDear}
                          onClick={() =>
                            onCommand("buyIngredient", `${sup.id}:${ing.id}`)
                          }
                          className="rounded border border-rule px-2.5 py-1.5 text-left text-ink transition enabled:hover:border-chef disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <span className="block">
                            {ing.name} · {money(price)}
                          </span>
                          <span className="block text-ink-faint">
                            {ing.orderSize} {ing.unit} · {life} week
                            {life === 1 ? "" : "s"} of life
                            {!inSeason(ing, week) ? " · out of season" : ""}
                            {tooSmall
                              ? ` · under their ${money(sup.minimum)} minimum`
                              : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
