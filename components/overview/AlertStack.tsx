"use client";

import type { Alert } from "@/lib/ui/alerts";
import type { ScreenId } from "@/lib/ui/navigation";

/**
 * Urgent decisions, above everything else on the page and linked straight to
 * the screen that resolves them.
 *
 * Severity is carried by an icon glyph and a written label as well as colour,
 * so it survives both colour-blindness and a greyscale screenshot.
 */

const STYLE = {
  critical: {
    ring: "border-alarm/60",
    tint: "bg-alarm-tint",
    text: "text-alarm",
    glyph: "!",
    word: "Critical",
  },
  warning: {
    ring: "border-caution/50",
    tint: "bg-caution-tint",
    text: "text-caution",
    glyph: "▲",
    word: "Warning",
  },
  info: {
    ring: "border-rule",
    tint: "bg-card",
    text: "text-ink-soft",
    glyph: "i",
    word: "Note",
  },
} as const;

export function AlertStack({
  alerts,
  remaining = 0,
  onNavigate,
}: {
  alerts: Alert[];
  /** How many more were found but deliberately not shown here. */
  remaining?: number;
  onNavigate: (screen: ScreenId) => void;
}) {
  if (alerts.length === 0) return null;

  return (
    <section aria-label="Needs attention" className="space-y-2">
      {alerts.map((alert) => {
        const s = STYLE[alert.severity];
        return (
          <div
            key={alert.id}
            className={`form ${s.tint} ${s.ring} flex flex-wrap items-start gap-x-3 gap-y-2 p-3.5 sm:flex-nowrap sm:items-center`}
          >
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold ${s.ring} ${s.text}`}
            >
              {s.glyph}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`sign text-[11.5px] ${s.text}`}>
                {s.word}
                <span className="sr-only">: </span>
              </p>
              <p className="mt-0.5 text-[14px] font-semibold leading-snug text-ink">
                {alert.title}
              </p>
              <p className="mt-0.5 text-[13.5px] leading-snug text-ink-soft">
                {alert.detail}
              </p>
            </div>
            <button
              onClick={() => onNavigate(alert.destination)}
              className="min-h-[44px] w-full shrink-0 rounded-form border border-rule bg-card px-4 text-[14px] font-medium text-ink transition hover:border-clinical hover:text-clinical sm:w-auto"
            >
              {alert.actionLabel}
            </button>
          </div>
        );
      })}

      {/* The rest are not hidden, they are filed. Saying so is the difference
          between a shortened list and a list that looks broken. */}
      {remaining > 0 && (
        <p className="px-1 text-[12.5px] text-ink-faint">
          {remaining} more thing{remaining === 1 ? "" : "s"} need
          {remaining === 1 ? "s" : ""} attention. The badges on the navigation
          say where.
        </p>
      )}
    </section>
  );
}
