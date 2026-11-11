import type { Rng } from "../types";
import { cityOf, premisesOf, type KitchenState } from "./kitchen";
import type { ServiceReport } from "./service";
import {
  priceStand,
  segmentAt,
  seasonOf,
  type SegmentShare,
} from "./diners";
import { standingOf, type StandingId } from "./standing";

/**
 * WHAT PEOPLE WROTE ABOUT THE NIGHT
 *
 * A review here is not flavour text with a random star rating on it. Every
 * one of them is assembled from facts the service produced: the dish that
 * table ordered, how many ticks it waited, whether a plate went back, what it
 * cost, and which of the seven standing categories the person writing it
 * actually cares about.
 *
 * ------------------------------------------------------------- the rule
 *
 * **Nothing appears in a review that did not happen.** A complaint about a
 * long wait is only written when `averageWait` exceeded what that segment
 * will bear; a complaint about the price is only written when the menu sits
 * above what that segment pays; a compliment about a dish names a dish that
 * was actually sent out that night. That is what makes the review screen a
 * diagnostic instead of a mood board — a player who reads three reviews
 * complaining about the wait has learnt something true about their pass.
 *
 * ------------------------------------------------------------- the tags
 *
 * Every review carries the tags it is *about*. `recurringProblems` counts
 * them across recent weeks, which is how the screen answers the question the
 * player is really asking: not "what did somebody say" but "what do I keep
 * getting wrong".
 */

export type ReviewTag =
  | "wait"
  | "quality"
  | "freshness"
  | "price"
  | "service"
  | "atmosphere"
  | "mistake"
  | "innovation"
  | "welcome";

export interface Review {
  id: string;
  week: number;
  /** A fictional first name and initial. Never a real person. */
  author: string;
  /** Segment id, so the screen can say who was unhappy. */
  segment: string;
  /** Service id the night was. */
  service: string;
  /** 1–5. Derived, never rolled on its own. */
  rating: number;
  /** The dish this table ordered, when there was a menu. */
  dish: string | null;
  /** Ticks between ordering and eating — a quarter-hour each. */
  wait: number;
  body: string;
  tags: ReviewTag[];
}

/** Enough to see a pattern without bloating a long save. */
export const MAX_REVIEWS = 24;

/**
 * Fictional diners.
 *
 * First name and an initial, in the manner of a review that has been
 * moderated — which is also why none of them can be mistaken for a real
 * person with an account somewhere.
 */
const FIRST = [
  "Marion",
  "Théo",
  "Camille",
  "Idris",
  "Beatriz",
  "Jonas",
  "Nadia",
  "Rowan",
  "Priya",
  "Anton",
  "Elke",
  "Sami",
  "Clara",
  "Hugo",
  "Yara",
  "Bram",
];

const INITIAL = ["A.", "B.", "C.", "D.", "F.", "H.", "K.", "L.", "M.", "R.", "S.", "V."];

const reviewer = (rng: Rng): string =>
  `${rng.pick(FIRST)} ${rng.pick(INITIAL)}`;

/* ------------------------------------------------------------ the facts */

/** Everything one review is allowed to know. All of it from the night. */
export interface ReviewFacts {
  week: number;
  service: string;
  serviceLabel: string;
  roomLabel: string;
  cityName: string;
  /** Ticks the average table waited. */
  wait: number;
  /** The worst wait anybody sat through. */
  worstWait: number;
  /** How long this service's customers will bear, in ticks. */
  patience: number;
  /** 0–100, what left the pass. */
  quality: number;
  /** 0–100, the night's own verdict. */
  satisfaction: number;
  mistakes: number;
  served: number;
  walked: number;
  /** Dishes sent out, most popular first. */
  dishes: { name: string; quality: number }[];
  /** Where the menu sits against the room's ordinary spend. */
  priceStand: number;
  /** The seven scores, for the categories a segment weighs. */
  scores: Record<StandingId, number>;
}

/**
 * Turn a resolved night into the facts a review may draw on.
 *
 * One place, so the review text and the reputation move are looking at the
 * same numbers. If this returns a wait of four ticks, no review can claim it
 * was seated immediately.
 */
export function factsFrom(
  k: KitchenState,
  report: ServiceReport,
  serviceLabel: string,
  patience: number,
  overall: number,
  week: number,
): ReviewFacts {
  return {
    week,
    service: report.service,
    serviceLabel,
    roomLabel: premisesOf(k).label.toLowerCase(),
    cityName: cityOf(k).name,
    wait: report.averageWait,
    worstWait: report.worstWait,
    patience,
    quality: report.quality,
    satisfaction: report.satisfaction,
    mistakes: report.mistakes,
    served: report.served,
    walked: report.walked,
    dishes: report.dishes
      .slice()
      .sort((a, b) => b.covers - a.covers)
      .map((d) => ({ name: d.name, quality: d.quality })),
    priceStand: priceStand(k),
    scores: standingOf(k, overall),
  };
}

/* ---------------------------------------------------------- the writing */

/**
 * One review, from one table.
 *
 * The rating is built, not rolled: it starts from what that segment thinks of
 * the categories it cares about, and every fact about the night that segment
 * would notice moves it. A luxury diner docks a point for a plate that came
 * back; a budget diner barely notices and docks two for the bill.
 */
export function writeReview(
  facts: ReviewFacts,
  mix: SegmentShare[],
  rng: Rng,
  index: number,
): Review {
  const segment = segmentAt(mix, rng.next());
  const tags: ReviewTag[] = [];
  const lines: string[] = [];

  /* The dish this table had. Real: it came off the night's own tally. */
  const dish =
    facts.dishes.length > 0
      ? facts.dishes[Math.min(facts.dishes.length - 1, Math.floor(rng.next() * Math.min(3, facts.dishes.length)))]
      : null;

  /* ---------------------------------------------------------- the rating */

  /* Start from how this restaurant scores on what they came for. */
  let score = 0;
  let weight = 0;
  for (const [id, w] of Object.entries(segment.wants)) {
    score += (facts.scores[id as StandingId] ?? 50) * (w ?? 0);
    weight += w ?? 0;
  }
  let rating = (weight > 0 ? score / weight : 50) / 20; // 0–5

  /* --------------------------------------------------------- the opening */

  lines.push(
    rng.chance(0.5)
      ? `${facts.serviceLabel} at the ${facts.roomLabel}.`
      : `Ate here on ${["Tuesday", "Thursday", "Friday", "Saturday"][Math.floor(rng.next() * 4)]}.`,
  );

  /* ------------------------------------------------------------ the wait */

  const patienceFor = facts.patience * segment.patience;
  if (facts.wait > patienceFor) {
    const over = facts.wait - patienceFor;
    rating -= Math.min(1.6, 0.5 + over * 0.35);
    tags.push("wait");
    lines.push(
      over >= 2
        ? `We waited ${quarters(facts.wait)} for food. Long enough to run out of things to say to each other.`
        : `A longer wait than it should have been — ${quarters(facts.wait)} between ordering and eating.`,
    );
  } else if (facts.wait <= patienceFor * 0.6 && facts.served > 0) {
    rating += 0.3;
    tags.push("service");
    lines.push(`Food arrived quickly, which for a full room is the hard part.`);
  }

  /* ------------------------------------------------------------ the food */

  if (dish) {
    const good = dish.quality >= 66;
    const poor = dish.quality <= 42;
    if (good) {
      rating += 0.45;
      tags.push("quality");
      lines.push(pickGoodDish(dish.name, rng));
    } else if (poor) {
      rating -= 0.6;
      tags.push(facts.scores.hygiene < 45 ? "freshness" : "quality");
      lines.push(pickPoorDish(dish.name, rng));
    } else {
      lines.push(`Had the ${dish.name.toLowerCase()}. Perfectly decent, nothing I will think about tomorrow.`);
    }
  } else if (facts.served > 0) {
    lines.push(
      `No menu to speak of — you get what they cooked, and on this evidence they cooked it competently.`,
    );
  }

  /* -------------------------------------------------------- the mistakes */

  if (facts.mistakes > 0 && rng.chance(Math.min(0.75, facts.mistakes / Math.max(4, facts.served / 8)))) {
    rating -= 0.7;
    tags.push("mistake");
    lines.push(
      rng.chance(0.5)
        ? `One plate went back to the kitchen. They replaced it without arguing, which counts for something.`
        : `Something arrived that was not what was ordered. It was sorted out, eventually.`,
    );
  }

  /* ----------------------------------------------------------- the price */

  if (facts.priceStand > 1.15 && segment.priceSensitivity > 0.4) {
    rating -= Math.min(1.2, (facts.priceStand - 1.15) * 3 * segment.priceSensitivity);
    tags.push("price");
    lines.push(`For what it is, it is dear. There are three places on this street doing the same for less.`);
  } else if (facts.priceStand < 0.9 && segment.priceSensitivity > 0.4) {
    rating += 0.35;
    tags.push("price");
    lines.push(`And the bill was less than I had braced for.`);
  } else if (facts.priceStand > 1.3 && segment.priceSensitivity <= 0.2) {
    lines.push(`Not cheap. It was not trying to be.`);
  }

  /* ------------------------------------------------------ the room itself */

  if ((segment.wants.atmosphere ?? 0) >= 0.2) {
    const room = facts.scores.atmosphere;
    if (room >= 65) {
      rating += 0.3;
      tags.push("atmosphere");
      lines.push(`The room is genuinely lovely to sit in, which is half of why you go out.`);
    } else if (room <= 38) {
      rating -= 0.4;
      tags.push("atmosphere");
      lines.push(`The room does it no favours. Bright, loud, and you can hear the pass from every table.`);
    }
  }

  /* --------------------------------------------------- what they came for */

  if ((segment.wants.innovation ?? 0) >= 0.2) {
    if (facts.scores.innovation >= 66) {
      rating += 0.3;
      tags.push("innovation");
      lines.push(`They are doing something here that nobody else in ${facts.cityName} is doing.`);
    } else if (facts.scores.innovation <= 35) {
      rating -= 0.35;
      tags.push("innovation");
      lines.push(`Safe. Everything on the menu is something I have eaten a hundred times.`);
    }
  }

  if (facts.walked > 0 && rng.chance(0.3)) {
    tags.push("service");
    lines.push(`The table beside us gave up and left before their food came.`);
  }

  if (rating >= 4.4 && rng.chance(0.5)) {
    tags.push("welcome");
    lines.push(`Booked again on the way out.`);
  }

  const final = Math.max(1, Math.min(5, Math.round(rating * 2) / 2));

  return {
    id: `rv-${facts.week}-${facts.service}-${index}`,
    week: facts.week,
    author: reviewer(rng),
    segment: segment.id,
    service: facts.service,
    rating: final,
    dish: dish?.name ?? null,
    wait: Math.round(facts.wait * 10) / 10,
    body: lines.join(" "),
    tags: [...new Set(tags)],
  };
}

/**
 * How many reviews a night produces.
 *
 * Busy nights are written about more, and a night that went badly is written
 * about more than one that went well — which is the single most reliable fact
 * about restaurant reviews. Capped at three so a season of reviews still fits
 * on a screen and in a save.
 */
export function reviewCount(report: ServiceReport, scrutiny: number): number {
  if (report.served <= 0) return 0;
  const base = report.served >= 60 ? 2 : 1;
  const angry = report.satisfaction < 45 || report.walked > 2 ? 1 : 0;
  const watched = scrutiny >= 45 ? 1 : 0;
  return Math.min(3, base + angry + watched);
}

const quarters = (ticks: number): string => {
  const minutes = Math.round(ticks * 15);
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `${hours} hour${hours === 1 ? "" : "s"}`
    : `${hours}h ${rest}m`;
};

const pickGoodDish = (name: string, rng: Rng): string =>
  rng.pick([
    `The ${name.toLowerCase()} was the best thing I have eaten this month.`,
    `Had the ${name.toLowerCase()}. Someone in that kitchen genuinely cares.`,
    `The ${name.toLowerCase()} is worth the trip on its own.`,
  ]);

const pickPoorDish = (name: string, rng: Rng): string =>
  rng.pick([
    `The ${name.toLowerCase()} arrived tired. You can taste when something has been sitting.`,
    `The ${name.toLowerCase()} was underwhelming — seasoned by somebody in a hurry.`,
    `Whatever the ${name.toLowerCase()} is meant to be, it was not that.`,
  ]);

/* ------------------------------------------------------- the diagnostics */

export interface RecurringProblem {
  tag: ReviewTag;
  label: string;
  count: number;
  /** Of how many reviews. */
  of: number;
  /** What to do about it, in the player's own controls. */
  fix: string;
}

const TAG_LABEL: Record<ReviewTag, string> = {
  wait: "People are waiting too long",
  quality: "The food is not landing",
  freshness: "The produce is tasting old",
  price: "The bill feels too high",
  service: "The service itself",
  atmosphere: "The room",
  mistake: "Plates going back",
  innovation: "Nothing here they cannot get elsewhere",
  welcome: "The welcome",
};

const TAG_FIX: Record<ReviewTag, string> = {
  wait: "Put somebody else on the pass, or simplify the plating in the service policy.",
  quality: "Refine the dishes you already have before adding another, and check who is cooking them.",
  freshness: "Order smaller and more often. Anything sitting in the pantry is costing you twice.",
  price: "Reprice the menu, or give the room a reason to pay it.",
  service: "The brigade screen names the station that fails first. Start there.",
  atmosphere: "A better room is the only real fix, and it is the most expensive thing on the list.",
  mistake: "Mistakes come from a kitchen under pressure. Rest somebody, or stop pushing the brigade.",
  innovation: "Develop something. A menu that has not changed in twenty weeks is the complaint.",
  welcome: "Nothing — this one is going right.",
};

/**
 * What keeps coming up.
 *
 * Counted over the reviews held, which is the last several weeks. Only
 * problems are returned — a compliment repeated is not something to fix — and
 * only ones that appear in at least a third of recent reviews, because two
 * unhappy tables in twenty is a restaurant, not a pattern.
 */
export function recurringProblems(reviews: Review[]): RecurringProblem[] {
  if (reviews.length < 3) return [];
  const counts = new Map<ReviewTag, number>();
  for (const review of reviews) {
    /* Only tags on a review that was actually unhappy count as a problem: the
       same "price" tag appears on "cheaper than I feared". */
    if (review.rating >= 3.5) continue;
    for (const tag of review.tags) {
      if (tag === "welcome") continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const threshold = Math.max(2, Math.ceil(reviews.length / 3));
  return [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({
      tag,
      label: TAG_LABEL[tag],
      count,
      of: reviews.length,
      fix: TAG_FIX[tag],
    }));
}

/** The average of what has been written recently, or null if nothing has. */
export function averageRating(reviews: Review[]): number | null {
  if (reviews.length === 0) return null;
  return (
    Math.round(
      (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10,
    ) / 10
  );
}

/** The season a review was written in, for the screen's grouping. */
export const reviewSeason = (review: Review): string =>
  seasonOf(review.week).label;
