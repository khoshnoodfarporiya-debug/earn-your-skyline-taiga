"use client";

import { useId } from "react";
import type { PhoneApp } from "./PhoneShell";

/**
 * THE APP ICONS
 *
 * Seven logos, drawn rather than borrowed. Each is a real mark — a broadcast
 * for Pulse, a bubble for Messages, a folded paper for News, a crate of
 * produce for Market, a toque for Agency, a courthouse for Listings, a person
 * on a register for Roll — sitting on a tinted tile the way an app icon sits
 * on a home screen.
 *
 * No career sees all seven: the last four belong to the Chef and the
 * Solicitor respectively, and a dock only ever carries its own.
 *
 * ---------------------------------------------------------------- why SVG
 *
 * These were single typographic glyphs (◎ ✉ ▤) inherited from the very first
 * handset. A glyph is at the mercy of whichever font the machine happens to
 * have: on Windows two of the five rendered as boxes at some sizes, and none
 * of them could carry a colour of their own. Drawn paths render identically
 * everywhere, scale to any size, and let each app own a hue — which is what
 * makes a dock of five read as five *apps* rather than a row of symbols.
 *
 * No external icon library, no network fetch: the whole set is about a
 * hundred lines of geometry.
 *
 * ------------------------------------------------------------- the palette
 *
 * Each app's colour is chosen for separation at dock size (~28px), where hue
 * is the only thing the eye can still resolve: teal, blue, paper-white,
 * copper, green. Deliberately *not* the app's semantic colours — `clinical`
 * still means "your action" everywhere else in the game, and a tile is not an
 * action. The one overlap is Pulse's teal, which is the house colour and
 * belongs to the app that carries your standing.
 */

interface IconSkin {
  /** Tile gradient, light to dark. */
  from: string;
  to: string;
  /** The mark itself, drawn dark on the tile. */
  ink: string;
}

const SKIN: Record<PhoneApp, IconSkin> = {
  pulse: { from: "#3FE3CD", to: "#12A899", ink: "#042420" },
  messages: { from: "#7CB9F8", to: "#3B7DE0", ink: "#06182E" },
  news: { from: "#EDF1F7", to: "#BFCCDD", ink: "#16243A" },
  market: { from: "#E2A163", to: "#B36A33", ink: "#26130A" },
  agency: { from: "#5BD79C", to: "#2A9C68", ink: "#052018" },
  /*
   * The Solicitor's two. Brass for the court — the plaque on the door — and
   * claret for the roll, which is the colour of the ribbon a brief is tied
   * with. Both were picked against the dock they actually appear in: teal,
   * blue and paper-white, where a second blue would have been indistinguishable
   * at 30px and a second green would have fought the Chef's.
   */
  listings: { from: "#E8C468", to: "#B08B2A", ink: "#241A05" },
  roll: { from: "#E4899B", to: "#B0455F", ink: "#2A0A12" },
};

/**
 * The marks, in a 24×24 space centred in the tile.
 *
 * Each is a function of its two colours: `ink` for the mark, `tile` for the
 * details knocked back out of it — a cut-out reads far better at 28px than a
 * hairline outline does.
 */
function Mark({ app, ink, tile }: { app: PhoneApp; ink: string; tile: string }) {
  switch (app) {
    /* Reach: a source and the rings going out from it. */
    case "pulse":
      return (
        <g
          fill="none"
          stroke={ink}
          strokeWidth={2.1}
          strokeLinecap="round"
        >
          <circle cx={12} cy={12} r={2.5} fill={ink} stroke="none" />
          <path d="M8.1 8.1A5.5 5.5 0 008.1 15.9" />
          <path d="M15.9 8.1A5.5 5.5 0 0115.9 15.9" />
          <path d="M5.64 5.64A9 9 0 005.64 18.36" opacity={0.62} />
          <path d="M18.36 5.64A9 9 0 0118.36 18.36" opacity={0.62} />
        </g>
      );

    /* A bubble with something said in it. */
    case "messages":
      return (
        <g>
          <path
            fill={ink}
            d="M6.4 4h11.2A3.4 3.4 0 0121 7.4v6.1a3.4 3.4 0 01-3.4 3.4h-5.3L7.9 20.4a.7.7 0 01-1.13-.56V16.7A3.4 3.4 0 013 13.5V7.4A3.4 3.4 0 016.4 4z"
          />
          <rect x={6.3} y={8} width={11.4} height={1.7} rx={0.85} fill={tile} />
          <rect x={6.3} y={11.6} width={7.6} height={1.7} rx={0.85} fill={tile} />
        </g>
      );

    /* A folded paper: masthead, two columns, a picture block. */
    case "news":
      return (
        <g>
          <rect x={2.6} y={4.4} width={18.8} height={15.2} rx={2.2} fill={ink} />
          <rect x={5} y={6.8} width={8.4} height={3.2} rx={0.9} fill={tile} />
          <rect x={5} y={12.2} width={8.4} height={1.5} rx={0.75} fill={tile} />
          <rect x={5} y={15} width={6.2} height={1.5} rx={0.75} fill={tile} />
          <rect x={15.2} y={6.8} width={4} height={9.7} rx={1} fill={tile} opacity={0.55} />
        </g>
      );

    /*
     * A crate with the morning's shopping still in it.
     *
     * The rail across the top is doing real work: without a hard horizontal
     * edge the produce merged into the crate and the whole mark turned to
     * mush below about 40px. Checked at 150, 44 and 30 before it landed.
     */
    case "market":
      return (
        <g>
          {/* what is in it, sitting above the rail */}
          <circle cx={8.6} cy={6.1} r={2.2} fill={ink} />
          <path
            fill={ink}
            d="M12.2 8.1c-.2-3.2 1.7-5.2 4.7-5.4.2 3.2-1.7 5.2-4.7 5.4z"
          />
          {/* the crate */}
          <rect x={2.6} y={8.4} width={18.8} height={2.8} rx={1.1} fill={ink} />
          <path
            fill={ink}
            d="M4.6 12.1h14.8l-1.25 7.3a1.5 1.5 0 01-1.48 1.25H7.33a1.5 1.5 0 01-1.48-1.25z"
          />
          <rect x={6.4} y={14.4} width={11.2} height={1.5} rx={0.75} fill={tile} />
          <rect x={6.9} y={17.3} width={10.2} height={1.5} rx={0.75} fill={tile} />
        </g>
      );

    /*
     * A toque. Nothing else says "kitchen staff" this fast — but only with
     * three separate lobes: drawn as one puffy outline it reads as broccoli,
     * which is a real thing that happened and was thrown away.
     */
    case "agency":
      return (
        <g>
          <circle cx={7.6} cy={7.6} r={3.9} fill={ink} />
          <circle cx={16.4} cy={7.6} r={3.9} fill={ink} />
          <circle cx={12} cy={5.9} r={4.7} fill={ink} />
          <rect x={7.6} y={7} width={8.8} height={7} fill={ink} />
          {/* the band, split off by a knocked-out hairline */}
          <rect x={7.2} y={13.5} width={9.6} height={1.2} fill={tile} />
          <rect x={7.2} y={14.7} width={9.6} height={5.3} rx={1.5} fill={ink} />
        </g>
      );

    /*
     * A courthouse: pediment, four columns, a step.
     *
     * The first attempt was a diary page with ruled entries and a date block,
     * which at 30px was the News mark in a different colour — two pale
     * rectangles with lines in them, indistinguishable in the dock. A building
     * has a silhouette instead of an interior, which is the only thing that
     * survives at that size. The columns are knocked *out* of a solid block
     * rather than drawn as strokes, for the same reason the crate's rail is
     * solid: hairlines close up and the whole mark turns to a smear.
     */
    case "listings":
      return (
        <g>
          {/* the pediment */}
          <path fill={ink} d="M12 2.6l9.6 5.1a.7.7 0 01-.33 1.32H2.73A.7.7 0 012.4 7.7z" />
          {/* the block the columns are cut from */}
          <rect x={4.2} y={10.2} width={15.6} height={8.1} fill={ink} />
          <rect x={6.9} y={10.2} width={1.5} height={8.1} fill={tile} />
          <rect x={11.25} y={10.2} width={1.5} height={8.1} fill={tile} />
          <rect x={15.6} y={10.2} width={1.5} height={8.1} fill={tile} />
          {/* the step */}
          <rect x={2.6} y={19.2} width={18.8} height={2.2} rx={0.9} fill={ink} />
        </g>
      );

    /*
     * The roll: somebody, and the entry they occupy on a register.
     *
     * A scroll was tried first and read as a pill at dock size — two curled
     * ends are a detail, and details are the first thing to go. A head and
     * shoulders is a silhouette, which is what survives. The two knocked-out
     * rules underneath are what make it a *register* of people rather than a
     * generic contact icon.
     */
    case "roll":
      return (
        <g>
          <circle cx={12} cy={7} r={3.8} fill={ink} />
          <path fill={ink} d="M5.3 15.9a6.7 6.7 0 0113.4 0v.6H5.3z" />
          {/*
           * The register entry, and the two numbers that make it survive the
           * dock. The first attempt put a 1.5-unit rule 1.3 units below the
           * shoulders: at 30px that gap is under a pixel, so the bust and the
           * rule fused into one dark smear and the mark read as a blob. The
           * gap is 1.9 now and the rule is as thick as the crate's slats,
           * which is the proportion that already survives at this size.
           */}
          <rect x={2.6} y={18.4} width={18.8} height={2.8} rx={1.3} fill={ink} />
          <rect x={5.4} y={19.4} width={3.4} height={1.5} rx={0.75} fill={tile} />
          <rect x={11.4} y={19.4} width={6.4} height={1.5} rx={0.75} fill={tile} />
        </g>
      );
  }
}

/**
 * One app icon.
 *
 * `muted` is the dock's resting state: the tile keeps its shape and hue but
 * steps back, so the row still reads as five distinct apps while the current
 * one is unmistakable. Dimming *everything* to grey would cost the hue that
 * makes them recognisable in the first place.
 */
export function AppIcon({
  app,
  size = 34,
  muted = false,
  className = "",
}: {
  app: PhoneApp;
  size?: number;
  muted?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const skin = SKIN[app];
  const gid = `ic-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden
      className={className}
      style={{
        /* The resting tile keeps its hue and loses its glow. */
        opacity: muted ? 0.66 : 1,
        filter: muted ? "saturate(0.72)" : "none",
        transition: "opacity 160ms ease, filter 160ms ease",
      }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor={skin.from} />
          <stop offset="100%" stopColor={skin.to} />
        </linearGradient>
      </defs>

      {/* the tile */}
      <rect x={0} y={0} width={48} height={48} rx={13} fill={`url(#${gid})`} />
      {/* the gloss every physical icon has along its top edge */}
      <path
        d="M0 13A13 13 0 0113 0h22a13 13 0 0113 13v6C36 12 12 12 0 19z"
        fill="#FFFFFF"
        opacity={0.16}
      />
      {/* a hairline so a pale tile still has an edge on a pale ground */}
      <rect
        x={0.6}
        y={0.6}
        width={46.8}
        height={46.8}
        rx={12.5}
        fill="none"
        stroke="#000000"
        strokeOpacity={0.16}
        strokeWidth={1.2}
      />

      <g transform="translate(12 12)">
        <Mark app={app} ink={skin.ink} tile={skin.from} />
      </g>
    </svg>
  );
}

/** The accent an app's own screen is allowed to use for its header rule. */
export const appAccent = (app: PhoneApp): string => SKIN[app].from;
