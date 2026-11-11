import type { RunState } from "./types";

/**
 * MONEY THAT COMES WITH STRINGS
 *
 * The practice had one source of capital: revenue, and a student loan you
 * could only pay down. Every expansion decision was therefore the same
 * decision — do I have the cash yet — which is a waiting game rather than a
 * financing one.
 *
 * Five ways to raise money, each of which costs something different:
 *
 *   bank        interest, and a covenant they will enforce
 *   investor    equity, and an opinion about your margins
 *   partner     equity, and a colleague with a veto
 *   grant       no money back, and an obligation you must deliver
 *   retained    nothing, and it is slow
 *
 * -------------------------------------------------------------- the exploits
 *
 * The brief names three, and each is closed structurally rather than by a
 * message:
 *
 *   *Unlimited loans.* `borrowingCapacity` is a function of net worth and
 *   existing obligations, so the second loan is smaller than the first and the
 *   fourth is usually impossible. Nothing checks a counter.
 *
 *   *The same investor twice.* Equity is finite: `equitySold` is tracked, the
 *   ceiling is 49%, and each facility records who provided it. An investor who
 *   already holds a stake offers on worse terms, then stops offering.
 *
 *   *Outrunning repayment by moving city.* Obligations live on the run, not on
 *   a city. Relocating changes what you earn, never what you owe.
 */

export type FundingKind = "bank" | "investor" | "partner" | "grant";

export const FUNDING_KINDS: readonly FundingKind[] = [
  "bank",
  "investor",
  "partner",
  "grant",
];

export interface Obligation {
  id: string;
  kind: FundingKind;
  /** Person id, where a human is attached to the money. */
  holder?: string;
  /** What was advanced. */
  principal: number;
  /** What is still owed. Zero for equity and grants. */
  outstanding: number;
  /** Weekly interest rate on the outstanding balance. */
  rate: number;
  /** Fixed weekly payment, if the facility amortises. */
  weekly: number;
  /** Percentage points of the business given up. */
  equity: number;
  week: number;
  /** Weeks left to satisfy a grant's condition. */
  dueWeek?: number;
  /** What the grant requires, in the player's words. */
  condition?: string;
  /** Missed payments. Three and the facility is called in. */
  missed: number;
  /** True once satisfied, kept for the record rather than deleted. */
  settled: boolean;
}

export const MAX_OBLIGATIONS = 8;
/** Nobody may sell control. This is the whole reason equity is bounded. */
export const MAX_EQUITY = 49;

export interface FundingOffer {
  kind: FundingKind;
  label: string;
  blurb: string;
  amount: number;
  rate: number;
  weekly: number;
  equity: number;
  holder?: string;
  condition?: string;
  dueWeek?: number;
  /** Why this is not available, if it is not. */
  blocked?: string;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));

export const obligations = (s: RunState): Obligation[] =>
  (s.obligations ?? []).filter((o) => !o.settled);

export const equitySold = (s: RunState): number =>
  (s.obligations ?? []).reduce((n, o) => n + o.equity, 0);

export const ownedShare = (s: RunState): number =>
  clamp(100 - equitySold(s), 0, 100);

export const weeklyDebtService = (s: RunState): number =>
  obligations(s).reduce((n, o) => n + o.weekly, 0);

export const totalOutstanding = (s: RunState): number =>
  obligations(s).reduce((n, o) => n + o.outstanding, 0);

/**
 * How much more a lender will advance.
 *
 * Three times weekly revenue capacity minus what is already owed, floored at
 * zero. Deliberately a *function of the business*, so a player who has built
 * something can borrow against it and a player who has not, cannot — and so
 * the answer to "can I take another loan" is always visible rather than being
 * an error message after the fact.
 */
export function borrowingCapacity(
  s: RunState,
  netWorth: number,
  weeklyRevenue: number,
): number {
  /*
   * `netWorth` now nets off what is already owed, and this function subtracts
   * it again on the next line at a 1.15 haircut. Counting it twice would
   * quietly tighten credit as a side effect of an accounting fix, so the gross
   * figure is put back first: existing debt is charged for here, once, exactly
   * as it always was.
   */
  const gross = netWorth + totalOutstanding(s);
  const asset = Math.max(0, gross) * 0.35;
  const income = Math.max(0, weeklyRevenue) * 26;
  const room = asset + income - totalOutstanding(s) * 1.15;
  return Math.max(0, Math.round(room / 1000) * 1000);
}

/**
 * What is on the table this week.
 *
 * Every entry is either offered with real terms or present-and-blocked with
 * the reason stated. Showing the blocked ones is deliberate: "you cannot raise
 * equity because you have already sold 45%" teaches the system, and a hidden
 * option teaches nothing.
 */
export function fundingOffers(
  s: RunState,
  ctx: {
    netWorth: number;
    weeklyRevenue: number;
    credibility: number;
    influence: number;
    ethics: number;
    investorWarmth: number;
    partnerWarmth: number;
  },
): FundingOffer[] {
  const capacity = borrowingCapacity(s, ctx.netWorth, ctx.weeklyRevenue);
  const sold = equitySold(s);
  const out: FundingOffer[] = [];

  /* ------------------------------------------------------------ bank */
  const bankRate = 0.0016 + Math.max(0, (60 - ctx.credibility)) * 0.00004;
  out.push({
    kind: "bank",
    label: "Bank facility",
    blurb:
      "Secured against the practice. They will not ask how you run it, and they will not be flexible if you miss a payment.",
    amount: Math.min(capacity, 900_000),
    rate: bankRate,
    weekly: 0, // interest-only; principal repaid when you choose
    equity: 0,
    blocked:
      capacity < 25_000
        ? "You have nothing left to borrow against."
        : undefined,
  });

  /* -------------------------------------------------------- investor */
  const investorHeld = (s.obligations ?? []).find(
    (o) => o.kind === "investor" && !o.settled,
  );
  const equityRoom = MAX_EQUITY - sold;
  out.push({
    kind: "investor",
    label: "Outside investment",
    blurb:
      "Money now for a share and a say. He will want to see the margin move, and he will notice if it does not.",
    amount: Math.round(Math.max(0, ctx.netWorth) * 0.4 + 220_000),
    rate: 0,
    weekly: 0,
    /* A second round costs more equity for the same money — the point at
       which "take the investor again" stops being free. */
    equity: Math.min(equityRoom, investorHeld ? 22 : 15),
    holder: "thorne",
    blocked:
      equityRoom < 10
        ? `You have already sold ${sold}% and will not go past ${MAX_EQUITY}%.`
        : ctx.investorWarmth < -20
          ? "He is not taking your calls."
          : undefined,
  });

  /* --------------------------------------------------------- partner */
  out.push({
    kind: "partner",
    label: "Clinical partner",
    blurb:
      "Less money than an investor and an argument about medicine rather than margin. She will not join a practice that treats people badly.",
    amount: 180_000,
    rate: 0,
    weekly: 0,
    equity: Math.min(equityRoom, 20),
    holder: "adeyemi",
    blocked:
      equityRoom < 15
        ? `Only ${equityRoom}% of the practice is left to give.`
        : ctx.partnerWarmth < 15
          ? "She does not know you well enough to buy in."
          : ctx.ethics < 45
            ? "She has heard how this practice is run."
            : undefined,
  });

  /* ----------------------------------------------------------- grant */
  out.push({
    kind: "grant",
    label: "Institutional grant",
    blurb:
      "Nothing to repay and nothing to give up — but it is for something specific, and they will check.",
    amount: 120_000,
    rate: 0,
    weekly: 0,
    equity: 0,
    condition: "Run a public-health contract to completion within 30 weeks.",
    dueWeek: s.week + 30,
    blocked:
      ctx.influence < 35
        ? "Nobody on the panel has heard of you."
        : (s.obligations ?? []).some((o) => o.kind === "grant" && !o.settled)
          ? "You already hold a grant that is not yet acquitted."
          : undefined,
  });

  return out;
}

export function takeFunding(
  s: RunState,
  offer: FundingOffer,
): Obligation | null {
  if (offer.blocked) return null;
  if ((s.obligations ?? []).length >= MAX_OBLIGATIONS) return null;
  if (equitySold(s) + offer.equity > MAX_EQUITY) return null;
  if (offer.amount <= 0) return null;

  const o: Obligation = {
    id: `${offer.kind}-${s.week}-${(s.obligations ?? []).length}`,
    kind: offer.kind,
    holder: offer.holder,
    principal: offer.amount,
    outstanding: offer.kind === "bank" ? offer.amount : 0,
    rate: offer.rate,
    weekly: offer.weekly,
    equity: offer.equity,
    week: s.week,
    dueWeek: offer.dueWeek,
    condition: offer.condition,
    missed: 0,
    settled: false,
  };
  s.obligations = [...(s.obligations ?? []), o];
  s.r.cash += offer.amount;
  return o;
}

/**
 * One week of what you owe.
 *
 * Interest compounds on the outstanding balance; a facility you cannot service
 * accrues missed payments, and three of those is a default. Default is
 * deliberately harsh — it takes cash you do not have and hits credibility —
 * because the whole point of borrowing being a decision is that it can be the
 * wrong one.
 */
export function tickFinance(
  s: RunState,
): { interest: number; defaulted: Obligation[]; notes: string[] } {
  let interest = 0;
  const defaulted: Obligation[] = [];
  const notes: string[] = [];

  for (const o of obligations(s)) {
    if (o.kind === "bank" && o.outstanding > 0) {
      const charge = o.outstanding * o.rate;
      o.outstanding += charge;
      interest += charge;

      if (o.weekly > 0) {
        if (s.r.cash >= o.weekly) {
          s.r.cash -= o.weekly;
          o.outstanding = Math.max(0, o.outstanding - o.weekly);
          o.missed = 0;
        } else {
          o.missed += 1;
          if (o.missed >= 3) defaulted.push(o);
        }
      }
      if (o.outstanding <= 1) {
        o.outstanding = 0;
        o.settled = true;
        notes.push("A bank facility has been cleared.");
      }
    }

    // A grant that runs out of time has to be given back.
    if (o.kind === "grant" && o.dueWeek !== undefined && s.week > o.dueWeek) {
      o.settled = true;
      s.r.cash -= o.principal;
      notes.push(
        "The grant condition was not met. The funder has asked for the money back.",
      );
    }
  }

  return { interest, defaulted, notes };
}

/** Repay a bank facility, in part or in full. */
export function repay(s: RunState, id: string, amount: number): number {
  const o = obligations(s).find((x) => x.id === id);
  if (!o || o.kind !== "bank") return 0;
  const paid = Math.min(amount, o.outstanding, s.r.cash);
  if (paid <= 0) return 0;
  s.r.cash -= paid;
  o.outstanding -= paid;
  if (o.outstanding <= 1) {
    o.outstanding = 0;
    o.settled = true;
  }
  return paid;
}

/**
 * Satisfy a grant's condition.
 *
 * Called by whichever system fulfils it — currently the contract resolver, on
 * a completed public-health contract. Keeping the check outside this module is
 * what lets a grant be about anything later without editing finance.
 */
export function acquitGrant(s: RunState): boolean {
  const g = obligations(s).find((o) => o.kind === "grant");
  if (!g) return false;
  g.settled = true;
  return true;
}

/**
 * What an equity holder takes out of the business each week.
 *
 * Applied to profit rather than revenue, so a loss-making practice pays no
 * dividend — the investor's money is at risk too, which is the honest model
 * and also stops equity being strictly worse than debt at every scale.
 */
export const dividendOn = (s: RunState, profit: number): number =>
  profit > 0 ? Math.round(profit * (equitySold(s) / 100)) : 0;

export const KIND_WORD: Record<FundingKind, string> = {
  bank: "Bank",
  investor: "Investor",
  partner: "Partner",
  grant: "Grant",
};
