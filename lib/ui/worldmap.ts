/**
 * WORLD MAP GEOMETRY
 *
 * A stylised world, hand-authored as SVG paths. No tile server, no mapping
 * library, no API key — the whole map is a few hundred bytes of path data that
 * ship with the bundle and render at any size.
 *
 * It is a strategy board, not an atlas. The silhouette is recognisable enough
 * to read at a glance — you can find Europe, India, Japan — but landmasses are
 * shaped to suit the fourteen markets the game actually has, and Europe is
 * drawn larger than a true projection would allow so that seven cities inside
 * it can be told apart and tapped. Accuracy loses to legibility every time
 * here, deliberately.
 *
 * ---------------------------------------------------------------- coordinates
 *
 * Cities are stored in `cities.ts` on a 0–100 square, because that is what CSS
 * percentage positioning wants. The map draws on a 100 x 56 viewBox, which is
 * the same square with the vertical axis scaled — so the SVG and the markers
 * agree without either having to know about the other.
 *
 * `sy()` is the one conversion between them.
 */

import { LAND_PATH } from "./worldmap.generated";

export const MAP_VIEWBOX = { w: 100, h: 56 } as const;

/** City-space Y (0–100) to map-space Y (0–56). */
export const sy = (y: number) => (y * MAP_VIEWBOX.h) / 100;

export interface LandMass {
  id: string;
  /** Path data, already in map space. */
  d: string;
}

/**
 * Drawn in one pass with a shared fill, so shapes that overlap simply merge —
 * which is why the continents are several plain polygons rather than one
 * heroic path with every fjord in it. Adding an island is one more entry.
 */
export const LANDMASSES: LandMass[] = [
  {
    id: "north-america",
    /*
     * Alaska's hook, the Arctic coast, the Hudson Bay notch, down past Nova
     * Scotia and the eastern seaboard, round Florida, into the Gulf, out
     * along Central America, then north up the Pacific past Baja.
     *
     * Straight segments only, and that is not laziness — `landPolygon` parses
     * every `x,y` pair out of this string for the on-land test, so a curve's
     * control points would be read as coastline and the test would quietly
     * start lying. Detail comes from more vertices instead.
     */
    d: "M2.8,15.6 L3.4,13.2 L5.2,11.4 L4.4,9.8 L6.6,9.2 L8.4,10.4 L9.6,9 L12,7.8 L15,6.8 L18.4,6 L21.8,5.6 L24.6,5.8 L26.8,6.4 L26.4,8.2 L25.2,9.6 L24.4,11.4 L25,13 L26.4,14 L27.8,12.8 L28.4,10.6 L28.2,8.4 L29.6,7.4 L31.4,8 L32,9.8 L31,11.4 L29.4,12.4 L28.8,14.2 L29.8,15.6 L28.6,16.8 L26.9,17.2 L26.2,18.6 L25.9,20.4 L25.4,22 L25.6,23.6 L25.1,25.2 L24.6,26.8 L24.1,28 L23.4,26.6 L23.6,24.8 L23.2,23.2 L21.8,22.8 L20.4,23.4 L19.4,24.6 L19,26 L19.6,27.4 L20.4,28.6 L19.2,29 L18.2,30.2 L18.9,31.2 L17.2,30.6 L16.2,28.8 L15.4,26.6 L14.6,24.2 L13.6,21.4 L12.4,18.6 L11.2,16.4 L9.6,14.8 L7.4,14.2 L5,14.6 Z",
  },
  { id: "greenland", d: "M31,3 L35.5,2.5 L38,4.5 L37,7.5 L34,9.5 L31.5,7.5 L30.5,5 Z" },
  { id: "caribbean", d: "M24,27.2 L26.5,26.8 L27,28 L24.5,28.5 Z" },
  {
    id: "south-america",
    // The Caribbean coast and the Orinoco, the Guiana shoulder, out to the
    // Brazilian bulge at Recife, south past Rio, into the Plate estuary,
    // then back up the Andean edge and the long taper to Cape Horn.
    d: "M19.6,31 L21.4,30 L23.6,29.6 L25.8,29.8 L27.8,30.4 L29.8,31.2 L31.6,32.4 L33.2,34 L34.4,36 L35.1,38.2 L34.6,40.2 L33.6,42 L32.4,43.8 L31.4,45.6 L30.4,47.4 L29.6,49.2 L28.8,51 L28.1,52.6 L27.4,53.6 L26.9,52 L27,50.2 L26.6,48.4 L26.1,46.4 L25.6,44.2 L25,42 L24.2,39.6 L23.4,37.4 L22.4,35.4 L21.2,33.6 L20.2,32.2 Z",
  },
  { id: "iceland", d: "M35.5,9 L37.3,8.6 L37.6,10 L35.9,10.4 Z" },
  {
    id: "britain",
    d: "M39.5,11 L41.5,10.2 L42.8,12 L43.2,14.5 L42.5,16.8 L41,17.8 L39.8,16 L39,13.5 Z",
  },
  { id: "ireland", d: "M36.8,12 L38.4,11.5 L38.7,14.2 L37.2,15 L36.3,13.5 Z" },
  {
    id: "europe",
    /*
     * Iberia and the Bay of Biscay, the Brittany shoulder, the Low Countries
     * and the Jutland root, east across the north European plain, then back
     * west along the Mediterranean through the Balkans and the Gulf of Lion.
     *
     * Drawn well oversized. Seven of the fourteen markets are inside this
     * shape, and at a true projection they would share about four percent of
     * the board's width — unreadable and untappable. Legibility beats
     * accuracy here, deliberately and consistently.
     */
    d: "M38,26.6 L37.8,24.4 L38.6,22.4 L40.2,21.4 L41.6,21.8 L42.4,20.4 L42.8,18.6 L43.6,17.2 L44.6,16.4 L44.2,14.8 L45.4,13.6 L46.8,13 L48.2,12 L50,11.4 L52.4,11 L54.6,11.4 L56.4,12.4 L57.8,14 L58.6,16 L58.4,18 L57.4,19.6 L56,21 L54.6,22 L53.6,23.4 L53.4,25.2 L52.6,26.8 L51.4,27.8 L50.8,26.2 L49.4,25.2 L47.6,24.6 L45.6,24.4 L43.6,24.8 L41.8,25.8 L40.2,26.8 L38.9,27.2 Z",
  },
  {
    id: "scandinavia",
    d: "M48.5,12 L50,8.5 L52.5,6 L55.5,6.5 L56.5,9.5 L54,11.5 L51.5,13 L49,13.5 Z",
  },
  { id: "italy", d: "M51.5,23 L53.3,23.5 L52.9,26.5 L51.6,28.5 L50.4,27.5 L50.8,25 Z" },
  {
    id: "north-asia",
    d: "M56,12 L58,9 L62,7 L68,5.8 L75,5.5 L82,6 L88,7.5 L92.5,9.5 L95.5,12.5 L94,15 L91,16.5 L86,17.2 L80,17.8 L74,18.2 L68,18.4 L62,18.2 L58.5,16.5 Z",
  },
  {
    id: "east-asia",
    d: "M60.5,17.5 L67,16.8 L74,16.5 L80,17 L84.5,18.2 L86.8,20.2 L87.5,22.5 L85.5,24.5 L83,26.5 L80.5,27.8 L78.5,27 L76,25.2 L72,23.5 L67,21.8 L63,20 Z",
  },
  {
    id: "middle-east",
    // Anatolia and the Caucasus down through Iran, round the Arabian
    // peninsula and back up the Red Sea.
    d: "M55,20.5 L58.5,20 L63,21.5 L66,24 L66.5,26.5 L64.5,28.8 L61.5,30.5 L58.5,29 L57,26.5 L55.5,23.5 Z",
  },
  {
    id: "south-asia",
    // The Indus, the Rann of Kutch, down the Konkan coast to Cape Comorin,
    // then back up the Coromandel side and round the Bay of Bengal delta.
    d: "M63.6,22 L66,21 L68.8,20.8 L71.6,21.4 L74.2,22.4 L76.4,24 L77,25.8 L75.6,26.6 L74.2,27.8 L73,29.4 L71.8,31.2 L70.8,33 L69.9,34.6 L69,32.8 L68.2,30.6 L67.4,28.4 L66.4,26.2 L65.2,24.2 L64.2,22.8 Z",
  },
  { id: "sri-lanka", d: "M70.6,34.6 L71.5,34.4 L71.8,35.8 L70.8,36 Z" },
  {
    id: "southeast-asia",
    d: "M76.5,25.8 L80,25.2 L82.5,27 L83.2,29.5 L82,31.5 L81.5,34 L81,36.5 L80.2,39 L78.6,36 L78.4,32.5 L77.2,29.5 L76,27.5 Z",
  },
  { id: "sumatra-java", d: "M79,39.8 L84,39 L88,39.6 L89.5,41 L85,42 L80.5,41.4 L78.8,40.6 Z" },
  { id: "borneo", d: "M86,35.5 L89.5,35.8 L90.8,38 L88.5,39 L86.3,37.5 Z" },
  { id: "philippines", d: "M84.5,29.5 L86.3,29 L87,31.5 L85.8,33.2 L84.8,31.5 Z" },
  { id: "new-guinea", d: "M91,39 L95.5,38.5 L97,40 L92.5,41 Z" },
  {
    id: "japan",
    d: "M88.5,18 L90.2,17.3 L91.8,19.3 L92.3,21.5 L91,23.4 L89.5,22 L88.8,20 Z",
  },
  {
    id: "africa",
    // The Maghreb, east along the Mediterranean to Suez, down the Red Sea,
    // out to the Horn, south along the Swahili coast to the Cape, then north
    // through Namibia and Angola and round the deep bight of the Gulf of
    // Guinea before the West African bulge.
    d: "M40.4,29.6 L42.6,28.6 L45.4,28 L48.6,27.7 L52,27.9 L55,28.6 L57,29.6 L57.9,31 L58.4,32.6 L60,33.2 L61.6,33.6 L62.8,34.4 L61.4,35.4 L59.8,36.4 L58.6,37.8 L57.8,39.6 L57,41.6 L56,43.6 L54.8,45.6 L53.4,47.6 L52,49.2 L51,50.2 L50.4,48.6 L50.2,46.6 L49.8,44.4 L49.4,42 L48.8,39.6 L48,37.4 L46.9,35.6 L45.6,34.2 L44.2,33.6 L42.8,34 L41.9,33 L41.4,31.6 L40.8,30.6 Z",
  },
  { id: "madagascar", d: "M59.5,40.5 L61,40 L61.8,43 L60.5,44.2 L59.6,42.5 Z" },
  {
    id: "australia",
    // The Kimberley, the Gulf of Carpentaria notch, Cape York, down the
    // Queensland coast, round the Bight and back up the west.
    d: "M83.6,43 L85.8,41.6 L87.6,41.2 L88.4,42.6 L89.2,41.2 L91,41.4 L92.8,42.4 L94.2,43.8 L94.8,45.6 L94,47.4 L92.4,48.8 L90.4,49.8 L88.2,50 L86.4,49 L85,47.4 L84,45.4 Z",
  },
  { id: "new-zealand", d: "M95.5,49.5 L96.9,49 L97.4,51.4 L96,51.8 Z" },
];

/**
 * Regional divisions, drawn as open polylines over the land.
 *
 * Not national borders — the map is a strategy board and does not claim to be
 * an atlas. They are the few internal lines that make a continent read as a
 * continent rather than a silhouette: the US–Canada line, the Sahara's
 * southern edge, the Himalayan wall, the Urals. Kept very faint, because the
 * moment they compete with a route they have stopped helping.
 */
export const BORDERS: { id: string; d: string }[] = [
  { id: "us-canada", d: "M8.5,14.2 L14,13 L20,12.4 L25.5,12.6" },
  { id: "us-mexico", d: "M17.5,22.6 L21,22 L23.8,22.8" },
  { id: "amazon-south", d: "M22.6,38 L28,37.4 L33.4,37.8" },
  { id: "andes", d: "M22.2,34.6 L24,39 L25.6,44 L26.9,49.6" },
  { id: "sahara-south", d: "M42.6,34 L48,33.4 L54,33.6 L59,34" },
  { id: "sahel", d: "M43.6,31 L49,30.2 L55,30.4" },
  { id: "urals", d: "M63.5,8.5 L63,12 L62.6,16 L62.4,18.2" },
  { id: "himalaya", d: "M64.5,21.8 L68.5,21.2 L72.5,21.6 L76,22.6" },
  { id: "china-south", d: "M70,24 L75,24.6 L80,25.4" },
  { id: "europe-east", d: "M52,13 L52.6,17 L52.4,21" },
  { id: "med-north", d: "M40,26.6 L45,25.6 L50,25.4 L55,25.8" },
];

/**
 * Where to scroll a pannable map so a marker lands in the middle.
 *
 * Pure and unit-free — pixels in, pixels out — so the centring rule can be
 * tested without a browser. Clamped at both ends: asking for a city near
 * either edge scrolls as far as it can and stops, rather than leaving blank
 * space beside the map.
 */
export function centreScroll(
  markerCentre: number,
  viewport: number,
  content: number,
): number {
  const max = Math.max(0, content - viewport);
  return Math.min(Math.max(0, markerCentre - viewport / 2), max);
}

/**
 * The corner points of a landmass, read back out of its path data.
 *
 * Every shape above is a closed polygon of straight segments, so parsing is a
 * matter of pulling the numbers out in order. This exists so a test can prove
 * that no city marker is floating in the ocean — a mistake that is obvious in
 * a browser and invisible in a diff.
 */
export function landPolygon(d: string): [number, number][] {
  const points: [number, number][] = [];
  for (const m of d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)) {
    points.push([Number(m[1]), Number(m[2])]);
  }
  return points;
}

/** Standard ray-casting test against one polygon. */
function inPolygon(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * The coastline the map actually draws, as polygons, parsed once.
 *
 * `LAND_PATH` is generated from real coastline data and is what `MapSurface`
 * renders; the hand-drawn `LANDMASSES` above are a much coarser stand-in kept
 * for the shapes that reason about continents. Two hundred and eighty-odd
 * closed subpaths, all straight segments, so the same parser works on it.
 */
let drawnLand: [number, number][][] | null = null;
function landPolygons(): [number, number][][] {
  if (drawnLand) return drawnLand;
  drawnLand = LAND_PATH.split("Z")
    .map(landPolygon)
    .filter((poly) => poly.length >= 3);
  return drawnLand;
}

/**
 * Is this city-space point on land?
 *
 * Tested against the drawn coastline rather than the coarse landmasses,
 * because the coarse ones are not what the player sees: New York and São
 * Paulo both sit on the map's real land and *outside* the hand-drawn polygon
 * for their continent, so the old test called two shipped markers sea. Islands
 * and inland seas are handled by counting crossings odd-even across every
 * subpath, which is the fill rule the browser uses to paint the same path.
 */
export function isOnLand(x: number, y: number): boolean {
  const my = sy(y);
  let crossings = 0;
  for (const poly of landPolygons()) if (inPolygon(x, my, poly)) crossings++;
  return crossings % 2 === 1;
}

/**
 * A route between two cities, as a gentle arc.
 *
 * Straight lines across a world map read as errors — a shallow curve reads as
 * a route. The control point is pushed off the midpoint perpendicular to the
 * line, by a fraction of its length so short hops bow less than long ones, and
 * capped so a Lyon-to-Tokyo run does not loop into the Arctic.
 */
export function routePath(
  a: { x: number; y: number },
  b: { x: number; y: number },
): string {
  const ax = a.x;
  const ay = sy(a.y);
  const bx = b.x;
  const by = sy(b.y);
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(len * 0.16, 6);
  const cx = (ax + bx) / 2 - (dy / len) * bow;
  const cy = (ay + by) / 2 + (dx / len) * bow;
  return `M${ax.toFixed(2)},${ay.toFixed(2)} Q${cx.toFixed(2)},${cy.toFixed(2)} ${bx.toFixed(2)},${by.toFixed(2)}`;
}
