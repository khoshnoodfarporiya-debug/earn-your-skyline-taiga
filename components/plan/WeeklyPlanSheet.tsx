"use client";

import { useEffect, useRef } from "react";
import type { CareerDef, RunState } from "@/lib/game/types";
import type { Allocation } from "@/lib/game/engine";
import { money } from "@/lib/game/format";
import { cashTone } from "@/lib/ui/constraint";
import { ActionBoard } from "../ActionBoard";
import { QuickPlan } from "../overview/QuickPlan";

/**
 * THE WEEK, ONE TAP AWAY ON A PHONE (Phase 4).
 *
 * The desktop gets the plan as a persistent rail; a phone has no room for
 * that, so it gets a trigger pinned above the bottom navigation on every
 * screen except the Week itself (which already ends in the sticky commit
 * bar). The trigger opens this: a full-height sheet carrying the same
 * QuickPlan, the same steppers and the same commit the Week screen uses —
 * the same `alloc` state, so a block assigned here is a block assigned
 * everywhere.
 *
 * The dialog behaviour is the Phone's, deliberately: focus moves in, is
 * trapped, Escape closes, body scroll is held, and focus returns to the
 * trigger. Two overlays with two keyboard grammars would mean one of them
 * is wrong.
 */
export function WeeklyPlanSheet({
  career,
  state,
  alloc,
  budget,
  spent,
  lastWeek,
  onAllocate,
  onCommit,
  onClose,
  returnFocusTo,
}: {
  career: CareerDef;
  state: RunState;
  alloc: Allocation;
  budget: number;
  spent: number;
  lastWeek: Allocation | null;
  onAllocate: (updater: (prev: Allocation) => Allocation) => void;
  onCommit: () => void;
  onClose: () => void;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const remaining = budget - spent;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current
      ?.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]",
      )
      ?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusOnClose = returnFocusTo?.current ?? previouslyFocused;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = priorOverflow;
      focusOnClose?.focus?.();
    };
  }, [onClose, returnFocusTo]);

  return (
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-[#04080F]/75 backdrop-blur-[2px]">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Weekly plan"
        className="flex h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[20px] border-t border-rule bg-paper"
      >
        <div className="form-head flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <h2 className="sign text-[12px] text-ink">Weekly plan</h2>
            <p className="num text-[12px] text-ink-faint">
              {remaining === 0
                ? "fully planned"
                : `${remaining} of ${budget} block${budget === 1 ? "" : "s"} free`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] rounded-form border border-rule bg-card px-4 text-[13px] font-semibold text-ink transition hover:border-clinical/40"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <QuickPlan
            career={career}
            state={state}
            budget={budget}
            spent={spent}
            lastWeek={lastWeek}
            onApply={(next) => onAllocate(() => next)}
          />
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

        <div
          className="border-t border-rule p-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <button
            onClick={() => {
              onClose();
              onCommit();
            }}
            disabled={spent === 0}
            className="min-h-[48px] w-full rounded-form bg-clinical px-4 text-[15px] font-bold text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint"
          >
            {spent === 0
              ? "Assign your time first"
              : remaining > 0
                ? `Commit week — ${remaining} unused`
                : "Commit week"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The trigger: pinned above the bottom navigation on every screen but the
 * Week. One line of state so the player knows whether the week is planned
 * without opening anything.
 */
export function WeeklyPlanTrigger({
  state,
  spent,
  budget,
  buttonRef,
  onOpen,
}: {
  state: RunState;
  spent: number;
  budget: number;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
}) {
  const remaining = budget - spent;
  const tone = cashTone(state);
  return (
    <div
      className="fixed inset-x-0 bottom-[56px] z-30 border-t border-rule bg-[#0d1729]/95 px-3 py-2 backdrop-blur lg:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <button
        ref={buttonRef}
        onClick={onOpen}
        className="mx-auto flex min-h-[44px] w-full max-w-6xl items-center justify-between gap-3 rounded-form border border-rule bg-card px-4 text-left transition hover:border-clinical/40"
      >
        <span className="sign text-[12px] text-ink">Week plan</span>
        <span className="num flex items-baseline gap-2 text-[12px] text-ink-faint">
          <span
            className={
              tone === "alarm"
                ? "font-semibold text-alarm"
                : tone === "caution"
                  ? "font-semibold text-caution"
                  : ""
            }
          >
            {money(state.r.cash)}
          </span>
          <span>
            {remaining === 0
              ? "fully planned"
              : `${remaining} free`}
          </span>
        </span>
      </button>
    </div>
  );
}
