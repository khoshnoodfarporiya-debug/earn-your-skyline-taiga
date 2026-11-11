import {
  BORDER_PATH,
  GRATICULE_PATH,
  LAND_PATH,
} from "@/lib/ui/worldmap.generated";

/**
 * THE MAP SURFACE
 *
 * Ocean, land, borders, grid. Nothing else — no markers, no routes, no state.
 * Separated from `NetworkMap` because the board was a twelve-hundred-line
 * component doing cartography, interaction, clustering and layout at once,
 * and the cartography is the part that changes for purely visual reasons.
 *
 * ---------------------------------------------------------------- flat
 *
 * There was a version of this with procedural terrain: fractal-noise relief,
 * latitude-banded biome colour warped by a displacement map, drifting cloud,
 * water grain. It was technically impressive and it read as camouflage. Four
 * `feTurbulence` filters produced a mottled green-and-tan surface that fought
 * every marker on top of it, and the polar geometry through it looked like
 * rendering seams rather than land.
 *
 * So: flat navy water, flat blue-grey land, a hairline coast, thin borders,
 * and a grid you have to look for. A strategy board should let the pieces be
 * the loudest thing on it, and none of the texture was carrying information.
 */
export function MapSurface({ viewBox }: { viewBox: { w: number; h: number } }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {/* Water. One flat colour — depth here would only compete. */}
      <rect x={0} y={0} width={viewBox.w} height={viewBox.h} fill="#0A1526" />

      {/* Parallels and meridians every 20 degrees, barely there. */}
      <path
        d={GRATICULE_PATH}
        fill="none"
        stroke="#1B2A40"
        strokeWidth={0.4}
        opacity={0.55}
        vectorEffect="non-scaling-stroke"
      />

      {/* Land. A single flat fill, so continents read as mass. */}
      <path d={LAND_PATH} fill="#22344E" stroke="none" />

      {/* Coast: a hairline that separates land from water and nothing more.
          The previous treatment glowed, which made every continent look like
          a sticker laid on the sea. */}
      <path
        d={LAND_PATH}
        fill="none"
        stroke="#31486A"
        strokeWidth={0.5}
        opacity={0.85}
        vectorEffect="non-scaling-stroke"
      />

      {/* National borders, each drawn once, quieter than the coast. */}
      <path
        d={BORDER_PATH}
        fill="none"
        stroke="#2C4162"
        strokeWidth={0.35}
        strokeLinecap="round"
        opacity={0.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
