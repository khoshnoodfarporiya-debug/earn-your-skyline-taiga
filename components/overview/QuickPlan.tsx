"use client";

import type { CareerDef, RunState } from "@/lib/game/types";
import type { Allocation } from "@/lib/game/engine";

/**
 * QUICK PLAN
 *
 * One tap to fill the week.
 *
 * The allocation board is five rows of steppers, and a full week is six
 * blocks — so committing a single week could take six precise clicks on small
 * targets, one hundred and fifty-six times a run. Most of those weeks are the
 * same week: the player has a plan and is re-entering it.
 *
 * So: repeat what you did last week, or take a named plan, and adjust from
 * there. The steppers remain for the weeks that actually differ, which is the
 * point — this removes the repetition, not the decision.
 *
 * Nothing here changes what an action does. Every plan is expressed purely in
 * blocks the player could have assigned by hand.
 */

export interface Plan {
  id: string;
  label: string;
  hint: string;
  /** Blocks per action id, filled in order until the budget runs out. */
  weights: Record<string, number>;
}

/**
 * Plans are per-career because the actions are. A career with no matching
 * action ids simply gets fewer plans rather than a broken one.
 */
export const PLANS: Plan[] = [
  {
    id: "clinic",
    label: "Career focus",
    hint: "Everything into clinical hours",
    weights: { clinic: 6 },
  },
  {
    id: "balanced",
    label: "Balanced",
    hint: "Clinic, admin, study, and the people who matter",
    weights: { clinic: 3, manage: 1, study: 1, people: 1 },
  },
  {
    id: "grow",
    label: "Growth",
    hint: "Demand, profile and the profession",
    weights: { outreach: 2, clinic: 2, network: 1, content: 1 },
  },
  {
    id: "recover",
    label: "Recovery",
    hint: "Rest and exercise first, then whatever fits",
    weights: { rest: 3, exercise: 2, clinic: 1 },
  },
];

/**
 * Which actions this run can actually spend on.
 *
 * The board filters by `unlocked` before rendering, so a plan that ignored it
 * would produce an allocation containing an action with no stepper — the
 * player would see five blocks assigned and only be able to find four. Every
 * plan helper goes through here for that reason.
 */
const availableActions = (career: CareerDef, state: RunState) =>
  career.actions.filter((a) => !a.unlocked || a.unlocked(state));

/** Spread a plan across the real budget, skipping actions this run cannot use. */
export function applyPlan(
  career: CareerDef,
  plan: Plan,
  budget: number,
  state: RunState,
): Allocation {
  const actions = availableActions(career, state);
  const out: Allocation = {};
  let left = budget;
  for (const [id, want] of Object.entries(plan.weights)) {
    const action = actions.find((a) => a.id === id);
    if (!action || left <= 0) continue;
    const cap = action.maxPerWeek ?? Infinity;
    const units = Math.min(want, left, cap);
    if (units > 0) {
      out[id] = units;
      left -= units;
    }
  }
  /* Anything left over goes to the first action that will take it, so a plan
     always spends the whole week rather than leaving blocks stranded. The
     per-week caps are respected here too, which is what stops "Recovery" from
     quietly becoming six blocks of rest once exercise fills up. */
  if (left > 0) {
    for (const action of actions) {
      const cap = action.maxPerWeek ?? Infinity;
      const room = Math.min(left, cap - (out[action.id] ?? 0));
      if (room > 0) {
        out[action.id] = (out[action.id] ?? 0) + room;
        left -= room;
      }
      if (left <= 0) break;
    }
  }
  return out;
}

/**
 * Fit a remembered plan to the week in front of you.
 *
 * Last week's allocation is not automatically legal this week: the time
 * budget moves with burnout and lifestyle, an action can have a per-week cap,
 * and a plan restored from storage may name an action this career does not
 * have. Rather than refuse to repeat, take as much of it as fits, in the
 * career's own action order so the important work is kept and the tail is
 * what gets trimmed.
 */
export function clampPlan(
  career: CareerDef,
  plan: Allocation,
  budget: number,
  state: RunState,
): Allocation {
  const out: Allocation = {};
  let left = budget;
  for (const action of availableActions(career, state)) {
    const want = plan[action.id] ?? 0;
    if (want <= 0 || left <= 0) continue;
    const units = Math.min(want, left, action.maxPerWeek ?? Infinity);
    if (units > 0) {
      out[action.id] = units;
      left -= units;
    }
  }
  return out;
}

export function QuickPlan({
  career,
  state,
  budget,
  spent,
  lastWeek,
  onApply,
}: {
  career: CareerDef;
  state: RunState;
  budget: number;
  spent: number;
  /** What was committed last week, if this is not week one. */
  lastWeek: Allocation | null;
  onApply: (next: Allocation) => void;
}) {
  const available = PLANS.filter((p) =>
    Object.keys(p.weights).some((id) =>
      availableActions(career, state).some((a) => a.id === id),
    ),
  );
  const repeat = lastWeek ? clampPlan(career, lastWeek, budget, state) : {};
  const canRepeat = Object.values(repeat).some((n) => n > 0);

  /*
   * A one-tap button that ends the run is not a convenience.
   *
   * Burnout at 100 is an immediate loss, so once it is already high a plan
   * with no rest in it deserves a mark — the same threshold the alert panel
   * uses, so the two never disagree. The button still works: this is a
   * warning, not a veto, because riding burnout for one more productive week
   * is a real decision and the game should let you make it.
   */
  const burnout = state.r.burnout ?? 0;
  const risky = (a: Allocation) => burnout >= 68 && (a.rest ?? 0) === 0;
  const warnLabel = `Burnout is ${Math.round(burnout)} and this week has no rest in it`;

  const describe = (a: Allocation) =>
    career.actions
      .filter((x) => (a[x.id] ?? 0) > 0)
      .map((x) => `${a[x.id]} ${x.label.toLowerCase()}`)
      .join(", ");

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-rule-soft px-4 py-3">
      <span className="t-label mr-1 text-ink-faint">Quick plan</span>

      {canRepeat && (
        <button
          type="button"
          onClick={() => onApply(repeat)}
          title={
            risky(repeat)
              ? `${warnLabel}. Repeat: ${describe(repeat)}`
              : `Repeat: ${describe(repeat)}`
          }
          className="min-h-[36px] rounded-form bg-clinical px-3 text-[13px] font-semibold text-on-accent transition hover:bg-clinical-hover"
        >
          Repeat last week
          {risky(repeat) && (
            <span className="ml-1.5 text-caution" aria-hidden>
              ⚠
            </span>
          )}
        </button>
      )}

      {available.map((p) => {
        const filled = applyPlan(career, p, budget, state);
        const warn = risky(filled);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onApply(filled)}
            title={warn ? `${p.hint} — ${warnLabel}` : p.hint}
            className={`min-h-[36px] rounded-form px-3 text-[13px] transition ${
              warn
                ? "bg-caution-tint text-caution hover:text-ink"
                : "bg-card-high text-ink-soft hover:text-ink"
            }`}
          >
            {p.label}
            {warn && (
              <>
                <span className="ml-1.5" aria-hidden>
                  ⚠
                </span>
                <span className="sr-only"> — {warnLabel}</span>
              </>
            )}
          </button>
        );
      })}

      {spent > 0 && (
        <button
          type="button"
          onClick={() => onApply({})}
          className="ml-auto min-h-[36px] rounded-form px-3 text-[13px] text-ink-faint transition hover:text-alarm"
        >
          Clear
        </button>
      )}

      <span className="sr-only" aria-live="polite">
        {spent} of {budget} blocks assigned in week {state.week}
      </span>
    </div>
  );
}
