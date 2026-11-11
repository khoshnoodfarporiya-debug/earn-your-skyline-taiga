import type { RunState } from "./types";
import { pushLog } from "./engine";

/**
 * REPUTATION, IN SIX PARTS
 *
 * "Reputation 62" answered no useful question. A surgeon whose outcomes are
 * excellent and whose staff are quitting, and a media doctor everyone has
 * heard of and no consultant will refer to, had the same number.
 *
 * ---------------------------------------------------------------- migration
 *
 * The single hardest constraint here is that `s.r.reputation` is written from
 * about thirty places in the existing simulation and read by panel growth,
 * recruiting, events and the objective. Replacing it with a derived value
 * would have meant rewriting all of them, and any one missed would be a
 * silent balance change.
 *
 * So it is not replaced. **`s.r.reputation` keeps its key, its range and every
 * existing write, and is now named `credibility`** — which is what those
 * writes always meant: it moves on clinical outcomes, referrals, publications
 * and failures. The five other categories are new state beside it.
 *
 * That gives an exact migration rule, and one that needs no data conversion:
 *
 *   credibility  ← s.r.reputation                       (unchanged, existing)
 *   popularity   ← seeded from phone sentiment          (existing signal)
 *   influence    ← seeded from phone trust              (existing signal)
 *   loyalty      ← 50, neutral                          (new)
 *   patients     ← seeded from credibility, halved to 50 (new)
 *   ethics       ← 70, minus any scrutiny already carried (new)
 *
 * An old save therefore arrives with categories that agree with the run it
 * actually played, rather than with a flat default that would tell the player
 * their well-run practice has neutral staff loyalty and no public profile.
 *
 * ------------------------------------------------------------------ overall
 *
 * The derived overall is kept for compatibility with anything that wants one
 * number, and it is a stated formula rather than a mean: credibility is what a
 * medical career is actually judged on, and ethics is a multiplier because a
 * doctor who is not trusted to be honest does not get to average that away.
 */

export type RepId =
  | "credibility"
  | "popularity"
  | "loyalty"
  | "patients"
  | "influence"
  | "ethics";

export interface RepDef {
  id: RepId;
  label: string;
  /** What it is, in the player's terms. */
  hint: string;
  /** What moves it, so a change is never a mystery. */
  driver: string;
  /** Resource key it is stored under. */
  key: string;
  /** Share of the derived overall. Credibility dominates on purpose. */
  weight: number;
}

export const REPUTATIONS: RepDef[] = [
  {
    id: "credibility",
    label: "Professional credibility",
    hint: "What other clinicians think of your medicine.",
    driver: "Outcomes, referrals, publications, claims lost.",
    key: "reputation",
    weight: 0.34,
  },
  {
    id: "patients",
    label: "Patient trust",
    hint: "Whether the people in your waiting room believe you are on their side.",
    driver: "Waiting times, turned-away patients, outbreak response, honesty.",
    key: "repPatients",
    weight: 0.22,
  },
  {
    id: "loyalty",
    label: "Staff loyalty",
    hint: "Whether your team would follow you to the next practice.",
    driver: "Pay, hours, whether you take the blame or hand it down.",
    key: "repLoyalty",
    weight: 0.16,
  },
  {
    id: "influence",
    label: "Industry influence",
    hint: "Whether the profession takes your call.",
    driver: "Qualifications, published research, who you know.",
    key: "repInfluence",
    weight: 0.14,
  },
  {
    id: "popularity",
    label: "Public popularity",
    hint: "Whether the public has heard of you and likes what it heard.",
    driver: "Posts, press, campaigns, viral moments.",
    key: "repPopularity",
    weight: 0.14,
  },
  {
    id: "ethics",
    label: "Ethical standing",
    hint: "Whether you are believed to be straight with people.",
    driver: "Confidentiality, what you do when it costs you, regulator contact.",
    key: "repEthics",
    weight: 0,
  },
];

export const REP_BY_ID = new Map(REPUTATIONS.map((r) => [r.id, r]));

export const repKey = (id: RepId): string =>
  REP_BY_ID.get(id)?.key ?? "reputation";

/** Defaults for a fresh run. Neutral except where the fiction says otherwise. */
export const INITIAL_REPUTATION: Record<string, number> = {
  repPatients: 50,
  repLoyalty: 50,
  repInfluence: 20, // nobody has heard of a new graduate
  repPopularity: 10,
  repEthics: 70, // you start believed, and can spend it
};

export const readRep = (s: RunState, id: RepId): number =>
  s.r[repKey(id)] ?? 0;

/**
 * The one number, for anything that still wants one.
 *
 * Weighted sum of the five standing categories, then scaled by ethics: at 70
 * (the starting value) the multiplier is 1.0, at 0 it is 0.72, at 100 it is
 * 1.09. So being trusted is worth a little and being distrusted costs a lot,
 * which is how professional reputation actually behaves.
 */
export function overallReputation(s: RunState): number {
  let sum = 0;
  for (const def of REPUTATIONS) {
    if (def.weight === 0) continue;
    sum += (s.r[def.key] ?? 0) * def.weight;
  }
  const ethics = s.r.repEthics ?? 70;
  const multiplier = 0.72 + (ethics / 100) * 0.37;
  return Math.max(0, Math.min(100, sum * multiplier));
}

/**
 * Move one category, and say why.
 *
 * Every call names a reason. That is the requirement this system was built
 * for — a player who watches a bar move should never have to guess — and it
 * is also what the phone's "standing" messages read back.
 *
 * `quiet` suppresses the log line for changes that happen every single week
 * (drift, routine outcomes); the number still moves. Without it the log would
 * be nothing but reputation noise and the real events would be invisible.
 */
export function applyRep(
  s: RunState,
  id: RepId,
  delta: number,
  why: string,
  quiet = false,
): void {
  if (!Number.isFinite(delta) || delta === 0) return;
  const key = repKey(id);
  const before = s.r[key] ?? 0;
  s.r[key] = Math.max(0, Math.min(100, before + delta));
  const moved = s.r[key] - before;
  if (moved === 0) return;

  if (!s.repLog) s.repLog = [];
  s.repLog = [
    {
      week: s.week,
      id,
      delta: Math.round(moved * 10) / 10,
      why,
    },
    ...s.repLog,
  ].slice(0, MAX_REP_LOG);

  if (!quiet && Math.abs(moved) >= 2) {
    const def = REP_BY_ID.get(id);
    pushLog(
      s,
      `${def?.label ?? id} ${moved > 0 ? "up" : "down"} — ${why}.`,
      moved > 0 ? "good" : "bad",
    );
  }
}

export interface RepChange {
  week: number;
  id: RepId;
  delta: number;
  why: string;
}

/** Enough to explain the last few weeks without bloating a 156-week save. */
export const MAX_REP_LOG = 40;

/** What changed recently, for the phone and the standing panel. */
export const recentRepChanges = (s: RunState, weeks = 4): RepChange[] =>
  (s.repLog ?? []).filter((c) => c.week > s.week - weeks);

/** Plain-English band, so a bar is never the only signal. */
export function repWord(value: number): string {
  if (value >= 80) return "Excellent";
  if (value >= 62) return "Strong";
  if (value >= 45) return "Fair";
  if (value >= 28) return "Weak";
  return "Poor";
}

/* ------------------------------------------------------ what it unlocks */

/**
 * Reputation has to *do* something or it is a scoreboard.
 *
 * These are the read points, gathered here so the couplings are visible in one
 * place rather than scattered as magic numbers through the career file.
 */

/** Recruits arrive better when the profession rates you. */
export const hiringBonus = (s: RunState): number =>
  Math.round((readRep(s, "influence") - 20) * 0.14 +
    (readRep(s, "loyalty") - 50) * 0.08);

/** Staff leave when loyalty collapses. Below 25 it is a real risk each week. */
export const attritionRisk = (s: RunState): number => {
  const loyalty = readRep(s, "loyalty");
  if (loyalty >= 40) return 0;
  return Math.min(0.12, (40 - loyalty) * 0.004);
};

/**
 * Patients come, and stay, when they trust you. Panel growth multiplier.
 *
 * A deliberately narrow band — 0.93 at zero trust, 1.00 at the neutral 50,
 * 1.07 at full. It multiplies the catchment ceiling, which is the input to
 * every other number in the economy, so a wide band here is not a flavour
 * adjustment, it is a global difficulty slider. The first version ran 0.82 to
 * 1.18 and took about thirty points of win rate off every strategy in the
 * harness at once.
 */
export const panelTrustFactor = (s: RunState): number =>
  0.93 + (readRep(s, "patients") / 100) * 0.14;

/** How far a post travels before followers are taken into account. */
export const reachFactor = (s: RunState): number =>
  0.7 + (readRep(s, "popularity") / 100) * 0.9;

/**
 * Whether an opportunity is even offered. Contracts, chairs, board seats and
 * investor approaches all gate on this rather than on cash.
 */
export const opportunityScore = (s: RunState): number =>
  readRep(s, "credibility") * 0.4 +
  readRep(s, "influence") * 0.4 +
  readRep(s, "ethics") * 0.2;
