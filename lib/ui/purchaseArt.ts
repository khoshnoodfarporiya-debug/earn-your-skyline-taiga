import {
  EQUIPMENT,
  FACILITY_TYPES,
  SPECIALTIES,
} from "../game/medical/data";
import { LIFESTYLE } from "../game/medical/lifestyle";
import { FLEET } from "../game/medical/fleet";
import { ART_SIZES } from "./purchaseArt.generated";

/**
 * ARTWORK FOR EVERYTHING YOU CAN BUY
 *
 * One map from the game's own item ids to the runtime image. Nothing else in
 * the app builds a purchase-image path.
 *
 * ------------------------------------------------------------- the ids rule
 *
 * The keys here are the ids the *simulation* uses — `clinic`, `mri`,
 * `cardiology`, `country_estate` — not filenames and not a parallel list. That
 * is what stops the registry drifting from the catalogue: `missingArt()` walks
 * `FACILITY_TYPES`, `SPECIALTIES`, `EQUIPMENT` and `LIFESTYLE` and asks this
 * map about each one, and a test fails on anything it cannot answer.
 *
 * ------------------------------------------------------------- two variants
 *
 * `src` is a 720px-wide WebP for cards; `large` is 1200px for the detail
 * drawer. Both are produced by `npm run build:art` from the PNG masters in
 * `art-source/visuals/purchases`, which are never served.
 *
 * ------------------------------------------------------------- the shape
 *
 * `width` and `height` come from `purchaseArt.generated.ts`, written by the
 * same script that emits the files. The masters arrive at nine different
 * aspect ratios, so a hardcoded "720×450" would reserve the wrong box for most
 * of them — which is precisely the layout shift a reserved box exists to
 * prevent.
 *
 * -------------------------------------------------------------- the crop
 *
 * Cards render into a fixed box with `object-cover`, so the focal point
 * matters: a building wants its lower two-thirds, a ward wants its middle, and
 * a watch wants dead centre. `focus` is an `object-position` and is the only
 * hand-tuned field.
 *
 * ------------------------------------------------------------- the fallback
 *
 * `purchaseArt` returns null rather than a placeholder path, and the card
 * renders a typographic tile with the item's own icon when it does. A broken
 * <img> is worse than no image, and a shared "coming soon" graphic in a
 * shipped tycoon game is worse than both.
 */

export interface PurchaseArt {
  /** 720px wide, for cards. */
  src: string;
  /** 1200px wide, for the detail view. */
  large: string;
  /** Intrinsic size of `src`, so the box is reserved before it loads. */
  width: number;
  height: number;
  /** object-position for the card's crop. */
  focus: string;
  alt: string;
}

type Group =
  | "facilities"
  | "departments"
  | "equipment"
  | "fleet"
  | "homes"
  | "lifestyle";

/**
 * Fallback shape, used only when a registry entry has no generated size —
 * which means the file is not on disk, and the harness fails on that. A 3:2
 * box is closer to the median master than any square.
 */
const UNKNOWN = { width: 720, height: 480 } as const;

function art(
  group: Group,
  file: string,
  focus: string,
  alt: string,
): PurchaseArt {
  const base = `/visuals/purchases/${group}/${file}`;
  const size = ART_SIZES[`${group}/${file}`] ?? UNKNOWN;
  return {
    src: `${base}.webp`,
    large: `${base}@2x.webp`,
    width: size.width,
    height: size.height,
    focus,
    alt,
  };
}

/**
 * Keyed by the id the game uses.
 *
 * Alt text describes the subject, because on a purchase card the picture is
 * often the fastest way to tell a rehabilitation suite from an endoscopy unit.
 * Where a card's own text already names the thing, the component passes an
 * empty alt instead — see `PurchaseCard`.
 */
export const PURCHASE_ART: Record<string, PurchaseArt> = {
  // ------------------------------------------------------------ facilities
  room: art(
    "facilities",
    "facility-rented-exam-room",
    "center 60%",
    "A single consulting room above a pharmacy, with a desk, an examination couch and one window.",
  ),
  clinic: art(
    "facilities",
    "facility-community-clinic",
    "center 65%",
    "A small community clinic with a reception desk, a waiting area and consulting rooms off a corridor.",
  ),
  centre: art(
    "facilities",
    "facility-medical-centre",
    "center 62%",
    "A multi-storey medical centre with diagnostic suites and a glazed entrance.",
  ),
  hospital: art(
    "facilities",
    "facility-regional-hospital",
    "center 60%",
    "A regional hospital with wards, theatres and an emergency entrance under a canopy.",
  ),

  // ---------------------------------------------------------------- fleet
  patient_transport: art(
    "fleet",
    "fleet-patient-transport",
    "center 58%",
    "An unbadged patient transport vehicle waiting outside a clinic entrance.",
  ),
  emergency_ambulance: art(
    "fleet",
    "fleet-emergency-ambulance",
    "center 56%",
    "An unbadged emergency ambulance prepared in a hospital response bay.",
  ),
  mobile_icu: art(
    "fleet",
    "fleet-mobile-icu",
    "center 55%",
    "A large unbadged mobile intensive-care ambulance with its equipment bay open.",
  ),

  // ----------------------------------------------------------- departments
  general: art(
    "departments",
    "department-general-practice",
    "center center",
    "A general practice consulting room with a desk, examination couch and a screen for notes.",
  ),
  paediatrics: art(
    "departments",
    "department-paediatrics",
    "center center",
    "A paediatric clinic room with child-height furniture, bright walls and a play corner.",
  ),
  dermatology: art(
    "departments",
    "department-dermatology",
    "center center",
    "A dermatology room with a dermatoscope, task lighting and an examination chair.",
  ),
  psychiatry: art(
    "departments",
    "department-psychiatry",
    "center center",
    "A psychiatry consulting room with two armchairs, soft lighting and no desk between them.",
  ),
  radiology: art(
    "departments",
    "department-radiology",
    "center center",
    "A radiology reading room with diagnostic monitors and a viewing console.",
  ),
  neurology: art(
    "departments",
    "department-neurology",
    "center center",
    "A neurology assessment room with EEG equipment and an examination couch.",
  ),
  orthopaedics: art(
    "departments",
    "department-orthopaedics",
    "center center",
    "An orthopaedic clinic with a plaster room, imaging light box and a treatment plinth.",
  ),
  cardiology: art(
    "departments",
    "department-cardiology",
    "center center",
    "A cardiology unit with monitoring equipment, an ECG trolley and a patient couch.",
  ),
  maternity: art(
    "departments",
    "department-maternity",
    "center center",
    "A maternity room with a birthing bed, monitoring equipment and a cot beside it.",
  ),
  emergency: art(
    "departments",
    "department-emergency",
    "center center",
    "An emergency department bay with a resuscitation trolley, monitors and curtained cubicles.",
  ),
  surgery: art(
    "departments",
    "department-general-surgery",
    "center center",
    "A general surgical suite with a scrub area and an instrument trolley beside the table.",
  ),
  oncology: art(
    "departments",
    "department-oncology",
    "center center",
    "An oncology day unit with treatment recliners, infusion stands and a nurses' station.",
  ),

  // ------------------------------------------------------------- equipment
  ecg: art(
    "equipment",
    "equipment-ecg",
    "center center",
    "An ECG machine on a trolley with leads coiled beside the trace printer.",
  ),
  lab: art(
    "equipment",
    "equipment-pathology-lab",
    "center center",
    "A pathology bench with analysers, sample racks and a microscope.",
  ),
  ultrasound: art(
    "equipment",
    "equipment-ultrasound",
    "center center",
    "An ultrasound suite with a scanner, probe and examination couch.",
  ),
  xray: art(
    "equipment",
    "equipment-xray",
    "center center",
    "An X-ray room with an overhead tube, table and shielded control window.",
  ),
  pharmacy: art(
    "equipment",
    "equipment-pharmacy",
    "center center",
    "A dispensing pharmacy with stocked shelves and a counter.",
  ),
  physio: art(
    "equipment",
    "equipment-rehabilitation",
    "center center",
    "A rehabilitation suite with parallel bars, exercise equipment and a treatment plinth.",
  ),
  endoscopy: art(
    "equipment",
    "equipment-endoscopy",
    "center center",
    "An endoscopy unit with a monitor stack, scope trolley and procedure couch.",
  ),
  theatre: art(
    "equipment",
    "equipment-operating-theatre",
    "center center",
    "An operating theatre with an overhead lamp array, table and anaesthetic machine.",
  ),
  ct: art(
    "equipment",
    "equipment-ct-scanner",
    "center center",
    "A CT scanner with its gantry and motorised patient table.",
  ),
  dialysis: art(
    "equipment",
    "equipment-dialysis",
    "center center",
    "A dialysis unit with several stations, each with a machine and reclining chair.",
  ),
  icu: art(
    "equipment",
    "equipment-icu",
    "center center",
    "Intensive care beds with ventilators, monitors and infusion pumps.",
  ),
  mri: art(
    "equipment",
    "equipment-mri",
    "center center",
    "An MRI scanner with its bore and patient table in a shielded room.",
  ),

  // ----------------------------------------------------------------- homes
  townhouse: art(
    "homes",
    "home-town-house",
    "center 58%",
    "A narrow terraced town house with a painted front door and railings.",
  ),
  suburban_house: art(
    "homes",
    "home-house-with-garden",
    "center 60%",
    "A detached house on a quiet street with a lawn and mature planting.",
  ),
  penthouse: art(
    "homes",
    "home-city-penthouse",
    "center 55%",
    "A top-floor apartment with floor-to-ceiling glazing and a terrace over the city.",
  ),
  country_estate: art(
    "homes",
    "home-country-estate",
    "center 60%",
    "A country house set in its own grounds behind a gravel drive.",
  ),

  // ------------------------------------------------------------- lifestyle
  reliable_saloon: art(
    "lifestyle",
    "lifestyle-reliable-saloon",
    "center center",
    "An unbadged mid-size saloon car in plain paint.",
  ),
  luxury_saloon: art(
    "lifestyle",
    "lifestyle-luxury-saloon",
    "center center",
    "An unbadged executive saloon with a long bonnet and dark paint.",
  ),
  sports_car: art(
    "lifestyle",
    "lifestyle-sports-car",
    "center center",
    "An unbadged low two-seat sports car.",
  ),
  gym: art(
    "lifestyle",
    "lifestyle-gym-membership",
    "center center",
    "A gym floor with free weights, machines and a running track above.",
  ),
  housekeeper: art(
    "lifestyle",
    "lifestyle-housekeeper",
    "center center",
    "A tidy domestic kitchen and hallway, everything put away.",
  ),
  trainer: art(
    "lifestyle",
    "lifestyle-personal-trainer",
    "center center",
    "A one-to-one training session in a private studio.",
  ),
  private_chef: art(
    "lifestyle",
    "lifestyle-private-chef",
    "center center",
    "A domestic kitchen mid-service, with prepared dishes on the pass.",
  ),
  chauffeur: art(
    "lifestyle",
    "lifestyle-chauffeur",
    "center center",
    "A driver holding the rear door of an unbadged car open at the kerb.",
  ),
  holiday_home: art(
    "lifestyle",
    "lifestyle-holiday-home",
    "center 58%",
    "A coastal holiday house with shutters and a terrace looking out to sea.",
  ),
  yacht: art(
    "lifestyle",
    "lifestyle-yacht",
    "center center",
    "A motor yacht at anchor in calm water.",
  ),
  private_jet: art(
    "lifestyle",
    "lifestyle-private-jet",
    "center center",
    "An unbadged private jet on an apron with its airstair down.",
  ),
  watches: art(
    "lifestyle",
    "lifestyle-watch-collection",
    "center center",
    "Several mechanical watches laid out in a lined case.",
  ),
  art: art(
    "lifestyle",
    "lifestyle-art-collection",
    "center center",
    "Framed paintings hung on a gallery wall under picture lights.",
  ),
  estate_car: art(
    "lifestyle",
    "lifestyle-estate-car",
    "center center",
    "An unbadged practical estate car parked outside a professional office.",
  ),
  electric_saloon: art(
    "lifestyle",
    "lifestyle-electric-saloon",
    "center center",
    "An unbadged electric saloon charging beside a modern clinic.",
  ),
  classic_car: art(
    "lifestyle",
    "lifestyle-classic-car",
    "center center",
    "A carefully maintained unbadged classic car in a quiet courtyard.",
  ),
  supercar: art(
    "lifestyle",
    "lifestyle-supercar",
    "center center",
    "An unbadged modern supercar under restrained showroom lighting.",
  ),
  concierge: art(
    "lifestyle",
    "lifestyle-concierge",
    "center 48%",
    "A private concierge arranging travel and appointments at a discreet desk.",
  ),
  sabbatical_cabin: art(
    "lifestyle",
    "lifestyle-cabin",
    "center 58%",
    "A secluded timber cabin beside a lake and forest, prepared for a quiet sabbatical.",
  ),
  racehorse: art(
    "lifestyle",
    "lifestyle-racehorse",
    "center 48%",
    "A racehorse being walked through a calm training yard at dawn.",
  ),
  helicopter: art(
    "lifestyle",
    "lifestyle-helicopter",
    "center 48%",
    "An unbadged private helicopter on a city helipad at dusk.",
  ),
  wine_cellar: art(
    "lifestyle",
    "lifestyle-wine-cellar",
    "center center",
    "A climate-controlled wine cellar with neatly arranged unlabelled bottles.",
  ),
  rare_books: art(
    "lifestyle",
    "lifestyle-medical-library",
    "center center",
    "A private library of rare medical books in dark timber cases.",
  ),
  vineyard: art(
    "lifestyle",
    "lifestyle-vineyard",
    "center 55%",
    "Rows of vines surrounding a modest stone vineyard estate at golden hour.",
  ),
};

/**
 * The image for a purchasable item, or null.
 *
 * Null is a supported state, not a failure: the card falls back to a
 * typographic tile. Callers must not synthesise a path of their own.
 */
export const purchaseArt = (id: string): PurchaseArt | null =>
  PURCHASE_ART[id] ?? null;

/** Every id the game can sell you, across all five catalogues. */
export const catalogueIds = (): string[] => [
  ...FACILITY_TYPES.map((f) => f.id),
  ...SPECIALTIES.map((s) => s.id),
  ...EQUIPMENT.map((e) => e.id),
  ...FLEET.map((v) => v.id),
  ...LIFESTYLE.map((l) => l.id),
];

/**
 * ITEMS WHOSE ARTWORK HAS NOT BEEN SHOT YET
 *
 * The gameplay for these landed before the masters did. Rather than let the
 * coverage test pass by loosening it — which would also stop it catching a
 * *genuinely* forgotten item — the gap is written down here, by id.
 *
 * `missingArt` still fails for anything not on this list, so the guarantee is
 * intact for every item anybody adds from now on. What changed is that the
 * known gap is enumerated instead of invisible.
 *
 * These cards render the typographic fallback in the meantime, which is a
 * supported state (see `purchaseArt`) rather than a broken one.
 *
 * **Delete an id from this list the moment its master lands in
 * `art-source/visuals/`** — `npm run build:art` then makes the file and the
 * registry entry below starts resolving. When the list is empty, delete it and
 * the `AWAITING_ART` branch in `missingArt` with it.
 */
export const AWAITING_ART: ReadonlySet<string> = new Set();

/**
 * Every catalogue item the registry cannot answer for.
 *
 * Computed from the game's own tables rather than maintained by hand, so
 * adding a thirteenth department without artwork shows up as a failing test
 * rather than as a hole in a screen. Items on `AWAITING_ART` are excluded —
 * see the note there.
 */
export function missingArt(): string[] {
  return catalogueIds().filter(
    (id) => !PURCHASE_ART[id] && !AWAITING_ART.has(id),
  );
}

/** The known gap, so a test can report it rather than assert it away. */
export function awaitingArt(): string[] {
  return catalogueIds().filter(
    (id) => !PURCHASE_ART[id] && AWAITING_ART.has(id),
  );
}

/** Registry entries that point at no catalogue item — the other direction. */
export function orphanArt(): string[] {
  const ids = new Set(catalogueIds());
  return Object.keys(PURCHASE_ART).filter((id) => !ids.has(id));
}
