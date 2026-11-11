import type { PersonDef } from "../people";
import type { RivalDef } from "../rivals";

/**
 * THE PHYSICIAN'S COMPETITION
 *
 * Five careers running beside yours, each on a different theory of how you get
 * ahead in medicine. They are the argument the game is making: there is more
 * than one way to build this, and the one you did not pick is being tried by
 * somebody else in the next city.
 *
 * Two of them — Okoro and Sand — already exist as Phase 1 cast members, so
 * they gain a business here rather than a second identity. The other three are
 * new people who arrive as rivals from the start.
 */

export const PHYSICIAN_RIVALS: RivalDef[] = [
  {
    // The benchmark. Same exams, same year, three months ahead.
    id: "okoro",
    strategy: "climber",
    city: "lyon",
    start: { standing: 48, skill: 52, worth: 180_000, ambition: 74 },
  },
  {
    // Older, unhurried, and the best diagnostician in the region.
    id: "sand",
    strategy: "specialist",
    city: "berlin",
    start: { standing: 62, skill: 78, worth: 240_000, ambition: 32 },
  },
  {
    id: "meridian",
    strategy: "operator",
    city: "paris",
    start: { standing: 55, skill: 46, worth: 900_000, ambition: 82 },
  },
  {
    id: "voss",
    strategy: "celebrity",
    city: "london",
    start: { standing: 44, skill: 40, worth: 320_000, ambition: 88 },
  },
  {
    id: "northgate",
    strategy: "consolidator",
    city: "madrid",
    start: { standing: 51, skill: 44, worth: 1_400_000, ambition: 66 },
  },
];

/**
 * The three who are not already in the Phase 1 cast.
 *
 * Appended to the career's `cast`, so they get relationships, memory and a
 * People card exactly like everyone else — the rival half is an addition to a
 * person, never a substitute for one.
 */
export const RIVAL_PEOPLE: PersonDef[] = [
  {
    id: "meridian",
    name: "Dr Anneke Roth",
    title: "Clinical director, Meridian Health",
    role: "rival",
    traits: ["ambitious", "cynical"],
    handle: "a.roth",
    bio: "She runs eleven sites and can tell you the margin on each of them from memory. Believes, sincerely, that scale is how you help the most people, and has never let that belief cost her anything.",
    start: { warmth: 0, trust: 35, respect: 40 },
  },
  {
    id: "voss",
    name: "Dr Marcus Voss",
    title: "Broadcaster and physician",
    role: "rival",
    traits: ["ambitious", "proud"],
    handle: "m.voss",
    bio: "Two million people have heard his advice and about four hundred have been his patients. Genuinely charming, genuinely a doctor, and genuinely unbothered by which of those is doing the work.",
    start: { warmth: 10, trust: 25, respect: 15 },
  },
  {
    id: "northgate",
    name: "Dr Sofia Aranda",
    title: "Northgate Private",
    role: "rival",
    traits: ["cautious", "cynical"],
    handle: "s.aranda",
    bio: "Buys practices at the moment their founders run out of money, and is unsentimental about how that moment arrives. Fair prices. Very fast paperwork.",
    start: { warmth: -5, trust: 30, respect: 30 },
  },
];

export const RIVAL_BY_ID = new Map(PHYSICIAN_RIVALS.map((r) => [r.id, r]));
