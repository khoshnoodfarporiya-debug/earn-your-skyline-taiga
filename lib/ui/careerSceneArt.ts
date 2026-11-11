import type { StaffRoleId } from "../game/medical/types";
import type { SetbackKind } from "../game/setbacks";
import { ART_SIZES } from "./purchaseArt.generated";
import type { Visual } from "./visuals";

/** Artwork that has a card derivative and a larger banner derivative. */
export interface SceneArt extends Visual {
  large: string;
}

const FALLBACK = { width: 720, height: 480 } as const;

function scene(
  group: "careers" | "events" | "setbacks" | "milestones" | "staff",
  file: string,
  focus: string,
  alt = "",
): SceneArt {
  const nested = group === "staff" ? `purchases/${group}` : group;
  const size = ART_SIZES[`${group}/${file}`] ?? FALLBACK;
  const base = `/visuals/${nested}/${file}`;
  return {
    src: `${base}.webp`,
    large: `${base}@2x.webp`,
    width: size.width,
    height: size.height,
    focus,
    alt,
  };
}

export const STAFF_ART: Record<StaffRoleId, SceneArt> = {
  gp: scene("staff", "staff-gp", "center 48%"),
  nurse: scene("staff", "staff-nurse", "center 48%"),
  specialist: scene("staff", "staff-specialist", "center 45%"),
  surgeon: scene("staff", "staff-surgeon", "center 44%"),
  technician: scene("staff", "staff-technician", "center 48%"),
  admin: scene("staff", "staff-administrator", "center 48%"),
  paramedic: scene("staff", "staff-paramedic", "center 48%"),
  comms: scene("staff", "staff-communications-manager", "center 46%"),
};

export const SETBACK_ART: Record<SetbackKind, SceneArt> = {
  collapse: scene("setbacks", "setback-collapse", "center 45%"),
  suspension: scene("setbacks", "setback-suspension", "center 50%"),
  insolvency: scene("setbacks", "setback-insolvency", "center 54%"),
  disgrace: scene("setbacks", "setback-disgrace", "center 44%"),
};

export const OUTBREAK_CONTAINMENT_ART = scene(
  "events",
  "event-outbreak-containment",
  "center 48%",
);

/** Only milestone ids with purpose-made artwork are listed. */
export const MILESTONE_ART: Record<string, SceneArt> = {
  "debt-clear": scene("milestones", "milestone-debt-free", "center 48%"),
  "first-million": scene("milestones", "milestone-first-million", "center 48%"),
  international: scene(
    "milestones",
    "milestone-international-group",
    "center 46%",
  ),
  "second-site": scene("milestones", "milestone-second-site", "center 50%"),
  "went-viral": scene("milestones", "milestone-went-viral", "center 45%"),
};

export type SolicitorSceneId =
  | "borrowed-desk"
  | "chambers"
  | "established-firm"
  | "court-corridor"
  | "client-meeting"
  | "case-files"
  | "case-preparation"
  | "negotiation"
  | "hearing"
  | "legal-team"
  | "regulatory-investigation";

export const SOLICITOR_ART: Record<SolicitorSceneId, SceneArt> = {
  "borrowed-desk": scene("careers", "solicitor-borrowed-desk", "center 48%"),
  chambers: scene("careers", "solicitor-chambers", "center 50%"),
  "established-firm": scene(
    "careers",
    "solicitor-established-firm",
    "center 48%",
  ),
  "court-corridor": scene("careers", "solicitor-court-corridor", "center 48%"),
  "client-meeting": scene("careers", "solicitor-client-meeting", "center 45%"),
  "case-files": scene("careers", "solicitor-case-files", "center 52%"),
  "case-preparation": scene(
    "careers",
    "solicitor-case-preparation",
    "center 50%",
  ),
  negotiation: scene("careers", "solicitor-negotiation", "center 48%"),
  hearing: scene("careers", "solicitor-hearing", "center 45%"),
  "legal-team": scene("careers", "solicitor-legal-team", "center 48%"),
  "regulatory-investigation": scene(
    "careers",
    "solicitor-regulatory-investigation",
    "center 46%",
  ),
};

/**
 * Career-screen scenes for the four newer careers.
 *
 * The screen id is deliberately the lookup key: navigation decides where the
 * player is, while this registry only decides which decorative environment
 * belongs there. Keeping that relationship here prevents screen components
 * from accumulating image paths and crop values.
 */
export type IllustratedCareerId =
  | "founder"
  | "politician"
  | "architect"
  | "engineer";

export const CAREER_SCREEN_ART: Record<
  IllustratedCareerId,
  Record<string, SceneArt>
> = {
  founder: {
    runway: scene("careers", "founder-runway", "center 50%"),
    crew: scene("careers", "founder-team", "center 48%"),
    raising: scene("careers", "founder-raising", "center 48%"),
  },
  politician: {
    polling: scene("careers", "politician-polling", "center 48%"),
    blocs: scene("careers", "politician-electorate", "center 50%"),
    positions: scene("careers", "politician-positions", "center 48%"),
    office: scene("careers", "politician-office", "center 45%"),
  },
  architect: {
    boards: scene("careers", "architect-boards", "center 50%"),
    offers: scene("careers", "architect-offers", "center 48%"),
    competitions: scene("careers", "architect-competitions", "center 48%"),
    atelier: scene("careers", "architect-studio", "center 50%"),
  },
  engineer: {
    bench: scene("careers", "engineer-bench", "center 48%"),
    newbuild: scene("careers", "engineer-newbuild", "center 50%"),
  },
};

export function careerScreenArt(
  careerId: IllustratedCareerId,
  screen: string,
): SceneArt | null {
  return CAREER_SCREEN_ART[careerId][screen] ?? null;
}

/** Use the larger derivative when a scene becomes a full-width banner. */
export const asBanner = (art: SceneArt): Visual => ({ ...art, src: art.large });
