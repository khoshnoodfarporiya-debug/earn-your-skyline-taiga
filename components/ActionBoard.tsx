"use client";

import type { CareerDef, RunState } from "@/lib/game/types";
import type { Allocation } from "@/lib/game/engine";
import { money } from "@/lib/game/format";
import { ActionIcon } from "./Icons";

export function ActionBoard({
  career,
  state,
  alloc,
  budget,
  spent,
  onChange,
  bare = false,
}: {
  career: CareerDef;
  state: RunState;
  alloc: Allocation;
  budget: number;
  spent: number;
  onChange: (updater: (prev: Allocation) => Allocation) => void;
  /** Drop the panel chrome when the caller already provides it. */
  bare?: boolean;
}) {
  const remaining = budget - spent;

  /**
   * Functional update, not `{...alloc}`. React batches clicks, so several in
   * quick succession all read the same stale `alloc` prop — the second click
   * on a button would overwrite the first, and a click on a *different* action
   * would silently discard everything allocated before it.
   */
  const set = (id: string, delta: number) => {
    onChange((prev) => {
      const action = career.actions.find((a) => a.id === id);
      if (!action) return prev;
      const units = Math.max(0, (prev[id] ?? 0) + delta);
      if (action.maxPerWeek !== undefined && units > action.maxPerWeek) {
        return prev;
      }
      const next = { ...prev, [id]: units };
      // The disabled state is computed from a possibly-stale render, so the
      // budget is enforced here too rather than trusted to the button.
      const total = career.actions.reduce(
        (sum, a) => sum + (next[a.id] ?? 0) * a.timeCost,
        0,
      );
      return total > budget ? prev : next;
    });
  };

  return (
    <div className={bare ? "" : "form"}>
      <div className="form-head flex items-center justify-between px-5 py-2.5">
        <h3 className="t-card text-ink">Your week</h3>
        <div className="flex items-center gap-2.5">
          {/* Blocks read as a rota strip: filled sessions against the week. */}
          <div className="flex gap-0.5" aria-hidden>
            {Array.from({ length: budget }).map((_, i) => (
              <span
                key={i}
                className={`h-3.5 w-2.5 border transition ${
                  i < spent
                    ? "border-clinical bg-clinical"
                    : "border-rule bg-card"
                }`}
              />
            ))}
          </div>
          <span className="num text-[12px] text-ink-soft">
            {remaining} left
          </span>
        </div>
      </div>

      <div className="divide-y divide-rule-soft">
        {career.actions
          .filter((a) => !a.unlocked || a.unlocked(state))
          .map((action) => {
            const units = alloc[action.id] ?? 0;
            const atMax =
              action.maxPerWeek !== undefined && units >= action.maxPerWeek;
            const canAdd = remaining >= action.timeCost && !atMax;
            return (
              <div
                key={action.id}
                className={`spine px-4 py-3.5 transition ${
                  units > 0 ? "bg-clinical-tint" : "bg-card"
                }`}
                style={{
                  ["--dept" as string]: units > 0 ? "#35E0C0" : "transparent",
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 ${units > 0 ? "text-clinical" : "text-ink-faint"}`}
                  >
                    <ActionIcon name={action.id} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <h4 className="text-[14px] font-semibold text-ink">
                        {action.label}
                      </h4>
                      {action.cashCost > 0 && (
                        <span className="num text-[12px] text-ink-faint">
                          {money(action.cashCost)}/block
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
                      {action.blurb}
                    </p>
                    <ul className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
                      {action.preview(state).map((line) => (
                        <li
                          key={line}
                          className="num rounded-sm bg-paper px-1.5 py-0.5 text-[12.5px] text-ink-soft"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex shrink-0 items-center">
                    <button
                      onClick={() => set(action.id, -1)}
                      disabled={units === 0}
                      aria-label={`Fewer blocks on ${action.label}`}
                      className="h-8 w-8 rounded-l-form border border-rule bg-card text-ink-soft transition hover:bg-clinical-tint disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="num flex h-8 w-9 items-center justify-center border-y border-rule bg-card text-sm font-medium">
                      {units}
                    </span>
                    <button
                      onClick={() => set(action.id, +1)}
                      disabled={!canAdd}
                      aria-label={`More blocks on ${action.label}`}
                      className="h-8 w-8 rounded-r-form border border-rule bg-card text-ink-soft transition hover:border-clinical hover:text-clinical disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
