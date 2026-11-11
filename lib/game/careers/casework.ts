import type { Rng } from "../types";
import type { PhoneState } from "../medical/types";

/**
 * THE CASE PIPELINE
 *
 * The Physician is paid for the week he works. The Chef is paid the night she
 * serves. The Solicitor is paid **on settlement**, months after the work, and
 * only if it goes his way — and that single fact is the entire career.
 *
 * ---------------------------------------------------------------- the shape
 *
 * You take instructions. Each is a lump of hours that must be found before it
 * can resolve, and while you are finding them the rent is still due. So the
 * business is permanently financing its own work in progress: the more you
 * take on, the deeper the hole gets before any of it pays.
 *
 * Then it resolves, and it is not certain. Preparation moves the odds — hours
 * beyond the minimum genuinely improve your chances — but never to one. A case
 * you spent four months on can still come back against you, and it pays
 * nothing when it does.
 *
 * ------------------------------------------------------------ the decision
 *
 * Which is why every case can be **settled**. A settlement is a fraction of
 * the fee, available immediately, certain. Taking it is often correct and
 * always feels like losing. Refusing it is how the good runs happen and how
 * the bad ones end. That choice — repeated, with real information about the
 * odds — is what this career has instead of the Chef's larder.
 *
 * Deadlines are the third pressure. Instructions expire; hours already sunk
 * into a case you let lapse are simply gone.
 */

/**
 * A kind of instruction.
 *
 * `fee` against `hours` is the number that decides whether this career is a
 * game or a formality, and the first pass got it badly wrong: a contract
 * dispute paid $165,000 for 105 hours — $1,571 an hour — while a paralegal
 * delivering those hours cost $44 of salary for each one. Hiring was a
 * thirty-fold return, the simulation cleared the target in every single run,
 * and there was no decision anywhere in it.
 *
 * Fees now sit near $300–700 an hour of *expected* value once the odds are
 * applied, against staff who cost $60–110 an hour to keep. That leaves a real
 * margin — this is a profitable trade — without making the answer to every
 * question "hire somebody".
 */
export interface CaseKind {
  id: string;
  label: string;
  blurb: string;
  /** Hours of work before it can resolve at all. */
  hours: number;
  /** Paid on a win. Nothing on a loss. */
  fee: number;
  /** Chance of winning with the bare minimum of preparation. */
  baseOdds: number;
  /** Weeks from instruction to the court date. Miss it and it is lost. */
  window: number;
  /** Reputation swing on a win. Losses cost roughly half this. */
  prestige: number;
}

/*
 * FEES, RE-MEASURED 27 AUG 2026.
 *
 * These were cut ~55% when a contract dispute paid $1,571/hour and the goal
 * fell in every run. Since then the practice gained costs orders, counsel
 * fees and crises — real downside that did not exist when the cut was sized.
 * The balance trace showed where that stack landed: a London firm at
 * reputation 96 earned $143k against $134k of costs over 120 weeks, could
 * never reach the cash needed to hire, and drowned in five of six markets
 * (median 27-69 weeks overdrawn at 8 seeds).
 *
 * +35% across the scale is roughly half the original cut given back. The
 * hourly-rate exploit stays dead — hours per case were also cut then and are
 * unchanged now.
 */
export const CASE_KINDS: CaseKind[] = [
  {
    id: "conveyance",
    label: "A house purchase",
    blurb:
      "Searches, a chain that keeps breaking, and a client who rings every day. Dull, quick, and it pays.",
    hours: 14,
    fee: 5_700,
    baseOdds: 0.9,
    window: 8,
    prestige: 1,
  },
  {
    id: "probate",
    label: "An estate to wind up",
    blurb:
      "A will, three siblings and a house nobody can agree on. It will take longer than anyone has said.",
    hours: 26,
    fee: 12_800,
    baseOdds: 0.82,
    window: 14,
    prestige: 2,
  },
  {
    id: "employment",
    label: "An unfair dismissal",
    blurb:
      "She was managed out and everybody knows it. Proving what everybody knows is the job.",
    hours: 44,
    fee: 23_600,
    baseOdds: 0.58,
    window: 18,
    prestige: 5,
  },
  {
    id: "injury",
    label: "A personal injury claim",
    blurb:
      "Liability is admitted; the number is not. Paid on the outcome, which means paid on how hard you push.",
    hours: 62,
    fee: 44_500,
    baseOdds: 0.52,
    window: 22,
    prestige: 7,
  },
  {
    id: "commercial",
    label: "A contract dispute",
    blurb:
      "Two companies, one badly drafted clause, and counsel on the other side who does this every day.",
    hours: 105,
    fee: 100_000,
    baseOdds: 0.45,
    window: 30,
    prestige: 13,
  },
  {
    id: "class",
    label: "A group claim",
    blurb:
      "Two hundred claimants against somebody who can afford to make it last for years. It will define the firm either way.",
    hours: 190,
    fee: 277_000,
    baseOdds: 0.36,
    window: 44,
    prestige: 26,
  },
];

export const CASE_BY_ID = new Map(CASE_KINDS.map((c) => [c.id, c]));

/**
 * WHERE THE FIRM PRACTISES
 *
 * The Chef's city decides what a cover is worth and how long food keeps. A
 * solicitor's city decides something sharper: **what work exists here at
 * all**. A market town has house purchases and probate for ever and will
 * never send you a group claim; the City of London has all of it and four
 * other firms already acting.
 *
 *   `fee`      what the same instruction bills for
 *   `rent`     what chambers cost, due while nothing has settled
 *   `flow`     how often an instruction comes in the door
 *   `reach`    the largest prestige of work this market ever produces
 *
 * `reach` is the one that makes a city a decision rather than a rate card. It
 * caps the ladder: choosing Lagos is choosing a cheap, busy practice with a
 * ceiling, and choosing London is choosing to pay for the chance at the work
 * that ends the run. London is 1.0 on everything else, because it is where
 * this career has always started and a save from before this choice existed
 * reads as London and plays exactly as it did.
 */
export interface LegalCity {
  id: string;
  name: string;
  country: string;
  /** Key into the projected map positions. */
  position: string;
  blurb: string;
  fee: number;
  rent: number;
  flow: number;
  /** The most prestigious work this market offers. See CASE_KINDS.prestige. */
  reach: number;
  difficulty: "gentle" | "even" | "hard";
}

export const LEGAL_CITIES: LegalCity[] = [
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    position: "london",
    blurb:
      "The courts, the counsel and the clients within a mile of each other. Every kind of work this trade has, and everybody else is here too.",
    fee: 1,
    rent: 1,
    flow: 1,
    reach: 26,
    difficulty: "even",
  },
  {
    id: "madrid",
    name: "Madrid",
    country: "Spain",
    position: "madrid",
    blurb:
      "Cheap rooms and steady domestic work. Conveyancing and estates for as long as you want them, and a ceiling you will reach.",
    fee: 0.78,
    rent: 0.6,
    flow: 1.15,
    reach: 7,
    difficulty: "gentle",
  },
  {
    id: "amsterdam",
    name: "Amsterdam",
    country: "Netherlands",
    position: "amsterdam",
    blurb:
      "Small, orderly and well paid. Less work comes in than you would like, and rather more of it is worth having.",
    fee: 1.05,
    rent: 0.85,
    flow: 0.85,
    reach: 13,
    difficulty: "even",
  },
  {
    id: "newyork",
    name: "New York",
    country: "United States",
    position: "newyork",
    blurb:
      "The biggest fees in the world, the biggest rent in the world, and opponents who can afford to make it last for years.",
    fee: 1.55,
    rent: 1.7,
    flow: 0.95,
    reach: 26,
    difficulty: "hard",
  },
  {
    id: "singapore",
    name: "Singapore",
    country: "Singapore",
    position: "singapore",
    blurb:
      "Commercial work and almost nothing else. Contracts and shipping disputes arrive constantly; nobody here needs a will drafting.",
    fee: 1.25,
    rent: 1.2,
    flow: 1.1,
    reach: 13,
    difficulty: "even",
  },
  {
    id: "lagos",
    name: "Lagos",
    country: "Nigeria",
    position: "lagos",
    blurb:
      "More people needing a solicitor than there are solicitors. Fees are a third of London's and the phone does not stop.",
    fee: 0.45,
    rent: 0.4,
    flow: 1.5,
    reach: 7,
    difficulty: "hard",
  },
];

export const LEGAL_CITY_BY_ID = new Map(LEGAL_CITIES.map((c) => [c.id, c]));

/** The city this firm practises in. Absent on a save written before the choice. */
export const legalCityOf = (p: PracticeState): LegalCity =>
  LEGAL_CITY_BY_ID.get(p.city ?? "london") ?? LEGAL_CITIES[0];

/* ---------------------------------------------------------- practice areas
 *
 * WHAT KIND OF SOLICITOR YOU TURN OUT TO BE
 *
 * The career had a rich week and no long game: taking forty house purchases
 * taught you nothing about house purchases, so week 100 played exactly like
 * week 10 with more people in the room. Every other career in this game
 * accumulates something — the Physician opens departments, the Chef learns
 * techniques — and a solicitor accumulates the only thing this trade actually
 * accumulates, which is *having done this before*.
 *
 * Hours are credited when a matter **resolves**, not while it is carried.
 * You learn from work you finished, which also means coming off the record
 * teaches you nothing and wastes the hours you had put in — a second, quiet
 * reason not to.
 *
 * Nothing decays. A firm that stops doing probate is still a firm that knows
 * probate, and "what this practice became" is the whole point of the system.
 *
 * Four effects, each bounded, and the first is the one that matters:
 *
 *   hours  you do the work you know faster — see `hoursNeededFor`
 *   odds   and you are better at it when it is heard
 *   fees   and you can charge more for it
 *   flow   and the market sends you more of it
 *
 * Hours is first because it is the only one denominated in this career's own
 * constraint. The other three are a better rate on work you were doing
 * anyway; that one is capacity, which is the thing everything else here is
 * gated by.
 *
 * See `areaSkill` for what the simulation had to say about whether any of
 * this makes specialising a *choice*. Briefly: it does not, breadth wins, and
 * the version that would have made specialising win was a trap.
 */

/** Hours in one area before the profession would call you a specialist. */
export const SPECIALIST_HOURS = 1_400;

/** Hours this practice has finished in an area. Absent means none. */
export const areaHours = (p: PracticeState, kindId: string): number =>
  p.areas?.[kindId] ?? 0;

/** Every finished hour this practice has, across every area. */
export const totalAreaHours = (p: PracticeState): number =>
  Object.values(p.areas ?? {}).reduce((n, h) => n + h, 0);

/**
 * How well known this firm is for one kind of work. 0..1.
 *
 * Depth alone, and that is a decision the simulation made rather than one
 * that was designed.
 *
 * ------------------------------------------------------- what was tried
 *
 * The intention was that this would make `takeCase` a question about what the
 * firm becomes — specialise, and turn other work away for it. Three bots over
 * 24 runs in each of six markets said otherwise, every time:
 *
 *   takes whatever arrives           96% of goal
 *   prefers its own area when choosing  96%
 *   declines everything else            52%
 *
 * The reason is structural rather than a matter of tuning. Income here is
 * gated by how many matters you can carry, so declining one costs a whole
 * matter, and no per-matter bonus small enough to be sane can repay that. It
 * survived being paid in hours rather than in money — `hoursNeededFor`, which
 * is the right currency and did lift every strategy about three points — and
 * breadth still won by nearly two to one.
 *
 * A `focus` term was written and then deleted: multiplying by this area's
 * share of all finished hours *did* make narrow firms the only ones rewarded,
 * which would have meant a system that pays out exclusively for the strategy
 * that loses. That is a trap wearing a progress bar, and it is worse than
 * having no system at all.
 *
 * So this is honest about what it is: not a choice, but a real accumulation.
 * A firm gets measurably better, faster and dearer at the work it actually
 * does, which is true of the trade and true of the numbers. `totalAreaHours`
 * is kept because the Instructions screen shows the spread, and because the
 * next person to reach for a share term should find this note first.
 */
export const areaSkill = (p: PracticeState, kindId: string): number =>
  Math.min(1, areaHours(p, kindId) / SPECIALIST_HOURS);

/**
 * How many hours this matter actually takes *this* firm.
 *
 * The reward for specialising has to be paid in the same currency as the
 * constraint, and it was not. A rate bonus — a better fee, better odds — can
 * never justify carrying less work in a career where income is gated by how
 * much work you carry: declining one instruction costs a whole instruction,
 * and fifteen per cent on the rest does not come close. Measured, and it was
 * not close: a bot that specialised on purpose finished on 48% of its target
 * against 93% for one that took whatever arrived.
 *
 * A firm that has done four hundred house purchases does the next one faster.
 * That is both what actually happens and the only bonus that can pay for
 * turning work away, because the hours it frees can be spent on other work.
 */
export const hoursNeededFor = (p: PracticeState, k: CaseKind): number =>
  Math.max(1, Math.round(k.hours * (1 - areaSkill(p, k.id) * 0.08)));

/** What the interface calls it, so a bare 0.42 never reaches a player. */
export function areaBand(skill: number): string {
  if (skill <= 0) return "Never done one";
  if (skill < 0.2) return "Occasional";
  if (skill < 0.5) return "Regular work";
  if (skill < 0.8) return "Known for it";
  return "Specialists";
}

/** Credit a finished matter to the area it belonged to. */
export function creditArea(
  p: PracticeState,
  kindId: string,
  hours: number,
): void {
  if (!Number.isFinite(hours) || hours <= 0) return;
  const areas = { ...(p.areas ?? {}) };
  /* Bounded, because nothing else bounds it: a 156-week run doing one thing
     would otherwise carry an ever-growing number into every save. */
  areas[kindId] = Math.min(SPECIALIST_HOURS * 2, (areas[kindId] ?? 0) + hours);
  p.areas = areas;
}

/** The area this firm has put the most finished hours into, if any. */
export function strongestArea(p: PracticeState): CaseKind | null {
  const ranked = CASE_KINDS.map((k) => [k, areaHours(p, k.id)] as const)
    .filter(([, h]) => h > 0)
    .sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? null;
}

/**
 * What an instruction of this kind bills here.
 *
 * Two multipliers: the market's rate card, and what a firm known for this kind
 * of work can charge for it. The second is deliberately the smaller — where
 * you practise still matters more than what you practise.
 */
export const feeIn = (p: PracticeState, k: CaseKind): number =>
  Math.round(k.fee * legalCityOf(p).fee * (1 + areaSkill(p, k.id) * 0.06));

/**
 * What the matter is worth in this market, before you.
 *
 * The distinction matters and the first cut got it wrong. `feeIn` is what
 * *you* bill, and a specialist bills more — but the other side's costs are
 * their solicitors' bill, and counsel's brief fee is counsel's, and neither
 * of those goes up because you have become good at this. Running them off
 * `feeIn` made specialising raise the price of losing and the price of help,
 * which measured as a *worse* practice the better it got: London fell from
 * $18,000 to −$31,000 and eleven more weeks overdrawn.
 */
export const baseFeeIn = (p: PracticeState, k: CaseKind): number =>
  Math.round(k.fee * legalCityOf(p).fee);

/**
 * What people cost here.
 *
 * The same hole the Chef had, found the same way: fees and chambers were
 * local while salaries were not, so a firm in Lagos billed at 45% and paid a
 * London associate $2,900 a week. Halfway between what the market pays and
 * what it charges for a room, applied when somebody is hired so the figure on
 * the payroll is already the local one.
 */
export const legalLabourIndex = (p: PracticeState): number =>
  (legalCityOf(p).fee + legalCityOf(p).rent) / 2;

export interface LegalRole {
  id: string;
  label: string;
  blurb: string;
  hireCost: number;
  salary: number;
  /** Hours this person contributes to the pipeline each week. */
  hours: number;
  /** Added to the odds on everything the firm runs. */
  weight: number;
}

export const LEGAL_ROLES: LegalRole[] = [
  {
    id: "paralegal",
    label: "Paralegal",
    blurb:
      "Bundles, disclosure, chasing the other side. Hours you do not have to find yourself.",
    hireCost: 1_800,
    salary: 980,
    hours: 13,
    weight: 0.005,
  },
  {
    id: "associate",
    label: "Associate solicitor",
    blurb: "Runs their own files. The first hire that makes the firm bigger than you.",
    hireCost: 7_500,
    salary: 2_900,
    hours: 21,
    weight: 0.02,
  },
  {
    id: "partner",
    label: "Salaried partner",
    blurb:
      "Brings a practice with them and wins the ones you would have settled.",
    hireCost: 22_000,
    salary: 6_400,
    hours: 18,
    weight: 0.05,
  },
  {
    id: "clerk",
    label: "Practice clerk",
    blurb: "Keeps the diary, the billing and the deadlines. Nothing lapses on their watch.",
    hireCost: 1_400,
    salary: 820,
    hours: 4,
    weight: 0.005,
  },
];

export const LEGAL_ROLE_BY_ID = new Map(LEGAL_ROLES.map((r) => [r.id, r]));

/**
 * WHETHER THE CLIENT ACTUALLY PAYS, AND WHEN
 *
 * The career's premise is that work is not money until a court says so. This
 * is the second half of that sentence, and it was missing: a won case handed
 * over cash on the spot, which quietly made a verdict the end of the story.
 * It is not. A judgment in your favour is a *bill*, and a bill is a promise
 * from somebody who may be slow, or arguing, or gone.
 *
 * Stated on the instruction **before** it is accepted, because the whole
 * point is that it is a term of the work rather than a surprise afterwards.
 * The big fee and the bad payer are correlated on purpose — see `payerFor`.
 *
 *   `weeks`      how long after the verdict the money arrives
 *   `doubt`      chance at maturity that it has to be written down
 *   `recovers`   what you get when it is
 */
export type PayerId = "prompt" | "slow" | "doubtful";

export interface Payer {
  id: PayerId;
  label: string;
  /** One line, shown on the instruction. */
  note: string;
  weeks: number;
  doubt: number;
  recovers: number;
}

export const PAYERS: Payer[] = [
  {
    id: "prompt",
    label: "Pays on delivery",
    note: "The bill goes out and the money is there. Rarer than it sounds.",
    weeks: 0,
    doubt: 0,
    recovers: 1,
  },
  {
    id: "slow",
    label: "Slow payer",
    note: "You will be paid. You will be paid in about five weeks, and the rent is weekly.",
    weeks: 5,
    doubt: 0,
    recovers: 1,
  },
  {
    id: "doubtful",
    label: "Doubtful",
    note: "Their finance department has a process. Some of these are never collected in full.",
    weeks: 9,
    doubt: 0.3,
    recovers: 0.55,
  },
];

export const PAYER_BY_ID = new Map(PAYERS.map((p) => [p.id, p]));

/** Absent means the save was written before payers existed: it paid on the nail. */
export const payerOf = (id: PayerId | undefined): Payer =>
  PAYER_BY_ID.get(id ?? "prompt") ?? PAYERS[0];

/**
 * Money a court has said is yours, which is not the same as money.
 *
 * A bill is created by a verdict, sits on the books earning nothing, and can
 * be sold to a factor at a discount that gets worse the further off it is —
 * which is the career's binding constraint expressed as a button rather than
 * as a sentence in a tooltip.
 */
export interface Bill {
  id: string;
  client: string;
  kind: string;
  /** Face value. What arrives if you simply wait and it holds up. */
  amount: number;
  /** The week it matures. */
  dueWeek: number;
  payer: PayerId;
}

/** An instruction you have accepted and are carrying. */
export interface LiveCase {
  id: string;
  kind: string;
  client: string;
  openedWeek: number;
  dueWeek: number;
  hoursDone: number;
  /** Refreshed each week the case is on the books. */
  settlementOffer: number;

  /*
   * Everything below is optional, and load-bearing rather than lazy: a save
   * written before any of it existed has to keep playing. Every reader goes
   * through a helper that treats absent as the old behaviour — a case with no
   * payer pays on the nail, one with no adjournments has never been put off,
   * one with no counsel is being run by you alone.
   */

  /** Who is paying, carried across from the instruction. */
  payer?: PayerId;
  /** Counsel is briefed on this one. Better odds, cheaper costs if it fails. */
  counsel?: boolean;
  /**
   * Which counsel. Absent on a matter briefed before the ladder existed,
   * and reads as the senior junior — exactly what the boolean bought.
   */
  counselTier?: CounselId;
  /** Times the court has moved the date. Capped — see `MAX_ADJOURNMENTS`. */
  adjournments?: number;
  /** Taken against somebody you have acted for. The regulator may notice. */
  conflicted?: boolean;
  /** Who is on the other side, when that matters. */
  opponent?: string;
}

/** An instruction on the table, not yet accepted. */
export interface CaseOffer {
  id: string;
  kind: string;
  client: string;
  expiresWeek: number;
  /** Optional for the same reason as on the case: an older offer pays promptly. */
  payer?: PayerId;
  /** True when this is against a former client of yours. */
  conflict?: boolean;
  /** Named when there is a conflict, so the warning can say who. */
  opponent?: string;
}

export interface Verdict {
  caseId: string;
  kind: string;
  won: boolean;
  fee: number;
  odds: number;
  settled: boolean;
  /* Optional: a verdict recorded before any of this existed simply has none. */
  /** The week it was decided, so the record reads as a history. */
  week?: number;
  /** The other side's costs, when it went against you. */
  costs?: number;
  /** True when the fee became a bill rather than money. */
  billed?: boolean;
}

export interface PracticeState {
  /**
   * Where the firm practises. Chosen at week one and never changed.
   *
   * Optional so a save written before the choice existed loads and reads as
   * London, which is where every run before this one was.
   */
  city?: string;
  cases: LiveCase[];
  offers: CaseOffer[];
  staff: { id: string; name: string; role: string; salary: number }[];
  /**
   * Rooms the firm needed, under the formula the rent used to use.
   *
   * Superseded by `premises` and kept written because a save carries it and
   * because the artwork selector reads it. Nothing charges against it.
   */
  rooms: number;
  /**
   * Which set of chambers. Absent on a save from before the ladder, and
   * `chambersOf` places one of those in the smallest rooms that hold it.
   */
  premises?: string;
  lastVerdicts: Verdict[];
  nextId: number;

  /* ------------------------------------------------------------ optional
   *
   * All of it added after the career shipped, all of it absent on an older
   * save, and every reader below treats absent as the state the firm was in
   * before the system existed: no bills outstanding, nobody acted for, no
   * echo from anything said in public.
   */

  /** Judgments in your favour that have not turned into money yet. */
  bills?: Bill[];
  /** Standing arrangements: weekly money against weekly hours. */
  retainers?: Retainer[];
  /** Arrangements on the table. */
  retainerOffers?: RetainerOffer[];
  /** Clients you have been instructed by. What a conflict is measured against. */
  actedFor?: string[];
  /**
   * Finished hours per kind of work — what this firm turned out to be.
   *
   * Keyed by `CaseKind.id`, absent on a save from before the practice had
   * areas, and read only through `areaHours`, which treats absent as none.
   * A firm from then is a firm that has specialised in nothing, which is
   * exactly what it was.
   */
  areas?: Record<string, number>;
  /** Extra tries at an instruction next week, from something you published. */
  echo?: number;
  /**
   * How much publicity is currently improving what the other side will pay.
   *
   * Decays fast on purpose. A case that is in the paper is worth more to make
   * go away, and it stops being in the paper.
   */
  pressure?: number;
  /**
   * The firm's phone: feed, messages, news, standing.
   *
   * Optional so a save written before the handset existed gains one on first
   * touch rather than being rejected for not having one — the same treatment
   * the kitchen's phone gets.
   */
  phone?: PhoneState;
}

/* ----------------------------------------------------------------- helpers */

export const staffHours = (p: PracticeState): number =>
  p.staff.reduce((n, s) => n + (LEGAL_ROLE_BY_ID.get(s.role)?.hours ?? 0), 0);

export const firmWeight = (p: PracticeState): number =>
  p.staff.reduce((n, s) => n + (LEGAL_ROLE_BY_ID.get(s.role)?.weight ?? 0), 0);

export const legalWages = (p: PracticeState): number =>
  p.staff.reduce((n, s) => n + s.salary, 0);

/* --------------------------------------------------------------- chambers
 *
 * WHERE THE FIRM ACTUALLY SITS
 *
 * Chambers used to be derived: one room per three fee earners, rent equal to
 * the headcount. That is an *expense*, not a decision — money had nowhere to
 * go in this career except payroll, which is why a well-run practice's week
 * 100 looked like its week 40 with more salaries in it.
 *
 * A ladder makes it a commitment. Each set of rooms holds a fixed number of
 * fee earners and costs a fixed rent whether or not anybody is in them, so
 * moving up is a bet that you will fill the space before the rent eats the
 * difference — which is this career's own bet, in property form.
 *
 *   `seats`  fee earners the rooms hold, counting you. A hard cap on hiring.
 *   `rent`   weekly, due whatever happens, and it does not scale with use.
 *   `draw`   what walks in off the street. A high-street office is seen.
 *
 * The first rung's rent is exactly what the old formula charged a one-room
 * practice, so a London run starts paying precisely what it always paid.
 */
export interface Chambers {
  id: string;
  label: string;
  blurb: string;
  /** Fee earners these rooms hold, including you. */
  seats: number;
  /** London money, weekly. Multiplied by the market's rent index. */
  rent: number;
  /** London money, one-off. Multiplied by the market's rent index. */
  cost: number;
  /** Multiplier on the chance an instruction arrives at all. */
  draw: number;
}

export const LEGAL_PREMISES: Chambers[] = [
  {
    id: "desk",
    label: "A borrowed desk",
    blurb:
      "A room above a shop with somebody else's name on the door. It holds you and two other people, and nobody has ever walked into it by accident.",
    seats: 3,
    rent: 640,
    cost: 0,
    draw: 1,
  },
  {
    id: "highstreet",
    label: "A high-street office",
    blurb:
      "A window, a waiting area, and your name on the glass. People who were not looking for a solicitor find one here.",
    seats: 7,
    rent: 1_900,
    cost: 24_000,
    draw: 1.12,
  },
  {
    id: "square",
    label: "Two floors on the square",
    blurb:
      "Proper rooms, a meeting room that impresses, and space for a practice that is no longer mostly you.",
    seats: 14,
    rent: 3_300,
    cost: 78_000,
    draw: 1.24,
  },
  {
    id: "city",
    label: "A floor in the City",
    blurb:
      "The address does half the work. It also costs more empty than your first year of chambers cost full.",
    seats: 26,
    rent: 6_800,
    cost: 250_000,
    draw: 1.35,
  },
];

export const PREMISES_BY_ID = new Map(LEGAL_PREMISES.map((x) => [x.id, x]));

/**
 * Where this firm sits.
 *
 * Absent on a save written before the ladder, and those are placed in the
 * smallest rooms that hold the people already on the payroll — so a firm of
 * six does not arrive in a borrowed desk it has plainly outgrown, and its rent
 * lands within a few pounds of what the old headcount formula charged.
 */
export function chambersOf(p: PracticeState): Chambers {
  const named = p.premises ? PREMISES_BY_ID.get(p.premises) : undefined;
  if (named) return named;
  const need = p.staff.length + 1;
  return (
    LEGAL_PREMISES.find((x) => x.seats >= need) ??
    LEGAL_PREMISES[LEGAL_PREMISES.length - 1]
  );
}

/** How far up the ladder, for anything that wants a rank rather than an id. */
export const chambersRank = (p: PracticeState): number =>
  LEGAL_PREMISES.findIndex((x) => x.id === chambersOf(p).id);

/** Fee earners these rooms hold, and how many are in them. */
export const chambersSeats = (p: PracticeState): number => chambersOf(p).seats;
export const seatsUsed = (p: PracticeState): number => p.staff.length + 1;
export const seatsFree = (p: PracticeState): number =>
  Math.max(0, chambersSeats(p) - seatsUsed(p));

/** What walks in off the street because of where you are. */
export const chambersDraw = (p: PracticeState): number => chambersOf(p).draw;

/**
 * What moving costs.
 *
 * A fit-out is not wholly lost — the desks, the shelving and the practice
 * management system move with you — so the rooms you are leaving are worth
 * something against the rooms you are taking. Property money, so it moves
 * with the market's rent index rather than its fee index.
 */
export const chambersPrice = (
  p: PracticeState,
  to: Chambers,
): number =>
  Math.max(
    0,
    Math.round((to.cost - chambersOf(p).cost * 0.4) * legalCityOf(p).rent),
  );

/** The next rung up, or nothing if the firm is already at the top. */
export const nextChambers = (p: PracticeState): Chambers | null =>
  LEGAL_PREMISES[chambersRank(p) + 1] ?? null;

/** Chambers cost, due whatever happens and whether or not the rooms are full. */
export const chambersRent = (p: PracticeState): number =>
  Math.round(chambersOf(p).rent * legalCityOf(p).rent);

/**
 * Work in progress: hours already spent on cases that have not paid.
 *
 * The number that kills firms. It is not on the balance sheet as cash and it
 * is not free to carry, and a player who does not watch it will take on a
 * fourth case while three are still unfunded.
 */
export const workInProgress = (p: PracticeState): number =>
  p.cases.reduce((n, c) => {
    const k = CASE_BY_ID.get(c.kind);
    if (!k) return n;
    return n + Math.min(1, c.hoursDone / hoursNeededFor(p, k)) * feeIn(p, k) * 0.35;
  }, 0);

export const hoursOutstanding = (p: PracticeState): number =>
  p.cases.reduce((n, c) => {
    const k = CASE_BY_ID.get(c.kind);
    return k ? n + Math.max(0, hoursNeededFor(p, k) - c.hoursDone) : n;
  }, 0);

/* ------------------------------------------------------- what a clerk is for
 *
 * The practice clerk's card has always said "nothing lapses on their watch",
 * and until the court had a diary of its own that was four hours a week and a
 * sentence. It is now the thing that keeps your hearing dates where the court
 * put them.
 */
export const hasClerk = (p: PracticeState): boolean =>
  p.staff.some((s) => s.role === "clerk");

/** Nothing is put off for ever, and a case that never resolves is not a game. */
export const MAX_ADJOURNMENTS = 3;

/**
 * The chance the court moves this hearing rather than hearing it.
 *
 * Bigger matters slip more — there is more to list, more parties, and more
 * people with a reason to want longer. A clerk cuts it to a third, which is
 * the clearest reason in the career to hire somebody who bills almost no
 * hours at all.
 */
export function relistChance(p: PracticeState, k: CaseKind): number {
  const base = hasClerk(p) ? 0.06 : 0.18;
  return Math.min(0.3, base + k.prestige * 0.004);
}

/** Weeks the court puts it back by. Long enough to hurt, short enough to plan. */
export const RELIST_WEEKS: [number, number] = [3, 6];

/**
 * What a barrister costs, and what they are worth.
 *
 * The purest expression of this career's constraint available: certain cash
 * out **now**, months before the thing it improves can pay anything at all.
 * A player who is solvent can buy better odds; one who is financing four
 * files cannot, which is precisely when they would most like to.
 */
export const counselFee = (
  p: PracticeState,
  k: CaseKind,
  tier: CounselId = "senior",
): number => Math.round(baseFeeIn(p, k) * counselOf(tier).fee);

/**
 * WHO YOU ACTUALLY BRIEF
 *
 * Briefing counsel was a boolean: one price, one effect, and no decision
 * beyond whether you could afford it. A practice does not choose *whether* to
 * instruct counsel so much as *which* counsel, and the three tiers are a real
 * spread — a junior on a small matter is sensible, and a silk on a house
 * purchase is a joke the clerk would refuse to arrange.
 *
 * `senior` is priced exactly where the boolean was, so the balance the
 * simulation already settled sits in the middle of the ladder rather than
 * being replaced by three numbers nobody has measured.
 */
export type CounselId = "junior" | "senior" | "silk";

export interface Counsel {
  id: CounselId;
  label: string;
  blurb: string;
  /** Share of the fee, before the market and the clerk have their say. */
  fee: number;
  /** Added to the odds. */
  odds: number;
  /** What the other side's costs are multiplied by if it still goes wrong. */
  relief: number;
  /** Chambers will not put this one on anything smaller. */
  minPrestige: number;
}

export const COUNSEL: Counsel[] = [
  {
    id: "junior",
    label: "A junior",
    blurb:
      "Two years call, cheap, and perfectly capable of a matter you have already prepared properly.",
    fee: 0.055,
    odds: 0.06,
    relief: 0.7,
    minPrestige: 0,
  },
  {
    id: "senior",
    label: "A senior junior",
    blurb:
      "Does this every week and has read the authorities you have not. The ordinary answer on an ordinary matter.",
    fee: 0.09,
    odds: 0.1,
    relief: 0.55,
    minPrestige: 0,
  },
  {
    id: "silk",
    label: "Leading counsel",
    blurb:
      "Silk. Expensive enough to be a decision in itself, and the clerk will not put one on anything small.",
    fee: 0.17,
    odds: 0.16,
    relief: 0.38,
    minPrestige: 5,
  },
];

export const COUNSEL_BY_ID = new Map(COUNSEL.map((c) => [c.id, c]));

/** Absent or unknown reads as the senior junior — what the boolean used to be. */
export const counselOf = (id: CounselId | undefined): Counsel =>
  COUNSEL_BY_ID.get(id ?? "senior") ?? COUNSEL[1];

/** Whether chambers would put this tier on this kind of matter at all. */
export const counselAvailable = (tier: Counsel, k: CaseKind): boolean =>
  k.prestige >= tier.minPrestige;

/**
 * Added to the odds on a case counsel is briefed on.
 *
 * Priced by simulation rather than by feel, and the first attempt was wrong:
 * at +0.07 for 11% of the fee, the expected return on a brief was about 10.6%
 * of the fee against a cost of 11% — a bet that looked like an investment and
 * was very slightly a loss. Nobody would ever have noticed, which is exactly
 * what makes it a trap.
 *
 * At +0.10 for 9%, briefing a contested matter is clearly worth it and
 * briefing one you were going to win anyway is clearly not — the odds cap at
 * 0.93, so most of what you paid for is thrown away on a strong case. That is
 * a judgement rather than an upgrade, which is the point.
 */
export const COUNSEL_ODDS = 0.1;

/** What the tier briefed on this matter is worth, or nothing. */
export const counselOdds = (c: LiveCase): number =>
  c.counsel ? counselOf(c.counselTier).odds : 0;

/**
 * What losing costs, over and above being paid nothing.
 *
 * Until this existed a loss was merely a blank week, and the settle-or-fight
 * decision was therefore a free option: run every case to the door, because
 * the worst outcome was zero. It is not zero. The other side's costs follow
 * the event, and a firm that fights everything pays for the other side's
 * solicitors as well as its own.
 *
 * Counsel argues them down, which is the second half of what the brief fee
 * buys. Settling avoids them entirely — that is the real reason solicitors
 * settle, and it is now the real reason in here too.
 */
export const costsOrder = (
  p: PracticeState,
  k: CaseKind,
  counsel: boolean,
  tier?: CounselId,
): number =>
  Math.round(baseFeeIn(p, k) * 0.16 * (counsel ? counselOf(tier).relief : 1));

/* ------------------------------------------------------------------- bills */

export const billsOf = (p: PracticeState): Bill[] => p.bills ?? [];

/**
 * WHAT A CLERK IS REALLY FOR
 *
 * Their card has always said "keeps the diary, the billing and the deadlines",
 * and for a long time only the diary half was true. The billing half is this:
 * somebody whose job is chasing money gets it in sooner and gets more of it.
 *
 * It matters because it is the only thing in the firm that attacks the career's
 * actual constraint. Every other hire buys hours, and hours are not the problem
 * — a practice with four people and no cash is still a practice with no cash.
 *
 * Simulation is why this exists at all. A clerk whose entire value was fewer
 * adjournments was worth about £160 a week against a salary of £820, so hiring
 * one was a slow way to lose, which no card said and no player would have
 * spotted.
 */
export const billWeeks = (p: PracticeState, payer: Payer): number =>
  payer.weeks === 0 ? 0 : Math.max(1, payer.weeks - (hasClerk(p) ? 2 : 0));

/** How likely a doubtful client is to argue the bill down, given who chases it. */
export const billDoubt = (p: PracticeState, payer: Payer): number =>
  payer.doubt * (hasClerk(p) ? 0.6 : 1);

/** Face value of every judgment that has not turned into money yet. */
export const billsOwed = (p: PracticeState): number =>
  billsOf(p).reduce((n, b) => n + b.amount, 0);

/**
 * What a factor will pay for a bill today.
 *
 * Worse the further off it is, because that is what they are actually buying:
 * the wait, and the chance it never lands. A bill maturing next week fetches
 * most of its face; one nine weeks out fetches barely half. Selling is never
 * the arithmetically best move and is frequently the only move, which is the
 * correct shape for a decision in this career.
 */
export function factorValue(b: Bill, week: number): number {
  const weeksLeft = Math.max(0, b.dueWeek - week);
  const rate = Math.max(0.55, Math.min(0.86, 0.86 - 0.035 * weeksLeft));
  return Math.round(b.amount * rate);
}

/**
 * The odds on a case as it currently stands.
 *
 * Base odds, plus what preparation beyond the minimum buys, plus counsel if
 * they are briefed, plus the firm's weight and your own skill. Capped below 1
 * on purpose: there is no amount of work that makes a contested case certain,
 * and a career built on pretending otherwise would have no decisions in it.
 */
export function oddsFor(
  c: LiveCase,
  p: PracticeState,
  skill: number,
): number {
  const k = CASE_BY_ID.get(c.kind);
  if (!k) return 0;
  const need = hoursNeededFor(p, k);
  const over = Math.max(0, c.hoursDone - need) / Math.max(1, need);
  const prep = Math.min(0.22, over * 0.3);
  const counsel = counselOdds(c);
  /* Having done four hundred of these is worth something at the door. */
  const specialism = areaSkill(p, k.id) * 0.06;
  return Math.max(
    0.05,
    Math.min(
      0.93,
      k.baseOdds + prep + counsel + specialism + firmWeight(p) + skill / 900,
    ),
  );
}

/** As far as anything you have said in public can move an offer. */
export const MAX_PRESSURE = 0.12;

/**
 * What the other side will pay to make it go away.
 *
 * Rises as the case gets stronger, which is what makes settling a real
 * decision rather than an obvious mistake: the better your position, the more
 * you are being offered to give it up.
 *
 * Two later terms pull against each other. Publicity lifts it — a matter that
 * is being written about is worth more to end quietly. Every adjournment
 * shaves it, because they can see what waiting costs you and you cannot see
 * what it costs them.
 */
export function settlementFor(
  c: LiveCase,
  p: PracticeState,
  skill: number,
): number {
  const k = CASE_BY_ID.get(c.kind);
  if (!k) return 0;
  const odds = oddsFor(c, p, skill);
  const waited = Math.max(0.7, 1 - 0.04 * (c.adjournments ?? 0));
  const public_ = 1 + Math.min(MAX_PRESSURE, p.pressure ?? 0);
  /* Below the expected value — they are buying certainty too, and they are
     better at pricing it than you are. */
  return Math.round(feeIn(p, k) * odds * 0.72 * waited * public_);
}

/* -------------------------------------------------------------- retainers
 *
 * THE ONE THING IN THIS CAREER THAT PAYS EVERY WEEK
 *
 * Everything else here is a lump, months away, and uncertain — that is the
 * premise, and a retainer is the premise's opposite number rather than an
 * escape from it. A client pays you a fixed sum every week whether or not
 * they need anything, and in exchange you reserve hours for them every week
 * whether or not they call.
 *
 * Which makes it a genuine trade rather than free money:
 *
 *   you get   income that arrives on time, does not care what a court says,
 *             and can be planned against — the only such money in the career
 *   you pay   hours off the top of every week, before a single one reaches a
 *             live matter, and they are gone whether or not the client rings
 *
 * And one cost that is easy to miss and is the sharpest of the three: a
 * client on a retainer stops sending you *instructions*. Their work is
 * covered. So retaining somebody removes them from the pool the market draws
 * from, and a practice on three retainers is a practice hearing from fewer
 * people.
 *
 * Priced below what an hour in a live matter is worth in expectation, because
 * what is being bought is certainty, and certainty in this career is worth
 * paying for. A firm that is comfortable should be taking matters; a firm
 * that cannot see past Friday should be taking retainers. That is the whole
 * decision.
 */
export interface RetainerKind {
  id: string;
  label: string;
  blurb: string;
  /** London money a week. Multiplied by the market's fee index. */
  fee: number;
  /** Hours reserved every week, whether or not they call. */
  hours: number;
  /** Weeks the arrangement runs before it ends. */
  weeks: number;
  /** Standing before anybody offers one of these. */
  needs: number;
}

export const RETAINERS: RetainerKind[] = [
  {
    id: "advice",
    label: "An advice line",
    blurb:
      "A few hours a week on the end of a telephone for somebody who would rather ask than find out. Rarely interesting and it pays on the first of the month.",
    fee: 650,
    hours: 5,
    weeks: 26,
    needs: 18,
  },
  {
    id: "general",
    label: "General retainer",
    blurb:
      "Everything that comes up, up to a point. They stop shopping around and you stop being able to bill them for the good months.",
    fee: 1_300,
    hours: 10,
    weeks: 34,
    needs: 38,
  },
  {
    id: "panel",
    label: "A place on the panel",
    blurb:
      "Named solicitors for a company large enough to have a legal department of its own. Steady, unglamorous, and it will carry a practice through a bad year.",
    fee: 2_300,
    hours: 18,
    weeks: 44,
    needs: 58,
  },
];

/**
 * How many standing arrangements a practice can hold at once.
 *
 * There has to be a ceiling and the simulation is why. Without one, a bot
 * that accepted every offer ended a 120-week run on fourteen thousand a week
 * of retainers and finished on 120% of goal against 90% for a bot that took
 * none — better worth *and* a third of the overdrawn weeks, which is not a
 * trade, it is a strictly better button.
 *
 * The reason is that a growing firm is hours-rich and work-poor: the pipeline
 * cannot always supply enough matters to fill the week, so retained hours
 * were being paid out of hours that would otherwise have idled. Free money
 * wearing the costume of a decision.
 *
 * Three is a practice with a character rather than a subscription business.
 */
export const MAX_RETAINERS = 3;

export const RETAINER_BY_ID = new Map(RETAINERS.map((r) => [r.id, r]));

/** A standing arrangement the firm has accepted. */
export interface Retainer {
  id: string;
  kind: string;
  client: string;
  fromWeek: number;
  /** Weeks still to run. Nothing here lasts for ever. */
  weeks: number;
}

/** One on the table, not yet accepted. */
export interface RetainerOffer {
  id: string;
  kind: string;
  client: string;
  expiresWeek: number;
}

export const retainersOf = (p: PracticeState): Retainer[] => p.retainers ?? [];
export const retainerOffersOf = (p: PracticeState): RetainerOffer[] =>
  p.retainerOffers ?? [];

/** What arrives every week whatever the courts are doing. */
export const retainerIncome = (p: PracticeState): number =>
  Math.round(
    retainersOf(p).reduce(
      (n, r) => n + (RETAINER_BY_ID.get(r.kind)?.fee ?? 0),
      0,
    ) * legalCityOf(p).fee,
  );

/** Hours taken off the top of the week before any matter sees one. */
export const retainerHours = (p: PracticeState): number =>
  retainersOf(p).reduce(
    (n, r) => n + (RETAINER_BY_ID.get(r.kind)?.hours ?? 0),
    0,
  );

/** Clients whose work is already covered, so they send no instructions. */
export const retainedClients = (p: PracticeState): Set<string> =>
  new Set(retainersOf(p).map((r) => r.client));

const CLIENTS = [
  "Halloran & Co", "the Aldridge estate", "Ms Baptiste", "Northgate Freight",
  "Mr Ferreira", "the Okonjo family", "Vance Holdings", "Ms Lindqvist",
  "Ardal Construction", "the Wren Trust", "Mr Saeed", "Cormack Retail",
];

/**
 * Who is behind this instruction, and when they will actually pay.
 *
 * Deliberately correlated with the size of the work. A house purchase is a
 * couple who have a mortgage advance sitting in an account; a group claim is
 * funded by somebody with a finance department, a process, and no particular
 * hurry. That correlation is the point: the instruction that would change the
 * firm is also the one that will not pay for two months after it lands, which
 * is the same sentence as the career's premise seen from a different angle.
 */
export function payerFor(k: CaseKind, rng: Rng): PayerId {
  const prompt = Math.max(0.2, 0.62 - k.prestige * 0.014);
  if (rng.chance(prompt)) return "prompt";
  return rng.chance(0.7) ? "slow" : "doubtful";
}

/**
 * What comes in the door this week.
 *
 * Reputation gates the size of the work, not the volume: a firm nobody has
 * heard of still gets house purchases, it simply never gets the group claim.
 * That is the ladder the career climbs.
 *
 * `echo` is what something you published is still doing — an extra try at the
 * door for a week or two, on top of whatever pitching you did in person.
 */
export function newOffers(
  p: PracticeState,
  reputation: number,
  week: number,
  pitching: number,
  rng: Rng,
): CaseOffer[] {
  const out: CaseOffer[] = [];
  const city = legalCityOf(p);
  /* Somebody who pays you every week does not also send you instructions —
     their work is what the retainer covers. Retaining people therefore
     narrows the pool the market draws from, which is the third and least
     obvious cost of the arrangement. */
  const held = retainedClients(p);
  const free = CLIENTS.filter((c) => !held.has(c));
  if (free.length === 0) return out;
  /*
   * And a firm on retainer is a firm with less time to go and find work.
   *
   * The hours cost alone was not a cost at all. A growing practice is
   * hours-rich and work-poor — the pipeline cannot always fill the week — so
   * retained hours came out of hours that would otherwise have idled, and a
   * bot taking every arrangement beat one taking none on *both* worth and
   * weeks overdrawn. That is a strictly better button rather than a trade.
   *
   * This is the cost that scales with the firm, because what it takes is the
   * thing the firm actually lives on: new instructions arriving.
   */
  const retainerDrag = Math.max(0.55, 1 - retainersOf(p).length * 0.15);
  const echo = Math.max(0, p.echo ?? 0);
  const tries = 1 + pitching + echo;
  for (let i = 0; i < tries; i++) {
    if (
      !rng.chance(
        (0.35 + pitching * 0.16 + echo * 0.1 + reputation / 260) *
          city.flow *
          chambersDraw(p) *
          retainerDrag,
      )
    ) {
      continue;
    }
    /*
     * Two gates, and they are different in kind. Reputation is what you have
     * earned and it rises; `reach` is what this market has and it does not.
     * A firm in Lagos can become the best-regarded practice in the city and
     * still never be offered a group claim, because the claim is not here.
     */
    const reachable = CASE_KINDS.filter(
      (k) => k.prestige <= 2 + reputation / 3.2 && k.prestige <= city.reach,
    );
    if (reachable.length === 0) continue;
    /*
     * Weighted by what this firm is known for.
     *
     * The market does not send work at random to a practice with a
     * reputation: a firm that has done four hundred hours of personal injury
     * is the firm people ring about personal injury. A full specialist is
     * three times as likely to be sent their own area as an unreachable one,
     * which is enough to make specialising compound and not enough to stop
     * anything else arriving.
     */
    const weights = reachable.map((x) => 1 + areaSkill(p, x.id) * 2);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng.next() * total;
    let kind = reachable[reachable.length - 1];
    for (let j = 0; j < reachable.length; j++) {
      roll -= weights[j];
      if (roll <= 0) {
        kind = reachable[j];
        break;
      }
    }
    /*
     * A conflict can only exist once there is a history to conflict with, so
     * this is quiet for the first weeks of a run and then starts happening —
     * which is exactly how it goes. The other side is somebody you have
     * already acted for, which is why it is a conflict rather than bad luck.
     */
    const acted = p.actedFor ?? [];
    const clash = acted.length > 0 && rng.chance(0.14);
    const opponent = clash ? rng.pick(acted) : undefined;
    out.push({
      id: `of-${p.nextId++}`,
      kind: kind.id,
      client: rng.pick(free),
      expiresWeek: week + 3,
      payer: payerFor(kind, rng),
      ...(opponent ? { conflict: true, opponent } : {}),
    });
  }
  return out;
}

export function initialPractice(): PracticeState {
  return {
    cases: [],
    offers: [],
    staff: [],
    rooms: 1,
    premises: "desk",
    lastVerdicts: [],
    nextId: 1,
    bills: [],
    retainers: [],
    retainerOffers: [],
    actedFor: [],
    echo: 0,
    pressure: 0,
  };
}
