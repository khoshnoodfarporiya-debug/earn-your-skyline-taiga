"use client";

import { eventVisual } from "@/lib/ui/visuals";
import { ArtFrame } from "./ArtFrame";

/**
 * Artwork for an event, if the registry has any for it.
 *
 * Renders nothing when the event has no entry, so events without artwork are
 * untouched and adding a picture for another one never means editing this
 * file. The frame is a fixed letterbox so the modal does not jump as the
 * image loads, and it is kept shallow to keep the choices near the fold.
 *
 * The category comes from the registry; the severity comes from the event's
 * own `tone`, which the simulation already sets. Neither is invented here.
 */
export function EventVisual({
  eventId,
  tone,
}: {
  eventId: string;
  tone: "good" | "bad" | "neutral";
}) {
  const visual = eventVisual(eventId);
  if (!visual) return null;

  const severity =
    tone === "bad" ? "Serious" : tone === "good" ? "Opportunity" : "Routine";
  const severityClass =
    tone === "bad"
      ? "border-alarm/60 text-alarm"
      : tone === "good"
        ? "border-good/60 text-good"
        : "border-caution/60 text-caution";

  return (
    <ArtFrame
      visual={visual}
      ratio="aspect-[21/9] sm:aspect-[21/8]"
      scrim="bottom"
      sizes="(max-width: 640px) 100vw, 512px"
      className="border-b border-rule"
    >
      <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 p-3">
        <span className="sign rounded-full border border-rule bg-[#070E19]/80 px-2 py-0.5 text-[11.5px] text-ink-soft backdrop-blur-[2px]">
          {visual.category}
        </span>
        <span
          className={`sign rounded-full border bg-[#070E19]/80 px-2 py-0.5 text-[11.5px] backdrop-blur-[2px] ${severityClass}`}
        >
          {severity}
        </span>
      </div>
    </ArtFrame>
  );
}
