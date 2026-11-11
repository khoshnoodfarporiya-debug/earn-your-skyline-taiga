"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { Visual } from "@/lib/ui/visuals";

/**
 * ART FRAME
 *
 * One image-over-gradient pattern, used by every illustrated surface in the
 * app: career cards, the city briefing, event dialogs, the milestone screen.
 * Having it in one place is what stops five components each inventing their
 * own scrim and their own crop.
 *
 * Three things it guarantees, which are the three things that go wrong with
 * decorative photography:
 *
 *   - the box has a fixed aspect ratio, so the layout never shifts as the
 *     image arrives;
 *   - the image is `object-cover` with an explicit focal point, so it is
 *     cropped rather than stretched;
 *   - a gradient sits between the picture and any text laid over it, so the
 *     text stays readable whatever the photograph happens to be.
 *
 * A missing `visual` renders the frame without an image rather than a broken
 * one, so an absent asset degrades to a plain panel.
 */

export type ArtScrim = "bottom" | "full" | "none";

/*
 * Scrims are kept as shallow as the text allows. The artwork is night-lit
 * already, so a heavy gradient does not make captions more readable — it just
 * turns the picture into a dark rectangle.
 */
const SCRIMS: Record<ArtScrim, string> = {
  // For a caption sitting on the lower edge.
  bottom:
    "bg-gradient-to-t from-[#070E19] via-[#070E19]/55 via-30% to-transparent",
  // For text laid across the whole image.
  full: "bg-gradient-to-t from-[#070E19] via-[#070E19]/70 to-[#070E19]/25",
  none: "",
};

export function ArtFrame({
  visual,
  ratio = "aspect-[1672/941]",
  scrim = "bottom",
  sizes,
  priority = false,
  className = "",
  imageClassName = "",
  children,
}: {
  visual: Visual | null;
  /** Tailwind aspect class. Fixed, so nothing below it moves on load. */
  ratio?: string;
  scrim?: ArtScrim;
  /** Required whenever the frame is not full-bleed; sized for the real box. */
  sizes: string;
  /** Only for artwork above the fold on first paint. */
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden ${ratio} ${className}`}>
      {visual ? (
        <Image
          src={visual.src}
          alt={visual.alt}
          fill
          sizes={sizes}
          priority={priority}
          className={`object-cover ${imageClassName}`}
          style={{ objectPosition: visual.focus }}
        />
      ) : (
        // No asset: a flat surface in the same palette, never a broken image.
        <div className="absolute inset-0 bg-card" aria-hidden />
      )}

      {scrim !== "none" && (
        <div aria-hidden className={`absolute inset-0 ${SCRIMS[scrim]}`} />
      )}

      {children}
    </div>
  );
}
