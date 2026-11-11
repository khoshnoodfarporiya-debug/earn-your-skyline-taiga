import type { PersonDef } from "../people";
import type { RunState } from "../types";

/**
 * THE PHYSICIAN'S CAST
 *
 * Ten people who are in this career whether you like them or not.
 *
 * Deliberately small. A hundred generated names would be a contact list; ten
 * written ones can each hold a position, remember what you did, and be the
 * reason an event goes the way it does. The test of a person here is whether
 * the player can predict their reaction once they know them — which is why
 * every one of them wants something specific and disagrees with at least one
 * of the others.
 *
 * The five who matter most are present from week one, because a mentor you
 * meet in week 60 cannot have been your mentor. The rest appear when the run
 * produces a reason for them: an investor does not call a one-room practice.
 */

import { med } from "../careers/doctor";
import { RIVAL_PEOPLE } from "./rivalCast";

export const PHYSICIAN_CAST: PersonDef[] = [
  {
    id: "hallam",
    name: "Prof. Iris Hallam",
    title: "Your supervising consultant",
    role: "mentor",
    traits: ["principled", "blunt"],
    handle: "i.hallam",
    bio: "She signed off your training and has never once told you something comfortable. Thirty years of general medicine and a standing refusal to publish anything she has not personally checked twice.",
    start: { warmth: 30, trust: 60, respect: 25 },
  },
  {
    id: "okoro",
    name: "Dr Femi Okoro",
    title: "Fellow graduate, now at Meridian",
    role: "rival",
    traits: ["ambitious", "proud"],
    handle: "f.okoro",
    bio: "You sat the same exams. He took the group-practice offer you turned down and has been three months ahead of you ever since. Not an enemy — worse, a benchmark.",
    start: { warmth: 10, trust: 45, respect: 45 },
  },
  {
    id: "lindqvist",
    name: "Elena Lindqvist",
    title: "Practice manager",
    role: "manager",
    traits: ["loyal", "cautious"],
    handle: "e.lindqvist",
    bio: "She ran a forty-person department before she ran yours, and took the smaller job on purpose. She will tell you when the rota is unsafe exactly once, and then write it down.",
    start: { warmth: 45, trust: 65, respect: 35 },
  },
  {
    id: "raman",
    name: "Priya Raman",
    title: "Health correspondent",
    role: "journalist",
    traits: ["cynical", "blunt"],
    handle: "p.raman",
    bio: "She covers private medicine and does not think much of it. Fair, in the way that a fair person who expects the worst is fair.",
    start: { warmth: 0, trust: 35, respect: 20 },
  },
  {
    id: "duarte",
    name: "Ines Duarte",
    title: "Medical recruiter",
    role: "colleague",
    traits: ["generous", "ambitious"],
    handle: "i.duarte",
    bio: "She places consultants, and she is honest about the fact that she is paid to. If she likes you, good people hear about you before they hear about the job.",
    start: { warmth: 20, trust: 45, respect: 30 },
  },
  {
    id: "sand",
    name: "Dr Henrik Sand",
    title: "Consultant, Northgate Private",
    role: "colleague",
    traits: ["cautious", "principled"],
    handle: "h_sand",
    bio: "Older, unhurried, and quietly the best diagnostician in the region. He refers work to people he trusts and to nobody else.",
    start: { warmth: 5, trust: 50, respect: 40 },
    appears: (s) => s.week >= 6,
  },
  {
    id: "mbeki",
    name: "Nomsa Mbeki",
    title: "Senior nurse",
    role: "employee",
    traits: ["loyal", "blunt"],
    handle: "n.mbeki",
    bio: "Twenty years on wards, and the person your patients actually talk to. She has walked out of two practices over staffing and does not consider it a dramatic act.",
    start: { warmth: 35, trust: 55, respect: 30 },
    appears: (s) => med(s).staff.length > 0,
  },
  {
    id: "vasquez",
    name: "Dr Camila Vásquez",
    title: "Epidemiologist, regional health board",
    role: "colleague",
    traits: ["principled", "ambitious"],
    handle: "c.vasquez",
    bio: "She runs the outbreak response for the region and is chronically under-resourced. She notices which private practices help and which ones close their doors.",
    start: { warmth: 0, trust: 40, respect: 25 },
    appears: (s) => med(s).outbreaks.length > 0 || med(s).solved.length > 0,
  },
  {
    id: "thorne",
    name: "Julian Thorne",
    title: "Healthcare investor",
    role: "investor",
    traits: ["cynical", "ambitious"],
    handle: "j.thorne",
    bio: "He buys practices, improves their margins and sells them. He is not pretending otherwise, which is the most honest thing about him.",
    start: { warmth: 0, trust: 30, respect: 20 },
    appears: (s) => med(s).cities.length >= 2,
  },
  {
    id: "adeyemi",
    name: "Dr Tolu Adeyemi",
    title: "Clinical partner",
    role: "partner",
    traits: ["generous", "cautious"],
    handle: "t.adeyemi",
    bio: "Trained in two systems and has opinions about both. Interested in the kind of practice yours could become, and unwilling to join one that treats people badly.",
    start: { warmth: 15, trust: 45, respect: 35 },
    appears: (s) => med(s).departments.length >= 3,
  },
];

/*
 * The rivals are people too.
 *
 * `PHYSICIAN_RIVALS` gives Anneke Roth, Marcus Voss and Sofia Aranda a
 * business; without appending them here they would have had one and no
 * identity — `CAST_BY_ID.get(id)` would return undefined, and the rivals panel
 * would render five careers with three blank cards among them. Caught by the
 * assertion that every rival id resolves to a person.
 */
export const FULL_CAST: PersonDef[] = [...PHYSICIAN_CAST, ...RIVAL_PEOPLE];

export const CAST_BY_ID = new Map(FULL_CAST.map((p) => [p.id, p]));

export const personDef = (id: string) => CAST_BY_ID.get(id);

/**
 * Anyone whose entry condition has come true but who is not in the run yet.
 *
 * Called each week rather than at load, so a cast member added in a later
 * build joins an in-progress save at their starting standing instead of never
 * appearing — the same reason `migrateRun` re-runs this.
 */
export function newArrivals(s: RunState): PersonDef[] {
  const present = new Set((s.people ?? []).map((p) => p.id));
  return FULL_CAST.filter(
    (def) => !present.has(def.id) && (!def.appears || def.appears(s)),
  );
}
