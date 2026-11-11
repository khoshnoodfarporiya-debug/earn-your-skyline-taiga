"use client";

import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import {
  CAMPAIGNS,
  campaignEffect,
  catchmentMultiplier,
  marketingSpend,
} from "@/lib/game/medical/marketing";
import { catchment } from "@/lib/game/medical/sim";
import { money } from "@/lib/game/format";

export function GrowthPanel({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const m = med(state);
  const rep = state.r.reputation;
  const multiplier = catchmentMultiplier(m, rep);
  const ceiling = catchment(m, rep);
  const fill = Math.max(0, Math.min(100, (state.r.panel / ceiling) * 100));

  return (
    <div className="space-y-4">
      <section className="form">
        <div className="form-head px-5 py-2.5">
          <h3 className="sign text-[11.5px] text-ink-soft">Catchment</h3>
        </div>

        <div className="grid gap-px bg-rule-soft sm:grid-cols-3">
          <div className="bg-card px-5 py-4">
            <p className="sign text-[11.5px] text-ink-faint">Panel now</p>
            <p className="num mt-1 text-2xl">{Math.round(state.r.panel)}</p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="sign text-[11.5px] text-ink-faint">Drifting toward</p>
            <p className="num mt-1 text-2xl text-clinical">
              {Math.round(ceiling)}
            </p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="sign text-[11.5px] text-ink-faint">Multiplier</p>
            <p
              className={`num mt-1 text-2xl ${multiplier < 1 ? "text-alarm" : "text-ink"}`}
            >
              ×{multiplier.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Panel against its ceiling, read as a fill gauge. */}
        <div className="border-t border-rule-soft px-5 py-4">
          <div
            className="gauge"
            style={{ ["--fill" as string]: `${fill}%` }}
            role="meter"
            aria-valuenow={Math.round(fill)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Active patients against what the market could give you"
          />
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-soft">
            Word-of-mouth channels multiply your reputation, currently{" "}
            <span className="num text-ink">{Math.round(rep)}</span>. Above 50
            they add reach; below it they spread the bad news just as
            efficiently, and can lower the number of local patients you are
            able to attract at all.
          </p>
        </div>
      </section>

      <section className="form">
        <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
          <h3 className="sign text-[11.5px] text-ink-soft">Campaigns</h3>
          <span className="num text-[12px] text-ink-soft">
            {money(marketingSpend(m))}/wk running
          </span>
        </div>

        <div className="divide-y divide-rule-soft">
          {CAMPAIGNS.map((c) => {
            const running = m.campaigns.includes(c.id);
            const { total, fromReputation } = campaignEffect(c, rep);
            const repLocked =
              !!c.minReputation && rep < c.minReputation && !running;
            const affordable = state.r.cash >= c.setupCost;
            const disabled = !running && (repLocked || !affordable);

            return (
              <button
                key={c.id}
                onClick={() => dispatch("toggleCampaign", c.id)}
                disabled={disabled}
                aria-pressed={running}
                className={`spine block w-full px-4 py-3.5 text-left transition ${
                  running
                    ? "bg-clinical-tint"
                    : disabled
                      ? "cursor-not-allowed bg-paper/60 opacity-60"
                      : "bg-card hover:bg-clinical-tint"
                }`}
                style={{
                  ["--dept" as string]: running
                    ? total >= 0
                      ? "#35E0C0"
                      : "#FF6B6B"
                    : "transparent",
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h4 className="text-[14px] font-semibold text-ink">
                    {c.label}
                    {running && (
                      <span className="sign ml-2 text-[11.5px] text-clinical">
                        running
                      </span>
                    )}
                  </h4>
                  <span className="num shrink-0 text-[13px] text-ink-soft">
                    {running
                      ? `${money(c.weeklyCost)}/wk`
                      : `${money(c.setupCost)} + ${money(c.weeklyCost)}/wk`}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
                  {c.blurb}
                </p>
                <p className="num mt-1.5 text-[12px]">
                  <span className={total >= 0 ? "text-clinical" : "text-alarm"}>
                    {total >= 0 ? "+" : "−"}
                    {Math.abs(total * 100).toFixed(0)}% reach
                  </span>
                  {/* Below half a point this rounds to a meaningless "0%". */}
                  {c.coupling > 0 && Math.abs(fromReputation) >= 0.005 && (
                    <span
                      className={
                        fromReputation >= 0 ? "text-ink-faint" : "text-alarm"
                      }
                    >
                      {"  "}· {fromReputation >= 0 ? "+" : "−"}
                      {Math.abs(fromReputation * 100).toFixed(0)}% of that from
                      your reputation
                    </span>
                  )}
                </p>
                {repLocked && (
                  <p className="sign mt-1.5 text-[11.5px] text-caution">
                    Needs reputation {c.minReputation}
                  </p>
                )}
                {running && (
                  <p className="num mt-1 text-[11.5px] text-ink-faint">
                    Click to stop — no refund on setup
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
