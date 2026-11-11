"use client";

import type { Lesson } from "@/lib/ui/onboarding";
import type { ScreenId } from "@/lib/ui/navigation";
import { MedIcon } from "../visuals/MedIcon";

/**
 * ONE LESSON, ON THE SCREEN IT IS ABOUT
 *
 * Not a modal. A modal stops the game to talk about the game, and the first
 * thing a player learns from one is where the close button is.
 *
 * This sits at the top of the screen whose system it explains, above the panels
 * it is describing, and it is dismissible. It also retires itself when the
 * player does the thing — see `learned` in `lib/ui/onboarding.ts` — so the
 * common case is that it is never dismissed at all, it simply stops being
 * relevant.
 *
 * ---------------------------------------------------------------- the shape
 *
 * A title, one line of framing, then two to five term/meaning pairs as a
 * description list. The terms are the labels the interface actually uses, so
 * reading the card is reading the screen underneath it.
 *
 * Gold rather than teal: this is the one thing on screen that is neither a
 * problem nor an action, and it should not compete with the alert stack.
 */
export function LessonCard({
  lesson,
  onDismiss,
  onNavigate,
}: {
  lesson: Lesson;
  onDismiss: () => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  return (
    <section
      aria-labelledby={`lesson-${lesson.id}`}
      className="form border border-gold/30 bg-gold-tint"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pb-1 pt-4">
        <div className="min-w-0">
          <p className="t-label flex items-center gap-1.5 text-gold">
            <MedIcon name="certificate" className="h-3.5 w-3.5" />
            Learning the ropes
          </p>
          <h3 id={`lesson-${lesson.id}`} className="t-card mt-1 text-ink">
            {lesson.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[44px] shrink-0 rounded-form bg-card-high px-3.5 text-[12.5px] text-ink-soft transition hover:text-ink"
        >
          {/* Not "Got it" — the next-step card below already uses that,
              and two identically-labelled buttons on one screen is a
              coin toss rather than a choice. */}
          Hide this
        </button>
      </div>

      <p className="px-5 pt-1 text-[13px] leading-relaxed text-ink-soft">
        {lesson.intro}
      </p>

      <dl className="space-y-2.5 px-5 py-3.5">
        {lesson.points.map((p) => (
          <div key={p.term}>
            <dt className="text-[13px] font-semibold text-ink">{p.term}</dt>
            <dd className="mt-0.5 max-w-[68ch] text-[12.5px] leading-relaxed text-ink-soft">
              {p.detail}
            </dd>
          </div>
        ))}
      </dl>

      {lesson.action && (
        <div className="px-5 pb-4">
          <button
            type="button"
            onClick={() => onNavigate(lesson.action!.destination)}
            className="min-h-[44px] rounded-form bg-clinical px-4 text-[13px] font-semibold text-on-accent transition hover:bg-clinical-hover"
          >
            {lesson.action.label}
          </button>
        </div>
      )}
    </section>
  );
}
