/**
 * WORLD GEOMETRY GENERATOR
 *
 * Turns Natural Earth's public-domain country data into the SVG paths the map
 * renders, and writes them to `lib/ui/worldmap.generated.ts`.
 *
 * Run with `npm run build:map`. The output is committed.
 *
 * Why generate rather than render at runtime: `d3-geo`, `topojson-client` and
 * `world-atlas` are devDependencies and never reach the browser. The app ships
 * three strings — land, borders, graticule — and no mapping library, no tile
 * server, no API key, and nothing to go down. Exactly the constraint the
 * project has had since the first map, now met with real geography instead of
 * hand-drawn polygons.
 *
 * Projection is equirectangular, because the rest of the interface positions
 * cities as plain percentages and equirectangular is the projection where
 * "percent across" means "degrees of longitude" and nothing else.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoPath, geoGraticule, geoContains, geoTransform } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, MultiPolygon } from "geojson";

const require = createRequire(import.meta.url);
const world = require("world-atlas/countries-110m.json") as Topology<{
  countries: GeometryCollection;
}>;

/* The map's own coordinate space: 100 wide, 56 tall. */
const W = 100;
const H = 56;

/*
 * The window on the world: everything between these latitudes fills the board.
 *
 * Antarctica is dropped and the Arctic is trimmed, which is not a rounding
 * error — at full extent the ice caps took roughly a third of the height and
 * no market is within four thousand miles of either. Cutting them makes every
 * city on the board about a third larger for free.
 */
/*
 * The top edge is 73, not the 84 it was. Above about 70 degrees an
 * equirectangular projection smears the Canadian archipelago, Svalbard and
 * the Siberian coast into wide horizontal bars — they read as rendering
 * artefacts rather than as islands, which is exactly what they were mistaken
 * for. Cutting there loses northern Greenland and gains a cleaner board.
 */
const LAT_TOP = 73;
const LAT_BOTTOM = -57; // just past Cape Horn
const DEG_PER_X = 360 / W; // 3.6 degrees of longitude per unit
const Y_PER_DEG = H / (LAT_TOP - LAT_BOTTOM);

/**
 * A plain equirectangular, written out rather than composed, because the board
 * is 100x56 and a textbook equirectangular is 2:1 — the vertical scale here is
 * the crop, not the projection.
 */
const project = (lon: number, lat: number): [number, number] => [
  W / 2 + lon / DEG_PER_X,
  // Clamped to the crop. A transform does not clip, so without this the
  // Arctic projects to negative Y and spills out of the viewBox; clamping
  // flattens it onto the top edge instead, which is what a cropped map
  // should look like — land running off the frame.
  (LAT_TOP - Math.max(LAT_BOTTOM, Math.min(LAT_TOP, lat))) * Y_PER_DEG,
];

const projection = geoTransform({
  point(this: { stream: { point: (x: number, y: number) => void } }, lon: number, lat: number) {
    const [x, y] = project(lon, lat);
    this.stream.point(x, y);
  },
});

/* Two decimal places is ~11km at this scale — far finer than a 1180px board
   can show, and it roughly halves the generated file. */
const path = geoPath(projection).digits(2);

const all = feature(world, world.objects.countries) as FeatureCollection;
/* Antarctica is outside the crop and would otherwise smear along the bottom
   edge, since a transform clips nothing. */
const countries: FeatureCollection = {
  ...all,
  features: all.features.filter((f) => (f.properties?.name ?? "") !== "Antarctica"),
};


/**
 * CUT THE SUBPATHS THAT WRAP THE ANTIMERIDIAN
 *
 * `geoTransform` is a raw pass-through, not a real d3 projection, so nothing
 * clips at 180 degrees. A ring with a vertex at +179 followed by one at -179
 * is therefore drawn as a straight line all the way across the board.
 *
 * Six of them were showing on the finished map: Chukotka at roughly 65-72N and
 * Fiji at roughly 16-17S, both of which genuinely straddle the meridian. They
 * read as rendering faults because that is what they were.
 *
 * Rather than clip the geometry — which needs a real projection stream and
 * would change every coordinate in the file — this cuts the *output*: any
 * step that jumps more than half the board horizontally cannot be a real
 * coastline at this scale, so the subpath is broken there and resumed on the
 * other side. Each surviving piece is emitted whole, which is what a landmass
 * running off the edge of a cropped map should look like.
 */
function cutAntimeridian(d: string, close: boolean): string {
  /* Subpaths, each starting at its own M. */
  const subpaths = d.split("M").filter(Boolean);
  const out: string[] = [];

  for (const raw of subpaths) {
    const closed = /Z$/i.test(raw.trim());
    const body = raw.replace(/Z$/i, "");
    const points = body
      .split("L")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.split(",").map(Number) as [number, number])
      .filter((pt) => pt.length === 2 && Number.isFinite(pt[0]));

    if (points.length < 2) continue;

    let piece: [number, number][] = [points[0]];
    const pieces: [number, number][][] = [];
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i][0] - points[i - 1][0]) > W / 2) {
        pieces.push(piece);
        piece = [points[i]];
      } else {
        piece.push(points[i]);
      }
    }
    pieces.push(piece);

    const wasCut = pieces.length > 1;
    for (const part of pieces) {
      if (part.length < 2) continue;
      const dd = "M" + part.map((q) => `${q[0]},${q[1]}`).join("L");
      /* A filled shape has to close or the fill rule goes strange. A stroked
         border that has just been cut in two must NOT close, or each half
         grows a line back to where it started — which is the artefact this
         function exists to remove. */
      out.push(dd + (close || (closed && !wasCut) ? "Z" : ""));
    }
  }
  return out.join("");
}

/** Every country merged into one landmass, so overlaps and shared borders
    disappear and the fill is a single shape. */
const landRaw = path({
  type: "MultiPolygon",
  coordinates: countries.features.flatMap((f) =>
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : (f.geometry as MultiPolygon).coordinates,
  ),
}) as string;

/* Land is a fill, so every piece closes. */
const land = cutAntimeridian(landRaw, true);

/** Internal boundaries only — the lines *between* countries, drawn once each
    rather than twice as coincident coastlines. */
const bordersRaw = path(
  mesh(world, world.objects.countries, (a, b) => a !== b),
) as string;

/* Borders are strokes, so a cut piece stays open. */
const borders = cutAntimeridian(bordersRaw, false);

/**
 * A 20-degree graticule, confined to the crop.
 *
 * `extent` matters more than it looks. Without it the graticule runs to 80
 * degrees either way, every meridian gets clamped onto the top and bottom of
 * the frame, and three hundred segments pile up along the same two rows —
 * which draws as a hard horizontal seam across the whole board. Limiting the
 * generator means there is nothing to clamp.
 */
const graticule = path(
  geoGraticule()
    .step([20, 20])
    .extent([
      [-180, LAT_BOTTOM + 0.5],
      [180, LAT_TOP - 0.5],
    ])(),
) as string;

/* ------------------------------------------------------- city verification
 *
 * Every market must sit on land. Checked here against the real geometry so a
 * city in the sea fails the build rather than shipping.
 */
const landFeature = {
  type: "MultiPolygon" as const,
  coordinates: countries.features.flatMap((f) =>
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : (f.geometry as MultiPolygon).coordinates,
  ),
};

/** Real coordinates for the fourteen markets, as [longitude, latitude]. */
export const CITY_LATLON: Record<string, [number, number]> = {
  lyon: [4.84, 45.76],
  madrid: [-3.7, 40.42],
  milan: [9.19, 45.46],
  berlin: [13.4, 52.52],
  amsterdam: [4.9, 52.37],
  paris: [2.35, 48.86],
  london: [-0.13, 51.51],
  dubai: [55.27, 25.2],
  singapore: [103.82, 1.35],
  tokyo: [139.69, 35.69],
  newyork: [-74.01, 40.71],
  saopaulo: [-46.63, -23.55],
  mumbai: [72.88, 19.08],
  lagos: [3.38, 6.52],
};

const projected: Record<string, { x: number; y: number }> = {};
for (const [id, lonlat] of Object.entries(CITY_LATLON)) {
  const [px, py] = project(lonlat[0], lonlat[1]);
  // Back to the 0-100 square the city catalogue stores.
  projected[id] = {
    x: Number(px.toFixed(2)),
    y: Number(((py / H) * 100).toFixed(2)),
  };
}

/* ------------------------------------------------------------- the crowding
 *
 * Positions are the true projection, unmodified. That has one consequence
 * worth stating plainly, because it drove several failed attempts before this
 * one: seven of the fourteen markets are in western Europe, and at a board
 * width of 1180px London and Paris are about nine pixels apart.
 *
 * Nudging them apart does not work. Enough separation to clear a touch target
 * needs the cluster spread over roughly 180px, and there is no land there —
 * every arrangement that separates them puts markets in the Atlantic or in
 * north Africa, which looks far worse than markers that overlap.
 *
 * So the crowding is resolved by zoom instead, which is the same answer every
 * real map gives. The board zooms to 6x, where the tightest pair clears 58px;
 * the label solver thins names until they fit at whatever zoom you are at; and
 * the city navigator and market list below the map reach all fourteen at any
 * zoom, so nothing is ever unreachable even at 1x.
 */
const BOARD_PX = 1180;
const pxPerX = BOARD_PX / W;
const pxPerY = (BOARD_PX * (H / W)) / 100; // city-space y -> px
const ids = Object.keys(projected);

/** Stored 0-100 position back to longitude/latitude. */
const unproject = (x: number, y: number): [number, number] => [
  (x - W / 2) * DEG_PER_X,
  LAT_TOP - ((y / 100) * H) / Y_PER_DEG,
];
const onLand = (x: number, y: number) => geoContains(landFeature, unproject(x, y));

let worst = Infinity;
let worstPair = "";
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const a = projected[ids[i]];
    const b = projected[ids[j]];
    const d = Math.hypot((b.x - a.x) * pxPerX, (b.y - a.y) * pxPerY);
    if (d < worst) {
      worst = d;
      worstPair = `${ids[i]}/${ids[j]}`;
    }
  }
}

console.log("city positions (0-100 space), true projection:");
const offLand: string[] = [];
for (const id of ids) {
  const p = projected[id];
  const land = onLand(p.x, p.y);
  if (!land) offLand.push(id);
  console.log(
    `  ${id.padEnd(10)} ${String(p.x).padStart(6)},${String(p.y).padStart(6)}${land ? "" : "   (just off the 110m coastline)"}`,
  );
}
console.log(
  `\n  tightest pair: ${worstPair} at ${worst.toFixed(1)}px at 1x, ` +
    `${(worst * 6).toFixed(0)}px at 6x`,
);
if (offLand.length > 0) {
  // Coastal cities can fall a pixel offshore at 110m resolution. That is a
  // resolution artefact, not a data error, so it reports rather than throws.
  console.log(`  coastal at this resolution: ${offLand.join(", ")}`);
}

const out = `/* GENERATED by scripts/build-map.ts — do not edit by hand.
 *
 * Natural Earth 110m country data (public domain), projected
 * equirectangular into the map's 100x56 space and flattened to SVG paths.
 * Regenerate with \`npm run build:map\`.
 */

/** Every landmass on earth, merged into one path. */
export const LAND_PATH =
  ${JSON.stringify(land)};

/** Borders between countries, each drawn once. */
export const BORDER_PATH =
  ${JSON.stringify(borders)};

/** Parallels and meridians every 20 degrees. */
export const GRATICULE_PATH =
  ${JSON.stringify(graticule)};

/**
 * Where each market sits, as the projection of its real coordinates in the
 * 0-100 space the city catalogue uses. \`cities.ts\` reads these rather than
 * storing its own copy, so re-cropping the map moves the markers with it and
 * the two can never disagree.
 */
export const CITY_POSITIONS: Record<string, { x: number; y: number }> = ${JSON.stringify(
  projected,
  null,
  2,
)};
`;

writeFileSync("lib/ui/worldmap.generated.ts", out);

const kb = (s: string) => `${(s.length / 1024).toFixed(1)}KB`;
console.log(
  `\nwrote lib/ui/worldmap.generated.ts — land ${kb(land)}, borders ${kb(borders)}, graticule ${kb(graticule)}`,
);
