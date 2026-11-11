import type { Rng } from "../types";
import type {
  FeedPost,
  NewsItem,
  PhoneState,
  PostEffect,
} from "../medical/types";
import { MAX_FEED, MAX_MESSAGES, MAX_NEWS } from "../medical/phone";
import {
  CASE_BY_ID,
  MAX_PRESSURE,
  hoursNeededFor,
  billsOwed,
  legalCityOf,
  settlementFor,
  workInProgress,
  type PracticeState,
  type Verdict,
} from "./casework";

/**
 * THE SOLICITOR'S PHONE
 *
 * Same handset, different profession. The *shapes* here — `PhoneState`,
 * `FeedPost`, `PhoneMessage`, `NewsItem` — are career-neutral and shared with
 * the Physician and the Chef (they live in `medical/types.ts` for historical
 * reasons; nothing in them is medical). Everything with *words* in it is this
 * file's, because a solicitor's phone is full of opposing counsel, listing
 * offices and costs draftsmen, not suppliers and critics.
 *
 * ------------------------------------------------------------ ground rules
 *
 * The feed never contradicts the simulation. A verdict is only reported after
 * a case that genuinely resolved, and its tone is computed from the same
 * result the ledger line came from. An adjournment is only in the news when
 * the court actually moved a date. The phone is how the week *sounds*; it is
 * never a second simulation.
 *
 * Generation is deterministic: everything is drawn from the seeded stream the
 * career passes in, so the same run always produces the same phone.
 */

/* ------------------------------------------------------------ the accounts */

/**
 * Who talks in this profession. All fictional, and none of them shared with
 * the Physician's or the Chef's world — a different career follows different
 * people, and a name appearing on two handsets would make both of them
 * furniture.
 */
export const LEGAL_VOICES = {
  mentor: { name: "Margaret Ellory", handle: "@m.ellory" },
  opponent: { name: "Julian Farrow", handle: "@farrow_defence" },
  press: { name: "The Law Report", handle: "@thelawreport" },
  costs: { name: "Derek Oyelaran", handle: "@oyelaran_costs" },
  recruiter: { name: "Fenwick Legal", handle: "@fenwick_legal" },
  regulator: { name: "The Standards Board", handle: "@standardsboard" },
  listings: { name: "The Cause List", handle: "@causelist" },
} as const;

/** Accounts that are institutions, for the Avatar's rounded treatment. */
export const LEGAL_ORG_HANDLES = [
  "@thelawreport",
  "@fenwick_legal",
  "@standardsboard",
  "@causelist",
] as const;

/** Outlets that carry the week. Named so the record reads as a profession. */
const OUTLETS = [
  "The Law Report",
  "Chancery Lane Daily",
  "The Practice Bulletin",
] as const;

/* -------------------------------------------------------------- the start */

export function lawyerInitialPhone(): PhoneState {
  return {
    social: { followers: 90, trust: 52, sentiment: 50, scrutiny: 0 },
    feed: [],
    messages: [
      {
        id: "welcome",
        week: 1,
        from: LEGAL_VOICES.mentor.name,
        handle: LEGAL_VOICES.mentor.handle,
        role: "peer",
        body: "You have your certificate and a room. Two things nobody told me: the work is not the money, and the rent does not wait for a judgment. Take the small ones while you build the big ones, and never fall in love with a file.",
        read: false,
      },
    ],
    news: [],
    lastPostWeek: 0,
    postsMade: [],
    recruitBoost: 0,
  };
}

/**
 * The phone, created on first touch so a save from before it existed gains
 * one instead of being rejected.
 */
export function ensureLawyerPhone(p: PracticeState): PhoneState {
  if (!p.phone) p.phone = lawyerInitialPhone();
  return p.phone;
}

export const canPostLawyerWeek = (p: PracticeState, week: number): boolean =>
  (p.phone?.lastPostWeek ?? 0) < week;

/* ---------------------------------------------------------------- identity */

/**
 * What your standing reads as, in the profession's own words. The Physician's
 * version talks about waiting rooms and the Chef's about tables; a solicitor
 * is known for the work they are *sent*, which is the thing this career's
 * reputation actually gates.
 */
export function lawyerIdentityOf(social: PhoneState["social"]): {
  label: string;
  blurb: string;
} {
  const { followers, trust, sentiment, scrutiny } = social;
  if (followers < 250 && trust <= 58) {
    return {
      label: "A name on a door",
      blurb:
        "Nobody has heard of you, so nobody sends you anything worth having yet.",
    };
  }
  if (scrutiny >= 55 && followers > 2_000) {
    return {
      label: "The one in the papers",
      blurb:
        "Everybody has a view on how you run a file, including people who have never opened one.",
    };
  }
  if (trust >= 72 && sentiment >= 60) {
    return {
      label: "A safe pair of hands",
      blurb:
        "Other solicitors send you the matters they would rather not carry. That is the whole compliment.",
    };
  }
  if (followers >= 3_500) {
    return {
      label: "The firm people ring first",
      blurb:
        "The phone goes before the advertisement does. Keeping it that way is the work.",
    };
  }
  return {
    label: "A practice with a list",
    blurb:
      "Known to the people who have used you, unknown to everybody else. Every judgment helps.",
  };
}

/* ------------------------------------------------------------ the composer */

export interface LawyerPostContext {
  week: number;
  cityName: string;
  /** Files currently on the books. */
  liveCount: number;
  /** The biggest thing you are carrying, by what it bills. */
  biggestLive: string | null;
  /** Something you have won and not yet talked about. */
  lastWin: string | null;
  /** Something you settled. */
  lastSettled: string | null;
  /** The other side's costs, most recently paid. */
  lastCosts: number;
  staffCount: number;
  /** Judgments waiting to become money. */
  owed: number;
  /** Hours in files that have not resolved. */
  unbilled: number;
  followers: number;
  /** How much publicity is already priced into what they will offer. */
  pressure: number;
  /** Extra tries at the door still running from something you published. */
  echo: number;
}

/**
 * What a post does to the *practice*, as opposed to the phone.
 *
 * The social half is `effect` and goes through `applySocial` exactly as the
 * other two careers' do. This half is the Solicitor's own, and it is where the
 * trade lives:
 *
 *   `instructions`  extra tries at an instruction in the door, for a week or
 *                   two — which is the only thing that fills a pipeline other
 *                   than spending a block of your week pitching
 *   `pressure`      what the other side will pay to make a live case go away.
 *                   A matter that is being written about is worth more to end
 *                   quietly, and the effect decays as fast as attention does
 *   `standing`      the gate on how large an instruction you are ever offered
 */
export interface LawyerPostEffect {
  instructions?: number;
  pressure?: number;
  standing?: number;
}

export interface LawyerPostDef {
  id: string;
  category: string;
  label: string;
  blurb: string;
  body: (c: LawyerPostContext) => string;
  available: (c: LawyerPostContext) => boolean;
  once?: boolean;
  hazard?: number;
  effect: PostEffect;
  /** The practice-side effect. Absent means the post is only social. */
  law?: LawyerPostEffect;
  preview: string[];
  backfire?: { effect: PostEffect; note: string };
}

/** The most recent verdict matching a shape, as a case label. */
const labelOf = (v: Verdict | undefined): string | null =>
  v ? (CASE_BY_ID.get(v.kind)?.label ?? null) : null;

export function lawyerPostContext(
  p: PracticeState,
  week: number,
): LawyerPostContext {
  const recent = [...p.lastVerdicts].reverse();
  const biggest = [...p.cases]
    .map((c) => CASE_BY_ID.get(c.kind))
    .filter((k): k is NonNullable<typeof k> => Boolean(k))
    .sort((a, b) => b.fee - a.fee)[0];

  return {
    week,
    cityName: legalCityOf(p).name,
    liveCount: p.cases.length,
    biggestLive: biggest?.label ?? null,
    lastWin: labelOf(recent.find((v) => v.won && !v.settled)),
    lastSettled: labelOf(recent.find((v) => v.settled)),
    lastCosts: recent.find((v) => (v.costs ?? 0) > 0)?.costs ?? 0,
    staffCount: p.staff.length,
    owed: billsOwed(p),
    unbilled: Math.round(workInProgress(p)),
    followers: p.phone?.social.followers ?? 0,
    pressure: p.pressure ?? 0,
    echo: p.echo ?? 0,
  };
}

/** Whether publicity is already doing as much as it is going to. */
export const lawyerPressureLine = (c: LawyerPostContext): string | null =>
  c.pressure <= 0.005
    ? null
    : `The other side is paying about ${Math.round(c.pressure * 100)}% more to end things quietly while this is being read.`;

/** Whether something you published is still bringing work to the door. */
export const lawyerEchoLine = (c: LawyerPostContext): string | null =>
  c.echo <= 0
    ? null
    : `${c.echo} extra ${c.echo === 1 ? "approach" : "approaches"} still coming in from what you published.`;

/**
 * WHAT IS WORTH SAYING
 *
 * Seven, each gated on a fact about the practice rather than on a week
 * number, so the composer can never offer "we won" to a firm that has never
 * won anything. Two of them cost something real: publicising a live matter
 * risks the regulator, and both the big reach posts raise scrutiny, which is
 * what being watched means in this career.
 */
export const LEGAL_POSTS: LawyerPostDef[] = [
  {
    id: "doors_open",
    category: "the practice",
    label: "The doors are open",
    blurb: "Say you exist. Somebody has to be first to know.",
    body: (c) =>
      `New practice, ${c.cityName}. Small matters and large ones, and I will tell you honestly which yours is before you instruct me.`,
    available: (c) => c.week <= 10,
    once: true,
    effect: { followers: 45, trust: 2 },
    law: { instructions: 1 },
    preview: [
      "+45 followers, +2 trust",
      "One extra approach in the door next week",
    ],
  },
  {
    id: "case_won",
    category: "the work",
    label: "A judgment went our way",
    blurb: "The plainest thing a practice can say, and the most persuasive.",
    body: (c) =>
      `Judgment for our client this week — ${(c.lastWin ?? "the matter").toLowerCase()}. Four months of work that was worth nothing at all until Tuesday afternoon. That is the trade.`,
    available: (c) => c.lastWin !== null,
    effect: { followers: 70, trust: 4, sentiment: 3 },
    law: { instructions: 1, standing: 0.8 },
    preview: [
      "+70 followers, +4 trust, +3 sentiment",
      "+0.8 standing, and an extra approach next week",
    ],
  },
  {
    id: "press_the_case",
    category: "the work",
    label: "Take it to the press",
    blurb:
      "Put a live matter in front of people. It is worth more to them to make it go away.",
    body: (c) =>
      `We are acting on ${(c.biggestLive ?? "a matter").toLowerCase()} and the other side would rather you did not read about it. So: read about it.`,
    available: (c) => c.liveCount > 0,
    hazard: 0.28,
    effect: { followers: 160, sentiment: 2, scrutiny: 9 },
    law: { pressure: 0.09 },
    preview: [
      "+160 followers, +9 scrutiny",
      "The other side pays ~9% more to settle, falling away each week",
      "A live matter is a live matter — this can be held against you",
    ],
    backfire: {
      effect: { followers: 120, trust: -7, scrutiny: 16 },
      note: "You will want to check what you are permitted to say about a matter that is still live. I would.",
    },
  },
  {
    id: "note_on_the_law",
    category: "opinion",
    label: "A note on the law",
    blurb:
      "The technical point nobody else has written up. Other solicitors read these.",
    body: () =>
      `A short note on a point that keeps costing people money: the deadline everybody treats as guidance is a deadline, and the correspondence file is what decides it. Happy to send the authorities to anyone who wants them.`,
    available: (c) => c.week >= 4,
    effect: { followers: 30, trust: 5 },
    law: { instructions: 1 },
    preview: ["+30 followers, +5 trust", "An extra approach in the door"],
  },
  {
    id: "on_costs",
    category: "opinion",
    label: "What losing actually costs",
    blurb:
      "Write up the costs order you just paid. Unflattering, and it brings people in.",
    body: () =>
      `We lost one, and then we paid for the other side's solicitors as well as our own. Nobody warns you about that line. If you are deciding whether to run a matter to the door, that is the number to put next to it.`,
    available: (c) => c.lastCosts > 0,
    effect: { followers: 55, trust: 6, sentiment: -2 },
    law: { instructions: 1 },
    preview: [
      "+55 followers, +6 trust, −2 sentiment",
      "An extra approach in the door",
    ],
  },
  {
    id: "the_firm_grows",
    category: "the practice",
    label: "Somebody has joined",
    blurb: "A firm with more than one person in it is a different proposition.",
    body: (c) =>
      `${c.staffCount === 1 ? "There are two of us now" : `There are ${c.staffCount + 1} of us now`}. It stopped being a desk and started being a practice somewhere in the last few months and I did not notice when.`,
    available: (c) => c.staffCount >= 1,
    once: true,
    effect: { followers: 50, trust: 3 },
    law: { standing: 1.2 },
    preview: ["+50 followers, +3 trust", "+1.2 standing"],
  },
  {
    id: "what_this_market_sends",
    category: "opinion",
    label: "What this city sends a solicitor",
    blurb:
      "An honest piece about the work that exists here. It travels further than it should.",
    body: (c) =>
      `Practising in ${c.cityName}: here is what actually comes through the door, what it pays, and what it never sends you however good you get. Written for whoever is deciding where to start.`,
    available: (c) => c.week >= 12,
    effect: { followers: 120, trust: 2, scrutiny: 3 },
    law: { instructions: 2 },
    preview: [
      "+120 followers, +2 trust, +3 scrutiny",
      "Two extra approaches in the door",
    ],
  },
];

export const LEGAL_POST_BY_ID = new Map(LEGAL_POSTS.map((p) => [p.id, p]));

/* --------------------------------------------------------------- the week */

const push = <T,>(list: T[], item: T, cap: number): T[] =>
  [item, ...list].slice(0, cap);

/**
 * Everything that happened this week which the phone is allowed to talk
 * about. Assembled by `resolveWeek` from the things it actually did, and
 * handed over — so there is no path by which the handset can report an event
 * the simulation did not produce.
 */
export interface PracticeWeek {
  verdicts: Verdict[];
  /** Hearings the court moved, with how far. */
  relisted: { client: string; kind: string; weeks: number }[];
  /** Judgments that turned into money, and any that had to be written down. */
  billsPaid: { client: string; amount: number; writtenDown: boolean }[];
  /** The other side's costs paid this week. */
  costsPaid: number;
  /** True when a conflicted matter was noticed by the regulator. */
  conflictRaised: boolean;
}

/**
 * What the profession says and sends this week.
 *
 * Called at the end of `resolveWeek`, after every verdict, adjournment and
 * bill has been written, so nothing here can precede the fact it reports.
 * Draws only from the stream it is handed, so the phone is as replayable as
 * the ledger.
 */
export function generateLawyerWeek(
  p: PracticeState,
  week: number,
  reputation: number,
  skill: number,
  /**
   * What Julian Farrow adds to an offer he did not have to make.
   *
   * He is a person now rather than a handle — see `lawyerCast.ts` — and a
   * barrister who rates you opens higher, because he expects to have to. Zero
   * for a practice he has never heard of, which is most of them.
   */
  goodwill: number,
  facts: PracticeWeek,
  rng: Rng,
): void {
  const phone = ensureLawyerPhone(p);
  const outlet = rng.pick([...OUTLETS]);

  /* ------------------------------------------------ verdicts that happened */
  const decided = facts.verdicts.filter((v) => !v.settled);
  if (decided.length > 0) {
    const won = decided.filter((v) => v.won).length;
    const tone: FeedPost["tone"] =
      won === decided.length ? "good" : won === 0 ? "bad" : "neutral";
    const first = CASE_BY_ID.get(decided[0].kind);

    phone.feed = push(
      phone.feed,
      {
        id: `verdict-${week}`,
        week,
        author: LEGAL_VOICES.press.name,
        handle: LEGAL_VOICES.press.handle,
        kind: "world",
        body:
          tone === "good"
            ? `Judgment handed down in ${(first?.label ?? "a matter").toLowerCase()}. A small practice takes one it was not obviously going to take.`
            : tone === "bad"
              ? `Judgment against in ${(first?.label ?? "a matter").toLowerCase()}. Months of preparation, and costs to follow. This happens more than the profession likes to print.`
              : `A mixed list this week — ${won} of ${decided.length} went the way they were argued.`,
        likes: Math.round(5 + phone.social.followers / 70 + 8 * rng.next()),
        comments: [],
        tone,
      },
      MAX_FEED,
    );

    /*
     * The phone's own metrics move here, never reputation — the verdict
     * already moved that. Scrutiny amplifies the bad ones, which is the
     * mechanical meaning of being watched.
     */
    const watch = 1 + phone.social.scrutiny / 100;
    if (tone === "good") {
      phone.social.followers += Math.round(25 + 40 * rng.next());
      phone.social.trust = Math.min(100, phone.social.trust + 2);
    } else if (tone === "bad") {
      phone.social.trust = Math.max(0, phone.social.trust - 2 * watch);
      phone.social.sentiment = Math.max(
        0,
        phone.social.sentiment - 3 * watch,
      );
    }

    phone.news = push(
      phone.news,
      {
        id: `n-verdict-${week}`,
        week,
        outlet,
        headline:
          tone === "good"
            ? "Judgment for claimant in local matter"
            : tone === "bad"
              ? "Costs follow the event in contested claim"
              : "Mixed list at the county court",
        body:
          tone === "bad"
            ? "The unsuccessful party will pay the other side's costs, as is ordinary. Practitioners are reminded that the sum is assessed on the papers unless argued."
            : "Reporting restrictions do not apply. The judgment is expected to be published in the usual place within the month.",
        tone,
        read: false,
      },
      MAX_NEWS,
    );
  }

  /* -------------------------------------------- the court moving your dates */
  if (facts.relisted.length > 0) {
    const r = facts.relisted[0];
    phone.news = push(
      phone.news,
      {
        id: `n-relist-${week}-${r.client.replace(/\W/g, "").slice(0, 8)}`,
        week,
        outlet: LEGAL_VOICES.listings.name,
        headline: `Relisted: ${r.client}, put back ${r.weeks} weeks`,
        body: "The list was over-set and the shorter matters were reached first. No criticism of the parties is intended and none should be inferred.",
        tone: "bad",
        read: false,
      },
      MAX_NEWS,
    );
  }

  /* ------------------------------------------------- money that finally came */
  for (const b of facts.billsPaid.filter((x) => x.writtenDown)) {
    phone.news = push(
      phone.news,
      {
        id: `n-writedown-${week}-${b.client.replace(/\W/g, "").slice(0, 8)}`,
        week,
        outlet,
        headline: `${b.client} settles its account at a discount`,
        body: "A judgment is not a payment. Firms carrying long ledgers are advised that recovery, not entitlement, is what pays the rent.",
        tone: "bad",
        read: false,
      },
      MAX_NEWS,
    );
  }

  /* -------------------------------------------------- one message, at most */
  const hasMsg = (id: string) => phone.messages.some((x) => x.id === id);

  /*
   * An offer from the other side on a matter you have genuinely worked.
   *
   * Gated on the file being past the point where an offer would be made —
   * nobody offers to buy off a case nobody has prepared — and the figure is
   * carried in the id so that answering pays exactly what was quoted rather
   * than whatever the number has drifted to since.
   */
  const ripe = p.cases.find((c) => {
    const k = CASE_BY_ID.get(c.kind);
    if (!k) return false;
    if (c.hoursDone < hoursNeededFor(p, k) * 0.6) return false;
    return !phone.messages.some((m) => m.id.startsWith(`offer-${c.id}-`));
  });

  if (facts.conflictRaised) {
    phone.messages = push(
      phone.messages,
      {
        id: `conflict-${week}`,
        week,
        from: LEGAL_VOICES.regulator.name,
        handle: LEGAL_VOICES.regulator.handle,
        role: "regulator",
        body: "We have been asked to look at a matter in which your firm acted against a former client. We are not making a finding today. We are writing so that you know the file has been read.",
        read: false,
      },
      MAX_MESSAGES,
    );
  } else if (facts.costsPaid > 0 && !hasMsg(`costs-${week}`)) {
    phone.messages = push(
      phone.messages,
      {
        id: `costs-${week}`,
        week,
        from: LEGAL_VOICES.costs.name,
        handle: LEGAL_VOICES.costs.handle,
        role: "staff",
        body: "I have their bill of costs. It is, as ever, optimistic. I can argue it down, or you can pay it and put the week behind you — some firms would rather not have the argument on the file.",
        read: false,
        choices: [
          {
            label: "Argue it",
            detail: "It reads as a practice that checks. Trust rises",
            effect: { trust: 3 },
            reply:
              "You went through it line by line. They withdrew about a fifth of it without saying so.",
          },
          {
            label: "Pay it and move on",
            detail: "Nothing said, nothing gained",
            effect: {},
            reply:
              "You paid it the same afternoon. There is something to be said for a clean file.",
          },
        ],
      },
      MAX_MESSAGES,
    );
  } else if (ripe) {
    const quoted = Math.round(settlementFor(ripe, p, skill) * (1 + goodwill));
    phone.messages = push(
      phone.messages,
      {
        id: `offer-${ripe.id}-${quoted}`,
        week,
        from: LEGAL_VOICES.opponent.name,
        handle: LEGAL_VOICES.opponent.handle,
        role: "rival",
        body: `We are instructed to make an offer on ${ripe.client}. It is open until it is not, and you know as well as I do what a listed hearing does to a small practice's cash flow.`,
        read: false,
        choices: [
          {
            label: "Accept",
            detail: "Certain money now, and no costs risk",
            effect: {},
            reply:
              "Accepted by return. Nobody is delighted, which is what a settlement is.",
          },
          {
            label: "We will see you there",
            detail: "The matter runs on",
            effect: { trust: 1 },
            reply:
              "You declined in one line. He will have expected that and offered anyway.",
          },
        ],
      },
      MAX_MESSAGES,
    );
  } else if (reputation >= 42 && !hasMsg("recruit-1")) {
    phone.messages = push(
      phone.messages,
      {
        id: "recruit-1",
        week,
        from: LEGAL_VOICES.recruiter.name,
        handle: LEGAL_VOICES.recruiter.handle,
        role: "recruiter",
        body: "Your name is coming up. We have people who would take a seat with a practice that is winning things, and they are cheaper than you would guess before they have a reputation of their own.",
        read: false,
      },
      MAX_MESSAGES,
    );
  } else if (phone.social.scrutiny >= 45 && !hasMsg(`watched-${week}`)) {
    phone.messages = push(
      phone.messages,
      {
        id: `watched-${week}`,
        week,
        from: LEGAL_VOICES.mentor.name,
        handle: LEGAL_VOICES.mentor.handle,
        role: "peer",
        body: "You are being read now. That is not a compliment and it is not a problem — it only means the next thing you say about a live matter will be read by somebody who is looking for a reason.",
        read: false,
      },
      MAX_MESSAGES,
    );
  }
}

/**
 * The publicity a post bought, one week older.
 *
 * Called once a week. Attention decays faster than anything else in this
 * career, which is what stops "take it to the press" being a permanent uplift
 * on every settlement the firm ever negotiates.
 */
export function decayPressure(p: PracticeState): void {
  const next = (p.pressure ?? 0) * 0.6;
  p.pressure = next < 0.004 ? 0 : Math.round(next * 1000) / 1000;
  p.echo = Math.max(0, (p.echo ?? 0) - 1);
}

/** The ceiling, restated where the composer can reach it. */
export const pressureCap = (): number => MAX_PRESSURE;

/** A news item's shape, for anything that needs to build one outside here. */
export type LegalNews = NewsItem;
