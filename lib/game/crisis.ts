import { LAWYER_CRISIS_STAGES } from "./careers/lawyerCrises";


/**
 * CRISES
 *
 * A bad week that lasts, and that you can make better or worse.
 *
 * The existing bad events are one-shot: something happens, you pick from two
 * options, it resolves. That is right for most of them. It is wrong for the
 * big ones — a staff walkout is not a decision, it is a fortnight of
 * decisions, and treating it as a single dialog is what makes a management
 * game feel like a slot machine with prose.
 *
 * ------------------------------------------------------------- the shape
 *
 * A crisis is a small state machine that lives on the run:
 *
 *   severity   0..100, and the whole game is keeping this falling
 *   stage      which beat you are on
 *   weeks      how long it has been running
 *
 * Each week it is open, severity moves by itself — upward if you are ignoring
 * it, downward if the actions you took are working. Every stage offers real
 * choices with costs in money, time, reputation and relationships, and the
 * choice you make changes which stage comes next.
 *
 * **Prevention is modelled**, which is the part that makes this a system
 * rather than a punishment: `crisisRisk` reads culture, ethics, regulation,
 * supplies and staffing, so a well-run practice sees fewer of these, and the
 * ones it does see start at a lower severity.
 *
 * **Escalation is modelled too.** Ignoring a crisis for four weeks moves it to
 * its terminal stage, which is always worse than any of the choices you
 * declined to make.
 */

export type CrisisKind =
  | "lawsuit"
  | "walkout"
  | "inspection"
  | "cashflow"
  | "dataleak"
  | "scandal"
  | "shortage";

export const CRISIS_KINDS: readonly CrisisKind[] = [
  "lawsuit",
  "walkout",
  "inspection",
  "cashflow",
  "dataleak",
  "scandal",
  "shortage",
];

export const CRISIS_LABEL: Record<CrisisKind, string> = {
  lawsuit: "Legal claim",
  walkout: "Staff walkout",
  inspection: "Failed inspection",
  cashflow: "Cash emergency",
  dataleak: "Data breach",
  scandal: "Public scandal",
  shortage: "Supply failure",
};

export interface ActiveCrisis {
  id: string;
  kind: CrisisKind;
  startedWeek: number;
  /** 0..100. Zero resolves it; 100 is the terminal outcome. */
  severity: number;
  /** Which beat. Stages are authored per kind. */
  stage: number;
  /** Choice ids already taken, so a stage cannot be farmed. */
  taken: string[];
  /** Weeks since the player last did anything about it. */
  ignored: number;
  city?: string;
  /**
   * Whose stage set this runs on.
   *
   * Optional, and absent means the Physician's — which is what every crisis
   * written before any other career had one actually was. A save from then
   * reads and plays exactly as it did.
   */
  career?: string;
}

/** Two at once is a bad month; three is noise. */
export const MAX_CRISES = 2;

export interface CrisisChoice {
  id: string;
  label: string;
  detail: string;
  /** Cash it costs. Checked before the button is enabled. */
  cost?: number;
  /** Planner blocks it costs, taken from next week. */
  blocks?: number;
  /** Change to severity. Negative is progress. */
  severity: number;
  /** Reputation movement, by category. */
  rep?: Partial<Record<string, number>>;
  /**
   * Movement in the career's own headline standing.
   *
   * `rep` writes the Physician's six categories, which have a screen behind
   * them in exactly one career; a Solicitor moved that way would be moving a
   * number nothing reads. Careers whose standing is a single figure use this
   * instead, and apply it in their own handler.
   */
  standing?: number;
  /** Borrowing taken on. For the choices that are "find the money somewhere". */
  debt?: number;
  /** People who notice, and how. */
  people?: { id: string; warmth?: number; trust?: number; respect?: number; why: string }[];
  /** Where this leads. Absent means stay on this stage. */
  next?: number;
  /** What the player is told afterwards. */
  result: string;
}

export interface CrisisStage {
  title: string;
  body: string;
  choices: CrisisChoice[];
}

/**
 * How likely a crisis is this week, and which one.
 *
 * Every term is something the player controls, which is what makes running a
 * tight practice a strategy rather than a flavour. The base rate is small and
 * non-zero: no amount of good management makes you immune.
 */
export function crisisRisk(ctx: {
  week: number;
  culture: number;
  ethics: number;
  risk: number;
  regulation: number;
  cashWeeks: number;
  supplyWeeks: number;
  staff: number;
  scrutiny: number;
}): { chance: number; kind: CrisisKind | null; drivers: string[] } {
  const drivers: string[] = [];
  let chance = 0.006;
  const weights: [CrisisKind, number][] = [];

  if (ctx.risk > 30) {
    weights.push(["lawsuit", (ctx.risk - 30) * 0.004]);
    drivers.push("malpractice risk");
  }
  if (ctx.culture < 45 && ctx.staff >= 2) {
    weights.push(["walkout", (45 - ctx.culture) * 0.0035]);
    drivers.push("workplace culture");
  }
  if (ctx.regulation > 35) {
    weights.push(["inspection", (ctx.regulation - 35) * 0.0025]);
    drivers.push("local regulation");
  }
  if (ctx.cashWeeks < 3) {
    weights.push(["cashflow", (3 - ctx.cashWeeks) * 0.02]);
    drivers.push("thin cash reserves");
  }
  if (ctx.supplyWeeks < 2) {
    weights.push(["shortage", (2 - ctx.supplyWeeks) * 0.02]);
    drivers.push("supply cover");
  }
  if (ctx.ethics < 45) {
    weights.push(["scandal", (45 - ctx.ethics) * 0.0025]);
    drivers.push("ethical standing");
  }
  if (ctx.scrutiny > 40) {
    weights.push(["dataleak", (ctx.scrutiny - 40) * 0.0015]);
    drivers.push("public scrutiny");
  }

  const total = weights.reduce((n, [, w]) => n + w, 0);
  chance = Math.min(0.16, chance + total);

  // Pick deterministically by weight; the caller decides whether it fires.
  let best: CrisisKind | null = null;
  let bestW = 0;
  for (const [k, w] of weights) {
    if (w > bestW) {
      bestW = w;
      best = k;
    }
  }
  return { chance, kind: best, drivers };
}

export function startCrisis(
  kind: CrisisKind,
  week: number,
  severity: number,
  city?: string,
  career?: string,
): ActiveCrisis {
  return {
    id: `${kind}-${week}`,
    kind,
    startedWeek: week,
    severity: Math.max(20, Math.min(85, severity)),
    stage: 0,
    taken: [],
    ignored: 0,
    city,
    ...(career ? { career } : {}),
  };
}

/**
 * A week passing with a crisis open.
 *
 * Neglect compounds. Four untouched weeks moves it to the terminal stage,
 * which is how "I will deal with it later" becomes the worst available
 * outcome rather than a free delay.
 */
export function tickCrisis(c: ActiveCrisis): {
  escalated: boolean;
  burnedOut: boolean;
} {
  /*
   * Something you have already finished cannot be neglected.
   *
   * The drift below is never less than +2, and the weekly loops check
   * `isResolved` *after* ticking — so a crisis answered all the way down to
   * zero drifted straight back to 2 and stayed open for ever. It was
   * unreachable in practice until a second career's stages made a two-choice
   * resolution ordinary, and then it was every time.
   */
  if (isResolved(c)) return { escalated: false, burnedOut: false };

  c.ignored += 1;
  const drift = c.ignored >= 2 ? 6 + c.ignored : 2;
  c.severity = Math.min(100, c.severity + drift);
  const stages = stagesFor(c.kind, c.career);
  const escalated = c.ignored >= 4 && c.stage < stages.length - 1;
  if (escalated) c.stage = stages.length - 1;

  /*
   * A crisis has to end.
   *
   * Left alone it pins at severity 100 and sits there, which a probe run
   * showed as a staff walkout still "running" sixty weeks after it started —
   * permanently on screen, permanently unresolved, and no longer a decision.
   *
   * So sustained neglect burns it out: the worst outcome happens, and the
   * crisis closes. That is worse than any choice the player declined, which
   * is the point — ignoring it is a decision with a cost, not a way to keep a
   * bad thing in a holding pattern forever.
   */
  const burnedOut = c.ignored >= NEGLECT_LIMIT;
  return { escalated, burnedOut };
}

/** Weeks of doing nothing before a crisis resolves itself, badly. */
export const NEGLECT_LIMIT = 8;

export const isResolved = (c: ActiveCrisis): boolean => c.severity <= 0;

/* --------------------------------------------------------------- content */

/**
 * The stages, per kind.
 *
 * Every crisis has at least three: the thing happening, the thing continuing
 * because of what you chose, and the terminal beat you reach by ignoring it.
 * The terminal stage always offers something — a crisis with no way out is a
 * loss screen, and the game has those already.
 */
const MEDICAL_STAGES: Record<CrisisKind, CrisisStage[]> = {
  walkout: [
    {
      title: "Your nurses have stopped covering the gaps",
      body: "Nobody has resigned. Nobody is doing anything they are not contracted to do either, and the difference is the entire rota.",
      choices: [
        {
          id: "listen",
          label: "Sit down with them",
          detail: "Two blocks of your time. No promises made yet.",
          blocks: 2,
          severity: -22,
          rep: { loyalty: 6 },
          people: [
            { id: "mbeki", warmth: 10, trust: 8, why: "you asked, and then listened" },
          ],
          next: 1,
          result:
            "Four hours in a back room. Most of it was about the rota and none of it was a surprise.",
        },
        {
          id: "pay",
          label: "Put pay up now",
          detail: "Expensive, immediate, and it buys quiet rather than trust.",
          cost: 60_000,
          severity: -30,
          rep: { loyalty: 8, patients: 1 },
          next: 1,
          result: "The rota filled by Thursday. Nobody said thank you.",
        },
        {
          id: "agency",
          label: "Cover it with agency staff",
          detail: "Fast, very expensive, and the team will notice what you chose.",
          cost: 90_000,
          severity: -8,
          rep: { loyalty: -10 },
          people: [
            {
              id: "lindqvist",
              warmth: -8,
              trust: -6,
              why: "you brought in agency rather than talk to the team",
            },
          ],
          next: 2,
          result: "The lists ran. The people who had been carrying them went quiet.",
        },
      ],
    },
    {
      title: "They want it in writing",
      body: "The conversation went well enough that they now expect something to change. Elena has drafted what they are asking for.",
      choices: [
        {
          id: "agree",
          label: "Sign it",
          detail: "Fixed limits on cover. It will cost you flexibility for good.",
          severity: -40,
          rep: { loyalty: 12, ethics: 3 },
          people: [
            { id: "lindqvist", warmth: 10, trust: 10, why: "you signed the rota agreement" },
          ],
          result:
            "You signed. The practice is slower to flex and nobody is looking for another job.",
        },
        {
          id: "partial",
          label: "Agree to most of it",
          detail: "Enough to end this. Not enough to satisfy anyone.",
          severity: -22,
          rep: { loyalty: 4 },
          result: "A compromise nobody loves, which is usually what one looks like.",
        },
      ],
    },
    {
      title: "Two of them have handed in notice",
      body: "It stopped being about the rota some weeks ago.",
      choices: [
        {
          id: "counter",
          label: "Counter-offer, hard",
          detail: "Keep them, at a price, and everyone else will hear the number.",
          cost: 120_000,
          severity: -50,
          rep: { loyalty: 2 },
          result:
            "One stayed. The number got out within a week and the others have done the arithmetic.",
        },
        {
          id: "letgo",
          label: "Let them go",
          detail: "Rebuild. It will take a year.",
          severity: -50,
          rep: { loyalty: -12, patients: -4 },
          result: "They left. The waiting room noticed before you did.",
        },
      ],
    },
  ],

  lawsuit: [
    {
      title: "A claim has been served",
      body: "Not a complaint this time — a claim, with a solicitor's letterhead and a schedule of loss.",
      choices: [
        {
          id: "defend",
          label: "Defend it properly",
          detail: "Counsel, an expert report, and months of your attention.",
          cost: 70_000,
          blocks: 1,
          severity: -25,
          rep: { credibility: 1 },
          next: 1,
          result: "You instructed counsel. The file is now four inches thick.",
        },
        {
          id: "settle",
          label: "Settle quietly",
          detail: "Pay, admit nothing, and hope it stays out of the register.",
          cost: 140_000,
          severity: -60,
          rep: { ethics: -3 },
          result: "Settled. No admission, no headline, and a number in your insurance history.",
        },
      ],
    },
    {
      title: "They have found your notes from the spring",
      body: "The documentation is thinner than you remembered. Your counsel would like to know whether anything else looks like this.",
      choices: [
        {
          id: "disclose",
          label: "Disclose everything",
          detail: "It will hurt. Concealment would end you.",
          severity: -35,
          rep: { ethics: 8, credibility: -4 },
          people: [
            { id: "hallam", respect: 8, trust: 6, why: "you disclosed rather than tidied" },
          ],
          result: "You handed over the lot. Counsel said it was the first sensible thing all month.",
        },
        {
          id: "minimise",
          label: "Disclose the minimum",
          detail: "Technically compliant. Not honest.",
          severity: -15,
          rep: { ethics: -10 },
          result: "You gave them what was asked and nothing else.",
        },
      ],
    },
    {
      title: "It is going to a hearing",
      body: "Public, listed, and the trade press have the date.",
      choices: [
        {
          id: "fight",
          label: "See it through",
          detail: "You believe you were right. It will cost either way.",
          cost: 110_000,
          severity: -60,
          rep: { credibility: -6, ethics: 4 },
          result: "Months of it. Whatever the finding, everyone in the region read the listing.",
        },
        {
          id: "capitulate",
          label: "Settle on the courthouse steps",
          detail: "The most expensive possible moment to do this.",
          cost: 220_000,
          severity: -60,
          rep: { credibility: -9, ethics: -4 },
          result: "Settled late and badly. Your insurer has questions about next year's premium.",
        },
      ],
    },
  ],

  inspection: [
    {
      title: "The inspection did not go well",
      body: "Three requirement notices and a follow-up visit inside twelve weeks.",
      choices: [
        {
          id: "fix",
          label: "Fix everything they found",
          detail: "Money and time, properly spent.",
          cost: 55_000,
          blocks: 2,
          severity: -35,
          rep: { ethics: 5, patients: 3 },
          next: 1,
          result: "You closed every notice. It cost a fortnight you did not have.",
        },
        {
          id: "paper",
          label: "Fix the paperwork",
          detail: "Cheaper. Addresses the findings, not the causes.",
          cost: 15_000,
          severity: -12,
          rep: { ethics: -4 },
          next: 2,
          result: "The file is immaculate. The ward is unchanged.",
        },
      ],
    },
    {
      title: "The follow-up visit is scheduled",
      body: "Same inspector. She remembers the last one.",
      choices: [
        {
          id: "open",
          label: "Show her everything",
          detail: "Including what is still not right.",
          severity: -45,
          rep: { ethics: 6, credibility: 2 },
          result: "She signed it off with two observations and no notices.",
        },
      ],
    },
    {
      title: "Conditions have been placed on your registration",
      body: "You may keep operating. There is now a published note saying under what terms.",
      choices: [
        {
          id: "comply",
          label: "Comply and rebuild",
          detail: "A year of being watched.",
          cost: 90_000,
          severity: -60,
          rep: { credibility: -8, ethics: 3, patients: -5 },
          result: "Conditions accepted. They come off eventually, and everyone remembers.",
        },
      ],
    },
  ],

  cashflow: [
    {
      title: "You cannot make payroll",
      body: "Friday is in four days and the account is short.",
      choices: [
        {
          id: "borrow",
          label: "Emergency facility",
          detail: "Expensive money, available today.",
          severity: -40,
          rep: { loyalty: 2 },
          result: "Drawn down at a rate you would not have accepted last month.",
        },
        {
          id: "delay",
          label: "Pay them late",
          detail: "Free, and it will be remembered for years.",
          severity: -10,
          rep: { loyalty: -18, ethics: -5 },
          people: [
            { id: "mbeki", warmth: -14, trust: -12, why: "payroll was late" },
            { id: "lindqvist", warmth: -10, trust: -8, why: "she had to tell them" },
          ],
          next: 1,
          result: "You told Elena to tell them. She did not enjoy it and neither did they.",
        },
        {
          id: "sell",
          label: "Sell something",
          detail: "Raise cash from the balance sheet at a bad price.",
          severity: -35,
          rep: { credibility: -2 },
          result: "Sold in a hurry, for what you get when you sell in a hurry.",
        },
      ],
    },
    {
      title: "It happened again",
      body: "The second late payroll in two months. People have started asking Elena whether the practice is in trouble.",
      choices: [
        {
          id: "level",
          label: "Tell them the truth",
          detail: "All of it, including the plan.",
          severity: -40,
          rep: { loyalty: 6, ethics: 6 },
          result: "You stood up and said it plainly. Two people offered to defer their own pay.",
        },
        {
          id: "quiet",
          label: "Say nothing",
          detail: "Hope it holds.",
          severity: 5,
          rep: { loyalty: -10 },
          next: 2,
          result: "You said nothing. The rumour filled the gap.",
        },
      ],
    },
    {
      title: "A supplier has put you on stop",
      body: "Word travels between finance departments faster than it does between clinicians. Two more accounts are asking for payment up front.",
      choices: [
        {
          id: "restructure",
          label: "Restructure everything",
          detail: "Renegotiate every account at once, from a weak position.",
          cost: 40_000,
          blocks: 2,
          severity: -55,
          rep: { credibility: -4, ethics: 3 },
          result:
            "Four weeks of phone calls. Everyone got paid something and nobody got paid everything.",
        },
        {
          id: "fire-sale",
          label: "Sell whatever will move",
          detail: "Raise cash immediately, at any price.",
          severity: -50,
          rep: { credibility: -7, loyalty: -6 },
          result:
            "You sold equipment you will need again in a year, for a fraction of what it cost.",
        },
      ],
    },
  ],

  dataleak: [
    {
      title: "Patient records have been exposed",
      body: "A misconfigured backup, open to anyone who knew where to look, for an unknown length of time.",
      choices: [
        {
          id: "notify",
          label: "Notify everyone immediately",
          detail: "Regulator, patients, press. Today.",
          cost: 45_000,
          severity: -35,
          rep: { ethics: 10, patients: -6, popularity: -5 },
          next: 1,
          result: "You told them before anyone asked. The coverage was bad and brief.",
        },
        {
          id: "assess",
          label: "Establish the scope first",
          detail: "Reasonable. Also the beginning of a cover-up if you are not careful.",
          severity: -10,
          rep: { ethics: -3 },
          next: 2,
          result: "Two weeks of forensics before anybody outside the building was told.",
        },
      ],
    },
    {
      title: "The regulator wants your incident log",
      body: "They have been complimentary about the speed of notification, which is not the same as being finished.",
      choices: [
        {
          id: "full",
          label: "Give them everything",
          detail: "Including the configuration change that caused it.",
          severity: -50,
          rep: { ethics: 6 },
          result: "Closed with an advisory. Nothing published.",
        },
      ],
    },
    {
      title: "A journalist has the story",
      body: "Priya Raman has the file, the dates, and the fact that you knew for two weeks.",
      choices: [
        {
          id: "oncomment",
          label: "Go on the record",
          detail: "Own the delay.",
          severity: -35,
          rep: { ethics: 4, popularity: -8, patients: -8 },
          people: [{ id: "raman", trust: 8, why: "you answered instead of hiding" }],
          result: "You gave her a straight answer. The piece ran and it was fair.",
        },
        {
          id: "nocomment",
          label: "Decline to comment",
          detail: "The piece runs anyway, with a photograph.",
          severity: -20,
          rep: { ethics: -6, popularity: -14, patients: -10 },
          people: [{ id: "raman", warmth: -10, trust: -8, why: "you refused to comment" }],
          result: "No comment. It ran on a Sunday, with the two-week gap in the standfirst.",
        },
      ],
    },
  ],

  scandal: [
    {
      title: "Something you did is being talked about",
      body: "Not illegal. Not defensible either, once it is written down in that order.",
      choices: [
        {
          id: "apologise",
          label: "Apologise properly",
          detail: "No qualifiers, no explanation of context.",
          severity: -35,
          rep: { ethics: 8, popularity: -4 },
          result: "A short statement with no 'but' in it. It worked better than the alternative.",
        },
        {
          id: "defend",
          label: "Defend yourself",
          detail: "You think you were right. Saying so will extend this.",
          severity: 8,
          rep: { popularity: -10, ethics: -4 },
          next: 1,
          result: "You explained. It became a second story about the explanation.",
        },
      ],
    },
    {
      title: "It has become the story about your explanation",
      body: "Nobody is discussing what happened any more.",
      choices: [
        {
          id: "stop",
          label: "Stop talking",
          detail: "Say nothing further and let it burn out.",
          severity: -30,
          rep: { popularity: -6 },
          result: "Silence, for eight weeks. It worked.",
        },
        {
          id: "third",
          label: "Commission an independent review",
          detail: "Expensive, slow, and it ends the argument.",
          cost: 80_000,
          severity: -55,
          rep: { ethics: 10, credibility: 3 },
          result: "You handed it to somebody with no reason to protect you. That was the point.",
        },
      ],
    },
    {
      title: "Your professional body has been asked to comment",
      body: "Not an investigation. A request for a comment, which is how one starts.",
      choices: [
        {
          id: "cooperate",
          label: "Go to them first",
          detail: "Walk in with the whole file before they ask for it.",
          blocks: 1,
          severity: -55,
          rep: { ethics: 12, credibility: -3 },
          people: [
            { id: "hallam", respect: 10, trust: 8, why: "you went to them before they came to you" },
          ],
          result:
            "You made the appointment yourself. They noted it, and that mattered more than anything you said.",
        },
        {
          id: "lawyer",
          label: "Answer through a solicitor",
          detail: "Correct, expensive, and it will read as something to hide.",
          cost: 65_000,
          severity: -35,
          rep: { ethics: -5, popularity: -6 },
          result: "Everything you said was accurate and none of it helped.",
        },
      ],
    },
  ],

  shortage: [
    {
      title: "The stock room is empty",
      body: "Your supplier has failed and there is nothing on the shelf for Monday.",
      choices: [
        {
          id: "spot",
          label: "Buy at spot price",
          detail: "Whatever it costs, today.",
          cost: 70_000,
          severity: -45,
          result: "Bought at a rate that would have been laughable a month ago.",
        },
        {
          id: "ration",
          label: "Ration and reschedule",
          detail: "Postpone anything that can wait. Patients will notice.",
          severity: -20,
          rep: { patients: -6 },
          next: 1,
          result: "Half the list moved. The phones did not stop.",
        },
      ],
    },
    {
      title: "The postponements are stacking up",
      body: "Three weeks of deferrals and the backlog is now the problem rather than the shortage.",
      choices: [
        {
          id: "catchup",
          label: "Run catch-up lists",
          detail: "Weekends. Everyone's weekends.",
          blocks: 2,
          severity: -45,
          rep: { patients: 5, loyalty: -6 },
          result: "You cleared it in a fortnight and nobody had a Saturday.",
        },
        {
          id: "refer",
          label: "Refer the backlog out",
          detail: "Someone else treats them. Someone else keeps them.",
          severity: -40,
          rep: { patients: -8, credibility: -3 },
          result:
            "You sent them to Meridian. Most of them did not come back.",
        },
      ],
    },
    {
      title: "Patients have started going elsewhere",
      body: "Six weeks of rescheduling and the waiting room is quieter than it should be. This is no longer a supply problem.",
      choices: [
        {
          id: "rebuild",
          label: "Win them back",
          detail: "Contact every deferred patient personally. It takes what it takes.",
          blocks: 2,
          severity: -55,
          rep: { patients: 10, loyalty: -4 },
          result:
            "Three hundred phone calls. About half of them came back, which was better than you expected.",
        },
        {
          id: "absorb",
          label: "Take the loss",
          detail: "Fix the supply chain and rebuild the panel slowly.",
          cost: 50_000,
          severity: -45,
          rep: { patients: -4 },
          result:
            "New supplier, better terms, and a panel that will take a year to recover.",
        },
      ],
    },
  ],
};

/**
 * The stages this crisis actually runs on.
 *
 * A career with its own set gets it; anybody else gets the Physician's, which
 * is what the whole system was until a second career needed one. Falling back
 * rather than throwing matters: a career may author three of the five kinds
 * and must still be able to receive the other two.
 */
const STAGE_SETS: Record<string, Partial<Record<CrisisKind, CrisisStage[]>>> = {
  lawyer: LAWYER_CRISIS_STAGES,
};

/**
 * The Physician's set, still exported under its old name.
 *
 * Several callers read it directly and none of them are wrong to: it is the
 * default set, and it is what a crisis with no career on it runs. Anything
 * that needs the set for a *specific* crisis should use `stagesFor`.
 */
export const CRISIS_STAGES = MEDICAL_STAGES;

export function stagesFor(kind: CrisisKind, careerId?: string): CrisisStage[] {
  const own = careerId ? STAGE_SETS[careerId]?.[kind] : undefined;
  return own ?? MEDICAL_STAGES[kind];
}

export const stageOf = (c: ActiveCrisis): CrisisStage => {
  const stages = stagesFor(c.kind, c.career);
  return stages[Math.min(Math.max(0, c.stage), stages.length - 1)];
};

export function severityWord(n: number): string {
  if (n >= 75) return "Critical";
  if (n >= 50) return "Serious";
  if (n >= 25) return "Contained";
  return "Nearly over";
}
