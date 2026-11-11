import type {
  ActiveOutbreak,
  CityId,
  FacilityTypeId,
  MedicalState,
} from "../game/medical/types";
import { CITIES } from "../game/medical/cities";
import { CRITIC_ART } from "./chefArt";

/**
 * Visual asset registry.
 *
 * Everything the interface knows about artwork lives here: where the file is,
 * what it means, and how it should be framed. Components read this rather
 * than hardcoding paths, so adding a picture is a data change and never a
 * chain of conditionals.
 *
 * None of it is authoritative game data — the panels beside these images stay
 * the source of truth. The artwork is atmosphere.
 */

export interface Visual {
  src: string;
  width: number;
  height: number;
  /**
   * Empty alt marks the image decorative, which is correct when the text
   * beside it already carries the meaning. Screen readers then skip it
   * instead of announcing a description of scenery.
   */
  alt: string;
  /** object-position, chosen so the subject survives a hard crop. */
  focus: string;
}

// ------------------------------------------------------- event artwork

/**
 * Keyed by event id. Adding artwork for another event is one entry here and
 * no change to the event presentation at all.
 */
/**
 * How an event reads before you have finished the sentence: what part of the
 * practice it lands on, and how hard. `severity` is derived from the event's
 * own `tone` at the call site rather than duplicated here — this carries only
 * what the game does not already know.
 */
export interface EventPresentation extends Visual {
  /** Which part of the business this belongs to. */
  category: string;
}

export const EVENT_VISUALS: Record<string, EventPresentation> = {
  inspection: {
    src: "/visuals/event-regulatory-inspection.webp",
    width: 1536,
    height: 1024,
    category: "Regulatory",
    alt:
      "Two inspectors in suits reading through record folders at a clinic reception desk while clinical staff look on.",
    // Subjects sit in the upper-middle band; a centred crop would behead them.
    focus: "center 38%",
  },
  equipment_failure: {
    src: "/visuals/events/event-equipment-failure.webp",
    width: 1672,
    height: 941,
    category: "Estate",
    alt: "A failed diagnostic machine in a darkened clinic room with a warning light on its console.",
    focus: "center 45%",
  },
  staff_resignation: {
    src: "/visuals/events/event-staff-resignation.webp",
    width: 1672,
    height: 941,
    category: "Staffing",
    alt: "A clinician clearing a desk into a box at the end of a shift while colleagues work behind them.",
    focus: "center 42%",
  },
  insurer_contract: {
    src: "/visuals/events/event-insurer-contract.webp",
    width: 1672,
    height: 941,
    category: "Commercial",
    alt: "Two people signing a contract across a boardroom table in a private healthcare office.",
    focus: "center 45%",
  },
  malpractice_claim: {
    src: "/visuals/events/event-malpractice-claim.webp",
    width: 1672,
    height: 941,
    category: "Clinical risk",
    alt: "A legal letter and case notes spread across a desk beside a doctor's coat.",
    focus: "center 48%",
  },
  /*
   * The Chef's critic.
   *
   * Keyed by the event id like every other entry, so the dialog that renders
   * a Physician's inspection renders this with no knowledge of which career
   * raised it. The file itself is declared once in `chefArt.ts` — this points
   * at that entry rather than repeating the path.
   */
  critic: {
    src: CRITIC_ART.src,
    width: CRITIC_ART.width,
    height: CRITIC_ART.height,
    category: "Reviews",
    alt: CRITIC_ART.alt,
    focus: CRITIC_ART.focus,
  },
};

export const eventVisual = (eventId: string): EventPresentation | null =>
  EVENT_VISUALS[eventId] ?? null;

/**
 * Outbreak response.
 *
 * Not keyed to an event id: outbreaks are a condition that sits on the
 * network for weeks, not a modal with buttons, so the artwork belongs on the
 * response screen and appears only while one is actually running.
 */
export const OUTBREAK_VISUAL: Visual = {
  src: "/visuals/events/event-outbreak-response.webp",
  width: 1672,
  height: 941,
  alt: "",
  focus: "center 45%",
};

// ------------------------------------------------------------------ careers

/**
 * Cover art for the career-selection cards, keyed by career id. A career with
 * no entry still renders — it simply gets the flat card it had before.
 */
export const CAREER_VISUALS: Record<string, Visual> = {
  doctor: {
    src: "/visuals/careers/career-physician.webp",
    width: 1448,
    height: 1086,
    alt: "",
    focus: "center 35%",
  },
  chef: {
    src: "/visuals/careers/career-chef.webp",
    width: 1448,
    height: 1086,
    alt: "",
    focus: "center 40%",
  },
  lawyer: {
    src: "/visuals/careers/career-solicitor.webp",
    width: 1448,
    height: 1086,
    alt: "",
    focus: "center 35%",
  },
  architect: {
    src: "/visuals/careers/career-architect.webp",
    width: 1448,
    height: 1086,
    alt: "",
    focus: "center 38%",
  },
  founder: {
    src: "/visuals/careers/career-founder.webp",
    width: 1448,
    height: 1086,
    alt: "",
    focus: "center 38%",
  },
  politician: {
    src: "/visuals/careers/career-politician.webp",
    width: 1448,
    height: 1086,
    alt: "",
    focus: "center 35%",
  },
  engineer: {
    src: "/visuals/careers/career-engineer.webp",
    width: 1448,
    height: 1086,
    alt: "",
    focus: "center 38%",
  },
};

export const careerVisual = (careerId: string): Visual | null =>
  CAREER_VISUALS[careerId] ?? null;

// ------------------------------------------------------------------- cities

/**
 * City artwork, keyed by the game's own city ids.
 *
 * The filenames hyphenate where the ids do not (`newyork` is
 * `city-new-york.webp`), so this map is the single place that reconciles the
 * two. Nothing else in the app builds a city image path.
 *
 * These are only ever loaded one at a time, for the selected city — fourteen
 * full-size photographs must never land when the map first renders.
 */
export const CITY_VISUALS: Record<string, Visual> = Object.fromEntries(
  (
    [
      ["lyon", "city-lyon"],
      ["madrid", "city-madrid"],
      ["milan", "city-milan"],
      ["berlin", "city-berlin"],
      ["amsterdam", "city-amsterdam"],
      ["paris", "city-paris"],
      ["london", "city-london"],
      ["dubai", "city-dubai"],
      ["singapore", "city-singapore"],
      ["tokyo", "city-tokyo"],
      ["newyork", "city-new-york"],
      ["saopaulo", "city-sao-paulo"],
      ["mumbai", "city-mumbai"],
      ["lagos", "city-lagos"],
    ] as const
  ).map(([id, file]) => [
    id,
    {
      src: `/visuals/cities/${file}.webp`,
      width: 1672,
      height: 941,
      alt: "",
      focus: "center 45%",
    } satisfies Visual,
  ]),
);

export const cityVisual = (cityId: string): Visual | null =>
  CITY_VISUALS[cityId] ?? null;

// ---------------------------------------------------------------- clustering

/**
 * A group of markets close enough together to be drawn as one marker.
 *
 * Most clusters have exactly one member — the interesting case is western
 * Europe, where seven of the fourteen markets sit inside a few percent of the
 * board because that is genuinely where they are. Drawing seven overlapping
 * 40px targets there is worse than drawing one that says "7".
 */
export interface MapCluster {
  /** Stable across renders: the members' ids, sorted. */
  id: string;
  /** Centroid, in the same 0-100 space as a node. */
  x: number;
  y: number;
  members: MapNode[];
  /** The member the cluster speaks for — the most invested-in one. */
  lead: MapNode;
}

/** How much the player has committed here; lower sorts first. */
const weight = (n: MapNode, selected: string | null) =>
  n.id === selected
    ? 0
    : n.isHome
      ? 1
      : n.state === "operating"
        ? 2
        : n.state === "licensed"
          ? 3
          : 4;

/**
 * Group markers that would otherwise overlap at this zoom.
 *
 * Pure, so the rule can be tested without a browser: nodes in, clusters out,
 * and the only inputs are geometry and zoom. Deterministic too — members are
 * considered in a fixed importance order, so the same state always produces
 * the same grouping rather than one that depends on array order.
 *
 * The selected city never joins a cluster. Selecting a market and then having
 * it vanish into a badge would be the interface arguing with the player.
 */
export function clusterNodes(
  nodes: MapNode[],
  opts: { zoom: number; boardPx: number; minSeparationPx?: number; selected?: string | null },
): MapCluster[] {
  const { zoom, boardPx, minSeparationPx = 44, selected = null } = opts;
  // The board is 100 x 56, so a unit of Y is 0.56 of a unit of X.
  const pxPerX = (boardPx * zoom) / 100;
  const pxPerY = (boardPx * zoom * 0.56) / 100;

  const clusters: MapCluster[] = [];
  const ordered = [...nodes].sort(
    (a, b) => weight(a, selected) - weight(b, selected) || a.id.localeCompare(b.id),
  );

  for (const n of ordered) {
    const solo = n.id === selected;
    const near = solo
      ? undefined
      : clusters.find((c) => {
          if (c.lead.id === selected) return false;
          const dx = (c.x - n.x) * pxPerX;
          const dy = (c.y - n.y) * pxPerY;
          return Math.hypot(dx, dy) < minSeparationPx;
        });

    if (near) {
      near.members.push(n);
      // Re-centre on the members so the badge sits among them, not on the
      // first one that happened to arrive.
      near.x = near.members.reduce((t, m) => t + m.x, 0) / near.members.length;
      near.y = near.members.reduce((t, m) => t + m.y, 0) / near.members.length;
    } else {
      clusters.push({ id: n.id, x: n.x, y: n.y, members: [n], lead: n });
    }
  }

  /*
   * A cluster's centroid can land on top of a marker that stayed out of it —
   * most obviously the selected city, which is usually in the middle of the
   * very crowd it was excluded from. Lyon sits among the other six European
   * markets, so the badge for those six lands squarely on Lyon.
   *
   * So the badges step aside. Only multi-member clusters move, because a
   * single-member cluster *is* a city and has to stay where the city is.
   */
  const singles = clusters.filter((c) => c.members.length === 1);
  /*
   * Badges need more room from a marker than markers need from each other.
   * A marker carries a name below it and a panel count above-right; a badge
   * carries its own caption. Clearing the dots is not enough — at exactly
   * `minSeparationPx` the "5 markets" badge and Lyon's label were legibly
   * tangled even though the two buttons did not technically overlap.
   */
  const badgeClearance = minSeparationPx * 1.7;
  for (const c of clusters) {
    if (c.members.length === 1) continue;
    for (const s of singles) {
      const dx = (c.x - s.x) * pxPerX;
      const dy = (c.y - s.y) * pxPerY;
      const dist = Math.hypot(dx, dy);
      if (dist >= badgeClearance) continue;
      // Push along the line between them; straight up if they coincide, since
      // a label hangs below a marker and there is more room above.
      const push = (badgeClearance - dist) / (dist || 1);
      c.x += dist === 0 ? 0 : (dx / pxPerX) * push;
      c.y += dist === 0 ? -badgeClearance / pxPerY : (dy / pxPerY) * push;
    }
  }

  for (const c of clusters) {
    c.id = c.members
      .map((m) => m.id)
      .sort()
      .join("+");
  }
  return clusters;
}

// ----------------------------------------------------------------- sections

/**
 * Which gradient a banner wants. `bottom` for a caption on the lower edge,
 * `full` for text laid across the whole frame — the same vocabulary
 * `ArtFrame` takes, so a registry entry can be handed straight to it.
 */
export type SectionScrim = "bottom" | "full";

export interface SectionVisual extends Visual {
  id: string;
  scrim: SectionScrim;
}

/**
 * Screen banners, keyed by the section they head.
 *
 * All of it is atmosphere: the title, the figures and the status all live in
 * real HTML laid over the frame, so every entry carries empty alt text. An
 * image that actually carried information would need a description, and none
 * of these do.
 *
 * One banner per screen entrance, never per subsection — a picture on every
 * card is noise, and it pushes the controls below the fold.
 */
export const SECTION_VISUALS: Record<string, SectionVisual> = {
  overview: {
    id: "overview",
    src: "/visuals/sections/section-overview.webp",
    width: 1672,
    height: 941,
    alt: "",
    focus: "center 42%",
    scrim: "full",
  },
  staff: {
    id: "staff",
    src: "/visuals/sections/section-staff.webp",
    width: 1919,
    height: 820,
    alt: "",
    focus: "center 40%",
    scrim: "bottom",
  },
  caseload: {
    id: "caseload",
    src: "/visuals/sections/section-caseload.webp",
    width: 1942,
    height: 809,
    alt: "",
    focus: "center 45%",
    scrim: "bottom",
  },
  career: {
    id: "career",
    src: "/visuals/sections/section-career.webp",
    width: 1935,
    height: 813,
    alt: "",
    focus: "center 38%",
    scrim: "bottom",
  },
  life: {
    id: "life",
    src: "/visuals/sections/section-life.webp",
    width: 1935,
    height: 813,
    alt: "",
    focus: "center 45%",
    scrim: "bottom",
  },
  growth: {
    id: "growth",
    src: "/visuals/sections/section-expansion.webp",
    width: 2172,
    height: 724,
    alt: "",
    focus: "center 45%",
    scrim: "bottom",
  },
};

export const sectionVisual = (id: string): SectionVisual | null =>
  SECTION_VISUALS[id] ?? null;

// --------------------------------------------------------------- milestones

/**
 * Shown on the end screen, and only for a won run — which the doctor career
 * grants when the student debt is cleared *and* net worth clears the goal.
 * It is never shown for a loss or a timeout.
 */
export const MILESTONE_VISUAL: Visual = {
  src: "/visuals/milestones/milestone-hospital-victory.webp",
  width: 1672,
  height: 941,
  alt: "",
  focus: "center 40%",
};

// --------------------------------------------------- practice progression

export interface PracticeStage {
  id: FacilityTypeId;
  label: string;
  /** Where this building sits across the artwork, as percentages. */
  from: number;
  to: number;
}

/**
 * The progression artwork is a single cutaway strip showing all four premises
 * left to right. These bands say which slice of the image is which building,
 * so the interface can highlight the one you actually own and veil the rest.
 */
/**
 * Served as WebP: same 1672x941 artwork at 109KB instead of the source PNG's
 * 1.8MB. This is the Largest Contentful Paint element on the Build screen, so
 * the source size is the first-request latency. The original PNG is untouched
 * in `public/visuals` and remains the master.
 */
export const PRACTICE_VISUAL: Visual = {
  src: "/visuals/practice-progression.webp",
  width: 1672,
  height: 941,
  alt: "",
  // Buildings occupy the lower two-thirds; the top is sky.
  focus: "center 72%",
};

export const PRACTICE_STAGES: PracticeStage[] = [
  { id: "room", label: "Rented exam room", from: 0, to: 21 },
  { id: "clinic", label: "Community clinic", from: 21, to: 43 },
  { id: "centre", label: "Medical centre", from: 43, to: 69 },
  { id: "hospital", label: "Regional hospital", from: 69, to: 100 },
];

const STAGE_ORDER: FacilityTypeId[] = ["room", "clinic", "centre", "hospital"];

/**
 * The best premises actually standing anywhere in the network.
 *
 * Derived from owned facilities rather than from cash or week, so the picture
 * can never imply you have a hospital before you have bought one.
 */
export function practiceStageIndex(m: MedicalState): number {
  let best = -1;
  for (const facility of m.facilities) {
    const rank = STAGE_ORDER.indexOf(facility.type);
    if (rank > best) best = rank;
  }
  return best;
}

// ------------------------------------------------------------ network map

/**
 * NOT CURRENTLY RENDERED.
 *
 * This artwork used to sit behind the network map as a 7% texture, which cost
 * a 2.5MB download and a Largest Contentful Paint warning to deliver something
 * effectively invisible. The map is drawn in SVG now (`worldmap.ts`) and the
 * ocean is two CSS gradients.
 *
 * The entry is kept because the artwork may be wanted elsewhere — as a menu
 * backdrop, say — and it points at the 175KB WebP. The 2.5MB master lives in
 * `art-source/visuals`, outside the deployed bundle.
 */
export const NETWORK_VISUAL: Visual = {
  src: "/visuals/healthcare-network-map.webp",
  width: 1672,
  height: 941,
  alt: "",
  focus: "center center",
};

/**
 * How far along a market is, in the only terms the map cares about.
 *
 *   locked    — no licence; you cannot buy premises there yet
 *   licensed  — licence held, nothing built. This is what a market looks like
 *               the moment it unlocks, which is why it reads as its own state
 *               rather than being lumped in with operating.
 *   operating — at least one site standing
 */
export type NodeState = "locked" | "licensed" | "operating";

export interface MapNode {
  id: CityId;
  name: string;
  country: string;
  x: number;
  y: number;
  label: { dx: number; dy: number; anchor: "start" | "middle" | "end" };
  state: NodeState;
  isHome: boolean;
  panel: number;
  sites: number;
  /** The outbreak running here, if one is. Null is the common case. */
  outbreak: ActiveOutbreak | null;
}

/**
 * Every market as a point on the map, with the live run state attached.
 *
 * Pure, so the classification can be tested without rendering anything: a
 * city is operating only when premises actually stand in it, never because
 * a licence was bought.
 */
export function networkNodes(m: MedicalState): MapNode[] {
  const sitesPerCity = new Map<CityId, number>();
  for (const f of m.facilities) {
    sitesPerCity.set(f.city, (sitesPerCity.get(f.city) ?? 0) + 1);
  }

  return CITIES.map((c) => {
    const sites = sitesPerCity.get(c.id) ?? 0;
    const state: NodeState =
      sites > 0 ? "operating" : m.cities.includes(c.id) ? "licensed" : "locked";
    return {
      id: c.id,
      name: c.name,
      country: c.country,
      x: c.map.x,
      y: c.map.y,
      label: c.label,
      state,
      isHome: m.homeCity === c.id,
      panel: Math.round(m.panels[c.id] ?? 0),
      sites,
      outbreak: m.outbreaks.find((o) => o.city === c.id) ?? null,
    };
  });
}

export interface MapRoute {
  from: CityId;
  to: CityId;
  a: { x: number; y: number };
  b: { x: number; y: number };
}

/**
 * The lines drawn between where you work and where you operate.
 *
 * Origin is the home city, so relocating redraws every route from the new
 * base. Only operating cities get one — a licence with nothing built is not a
 * connection to anywhere — and the home city never links to itself.
 */
export function networkRoutes(m: MedicalState): MapRoute[] {
  const nodes = networkNodes(m);
  const home = nodes.find((n) => n.isHome);
  if (!home) return [];
  return nodes
    .filter((n) => n.state === "operating" && n.id !== home.id)
    .map((n) => ({
      from: home.id,
      to: n.id,
      a: { x: home.x, y: home.y },
      b: { x: n.x, y: n.y },
    }));
}
