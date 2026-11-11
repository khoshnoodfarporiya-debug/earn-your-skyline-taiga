import type { PersonDef } from "../game/people";
import { CAST_BY_ID, FULL_CAST } from "../game/medical/cast";
import { LAWYER_CAST, LAWYER_CAST_BY_ID } from "../game/careers/lawyerCast";

/**
 * ONE DOOR TO EVERY CAREER'S CAST
 *
 * `PeoplePanel` imported the Physician's `CAST_BY_ID` directly, which is what
 * made the People screen a Physician feature: the machinery in `people.ts` was
 * always career-neutral and the *lookup* was not. This is the career-aware
 * door, on the same pattern as `phoneAccess.ts`.
 *
 * A career with no cast returns nothing and the surfaces that show people
 * simply have nothing to show — absence, not breakage.
 */
export function castFor(careerId: string): PersonDef[] {
  if (careerId === "doctor") return FULL_CAST;
  if (careerId === "lawyer") return LAWYER_CAST;
  return [];
}

/** The authored detail behind a persisted person, for whoever is playing. */
export function personDefIn(
  careerId: string,
  id: string,
): PersonDef | undefined {
  if (careerId === "lawyer") return LAWYER_CAST_BY_ID.get(id);
  /*
   * The Physician's is the fallback rather than a branch, because a save can
   * legitimately carry a person from a career the current run is not — an
   * archived character, a rival seeded before the cast was career-aware — and
   * a missing definition renders a blank card rather than throwing.
   */
  return CAST_BY_ID.get(id);
}
