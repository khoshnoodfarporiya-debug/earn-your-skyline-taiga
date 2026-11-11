"use client";

import type { RunState } from "@/lib/game/types";
import { netWorth } from "@/lib/game/careers/doctor";
import {
  KIND_WORD,
  borrowingCapacity,
  equitySold,
  fundingOffers,
  obligations,
  ownedShare,
  totalOutstanding,
} from "@/lib/game/finance";
import { personIn } from "@/lib/game/people";
import { money } from "@/lib/game/format";
import { Panel, StatRow } from "../ui/Panel";
import { ActionButton, ItemCard } from "../ui/ItemCard";
import type { ScreenId } from "@/lib/ui/navigation";
import { FinanceWaterfall } from "../visuals/FinanceWaterfall";

/**
 * MONEY
 *
 * What you owe, what you gave away, and what is still on offer.
 *
 * Blocked offers are shown rather than hidden, with the reason attached. That
 * is a deliberate teaching choice: "you have already sold 45% and will not go
 * past 49%" explains the system, where an absent option explains nothing and
 * reads as a bug.
 */
export function MoneyPanel({
  state,
  dispatch,
  onNavigate,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  const held = obligations(state);
  const owned = ownedShare(state);
  const weeklyRevenue = Math.max(0, state.r._lastRevenue ?? 0);
  const capacity = borrowingCapacity(state, netWorth(state), weeklyRevenue);

  const offers = fundingOffers(state, {
    netWorth: netWorth(state),
    weeklyRevenue,
    credibility: state.r.reputation,
    influence: state.r.repInfluence ?? 20,
    ethics: state.r.repEthics ?? 70,
    investorWarmth: personIn(state, "thorne")?.warmth ?? 0,
    partnerWarmth: personIn(state, "adeyemi")?.warmth ?? 0,
  });

  return (
    <div className="space-y-4">
      {/* The shape of a normal week, before the balance-sheet figures — a
          player deciding whether to borrow needs the burn rate first. */}
      <FinanceWaterfall state={state} onNavigate={onNavigate} />

      <Panel title="Where you stand" flush>
        <StatRow
          stats={[
            {
              label: "You own",
              value: `${Math.round(owned)}%`,
              note:
                equitySold(state) > 0 ? "of your own practice" : "all of it",
              tone: owned >= 90 ? "good" : owned >= 70 ? "neutral" : "caution",
            },
            {
              label: "Owed",
              value: money(totalOutstanding(state)),
              note: "outstanding borrowing",
              tone: totalOutstanding(state) > 0 ? "caution" : "good",
            },
            {
              label: "Headroom",
              value: money(capacity),
              note: "a lender would advance",
            },
            {
              label: "Facilities",
              value: held.length,
              note: "live arrangements",
            },
          ]}
        />
      </Panel>

      {held.length > 0 && (
        <Panel title="What you took" flush>
          <ul className="divide-y divide-rule-soft">
            {held.map((o) => (
              <li key={o.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="t-card text-ink">
                    {KIND_WORD[o.kind]}
                    <span className="num ml-2 text-[12px] font-normal text-ink-faint">
                      week {o.week}
                    </span>
                  </h4>
                  <span className="num text-[13px] text-ink">
                    {money(o.principal)}
                  </span>
                </div>

                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {o.outstanding > 0 && (
                    <li className="num rounded-sm bg-caution-tint px-1.5 py-0.5 text-[12px] text-caution">
                      {money(o.outstanding)} outstanding
                    </li>
                  )}
                  {o.equity > 0 && (
                    <li className="num rounded-sm bg-alarm-tint px-1.5 py-0.5 text-[12px] text-alarm">
                      {o.equity}% of the practice
                    </li>
                  )}
                  {o.rate > 0 && (
                    <li className="num rounded-sm bg-paper px-1.5 py-0.5 text-[12px] text-ink-soft">
                      {(o.rate * 5200).toFixed(1)}% a year
                    </li>
                  )}
                  {o.missed > 0 && (
                    <li className="num rounded-sm bg-alarm-tint px-1.5 py-0.5 text-[12px] text-alarm">
                      {o.missed} missed payment{o.missed === 1 ? "" : "s"}
                    </li>
                  )}
                </ul>

                {o.condition && (
                  <p className="mt-2 text-[12.5px] leading-snug text-ink-soft">
                    {o.condition}
                    {o.dueWeek !== undefined && ` Due by week ${o.dueWeek}.`}
                  </p>
                )}

                {o.outstanding > 0 && (
                  <div className="mt-2.5">
                    <ActionButton
                      onClick={() =>
                        dispatch(
                          "repayFacility",
                          `${o.id}:${Math.min(o.outstanding, state.r.cash)}`,
                        )
                      }
                      disabled={state.r.cash < 1000}
                    >
                      Repay{" "}
                      {money(
                        Math.min(o.outstanding, Math.max(0, state.r.cash)),
                      )}
                    </ActionButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Raising money"
        note="Every one of these costs something. The question is which cost you can carry."
        flush
      >
        <div className="divide-y divide-rule-soft">
          {offers.map((o) => (
            <ItemCard
              key={o.kind}
              title={o.label}
              blurb={o.blurb}
              price={o.blocked ? undefined : o.amount}
              cash={state.r.cash}
              chips={[
                ...(o.equity > 0
                  ? [{ text: `${o.equity}% equity`, tone: "alarm" as const }]
                  : []),
                ...(o.rate > 0
                  ? [
                      {
                        text: `${(o.rate * 5200).toFixed(1)}% a year`,
                        tone: "caution" as const,
                      },
                    ]
                  : []),
                ...(o.condition
                  ? [{ text: "conditional", tone: "caution" as const }]
                  : []),
                ...(o.equity === 0 && o.rate === 0 && !o.condition
                  ? [{ text: "nothing to repay", tone: "good" as const }]
                  : []),
              ]}
              footnote={o.condition}
              blocker={o.blocked}
            >
              <ActionButton
                onClick={() => dispatch("raiseFunds", o.kind)}
                disabled={!!o.blocked || o.amount <= 0}
              >
                Take it
              </ActionButton>
            </ItemCard>
          ))}
        </div>
      </Panel>
    </div>
  );
}
