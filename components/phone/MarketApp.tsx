"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { kitchen } from "@/lib/game/careers/chef";
import {
  PRODUCE,
  SUPPLIERS,
  arrivalOdds,
  extraShelfLife,
  larderCovers,
  lifeFrom,
  premisesOf,
  priceFrom,
  produceIndex,
  standingWith,
  supplierBlocker,
} from "@/lib/game/careers/kitchen";
import { AppHeader } from "./AppHeader";

/**
 * THE MARKET, ON THE PHONE
 *
 * Ordering used to be a panel on the Larder screen, which put a *transaction*
 * in the middle of a *report*. It is also simply not how the trade works: you
 * do not order turbot from a dashboard, you ring the merchant. So the order
 * book lives on the handset now, one supplier per thread, like the call it
 * represents — and the Larder screen keeps the job of telling you what you
 * own and what dies next week.
 *
 * The commands dispatched here are the same ones the panel dispatched, so the
 * engine, the tests of the buying rules, and every save are untouched. Only
 * the doorway moved.
 */
export function MarketApp({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const stock = larderCovers(k);
  /*
   * How much food a full week would actually eat.
   *
   * The hardest thing about ordering was never the prices — it was knowing
   * *how much*. The room's seats are the honest yardstick, so the header says
   * how short the larder is against a full week rather than leaving the
   * player to multiply it out. Ordering more than this is not wasted, but it
   * is the number that spoils.
   */
  const room = premisesOf(k);
  const short = Math.max(0, room.capacity - stock);

  return (
    <div>
      <AppHeader
        app="market"
        title="Your suppliers"
        blurb="Cheaper food arrives with less life in it. Keeping an account warm buys a better price and a van that turns up."
        stats={[
          { label: "In the larder", value: `${stock} covers` },
          {
            label: "A full week",
            value: `${room.capacity} covers`,
          },
          {
            label: "In hand",
            value: money(state.r.cash),
            tone: state.r.cash < 0 ? "bad" : undefined,
          },
        ]}
      />

      {/* The one sentence that turns a price list into a decision. */}
      <p
        className={`border-b border-rule/60 px-4 py-2 text-[12.5px] ${
          short > 0 ? "text-caution" : "text-good"
        }`}
      >
        {short > 0
          ? `You are ${short} covers short of a full week in the ${room.label.toLowerCase()}.`
          : `Enough in the larder to fill the ${room.label.toLowerCase()} for a week.`}
      </p>

      <ul className="divide-y divide-rule/40">
        {SUPPLIERS.map((sup) => {
          const standing = standingWith(k, sup.id);
          const shut = supplierBlocker(sup, k, state.r.reputation, null);
          const odds = arrivalOdds(sup, standing);
          return (
            <li key={sup.id} className="px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14.5px] font-semibold text-ink">
                  {sup.label}
                </span>
                {!shut && (
                  <span
                    className={`num shrink-0 rounded-full px-2 py-0.5 text-[11.5px] leading-tight ${
                      odds >= 0.9
                        ? "bg-good-tint text-good"
                        : odds >= 0.75
                          ? "bg-caution-tint text-caution"
                          : "bg-alarm-tint text-alarm"
                    }`}
                  >
                    {Math.round(odds * 100)}% arrive
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-ink-faint">
                {sup.blurb}
              </p>

              {shut ? (
                <p className="mt-2.5 rounded-form border border-dashed border-rule px-3 py-2 text-[12.5px] leading-snug text-ink-faint">
                  {shut}
                </p>
              ) : (
                <>
                  {/* Standing, as a thing you can watch fill up. */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="sign shrink-0 text-[10.5px] text-ink-faint">
                      Standing
                    </span>
                    {/*
                      A real meter, not a decorated div. The role earns two
                      things at once: a screen reader announces the standing
                      instead of skipping a bare span, and the global
                      reduced-motion rule — which targets `[role="meter"] > *`
                      — stops the fill animating its width for anyone who
                      asked for that.
                    */}
                    <span
                      role="meter"
                      aria-valuenow={Math.round(standing)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Standing with ${sup.label}`}
                      className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-rule-soft"
                    >
                      <span
                        className="block h-full rounded-full bg-chef transition-[width] duration-500"
                        /* No standing means an empty track. A 2% stub read
                           as a stray dot rather than as "nothing yet". */
                        style={{
                          width:
                            standing <= 0
                              ? "0%"
                              : `${Math.max(5, Math.min(100, standing))}%`,
                        }}
                      />
                    </span>
                    <span className="num shrink-0 text-[11.5px] text-ink-soft">
                      {Math.round(standing)}
                    </span>
                  </div>

                  <div className="mt-2.5 grid gap-1.5">
                    {PRODUCE.filter((pr) => sup.carries.includes(pr.id)).map(
                      (pr) => {
                        const price = priceFrom(
                          sup,
                          pr,
                          standing,
                          produceIndex(k),
                        );
                        const life = lifeFrom(sup, pr) + extraShelfLife(k);
                        const tooSmall = price < sup.minimum;
                        const tooDear = state.r.cash < price;
                        const off = tooSmall || tooDear;
                        return (
                          <button
                            key={pr.id}
                            type="button"
                            disabled={off}
                            onClick={() =>
                              dispatch("buyProduce", `${sup.id}:${pr.id}`)
                            }
                            className="flex items-center justify-between gap-3 rounded-form border border-rule bg-card/60 px-3 py-2 text-left transition enabled:hover:border-chef enabled:hover:bg-card-high disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium text-ink">
                                {pr.label}
                              </span>
                              <span className="block text-[11.5px] leading-snug text-ink-faint">
                                {pr.covers} covers · {life} week
                                {life === 1 ? "" : "s"} of life
                                {tooSmall
                                  ? ` · under their ${money(sup.minimum)} minimum`
                                  : ""}
                                {!tooSmall && tooDear
                                  ? ` · you have ${money(state.r.cash)}`
                                  : ""}
                                {/* Which crate actually solves the shortfall,
                                    said on the crate rather than left as
                                    arithmetic for the player. */}
                                {!off && short > 0 && pr.covers >= short
                                  ? " · fills the week"
                                  : ""}
                              </span>
                            </span>
                            <span className="num shrink-0 text-[13px] text-chef">
                              {money(price)}
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <p className="px-4 py-4 text-center text-[12.5px] leading-relaxed text-ink-faint">
        Orders land in the larder at once — or do not, if the van fails. What
        you own and what dies next week is on the Larder screen.
      </p>
    </div>
  );
}
