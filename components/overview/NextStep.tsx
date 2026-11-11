"use client";

import type { Step } from "@/lib/ui/guidance";
import type { ScreenId } from "@/lib/ui/navigation";

/**
 * One instruction at a time, dismissible, and gone for good once dismissed.
 *
 * This is the whole of the tutorial: no modal, no overlay, no sequence to sit
 * through. The interface simply says the single most useful next thing, and
 * stops saying it when the player has moved on.
 */
export function NextStep({
  step,
  onDismiss,
  onNavigate,
}: {
  step: Step;
  onDismiss: (id: string) => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  return (
    <aside
      aria-label="Suggested next step"
      className="form border-clinical/40 bg-clinical-tint/60 p-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-clinical/60 text-[13px] font-bold text-clinical"
        >
          →
        </span>
        <div className="min-w-0 flex-1">
          <p className="sign text-[11.5px] text-clinical">Next step</p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-ink">
            {step.title}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
            {step.detail}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {step.destination && step.actionLabel && (
              <button
                onClick={() => onNavigate(step.destination!)}
                className="min-h-[40px] rounded-form bg-clinical px-4 text-[14px] font-semibold text-on-accent transition hover:brightness-110"
              >
                {step.actionLabel}
              </button>
            )}
            <button
              onClick={() => onDismiss(step.id)}
              className="min-h-[40px] rounded-form border border-rule px-4 text-[14px] text-ink-soft transition hover:border-clinical hover:text-clinical"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
