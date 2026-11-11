"use client";

import type { CareerDef, RunState } from "@/lib/game/types";
import type { Allocation } from "@/lib/game/engine";
import type { Alert } from "@/lib/ui/alerts";
import type { ScreenId } from "@/lib/ui/navigation";
import { money } from "@/lib/game/format";
import { cashTone, weeklyBurnFor } from "@/lib/ui/constraint";
import { ActionBoard } from "../ActionBoard";

/**
 * THE WEEK, ON EVERY SCREEN (Phase 4).
 *
 * The single most repeated journey in the game was: look at a screen, decide
 * something, go back to the Week to spend blocks on it, commit, return. The
 * plan lived on one destination and every other screen made you leave to act
 * on what it just told you.
 *
 * This rail keeps the plan beside the decision. It is the same allocation
 * state the Week screen edits — the same `alloc`, the same steppers, the
 * same commit — rendered narrow, so a Solicitor reading the books can put
 * two blocks on casework without going anywhere.
 *
 * It renders only on desktop (`lg:` and up) and never on the Week screen,
 * where the full planner with its forecast is already the centrepiece —
 * beside it this would be a second copy of the same controls. Mobile gets
 * the WeeklyPlanSheet instead, one tap away on the same screens.
 */
export function WeeklyPlanRail({
  career,
  state,
  alloc,
  budget,
  spent,
  alerts,
  onAllocate,
  onCommit,
  onNavigate,
}: {
  career: CareerDef;
  state: RunState;
  alloc: Allocation;
  budget: number;
  spent: number;
  alerts: Alert[];
  onAllocate: (updater: (prev: Allocation) => Allocation) => void;
  onCommit: () => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  const remaining = budget - spent;
  const urgent = alerts.filter((a) => a.severity === "critical");
  const score = career.scoreboard(state);
  const burn = weeklyBurnFor(state);
  const tone = cashTone(state);

  return (
    <aside
      aria-label="Weekly plan"
      className="sticky top-6 hidden max-h-[calc(100vh-3rem)] flex-col gap-3 self-start overflow-y-auto lg:flex"
    >
      {/* What this week is measured in — the career's own scoreboard —
          and what it costs to exist, from the career's own model. */}
      <div className="form px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="sign text-[11.5px] text-ink-faint">{score.label}</p>
            <p className="num truncate text-[17px] font-semibold text-ink">
              {score.value}
            </p>
          </div>
          <p className="sign shrink-0 text-[11.5px] text-ink-faint">
            Week {state.week}
          </p>
        </div>
        <p className="num mt-1.5 text-[12.5px] leading-snug">
          <span
            className={
              tone === "alarm"
                ? "font-semibold text-alarm"
                : tone === "caution"
                  ? "font-semibold text-caution"
                  : "text-ink-soft"
            }
          >
            {money(state.r.cash)}
          </span>
          {burn !== null && burn > 0 && (
            <span className="text-ink-faint"> · {money(burn)}/wk out</span>
          )}
        </p>
      </div>

      {/* The most urgent thing wrong, if anything is — one line, one link.
          The full stack stays on the Week screen; this is a tap on the
          shoulder, not a second inbox. */}
      {urgent[0] && (
        <button
          onClick={() => onNavigate(urgent[0].destination)}
          className="form flex w-full items-start gap-2.5 border border-alarm/40 bg-alarm-tint px-4 py-3 text-left transition hover:border-alarm/70"
        >
          <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full bg-alarm" />
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold leading-snug text-ink">
              {urgent[0].title}
            </span>
            {urgent.length > 1 && (
              <span className="mt-0.5 block text-[12px] text-ink-soft">
                and {urgent.length - 1} more on the Week screen
              </span>
            )}
          </span>
        </button>
      )}

      {/* The plan itself: the same board the Week screen edits. */}
      <div className="form overflow-hidden">
        <div className="form-head flex items-baseline justify-between px-4 py-2.5">
          <h2 className="sign text-[11.5px] text-ink-soft">This week</h2>
          <p className="num text-[12px] text-ink-faint">
            {remaining === 0
              ? "fully planned"
              : `${remaining} block${remaining === 1 ? "" : "s"} free`}
          </p>
        </div>
        <ActionBoard
          career={career}
          state={state}
          alloc={alloc}
          budget={budget}
          spent={spent}
          onChange={onAllocate}
          bare
        />
      </div>

      <button
        onClick={onCommit}
        disabled={spent === 0}
        className="min-h-[48px] w-full rounded-form bg-clinical px-4 text-[14.5px] font-bold text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint"
      >
        {spent === 0
          ? "Assign your time first"
          : remaining > 0
            ? `Commit week — ${remaining} unused`
            : "Commit week"}
      </button>
    </aside>
  );
}
