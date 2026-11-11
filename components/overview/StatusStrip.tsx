"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { cashTone, weeklyBurnFor } from "@/lib/ui/constraint";

/**
 * The four numbers a player should never have to hunt for: what week it is,
 * what is in the bank, what it costs to exist, and how much of the week is
 * still unspent.
 *
 * Sticky under the header so it stays true while scrolling a long screen.
 */
export function StatusStrip({
  state,
  spent,
  budget,
}: {
  state: RunState;
  spent: number;
  budget: number;
}) {
  /* Career-dispatched since Phase 4: the Chef's rent and wages, the
     Solicitor's chambers and salaries, the Physician's costs — each from its
     own model. Null means the career states its constraint its own way. */
  const burn = weeklyBurnFor(state) ?? 0;
  const remaining = budget - spent;

  const cells = [
    {
      label: "Week",
      value: `${state.week}`,
      /* Not "of 156". Week 156 stopped being an ending, and a denominator
         reads as a deadline no matter what the objective text says. */
      sub: `year ${Math.floor((state.week - 1) / 52) + 1}`,
      tone: "plain" as const,
    },
    {
      label: "Cash",
      value: money(state.r.cash),
      /* "No fixed costs" is only claimable when the career's own model says
         the burn is genuinely zero — a Physician before the first lease. A
         career that states its constraint elsewhere shows cash alone. */
      sub:
        burn > 0
          ? `${money(burn)}/wk out`
          : weeklyBurnFor(state) === 0
            ? "no fixed costs"
            : "",
      tone: cashTone(state),
    },
    {
      label: "Debt",
      value: money(state.r.debt),
      sub: state.r.debt > 0 ? "half the objective" : "cleared",
      tone: state.r.debt > 0 ? "plain" : "good",
    },
    {
      label: "Time left",
      value: `${remaining}`,
      sub: `of ${budget} blocks`,
      tone: remaining === 0 ? "good" : remaining === budget ? "caution" : "plain",
    },
  ] as const;

  const toneClass = {
    plain: "text-ink",
    good: "text-good",
    caution: "text-caution",
    alarm: "text-alarm",
  };

  return (
    <div className="form sticky top-2 z-30 overflow-hidden">
      {/* A definition list, because that is what these are: four labelled
          values. It also gives each number an accessible name of its own,
          rather than a bare digit floating under a caption. */}
      <dl className="grid grid-cols-2 gap-px bg-rule-soft sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="bg-card px-3 py-2.5 sm:px-4">
            <dt className="sign text-[11.5px] text-ink-faint">{c.label}</dt>
            <dd
              aria-label={`${c.label}: ${c.value} ${c.sub}`}
              className={`num mt-0.5 text-[19px] font-semibold leading-tight tracking-tight sm:text-[22px] ${toneClass[c.tone]}`}
            >
              {c.value}
            </dd>
            <dd aria-hidden className="mt-0.5 text-[12px] leading-none text-ink-faint">
              {c.sub}
            </dd>
          </div>
        ))}
      </dl>
      {/*
       * The hairline here used to be week ÷ 156 — a countdown bar for a clock
       * that no longer runs out. It read as "you are 70% out of time" when the
       * true statement is "you are 70% of the way through your third year",
       * which is not something a bar filling toward its end should say. The
       * objective has its own progress meter on the Overview, and that one
       * measures something a player can move.
       */}
    </div>
  );
}
