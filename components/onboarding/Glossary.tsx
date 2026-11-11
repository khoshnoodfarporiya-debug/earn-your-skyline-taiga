"use client";

import { useEffect, useRef, useState } from "react";
import { glossaryFor } from "@/lib/ui/glossary";
import type { Lesson } from "@/lib/ui/onboarding";
import type { ScreenId } from "@/lib/ui/navigation";
import { MedIcon } from "../visuals/MedIcon";

/**
 * THE WORDS, AND THE LESSONS, IN ONE PLACE
 *
 * Two things a player might want back after dismissing them: what a word means,
 * and a lesson they closed too quickly. Both are reference material rather than
 * gameplay, so both live behind one control instead of taking permanent space.
 *
 * A dialog rather than a screen, for the same reason the phone is a dialog: it
 * is something you consult mid-decision and close, not somewhere you go.
 *
 * ------------------------------------------------------------------ focus
 *
 * Focus moves in on open, is trapped while it is up, and returns to the button
 * that opened it. Escape closes — unlike the weekly review, there is nothing
 * here the run is waiting on.
 */
export function Glossary({
  careerId,
  lessons,
  onReopen,
  onClose,
  onNavigate,
  returnFocusTo,
}: {
  /** Whose vocabulary to show. The words are not shared between careers. */
  careerId: string;
  /** Every lesson with whether the player has already got past it. */
  lessons: { lesson: Lesson; done: boolean }[];
  /** Un-dismiss a lesson so it shows again on its own screen. */
  onReopen: (id: string) => void;
  onClose: () => void;
  onNavigate: (screen: ScreenId) => void;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const terms = glossaryFor(careerId);
  const [tab, setTab] = useState<"words" | "lessons">("words");
  const headingId = "glossary-title";

  useEffect(() => {
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const returnTo = returnFocusTo?.current;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = priorOverflow;
      returnTo?.focus();
    };
  }, [onClose, returnFocusTo]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-void/80 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="stamp-in form scroll-thin max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-b-none shadow-lift sm:max-h-[88vh] sm:rounded-form"
      >
        <div className="form-head sticky top-0 z-10 flex items-center justify-between gap-2 px-5 py-3">
          <h2 id={headingId} className="sign text-[12px] text-clinical">
            What the words mean
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-form px-3 text-[13px] text-ink-soft transition hover:text-ink"
          >
            Close
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Reference"
          className="flex gap-1 border-b border-rule px-5 py-2.5"
        >
          {(
            [
              ["words", "Words"],
              ["lessons", "Lessons"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`sign min-h-[44px] rounded-form border px-4 text-[11.5px] transition ${
                tab === id
                  ? "border-clinical/60 bg-clinical-tint text-clinical"
                  : "border-rule bg-card text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "words" ? (
          <dl className="divide-y divide-rule-soft">
            {terms.map((t) => (
              <div key={t.id} className="px-5 py-3">
                <dt className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[13.5px] font-semibold text-ink">
                    {t.plain}
                  </span>
                  {/* The professional word is kept, never replaced — every
                      one of these is a real trade with a real vocabulary, and
                      the vocabulary is part of playing it. */}
                  <span className="num text-[12px] text-ink-faint">
                    the game calls this &ldquo;{t.term.toLowerCase()}&rdquo;
                  </span>
                </dt>
                <dd className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">
                  {t.detail}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <ul className="divide-y divide-rule-soft">
            {lessons.map(({ lesson, done }) => (
              <li key={lesson.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[13.5px] font-semibold text-ink">
                    {lesson.title}
                  </h3>
                  <span
                    className={`t-label ${done ? "text-good" : "text-ink-faint"}`}
                  >
                    {done ? "Done" : "Waiting"}
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">
                  {lesson.intro}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onReopen(lesson.id);
                      onNavigate(lesson.screen);
                      onClose();
                    }}
                    className="min-h-[44px] rounded-form bg-card-high px-3.5 text-[12.5px] text-clinical transition hover:text-clinical-hover"
                  >
                    Show it again
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p
          className="border-t border-rule bg-paper px-5 py-3 text-[12px] leading-relaxed text-ink-faint"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <MedIcon name="certificate" className="mr-1.5 inline h-3.5 w-3.5" />
          Lessons appear on the screen they are about, at the point that system
          starts to matter, and stop once you have done the thing they describe.
        </p>
      </div>
    </div>
  );
}
