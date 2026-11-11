"use client";

/**
 * The primary action, pinned within thumb reach on mobile.
 *
 * The weekly allocation list is long enough that the commit button sat about
 * 1,700px down the page — the single most important control in the game, five
 * screens below the fold. On mobile it now rides above the nav bar with the
 * two numbers needed to decide whether to press it; on desktop, where the
 * whole loop fits on screen, the inline button in the forecast card is enough
 * and this is hidden.
 */
export function CommitBar({
  spent,
  budget,
  headline,
  onCommit,
}: {
  spent: number;
  budget: number;
  /** The projected-net figure from the briefing, if the career supplies one. */
  headline?: { label: string; value: string; tone: "good" | "bad" | "neutral" };
  onCommit: () => void;
}) {
  const remaining = budget - spent;
  const ready = spent > 0;

  return (
    <div
      /* Hides at the same breakpoint the bottom nav does, or it would float
         above empty space on tablet. */
      className="fixed inset-x-0 bottom-[56px] z-30 border-t border-rule bg-[#0d1729]/95 px-3 py-2.5 backdrop-blur lg:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="sign text-[11.5px] text-ink-faint">
            {remaining === 0 ? "Week planned" : `${remaining} of ${budget} free`}
          </p>
          {headline && (
            <p
              className={`num truncate text-[15px] font-semibold leading-tight ${
                headline.tone === "good"
                  ? "text-good"
                  : headline.tone === "bad"
                    ? "text-alarm"
                    : "text-ink"
              }`}
            >
              {headline.value}
              <span className="ml-1.5 text-[12px] font-normal text-ink-faint">
                {headline.label.toLowerCase()}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={onCommit}
          disabled={!ready}
          className="min-h-[48px] shrink-0 rounded-form bg-clinical px-6 text-[15px] font-bold text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint"
        >
          {ready ? "Commit week" : "Assign time"}
        </button>
      </div>
    </div>
  );
}
