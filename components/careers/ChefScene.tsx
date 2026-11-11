"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { ChefArt } from "@/lib/ui/chefArt";

/**
 * A PICTURE OF THE THING, BESIDE THE NUMBERS ABOUT IT
 *
 * The Chef's screens each open with one image, and this is the only shape it
 * takes. Two rules decided the layout:
 *
 *   - the artwork sits *beside* the figures on a wide screen and above them on
 *     a narrow one, so it never pushes the controls below the fold. A hero
 *     that fills a phone is a hero the player scrolls past every week for a
 *     hundred and fifty-six weeks;
 *   - the picture is a fixed 3:2 box, so nothing moves when it arrives.
 *
 * `tone` is the one thing it says on its own: a copper edge and a copper label
 * when the state is worth noticing, a quiet rule when it is not. It is set from
 * run state at the call site — never from which picture happens to be showing.
 */
export function ChefScene({
  art,
  kicker,
  title,
  note,
  tone = "quiet",
  priority = false,
  children,
}: {
  art: ChefArt | null;
  /** What this is, in two or three words. Sits over the image. */
  kicker: string;
  title: string;
  /** One line under the title. */
  note?: string;
  /** `live` for an active service or a warning worth the accent. */
  tone?: "quiet" | "live" | "warning";
  /** True only for the first image on a screen, which is above the fold. */
  priority?: boolean;
  /** The figures. Rendered beside the image on sm+ and under it on a phone. */
  children?: ReactNode;
}) {
  const edge =
    tone === "warning"
      ? "border-caution/50"
      : tone === "live"
        ? "border-chef/45"
        : "border-rule";
  const chip =
    tone === "warning"
      ? "border-caution/60 text-caution"
      : tone === "live"
        ? "border-chef/60 text-chef"
        : "border-rule text-ink-soft";

  return (
    <section
      className={`overflow-hidden rounded-panel border bg-card ${edge}`}
    >
      <div className="grid gap-0 sm:grid-cols-[minmax(0,34%)_minmax(0,1fr)]">
        {/* The picture. Fixed ratio in both layouts, so the panel beside it
            never jumps as the file arrives. */}
        <div className="relative aspect-[16/7] w-full sm:aspect-[3/2] sm:h-full">
          {art ? (
            <Image
              src={art.src}
              alt={art.alt}
              fill
              /* A third of a 1152px shell on desktop, full width on a phone —
                 so a 375px screen never downloads the 1200px file. */
              sizes="(min-width: 1024px) 380px, (min-width: 640px) 34vw, 100vw"
              priority={priority}
              loading={priority ? undefined : "lazy"}
              className="object-cover"
              style={{ objectPosition: art.focus }}
            />
          ) : (
            <div className="absolute inset-0 bg-card-high" aria-hidden />
          )}
          {/* Enough gradient for the label to survive a bright plate, no more:
              the artwork is already night-lit and a heavy scrim just turns it
              into a dark rectangle. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-[#070E19]/85 via-[#070E19]/20 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-[#070E19]/10 sm:to-[#070E19]/70"
          />
          <span
            className={`sign absolute left-3 top-3 rounded-full border bg-[#070E19]/80 px-2 py-0.5 text-[11.5px] backdrop-blur-[2px] ${chip}`}
          >
            {kicker}
          </span>
        </div>

        <div className="min-w-0 p-4">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {note && <p className="mt-1 text-xs text-ink-faint">{note}</p>}
          {children}
        </div>
      </div>
    </section>
  );
}

/**
 * The same artwork at card scale.
 *
 * Used on the premises and service cards, where the picture's job is to make
 * five options distinguishable at a glance rather than to set a mood. Muted
 * until the card is the current one or hovered, so a grid of photographs does
 * not shout over the figures that decide the choice.
 */
export function ChefThumb({
  art,
  state = "available",
  className = "",
}: {
  art: ChefArt | null;
  /** `current` for the one in force, `blocked` for out of reach. */
  state?: "available" | "current" | "blocked";
  className?: string;
}) {
  if (!art) return null;
  return (
    /*
     * No width of its own, deliberately.
     *
     * The first version carried `w-full` and every caller that wanted a fixed
     * 96px thumbnail ended up with both `w-full` and `w-24` on one element —
     * CSS picked the stylesheet order, `shrink-0` refused to give the space
     * back, and the text column beside it collapsed to zero width. The card
     * decides how wide its picture is; this decides everything else.
     */
    <div
      className={`relative aspect-[3/2] overflow-hidden rounded-form bg-paper ${className}`}
    >
      <Image
        src={art.src}
        /* Decorative here: the card's own heading names the room or the
           service, so a screen reader announcing the photograph as well would
           read every card twice. */
        alt=""
        fill
        sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 92vw"
        loading="lazy"
        className={`object-cover transition duration-300 motion-reduce:transition-none ${
          state === "blocked"
            ? "opacity-35 grayscale"
            : state === "current"
              ? "opacity-100"
              : "opacity-80 hover:opacity-100"
        }`}
        style={{ objectPosition: art.focus }}
      />
      {state === "current" && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-form ring-1 ring-inset ring-chef/50"
        />
      )}
    </div>
  );
}
