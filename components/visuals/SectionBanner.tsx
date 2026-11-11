"use client";

import type { ReactNode } from "react";
import { sectionVisual } from "@/lib/ui/visuals";
import { ArtFrame } from "./ArtFrame";

/**
 * SECTION BANNER
 *
 * The entrance to a screen: one shallow image with the screen's real title
 * and status laid over it in HTML. Nothing is baked into the artwork, so the
 * numbers are live, the text is selectable, and a screen reader gets the
 * heading rather than a description of scenery.
 *
 * Shallow on purpose. A banner that pushes the week's controls below the fold
 * has cost more than it gave, so the ratio is wide and the mobile height is
 * capped — the picture sets the scene and then gets out of the way.
 *
 * A section with no registered artwork renders as a plain header rather than
 * disappearing, which keeps the heading structure intact either way.
 */
export function SectionBanner({
  section,
  title,
  kicker,
  status,
  priority = false,
  children,
}: {
  section: string;
  title: string;
  /** Small label above the title — what this screen is for. */
  kicker?: string;
  /** One short live sentence or figure, shown under the title. */
  status?: ReactNode;
  /** Only the first screen painted; everything else lazy-loads. */
  priority?: boolean;
  /** Overlay content pinned to the lower-right, e.g. an alert chip. */
  children?: ReactNode;
}) {
  const visual = sectionVisual(section);

  return (
    <section
      aria-labelledby={`section-${section}-title`}
      className="form overflow-hidden"
    >
      <ArtFrame
        visual={visual}
        /* Shallower on a phone than on a desktop: the same image, but the
           mobile viewport cannot spare 40% of its height to scenery. */
        ratio="aspect-[16/7] sm:aspect-[21/6]"
        scrim={visual?.scrim ?? "bottom"}
        sizes="(min-width: 1152px) 1104px, 100vw"
        priority={priority}
      >
        <div className="absolute inset-0 flex items-end justify-between gap-3 p-3.5 sm:p-5">
          <div className="min-w-0">
            {kicker && (
              <p className="sign text-[11.5px] text-clinical drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                {kicker}
              </p>
            )}
            <h2
              id={`section-${section}-title`}
              className="display mt-0.5 text-2xl leading-none text-ink drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] sm:text-3xl"
            >
              {title}
            </h2>
            {status && (
              <p className="mt-1.5 max-w-prose text-[13.5px] leading-snug text-ink-soft drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                {status}
              </p>
            )}
          </div>
          {children}
        </div>
      </ArtFrame>
    </section>
  );
}
