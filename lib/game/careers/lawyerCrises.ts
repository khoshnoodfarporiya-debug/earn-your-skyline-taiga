import type { CrisisKind, CrisisStage } from "../crisis";

/**
 * THE FIVE WAYS A PRACTICE COMES APART
 *
 * A crisis is a fortnight of decisions rather than a dialog, and the machinery
 * for that is career-neutral — severity, stages, neglect, escalation, all of it
 * in `crisis.ts`. What was never neutral is the *content*: the shipped stages
 * talk about nurses, wards and patient records, move reputation categories a
 * solicitor has no screen for, and name members of a medical cast. So the
 * shapes are shared and the words are not.
 *
 * ---------------------------------------------------------------- which five
 *
 * Two of the seven kinds are not things that happen to a law firm. There is no
 * `shortage` — a practice has no perishable stock — and `scandal` would only
 * be a second, blunter version of `dataleak`, which for a solicitor is already
 * the professional catastrophe. That leaves five, and each is a real fear of
 * the trade rather than a reskin:
 *
 *   lawsuit     a former client says you got it wrong, and has instructed
 *               somebody to prove it
 *   inspection  the regulator wants to see the client account
 *   walkout     an associate resigns, and the list goes with them
 *   cashflow    you cannot make Friday, while £200,000 sits in unpaid bills
 *   dataleak    privileged material reached the other side
 *
 * ------------------------------------------------------------- the choices
 *
 * Every choice moves something the simulation holds — cash, borrowing,
 * standing, blocks of next week, severity — and the words describe only what
 * actually happens. "Let somebody go" is not offered anywhere, because nobody
 * would actually leave the payroll, and a choice whose fiction outruns its
 * effect is the placeholder this codebase refuses to ship.
 *
 * Money is authored in London figures and localised at the point it is
 * charged, the same as every other sum in this career — see `localSum`.
 */

/** The kinds a practice can actually suffer. */
export const LAWYER_CRISIS_KINDS: readonly CrisisKind[] = [
  "lawsuit",
  "inspection",
  "walkout",
  "cashflow",
  "dataleak",
];

export const LAWYER_CRISIS_STAGES: Partial<Record<CrisisKind, CrisisStage[]>> = {
  /* --------------------------------------------------------------- lawsuit */
  lawsuit: [
    {
      title: "A former client has instructed somebody against you",
      body: "The letter of claim says the matter was settled below what it was worth and without proper authority. It is on your indemnity insurers' desk by Friday whatever you decide today.",
      choices: [
        {
          id: "notify",
          label: "Notify your insurers today",
          detail: "Next year's premium rises. The claim does not.",
          severity: -18,
          standing: -1,
          next: 1,
          result:
            "Reported the same afternoon. Your broker was almost pleased — it is the late ones that cost them.",
        },
        {
          id: "handle",
          label: "Answer it yourself first",
          detail: "Cheaper, if you are right about the file",
          severity: 9,
          next: 1,
          result:
            "You wrote back yourself, at length. The letter you sent is now also evidence.",
        },
        {
          id: "settle",
          label: "Offer to settle it now",
          detail: "Before anybody has to be told what it was about",
          cost: 14_000,
          severity: -38,
          standing: -2,
          result:
            "Paid quietly, at a figure that felt like an admission because it was one.",
        },
      ],
    },
    {
      title: "They have your file",
      body: "The correspondence is with their expert. Everything you did, and everything you did not write down, is now somebody else's reading.",
      choices: [
        {
          id: "reconstruct",
          label: "Reconstruct the attendance notes",
          detail: "Evenings with the file, rather than on the work",
          blocks: 1,
          severity: -22,
          result:
            "Two evenings with the file. The record is thinner than you remembered and honest, which is the best available combination.",
        },
        {
          id: "counsel",
          label: "Instruct counsel on the claim",
          detail: "Somebody whose job is being right about this",
          cost: 12_000,
          severity: -30,
          result:
            "Counsel's advice ran to three pages. The first paragraph was the only one you needed and you read it four times.",
        },
        {
          id: "concede",
          label: "Concede the point and negotiate",
          detail: "It costs less than being right slowly",
          cost: 26_000,
          severity: -48,
          standing: -3,
          result:
            "You gave them the point and argued about the number instead. It ended in a fortnight.",
        },
      ],
    },
    {
      title: "It is listed",
      body: "No more letters. A date, an expert on each side, and insurers taking a view about whether they want your renewal.",
      choices: [
        {
          id: "defend",
          label: "Defend it properly",
          detail: "Counsel, an expert, and time you do not have",
          cost: 22_000,
          blocks: 1,
          severity: -46,
          result:
            "You ran it. Whatever the outcome, the file will bear reading, which is the only thing you controlled.",
        },
        {
          id: "capitulate",
          label: "Pay what they asked for",
          detail: "All of it, today, and it is over",
          cost: 48_000,
          severity: -100,
          standing: -6,
          result:
            "You paid in full. It is the most expensive way this ends and it is the way that ends it.",
        },
      ],
    },
  ],

  /* ------------------------------------------------------------ inspection */
  inspection: [
    {
      title: "The regulator wants to see the client account",
      body: "A routine review, the letter says. They enclose a list of what they want and a date by which they want it, and the date is soon.",
      choices: [
        {
          id: "open",
          label: "Open the books completely",
          detail: "Nothing held back, and it takes what it takes",
          blocks: 1,
          severity: -24,
          standing: 1,
          next: 1,
          result:
            "You sent everything, including the things they had not asked for. Nobody has ever regretted that.",
        },
        {
          id: "minimum",
          label: "Send exactly what was asked for",
          detail: "Correct, and it reads as careful rather than open",
          severity: 5,
          next: 1,
          result:
            "You answered the letter and not a word more. They will write again, and their next letter will be longer.",
        },
        {
          id: "accountant",
          label: "Put an accountant on it",
          detail: "Somebody who does this for a living",
          cost: 9_000,
          severity: -32,
          next: 1,
          result:
            "The reconciliation came back in a fortnight and in a form they recognise. Money well spent, which is a sentence you rarely get to write.",
        },
      ],
    },
    {
      title: "They have found a shortfall",
      body: "Client money and office money have been closer together than they should have been. Not stolen — mixed. The distinction matters enormously to them and not at all to a headline.",
      choices: [
        {
          id: "replace",
          label: "Replace it today, out of your own money",
          detail: "The only answer that ends the question",
          cost: 20_000,
          severity: -44,
          result:
            "Paid in from the office account before close of business, with a note of the time.",
        },
        {
          id: "explain",
          label: "Reconcile it properly and explain",
          detail: "Go back through the ledgers properly",
          blocks: 1,
          severity: -18,
          result:
            "You went back eleven months and found where it started. The explanation is good. It is still an explanation.",
        },
        {
          id: "dispute",
          label: "Say their figure is wrong",
          detail: "It might be. They will now check everything",
          severity: 12,
          next: 2,
          result:
            "You disputed it. They have opened the scope of the review, which is what disputing it does.",
        },
      ],
    },
    {
      title: "They are talking about conditions",
      body: "Not a prohibition. Supervision, reporting, and somebody else signing off on the client account — for a period they will decide and you will not.",
      choices: [
        {
          id: "accept",
          label: "Accept the conditions",
          detail: "It ends today, and the profession hears about it",
          severity: -100,
          standing: -8,
          result:
            "You took the conditions. The practice carries on under somebody's eye, which is better than not carrying on.",
        },
        {
          id: "appeal",
          label: "Take advice and resist it",
          detail: "Counsel, and the time to answer it properly",
          cost: 18_000,
          blocks: 1,
          severity: -48,
          result:
            "You put in a proper response. It bought the argument a better shape than it had.",
        },
      ],
    },
  ],

  /* --------------------------------------------------------------- walkout */
  walkout: [
    {
      title: "An associate has handed in their notice",
      body: "Politely, on a Tuesday, with a firm across town named in the second paragraph. They have been running four of your files and know all of them better than you do.",
      choices: [
        {
          id: "match",
          label: "Match what they have been offered",
          detail: "A permanent rise, and they know you moved second",
          cost: 11_000,
          severity: -28,
          next: 1,
          result:
            "They stayed. The rise is on the payroll from now on and so is the memory of having asked.",
        },
        {
          id: "restrict",
          label: "Remind them of the restrictive covenant",
          detail: "Enforceable. Also memorable",
          severity: -12,
          standing: -2,
          next: 1,
          result:
            "You sent them the clause. They will go anyway and they will tell people how you handled it.",
        },
        {
          id: "letgo",
          label: "Wish them well",
          detail: "Nothing spent, nothing kept",
          severity: 11,
          next: 1,
          result:
            "You shook hands. The files are still on your books and the person who understood them is not.",
        },
      ],
    },
    {
      title: "The clients are being telephoned",
      body: "Nothing improper, and everybody involved knows exactly where the line is. Two of yours have already asked for their papers to be transferred.",
      choices: [
        {
          id: "ring",
          label: "Ring every client yourself",
          detail: "All of them, and no delegating it",
          blocks: 2,
          severity: -34,
          result:
            "You called all of them. Some were surprised to hear from you, which was the whole problem stated politely.",
        },
        {
          id: "undertaking",
          label: "Get undertakings from the new firm",
          detail: "Formal, and it stops the calls",
          cost: 6_000,
          severity: -22,
          result:
            "Undertakings given and acknowledged. The telephoning stopped that afternoon.",
        },
        {
          id: "wait",
          label: "Let the clients decide",
          detail: "They will",
          severity: 13,
          next: 2,
          result:
            "You said nothing to anybody. They decided.",
        },
      ],
    },
    {
      title: "A third of the book has gone",
      body: "Not the small matters. The ones with hours already in them, which are now hours already in somebody else's.",
      choices: [
        {
          id: "rebuild",
          label: "Go and win it back",
          detail: "Lunches and telephone calls, on nothing but this",
          blocks: 2,
          severity: -52,
          result:
            "A fortnight of lunches and telephone calls. You got some of it back and learned which of them were ever yours.",
        },
        {
          id: "buy",
          label: "Buy a book of work in",
          detail: "Somebody retiring will sell you their list",
          cost: 34_000,
          severity: -100,
          standing: -2,
          result:
            "You bought a retiring practitioner's files. It is not the same work and it is work.",
        },
      ],
    },
  ],

  /* -------------------------------------------------------------- cashflow */
  cashflow: [
    {
      title: "There is not enough in the office account for Friday",
      body: "Salaries, chambers, and the indemnity instalment, against money that is genuinely yours and genuinely not here. This is the career's whole premise arriving as a specific problem on a specific day.",
      choices: [
        {
          id: "borrow",
          label: "Borrow against the unpaid bills",
          detail: "The bank will lend on judgments. At their rate",
          debt: 22_000,
          severity: -34,
          next: 1,
          result:
            "The facility was agreed in a morning. It costs what borrowing costs, which is more than you would like and less than not paying people.",
        },
        {
          id: "chase",
          label: "Spend the week chasing every bill",
          detail: "Nothing else gets done while you do",
          blocks: 2,
          severity: -26,
          next: 1,
          result:
            "Two days on the telephone. Three of them paid, one apologised, and one has a process.",
        },
        {
          id: "defer",
          label: "Ask everybody to wait a week",
          detail: "They will. Once",
          severity: 7,
          standing: -2,
          next: 1,
          result:
            "Everyone agreed, pleasantly, and everyone noticed. Asking twice is a different conversation.",
        },
      ],
    },
    {
      title: "The landlord has written",
      body: "Formally, quoting the clause. Chambers is the one cost in this practice that does not care what a court has said about anything.",
      choices: [
        {
          id: "pay",
          label: "Pay the arrears",
          detail: "Whatever else waits, this does not",
          cost: 10_000,
          severity: -32,
          result: "Paid in full. The letter was not repeated.",
        },
        {
          id: "talk",
          label: "Go and see them",
          detail: "In person, and come away with an arrangement",
          blocks: 1,
          severity: -18,
          standing: -1,
          result:
            "You agreed a schedule over a cup of tea. It holds as long as you hold to it.",
        },
        {
          id: "ignore",
          label: "Leave it until something settles",
          detail: "Something might",
          severity: 14,
          next: 2,
          result:
            "You left it. The clause they quoted has a second part, and they quoted that next.",
        },
      ],
    },
    {
      title: "The bank has stopped the payments",
      body: "Not a warning. The standing orders went back this morning and everybody who was expecting money knows by lunchtime.",
      choices: [
        {
          id: "refinance",
          label: "Refinance the practice",
          detail: "A larger facility, secured on everything",
          debt: 42_000,
          severity: -100,
          standing: -4,
          result:
            "Refinanced. The practice is solvent, considerably more indebted, and still yours.",
        },
        {
          id: "trade",
          label: "Trade out of it",
          detail: "Be a debt collector until it is fixed",
          blocks: 3,
          severity: -58,
          result:
            "You spent the week being a debt collector rather than a solicitor. It worked, which is the least satisfying sentence in this file.",
        },
      ],
    },
  ],

  /* -------------------------------------------------------------- dataleak */
  dataleak: [
    {
      title: "The disclosure went out unredacted",
      body: "Everything. Including the advice on the weaknesses of your own client's case, now sitting in the inbox of the person it was written about.",
      choices: [
        {
          id: "tell",
          label: "Tell the client today",
          detail: "The worst meeting of the year, and the right one",
          blocks: 1,
          severity: -28,
          standing: 1,
          next: 1,
          result:
            "You told them before they could find out. They were furious and they stayed, in that order.",
        },
        {
          id: "recall",
          label: "Ask for it back and say nothing",
          detail: "They may return it. They have already read it",
          severity: 7,
          next: 1,
          result:
            "They returned it courteously and immediately, which told you they had read all of it.",
        },
        {
          id: "injunct",
          label: "Apply to restrain its use",
          detail: "Counsel, an application, and it is on a court file",
          cost: 15_000,
          severity: -36,
          next: 1,
          result:
            "The order was made. It restrains the use and not the knowledge, which is the part that mattered.",
        },
      ],
    },
    {
      title: "Your client has taken advice about you",
      body: "From somebody else. That is not a threat, exactly — it is what a careful client does, and yours has just been reminded what careful means.",
      choices: [
        {
          id: "insurers",
          label: "Put your insurers on notice",
          detail: "Early, which is the only way they like it",
          severity: -22,
          standing: -1,
          result:
            "Notified. Nothing has been claimed and everything has been recorded.",
        },
        {
          id: "meet",
          label: "See them in person",
          detail: "No telephone, no letter. Across a table",
          blocks: 1,
          severity: -30,
          result:
            "Ninety minutes across a table. You did not defend it and that is why it worked.",
        },
        {
          id: "deny",
          label: "Maintain that no harm was done",
          detail: "It might even be true",
          severity: 13,
          next: 2,
          result:
            "You held the line. They asked for the file to be sent to their new solicitors on Thursday.",
        },
      ],
    },
    {
      title: "It has been reported to the regulator",
      body: "By the client, as they are entitled to do, with a copy of the covering email in which the material was sent.",
      choices: [
        {
          id: "cooperate",
          label: "Cooperate completely",
          detail: "A full account, including your own failings",
          blocks: 2,
          severity: -50,
          standing: -4,
          result:
            "You gave them everything and a timeline of your own failings. It is the answer that ends soonest.",
        },
        {
          id: "represented",
          label: "Be represented properly",
          detail: "Somebody who does regulatory work, and it is over",
          cost: 21_000,
          severity: -100,
          standing: -2,
          result:
            "You instructed somebody who does this every week. The response was three pages and it closed the file.",
        },
      ],
    },
  ],
};

/**
 * How likely a practice is to fall into one of these, and which.
 *
 * The Physician's `crisisRisk` reads culture, malpractice risk, regulation and
 * supply cover — four things a law firm does not have. Every term here is
 * something the player controls, which is what makes running a careful
 * practice a strategy rather than a mood. The base rate is small and non-zero:
 * no amount of care makes you immune.
 */
export function practiceCrisisRisk(ctx: {
  week: number;
  /** Weeks of standing costs the office account currently covers. */
  cashWeeks: number;
  /** Matters lost at a hearing in the recent record. */
  lost: number;
  /** Hearings within three weeks that are short of their hours. */
  unprepared: number;
  /** Matters taken against a former client. */
  conflicted: number;
  /** How closely the profession is reading you. */
  scrutiny: number;
  staff: number;
  burnout: number;
}): { chance: number; kind: CrisisKind | null; drivers: string[] } {
  const drivers: string[] = [];
  const weights: [CrisisKind, number][] = [];

  /*
   * Clamped, and the clamp is the whole difference between a system and a
   * spiral.
   *
   * Unbounded, a practice fifty weeks overdrawn scored (3 − −50) × 0.022 and
   * pinned the weekly chance at its ceiling for ever: a cash emergency every
   * six weeks, each one charging a neglect penalty that made the next one
   * likelier. A simulation of 120 weeks came out at 101 of them overdrawn in
   * every market. Being short of money should raise the odds and must not be
   * able to raise them without limit, because the thing it is raising is the
   * odds of getting shorter of money.
   */
  if (ctx.cashWeeks < 3) {
    weights.push(["cashflow", Math.min(3, 3 - ctx.cashWeeks) * 0.022]);
    drivers.push("thin cash against work already done");
  }
  if (ctx.lost > 0 || ctx.unprepared > 0) {
    weights.push(["lawsuit", ctx.lost * 0.005 + ctx.unprepared * 0.012]);
    drivers.push(
      ctx.unprepared > 0 ? "matters reaching a date short of hours" : "recent losses",
    );
  }
  if (ctx.conflicted > 0) {
    weights.push(["inspection", ctx.conflicted * 0.02]);
    drivers.push("acting against former clients");
  }
  if (ctx.scrutiny > 40) {
    weights.push(["dataleak", (ctx.scrutiny - 40) * 0.0016]);
    drivers.push("how closely you are being read");
  }
  /* Nobody resigns from a practice of one, and nobody resigns from a calm
     one — this is the cost of running the people around you the way the
     burnout meter says you are running yourself. */
  if (ctx.staff >= 1 && ctx.burnout > 65) {
    weights.push(["walkout", (ctx.burnout - 65) * 0.0032]);
    drivers.push("the hours everybody here is working");
  }

  const total = weights.reduce((n, [, w]) => n + w, 0);
  const chance = Math.min(0.16, 0.006 + total);

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
