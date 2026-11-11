import type { StartCity } from "../types";
import type { PhoneState } from "../medical/types";
import type { RunState } from "../types";

/**
 * THE SEAT
 *
 * Everything the Politician is made of. No React, no engine.
 *
 * ------------------------------------------------------- the binding constraint
 *
 * The electoral cycle. Support decays continuously and is banked only on
 * polling day.
 *
 * Every other career in this game accumulates. Cash stays in the account, a
 * reputation stays earned, a product stays built. Support does not: it drains
 * every single week toward wherever your *positions* have left you, and the
 * only moment it is ever converted into anything permanent is the one
 * afternoon every few years when the votes are counted.
 *
 * That produces the two decisions the career is about:
 *
 *   1. WHERE YOU SETTLE versus WHERE YOU ARE. Positions are structural: they
 *      set the level support decays *toward*, per bloc, for the rest of the
 *      run. Campaigning is temporary: it lifts you above that level and leaks
 *      away at 12% a week. A candidate who campaigns constantly and stands
 *      for nothing sinks back every time they stop.
 *
 *   2. TIMING. Because the lift decays, the whole game is spending your
 *      weeks so the peak lands on polling day rather than a month before it.
 *      Peaking early is the classic way to lose, and it is available here.
 *
 * Positions are the part that lasts. You can reverse one, and the electorate
 * remembers that you did — which is the mechanical form of "one position
 * taken badly follows you for the rest of the run".
 */

/* ------------------------------------------------------------- the electorate */

export interface Bloc {
  id: string;
  label: string;
  blurb: string;
  /** Share of the electorate, 0-1. The four sum to 1. */
  share: number;
  /** How reliably they actually turn out. Decides how much they are worth. */
  turnout: number;
}

/**
 * Four blocs, because a seat you cannot split is not a seat you can lose.
 *
 * Turnout is the quiet lesson: the retired vote is a fifth of the electorate
 * and nearly a quarter of the votes cast, which is why every position that
 * annoys them is more expensive than it looks.
 */
export const BLOCS: Bloc[] = [
  {
    id: "workers",
    label: "Working families",
    blurb: "Wages, buses, the hospital waiting list. Hard to reach, slow to forgive.",
    share: 0.34,
    turnout: 0.54,
  },
  {
    id: "business",
    label: "Business and trade",
    blurb: "Rates, planning, and whether you sound like you have run anything.",
    share: 0.18,
    turnout: 0.76,
  },
  {
    id: "green",
    label: "Students and greens",
    blurb: "Loud, organised, and quick to leave you over a single vote.",
    share: 0.2,
    turnout: 0.62,
  },
  {
    id: "older",
    label: "Retired voters",
    blurb: "The bloc that always votes. Nothing else here comes close.",
    share: 0.28,
    turnout: 0.85,
  },
];

export const BLOC_BY_ID = new Map(BLOCS.map((b) => [b.id, b]));

/** What a bloc is worth in votes cast, rather than in people. */
export const blocWeight = (b: Bloc): number => b.share * b.turnout;

/* --------------------------------------------------------------- the seats */

export interface Seat extends StartCity {
  /** Where each bloc starts you, before any position is taken. */
  opening: Record<string, number>;
  /** Share of the vote needed to hold it. */
  threshold: number;
  /** Weekly pay of the seat's first office, before the ladder. */
  allowance: number;
  /** How fast a lift leaks away here. Cities with a press pack forget faster. */
  drift: number;
}

export const SEATS: Seat[] = [
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    position: "london",
    blurb:
      "A safe-ish seat with a party that has already decided what it thinks of you.",
    effects: [
      "A generous allowance and a national press pack",
      "Support leaks fastest here — the news moves on",
      "Students and greens start with you",
    ],
    difficulty: "even",
    opening: { workers: 44, business: 34, green: 52, older: 40 },
    threshold: 0.42,
    allowance: 1_450,
    drift: 0.15,
  },
  {
    id: "lyon",
    name: "Lyon",
    country: "France",
    position: "lyon",
    blurb: "A city that takes its politics personally and its dinners seriously.",
    effects: [
      "The most evenly split electorate on the board",
      "Support holds a little longer between visits",
      "Nobody starts as your friend",
    ],
    difficulty: "even",
    opening: { workers: 42, business: 42, green: 42, older: 42 },
    threshold: 0.42,
    allowance: 1_250,
    drift: 0.12,
  },
  {
    id: "milan",
    name: "Milan",
    country: "Italy",
    position: "milan",
    blurb: "Money, manufacturing, and an electorate that has heard it all before.",
    effects: [
      "Business is with you before you say anything",
      "Working families take real work to win",
      "A lower bar to hold the seat",
    ],
    difficulty: "gentle",
    opening: { workers: 33, business: 58, green: 36, older: 46 },
    threshold: 0.39,
    allowance: 1_150,
    drift: 0.11,
  },
  {
    id: "lagos",
    name: "Lagos",
    country: "Nigeria",
    position: "lagos",
    blurb:
      "An enormous, young, sceptical electorate and an allowance that will not cover the campaign.",
    effects: [
      "The largest bloc of working families anywhere",
      "The retired vote is smaller, and everything else is louder",
      "The lowest allowance — you fund the work yourself",
    ],
    difficulty: "hard",
    opening: { workers: 48, business: 30, green: 44, older: 34 },
    threshold: 0.45,
    allowance: 720,
    drift: 0.13,
  },
];

export const SEAT_BY_ID = new Map(SEATS.map((s) => [s.id, s]));

export const seatOf = (c: CampaignState): Seat =>
  SEAT_BY_ID.get(c.seat) ?? SEATS[0];

/* ------------------------------------------------------------- the offices */

export interface Office {
  id: string;
  label: string;
  blurb: string;
  /** Weeks between elections at this level. */
  term: number;
  /** Multiplies the seat's allowance. */
  pay: number;
  /** Standing with the party needed before they will select you. */
  needsParty: number;
  /** How much harder the seat is to hold at this level. */
  opposition: number;
}

/**
 * The ladder. Every rung is a longer term, more money, and a harder seat.
 *
 * The term length is the interesting number: a councillor is judged every two
 * years and a leader every five, so climbing buys you time to be unpopular in
 * — which is the only thing in this career that resembles a safety net.
 */
export const OFFICES: Office[] = [
  {
    id: "candidate",
    label: "Candidate",
    blurb: "Nobody has voted for you yet. The allowance is nothing.",
    term: 52,
    pay: 0,
    needsParty: 0,
    opposition: 0,
  },
  {
    id: "councillor",
    label: "Councillor",
    blurb: "Potholes, planning, and the surgery every Saturday morning.",
    term: 104,
    pay: 1,
    needsParty: 25,
    opposition: 0,
  },
  {
    id: "member",
    label: "Member of parliament",
    blurb: "A national platform and a majority you can count on a bad day.",
    term: 156,
    pay: 2.6,
    needsParty: 50,
    opposition: 0.03,
  },
  {
    id: "minister",
    label: "Minister",
    blurb:
      "A department, a red box, and every one of its failures with your name on it.",
    term: 156,
    pay: 4.2,
    needsParty: 72,
    opposition: 0.06,
  },
];

export const OFFICE_BY_ID = new Map(OFFICES.map((o) => [o.id, o]));

export const officeOf = (c: CampaignState): Office =>
  OFFICE_BY_ID.get(c.office) ?? OFFICES[0];

export const nextOffice = (c: CampaignState): Office | undefined => {
  const i = OFFICES.findIndex((o) => o.id === c.office);
  return OFFICES[i + 1];
};

/* ------------------------------------------------------------- the positions */

export interface Stance {
  id: string;
  label: string;
  blurb: string;
  /** Points added to each bloc's lean. Negative is a cost. */
  effects: Record<string, number>;
}

export interface Issue {
  id: string;
  label: string;
  question: string;
  stances: Stance[];
}

/**
 * The five questions you will be asked, and the fact that every answer costs
 * somebody.
 *
 * There is deliberately no stance anywhere in this table whose effects are all
 * positive. A position that pleases everyone is not a position, and a career
 * built out of them would have no decisions in it.
 */
export const ISSUES: Issue[] = [
  {
    id: "housing",
    label: "Housing",
    question: "Do you build on the green belt?",
    stances: [
      {
        id: "build",
        label: "Build the houses",
        blurb: "Thousands of homes, and a field that people walked their dogs in.",
        effects: { workers: 12, business: 9, green: -14, older: -8 },
      },
      {
        id: "protect",
        label: "Protect the green belt",
        blurb: "The field stays. So does the waiting list.",
        effects: { workers: -9, business: -6, green: 14, older: 9 },
      },
    ],
  },
  {
    id: "transport",
    label: "Transport",
    question: "Who pays for the buses?",
    stances: [
      {
        id: "subsidise",
        label: "Subsidise the fares",
        blurb: "Cheaper buses, paid for out of the rates.",
        effects: { workers: 13, business: -11, green: 8, older: 5 },
      },
      {
        id: "roads",
        label: "Spend it on the roads",
        blurb: "Resurfacing, parking, and a bus service that stays as it is.",
        effects: { workers: -6, business: 12, green: -12, older: 8 },
      },
    ],
  },
  {
    id: "tax",
    label: "Business rates",
    question: "Do you cut the rates?",
    stances: [
      {
        id: "cut",
        label: "Cut them",
        blurb: "The high street gets a year of breathing room. Something else closes.",
        effects: { workers: -8, business: 16, green: -4, older: -3 },
      },
      {
        id: "hold",
        label: "Hold them and fund services",
        blurb: "The library stays open and every shopkeeper knows why.",
        effects: { workers: 10, business: -13, green: 6, older: 7 },
      },
    ],
  },
  {
    id: "care",
    label: "Social care",
    question: "Who looks after the oldest people here?",
    stances: [
      {
        id: "fund",
        label: "Fund it properly",
        blurb: "It costs what it costs, and it comes from everybody.",
        effects: { workers: 5, business: -10, green: 3, older: 17 },
      },
      {
        id: "family",
        label: "Leave it to families",
        blurb: "Cheaper, and somebody's daughter gives up her job.",
        effects: { workers: -11, business: 9, green: -5, older: -9 },
      },
    ],
  },
  {
    id: "climate",
    label: "The plant",
    question: "The refinery employs two thousand people and is filthy.",
    stances: [
      {
        id: "close",
        label: "Close it",
        blurb: "Clean air, and two thousand people who voted for you last time.",
        effects: { workers: -16, business: -9, green: 20, older: 2 },
      },
      {
        id: "keep",
        label: "Keep it open",
        blurb: "The jobs stay. So does the smell, and the asthma ward.",
        effects: { workers: 14, business: 11, green: -19, older: -4 },
      },
    ],
  },
];

export const ISSUE_BY_ID = new Map(ISSUES.map((i) => [i.id, i]));

export const stanceOf = (
  issue: Issue,
  stanceId: string,
): Stance | undefined => issue.stances.find((s) => s.id === stanceId);

/* --------------------------------------------------------------- the state */

export interface ElectionResult {
  week: number;
  office: string;
  share: number;
  threshold: number;
  won: boolean;
}

export interface CampaignState {
  /**
   * The handset. Optional so a save from before this career had one
   * still loads; it is created on first touch.
   */
  phone?: PhoneState;
  seat: string;
  office: string;
  /** Where you are with each bloc, right now. Decays toward `lean`. */
  support: Record<string, number>;
  /** Positions taken, issue id → stance id. */
  positions: Record<string, string>;
  /** Issues you have publicly changed your mind on. The electorate remembers. */
  reversals: string[];
  /** Standing inside the party, which decides selection rather than votes. */
  party: number;
  /** The week the votes are counted. */
  electionWeek: number;
  results: ElectionResult[];
  /** Set the week an election is lost, so the UI can say what happened. */
  outOfOffice?: boolean;
  /*
   * PHASE 5, ALL OPTIONAL: a save written before the ground game still
   * loads, and absence means "never engaged", which changes nothing.
   */
  /** Named constituents whose cases are open on your desk. */
  constituents?: ConstituentCase[];
  /** Cases delivered, per bloc — the permanent half of support. */
  record?: Record<string, number>;
  /** People who knock doors for you. They drift away if not organised. */
  volunteers?: number;
  /** The campaign fund. Donations in, campaigning out — never the rent. */
  warchest?: number;
  /** The week until which the last focus group still reads the room. */
  focusUntil?: number;
}

/**
 * A named person with a problem only their representative can chase.
 *
 * The counterweight to the drift: campaigning is a loan against where your
 * positions have left you, but a case *delivered* is remembered — it moves
 * the lean itself, permanently, one small piece at a time. Ignoring a case
 * costs nothing except the chance; nobody punishes an office for a letter
 * it never answered, they simply stop being moved by you.
 */
export interface ConstituentCase {
  id: string;
  /** Who is asking. A name, because "the electorate" never wrote to anyone. */
  name: string;
  bloc: string;
  /** What they need, in their words. */
  matter: string;
  arrived: number;
  /** The week the case stops being winnable. */
  deadline: number;
}

export const constituentsOf = (c: CampaignState): ConstituentCase[] =>
  c.constituents ?? [];
export const recordOf = (c: CampaignState): Record<string, number> =>
  c.record ?? {};
export const volunteersOf = (c: CampaignState): number => c.volunteers ?? 0;
export const warchestOf = (c: CampaignState): number => c.warchest ?? 0;

/** How much a bloc's lean can ever owe to delivered casework. */
export const RECORD_CAP = 12;

/** How many cases fit on one member's desk. The rest are referred on. */
export const CASE_DESK = 6;

/** What campaigning gains when there are volunteers carrying boards too.
    Zero volunteers multiplies by exactly one. */
export const volunteerLift = (c: CampaignState): number =>
  1 + Math.min(60, volunteersOf(c)) * 0.006;

/** The turnout operation on the day: knocked doors become cast votes.
    Two points of share at a hundred volunteers, and none at none. */
export const gotvBonus = (c: CampaignState): number =>
  Math.min(0.02, volunteersOf(c) * 0.0002);

/**
 * THE COUNT IS A BAND, NOT A NUMBER
 *
 * Nobody knows the share to a decimal — least of all this far out. The
 * margin tightens as polling day approaches, and a recent focus group
 * tightens it further. Display honesty only: the simulation always knows
 * the true figure, the *player* is told what a campaign would actually
 * know.
 */
export const pollBandOf = (c: CampaignState, week: number): number => {
  const out = 2 + Math.min(4, weeksToPoll(c, week) * 0.15);
  const focused = (c.focusUntil ?? -1) >= week ? 1.5 : 0;
  return Math.max(1, out - focused);
};

/** What a focus group costs, from the war chest and nowhere else. */
export const FOCUS_GROUP_COST = 900;

/* ----------------------------------------------- the postbag's contents */

const CASE_NAMES = [
  "Mrs. Adeyemi",
  "Mr. Kowalski",
  "Miss Haddad",
  "Mr. Ferreira",
  "Mrs. Lindqvist",
  "Mr. O'Donnell",
  "Mrs. Bakshi",
  "Mr. Yeboah",
  "Miss Novak",
  "Mrs. Petit",
  "Mr. Aliyev",
  "Miss Okafor",
] as const;

const CASE_MATTERS: Record<string, string[]> = {
  retired: [
    "a pension payment that stopped without a letter",
    "a hospital transport route that was quietly cut",
  ],
  families: [
    "a school place given and then withdrawn",
    "a housing repair open since last winter",
  ],
  workers: [
    "wages unpaid since the depot changed hands",
    "a bus route that no longer meets the early shift",
  ],
  business: [
    "a licence renewal lost somewhere in the post",
    "roadworks with no end date outside the shop",
  ],
  professional: [
    "a visa sponsorship stuck in review",
    "a planning objection nobody acknowledged",
  ],
  students: [
    "a landlord holding a deposit hostage",
    "a support grant suspended over a form",
  ],
};

/** Deterministic case for a derived stream — the caller owns the rng. */
export function drawCase(
  c: CampaignState,
  week: number,
  n: number,
  rng: { next(): number },
): ConstituentCase {
  const bloc = BLOCS[Math.floor(rng.next() * BLOCS.length)].id;
  const matters = CASE_MATTERS[bloc] ?? ["a matter for the office"];
  return {
    id: `case-${week}-${n}`,
    name: CASE_NAMES[Math.floor(rng.next() * CASE_NAMES.length)],
    bloc,
    matter: matters[Math.floor(rng.next() * matters.length)],
    arrived: week,
    deadline: week + 5,
  };
}

export function initialCampaign(): CampaignState {
  const seat = SEATS[0];
  return {
    seat: seat.id,
    office: "candidate",
    support: { ...seat.opening },
    positions: {},
    reversals: [],
    party: 12,
    electionWeek: 40,
    results: [],
  };
}

/* -------------------------------------------------------------- the numbers */

/**
 * Where each bloc settles, given the positions you have taken.
 *
 * This is the structural half of the career. The seat's opening figures are
 * the starting point, every stance shifts them permanently, and each public
 * reversal takes a flat toll across the whole electorate — nobody likes being
 * told the last thing was wrong, including the people who agreed with it.
 */
export function leanOf(c: CampaignState): Record<string, number> {
  const out: Record<string, number> = { ...seatOf(c).opening };
  for (const [issueId, stanceId] of Object.entries(c.positions)) {
    const issue = ISSUE_BY_ID.get(issueId);
    const stance = issue && stanceOf(issue, stanceId);
    if (!stance) continue;
    for (const [bloc, delta] of Object.entries(stance.effects)) {
      out[bloc] = (out[bloc] ?? 0) + delta;
    }
  }
  /* Casework delivered is the one thing that moves the lean itself:
     capped, earned one case at a time, and absent for anybody who never
     opened the postbag. */
  const record = recordOf(c);
  for (const b of BLOCS) {
    out[b.id] = (out[b.id] ?? 0) + Math.min(RECORD_CAP, record[b.id] ?? 0);
  }
  /* Being seen to change your mind is its own position, and a bad one. */
  const cost = c.reversals.length * 6;
  for (const b of BLOCS) {
    out[b.id] = Math.max(0, Math.min(100, (out[b.id] ?? 0) - cost));
  }
  return out;
}

/**
 * The share of the vote you would take if polling day were today.
 *
 * Weighted by turnout rather than by headcount, which is the whole reason the
 * retired bloc dominates and the student bloc disappoints.
 */
export function projectedShare(c: CampaignState): number {
  let cast = 0;
  let mine = 0;
  for (const b of BLOCS) {
    const w = blocWeight(b);
    cast += w;
    mine += w * ((c.support[b.id] ?? 0) / 100);
  }
  return cast > 0 ? mine / cast : 0;
}

/** What you have to beat, including the opposition this office attracts. */
export const thresholdFor = (c: CampaignState): number =>
  seatOf(c).threshold + officeOf(c).opposition;

export const wouldHold = (c: CampaignState): boolean =>
  projectedShare(c) >= thresholdFor(c);

/** Weeks until the votes are counted. Never negative. */
export const weeksToPoll = (c: CampaignState, week: number): number =>
  Math.max(0, c.electionWeek - week);

/**
 * How much of a campaign lift survives to polling day.
 *
 * The single most useful number in the career and the one a player is least
 * able to work out in their head, so the panel prints it: a ten-point push
 * eight weeks out is worth about three by the time anybody votes.
 */
export const survivesToPoll = (
  c: CampaignState,
  week: number,
  lift: number,
): number => lift * Math.pow(1 - seatOf(c).drift, weeksToPoll(c, week));

/** The pay of the office currently held. */
export const allowanceOf = (c: CampaignState): number =>
  Math.round(seatOf(c).allowance * officeOf(c).pay);

export const inOffice = (c: CampaignState): boolean => c.office !== "candidate";

/** Whether the party would select you for the rung above. */
export function selectionBlocker(c: CampaignState): string | null {
  const next = nextOffice(c);
  if (!next) return "There is nothing above this.";
  if (c.party < next.needsParty) {
    return `The party wants ${next.needsParty} standing before they will select you. You have ${Math.round(c.party)}.`;
  }
  return null;
}

/** Every bloc's gap between where you are and where you will settle. */
export function driftTable(
  c: CampaignState,
): { bloc: Bloc; now: number; lean: number; gap: number }[] {
  const lean = leanOf(c);
  return BLOCS.map((b) => {
    const now = c.support[b.id] ?? 0;
    const to = lean[b.id] ?? 0;
    return { bloc: b, now, lean: to, gap: now - to };
  });
}

/**
 * This career's slice of the run.
 *
 * It lives here rather than beside the CareerDef because it is about
 * the *state shape*, and because anything that needs it — the event
 * catalogue, the voice pack — would otherwise have to import the
 * career module and form an import cycle with it.
 */
export const campaign = (s: RunState): CampaignState =>
  s.data.campaign as CampaignState;
