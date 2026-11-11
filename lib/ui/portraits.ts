import { ART_SIZES } from "./purchaseArt.generated";
import { FULL_CAST } from "../game/medical/cast";

/**
 * FACES
 *
 * One map from a character's stable identity to their portrait. Nothing in the
 * app builds a portrait path.
 *
 * ------------------------------------------------------------- two keyspaces
 *
 * A character can be reached two ways, and they are not the same key:
 *
 *   `PersonDef.id`   who they are in the relationship model — People, Rivals,
 *                    contracts, events
 *   social handle    who they are on the phone — Pulse, comments, messages
 *
 * They overlap for most people and diverge for two, which is the whole reason
 * this module exists rather than a single lookup:
 *
 *   `meridian`   the person is **Dr Anneke Roth**, who runs Meridian Health
 *                Group. `@meridian` is the **group's** account.
 *   `northgate`  the person is **Dr Sofia Aranda**. `@northgate` is
 *                Northgate Private.
 *
 * Resolving a social avatar by person id would put Roth's face on a corporate
 * press release. So `portraitForSocialHandle` is keyed by handle, exactly, and
 * the two organisation handles are absent from it on purpose — as are the
 * three other institutional accounts, which have no human behind them at all.
 *
 * ------------------------------------------------------------- what is here
 *
 * Thirteen cast portraits and five social-only ones. Sand and Duarte appear in
 * both keyspaces and share one file: the same person, the same face, whether
 * you are reading their message or their post.
 *
 * ---------------------------------------------------------- what is not here
 *
 * Procedurally generated staff. There are hundreds of possible names and no
 * portrait pool, so handing any of them a cast member's face would put Dr
 * Lindqvist's photograph on a stranger. They keep the deterministic initials,
 * which are already stable per name.
 */

export interface Portrait {
  /** 160px square, for circular avatars up to about 64px. */
  src: string;
  /** 512px square, for expanded profiles and conversation headers. */
  profile: string;
  width: number;
  height: number;
  /**
   * object-position, for the rare frame that is not square. Every portrait is
   * square today, so this is `center` throughout and exists so a future
   * non-square master does not need a component change.
   */
  focus: string;
}

type Collection = "cast" | "social";

function portrait(collection: Collection, file: string): Portrait {
  const base = `/visuals/characters/${collection}/${file}`;
  const size = ART_SIZES[`characters/${collection}/${file}`] ?? {
    width: 160,
    height: 160,
  };
  return {
    src: `${base}.webp`,
    profile: `${base}@profile.webp`,
    width: size.width,
    height: size.height,
    focus: "center",
  };
}

/* -------------------------------------------------------------- the cast */

/**
 * Keyed by `PersonDef.id`, which is what People, Rivals, contracts and events
 * all carry. `meridian` and `northgate` are the *people* — Anneke Roth and
 * Sofia Aranda — not the organisations that share their ids on the phone.
 */
export const CAST_PORTRAITS: Record<string, Portrait> = {
  hallam: portrait("cast", "character-hallam"),
  okoro: portrait("cast", "character-okoro"),
  lindqvist: portrait("cast", "character-lindqvist"),
  raman: portrait("cast", "character-raman"),
  duarte: portrait("cast", "character-duarte"),
  sand: portrait("cast", "character-sand"),
  mbeki: portrait("cast", "character-mbeki"),
  vasquez: portrait("cast", "character-vasquez"),
  thorne: portrait("cast", "character-thorne"),
  adeyemi: portrait("cast", "character-adeyemi"),
  meridian: portrait("cast", "character-meridian-anneke-roth"),
  voss: portrait("cast", "character-voss-marcus"),
  northgate: portrait("cast", "character-northgate-sofia-aranda"),
};

/* ------------------------------------------------------------- the phone */

/**
 * Keyed by the **exact handle**, including the `@`.
 *
 * Two of these point at cast files rather than social-only ones: Sand and
 * Duarte post under their own names, and giving them a second face would make
 * the phone read as a different cast to the People screen.
 *
 * The organisation accounts — `@meridian`, `@northgate`, `@clinicallede`,
 * `@rhb_press`, `@wellwise` — are deliberately absent. `ORGANISATIONS` below
 * names them so the interface can give them an institutional treatment rather
 * than falling through to a person's initials.
 */
export const SOCIAL_PORTRAITS: Record<string, Portrait> = {
  "@h_sand": portrait("cast", "character-sand"),
  "@i.duarte": portrait("cast", "character-duarte"),
  "@a.nwosu": portrait("social", "social-nwosu"),
  "@coravance": portrait("social", "social-vance"),
  "@mira_ok": portrait("social", "social-mira"),
  "@tomasr": portrait("social", "social-tomas"),
  "@jkell": portrait("social", "social-kell"),
};

/**
 * Accounts that are institutions, not people.
 *
 * They keep initials — but marked as an organisation, so a square-ish tile
 * reads differently from a person's circle at a glance. Inventing a
 * spokesperson for a press office would be fabricating a character the game
 * does not have.
 */
export const ORGANISATIONS: ReadonlySet<string> = new Set([
  "@meridian",
  "@northgate",
  "@clinicallede",
  "@rhb_press",
  "@wellwise",
  /* The Chef's institutional accounts — trade press, the market, a rival
     kitchen's house account, an events agency. Same rule as above: an
     institution renders as a rounded tile, never as somebody's face. */
  "@thepassdaily",
  "@marchecouvert",
  "@saltandcinders",
  "@berger_events",
  /* The Solicitor's — a law report, a recruitment consultancy, the regulator
     and the listing office. Same rule again: an institution is not a person
     and must not borrow somebody's face. */
  "@thelawreport",
  "@fenwick_legal",
  "@standardsboard",
  "@causelist",
]);

/**
 * Cast members reached by their own handle.
 *
 * A cast member carries a handle in `PersonDef` — `p.raman`, `i.duarte`,
 * `h_sand` — and the phone addresses some messages to exactly that, with an
 * `@` in front. Indexing it means Dr Raman's message shows Dr Raman without
 * the message needing to carry a person id, which would be a save-shape
 * change for a presentation problem.
 *
 * Derived from `FULL_CAST` rather than listed, so it cannot drift. It is
 * consulted *after* `SOCIAL_PORTRAITS` and never for an organisation, so the
 * `@meridian` / `@northgate` collision is unreachable through this path — and
 * a test asserts that no cast handle equals an organisation handle, which is
 * what would break the guarantee if somebody renamed a character.
 */
const CAST_BY_HANDLE: Record<string, Portrait> = Object.fromEntries(
  FULL_CAST.flatMap((p) => {
    const art = CAST_PORTRAITS[p.id];
    return art ? [[`@${p.handle}`, art] as const] : [];
  }),
);

/* ----------------------------------------------------------------- lookup */

export const portraitForPerson = (personId: string): Portrait | null =>
  CAST_PORTRAITS[personId] ?? null;

export const hasPortraitForPerson = (personId: string): boolean =>
  personId in CAST_PORTRAITS;

/**
 * The portrait for a social account, or null.
 *
 * Null for organisations *and* for anyone unknown, which are different states
 * the caller distinguishes with `isOrganisation`. Never falls back to a person
 * id: that is the path that would put a face on a press release.
 */
export const portraitForSocialHandle = (handle: string): Portrait | null => {
  /* An institution short-circuits before any face can be found for it. */
  if (ORGANISATIONS.has(handle)) return null;
  return SOCIAL_PORTRAITS[handle] ?? CAST_BY_HANDLE[handle] ?? null;
};

/** Every handle a cast member answers to, for the harness. */
export const castHandles = (): string[] => Object.keys(CAST_BY_HANDLE);

export const isOrganisation = (handle: string): boolean =>
  ORGANISATIONS.has(handle);

/** Every portrait file the registry can serve, for the harness to verify. */
export const allPortraits = (): Portrait[] => [
  ...Object.values(CAST_PORTRAITS),
  ...Object.values(SOCIAL_PORTRAITS),
];
