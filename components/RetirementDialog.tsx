"use client";

import { useEffect, useRef, useState } from "react";
import type { RunState } from "@/lib/game/types";
import type { RetirementSummary } from "@/lib/game/retirement";
import { money } from "@/lib/game/format";
import { ActionButton } from "./ui/ItemCard";

/**
 * RETIREMENT
 *
 * The one place a run can end, and it takes three deliberate actions to get
 * through: open it, read it, and type-free confirm.
 *
 * Everything about this dialog is built around the cancel path being the easy
 * one. The primary button is "Keep going", Escape cancels, the confirm button
 * is the quiet variant, and nothing is written until it is pressed. A player
 * who opens this out of curiosity must be able to leave without consequence —
 * that is the difference between optional retirement and a trap.
 */
export function RetirementDialog({
  summary,
  state,
  onCancel,
  onConfirm,
}: {
  summary: RetirementSummary;
  state: RunState;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = "retire-title";

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea, [href], input, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        /* Escape cancels. Deliberately: the destructive action must never be
           the one that happens when you stop paying attention. */
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
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
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = priorOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onCancel]);

  const a = summary.archive;

  return (
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-[#04080F]/75 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="stamp-in form scroll-thin max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none shadow-lift sm:max-h-[88vh] sm:rounded-form"
      >
        <div className="form-head sticky top-0 z-10 flex items-baseline justify-between px-5 py-3">
          <h2 id={headingId} className="sign text-[12px] text-clinical">
            Retire {a.name}?
          </h2>
          <p className="num text-[11.5px] text-ink-faint">
            week {a.weeks}
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            Retiring ends this character&apos;s story and writes them into your
            Career Archive. The save is kept and stays readable — but you will
            not be able to play another week as them.
          </p>
          <p className="num mt-2 text-[13px] text-clinical">
            Nothing is written until you press the button at the bottom.
          </p>

          {/* ------------------------------------------------ the summary */}
          <h3 className="t-label mt-5 text-ink-faint">What this career was</h3>
          <ul className="mt-2 space-y-1.5">
            {summary.highlights.map((h) => (
              <li key={h} className="text-[14px] leading-snug text-ink">
                {h}
              </li>
            ))}
          </ul>

          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-form bg-rule-soft sm:grid-cols-4">
            <Cell label="Weeks" value={String(a.weeks)} />
            <Cell label="Net worth" value={money(a.netWorth)} />
            <Cell label="Cities" value={String(a.cities.length)} />
            <Cell label="Standing" value={String(a.overall)} />
          </dl>

          <h3 className="t-label mt-5 text-ink-faint">How you were seen</h3>
          <ul className="mt-2 space-y-1">
            {a.reputation.map((r) => (
              <li key={r.id} className="flex items-baseline gap-3">
                <span className="num w-10 shrink-0 text-[12.5px] text-ink">
                  {r.value}
                </span>
                <span className="text-[13px] text-ink-soft">{r.label}</span>
              </li>
            ))}
          </ul>

          {a.milestones.length > 0 && (
            <>
              <h3 className="t-label mt-5 text-ink-faint">
                Moments from the timeline
              </h3>
              <ul className="mt-2 space-y-1.5">
                {a.milestones.slice(-8).map((m, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="num shrink-0 text-[12px] text-ink-faint">
                      wk {m.week}
                    </span>
                    <span className="min-w-0 text-[13px] leading-snug text-ink-soft">
                      <span className="text-ink">{m.title}</span> — {m.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {a.setbacksSurvived.length > 0 && (
            <p className="num mt-4 text-[13px] text-good">
              Came back from: {a.setbacksSurvived.join(", ").toLowerCase()}.
            </p>
          )}

          {summary.legacy && (
            <div className="mt-5 rounded-form bg-card-high px-4 py-3">
              <p className="t-label text-clinical">What they leave behind</p>
              <p className="mt-1 text-[14px] font-semibold text-ink">
                {summary.legacy.label}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
                {summary.legacy.blurb}
              </p>
              <p className="num mt-1.5 text-[12.5px] text-ink-faint">
                Your next character could start with: {summary.legacy.detail}
              </p>
            </div>
          )}

          <label className="mt-5 block">
            <span className="t-label text-ink-faint">
              A line for the archive, if you want one
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 240))}
              rows={2}
              placeholder="Why you stopped."
              className="mt-1.5 w-full rounded-form bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-ink-faint"
            />
          </label>
        </div>

        <div
          className="sticky bottom-0 flex flex-wrap gap-2 border-t border-rule bg-card px-5 py-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {/* The easy path is the one that changes nothing. */}
          <ActionButton onClick={onCancel}>Keep going</ActionButton>
          <ActionButton variant="danger" onClick={() => onConfirm(note)}>
            Retire {a.name}
          </ActionButton>
          <span className="self-center text-[12.5px] text-ink-soft">
            {state.week} weeks. There is no deadline on this decision.
          </span>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-3 py-2">
      <dt className="t-label text-ink-faint">{label}</dt>
      <dd className="num mt-0.5 text-[15px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
