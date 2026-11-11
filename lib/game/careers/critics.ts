import type { Rng } from "../types";
import {
  activeMenu,
  cityOf,
  knownRecipes,
  premisesOf,
  type KitchenState,
} from "./kitchen";
import { RECIPE_BY_ID, inSeason, INGREDIENT_BY_ID } from "./recipes";
import { priceStand, seasonOf } from "./diners";
import { standingOf, type StandingId } from "./standing";

/**
 * THE CRITICS
 *
 * Five of them, and the only thing they have in common is that none of them
 * tells you what they want.
 *
 * ------------------------------------------------------------- the design
 *
 * A critic who publishes a checklist is a quiz. A critic who is a dice roll is
 * a tax. This sits between: each one weighs the seven standing categories
 * differently and looks at some *specific* thing about the menu — whether the
 * ingredients are in season, whether anything on it is original, whether the
 * prices are honest — and the player is given **partial clues** before a
 * visit. Enough to guess who is coming and prepare for two or three of the
 * things they care about; never enough to have prepared for all of them.
 *
 * The clues are drawn from the critic's real weights, so a player who reads
 * them carefully is genuinely better off. That is the difference between a
 * hint and a tease.
 *
 * ------------------------------------------------------------- the result
 *
 * A verdict moves standing categories, and it moves *expectations* — which is
 * the sting in a good review. Acclaim raises the bar every subsequent night is
 * judged against, and a kitchen that cannot hold the standard it was praised
 * for slides further than one that was never noticed.
 *
 * Nothing here ends a run. An award is a thing you now have to live up to,
 * and the career continues exactly as before with a harder problem in it.
 */

export interface CriticDef {
  id: string;
  name: string;
  /** The publication. Fictional, and not a review platform. */
  outlet: string;
  /** What they are, in a line. */
  blurb: string;
  /** How they weigh the seven categories. Values sum to about 1. */
  weighs: Partial<Record<StandingId, number>>;
  /**
   * The specific thing about the menu they look at, beyond the categories.
   * Named so the verdict can quote it.
   */
  looksFor: "seasonality" | "originality" | "honesty" | "consistency" | "sourcing";
  /** Clues the player may see before a visit, in the critic's own voice. */
  clues: string[];
  /** How hard they are to please. Added to the bar they judge against. */
  severity: number;
}

export const CRITICS: CriticDef[] = [
  {
    id: "traditionalist",
    name: "Pascale Arnaud",
    outlet: "La Table",
    blurb:
      "Believes a restaurant's job is to cook a small number of things properly, twice a week, for thirty years.",
    weighs: { food: 0.4, consistency: 0.3, service: 0.16, value: 0.14 },
    looksFor: "consistency",
    clues: [
      "She has been asking whether your menu has changed since the spring.",
      "She reviews the same three classics everywhere she goes and compares them.",
      "Somebody heard her say that novelty is what kitchens do instead of cooking.",
    ],
    severity: 6,
  },
  {
    id: "modernist",
    name: "Ines Gallo",
    outlet: "Course",
    blurb:
      "Interested only in whether there is a reason for this restaurant to exist.",
    weighs: { innovation: 0.42, food: 0.3, atmosphere: 0.16, service: 0.12 },
    looksFor: "originality",
    clues: [
      "She writes almost exclusively about kitchens doing something nobody else is.",
      "Her last piece was three thousand words about one dish.",
      "She has asked who develops your menu, which is not a neutral question.",
    ],
    severity: 8,
  },
  {
    id: "value",
    name: "Tom Rowntree",
    outlet: "The Weekly Table",
    blurb:
      "Writes for people deciding where to spend forty pounds. Merciless about a bill that does not add up.",
    weighs: { value: 0.4, food: 0.26, service: 0.2, consistency: 0.14 },
    looksFor: "honesty",
    clues: [
      "He prints the full bill at the bottom of every review, including the water.",
      "He has been asking around about what your set lunch actually costs.",
      "His column this month was about restaurants charging city prices for market cooking.",
    ],
    severity: 4,
  },
  {
    id: "service",
    name: "Margit Halász",
    outlet: "Front of House",
    blurb:
      "Came up in dining rooms, not kitchens. Judges a restaurant by the twenty minutes before the food arrives.",
    weighs: { service: 0.42, atmosphere: 0.26, food: 0.2, consistency: 0.12 },
    looksFor: "consistency",
    clues: [
      "She times the gap between sitting down and being spoken to. She has said so in print.",
      "She books two tables under different names and compares how each is treated.",
      "Her reviews barely mention the food until the fourth paragraph.",
    ],
    severity: 6,
  },
  {
    id: "sustain",
    name: "Ola Fenn",
    outlet: "Ground Up",
    blurb:
      "Writes about where food comes from and what happens to the part of it nobody orders.",
    weighs: { hygiene: 0.3, food: 0.26, innovation: 0.22, value: 0.22 },
    looksFor: "sourcing",
    clues: [
      "They ask every kitchen the same question: what did you throw away this week?",
      "They have been talking to your suppliers before talking to you.",
      "Their last piece named four restaurants for buying out of season and printed the invoices.",
    ],
    severity: 7,
  },
];

export const CRITIC_BY_ID = new Map(CRITICS.map((c) => [c.id, c]));

/* -------------------------------------------------------------- the visit */

/** A visit that has been arranged but has not happened yet. */
export interface CriticWatch {
  critic: string;
  /** The week they will come. Never shown exactly. */
  dueWeek: number;
  /** What the player has been told so far, oldest first. */
  clues: string[];
  /** Week the watch began, for the "any night now" wording. */
  since: number;
}

/** A verdict that has been published. */
export interface CriticVerdict {
  id: string;
  week: number;
  critic: string;
  /** 0–100, what they thought. */
  score: number;
  /** Two or three sentences, drawn from what actually happened. */
  body: string;
  /** The standing moves this produced, already applied. */
  moves: { id: StandingId; delta: number; why: string }[];
  /** An award, when the score earned one. */
  award: string | null;
  /** Extra covers wanting a table, as a multiplier, while it lasts. */
  interest: number;
  /** How much harder every night is judged from now on. */
  expectation: number;
}

/** Enough to remember a career's press without bloating the save. */
export const MAX_VERDICTS = 8;

/**
 * Whether a critic is likely to take an interest.
 *
 * Not random: they come when there is a reason to, and the reasons are all
 * things the player did. A restaurant nobody has heard of is not reviewed,
 * and one that is suddenly full is reviewed quickly.
 */
export function criticInterest(
  overall: number,
  followers: number,
  streak: number,
): number {
  if (overall < 26) return 0;
  return Math.min(
    0.3,
    (overall - 26) / 240 + Math.min(0.08, followers / 40_000) + streak * 0.02,
  );
}

/**
 * Which critic. Weighted by what this restaurant is: the modernist notices an
 * original menu, the value critic notices a cheap room that is busy.
 */
export function pickCritic(
  k: KitchenState,
  overall: number,
  rng: Rng,
): CriticDef {
  const scores = standingOf(k, overall);
  const stand = priceStand(k);
  const weights = CRITICS.map((critic) => {
    let w = 1;
    if (critic.id === "modernist") w += scores.innovation / 40;
    if (critic.id === "value") w += stand < 1 ? 1.4 : 0.3;
    if (critic.id === "traditionalist") w += scores.consistency / 50;
    if (critic.id === "service") w += scores.service < 50 ? 1.2 : 0.5;
    if (critic.id === "sustain") w += scores.hygiene / 60;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < CRITICS.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return CRITICS[i];
  }
  return CRITICS[0];
}

/**
 * Arrange a visit, two to five weeks out, with the first clue.
 *
 * The date is never told to the player. What they get is a window and a
 * clue — which is the honest version of how this works: you know somebody is
 * coming, you do not know which Thursday.
 */
export function arrangeVisit(
  critic: CriticDef,
  week: number,
  rng: Rng,
): CriticWatch {
  return {
    critic: critic.id,
    dueWeek: week + 2 + Math.floor(rng.next() * 4),
    clues: [critic.clues[Math.floor(rng.next() * critic.clues.length)]],
    since: week,
  };
}

/** A further clue, when one is due. Never the same clue twice. */
export function nextClue(
  watch: CriticWatch,
  critic: CriticDef,
  rng: Rng,
): string | null {
  const unseen = critic.clues.filter((c) => !watch.clues.includes(c));
  if (unseen.length === 0) return null;
  return unseen[Math.floor(rng.next() * unseen.length)];
}

/* ------------------------------------------------------------ the verdict */

/** Everything a verdict is allowed to look at. All of it real. */
export interface VisitFacts {
  week: number;
  /** The night they happened to come to. */
  serviceLabel: string;
  /** 0–100 off that night's pass. */
  plate: number;
  /** Ticks the average table waited. */
  wait: number;
  mistakes: number;
  walked: number;
  served: number;
}

/**
 * What they wrote.
 *
 * Every term is a fact: their weights against your seven scores, then the one
 * specific thing they came to look at, then the night itself. A critic who
 * arrives on a night the kitchen fell over writes about that night, however
 * good the restaurant usually is — which is the risk of being reviewed, and
 * the reason the clue system matters.
 */
export function judgeVisit(
  critic: CriticDef,
  k: KitchenState,
  overall: number,
  facts: VisitFacts,
): CriticVerdict {
  const scores = standingOf(k, overall);

  /* -------------------------------------------------- the standing they weigh */
  let base = 0;
  let weight = 0;
  for (const [id, w] of Object.entries(critic.weighs)) {
    base += (scores[id as StandingId] ?? 50) * (w ?? 0);
    weight += w ?? 0;
  }
  base = weight > 0 ? base / weight : 50;

  /* ------------------------------------------------ the thing they look for */
  const special = specialCheck(critic, k, facts.week);
  base += special.move;

  /* -------------------------------------------------------- the night itself */
  const nightNotes: string[] = [];
  if (facts.served > 0) {
    const plateGap = (facts.plate - 60) * 0.25;
    base += plateGap;
    if (facts.plate >= 72) nightNotes.push("the cooking on the night was genuinely good");
    else if (facts.plate <= 45) nightNotes.push("the cooking on the night was not");
  } else {
    base -= 14;
    nightNotes.push("the kitchen was not serving when they came, which is its own answer");
  }
  if (facts.mistakes > 0) {
    base -= Math.min(9, facts.mistakes * 1.6);
    nightNotes.push(`${facts.mistakes} plate${facts.mistakes === 1 ? "" : "s"} went back`);
  }
  if (facts.walked > 0) {
    base -= Math.min(11, facts.walked * 2.2);
    nightNotes.push(`tables left before they were fed`);
  }
  if (facts.wait > 4) {
    base -= Math.min(8, (facts.wait - 4) * 2);
    nightNotes.push(`a wait of ${Math.round(facts.wait * 15)} minutes`);
  }

  const score = Math.max(0, Math.min(100, base - critic.severity));

  /* ------------------------------------------------------------- the words */
  const room = premisesOf(k).label.toLowerCase();
  const opening =
    score >= 76
      ? `${critic.outlet}: "The best room in ${cityOf(k).name} that nobody was talking about a month ago."`
      : score >= 60
        ? `${critic.outlet}: "A ${room} doing serious work, with the odd rough edge."`
        : score >= 42
          ? `${critic.outlet}: "Competent, and not yet more than that."`
          : `${critic.outlet}: "I wanted to like it."`;

  const body = [
    opening,
    special.note,
    nightNotes.length > 0
      ? `They noted ${nightNotes.slice(0, 2).join(", and ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  /* ----------------------------------------------------------- the effects */
  const moves: { id: StandingId; delta: number; why: string }[] = [];
  const swing = (score - 55) / 9;
  for (const [id, w] of Object.entries(critic.weighs)) {
    const delta = swing * (w ?? 0) * 2.4;
    if (Math.abs(delta) < 0.05) continue;
    moves.push({
      id: id as StandingId,
      delta,
      why: `${critic.name} reviewed you in ${critic.outlet}`,
    });
  }

  const award =
    score >= 82
      ? AWARDS[critic.id] ?? "A very good review"
      : null;

  return {
    id: `verdict-${facts.week}-${critic.id}`,
    week: facts.week,
    critic: critic.id,
    score: Math.round(score),
    body,
    moves,
    award,
    /* Being written about brings people, good or bad — a hostile review in a
       paper people read still puts your name in front of them. A kind one
       brings more. */
    interest: score >= 60 ? 1.18 + (score - 60) / 250 : 1.06,
    /* And every one of them raises the bar. */
    expectation: score >= 76 ? 9 : score >= 60 ? 5 : 2,
  };
}

const AWARDS: Record<string, string> = {
  traditionalist: "La Table — Kitchen of the Year, shortlisted",
  modernist: "Course — One To Watch",
  value: "The Weekly Table — Best Value in the City",
  service: "Front of House — Dining Room of the Year, commended",
  sustain: "Ground Up — Whole Larder Award",
};

/**
 * The specific thing this critic came to check, measured against real state.
 *
 * This is what makes five critics five different problems rather than five
 * different weightings of the same one: the modernist counts original dishes
 * on the menu, the sustainability critic counts out-of-season ingredients, the
 * value critic compares your prices with what the room is.
 */
function specialCheck(
  critic: CriticDef,
  k: KitchenState,
  week: number,
): { move: number; note: string } {
  const menu = activeMenu(k);
  const recipes = menu
    .map((entry) => RECIPE_BY_ID.get(entry.recipe))
    .filter((r): r is NonNullable<typeof r> => !!r);

  switch (critic.looksFor) {
    case "originality": {
      if (recipes.length === 0) {
        return { move: -12, note: "There was no menu to speak of, which they took personally." };
      }
      const best = Math.max(...recipes.map((r) => r.originality));
      const signature = knownRecipes(k).some((p) => p.signature);
      const move = (best - 52) * 0.2 + (signature ? 6 : -4);
      return {
        move,
        note:
          best >= 70
            ? "They wrote most of the piece about one dish, which is what they do when they like it."
            : "They observed that everything on the menu could be eaten somewhere else in the city.",
      };
    }
    case "seasonality":
    case "sourcing": {
      const lots = k.pantry ?? [];
      if (lots.length === 0 && recipes.length === 0) {
        return { move: -8, note: "They asked to see the larder. There was not much of one." };
      }
      const outOfSeason = lots.filter((lot) => {
        const ing = INGREDIENT_BY_ID.get(lot.ingredient);
        return ing ? !inSeason(ing, week) : false;
      }).length;
      const share = lots.length > 0 ? outOfSeason / lots.length : 0;
      return {
        move: 8 - share * 26,
        note:
          share <= 0.15
            ? `Everything in the larder was ${seasonOf(week).label.toLowerCase()} produce, and they said so in the first line.`
            : "They counted the things in your larder that have no business being there in this month, and printed the number.",
      };
    }
    case "honesty": {
      const stand = priceStand(k);
      return {
        move: stand <= 1.05 ? 9 : -(stand - 1.05) * 30,
        note:
          stand <= 1.05
            ? "They printed the bill, as they always do, and it was the most flattering paragraph in the review."
            : "They printed the bill, as they always do, and left the reader to draw the conclusion.",
      };
    }
    case "consistency": {
      const scores = standingOf(k, 50);
      return {
        move: (scores.consistency - 52) * 0.24,
        note:
          scores.consistency >= 62
            ? "They came twice, a fortnight apart, and wrote that both nights were the same night."
            : "They came twice, a fortnight apart, and wrote about the difference.",
      };
    }
  }
}

/** How the watch reads on screen, without ever giving away the date. */
export function watchLine(watch: CriticWatch, week: number): string {
  const away = watch.dueWeek - week;
  if (away <= 0) return "Any night now.";
  if (away === 1) return "Within the week, by the sound of it.";
  if (away <= 3) return "Some time in the next few weeks.";
  return "Some time this season.";
}
