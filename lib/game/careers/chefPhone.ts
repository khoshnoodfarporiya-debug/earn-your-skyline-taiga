import type { Rng } from "../types";
import type {
  FeedPost,
  NewsItem,
  PhoneState,
  PostEffect,
} from "../medical/types";
import { MAX_FEED, MAX_MESSAGES, MAX_NEWS } from "../medical/phone";
import type { KitchenState } from "./kitchen";
import {
  activeMenu,
  cityOf,
  knownRecipes,
  loyaltyOf,
  moraleOf,
  premisesOf,
  skillOf,
} from "./kitchen";
import { RECIPE_BY_ID, recipeName } from "./recipes";
import type { StandingId } from "./standing";
import { reachFactor, reachWord } from "./buzz";

/**
 * THE CHEF'S PHONE
 *
 * Same handset, different city. The *shapes* here — `PhoneState`, `FeedPost`,
 * `PhoneMessage`, `NewsItem` — are career-neutral and shared with the
 * Physician (they live in `medical/types.ts` for historical reasons; nothing
 * in them is medical). Everything with *words* in it is this file's, because
 * a Chef's phone is full of suppliers, critics and regulars, not colleagues
 * and case studies.
 *
 * ------------------------------------------------------------ ground rules
 *
 * The feed never contradicts the simulation. A review only appears after a
 * service that actually ran, and its tone is computed from the plate quality
 * the week actually produced — the same number the reputation move came from.
 * The phone is how the week *sounds*; it is never a second simulation.
 *
 * Generation is deterministic: everything is drawn from the seeded stream the
 * career passes in, so the same run always produces the same phone.
 */

/* ------------------------------------------------------------ the accounts */

/**
 * Who talks in this city's food scene. All fictional, and none of them shared
 * with the Physician's world — a different career follows different people.
 */
export const CHEF_VOICES = {
  blogger: { name: "Léa Fontaine", handle: "@forkandknife" },
  regulars: { name: "Table for Two", handle: "@tablefortwo" },
  tradePress: { name: "The Pass", handle: "@thepassdaily" },
  market: { name: "The Covered Market", handle: "@marchecouvert" },
  rivalKitchen: { name: "Salt & Cinders", handle: "@saltandcinders" },
  critic: { name: "Pascale Arnaud", handle: "@p.arnaud" },
  rivalChef: { name: "Aurélien Marchal", handle: "@marchal_cuisine" },
  booker: { name: "Émile Berger", handle: "@berger_events" },
  mentor: { name: "Chef Renard", handle: "@renard" },
} as const;

/** Accounts that are institutions, for the Avatar's rounded treatment. */
export const CHEF_ORG_HANDLES = [
  "@thepassdaily",
  "@marchecouvert",
  "@saltandcinders",
  "@berger_events",
] as const;

/* -------------------------------------------------------------- the start */

export function chefInitialPhone(): PhoneState {
  return {
    social: { followers: 140, trust: 50, sentiment: 52, scrutiny: 0 },
    feed: [],
    messages: [
      {
        id: "welcome",
        week: 1,
        from: CHEF_VOICES.mentor.name,
        handle: CHEF_VOICES.mentor.handle,
        role: "peer",
        body: "So you actually did it. One piece of advice and then I will leave you alone: buy what you can sell, sell what you bought, and never argue with a critic in public. Call me when the first week is over.",
        read: false,
      },
    ],
    news: [],
    lastPostWeek: 0,
    postsMade: [],
    recruitBoost: 0,
  };
}

/** The phone, created on first touch so a save from before it existed gains
    one instead of being rejected. */
export function ensureChefPhone(k: KitchenState): PhoneState {
  if (!k.phone) k.phone = chefInitialPhone();
  return k.phone;
}

export const canPostChefWeek = (k: KitchenState, week: number): boolean =>
  (k.phone?.lastPostWeek ?? 0) < week;

/* ---------------------------------------------------------------- identity */

/**
 * What your standing reads as, in kitchen words. The Physician's version says
 * "waiting room" and "patients"; this one had to be its own.
 */
export function chefIdentityOf(social: PhoneState["social"]): {
  label: string;
  blurb: string;
} {
  const { followers, trust, sentiment, scrutiny } = social;
  if (followers < 300 && trust <= 56) {
    return {
      label: "Unknown kitchen",
      blurb: "Nobody who has not walked past knows you exist yet.",
    };
  }
  if (scrutiny >= 55 && followers > 2_500) {
    return {
      label: "The talked-about table",
      blurb:
        "Everyone has an opinion about you, and half of them have never eaten here.",
    };
  }
  if (trust >= 70 && sentiment >= 62) {
    return {
      label: "The safe pair of hands",
      blurb:
        "People book here for the nights that matter. That took years off you.",
    };
  }
  if (followers >= 4_000) {
    return {
      label: "The name on everyone's list",
      blurb:
        "Getting a table is a story people tell. Keeping it that way is the job.",
    };
  }
  return {
    label: "The local room",
    blurb:
      "Known on this street, unknown two streets over. Every full house helps.",
  };
}

/* ------------------------------------------------------------ the composer */

export interface ChefPostContext {
  week: number;
  cityName: string;
  roomLabel: string;
  staffName: string | null;
  staffCount: number;
  served: number;
  quality: number;
  freshness: number;
  soldOutStreak: number;
  supplierName: string | null;
  followers: number;
  /* ------------------------------------------------------------ phase 3
   *
   * Everything below is a *fact about the restaurant* that a post can be
   * built from. A post that cannot find its fact is not offered, which is the
   * rule that keeps the composer honest: there is no "announce your award"
   * button until there is an award.
   */
  /** The dish the kitchen is known for, if one has been earned. */
  signature: string | null;
  /** The newest thing on the menu, for the dish announcement. */
  newestDish: { recipe: string; name: string } | null;
  /** The room, if it was upgraded recently enough to be news. */
  renovated: string | null;
  /** Somebody who has just been promoted or has finished training. */
  achiever: string | null;
  /** The most recent award, if any. */
  award: string | null;
  /** A booked service coming up or just run, for the event post. */
  eventLabel: string | null;
  /** How much of a post will actually land, 0.4–1. */
  reach: number;
  /** How high the bar already is. Shown so the trade is visible. */
  expectation: number;
}

/**
 * What a post does to the *restaurant*, as opposed to the phone.
 *
 * The social half is `effect` and goes through `applySocial` exactly as the
 * Physician's does. This half is the Chef's own, and it is where the trade
 * lives: `interest` fills the room next week, `expectation` raises the bar
 * every night is judged against afterwards, `promote` makes the room order one
 * particular dish, and `claim` is the promise you will be held to.
 */
export interface ChefPostEffect {
  interest?: number;
  expectation?: number;
  /** Recipe id whose share of the room's orders rises for three weeks. */
  promote?: "signature" | "newest";
  /** A public promise about one part of the restaurant, and how big. */
  claim?: { about: StandingId; size: number };
  /** Morale for everybody, for the posts that are about the brigade. */
  morale?: number;
}

export interface ChefPostDef {
  id: string;
  category: string;
  label: string;
  blurb: string;
  body: (c: ChefPostContext) => string;
  available: (c: ChefPostContext) => boolean;
  once?: boolean;
  hazard?: number;
  effect: PostEffect;
  /** The restaurant-side effect. Absent means the post is only social. */
  chef?: ChefPostEffect;
  preview: string[];
  backfire?: { effect: PostEffect; note: string };
}

export function chefPostContext(
  k: KitchenState,
  week: number,
): ChefPostContext {
  const last = k.lastService;
  const bestSupplier = Object.entries(k.suppliers ?? {}).sort(
    (a, b) => b[1] - a[1],
  )[0];

  /* The signature, if one has been earned by cooking it enough times. */
  const signatureProgress = knownRecipes(k).find((p) => p.signature);
  const signatureRecipe = signatureProgress
    ? RECIPE_BY_ID.get(signatureProgress.id)
    : undefined;

  /*
   * The newest thing on the menu. "Newest" is the last entry added, which is
   * how `addDish` appends — so the post is about the dish the player just put
   * on rather than about a random one.
   */
  const menu = activeMenu(k);
  const lastEntry = menu[menu.length - 1];
  const lastRecipe = lastEntry ? RECIPE_BY_ID.get(lastEntry.recipe) : undefined;

  /* Somebody who has just come up. Promotion writes `promotedWeek`. */
  const achiever = k.staff.find(
    (x) => (x.promotedWeek ?? 0) > 0 && week - (x.promotedWeek ?? 0) <= 3,
  );

  /* The room, if it changed hands recently enough to be worth saying. */
  const renovated =
    (k.renovatedWeek ?? 0) > 0 && week - (k.renovatedWeek ?? 0) <= 3
      ? premisesOf(k).label
      : null;

  const awards = k.awards ?? [];
  const newestAward = awards[awards.length - 1];

  /* A booked service the kitchen has actually run recently. */
  const booked = (last?.lines ?? []).find(
    (line) => line.id === "event" || line.id === "tasting",
  );

  return {
    week,
    cityName: cityOf(k).name,
    roomLabel: premisesOf(k).label.toLowerCase(),
    staffName: k.staff[0]?.name ?? null,
    staffCount: k.staff.length,
    served: last?.served ?? 0,
    quality: last?.quality ?? 0,
    freshness: last?.freshness ?? 0,
    soldOutStreak: k.streak,
    supplierName:
      bestSupplier && bestSupplier[1] >= 20 ? bestSupplier[0] : null,
    followers: k.phone?.social.followers ?? 0,
    signature:
      signatureRecipe && signatureProgress
        ? recipeName(signatureRecipe, signatureProgress)
        : null,
    newestDish:
      lastEntry && lastRecipe
        ? {
            recipe: lastRecipe.id,
            name: recipeName(
              lastRecipe,
              knownRecipes(k).find((p) => p.id === lastRecipe.id),
            ),
          }
        : null,
    renovated,
    achiever: achiever?.name ?? null,
    award: newestAward && week - newestAward.week <= 4 ? newestAward.label : null,
    eventLabel: booked
      ? booked.id === "event"
        ? "the private dinner"
        : "the tasting menu"
      : null,
    reach: reachFactor(k, week),
    expectation: Math.round(k.buzz?.expectation ?? 0),
  };
}

/** How the reach term reads on the composer, in one line. */
export const chefReachLine = (c: ChefPostContext): string => reachWord(c.reach);

/** Whether the bar has been raised far enough to warn about it. */
export const chefExpectationLine = (c: ChefPostContext): string | null =>
  c.expectation >= 8
    ? `Expectations are ${c.expectation} points above where they would be. Every night from here is judged against what you have promised.`
    : null;

export const CHEF_POSTS: ChefPostDef[] = [
  {
    id: "pans_on",
    category: "opening",
    label: "The pans are on",
    blurb: "Tell the city you exist.",
    body: (c) =>
      `The pans are on in ${c.cityName}. A ${c.roomLabel}, a short menu, and everything cooked the day you eat it. Come and find us.`,
    available: () => true,
    once: true,
    effect: { followers: 120, trust: 2, sentiment: 3 },
    preview: ["People learn you exist", "A modest, honest start"],
  },
  {
    id: "new_dish",
    category: "menu",
    label: "Tonight's plate",
    blurb: "Show the dish while it is worth showing.",
    body: (c) =>
      `What left the pass tonight. No tweezers, no foam — just what the market had this morning, cooked like it matters. ${c.served} plates and not one came back.`,
    available: (c) => c.served > 0 && c.quality >= 60,
    effect: { followers: 90, sentiment: 4, reputation: 1 },
    chef: { interest: 0.06, expectation: 3, claim: { about: "food", size: 62 } },
    preview: [
      "Only postable after a genuinely good service",
      "People start arriving hungry for one thing",
      "You have now told the city your food is good. It has to keep being good",
    ],
  },
  {
    id: "put_it_on",
    category: "menu",
    label: "New on the menu",
    blurb: "Point the room at the dish you just put on.",
    body: (c) =>
      `New from tonight: ${c.newestDish?.name ?? "something we have been working on"}. On for as long as the season holds it, and not a day after.`,
    available: (c) => c.newestDish !== null,
    effect: { followers: 55, sentiment: 2 },
    chef: {
      interest: 0.05,
      expectation: 2,
      promote: "newest",
      claim: { about: "innovation", size: 55 },
    },
    preview: [
      "About a third of the room will order that dish for three weeks",
      "Make sure you have the ingredients for it",
      "Promoting a dish you cannot cook well is the fastest way to a bad week",
    ],
  },
  {
    id: "signature",
    category: "menu",
    label: "The dish we are known for",
    blurb: "The one people come here for. Say it out loud.",
    body: (c) =>
      `Ask anybody who has eaten here what they had. It will be the ${c.signature?.toLowerCase() ?? "same dish"}. Twelve months of getting it wrong before we got it right.`,
    available: (c) => c.signature !== null,
    effect: { followers: 210, sentiment: 5, trust: 3 },
    chef: {
      interest: 0.12,
      expectation: 6,
      promote: "signature",
      claim: { about: "food", size: 70 },
    },
    preview: [
      "The biggest safe reach on this list — a signature is earned, not claimed",
      "Half the room will order it. It had better be good every single night",
    ],
  },
  {
    id: "renovation",
    category: "room",
    label: "The new room",
    blurb: "Show them where they will be sitting.",
    body: (c) =>
      `We have moved. ${c.renovated ?? "The new room"} — more space, better light, and a pass you can actually see from the tables. Same cooking, somewhere worth eating it.`,
    available: (c) => c.renovated !== null,
    effect: { followers: 140, sentiment: 4, trust: 2 },
    chef: { interest: 0.1, expectation: 4, claim: { about: "atmosphere", size: 60 } },
    preview: [
      "A room people want to sit in brings the tourists and the business tables",
      "They will arrive expecting the room to be as good as the photograph",
    ],
  },
  {
    id: "staff_win",
    category: "people",
    label: "One of ours",
    blurb: "Somebody on your line just came up. Say whose kitchen they did it in.",
    body: (c) =>
      `${c.achiever ?? "One of the brigade"} started here washing down at ten at night and runs a section now. Nobody arrives finished. This is how it is supposed to work.`,
    available: (c) => c.achiever !== null,
    effect: { followers: 70, trust: 5, sentiment: 4 },
    chef: { morale: 6, interest: 0.02 },
    preview: [
      "Trust rises further than any dish post — people believe a kitchen that promotes from inside",
      "Morale across the whole brigade, and it is not small",
      "Costs you nothing and raises no expectations",
    ],
  },
  {
    id: "award",
    category: "press",
    label: "About that review",
    blurb: "Somebody wrote something. Repeat it.",
    body: (c) =>
      `${c.award ?? "A very kind review"}. Written about a kitchen that was a market stall two years ago. Thank you, and the table is still the same size.`,
    available: (c) => c.award !== null,
    effect: { followers: 380, sentiment: 6, scrutiny: 8 },
    chef: { interest: 0.16, expectation: 9, claim: { about: "food", size: 74 } },
    preview: [
      "The furthest-reaching post in the composer",
      "And the most expensive: everybody who comes now has read the review first",
    ],
  },
  {
    id: "the_event",
    category: "service",
    label: "What we did on Saturday",
    blurb: "The private work nobody sees. Shows the room what you can do.",
    body: (c) =>
      `Behind the scenes at ${c.eventLabel ?? "Saturday's dinner"} — one sitting, one menu, forty covers and no second chances. This is the work that pays for the Tuesdays.`,
    available: (c) => c.eventLabel !== null,
    effect: { followers: 95, trust: 4, sentiment: 3 },
    chef: { interest: 0.07, expectation: 2 },
    preview: [
      "Event clients read this kind of post and book off it",
      "Modest expectations — you are showing work, not making a promise",
    ],
  },
  {
    id: "market_morning",
    category: "supplier",
    label: "Morning at the market",
    blurb: "Show where the food comes from.",
    body: () =>
      `Five in the morning at the stalls. If you want to know why the plate tastes like that, this is why. Buy close, cook the same day.`,
    available: (c) => c.supplierName !== null,
    effect: { followers: 40, trust: 3 },
    preview: [
      "Trust rises — people believe the plate",
      "The traders notice you said it",
    ],
  },
  {
    id: "meet_brigade",
    category: "people",
    label: "Meet the brigade",
    blurb: "Put a face on the kitchen.",
    body: (c) =>
      `This is ${c.staffName}. Turns up before anyone, sharpens everything twice, and the reason your plate arrives hot. A kitchen is its people.`,
    available: (c) => c.staffName !== null,
    effect: { followers: 30, trust: 3, sentiment: 2 },
    preview: [
      "The room feels seen — morale rises",
      "Regulars start greeting them by name",
    ],
  },
  {
    id: "full_house",
    category: "service",
    label: "Full house",
    blurb: "Say it while it is true.",
    body: (c) =>
      `Sold out again — ${c.soldOutStreak} week${c.soldOutStreak === 1 ? "" : "s"} running. Book, or charm somebody who did.`,
    available: (c) => c.soldOutStreak > 0,
    effect: { followers: 160, sentiment: 2, scrutiny: 4 },
    preview: [
      "Nothing fills a room like not getting in",
      "Being watched cuts both ways — a bad night now travels",
    ],
  },
  {
    id: "behind_pass",
    category: "kitchen",
    label: "Behind the pass",
    blurb: "The unglamorous truth of prep.",
    body: () =>
      `Stock on at seven, bones roasted, herbs picked. Nobody photographs this part, which is exactly why it tastes the way it does.`,
    available: () => true,
    effect: { followers: 30, trust: 1 },
    chef: { morale: 2 },
    preview: [
      "Slow and steady — nothing to lose",
      "The brigade sees itself described as the reason it tastes good",
    ],
  },
  {
    id: "apology",
    category: "service",
    label: "About last night",
    blurb: "Own the bad service before someone else describes it.",
    body: () =>
      `Last night was not our standard, and if you were in the room you know it. No excuses. Come back and let us cook you what we meant to.`,
    available: (c) => c.served > 0 && c.quality < 45,
    effect: { followers: -20, trust: 5, sentiment: 6 },
    preview: [
      "Only postable after a genuinely bad night",
      "You lose a few followers and keep the room's respect",
    ],
  },
  {
    id: "no_menu",
    category: "menu",
    label: "Nine courses, no menu",
    blurb: "The loud claim. It travels furthest and falls hardest.",
    body: () =>
      `One sitting. Nine courses. No menu, no choices, no photographs of it before you eat it. Trust the kitchen or stay home.`,
    available: (c) => c.followers >= 800,
    hazard: 0.25,
    effect: { followers: 260, sentiment: 3, scrutiny: 5 },
    chef: { interest: 0.14, expectation: 12, claim: { about: "food", size: 80 } },
    preview: [
      "The biggest reach on this list",
      "A quarter of the time the city decides you are pretentious instead",
      "And it is the loudest promise you can make — a bad night after this one is very expensive",
    ],
    backfire: {
      effect: { followers: 40, sentiment: -5, scrutiny: 8 },
      note: "The replies are jokes about tweezers, and they are being shared more than the post.",
    },
  },
];

export const CHEF_POST_BY_ID = new Map(CHEF_POSTS.map((p) => [p.id, p]));

/* --------------------------------------------------------------- the week */

const push = <T,>(list: T[], item: T, cap: number): T[] =>
  [item, ...list].slice(0, cap);

/**
 * What the city says and sends this week.
 *
 * Called at the end of `resolveWeek`, after `lastService` is written, so
 * every review talks about a night that genuinely happened. Draws only from
 * the stream it is handed, so the phone is as replayable as the ledger.
 */
export function generateChefWeek(
  k: KitchenState,
  week: number,
  reputation: number,
  rng: Rng,
): void {
  const phone = ensureChefPhone(k);
  const last = k.lastService;

  /* ------------------------------------------------ reviews of real nights */
  if (last && last.served > 0) {
    const q = last.quality;
    const tone: FeedPost["tone"] =
      q >= 68 ? "good" : q <= 42 ? "bad" : "neutral";
    const voice = rng.chance(0.5) ? CHEF_VOICES.blogger : CHEF_VOICES.regulars;

    const body =
      tone === "good"
        ? last.freshness >= 0.7
          ? `Ate at the ${premisesOf(k).label.toLowerCase()} last night. Everything tasted like it was bought this morning — because, you suspect, it was. Go before the queue finds out.`
          : `Very good night at the ${premisesOf(k).label.toLowerCase()}. Confident cooking, room humming, plates landing hot. This kitchen knows what it is.`
        : tone === "bad"
          ? last.freshness < 0.45
            ? `Wanted to love it. But the plates came out tired — you can taste a larder that has been sitting too long. This kitchen can do better and knows it.`
            : `A rough night at the ${premisesOf(k).label.toLowerCase()}. Long waits, uneven plates. Off nights happen; two in a row is a habit.`
          : `Solid, unspectacular dinner. Fair prices, honest plates. The sort of place you go back to on a Tuesday, which is a compliment.`;

    phone.feed = push(
      phone.feed,
      {
        id: `rev-${week}`,
        week,
        author: voice.name,
        handle: voice.handle,
        kind: "world",
        body,
        likes: Math.round(
          6 +
            phone.social.followers / 60 +
            (tone === "bad" ? 14 : 4) * rng.next(),
        ),
        comments: [],
        tone,
      },
      MAX_FEED,
    );

    /*
     * The review moves the phone's own metrics — never reputation, which the
     * service already moved. Scrutiny amplifies the bad nights: that is the
     * mechanical meaning of being watched, and it is what the warning on the
     * profile screen is warning about.
     */
    const watch = 1 + phone.social.scrutiny / 100;
    if (tone === "good") {
      phone.social.followers += Math.round(20 + 30 * rng.next());
      phone.social.sentiment = Math.min(100, phone.social.sentiment + 2);
    } else if (tone === "bad") {
      phone.social.sentiment = Math.max(
        0,
        phone.social.sentiment - 3 * watch,
      );
    }

    if (last.turnedAway > 12 && tone !== "bad") {
      phone.feed = push(
        phone.feed,
        {
          id: `queue-${week}`,
          week,
          author: CHEF_VOICES.rivalKitchen.name,
          handle: CHEF_VOICES.rivalKitchen.handle,
          kind: "world",
          body: `Watched ${last.turnedAway} people get turned away up the street tonight. Our tables are bigger. Just saying.`,
          likes: Math.round(3 + 10 * rng.next()),
          comments: [],
          tone: "neutral",
        },
        MAX_FEED,
      );
    }
  }

  /* -------------------------------------------------- one message, at most */
  const hasMsg = (id: string) => phone.messages.some((x) => x.id === id);

  const poachable = k.staff.find(
    (x) => skillOf(x) >= 65 && loyaltyOf(x) <= 45 && !hasMsg(`poach-${x.id}`),
  );
  const tired = k.staff.find(
    (x) => moraleOf(x) <= 30 && !hasMsg(`tired-${x.id}-${week}`),
  );

  if (poachable) {
    phone.messages = push(
      phone.messages,
      {
        id: `poach-${poachable.id}`,
        week,
        from: CHEF_VOICES.rivalChef.name,
        handle: CHEF_VOICES.rivalChef.handle,
        role: "rival",
        body: `Word is ${poachable.name} is doing the work of two on your line and being paid for one. I pay for two. Nothing personal — it never is in this trade.`,
        read: false,
        choices: [
          {
            label: "Match it",
            detail: "A permanent rise, and they know you moved first",
            effect: {},
            reply:
              "You put the rise through before service. Nothing was said, and everything was.",
          },
          {
            label: "Let them decide",
            detail: "No rise. Loyalty takes the hit",
            effect: {},
            reply: "You said nothing. They noticed that too.",
          },
        ],
      },
      MAX_MESSAGES,
    );
  } else if (tired) {
    phone.messages = push(
      phone.messages,
      {
        id: `tired-${tired.id}-${week}`,
        week,
        from: tired.name,
        handle:
          "@" + tired.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 9),
        role: "staff",
        body: `Chef — I am running on nothing. I will be there tomorrow, I am always there. But I need to know next week is not another six services.`,
        read: false,
        choices: [
          {
            label: "Promise a quieter week",
            detail: "Morale recovers. Keep the promise",
            effect: {},
            reply:
              "You told them to take Sunday. The whole line heard you say it.",
          },
          {
            label: "The season is the season",
            detail: "No promise. Loyalty falls",
            effect: {},
            reply:
              "They nodded and went back to the pass. The knives were louder than usual.",
          },
        ],
      },
      MAX_MESSAGES,
    );
  } else if (reputation >= 45 && !hasMsg("critic-note")) {
    phone.messages = push(
      phone.messages,
      {
        id: "critic-note",
        week,
        from: CHEF_VOICES.critic.name,
        handle: CHEF_VOICES.critic.handle,
        role: "journalist",
        body: `People whose palates I trust keep saying your name. I book under other people's names and I pay my own bill. You will not know which night I came — that is rather the point.`,
        read: false,
      },
      MAX_MESSAGES,
    );
    phone.social.scrutiny = Math.min(100, phone.social.scrutiny + 3);
  } else if (
    reputation >= 35 &&
    premisesOf(k).capacity >= 200 &&
    rng.chance(0.25) &&
    !hasMsg(`booker-${week}`)
  ) {
    phone.messages = push(
      phone.messages,
      {
        id: `booker-${week}`,
        week,
        from: CHEF_VOICES.booker.name,
        handle: CHEF_VOICES.booker.handle,
        role: "recruiter",
        body: `I place private dinners for people who do not ask prices. Your room keeps coming up. Keep Thursdays loose this month — I may have something for you.`,
        read: false,
      },
      MAX_MESSAGES,
    );
  }

  /* -------------------------------------------------------------- the news */
  if (rng.chance(0.45)) {
    const city = cityOf(k).name;
    const aboutYou = reputation >= 55 && rng.chance(0.4);
    const flavours: [string, string, NewsItem["tone"]][] = aboutYou
      ? [
          [
            `The ${city} food pages`,
            `The kitchen everyone keeps mentioning — a table worth planning a week around.`,
            "good",
          ],
        ]
      : [
          [
            `The ${city} Gazette`,
            `Market prices firm as the season turns. Traders blame the weather; the weather could not be reached for comment.`,
            "neutral",
          ],
          [
            `The Pass`,
            `Trade survey: half the city's kitchens are a sous chef short, and everyone is hiring from everyone else.`,
            "neutral",
          ],
          [
            `Late Plates`,
            `Where to eat after midnight in ${city} — an opinionated and mostly reliable list.`,
            "neutral",
          ],
        ];
    const pick = flavours[Math.floor(rng.next() * flavours.length)];
    phone.news = push(
      phone.news,
      {
        id: `news-${week}`,
        week,
        outlet: pick[0],
        headline: pick[1].split(" — ")[0].slice(0, 60),
        body: pick[1],
        tone: pick[2],
        read: false,
      },
      MAX_NEWS,
    );
  }
}

/* ====================================================== customers, posting */

/**
 * WHAT THE PEOPLE WHO ATE HERE PUT ON THEIR OWN FEEDS
 *
 * Six things can happen after a service, and every one of them has a
 * condition that is a fact about the night rather than a probability:
 *
 *   the photograph      a dish went out that actually looks like that
 *   the recommendation  the room was happy and said so
 *   the signature       enough people ordered the same dish to make it a thing
 *   the kindness        a brigade that is not on its knees was noticed
 *   the wait            people sat too long, and one of them wrote it down
 *   the complaint       something went genuinely wrong and it travelled
 *
 * The last of those is the only one that creates work: it becomes a
 * `Complaint`, which sits open until the player answers it, spreading while
 * they think about it. Everything else is a consequence that lands and is
 * done.
 *
 * Nothing here invents an incident. A complaint is only "accurate" when the
 * service report says the thing complained about happened — which is what
 * makes "defend the restaurant" a readable decision rather than a coin toss.
 */

export interface CustomerReaction {
  post: FeedPost;
  /** Social movement this produced. */
  social: PostEffect;
  /** Standing movement, applied by the caller with its reason. */
  moves: { about: StandingId; delta: number; why: string }[];
  /** Raised when this one needs an answer. */
  complaint?: {
    author: string;
    segment: string;
    about: StandingId;
    accurate: boolean;
    body: string;
    reach: number;
  };
}

/** Everything a customer reaction may look at. All of it from the night. */
export interface NightFacts {
  week: number;
  served: number;
  walked: number;
  mistakes: number;
  /** Ticks the average table waited. */
  wait: number;
  /** 0-100, the room's own verdict. */
  satisfaction: number;
  /** 0-100, what left the pass. */
  quality: number;
  /** The dish most people ordered, and how it landed. */
  topDish: { name: string; quality: number; covers: number } | null;
  /** True when the top dish is the kitchen's signature. */
  topIsSignature: boolean;
  /** Lowest morale on the brigade, or null when you are alone. */
  worstMorale: number | null;
  /** The segment that dominated the room, for the voice. */
  segmentLabel: string;
  /** How presentable the best dish is, 0-100. */
  presentation: number;
  followers: number;
  scrutiny: number;
}

const CUSTOMER_NAMES: [string, string][] = [
  ["Marion D.", "@mariondl"],
  ["Theo B.", "@theo_eats"],
  ["Camille R.", "@camr"],
  ["Idris K.", "@idriskay"],
  ["Beatriz M.", "@beatrizm"],
  ["Jonas H.", "@jonash"],
  ["Nadia S.", "@nadia_s"],
  ["Rowan V.", "@rowanv"],
];

const customerName = (rng: Rng): { name: string; handle: string } => {
  const pick = CUSTOMER_NAMES[Math.floor(rng.next() * CUSTOMER_NAMES.length)];
  return { name: pick[0], handle: pick[1] };
};

/**
 * The reactions a night produced. At most two, so a feed stays readable.
 *
 * Ordered by how strongly the night earned them, not by luck: a service with
 * four walkouts produces the complaint whatever else went right, because that
 * is what the people in the room will be talking about.
 */
export function customerReactions(
  facts: NightFacts,
  rng: Rng,
): CustomerReaction[] {
  const out: CustomerReaction[] = [];
  const likes = (base: number) =>
    Math.round(base + facts.followers / 40 + rng.next() * base * 0.5);
  const minutes = Math.round(facts.wait * 15);

  /* ------------------------------------------------------- the complaint */
  const badly =
    facts.walked >= 2 ||
    (facts.mistakes >= 3 && facts.satisfaction < 50) ||
    facts.satisfaction < 34;

  if (badly && facts.served > 0) {
    const who = customerName(rng);
    const about: StandingId =
      facts.walked >= 2 ? "service" : facts.mistakes >= 3 ? "consistency" : "food";
    const body =
      about === "service"
        ? `Sat for ${minutes} minutes before anything arrived, and in the end we left. Nobody said a word to us on the way out.`
        : about === "consistency"
          ? `Three plates went back to the kitchen at our table alone. I have been coming here for months and this was not the same restaurant.`
          : `Genuinely disappointing. What arrived was not what was described, and not worth what it cost.`;
    out.push({
      post: {
        id: `cust-bad-${facts.week}`,
        week: facts.week,
        author: who.name,
        handle: who.handle,
        kind: "world",
        body,
        likes: likes(30),
        comments: [],
        tone: "bad",
      },
      social: { sentiment: -4, scrutiny: 3 },
      moves: [
        { about, delta: -1.2, why: "A complaint about the night was shared widely" },
      ],
      complaint: {
        author: who.name,
        segment: facts.segmentLabel,
        about,
        /* Accurate exactly when the report says it happened. This is the whole
           basis of the response system, and it is never rolled. */
        accurate: true,
        body,
        reach: Math.round(
          320 + facts.followers * 0.35 + facts.scrutiny * 22 + rng.next() * 200,
        ),
      },
    });
  }

  /*
   * The unfair one. A restaurant that is being watched attracts complaints
   * about things that did not happen — and the player has no way to tell
   * except by looking at their own night, which is exactly the skill this
   * whole system is asking for.
   */
  if (!badly && facts.scrutiny >= 35 && facts.served > 0 && rng.chance(0.22)) {
    const who = customerName(rng);
    const body = `Waited nearly an hour, food was cold, staff were rude. Would not go back.`;
    out.push({
      post: {
        id: `cust-unfair-${facts.week}`,
        week: facts.week,
        author: who.name,
        handle: who.handle,
        kind: "world",
        body,
        likes: likes(45),
        comments: [],
        tone: "bad",
      },
      social: { sentiment: -2, scrutiny: 4 },
      moves: [],
      complaint: {
        author: who.name,
        segment: facts.segmentLabel,
        about: "service",
        /* The night says otherwise, and the service dashboard for this same
           week is where the player can check. */
        accurate: false,
        body,
        reach: Math.round(
          260 + facts.followers * 0.3 + facts.scrutiny * 18 + rng.next() * 220,
        ),
      },
    });
  }

  /* ------------------------------------------------------ the photograph */
  if (
    out.length < 2 &&
    facts.topDish &&
    facts.topDish.quality >= 68 &&
    facts.presentation >= 60
  ) {
    const who = customerName(rng);
    const dish = facts.topDish.name.toLowerCase();
    out.push({
      post: {
        id: `cust-photo-${facts.week}`,
        week: facts.week,
        author: who.name,
        handle: who.handle,
        kind: "world",
        body: `No filter, no styling, this is just what it looked like when it landed. The ${dish}. I have thought about it every day since.`,
        likes: likes(120),
        comments: [],
        tone: "good",
      },
      social: { followers: 90, sentiment: 3 },
      moves: [
        {
          about: "atmosphere",
          delta: 0.5,
          why: `A photograph of the ${dish} travelled`,
        },
      ],
    });
  }

  /* ------------------------------------------------------- the signature */
  if (
    out.length < 2 &&
    facts.topIsSignature &&
    facts.topDish &&
    facts.topDish.covers >= 20
  ) {
    const who = customerName(rng);
    const dish = facts.topDish.name.toLowerCase();
    out.push({
      post: {
        id: `cust-sig-${facts.week}`,
        week: facts.week,
        author: who.name,
        handle: who.handle,
        kind: "world",
        body: `Everybody at the next table ordered the ${dish}. Then we did. Then the table after us did. At this point it is not a dish, it is the reason the place exists.`,
        likes: likes(140),
        comments: [],
        tone: "good",
      },
      social: { followers: 140, sentiment: 3, trust: 2 },
      moves: [
        {
          about: "innovation",
          delta: 0.7,
          why: "The signature dish is what the city is ordering",
        },
      ],
    });
  }

  /* --------------------------------------------------------- the kindness */
  if (
    out.length < 2 &&
    facts.worstMorale !== null &&
    facts.worstMorale >= 62 &&
    facts.satisfaction >= 58 &&
    rng.chance(0.5)
  ) {
    const who = customerName(rng);
    out.push({
      post: {
        id: `cust-kind-${facts.week}`,
        week: facts.week,
        author: who.name,
        handle: who.handle,
        kind: "world",
        body: `Small thing: we were half an hour late and nobody made us feel it. Whoever runs that floor should be running somewhere twice the size.`,
        likes: likes(60),
        comments: [],
        tone: "good",
      },
      social: { followers: 45, trust: 4, sentiment: 3 },
      moves: [
        { about: "service", delta: 0.6, why: "The floor was praised by name" },
      ],
    });
  }

  /* ----------------------------------------------------- the quiet praise */
  if (out.length === 0 && facts.satisfaction >= 62 && facts.served > 0) {
    const who = customerName(rng);
    out.push({
      post: {
        id: `cust-good-${facts.week}`,
        week: facts.week,
        author: who.name,
        handle: who.handle,
        kind: "world",
        body: `Booked on a whim, stayed three hours. Tell people about this one before it gets hard to get in.`,
        likes: likes(55),
        comments: [],
        tone: "good",
      },
      social: { followers: 60, sentiment: 2 },
      moves: [
        {
          about: "atmosphere",
          delta: 0.4,
          why: "A happy room recommended you to its own followers",
        },
      ],
    });
  }

  /* ------------------------------------------------------------- the wait */
  if (out.length < 2 && facts.wait >= 5 && facts.served > 0 && !badly) {
    const who = customerName(rng);
    out.push({
      post: {
        id: `cust-wait-${facts.week}`,
        week: facts.week,
        author: who.name,
        handle: who.handle,
        kind: "world",
        body: `Food was worth it. The ${minutes} minutes we sat looking at an empty table before it arrived were not.`,
        likes: likes(35),
        comments: [],
        tone: "neutral",
      },
      social: { sentiment: -2 },
      moves: [
        {
          about: "service",
          delta: -0.7,
          why: `The average table waited ${minutes} minutes`,
        },
      ],
    });
  }

  return out.slice(0, 2);
}
