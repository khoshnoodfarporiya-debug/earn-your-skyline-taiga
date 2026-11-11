"use client";

import {
  asBanner,
  careerScreenArt,
  type IllustratedCareerId,
} from "@/lib/ui/careerSceneArt";
import { ArtFrame } from "../visuals/ArtFrame";

const SCENE_LABELS: Record<IllustratedCareerId, Record<string, string>> = {
  founder: {
    runway: "The runway is the clock",
    crew: "The company you are building",
    raising: "Across the table from capital",
  },
  politician: {
    polling: "The count moves every week",
    blocs: "Every constituency is a coalition",
    positions: "A platform has consequences",
    office: "The next office is earned here",
  },
  architect: {
    boards: "Every commission has a shape",
    offers: "Choosing the next brief",
    competitions: "Reputation is won in public",
    atelier: "The studio behind the work",
  },
  engineer: {
    bench: "Evidence before confidence",
    newbuild: "Choosing what to build next",
  },
};

/** A shallow, decorative career scene with an HTML caption over live artwork. */
export function CareerSceneBanner({
  career,
  screen,
}: {
  career: IllustratedCareerId;
  screen: string;
}) {
  const art = careerScreenArt(career, screen);
  if (!art) return null;

  return (
    <ArtFrame
      visual={asBanner(art)}
      ratio="aspect-[21/7]"
      scrim="bottom"
      sizes="(min-width: 1152px) 1104px, 100vw"
      className="rounded-lg border border-rule"
    >
      <p className="sign absolute bottom-3 left-4 text-[11px] text-ink drop-shadow-[0_1px_5px_rgba(0,0,0,0.95)]">
        {SCENE_LABELS[career][screen]}
      </p>
    </ArtFrame>
  );
}
