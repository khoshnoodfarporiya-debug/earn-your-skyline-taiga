/**
 * THE WORDS
 *
 * A medical practice sim that refuses to say "panel" or "triage" has thrown
 * away the thing that makes it feel like a profession rather than a spreadsheet
 * with a stethoscope on the box. But a player who does not know what a panel is
 * cannot read the number next to it, and will guess.
 *
 * So: **plain language leads, the professional term follows.** The interface
 * says "active patients", then "(your panel)", and the glossary carries the
 * full explanation for anyone who wants it. Nothing is removed; everything is
 * explained.
 *
 * ------------------------------------------------------------- three fields
 *
 *   term    the professional word, as the profession uses it
 *   plain   what to call it in a label, when a label is all there is room for
 *   detail  what it actually means here, including the mechanism
 *
 * `detail` describes *this simulation*, not medicine in general. "Catchment"
 * has a real-world meaning; what a player needs is the sentence that tells them
 * it is the ceiling their patient list drifts toward.
 */

import { CHEF_TERMS } from "./chefHelp";
import { LEGAL_TERMS } from "./lawyerHelp";
import { STARTUP_TERMS } from "./founderHelp";
import { CAMPAIGN_TERMS } from "./politicianHelp";
import { STUDIO_TERMS } from "./architectHelp";
import { WORKSHOP_TERMS } from "./engineerHelp";

export interface Term {
  id: string;
  term: string;
  /** The label to use where there is no room to explain. */
  plain: string;
  detail: string;
}

export const GLOSSARY: Term[] = [
  {
    id: "panel",
    term: "Panel",
    plain: "Active patients",
    detail:
      "Everyone registered with your practice. About 28% of them present in any given week, and a better-regarded practice sees a larger share of its own list.",
  },
  {
    id: "caseload",
    term: "Caseload",
    plain: "Last week's patients",
    detail:
      "The patients who actually arrived in a week, broken down by what was wrong with them. Distinct from the panel, which is everyone on your books.",
  },
  {
    id: "triage",
    term: "Triage",
    plain: "Who gets seen first",
    detail:
      "The rule that decides the order of the queue when more arrives than you can treat. It does not turn anyone away by itself — it decides who is still waiting when the week runs out.",
  },
  {
    id: "cpd",
    term: "CPD",
    plain: "Professional learning points",
    detail:
      "Continuing Professional Development. Earned by studying, spent on qualifications. It is the gate that time rather than money controls — you cannot buy your way past it.",
  },
  {
    id: "catchment",
    term: "Catchment",
    plain: "How many patients you could attract",
    detail:
      "The ceiling your patient list drifts toward in a city. Set by how much room you have there, how well regarded you are, how hard you are marketing, and how much of the market rivals already hold.",
  },
  {
    id: "capacity",
    term: "Clinical capacity",
    plain: "What you can get through",
    detail:
      "Measured in units. A minor case costs about one, major surgery about twelve. Capacity is the smaller of the room in your buildings and the hours your people have, then scaled by supplies and workplace culture.",
  },
  {
    id: "fixed",
    term: "Fixed cost",
    plain: "Charged whatever happens",
    detail:
      "Payroll, premises upkeep and interest. Charged in full in a week where nobody arrives, which is what makes an estate bought ahead of the caseload dangerous.",
  },
  {
    id: "variable",
    term: "Variable cost",
    plain: "Tracks how busy you are",
    detail:
      "Consumables, campaigns and how you live. These fall when the work does, which is why they are survivable in a bad month and fixed costs are not.",
  },
  {
    id: "market-access",
    term: "Market access",
    plain: "Where you are allowed to operate",
    detail:
      "A licence permits you to build in a city. It produces no patients on its own — premises have to stand there before anybody arrives.",
  },
  {
    id: "captured-share",
    term: "Captured share",
    plain: "How much of the market is yours",
    detail:
      "The proportion of a city's patients you hold against the incumbents. Rivals hold the rest, and they defend it — a rich market with entrenched competition can be worth less than a poor one without.",
  },
  {
    id: "scrutiny",
    term: "Scrutiny",
    plain: "How closely you are watched",
    detail:
      "Attention from the press and the regulator, raised by publicity and by things going wrong. It makes malpractice claims more likely and makes a bad week louder.",
  },
  {
    id: "ethics",
    term: "Ethical exposure",
    plain: "Whether you are believed to be honest",
    detail:
      "Multiplies every other kind of standing rather than sitting beside them. Being thought dishonest devalues your credibility, your popularity and your influence at once.",
  },
  {
    id: "culture",
    term: "Workplace culture",
    plain: "What this place is like to work in",
    detail:
      "A number between 0 and 100 built from pay, workload and morale. It multiplies everything your staff get through, between ×0.86 and ×1.14, and below 25 people start resigning.",
  },
  {
    id: "referral",
    term: "Referral",
    plain: "Sent elsewhere",
    detail:
      "A patient you could not treat, passed to somebody who can. Not a failure state — it is work walking out of the door, and a small knock to patient trust each time.",
  },
  {
    id: "outbreak-pressure",
    term: "Outbreak pressure",
    plain: "Chance of something spreading",
    detail:
      "The weekly probability that an outbreak begins somewhere in your network. It rises with the years and with how many cities you hold, which is a real cost of expanding.",
  },
];

export const TERM_BY_ID = new Map(GLOSSARY.map((t) => [t.id, t]));

/**
 * The vocabulary for the career being played.
 *
 * `GLOSSARY` above is the Physician's — panels, triage, CPD — and showing it
 * to a Chef was the same leak the screens themselves had. Each career carries
 * its own words in its own help module; a career with none gets an empty list
 * and the control that opens this simply does not render.
 */
export function glossaryFor(careerId: string): Term[] {
  if (careerId === "doctor") return GLOSSARY;
  if (careerId === "chef") return CHEF_TERMS;
  if (careerId === "lawyer") return LEGAL_TERMS;
  if (careerId === "founder") return STARTUP_TERMS;
  if (careerId === "politician") return CAMPAIGN_TERMS;
  if (careerId === "architect") return STUDIO_TERMS;
  if (careerId === "engineer") return WORKSHOP_TERMS;
  return [];
}

/** The glossary in the order a player meets these words, not alphabetical. */
export const GLOSSARY_ORDER = GLOSSARY.map((t) => t.id);
