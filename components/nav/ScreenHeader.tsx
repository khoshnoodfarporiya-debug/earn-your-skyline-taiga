"use client";

import { useState } from "react";
import type { RunState } from "@/lib/game/types";
import type { ScreenId } from "@/lib/ui/navigation";
import { TONE_WORD, orient, type StatusTone } from "@/lib/ui/orientation";

/**
 * WHERE YOU ARE, AND WHAT IS TRUE HERE
 *
 * One header for every non-Overview screen, carrying five things in a fixed
 * order so a player learns to read it once:
 *
 *   1. breadcrumb   Practice / Caseload      — where am I
 *   2. title        Last week's patients     — what is this
 *   3. purpose      one sentence             — what is it for
 *   4. status       derived from real state  — what is happening
 *   5. action       the screen that fixes it — what can I do
 *
 * The status line is the reason this component exists. The purpose lines were
 * already there and were static: "Who does the work, and what they cost you"
 * reads identically whether the team is thriving or three technicians short.
 * The status is computed per screen from the actual run, so arriving on Staff
 * with a machine nobody can operate tells you that, at the top, before you
 * have read anything else.
 *
 * -------------------------------------------------------------- hierarchy
 *
 * Level 1 only. The status names the problem and the action names the fix;
 * everything else — costs, comparisons, formulas — belongs in the panels
 * below or behind the help disclosure, never all at once.
 *
 * Severity is carried by an explicit word as well as a colour, because
 * "Needs attention" has to survive a monochrome screen.
 */
export function ScreenHeader({
  state,
  screen,
  onNavigate,
  compact = false,
}: {
  state: RunState;
  screen: ScreenId;
  /** Always the player's choice — nothing here navigates on its own. */
  onNavigate: (screen: ScreenId) => void;
  /**
   * Drop the breadcrumb, title and purpose, keeping only the status block.
   * For the handful of screens that already carry an illustrated banner with
   * those same three lines — repeating them would be noise, but the status is
   * the part the banner cannot compute.
   */
  compact?: boolean;
}) {
  const o = orient(state, screen);
  const [helpOpen, setHelpOpen] = useState(false);
  const hasHelp = o.help.length > 0;

  return (
    <header className="mb-4">
      {!compact && (
        <>
          {/* 1 — where am I */}
          <p className="t-label text-ink-faint">
            <span>{o.section}</span>
            <span aria-hidden className="mx-1.5 text-rule">
              /
            </span>
            <span className="text-ink-soft">{o.screen}</span>
          </p>

          {/* 2 — what is this */}
          <h2 className="t-section mt-1 text-ink">{o.screen}</h2>

          {/* 3 — what is it for */}
          <p className="mt-0.5 text-[13.5px] leading-snug text-ink-soft">
            {o.purpose}
          </p>
        </>
      )}

      {/* 4 and 5 — what is happening, and what to do about it */}
      {o.status && (
        <div
          className={`${compact ? "" : "mt-3"} rounded-form px-4 py-3 ${TONE_SKIN[o.tone]}`}
          /* Announced when it changes, so a screen reader user is told the
             situation on arrival rather than having to hunt for it. */
          role="status"
        >
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className={`t-label ${TONE_TEXT[o.tone]}`}>
                {TONE_WORD[o.tone]}
              </p>
              <p className="mt-0.5 text-[14px] leading-snug text-ink">
                {o.status}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {o.primary && (
                <button
                  type="button"
                  onClick={() => onNavigate(o.primary!.destination)}
                  className="min-h-[44px] rounded-form bg-clinical px-4 text-[13px] font-semibold text-on-accent transition hover:bg-clinical-hover"
                >
                  {o.primary.label}
                </button>
              )}
              {hasHelp && (
                <button
                  type="button"
                  onClick={() => setHelpOpen(!helpOpen)}
                  aria-expanded={helpOpen}
                  /* A real labelled control rather than a hover-only tooltip:
                     hover does not exist on a phone and is not reachable by
                     keyboard. */
                  className="min-h-[44px] rounded-form bg-card-high px-4 text-[13px] text-ink-soft transition hover:text-ink"
                >
                  {/* The label does not change when it opens. `aria-expanded`
                      already announces the state, and a control that renames
                      itself is a control the player has to re-find. */}
                  Help
                  <span aria-hidden className="ml-1.5 text-ink-faint">
                    {helpOpen ? "−" : "+"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Level 3 — available, never dominant. */}
          {helpOpen && (
            <dl className="mt-3 space-y-3 border-t border-rule-soft pt-3">
              {o.help.map((h) => (
                <div key={h.question}>
                  <dt className="text-[13px] font-semibold text-ink">
                    {h.question}
                  </dt>
                  <dd className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">
                    {h.answer}
                  </dd>
                  {h.go && (
                    <dd className="mt-1.5">
                      <button
                        type="button"
                        onClick={() => onNavigate(h.go!.destination)}
                        className="min-h-[36px] rounded-form bg-paper px-3 text-[12.5px] text-clinical transition hover:text-clinical-hover"
                      >
                        {h.go.label}
                      </button>
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </header>
  );
}

const TONE_SKIN: Record<StatusTone, string> = {
  critical: "bg-alarm-tint",
  warning: "bg-caution-tint",
  good: "bg-card",
  neutral: "bg-card",
};

const TONE_TEXT: Record<StatusTone, string> = {
  critical: "text-alarm",
  warning: "text-caution",
  good: "text-good",
  neutral: "text-ink-faint",
};
