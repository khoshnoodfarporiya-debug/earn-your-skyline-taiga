import type { MedicalState, PostEffect, SocialMetrics } from "./types";

/**
 * SOCIAL STANDING
 *
 * Three audiences that do different things, kept separate from `reputation`
 * on purpose. Reputation is clinical standing, earned by treating people
 * well. These are earned by what you *say*, and they pay out differently:
 *
 *   trust      → better recruits (clinicians choose who to work for)
 *   sentiment  → a wider catchment (the public choose who to register with)
 *   scrutiny   → more malpractice risk (regulators and journalists watch you)
 *   followers  → the multiplier on all of the above; reach without substance
 *
 * BALANCE CONTRACT: every effect below returns exactly 0 at the starting
 * values (trust 50, sentiment 50, scrutiny 0). A run that never opens the
 * phone therefore plays bit-identically to one from before it existed, which
 * is what keeps the balance harness meaningful.
 */

export const INITIAL_SOCIAL: SocialMetrics = {
  followers: 0,
  trust: 50,
  sentiment: 50,
  scrutiny: 0,
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** Applies a post or message effect to the run's social metrics. */
export function applySocial(social: SocialMetrics, e: PostEffect): void {
  if (e.followers) social.followers = Math.max(0, social.followers + e.followers);
  if (e.trust) social.trust = clamp(social.trust + e.trust, 0, 100);
  if (e.sentiment) social.sentiment = clamp(social.sentiment + e.sentiment, 0, 100);
  if (e.scrutiny) social.scrutiny = clamp(social.scrutiny + e.scrutiny, 0, 100);
}

// ------------------------------------------------------ gameplay couplings

/**
 * Skill bonus on your next recruit. Clinicians read the room: a doctor other
 * doctors respect attracts a stronger bench than one the public merely knows.
 */
export function trustRecruitBonus(m: MedicalState): number {
  return (m.phone.social.trust - 50) * 0.12;
}

/**
 * Catchment multiplier from public feeling. Bounded tightly — this is a
 * nudge on top of marketing, not a replacement for building capacity.
 */
export function sentimentCatchment(m: MedicalState): number {
  return 1 + (m.phone.social.sentiment - 50) / 250;
}

/** Extra malpractice risk per week from being closely watched. */
export function scrutinyRisk(m: MedicalState): number {
  return m.phone.social.scrutiny * 0.02;
}

// ------------------------------------------------------ communications team

export const commsStaff = (m: MedicalState) =>
  m.staff.filter((s) => s.role === "comms").length;

/**
 * What a communications manager actually buys you.
 *
 * Deliberately *not* a second post per week — one meaningful post a week is
 * the rule that stops Pulse becoming a lever you pull six times. What they do
 * instead is make the one post you publish land better and hurt less:
 *
 *   reach     — they know how to write a headline
 *   safety    — they read it before it goes out
 *   scrutiny  — they answer the press so the story closes
 *
 * All three return the no-op value at zero comms staff, so the balance
 * contract holds for any run that never hires one.
 */
export function commsReachBonus(m: MedicalState): number {
  return 1 + Math.min(0.7, commsStaff(m) * 0.35);
}

export function commsHazardFactor(m: MedicalState): number {
  return Math.max(0.3, 1 - commsStaff(m) * 0.4);
}

export function commsScrutinyRelief(m: MedicalState): number {
  return Math.min(4, commsStaff(m) * 2);
}

// ---------------------------------------------------------------- identity

export interface Identity {
  label: string;
  blurb: string;
}

/**
 * A derived label rather than a progression system: it reads the shape of
 * your standing and names it. Ordered most-specific first.
 */
export function identityOf(social: SocialMetrics): Identity {
  const { followers, trust, sentiment, scrutiny } = social;

  if (followers < 250 && trust <= 56) {
    return {
      label: "Unknown",
      blurb: "Nobody outside your waiting room knows who you are yet.",
    };
  }
  if (scrutiny >= 55 && followers > 2_000) {
    return {
      label: "Controversial disruptor",
      blurb:
        "Enormous reach, and a regulator who reads everything you publish.",
    };
  }
  if (trust >= 72 && followers >= 6_000) {
    return {
      label: "Research authority",
      blurb: "Cited by people who do not otherwise agree with each other.",
    };
  }
  if (trust >= 68) {
    return {
      label: "Trusted educator",
      blurb: "Colleagues send patients to you on the strength of your writing.",
    };
  }
  if (followers >= 12_000 && trust < 48) {
    return {
      label: "Luxury influencer",
      blurb: "Very famous. Not, professionally speaking, taken seriously.",
    };
  }
  if (followers >= 8_000 && sentiment >= 60) {
    return {
      label: "Celebrity doctor",
      blurb: "The public adores you. The profession is reserving judgement.",
    };
  }
  if (sentiment >= 58 && followers >= 1_500) {
    return {
      label: "Healthcare entrepreneur",
      blurb: "Known for building things rather than for publishing them.",
    };
  }
  return {
    label: "Local name",
    blurb: "Recognised in your own city, and not much beyond it.",
  };
}

/** Compact display, e.g. 12.4k. */
export function followerCount(n: number): string {
  if (n < 1_000) return `${Math.round(n)}`;
  if (n < 100_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n / 1_000)}k`;
}

/** Word for a 0–100 standing, so status never rests on colour alone. */
export function standingWord(value: number): string {
  if (value >= 75) return "Very high";
  if (value >= 60) return "High";
  if (value >= 45) return "Moderate";
  if (value >= 30) return "Low";
  return "Very low";
}
