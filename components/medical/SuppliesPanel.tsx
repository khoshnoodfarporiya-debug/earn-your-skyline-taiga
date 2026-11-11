"use client";

import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import {
  SHORTAGE_THROTTLE,
  SUPPLY_COST,
  SUPPLY_TIERS,
  tierCost,
  tierStock,
  weeklyEstimate,
  weeksOfCover,
} from "@/lib/game/medical/supplies";
import { money } from "@/lib/game/format";
import { ActionButton, ItemCard } from "../ui/ItemCard";

const SEVERITY_WORD = ["", "Minor", "Routine", "Serious", "Major", "Critical"];

export function SuppliesPanel({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const m = med(state);
  const s = m.supplies;
  const cover = weeksOfCover(m);
  const weekly = weeklyEstimate(m);
  const throttled = s.throttleWeeks > 0;

  const coverTone = cover < 1 ? "alarm" : cover < 3 ? "caution" : "clinical";
  const coverWord =
    cover < 1
      ? "Critical"
      : cover < 3
        ? "Low"
        : cover < 8
          ? "Adequate"
          : "Ample";

  return (
    <div className="space-y-4">
      {/* --------------------------------------------------------- on hand */}
      <section className="form">
        <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
          <h3 className="sign text-[11.5px] text-ink-soft">Stock room</h3>
          <span className="num text-[12px] text-ink-soft">
            {money(weekly)}/wk used
          </span>
        </div>

        <div className="grid grid-cols-2 gap-px bg-rule-soft sm:grid-cols-3">
          <div className="bg-card px-4 py-3.5">
            <p className="sign text-[11.5px] text-ink-faint">On hand</p>
            <p className="num mt-1 text-[21px] font-semibold text-ink">
              {money(s.stock)}
            </p>
          </div>
          <div className="bg-card px-4 py-3.5">
            <p className="sign text-[11.5px] text-ink-faint">Cover</p>
            <p
              className={`num mt-1 text-[21px] font-semibold ${
                coverTone === "alarm"
                  ? "text-alarm"
                  : coverTone === "caution"
                    ? "text-caution"
                    : "text-clinical"
              }`}
            >
              {cover >= 99 ? "99+" : cover.toFixed(1)}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-faint">
              weeks · {coverWord}
            </p>
          </div>
          <div className="col-span-2 bg-card px-4 py-3.5 sm:col-span-1">
            <p className="sign text-[11.5px] text-ink-faint">Auto-order</p>
            <p className="num mt-1 text-[15px] font-semibold text-ink">
              {s.autoOrder ? "On" : "Off"}
            </p>
            <button
              onClick={() => dispatch("toggleAutoOrder", "")}
              aria-pressed={s.autoOrder}
              className="mt-2 min-h-[44px] w-full rounded-form border border-rule px-3 text-[13.5px] transition hover:border-clinical hover:text-clinical"
            >
              Turn {s.autoOrder ? "off" : "on"}
            </button>
          </div>
        </div>

        <p className="border-t border-rule-soft px-5 py-3 text-[13.5px] leading-relaxed text-ink-soft">
          {s.autoOrder
            ? "Any shortfall is bought at short notice, at full price. You will never be blocked — you will simply pay the worst rate for whatever you did not plan for."
            : "Nothing is bought automatically. If stock runs out, capacity drops to " +
              `${Math.round(SHORTAGE_THROTTLE * 100)}% for two weeks.`}
        </p>

        {throttled && (
          <p className="border-t border-rule-soft bg-alarm-tint px-5 py-3 text-[13.5px] text-alarm">
            <span className="sign mr-1.5 text-[11.5px]">Stocked out</span>
            Capacity is reduced for {s.throttleWeeks} more week
            {s.throttleWeeks === 1 ? "" : "s"}. Restock to clear it.
          </p>
        )}
      </section>

      {/* ---------------------------------------------------------- orders */}
      <section className="form">
        <div className="form-head px-5 py-2.5">
          <h3 className="sign text-[11.5px] text-ink-soft">Place an order</h3>
        </div>
        <p className="border-b border-rule-soft px-5 py-2.5 text-[12.5px] text-ink-soft">
          Larger orders cost less per case. The only price is cash tied up in a
          stock room instead of working in the practice.
        </p>

        <div className="divide-y divide-rule-soft">
          {SUPPLY_TIERS.map((tier) => {
            const cost = tierCost(m, tier.id);
            const stock = tierStock(m, tier.id);
            const affordable = state.r.cash >= cost;
            const saving = Math.round((1 - 1 / tier.yield) * 100);
            return (
              <ItemCard
                key={tier.id}
                title={tier.label}
                blurb={tier.blurb}
                price={cost}
                affordable={affordable}
                cash={state.r.cash}
                chips={[
                  { text: `adds ${money(stock)} of stock`, tone: "accent" },
                  ...(saving > 0
                    ? [
                        {
                          text: `${saving}% cheaper per case`,
                          tone: "good" as const,
                        },
                      ]
                    : []),
                  { text: `about ${tier.weeks} weeks at current use` },
                ]}
              >
                <ActionButton
                  onClick={() => dispatch("buySupplies", tier.id)}
                  disabled={!affordable}
                >
                  Order
                </ActionButton>
              </ItemCard>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------ what it costs */}
      <section className="form">
        <div className="form-head px-5 py-2.5">
          <h3 className="sign text-[11.5px] text-ink-soft">
            Consumables per case
          </h3>
        </div>
        <p className="border-b border-rule-soft px-5 py-2.5 text-[12.5px] text-ink-soft">
          Charged on what you actually treat, not what you bill. A dressing
          costs the same whoever is paying for it.
        </p>
        <dl className="grid grid-cols-5 gap-px bg-rule-soft">
          {[1, 2, 3, 4, 5].map((sev) => (
            <div key={sev} className="bg-card px-2 py-2.5 text-center">
              <dt className="sign text-[11.5px] text-ink-faint">Sev {sev}</dt>
              <dd className="num mt-1 text-[14px] font-semibold text-ink">
                {money(SUPPLY_COST[sev])}
              </dd>
              <dd className="mt-0.5 text-[11.5px] leading-none text-ink-faint">
                {SEVERITY_WORD[sev]}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
