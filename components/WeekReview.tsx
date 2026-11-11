"use client";

import { useEffect, useRef } from "react";
import type { GameEventDef, LedgerLine, RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { EventVisual } from "./visuals/EventVisual";
import type { ScreenId } from "@/lib/ui/navigation";
import {
  changeGroups,
  isQuiet,
  type Change,
  type WeekChanges,
} from "@/lib/ui/whatChanged";

/**
 * The end-of-week result, as a proper modal dialog.
 *
 * Focus moves in on open, is trapped while it is up, and returns to whatever
 * opened it on close. Escape dismisses a quiet week; it deliberately does not
 * dismiss a week carrying an event, because the event is a decision the run
 * cannot continue without — there is nothing to escape *to*.
 */
export function WeekReview({
  week,
  ledger,
  event,
  state,
  changes,
  onChoose,
  onNavigate,
  onClose,
  returnFocusTo,
}: {
  week: number;
  ledger: LedgerLine[];
  event: { def: GameEventDef; body: string } | null;
  state: RunState;
  /** What moved and why, diffed against the state before the week resolved. */
  changes: WeekChanges;
  /** Closes the dialog and goes to the screen that deals with a change. */
  onNavigate: (screen: ScreenId) => void;
  onChoose: (index: number) => void;
  onClose: () => void;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  const net = ledger.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = "week-review-title";

  // Move focus in, trap it, and hand it back on the way out.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !event) {
        e.preventDefault();
        onClose();
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
    // The page behind must not scroll while a decision is pending.
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    /*
     * Resolved now, while the dialog is open, rather than in the cleanup. By
     * the time cleanup runs the ref may already point somewhere else — or at
     * a node React has unmounted — and focus would be handed to the wrong
     * element or dropped onto the body.
     */
    const focusOnClose = returnFocusTo?.current ?? previouslyFocused;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = priorOverflow;
      focusOnClose?.focus?.();
    };
  }, [event, onClose, returnFocusTo]);

  return (
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-[#04080F]/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="stamp-in form scroll-thin max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-b-none shadow-lift sm:max-h-[88vh] sm:rounded-form"
      >
        <div className="form-head sticky top-0 z-10 flex items-baseline justify-between px-5 py-3">
          <h2 id={headingId} className="sign text-[12px] text-clinical">
            Week {week} closed
          </h2>
          <p className="num text-[11.5px] text-ink-faint">RESULTS</p>
        </div>

        {/*
         * What changed, and why, above the ledger.
         *
         * The ledger below is complete and correct and answers none of the
         * questions a player actually has after a week: it says "Patient trust
         * −4" without saying that a third of arrivals were referred away. Each
         * line here carries the reason the simulation recorded at the time,
         * and a way to the screen that does something about it.
         */}
        {!isQuiet(changes) && (
          <div className="border-b border-rule px-5 py-4">
            {changeGroups(changes).map((group) => (
              <section key={group.title} className="mb-4 last:mb-0">
                <h3 className="t-label text-ink-faint">{group.title}</h3>
                <ul className="mt-2 space-y-2.5">
                  {group.items.map((c, i) => (
                    <li key={`${c.label}-${i}`}>
                      <ChangeLine
                        change={c}
                        onGo={(screen) => {
                          onClose();
                          onNavigate(screen);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="px-5 py-4">
          <h3 className="t-label mb-2 text-ink-faint">Every line</h3>
          <table className="w-full">
            <caption className="sr-only">
              Income and expenses for week {week}
            </caption>
            <tbody>
              {ledger.map((line, i) => (
                <tr key={i} className="border-b border-rule-soft last:border-0">
                  <td className="py-2.5 pr-3 align-top">
                    <span className="text-[14.5px] text-ink">{line.label}</span>
                    {line.note && (
                      <span className="num block text-[12.5px] text-ink-soft">
                        {line.note}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right align-top">
                    {line.amount !== undefined && (
                      <span
                        className={`num text-[14.5px] ${
                          line.amount >= 0 ? "text-good" : "text-ink"
                        }`}
                      >
                        {money(line.amount)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-rule">
                <td className="pt-3 text-[14px] font-semibold">
                  Net for the week
                </td>
                <td className="pt-3 text-right">
                  <span
                    className={`num text-xl font-semibold ${
                      net >= 0 ? "text-good" : "text-alarm"
                    }`}
                  >
                    {money(net)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {event ? (
          <div
            className="spine border-t border-rule bg-paper"
            /* Tokens, not the pre-redesign hexes that were left behind here —
               #FF6B6B / #4ADE80 / #FFB020 are a palette the rest of the game
               no longer uses. */
            style={{
              ["--dept" as string]:
                event.def.tone === "bad"
                  ? "#EF6461"
                  : event.def.tone === "good"
                    ? "#43C78B"
                    : "#F59E55",
            }}
          >
            {/* Present only for events the registry has artwork for. */}
            <EventVisual eventId={event.def.id} tone={event.def.tone} />
            <div className="px-5 py-5">
              <p
                className={`sign text-[11.5px] ${
                  event.def.tone === "bad"
                    ? "text-alarm"
                    : event.def.tone === "good"
                      ? "text-good"
                      : "text-caution"
                }`}
              >
                {event.def.tone === "bad"
                  ? "Bad news"
                  : event.def.tone === "good"
                    ? "Good news"
                    : "Something came up"}
              </p>
              <h3 className="display mt-2 text-xl">{event.def.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
                {event.body}
              </p>

              <div className="mt-4 space-y-2">
                {event.def.choices.map((choice, i) => {
                  const ok = !choice.affordable || choice.affordable(state);
                  return (
                    /*
                     * A choice you cannot afford stays fully readable. It used
                     * to render at 40% opacity, which hid the very line that
                     * explains what you are being denied — and an event choice
                     * is exactly where the player needs to understand the
                     * option they are losing.
                     */
                    <button
                      key={i}
                      onClick={() => onChoose(i)}
                      disabled={!ok}
                      className={`min-h-[52px] w-full rounded-form px-4 py-3 text-left transition disabled:cursor-not-allowed ${
                        ok ? "bg-card-high hover:bg-clinical-tint" : "bg-card"
                      }`}
                    >
                      <span
                        className={`block text-[14.5px] font-semibold ${ok ? "text-ink" : "text-ink-faint"}`}
                      >
                        {choice.label}
                      </span>
                      <span className="num block text-[12.5px] text-ink-soft">
                        {choice.detail}
                        {!ok && (
                          <span className="text-caution">
                            {" "}
                            — you cannot afford this
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="border-t border-rule bg-paper px-5 py-5"
            style={{
              paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
            }}
          >
            {/* Only claim a quiet week when the summary above found nothing.
                It used to say "nothing went wrong" underneath a list of the
                things that had gone wrong. */}
            <p className="text-[14.5px] leading-relaxed text-ink-soft">
              {isQuiet(changes)
                ? "A quiet week. Nothing went wrong, which is its own kind of result."
                : "No event to decide this week. Everything above happened on its own."}
            </p>
            <button
              onClick={onClose}
              className="mt-4 min-h-[52px] w-full rounded-form bg-clinical px-4 text-[15px] font-bold text-on-accent transition hover:brightness-110"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One movement, with its cause attached.
 *
 * The severity word is spelled out rather than carried by colour alone, and
 * the reason is the same size as the number — because the reason is the part
 * that tells you what to do differently next week.
 */
function ChangeLine({
  change,
  onGo,
}: {
  change: Change;
  onGo: (screen: ScreenId) => void;
}) {
  const tone =
    change.tone === "good"
      ? "text-good"
      : change.tone === "bad"
        ? "text-alarm"
        : "text-ink-soft";
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-[13.5px] font-semibold text-ink">
        {change.label}
      </span>
      <span className={`num text-[13.5px] ${tone}`}>{change.value}</span>
      <p className="w-full text-[13px] leading-snug text-ink-soft">
        {change.because}
      </p>
      {change.go && (
        <button
          type="button"
          onClick={() => onGo(change.go!.destination)}
          className="mt-1 min-h-[44px] rounded-form bg-card-high px-3 text-[12.5px] text-clinical transition hover:text-clinical-hover"
        >
          {change.go.label}
        </button>
      )}
    </div>
  );
}
