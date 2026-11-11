"use client";

import { PurchaseShelf } from "../purchase/PurchaseShelf";
import type { ScreenId } from "@/lib/ui/navigation";
import { BurnoutBalance } from "../visuals/BurnoutBalance";
import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import {
  LIFESTYLE,
  bonusTimeBlocks,
  burnoutRelief,
  lifestyleUpkeep,
  lifestyleValue,
  restBonus,
  statusOf,
} from "@/lib/game/medical/lifestyle";
import { money } from "@/lib/game/format";
import { Panel, StatRow } from "../ui/Panel";

export function LifePanel({
  state,
  dispatch,
  onNavigate,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  const m = med(state);
  const spent = m.lifestyle.reduce((sum, id) => {
    const item = LIFESTYLE.find((l) => l.id === id);
    return sum + (item?.cost ?? 0);
  }, 0);
  const retained = lifestyleValue(m);

  return (
    <div className="space-y-4">
      {/* Burnout is the thing this screen exists to move, so the arithmetic
          of it comes before the shopping. */}
      <BurnoutBalance state={state} onNavigate={onNavigate} />

      <Panel title="What it is doing for you" flush>
        <StatRow
          stats={[
            { label: "Status", value: statusOf(m), note: "better recruits" },
            {
              label: "Rest",
              value: `+${restBonus(m)}`,
              note: "per rest block",
            },
            {
              label: "Relief",
              value: `−${burnoutRelief(m).toFixed(1)}`,
              note: "burnout weekly",
            },
            {
              label: "Time",
              value: `+${bonusTimeBlocks(m)}`,
              note: "blocks per week",
              tone: bonusTimeBlocks(m) > 0 ? "accent" : "neutral",
            },
          ]}
        />

        {spent > 0 && (
          <p className="border-t border-rule-soft px-5 py-3.5 text-[12.5px] leading-relaxed text-ink-soft">
            You have spent <span className="num text-ink">{money(spent)}</span>{" "}
            on all this and it counts{" "}
            <span
              className={`num ${retained < spent ? "text-alarm" : "text-good"}`}
            >
              {money(retained)}
            </span>{" "}
            toward net worth — a {retained < spent ? "loss" : "gain"} of{" "}
            <span className="num">{money(Math.abs(retained - spent))}</span>{" "}
            against the target. Upkeep is {money(lifestyleUpkeep(m))}/wk.
          </p>
        )}
      </Panel>

      {/*
       * Four shelves rather than four lists.
       *
       * The taxonomy is the brief's — homes, vehicles, services, luxury —
       * and it is derived in `lib/ui/purchases.ts` from what the items
       * actually do, not from a second hand-kept grouping.
       */}
      <PurchaseShelf
        state={state}
        dispatch={dispatch}
        groups={["homes", "vehicles", "services", "luxury"]}
        title="What the money is for"
      />
    </div>
  );
}
