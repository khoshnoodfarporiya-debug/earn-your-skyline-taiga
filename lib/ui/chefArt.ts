import { PREMISES, SERVICES } from "../game/careers/kitchen";
import type { KitchenState } from "../game/careers/kitchen";
import { ART_SIZES } from "./purchaseArt.generated";
import type { Visual } from "./visuals";

/**
 * THE CHEF'S ARTWORK
 *
 * One map from the kitchen's own ids and states to the runtime image. Nothing
 * in the Chef's components builds an image path.
 *
 * ------------------------------------------------------------- the ids rule
 *
 * Keys are the ids the *simulation* uses — `stall`, `bistro`, `lunch`,
 * `tasting` — exactly as `purchaseArt.ts` keys off `clinic` and `mri`. That is
 * what stops the registry drifting from the catalogue: `missingChefArt()`
 * walks `PREMISES` and `SERVICES` and asks this map about each one, and a
 * check fails on anything it cannot answer. Add a sixth service and the test
 * goes red before a screen does.
 *
 * ------------------------------------------------------- the states, not moods
 *
 * The two larder images are not decoration that alternates. `larderArt()`
 * takes the larder and the week and returns the expiring picture only when
 * stock is genuinely about to be written off — the same arithmetic the panel
 * beside it prints. A picture that disagreed with the number under it would be
 * worse than no picture.
 *
 * ------------------------------------------------------------- two variants
 *
 * `src` is 720px for cards, `large` 1200px for a hero. Both come out of
 * `npm run build:art` from the 1536×1024 masters in
 * `art-source/visuals/careers`, which are never served.
 */

export interface ChefArt extends Visual {
  /** 1200px wide, for a screen's lead image. */
  large: string;
}

/** Where the runtime files live. Every path in this module comes from here. */
const DIR = "/visuals/careers";

/* All fourteen masters are 1536x1024 — a true 3:2 — so a card and a banner
   crop the same picture rather than needing separate art. */
const RATIO = { width: 720, height: 480 } as const;

function art(file: string, focus: string, alt: string): ChefArt {
  const size = ART_SIZES[`careers/${file}`] ?? RATIO;
  return {
    src: `${DIR}/${file}.webp`,
    large: `${DIR}/${file}@2x.webp`,
    width: size.width,
    height: size.height,
    focus,
    alt,
  };
}

/**
 * The room you cook in, keyed by premises id.
 *
 * The market stall borrows the market-kitchen master rather than going
 * without: it is the same trade at the same scale, and a starting player who
 * sees nothing where every later tier has a photograph reads the absence as a
 * missing file.
 */
export const PREMISES_ART: Record<string, ChefArt> = {
  stall: art(
    "chef-market-kitchen",
    "center 55%",
    "A market kitchen at night: a griddle, stacked crates of produce and a queue at the counter.",
  ),
  bistro: art(
    "chef-premises-bistro",
    "center 55%",
    "A small bistro dining room with a handful of laid tables and an open pass to the kitchen.",
  ),
  restaurant: art(
    "chef-premises-restaurant",
    "center 52%",
    "A full restaurant dining room, tables set across two sections, with a brigade working behind the pass.",
  ),
  flagship: art(
    "chef-premises-flagship",
    "center 50%",
    "A flagship dining room with high ceilings, a chef's table and a large brigade at work.",
  ),
  destination: art(
    "chef-premises-destination",
    "center 54%",
    "A destination restaurant in a dramatic landscape, its dining room glowing as guests arrive.",
  ),
};

/**
 * A service, keyed by the id in `SERVICES`.
 *
 * Dinner uses the dinner-service master, which is also the picture of a
 * kitchen mid-service — the busiest thing this career does.
 */
export const SERVICE_ART: Record<string, ChefArt> = {
  lunch: art(
    "chef-service-lunch",
    "center 55%",
    "A busy lunch service: plates going out fast across a counter to a full room in daylight.",
  ),
  dinner: art(
    "chef-dinner-service",
    "center 50%",
    "A dinner service in full flow, plates on the pass under the heat lamps and a full dining room beyond.",
  ),
  event: art(
    "chef-service-private-event",
    "center 52%",
    "A private event: one long table laid for a party, with staff plating a single agreed menu.",
  ),
  catering: art(
    "chef-service-catering",
    "center 55%",
    "Catering trays being packed and loaded into a van for food cooked here and eaten somewhere else.",
  ),
  tasting: art(
    "chef-service-tasting",
    "center 50%",
    "A tasting menu course being finished with tweezers under a lamp, twelve plates lined up on the pass.",
  ),
  counter: art(
    "chef-service-counter",
    "center 52%",
    "An intimate chef's counter with guests facing the pass while dishes are finished in front of them.",
  ),
};

/** The larder, in the only two states the picture can honestly show. */
export const LARDER_ART = {
  fresh: art(
    "chef-larder-fresh",
    "center 50%",
    "A cold larder stocked with fresh produce, crates and hanging cuts in good order.",
  ),
  expiring: art(
    "chef-larder-expiring",
    "center 50%",
    "The same larder with produce past its best: wilted leaves and boxes set aside to be thrown out.",
  ),
} as const;

/** Where the food comes from. Shown on the ordering panel, not on the stock. */
export const SUPPLIER_ART = art(
  "chef-supplier-delivery",
  "center 52%",
  "A supplier's van at the kitchen door at dawn, crates being carried in and checked off.",
);

/** The brigade, before service. */
export const BRIGADE_ART = art(
  "chef-brigade-briefing",
  "center 45%",
  "A brigade lined up at the pass for the pre-service briefing, jackets on, listening.",
);

/**
 * The critic.
 *
 * Registered here as well as in `EVENT_VISUALS` — the event dialog reads the
 * shared registry like every other career's events do, and this entry is what
 * that one points at, so there is still exactly one path to the file.
 */
export const CRITIC_ART = art(
  "chef-event-critic",
  "center 45%",
  "A diner at a corner table photographing a plate and writing notes, unnoticed by the room.",
);

export const premisesArt = (id: string): ChefArt | null =>
  PREMISES_ART[id] ?? null;

export const serviceArt = (id: string): ChefArt | null =>
  SERVICE_ART[id] ?? null;

/**
 * Which larder picture the run has earned this week.
 *
 * `expiring` the moment anything is already past its life or dies at the end
 * of this week — which is exactly when the panel starts saying "Goes in the
 * bin" and "Last week". An empty larder is `null`: there is nothing to
 * photograph, and the empty state says so in words.
 */
export function larderArt(
  k: KitchenState,
  week: number,
  extraLife: number,
  shelfLifeOf: (produceId: string) => number | null,
  /**
   * The pantry's own reading, when there is one.
   *
   * The picture is of *stock*, and stock is now two things: crates of staple
   * and named ingredients. Either being close to its life shows the bin, and
   * either being present is enough for there to be a picture at all — a
   * kitchen with a full pantry and no crates is not an empty larder.
   */
  pantry?: { stocked: boolean; atRisk: boolean },
): { art: ChefArt; state: "fresh" | "expiring" } | null {
  if (k.larder.length === 0 && !pantry?.stocked) return null;
  const cratesAtRisk = k.larder.some((lot) => {
    const life = shelfLifeOf(lot.produce);
    if (life === null) return false;
    const left = Math.max(1, (lot.life ?? life) + extraLife) - (week - lot.boughtWeek);
    return left <= 1;
  });
  return cratesAtRisk || pantry?.atRisk
    ? { art: LARDER_ART.expiring, state: "expiring" }
    : { art: LARDER_ART.fresh, state: "fresh" };
}

/**
 * CATALOGUE ENTRIES WHOSE MASTERS HAVE NOT LANDED
 *
 * The same convention `purchaseArt.ts` uses, and for the same reason: a
 * catalogue can gain an entry before the photograph of it exists, and the
 * honest state for those weeks is a named gap rather than either a broken
 * image or somebody else's picture pretending to be this one.
 *
 * Both of these arrived with the luxury tier. They render the same
 * typographic fallback every un-arted card in this project renders — a
 * supported state, not a hole — and the shot list carries their briefs.
 *
 * **Delete an id from this set the moment its master lands in
 * `art-source/visuals/careers`.** `npm run build:art` then produces the file
 * and the entry below starts resolving.
 */
export const AWAITING_CHEF_ART: ReadonlySet<string> = new Set();

/**
 * Catalogue entries this registry cannot answer for.
 *
 * Anything on `AWAITING_CHEF_ART` is excluded, so the check stays a guard
 * against *drift* — a sixth service added and forgotten — rather than a
 * standing failure for artwork that is known to be outstanding.
 */
export function missingChefArt(): string[] {
  return [
    ...PREMISES.filter((p) => !PREMISES_ART[p.id]).map((p) => `premises:${p.id}`),
    ...SERVICES.filter((s) => !SERVICE_ART[s.id]).map((s) => `service:${s.id}`),
  ].filter((id) => !AWAITING_CHEF_ART.has(id));
}

/** The known gap, so a test can report it rather than assert it away. */
export const awaitingChefArt = (): string[] => [...AWAITING_CHEF_ART];

/** Every runtime path this registry can produce, for the on-disk check. */
export function chefArtPaths(): string[] {
  const all = [
    ...Object.values(PREMISES_ART),
    ...Object.values(SERVICE_ART),
    ...Object.values(LARDER_ART),
    SUPPLIER_ART,
    BRIGADE_ART,
    CRITIC_ART,
  ];
  return [...all.map((a) => a.src), ...all.map((a) => a.large)];
}
