import type { RunState } from "./types";
import { REPUTATIONS, overallReputation } from "./reputation";
import { timelineOf } from "./timeline";
import { AMBITION_BY_ID } from "./ambitions";
import { SETBACK_LABEL } from "./setbacks";

/**
 * RETIREMENT, THE ARCHIVE, AND LEGACY
 *
 * The only way a run ends.
 *
 * ------------------------------------------------------------ the rule
 *
 * Nothing in this module is ever called by the simulation. There is no week
 * number, wealth level, age, rank or failure state that reaches in here. The
 * single entry point is `retire`, and the only thing that calls it is a button
 * the player pressed after reading a summary they could cancel out of.
 *
 * That is worth stating in code as well as in prose, because the previous
 * design had four automatic terminators and it would be easy to reintroduce
 * one by accident while adding "just one" convenience check.
 *
 * ------------------------------------------------------------- the archive
 *
 * A retired character is a record of what actually happened: milestones the
 * simulation wrote, relationships as they finished, setbacks survived, cities
 * held. Nothing is generated at retirement time except the arithmetic — the
 * summary reads history, it does not compose one.
 */

export interface ArchivedCareer {
  id: string;
  careerId: string;
  careerLabel: string;
  name: string;
  backgroundId: string | null;
  backgroundLabel: string;
  traits: string[];
  /** The specialisation or path they became known for, if any. */
  path: string | null;
  weeks: number;
  cities: string[];
  businesses: number;
  netWorth: number;
  reputation: { id: string; label: string; value: number }[];
  overall: number;
  /** Warmest first, capped. */
  relationships: { name: string; standing: string; warmth: number }[];
  milestones: { week: number; title: string; detail: string }[];
  setbacksSurvived: string[];
  ambitionsCompleted: string[];
  /** Why they stopped, in their own words if they gave a reason. */
  retiredNote: string;
  retiredWeek: number;
}

/**
 * Bounded, and bounded twice over: the number of characters, and the size of
 * each. A player with forty archived careers should not have a slow save.
 */
export const MAX_ARCHIVE = 12;
export const MAX_ARCHIVED_MILESTONES = 14;
export const MAX_ARCHIVED_RELATIONSHIPS = 8;

export interface RetirementSummary {
  /** Everything the confirmation screen shows, computed from real state. */
  archive: ArchivedCareer;
  /** Lines the player should read before deciding, in priority order. */
  highlights: string[];
  /** What they would carry into a legacy character. */
  legacy: LegacyOffer | null;
}

/* ------------------------------------------------------------- legacy */

export type LegacyKind =
  | "mentor"
  | "capital"
  | "introduction"
  | "recognition"
  | "property"
  | "skill"
  | "opportunity";

export interface LegacyOffer {
  kind: LegacyKind;
  label: string;
  blurb: string;
  /** What the next character actually starts with. Deliberately small. */
  detail: string;
  /** The archived character this comes from. */
  fromId: string;
  fromName: string;
}

export interface LegacyGrant {
  kind: LegacyKind;
  fromId: string;
  fromName: string;
  /** Applied once at `startRun`. */
  cash?: number;
  /** Added to a reputation category. */
  rep?: { id: string; amount: number };
  /** Added to a resource, e.g. skill. */
  resource?: { id: string; amount: number };
  /** Person id who begins the run already warm toward you. */
  personId?: string;
  personBoost?: { warmth: number; trust: number; respect: number };
  /** A line for the new character's timeline. */
  note: string;
}

/**
 * What a retired character can pass on.
 *
 * Chosen by what they were actually good at, so the legacy is a consequence of
 * the run rather than a menu. All seven are small on purpose — the brief's
 * requirement and the obvious design risk are the same thing: a legacy that
 * meaningfully shortens the next run turns a sandbox into an idle game.
 *
 * For scale: the capital grant is about three weeks of early running costs,
 * and the skill grant is roughly one study block.
 */
export function legacyFor(a: ArchivedCareer): LegacyOffer | null {
  const rep = (id: string) =>
    a.reputation.find((r) => r.id === id)?.value ?? 0;

  if (rep("influence") >= 65) {
    return {
      kind: "mentor",
      label: `${a.name} takes an interest`,
      blurb:
        "They have decided you are worth their time, which is not something they hand out.",
      detail: "One senior contact who starts the run already respecting you.",
      fromId: a.id,
      fromName: a.name,
    };
  }
  if (a.netWorth >= 1_500_000) {
    return {
      kind: "capital",
      label: "A modest inheritance",
      blurb: "Not enough to change what you must build. Enough to start sooner.",
      detail: "$30,000 in starting cash.",
      fromId: a.id,
      fromName: a.name,
    };
  }
  if (a.businesses >= 3) {
    return {
      kind: "property",
      label: "A family premises",
      blurb: "Somewhere to begin that you do not have to rent.",
      detail: "Your first site, already yours.",
      fromId: a.id,
      fromName: a.name,
    };
  }
  if (rep("ethics") >= 72) {
    return {
      kind: "recognition",
      label: "The family name",
      blurb: "People remember how they were treated, and by whom.",
      detail: "+8 ethical standing and +5 patient trust at the start.",
      fromId: a.id,
      fromName: a.name,
    };
  }
  if (rep("credibility") >= 70) {
    return {
      kind: "skill",
      label: "Brought up in it",
      blurb: "You grew up around the work. It shows early and then stops mattering.",
      detail: "+6 starting skill.",
      fromId: a.id,
      fromName: a.name,
    };
  }
  if (a.milestones.length >= 6) {
    return {
      kind: "introduction",
      label: "An introduction",
      blurb: "A door held open exactly once.",
      detail: "One useful contact who already knows your name.",
      fromId: a.id,
      fromName: a.name,
    };
  }
  if (a.weeks >= 60) {
    return {
      kind: "opportunity",
      label: "Unfinished business",
      blurb: "Something they started that somebody ought to finish.",
      detail: "An early opportunity that would not normally be offered to you.",
      fromId: a.id,
      fromName: a.name,
    };
  }
  return null;
}

/** The mechanical translation. Kept beside `legacyFor` so they cannot drift. */
export function grantFor(offer: LegacyOffer): LegacyGrant {
  const base = { kind: offer.kind, fromId: offer.fromId, fromName: offer.fromName };
  switch (offer.kind) {
    case "mentor":
      return {
        ...base,
        personId: "hallam",
        personBoost: { warmth: 15, trust: 12, respect: 20 },
        note: `${offer.fromName} put in a word. Your supervisor already knows who you are.`,
      };
    case "capital":
      return {
        ...base,
        cash: 30_000,
        note: `A modest inheritance from ${offer.fromName}.`,
      };
    case "property":
      return {
        ...base,
        cash: 22_000,
        note: `${offer.fromName} left premises the family still holds.`,
      };
    case "recognition":
      return {
        ...base,
        rep: { id: "ethics", amount: 8 },
        resource: { id: "repPatients", amount: 5 },
        note: `People remember how ${offer.fromName} treated them.`,
      };
    case "skill":
      return {
        ...base,
        resource: { id: "skill", amount: 6 },
        note: `You grew up around ${offer.fromName}'s work.`,
      };
    case "introduction":
      return {
        ...base,
        personId: "duarte",
        personBoost: { warmth: 12, trust: 8, respect: 6 },
        note: `${offer.fromName} made one introduction on your behalf.`,
      };
    case "opportunity":
    default:
      return {
        ...base,
        rep: { id: "influence", amount: 6 },
        note: `${offer.fromName} left something unfinished, and people know your name because of it.`,
      };
  }
}

/* -------------------------------------------------------- the summary */

/**
 * Build the summary. **Read-only** — this is what the confirmation screen
 * renders, and the player must be able to look at it and walk away.
 */
export function retirementSummary(
  s: RunState,
  ctx: {
    careerLabel: string;
    name: string;
    backgroundLabel: string;
    path: string | null;
    netWorth: number;
    cities: string[];
    businesses: number;
  },
): RetirementSummary {
  const timeline = timelineOf(s);
  const reputation = REPUTATIONS.map((r) => ({
    id: r.id,
    label: r.label,
    value: Math.round(s.r[r.key] ?? 0),
  }));

  const relationships = [...(s.people ?? [])]
    .sort((a, b) => b.warmth - a.warmth)
    .slice(0, MAX_ARCHIVED_RELATIONSHIPS)
    .map((p) => ({
      name: p.id,
      standing:
        p.status === "gone"
          ? "gone"
          : p.warmth >= 60
            ? "close"
            : p.warmth >= 25
              ? "warm"
              : p.warmth >= -10
                ? "cordial"
                : "cool",
      warmth: Math.round(p.warmth),
    }));

  const archive: ArchivedCareer = {
    id: `${s.careerId}-${s.seed}-${s.week}`,
    careerId: s.careerId,
    careerLabel: ctx.careerLabel,
    name: ctx.name,
    backgroundId: s.background ?? null,
    backgroundLabel: ctx.backgroundLabel,
    traits: [...(s.traits ?? [])],
    path: ctx.path,
    weeks: s.week,
    cities: ctx.cities,
    businesses: ctx.businesses,
    netWorth: Math.round(ctx.netWorth),
    reputation,
    overall: Math.round(overallReputation(s)),
    relationships,
    milestones: timeline
      .slice(-MAX_ARCHIVED_MILESTONES)
      .map((t) => ({ week: t.week, title: t.title, detail: t.detail })),
    setbacksSurvived: (s.setbacksSurvived ?? []).map(
      (k) => SETBACK_LABEL[k as keyof typeof SETBACK_LABEL] ?? k,
    ),
    ambitionsCompleted: (s.ambitionsDone ?? []).map(
      (id) => AMBITION_BY_ID.get(id)?.label ?? id,
    ),
    retiredNote: "",
    retiredWeek: s.week,
  };

  return {
    archive,
    highlights: buildHighlights(archive),
    legacy: legacyFor(archive),
  };
}

/**
 * The two or three sentences that answer "what was this career".
 *
 * Written from the record rather than from a template, so a run that did
 * nothing notable says so instead of being congratulated.
 */
function buildHighlights(a: ArchivedCareer): string[] {
  const out: string[] = [];
  const rep = (id: string) => a.reputation.find((r) => r.id === id)?.value ?? 0;

  out.push(
    `${a.weeks} weeks as a ${a.careerLabel.toLowerCase()}, across ${a.cities.length} ${a.cities.length === 1 ? "city" : "cities"}.`,
  );

  if (a.netWorth >= 2_000_000) {
    out.push(`You finished worth ${money(a.netWorth)}.`);
  } else if (a.netWorth < 0) {
    out.push(`You finished ${money(-a.netWorth)} in the red.`);
  } else {
    out.push(`You finished worth ${money(a.netWorth)} — a living, not a fortune.`);
  }

  const best = [...a.reputation].sort((x, y) => y.value - x.value)[0];
  const worst = [...a.reputation].sort((x, y) => x.value - y.value)[0];
  if (best && worst && best.value - worst.value >= 25) {
    out.push(
      `You will be remembered for ${best.label.toLowerCase()} rather than ${worst.label.toLowerCase()}.`,
    );
  }

  if (a.setbacksSurvived.length > 0) {
    out.push(
      `You came back from ${a.setbacksSurvived.length === 1 ? "a" : `${a.setbacksSurvived.length}`} serious ${a.setbacksSurvived.length === 1 ? "setback" : "setbacks"}: ${a.setbacksSurvived.join(", ").toLowerCase()}.`,
    );
  }

  if (a.ambitionsCompleted.length > 0) {
    out.push(`Ambitions met: ${a.ambitionsCompleted.join("; ")}.`);
  }

  const close = a.relationships.filter((r) => r.standing === "close").length;
  if (close >= 3) {
    out.push(`${close} people still count you a friend.`);
  } else if (a.relationships.filter((r) => r.warmth < -20).length >= 3) {
    out.push("You made more enemies than friends on the way up.");
  }

  if (rep("ethics") >= 75) {
    out.push("You can account for every decision you made.");
  } else if (rep("ethics") <= 35) {
    out.push("There are decisions here you would not want read out.");
  }

  return out;
}

const money = (n: number) =>
  `$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

/**
 * Retire. The only caller is a confirmed player action.
 *
 * Writes the archive, marks the run retired, and returns the legacy offer.
 * The save is *kept* rather than cleared, so the player can look at the
 * finished career afterwards.
 */
export function retire(
  s: RunState,
  summary: RetirementSummary,
  note: string,
): ArchivedCareer {
  const archive: ArchivedCareer = {
    ...summary.archive,
    retiredNote: note.slice(0, 240),
    retiredWeek: s.week,
  };
  s.retired = true;
  s.outcome = {
    kind: "won",
    title: "You retired",
    body: summary.highlights.join(" "),
  };
  return archive;
}
