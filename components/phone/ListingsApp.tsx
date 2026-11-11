"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import {
  CASE_BY_ID,
  COUNSEL,
  MAX_ADJOURNMENTS,
  counselAvailable,
  counselFee,
  hoursNeededFor,
  counselOf,
  hasClerk,
  oddsFor,
  relistChance,
} from "@/lib/game/careers/casework";
import { briefDiscount } from "@/lib/game/careers/lawyerCast";
import { practice } from "@/lib/game/careers/lawyer";
import { AppHeader } from "./AppHeader";

/**
 * THE CAUSE LIST, ON THE PHONE
 *
 * The court's diary rather than yours, which is the whole point of it being a
 * separate place: the Casework screen is what *you* have decided about each
 * file, and this is what has been decided about you. When it is being heard,
 * how many times it has been put back, and the one call that changes a
 * hearing before it happens.
 *
 * Briefing counsel lives here rather than on a dashboard shelf for the same
 * reason ordering produce lives in the Chef's Market app: it is a call you
 * make, not a purchase you shelve. And it is the sharpest expression of this
 * career's constraint in the game — certain money out today, against odds on
 * a hearing that may be two months away and may be put back again.
 */
export function ListingsApp({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const p = practice(state);
  const listed = [...p.cases].sort((a, b) => a.dueWeek - b.dueWeek);
  const next = listed[0];

  return (
    <div>
      <AppHeader
        app="listings"
        title="The cause list"
        blurb={
          hasClerk(p)
            ? "Your clerk is on the list every morning, which is why fewer of these move than they otherwise would."
            : "Dates move. Nobody rings to ask whether it suits you, and the rent does not move with them."
        }
        stats={[
          {
            label: "Listed",
            value:
              listed.length === 0
                ? "Nothing"
                : `${listed.length} matter${listed.length === 1 ? "" : "s"}`,
          },
          {
            label: "Next hearing",
            value: next ? `Week ${next.dueWeek}` : "—",
            tone: next && next.dueWeek - state.week <= 2 ? "bad" : undefined,
          },
          { label: "In hand", value: money(state.r.cash) },
        ]}
      />

      {listed.length === 0 ? (
        <p className="px-4 py-8 text-center text-[14px] leading-relaxed text-ink-soft">
          Nothing is listed. Take an instruction and the court will find you a
          date, eventually, and then move it.
        </p>
      ) : (
        <ul className="divide-y divide-rule/40">
          {listed.map((c) => {
            const k = CASE_BY_ID.get(c.kind);
            if (!k) return null;
            const away = c.dueWeek - state.week;
            const odds = oddsFor(c, p, state.r.skill);
            const ready = Math.min(1, c.hoursDone / hoursNeededFor(p, k));
            const putBack = c.adjournments ?? 0;
            const capped = putBack >= MAX_ADJOURNMENTS;

            return (
              <li key={c.id} className="px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14.5px] font-semibold text-ink">
                    {k.label}
                  </span>
                  <span
                    className={`num shrink-0 text-[11.5px] ${
                      away <= 2 ? "text-alarm" : "text-ink-faint"
                    }`}
                  >
                    {away <= 0 ? "Listed this week" : `Week ${c.dueWeek}`}
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink-faint">
                  {c.client}
                  {c.opponent ? ` · against ${c.opponent}` : ""}
                </p>

                <p className="num mt-1.5 text-[12.5px] text-ink-soft">
                  {Math.round(ready * 100)}% prepared ·{" "}
                  {Math.round(odds * 100)}% as it stands
                </p>

                {/*
                 * An adjournment is stated as a fact about this matter, with
                 * the consequence spelled out beside it. A player who is not
                 * told that the offer falls each time has no way to learn it.
                 */}
                {putBack > 0 && (
                  <p className="mt-2 rounded-form border border-caution/50 bg-caution-tint px-2.5 py-1.5 text-[12.5px] leading-snug text-caution">
                    Put back {putBack} time{putBack === 1 ? "" : "s"}.{" "}
                    {capped
                      ? "It will be heard next time; the list has run out of patience."
                      : `Their offer is ${putBack * 4}% lower for it.`}
                  </p>
                )}

                {c.counsel ? (
                  <p className="mt-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-good-tint px-2.5 py-1 text-[12px] text-good">
                      {counselOf(c.counselTier).label} briefed
                    </span>
                  </p>
                ) : (
                  /*
                   * WHICH counsel, not whether.
                   *
                   * Chambers will not put a silk on a house purchase, so the
                   * tier is not offered rather than offered and refused — the
                   * command enforces the same rule, and this is the card that
                   * states it.
                   */
                  <div className="mt-2.5 space-y-1.5">
                    {COUNSEL.filter((tier) => counselAvailable(tier, k)).map(
                      (tier) => {
                        const fee = Math.round(
                          counselFee(p, k, tier.id) * briefDiscount(state),
                        );
                        const tooDear = state.r.cash < fee;
                        return (
                          <div
                            key={tier.id}
                            className="flex flex-wrap items-center gap-x-2.5 gap-y-1"
                          >
                            <button
                              type="button"
                              disabled={tooDear}
                              onClick={() =>
                                dispatch("briefCounsel", `${c.id}:${tier.id}`)
                              }
                              className="rounded-form border border-rule bg-card/60 px-3.5 py-2 text-[13px] font-medium text-ink transition enabled:hover:border-clinical enabled:hover:bg-card-high enabled:hover:text-clinical disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {tier.label} · {money(fee)}
                            </button>
                            <span className="text-[12px] text-ink-faint">
                              {tooDear
                                ? `Costs ${money(fee)} and you have ${money(state.r.cash)}.`
                                : `+${Math.round(tier.odds * 100)} on the odds, and their costs fall to ${Math.round(tier.relief * 100)}% if it still goes against you.`}
                            </span>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-4 py-4 text-center text-[12.5px] leading-relaxed text-ink-faint">
        {hasClerk(p)
          ? "About one hearing in fifteen still moves. That is the list, not you."
          : `About ${Math.round(relistChance(p, CASE_BY_ID.get("employment")!) * 100)}% of hearings move. A practice clerk takes that to a third of what it is.`}
      </p>
    </div>
  );
}
