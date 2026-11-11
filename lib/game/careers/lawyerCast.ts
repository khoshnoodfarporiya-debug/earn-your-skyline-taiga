import type { PersonDef } from "../people";
import { personIn } from "../people";
import type { RunState } from "../types";

/**
 * THE SOLICITOR'S CAST
 *
 * Six people who are in this career whether you like them or not.
 *
 * -------------------------------------------------------- the same six twice
 *
 * Three of them were already on the phone. Margaret Ellory sends the welcome,
 * Julian Farrow makes the offers, Derek Oyelaran arrives with the other side's
 * bill of costs — and until now they were handles on a feed with no memory of
 * anything. They are the same people here, keyed by the same handles, so the
 * handset and the relationships are one cast rather than two sets of names
 * that happen to overlap. Answering Farrow on the phone is answering the
 * person whose card you can open.
 *
 * The other three are people this career obviously has and the phone had no
 * reason to invent: the clerk you ring to instruct counsel, the case officer
 * who reads your file when something goes wrong, and the client who keeps
 * coming back.
 *
 * ---------------------------------------------------------- what they are for
 *
 * Each one changes a number, and each number is one this career already cares
 * about. That is the whole test: a person who only appears on a card is
 * decoration, and this codebase does not ship decoration.
 *
 *   Adaeze Okonjo   warm  → work comes to the door without being pitched for
 *   Ivy Nakamura    respect → counsel's clerk quotes you a better brief fee
 *   Derek Oyelaran  trust → he argues the other side's costs down for you
 *   Ada Whitcombe   trust → the regulator reads your file less readily
 *   Julian Farrow   respect → he opens higher when he offers to settle
 *   Margaret Ellory trust → an hour of her time is worth an hour of research
 *
 * They pull in different directions on purpose. Farrow respects you more the
 * more you settle; Margaret respects you more the more you win. You cannot
 * have all six at once and the run is more interesting for it.
 */

export const LAWYER_CAST: PersonDef[] = [
  {
    id: "ellory",
    name: "Margaret Ellory",
    title: "The solicitor who took you on",
    role: "mentor",
    traits: ["principled", "blunt"],
    handle: "m.ellory",
    bio: "Forty years of other people's worst weeks. She signed your training contract, taught you to write an attendance note as though a stranger would one day read it aloud in court, and has never once asked how the firm is doing without wanting the real answer.",
    start: { warmth: 35, trust: 60, respect: 20 },
  },
  {
    id: "farrow",
    name: "Julian Farrow",
    title: "Opposing counsel, more often than not",
    role: "rival",
    traits: ["proud", "cynical"],
    handle: "farrow_defence",
    bio: "You will meet him across a table for the rest of your career. Nothing he does is personal and all of it is effective, and he has never once been late with a letter.",
    start: { warmth: 5, trust: 40, respect: 30 },
  },
  {
    id: "oyelaran",
    name: "Derek Oyelaran",
    title: "Costs draftsman",
    role: "colleague",
    traits: ["cautious", "generous"],
    handle: "oyelaran_costs",
    bio: "He reads a bill of costs the way other people read a novel, and he has saved more small practices than anybody in this city knows. Pays for himself twice over on any week you lose one.",
    start: { warmth: 20, trust: 45, respect: 35 },
  },
  {
    id: "nakamura",
    name: "Ivy Nakamura",
    title: "Senior clerk, Ellesmere Chambers",
    role: "colleague",
    traits: ["blunt", "ambitious"],
    handle: "i.nakamura",
    bio: "She decides which of her barristers is available to you and what it costs, and both of those are opinions rather than facts. Firms she rates get the better silk at the worse rate.",
    start: { warmth: 15, trust: 40, respect: 25 },
    /* A one-room practice has never briefed counsel and has no reason to know
       a clerk of chambers. She arrives when the work does. */
    appears: (s) => s.week >= 6,
  },
  {
    id: "whitcombe",
    name: "Ada Whitcombe",
    title: "Case officer, the Standards Board",
    role: "manager",
    traits: ["principled", "cautious"],
    handle: "a.whitcombe",
    bio: "Not an enemy and not a friend — a person whose job is reading files that somebody has complained about. She is unfailingly polite and she writes everything down.",
    start: { warmth: 0, trust: 55, respect: 20 },
    appears: (s) => s.week >= 10,
  },
  {
    id: "okonjo",
    name: "Adaeze Okonjo",
    title: "Okonjo Holdings — a client who came back",
    role: "friend",
    traits: ["loyal", "ambitious"],
    handle: "a.okonjo",
    bio: "You wound up her father's estate and she has sent you three things since. She talks about you to people who own buildings, which is worth more than any advertisement this trade allows.",
    start: { warmth: 30, trust: 50, respect: 30 },
    appears: (s) => s.week >= 4,
  },
];

export const LAWYER_CAST_BY_ID = new Map(LAWYER_CAST.map((p) => [p.id, p]));

/* ------------------------------------------------------- what they are worth
 *
 * Every one of these is bounded and mild. The point is that knowing somebody
 * is worth something, not that the relationship layer is the real game — a
 * practice with all six on side is meaningfully easier to run and is not
 * playing a different career.
 */

/** Standing on a 0..1 scale, or 0 for somebody who is not in your life yet. */
const level = (s: RunState, id: string, key: "warmth" | "trust" | "respect"): number => {
  const p = personIn(s, id);
  if (!p || p.status === "gone") return 0;
  const raw = key === "warmth" ? (p.warmth + 100) / 200 : p[key] / 100;
  /* Below the halfway mark is not a penalty, it is simply no help: a career
     should never be harder for having met somebody. */
  return Math.max(0, Math.min(1, (raw - 0.5) * 2));
};

/**
 * Extra standing when the market decides what to send you.
 *
 * A client who talks about you is worth more than anything this trade lets
 * you advertise, and it is added to reputation at the gate rather than to
 * reputation itself — you have not become better regarded, you have been
 * recommended.
 */
export const referralPull = (s: RunState): number =>
  Math.round(level(s, "okonjo", "warmth") * 12);

/** What a clerk who rates you knocks off a brief fee. */
export const briefDiscount = (s: RunState): number =>
  1 - level(s, "nakamura", "respect") * 0.22;

/** How much of the other side's costs Derek argues away. */
export const costsRelief = (s: RunState): number =>
  1 - level(s, "oyelaran", "trust") * 0.25;

/** How readily the regulator reaches for a file with your name on it. */
export const conductGrace = (s: RunState): number =>
  1 - level(s, "whitcombe", "trust") * 0.4;

/** What Farrow adds to an offer he did not have to make. */
export const offerGoodwill = (s: RunState): number =>
  level(s, "farrow", "respect") * 0.14;

/** What an hour with Margaret adds to an hour of your own reading. */
export const mentorBonus = (s: RunState): number =>
  level(s, "ellory", "trust") * 0.9;
