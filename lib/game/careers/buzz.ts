import type { Rng } from "../types";
import type { KitchenState } from "./kitchen";
import type { StandingId } from "./standing";

/**
 * REACH, EXPECTATIONS, AND WHAT HAPPENS WHEN IT GOES WRONG
 *
 * The phone had followers and a sentiment score, and both of them were
 * scenery: nothing in the restaurant read either number. This is the layer
 * that makes posting a decision with a cost.
 *
 * ------------------------------------------------------------- the trade
 *
 * Every mechanic here exists to make one point: **attention is a loan**.
 *
 *   `interest`     people who want a table because of something you said.
 *                  Decays weekly. This is the upside, and it is real money.
 *
 *   `expectation`  how good the night now has to be to count as good. Raised
 *                  by every promise you make and every review you get, decays
 *                  slowly, and is subtracted from what the room thinks of an
 *                  ordinary night. This is the price, and it is paid later.
 *
 *   `fatigue`      posting three weeks running reaches fewer people each time.
 *                  Not a punishment — an audience that has heard from you
 *                  every week stops looking, which is the actual behaviour of
 *                  every feed anybody has ever used.
 *
 * A player who promotes hard and cooks well is rewarded twice. A player who
 * promotes hard and cooks adequately ends up with a full room of people who
 * were told to expect better, which is the single most expensive mistake a
 * restaurant can make and was previously impossible to make here.
 */

export interface BuzzState {
  /** Extra covers wanting a table, as a multiplier above 1. Decays. */
  interest: number;
  /** How much higher the bar is than it would otherwise be, 0–30. Decays. */
  expectation: number;
  /** Weeks a post was published, newest first. Bounded. */
  postWeeks: number[];
  /** Dishes currently being promoted, and until when. */
  promoted: { recipe: string; until: number; weight: number }[];
  /** Promises made that the kitchen has not yet lived up to. */
  claims: { week: number; about: StandingId; size: number }[];
}

export const MAX_POST_WEEKS = 8;
export const MAX_CLAIMS = 6;

export const emptyBuzz = (): BuzzState => ({
  interest: 1,
  expectation: 0,
  postWeeks: [],
  promoted: [],
  claims: [],
});

/** The buzz state, created on first touch so an old save gains one. */
export function ensureBuzz(k: KitchenState): BuzzState {
  if (!k.buzz) k.buzz = emptyBuzz();
  return k.buzz;
}

export const interestOf = (k: KitchenState): number =>
  Math.max(1, Math.min(1.45, k.buzz?.interest ?? 1));

export const expectationOf = (k: KitchenState): number =>
  Math.max(0, Math.min(30, k.buzz?.expectation ?? 0));

/**
 * How much of a post actually lands, given how recently you last posted.
 *
 * One post in the last three weeks reaches everybody. Three reaches about
 * half. It recovers as soon as you stop.
 */
export function reachFactor(k: KitchenState, week: number): number {
  const recent = (k.buzz?.postWeeks ?? []).filter((w) => w > week - 4).length;
  if (recent <= 0) return 1;
  return Math.max(0.4, 1 - recent * 0.2);
}

/** In words, for the composer. */
export function reachWord(factor: number): string {
  if (factor >= 0.95) return "Your feed is rested — this will travel.";
  if (factor >= 0.75) return "You posted recently; a little less of this will land.";
  if (factor >= 0.55) return "Three posts in a month. People have started scrolling past.";
  return "You are posting constantly and it shows — most of this reaches nobody.";
}

/**
 * Engagement: how much of your following is actually listening.
 *
 * Real followers who respond, rather than a total. Falls with posting
 * fatigue, rises with sentiment. What the profile screen shows instead of a
 * vanity number on its own.
 */
export function engagementOf(
  followers: number,
  sentiment: number,
  reach: number,
): number {
  return Math.round(followers * reach * (0.03 + (sentiment / 100) * 0.07));
}

/* ------------------------------------------------------------ the week */

/**
 * Interest and expectations decay, and promotions run out.
 *
 * Called once per resolved week, before the night is judged, so a promotion
 * bought last week is still working this week and gone the week after.
 */
export function decayBuzz(k: KitchenState, week: number): void {
  const buzz = ensureBuzz(k);
  buzz.interest = Math.max(1, 1 + (buzz.interest - 1) * 0.62);
  buzz.expectation = Math.max(0, buzz.expectation * 0.82);
  buzz.promoted = buzz.promoted.filter((p) => p.until >= week);
  buzz.claims = buzz.claims.filter((c) => c.week > week - 8).slice(0, MAX_CLAIMS);
  buzz.postWeeks = buzz.postWeeks.filter((w) => w > week - MAX_POST_WEEKS);
}

/** Record a post, so fatigue and the claim register both know about it. */
export function notePost(
  k: KitchenState,
  week: number,
  effect: {
    interest?: number;
    expectation?: number;
    promote?: string;
    claim?: { about: StandingId; size: number };
  },
): void {
  const buzz = ensureBuzz(k);
  buzz.postWeeks = [week, ...buzz.postWeeks].slice(0, MAX_POST_WEEKS);
  if (effect.interest) {
    buzz.interest = Math.min(1.45, buzz.interest + effect.interest);
  }
  if (effect.expectation) {
    buzz.expectation = Math.min(30, buzz.expectation + effect.expectation);
  }
  if (effect.promote) {
    buzz.promoted = [
      ...buzz.promoted.filter((p) => p.recipe !== effect.promote),
      { recipe: effect.promote, until: week + 3, weight: 0.35 },
    ].slice(-4);
  }
  if (effect.claim) {
    buzz.claims = [{ week, ...effect.claim }, ...buzz.claims].slice(0, MAX_CLAIMS);
  }
}

/**
 * How much extra of a dish the room orders because you promoted it.
 *
 * Read by the dish planner, which is what makes "promoting a dish increases
 * demand for it" a mechanical statement rather than a claim on a card.
 */
export function promotionOf(k: KitchenState, recipe: string, week: number): number {
  const p = (k.buzz?.promoted ?? []).find(
    (x) => x.recipe === recipe && x.until >= week,
  );
  return p?.weight ?? 0;
}

/**
 * A promise the kitchen did not keep.
 *
 * Checked after the night: a claim about the food made in the last three
 * weeks, against a night whose plate was poor, is the backlash case. Returns
 * the size of the gap, or zero when there is nothing to answer for.
 */
export function brokenPromise(
  k: KitchenState,
  week: number,
  about: StandingId,
  delivered: number,
): number {
  const claims = (k.buzz?.claims ?? []).filter(
    (c) => c.about === about && c.week > week - 4,
  );
  if (claims.length === 0) return 0;
  const promised = Math.max(...claims.map((c) => c.size));
  return delivered >= promised ? 0 : (promised - delivered) / 10;
}

/* ------------------------------------------------------------ complaints */

export type ComplaintResponse =
  | "apologise"
  | "compensate"
  | "investigate"
  | "explain"
  | "ignore"
  | "defend";

export interface ComplaintResponseDef {
  id: ComplaintResponse;
  label: string;
  /** What you are actually doing. */
  detail: string;
  /** What it costs, before the outcome. */
  cost: string;
  /** When this is the right call, stated honestly. */
  worksWhen: string;
}

/**
 * Six answers, and no correct one.
 *
 * Each is the right call in a describable situation and the wrong one in
 * another, and the descriptions on the cards are true. The rule the outcomes
 * were written to: *whether the complaint is accurate* and *how far it has
 * travelled* between them determine the answer, and both are visible before
 * the player chooses.
 */
export const COMPLAINT_RESPONSES: ComplaintResponseDef[] = [
  {
    id: "apologise",
    label: "Apologise",
    detail: "Publicly, without qualification, and without offering anything.",
    cost: "Nothing, in money.",
    worksWhen:
      "The complaint is true and this is the first time. It stops being enough the second time.",
  },
  {
    id: "compensate",
    label: "Offer compensation",
    detail: "Their money back, and a table when they want one.",
    cost: "Cash, scaled to how far it has travelled.",
    worksWhen:
      "It is true and a lot of people are watching. Paying off a complaint that was false reads exactly like guilt.",
  },
  {
    id: "investigate",
    label: "Find out what happened first",
    detail: "Ask the brigade, look at the night, answer next week.",
    cost: "A week of silence while it spreads.",
    worksWhen:
      "You genuinely do not know, and you have a manager who can find out. Silence is expensive if you are wrong.",
  },
  {
    id: "explain",
    label: "Explain what happened",
    detail: "The kitchen's account of the evening, calmly.",
    cost: "Nothing, in money.",
    worksWhen:
      "It is false, or half true, and people already trust you. If it is simply true this reads as excuses.",
  },
  {
    id: "ignore",
    label: "Say nothing",
    detail: "Let it burn out on its own. Most of them do.",
    cost: "Nothing now.",
    worksWhen:
      "Almost nobody has seen it. If it has reach, silence is read as an answer.",
  },
  {
    id: "defend",
    label: "Defend the restaurant",
    detail: "Publicly disagree, and stand behind your brigade.",
    cost: "Nothing, and everything, depending.",
    worksWhen:
      "It is false and your standing is high enough to be believed. Defending something that happened is the worst outcome on this list.",
  },
];

export const RESPONSE_BY_ID = new Map(
  COMPLAINT_RESPONSES.map((x) => [x.id, x]),
);

export interface Complaint {
  id: string;
  week: number;
  author: string;
  /** Segment id of whoever made it. */
  segment: string;
  /** What it is about — the same tags reviews use. */
  about: StandingId;
  /** Whether it describes something that genuinely happened that night. */
  accurate: boolean;
  body: string;
  /** How many people have seen it. Grows while unanswered. */
  reach: number;
  /** The answer given, once given. */
  answered?: ComplaintResponse;
  /** Week it was answered, for the speed term. */
  answeredWeek?: number;
  /** What happened as a result, in the player's words. */
  outcome?: string;
  /** True once resolved, so the screen can stop asking. */
  closed?: boolean;
}

export const MAX_COMPLAINTS = 8;

export const openComplaints = (k: KitchenState): Complaint[] =>
  (k.complaints ?? []).filter((c) => !c.closed);

/** Everything the outcome depends on, gathered in one place. */
export interface ComplaintContext {
  week: number;
  /** Overall standing, 0–100. */
  reputation: number;
  /** 0–100. A restaurant manager, or you if there is nobody. */
  management: number;
  /** How many complaints about the same thing have already been answered. */
  priors: number;
  /** Cash available, for the compensation branch. */
  cash: number;
  /** Local price of putting a table right. */
  compensation: number;
}

export interface ComplaintOutcome {
  /** Cash spent. Never more than was available. */
  spent: number;
  /** Sentiment move on the phone. */
  sentiment: number;
  followers: number;
  /** Standing moves, applied by the caller. */
  moves: { id: StandingId; delta: number; why: string }[];
  /** What happened, for the log and the thread. */
  note: string;
  /** True when the matter is now closed. */
  closed: boolean;
}

/**
 * What answering does.
 *
 * Five inputs, exactly as the brief requires: whether it is accurate, which
 * answer was chosen, the standing already held, the management skill
 * available, and how long it took. Prior incidents of the same kind are the
 * sixth, and they are what stop "apologise" being a free action forever.
 */
export function resolveComplaint(
  complaint: Complaint,
  response: ComplaintResponse,
  ctx: ComplaintContext,
): ComplaintOutcome {
  const delay = Math.max(0, ctx.week - complaint.week);
  /* Speed matters, and the curve is steep: answering the same week is worth
     about twice answering three weeks later. */
  const promptness = Math.max(0.35, 1 - delay * 0.22);
  /* How loud it is. A complaint nobody saw is not a crisis whatever you do. */
  const loud = Math.min(1, complaint.reach / 2_500);
  const believed = Math.max(0, Math.min(1, (ctx.reputation - 20) / 60));
  const repeat = Math.min(3, ctx.priors);

  const moves: ComplaintOutcome["moves"] = [];
  let sentiment = 0;
  let followers = 0;
  let spent = 0;
  let note = "";

  switch (response) {
    case "apologise": {
      if (complaint.accurate) {
        /* Diminishing: the third apology for the same failing is an admission
           that you have not fixed it. */
        const worth = (5 - repeat * 1.6) * promptness;
        sentiment = worth;
        moves.push({
          id: complaint.about,
          delta: worth * 0.35,
          why:
            repeat > 0
              ? "Apologised again for the same thing"
              : "Apologised for a fair complaint",
        });
        note =
          repeat >= 2
            ? "You apologised. The replies point out that you apologised last time too."
            : "You apologised without qualifying it, and most people let it go.";
      } else {
        sentiment = 1.5 * promptness;
        moves.push({
          id: "consistency",
          delta: -0.8,
          why: "Apologised for something that did not happen",
        });
        note =
          "You apologised for something your kitchen did not do. It ended the argument and your brigade noticed.";
      }
      break;
    }

    case "compensate": {
      const bill = Math.round(ctx.compensation * (1 + loud * 2.5));
      spent = Math.min(ctx.cash > 0 ? ctx.cash : 0, bill);
      const paid = spent >= bill * 0.9;
      if (complaint.accurate && paid) {
        sentiment = 7 * promptness * (0.6 + loud * 0.6);
        followers = Math.round(60 * loud);
        moves.push({
          id: complaint.about,
          delta: 1.4 * promptness,
          why: "Put right a fair complaint, publicly and at your own cost",
        });
        note = `You refunded them and offered a table. It cost ${spent} and it ended there.`;
      } else if (!complaint.accurate) {
        sentiment = -1.5;
        moves.push({
          id: "value",
          delta: -0.9,
          why: "Paid off a complaint that was not true",
        });
        note =
          "You paid. Since nothing had actually gone wrong, the story became that you pay when pushed.";
      } else {
        sentiment = 1;
        note = "You offered what you could afford. It was noticed that it was not much.";
      }
      break;
    }

    case "investigate": {
      /* The only answer that does not close the matter: it buys a week and
         the truth. A manager makes that week worth having. */
      const skill = ctx.management / 100;
      sentiment = -1.2 * loud;
      note =
        skill >= 0.6
          ? "You told them you would find out, and your manager actually did. You know now whether it was fair."
          : "You told them you would find out. Nobody in the building had time to look, and the week passed.";
      return {
        spent: 0,
        sentiment,
        followers: 0,
        moves: skill >= 0.6 ? [] : [{ id: "service", delta: -0.5, why: "Said you would look into it and did not" }],
        note,
        closed: false,
      };
    }

    case "explain": {
      if (!complaint.accurate) {
        const worth = 4 * believed * promptness;
        sentiment = worth;
        moves.push({
          id: complaint.about,
          delta: worth * 0.4,
          why: "Answered an unfair complaint with the facts",
        });
        note =
          believed > 0.5
            ? "You set out what actually happened. People who already trusted you believed it, and there were enough of them."
            : "You set out what actually happened. Not enough people knew you well enough to take your word for it.";
      } else {
        sentiment = -3 * loud;
        moves.push({
          id: complaint.about,
          delta: -1.1,
          why: "Explained away something that had genuinely gone wrong",
        });
        note =
          "You explained. Every sentence of it was true and all of it read as an excuse.";
      }
      break;
    }

    case "ignore": {
      if (loud < 0.2) {
        note = "You said nothing. Nobody was looking, and it went away by Thursday.";
        sentiment = 0;
      } else {
        sentiment = -6 * loud;
        followers = -Math.round(120 * loud);
        moves.push({
          id: complaint.about,
          delta: -1.8 * loud,
          why: "Let a complaint people were watching go unanswered",
        });
        note =
          "You said nothing. It was shared for a week and the silence became the story.";
      }
      break;
    }

    case "defend": {
      if (!complaint.accurate) {
        const worth = 8 * believed - 3 * (1 - believed);
        sentiment = worth;
        followers = Math.round(180 * loud * believed);
        moves.push({
          id: complaint.about,
          delta: worth * 0.3,
          why: "Stood behind the brigade over a complaint that was false",
        });
        note =
          believed > 0.5
            ? "You disagreed publicly and stood behind your kitchen. It is the most popular thing you have ever posted."
            : "You disagreed publicly. Without the standing to back it up, it read as arrogance.";
      } else {
        sentiment = -9 * loud;
        followers = -Math.round(240 * loud);
        moves.push(
          {
            id: complaint.about,
            delta: -2.6 * loud,
            why: "Publicly denied something that had actually happened",
          },
          {
            id: "consistency",
            delta: -0.9,
            why: "Denied a fair complaint",
          },
        );
        note =
          "You denied it. Two other people who were there that night said otherwise, and they had photographs.";
      }
      break;
    }
  }

  return { spent, sentiment, followers, moves, note, closed: true };
}

/**
 * How far an unanswered complaint has travelled by now.
 *
 * Grows while it sits there, faster when the restaurant is being watched.
 * This is the clock the player is actually racing.
 */
export function spreadComplaint(
  complaint: Complaint,
  scrutiny: number,
  rng: Rng,
): number {
  const growth = 1.35 + scrutiny / 140 + rng.next() * 0.3;
  return Math.round(complaint.reach * growth);
}

/** In words, so a number of impressions is never the only signal. */
export function reachWordFor(reach: number): string {
  if (reach >= 4_000) return "Everyone in the city has seen this";
  if (reach >= 1_500) return "This is being shared widely";
  if (reach >= 500) return "A few hundred people have seen it";
  return "Barely anybody has seen it";
}
