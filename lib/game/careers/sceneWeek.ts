import type { RunState } from "../types";
import { makeRng } from "../rng";
import { pushLog } from "../engine";
import { MAX_FEED, MAX_MESSAGES, MAX_NEWS } from "../medical/phone";
import { applySocial } from "../medical/social";
import {
  activeMenu,
  cityOf,
  craftOf,
  kitCraft,
  knownRecipes,
  moraleOf,
  premisesOf,
  type KitchenState,
} from "./kitchen";
import { RECIPE_BY_ID } from "./recipes";
import type { ServiceReport } from "./service";
import { SERVICE_SHAPES } from "./service";
import { SERVICE_BY_ID } from "./kitchen";
import {
  applyStanding,
  recordStandingWeek,
  settleStanding,
  standingOf,
} from "./standing";
import { priceStand, roomComfort, seasonOf } from "./diners";
import type { Scene } from "./scene";
import {
  MAX_REVIEWS,
  factsFrom,
  reviewCount,
  writeReview,
  type Review,
} from "./reviews";
import {
  MAX_COMPLAINTS,
  ensureBuzz,
  openComplaints,
  spreadComplaint,
  type Complaint,
} from "./buzz";
import {
  MAX_VERDICTS,
  CRITIC_BY_ID,
  arrangeVisit,
  criticInterest,
  judgeVisit,
  nextClue,
  pickCritic,
} from "./critics";
import { moveRivals, STRATEGY_BY_ID } from "./competitors";
import { customerReactions, ensureChefPhone } from "./chefPhone";

/**
 * THE CITY'S WEEK
 *
 * Everything that happens *after* the food has been cooked and the money has
 * been counted: what people wrote, what they said to each other, whether a
 * critic came, what the other restaurants did, and what all of it did to the
 * seven parts of your standing.
 *
 * It is a module of its own rather than four hundred more lines inside
 * `resolveWeek` because it answers a different question. `resolveWeek` asks
 * what the restaurant did; this asks what the city made of it. Both run in
 * one deterministic pass off the same seed.
 *
 * ------------------------------------------------------------ the streams
 *
 * Three separate seeded streams — reviews, the critic, the rivals — for the
 * same reason the phone has its own: a change to how many reviews a night
 * produces must not shift which night a critic comes to. Nothing here touches
 * the service dice.
 */

export interface SceneWeek {
  /** One per service that ran. */
  nights: ServiceReport[];
  /** One per service that ran, in the same order. */
  scenes: Scene[];
  /** Weighted plate quality across the week, 0–100. */
  quality: number;
  served: number;
  mistakes: number;
  walkedOut: number;
}

/** Enough history to say whether a kitchen is the same twice. */
const MAX_QUALITY_LOG = 8;

export function resolveScene(s: RunState, k: KitchenState, week: SceneWeek): void {
  const phone = ensureChefPhone(k);

  /* ------------------------------------------------------------- reviews */
  const rngReview = makeRng((s.seed ^ (s.week * 0x51_63_1f_37)) >>> 0);
  const written: Review[] = [];

  for (let i = 0; i < week.nights.length; i++) {
    const report = week.nights[i];
    const scene = week.scenes[i] ?? week.scenes[0];
    if (!scene) continue;
    const sv = SERVICE_BY_ID.get(report.service);
    const shape = SERVICE_SHAPES[report.service];
    const facts = factsFrom(
      k,
      report,
      sv?.label ?? "Dinner",
      (shape?.patience ?? 5) * scene.patience,
      s.r.reputation,
      s.week,
    );
    const count = reviewCount(report, phone.social.scrutiny);
    for (let n = 0; n < count; n++) {
      written.push(writeReview(facts, scene.mix, rngReview, n));
    }
  }

  if (written.length > 0) {
    k.reviews = [...written, ...(k.reviews ?? [])].slice(0, MAX_REVIEWS);
  }

  /* -------------------------------------------------- what customers posted */
  const rngPost = makeRng((s.seed ^ (s.week * 0x2c_1b_3d_45)) >>> 0);
  const worstNight = week.nights
    .slice()
    .sort((a, b) => a.satisfaction - b.satisfaction)[0];

  if (worstNight) {
    const topTally = worstNight.dishes
      .slice()
      .sort((a, b) => b.covers - a.covers)[0];
    const signature = knownRecipes(k).find((p) => p.signature);
    const topRecipe = topTally
      ? [...RECIPE_BY_ID.values()].find((r) => r.name === topTally.name)
      : undefined;
    const scene = week.scenes[0];

    const reactions = customerReactions(
      {
        week: s.week,
        served: week.served,
        walked: week.walkedOut,
        mistakes: week.mistakes,
        wait: worstNight.averageWait,
        satisfaction: worstNight.satisfaction,
        quality: week.quality,
        topDish: topTally
          ? {
              name: topTally.name,
              quality: topTally.quality,
              covers: topTally.covers,
            }
          : null,
        topIsSignature:
          !!signature && !!topRecipe && signature.id === topRecipe.id,
        worstMorale:
          k.staff.length > 0 ? Math.min(...k.staff.map((x) => moraleOf(x))) : null,
        segmentLabel: scene?.mix[0]?.segment.label ?? "Local regulars",
        presentation: topRecipe?.presentation ?? 45,
        followers: phone.social.followers,
        scrutiny: phone.social.scrutiny,
      },
      rngPost,
    );

    for (const reaction of reactions) {
      phone.feed = [reaction.post, ...phone.feed].slice(0, MAX_FEED);
      applySocial(phone.social, reaction.social);
      for (const move of reaction.moves) {
        applyStanding(s, move.about, move.delta, move.why);
      }
      if (reaction.complaint) {
        const complaint: Complaint = {
          id: `cmp-${s.week}-${reaction.complaint.about}`,
          week: s.week,
          author: reaction.complaint.author,
          segment: reaction.complaint.segment,
          about: reaction.complaint.about,
          accurate: reaction.complaint.accurate,
          body: reaction.complaint.body,
          reach: reaction.complaint.reach,
        };
        k.complaints = [complaint, ...(k.complaints ?? [])].slice(
          0,
          MAX_COMPLAINTS,
        );
        pushLog(
          s,
          `${complaint.author} has complained publicly, and people are sharing it. It needs an answer.`,
          "bad",
        );
      }
    }
  }

  /* ------------------------------------------- unanswered complaints spread */
  for (const complaint of openComplaints(k)) {
    if (complaint.week === s.week) continue;
    complaint.reach = spreadComplaint(complaint, phone.social.scrutiny, rngPost);
    /* Six weeks and it has burnt out on its own, whatever you did or did not
       do. Silence is a strategy; it is simply an expensive one while it is
       being read. */
    if (s.week - complaint.week >= 6) {
      complaint.closed = true;
      complaint.outcome =
        "Nobody is talking about this any more. It ran its course.";
    }
  }

  /* --------------------------------------------------------------- critics */
  resolveCritic(s, k, week);

  /* ---------------------------------------------------------------- rivals */
  const rngRival = makeRng((s.seed ^ (s.week * 0x7e_2a_11_09)) >>> 0);
  const signature = knownRecipes(k).find((p) => p.signature);
  const signatureLabel = signature
    ? (RECIPE_BY_ID.get(signature.id)?.name ?? null)
    : null;
  const moves = moveRivals(
    k,
    s.r.reputation,
    s.week,
    signatureLabel,
    k.staff.length > 0 ? Math.min(...k.staff.map((x) => moraleOf(x))) : null,
    rngRival,
  );

  for (const move of moves) {
    if (move.loud) {
      phone.news = [
        {
          id: `rival-${s.week}-${move.strategy}`,
          week: s.week,
          outlet: `The ${cityOf(k).name} food pages`,
          headline: `${move.rival}: ${STRATEGY_BY_ID.get(move.strategy)?.label ?? "changes tack"}`,
          body: move.note,
          tone: move.strategy === "collaborate"
            ? ("good" as const)
            : ("bad" as const),
          read: false,
        },
        ...phone.news,
      ].slice(0, MAX_NEWS);
    }
    if (move.strategy === "poach") {
      /* A rival that is hiring is hiring from *somebody*, and the phone's
         existing poaching thread is where that conversation happens. */
      const target = k.staff
        .slice()
        .sort((a, b) => moraleOf(a) - moraleOf(b))[0];
      if (target && !phone.messages.some((m) => m.id === `poach-${target.id}`)) {
        phone.messages = [
          {
            id: `poach-${target.id}`,
            week: s.week,
            from: move.rival,
            handle: "@" + move.rival.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12),
            role: "rival" as const,
            body: `We are opening a section and your name came up as somebody who might know a good ${target.name.split(" ")[0]}. I would rather ask you than go behind you. Match what we are offering and I will drop it.`,
            read: false,
            choices: [
              {
                label: "Match it",
                detail: "A permanent rise, and they know you moved first",
                effect: {},
                reply: "You put the rise through before service. Nothing was said, and everything was.",
              },
              {
                label: "Let them decide",
                detail: "No rise. Loyalty takes the hit",
                effect: {},
                reply: "You said nothing. They noticed that too.",
              },
            ],
          },
          ...phone.messages,
        ].slice(0, MAX_MESSAGES);
      }
    }
    pushLog(s, move.note, move.strategy === "collaborate" ? "neutral" : "bad");
  }

  /* ------------------------------------------------ what the restaurant is */
  settleWeek(s, k, week);

  /* And the record of where the seven stood at the end of it. */
  recordStandingWeek(s);
}

/* --------------------------------------------------------------- the critic */

function resolveCritic(s: RunState, k: KitchenState, week: SceneWeek): void {
  const phone = ensureChefPhone(k);
  const rng = makeRng((s.seed ^ (s.week * 0x1b_9d_44_c7)) >>> 0);
  const watch = k.criticWatch;

  /* A visit that is due, and a night for them to have come to. */
  if (watch && s.week >= watch.dueWeek) {
    const critic = CRITIC_BY_ID.get(watch.critic);
    if (!critic) {
      k.criticWatch = undefined;
      return;
    }
    const night = week.nights[0];
    const sv = night ? SERVICE_BY_ID.get(night.service) : undefined;
    const verdict = judgeVisit(critic, k, s.r.reputation, {
      week: s.week,
      serviceLabel: sv?.label ?? "a quiet night",
      plate: week.quality,
      wait: night?.averageWait ?? 0,
      mistakes: week.mistakes,
      walked: week.walkedOut,
      served: week.served,
    });

    for (const move of verdict.moves) {
      applyStanding(s, move.id, move.delta, move.why, false);
    }

    const buzz = ensureBuzz(k);
    buzz.interest = Math.min(1.45, buzz.interest * verdict.interest);
    buzz.expectation = Math.min(30, buzz.expectation + verdict.expectation);

    if (verdict.award) {
      /*
       * An award is a record and a burden, never an ending. The career
       * continues on the following Monday with a harder problem in it: every
       * table from here has read the review.
       */
      k.awards = [...(k.awards ?? []), { week: s.week, label: verdict.award }];
      pushLog(s, `${verdict.award}. Service is still at six.`, "good");
    }

    k.verdicts = [verdict, ...(k.verdicts ?? [])].slice(0, MAX_VERDICTS);
    phone.news = [
      {
        id: `verdict-${s.week}`,
        week: s.week,
        outlet: critic.outlet,
        headline: `${critic.name} on your kitchen — ${verdict.score} out of 100`,
        body: verdict.body,
        tone:
          verdict.score >= 62
            ? ("good" as const)
            : verdict.score >= 45
              ? ("neutral" as const)
              : ("bad" as const),
        read: false,
      },
      ...phone.news,
    ].slice(0, MAX_NEWS);
    phone.social.followers += Math.round(verdict.score * 12);
    phone.social.scrutiny = Math.min(100, phone.social.scrutiny + 6);
    k.criticWatch = undefined;
    return;
  }

  /* A further clue while one is pending. */
  if (watch) {
    if (rng.chance(0.5)) {
      const critic = CRITIC_BY_ID.get(watch.critic);
      const clue = critic ? nextClue(watch, critic, rng) : null;
      if (clue) {
        watch.clues = [...watch.clues, clue];
        pushLog(s, clue, "neutral");
      }
    }
    return;
  }

  /* Or one takes an interest. Never at random: this is a function of the
     restaurant's standing, its following and whether it keeps selling out. */
  const odds = criticInterest(s.r.reputation, phone.social.followers, k.streak);
  if (odds > 0 && rng.chance(odds)) {
    const critic = pickCritic(k, s.r.reputation, rng);
    k.criticWatch = arrangeVisit(critic, s.week, rng);
    pushLog(
      s,
      `Somebody has been asking about you. ${k.criticWatch.clues[0]}`,
      "neutral",
    );
    phone.social.scrutiny = Math.min(100, phone.social.scrutiny + 4);
  }
}

/* ------------------------------------------------- what the restaurant is */

/**
 * The five categories that describe the restaurant rather than the week.
 *
 * These *settle* — they move toward what is demonstrably true and never touch
 * the overall reputation. See the long note on `settleStanding` for why the
 * model has two kinds of movement and why this one is not allowed to move the
 * number the economy runs on.
 */
function settleWeek(s: RunState, k: KitchenState, week: SceneWeek): void {
  const scores = standingOf(k, s.r.reputation);
  const room = premisesOf(k);

  /* -------------------------------------------------------------- the room */
  const full =
    week.served > 0 ? Math.min(1, week.served / Math.max(1, room.capacity)) : 0;
  const atmosphere =
    roomComfort(k) + kitCraft(k) * 3 + full * 14 + (k.staff.length > 0 ? 6 : 0);
  settleStanding(
    s,
    "atmosphere",
    atmosphere,
    2,
    `${room.label} with ${k.staff.length} on the floor, ${Math.round(full * 100)}% full`,
  );

  /* ------------------------------------------------------------- the value */
  const stand = priceStand(k);
  const value = 52 + (week.quality - 55) * 0.5 - (stand - 1) * 62;
  settleStanding(
    s,
    "value",
    value,
    2,
    stand > 1.08
      ? `Priced ${Math.round((stand - 1) * 100)}% above what this room usually charges`
      : stand < 0.94
        ? `Priced ${Math.round((1 - stand) * 100)}% below what this room usually charges`
        : "Priced about where this room is expected to be",
  );

  /* ------------------------------------------------------- the consistency */
  if (week.served > 0) {
    k.qualityLog = [...(k.qualityLog ?? []), week.quality].slice(-MAX_QUALITY_LOG);
  }
  const log = k.qualityLog ?? [];
  if (log.length >= 3) {
    const mean = log.reduce((a, b) => a + b, 0) / log.length;
    const variance =
      log.reduce((n, q) => n + (q - mean) ** 2, 0) / log.length;
    const swing = Math.sqrt(variance);
    settleStanding(
      s,
      "consistency",
      Math.max(0, 92 - swing * 4.5),
      1.6,
      swing <= 5
        ? `Plate quality has moved by ${swing.toFixed(1)} points across ${log.length} weeks`
        : `Plate quality has swung ${swing.toFixed(1)} points across ${log.length} weeks`,
    );
  }

  /* ----------------------------------------------------------- the hygiene */
  const waste = s.r._wasteCost ?? 0;
  const turnover = Math.max(1, s.r._lastRevenue ?? 0);
  const share = Math.min(1, waste / turnover);
  settleStanding(
    s,
    "hygiene",
    Math.max(0, 82 - share * 190),
    1.2,
    share <= 0.02
      ? "Almost nothing was thrown away this week"
      : `${Math.round(share * 100)}% of the week's takings went in the bin`,
  );

  /* -------------------------------------------------------- the innovation */
  const menu = activeMenu(k);
  const originality =
    menu.length > 0
      ? menu.reduce(
          (n, entry) => n + (RECIPE_BY_ID.get(entry.recipe)?.originality ?? 40),
          0,
        ) / menu.length
      : 30;
  const signature = knownRecipes(k).some((p) => p.signature) ? 10 : 0;
  /* A menu that has not changed since spring is not an innovative menu,
     whatever is on it. */
  const stale = Math.min(24, Math.max(0, s.week - (k.menuChangedWeek ?? 0)) * 0.8);
  settleStanding(
    s,
    "innovation",
    originality + signature + craftOf(k) * 2 - stale,
    1.5,
    stale >= 10
      ? `The menu has not changed for ${Math.round(stale / 0.8)} weeks`
      : `Menu originality ${Math.round(originality)}${signature ? ", and a signature dish" : ""}`,
  );

  /* And the season, which nobody controls. */
  const season = seasonOf(s.week);
  if (season.id === "summer" && cityOf(k).shelfLife <= 0) {
    settleStanding(
      s,
      "hygiene",
      scores.hygiene - 6,
      0.8,
      "Summer, and everything in the building is dying faster than usual",
    );
  }
}
