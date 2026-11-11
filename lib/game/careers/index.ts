import type { CareerDef } from "../types";
import { doctor } from "./doctor";
import { chef } from "./chef";
import { lawyer } from "./lawyer";
import { founder } from "./founder";
import { politician } from "./politician";
import { architect } from "./architect";
import { engineer } from "./engineer";

/**
 * Careers are registered here. Adding one is a self-contained job: implement
 * CareerDef, register it, and the engine — week loop, events, ledger, saves,
 * setbacks — adapts with no changes anywhere else.
 *
 * -------------------------------------------------------- what they share
 *
 * Nothing except the shape. Each one is built around a different binding
 * constraint, which is the only thing that makes a second career worth
 * playing rather than a reskin of the first:
 *
 *   Physician   capability — you cannot treat what you have no department for
 *   Chef        spoilage   — stock decays, and is served oldest-first
 *   Solicitor   the pipeline — nothing pays until it settles, and it might not
 *   Founder     runway     — the whole career is priced in weeks, not money
 *   Politician  the cycle   — support decays always, and banks only on polling day
 *   Architect   the revision — paid in stages, and sent back to redraw them
 *   Engineer    hidden state — the fault count is never shown, only estimated
 *
 * A career whose constraint is really "have more money" does not belong here.
 * That test is what the previews below are held to.
 */
export const CAREERS: CareerDef[] = [
  doctor,
  chef,
  lawyer,
  founder,
  politician,
  architect,
  engineer,
];

export interface CareerPreview {
  id: string;
  label: string;
  icon: string;
  tagline: string;
  distinctRule: string;
  available: boolean;
  /** How hard the run is, in one word. */
  difficulty: "Demanding" | "Punishing" | "Volatile";
  /** What the career hands you on week one. */
  advantages: string[];
  /** The ways it ends badly. For a built career these are the real ones. */
  risks: string[];
}

/**
 * The advantages and risks on a *built* career's card are not flavour: each
 * line corresponds to something the career actually does. The Physician's
 * starting debt, three-claims limit and burnout ceiling are read straight off
 * `doctor.checkSetbacks` and `doctor.initialResources`; the Chef's spoilage
 * and the Solicitor's settlement risk likewise. Anything that stops being true
 * in the simulation must stop being claimed here.
 *
 * The unbuilt ones below are marked `available: false` and are **designs, not
 * implementations**. They are listed because a distinct binding constraint is
 * the hard part of specifying a career and writing it down is what makes the
 * next one cheap to build — the Chef and the Solicitor sat here in exactly
 * this form before they existed. Nothing reads them as mechanics.
 */
export const CAREER_PREVIEWS: CareerPreview[] = [
  {
    id: doctor.id,
    label: doctor.label,
    icon: doctor.icon,
    tagline: doctor.tagline,
    distinctRule: doctor.distinctRule,
    available: true,
    difficulty: "Demanding",
    advantages: [
      "A licence that already works where you trained",
      "Patients arrive whether or not you are ready for them",
      "Fourteen markets open to you once you can afford them",
    ],
    risks: [
      "$165,000 of student debt from week one",
      "Three claims lost and your licence is suspended",
      "Burnout reaching 100 signs you off, and getting back is slow",
    ],
  },
  {
    id: chef.id,
    label: chef.label,
    icon: chef.icon,
    tagline: chef.tagline,
    distinctRule: chef.distinctRule,
    available: true,
    difficulty: "Volatile",
    advantages: [
      "Takings clear the same night you serve",
      "A full room compounds — nothing fills a dining room like not getting in",
      "Your own cooking is the one input nobody can take off you",
    ],
    risks: [
      "Produce spoils on a clock and leaves as a write-off",
      "Stock is served oldest-first, so over-ordering shows up on the plate",
      "Rent and wages fall due whether or not you open",
    ],
  },
  {
    id: lawyer.id,
    label: lawyer.label,
    icon: lawyer.icon,
    tagline: lawyer.tagline,
    distinctRule: lawyer.distinctRule,
    available: true,
    difficulty: "Punishing",
    advantages: [
      "One won case can fund a year of the firm",
      "Every live case carries a settlement you can take instead",
      "Standing decides the size of the work you are offered",
    ],
    risks: [
      "Nothing pays until it settles, and the rent does not wait",
      "A case can be lost after months of work and bills nothing",
      "Miss a deadline and the hours already sunk are simply gone",
    ],
  },
  {
    id: founder.id,
    label: founder.label,
    icon: founder.icon,
    tagline: founder.tagline,
    distinctRule: founder.distinctRule,
    available: true,
    difficulty: "Punishing",
    advantages: [
      "Brand and word of mouth compound — nothing else in the game does",
      "You can trade ownership for weeks whenever you are willing to",
      "Reaching default alive stops the clock for good",
    ],
    risks: [
      "Runway is measured in weeks, and every hire shortens it",
      "Every raise takes a permanent share, and the terms are set by traction",
      "Customers leave every week whether or not you win any",
    ],
  },
  {
    id: politician.id,
    label: politician.label,
    icon: politician.icon,
    tagline: politician.tagline,
    distinctRule: politician.distinctRule,
    available: true,
    difficulty: "Volatile",
    advantages: [
      "Casework sticks — the one thing here that decays slowly",
      "Climbing the ladder buys longer terms to be unpopular in",
      "Winning banks the support permanently, and nothing else does",
    ],
    risks: [
      "Support drains toward your positions every single week",
      "A campaign peak a month early is worth almost nothing on the day",
      "Change a stated position and the whole electorate marks you down for it",
    ],
  },
  {
    id: architect.id,
    label: architect.label,
    icon: architect.icon,
    tagline: architect.tagline,
    distinctRule: architect.distinctRule,
    available: true,
    difficulty: "Punishing",
    advantages: [
      "Every stage you finish banks its fee for good",
      "Seeing the client is a real defence against being redrawn",
      "One landmark rewrites what you are allowed to be asked for",
    ],
    risks: [
      "A client who has not seen you can send the building back a stage",
      "The drawings for those stages are gone; the weeks must be spent again",
      "Competitions cost real months and usually pay nothing",
    ],
  },
  {
    id: engineer.id,
    label: engineer.label,
    icon: engineer.icon,
    tagline: engineer.tagline,
    distinctRule: engineer.distinctRule,
    available: true,
    difficulty: "Demanding",
    advantages: [
      "A certified product earns every week without being touched",
      "Testing both removes faults and tells you how many are left",
      "Pulling a product yourself costs far less than letting it fail",
    ],
    risks: [
      "You are never shown the fault count — only an estimate of it",
      "Designing is what creates the defects, so a better product is a worse liability",
      "Faults arrive weeks after you shipped, priced by how well it sold",
    ],
  },

];

/**
 * WHERE TO START, FOR SOMEBODY WHO HAS NEVER PLAYED THIS
 *
 * Seven cards, each with its own vocabulary and its own way of failing, is a
 * lot to meet at once. This is not a difficulty rating — it is the answer to
 * "which of these teaches me the game".
 *
 * The Chef, because its loop closes fastest. Takings clear the same night you
 * serve, so a decision on Monday is judged by Friday, and a player learns what
 * the week actually *is* before they have to hold a three-year commission or a
 * fault they cannot see in their head.
 */
export const SUGGESTED_FIRST = "chef";

export const suggestedReason =
  "Its week closes fastest — you serve on the night and find out the same night, so the loop teaches itself.";

export function getCareer(id: string): CareerDef | undefined {
  return CAREERS.find((c) => c.id === id);
}
