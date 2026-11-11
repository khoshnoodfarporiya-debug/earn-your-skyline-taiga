import type { Rng, RunState } from "../types";
import type { FeedPost, PhoneState } from "../medical/types";
import { MAX_FEED, MAX_MESSAGES, MAX_NEWS } from "../medical/phone";

/**
 * A PHONE, FROM A SMALL DESCRIPTION OF A WORLD
 *
 * The Physician, the Chef and the Solicitor each got a hand-written phone —
 * roughly nine hundred lines apiece of voices, posts, message chains and week
 * generation. That was the right way to build the first three, because it is
 * how you find out what a phone in this game actually needs.
 *
 * It is the wrong way to build the next four. Ninety per cent of those lines
 * were the same machinery with different nouns in it: cap the feed, roll one
 * message, decay nothing, keep it replayable. What genuinely differs between
 * careers is *who is talking and what they would say* — and that is a table,
 * not a program.
 *
 * So this module is the machinery, and a `VoicePack` is the table. A career
 * supplies four or five accounts, a handful of things it might post, and the
 * conditions under which somebody would get in touch. It gets a working
 * handset with the same feel as the hand-written three.
 *
 * ------------------------------------------------------------ the contract
 *
 * Everything here is deterministic given the stream it is handed. The pack's
 * predicates read state and return booleans; they never roll. That is what
 * keeps a replayed week producing the same phone, and it is the same rule the
 * hand-written phones follow.
 */

export interface Voice {
  name: string;
  handle: string;
  /** True for institutions, which render as a tile rather than a face. */
  org?: boolean;
}

export interface PackPost {
  id: string;
  label: string;
  blurb: string;
  /**
   * Grouping word shown beside the chosen post. The hand-written phones use
   * this to say what kind of thing you are about to publish; a pack's posts
   * are few enough that "post" is honest, so it defaults rather than making
   * every pack invent five category names.
   */
  category?: string;
  /** The post itself. Given the run so it can name real things. */
  body: (s: RunState) => string;
  available: (s: RunState) => boolean;
  once?: boolean;
  /** Chance this rebounds instead. */
  hazard?: number;
  effect: { followers?: number; trust?: number; sentiment?: number; scrutiny?: number };
  preview: string[];
  backfire?: { note: string };
}

/** Something somebody sends you, when the run gives them a reason to. */
export interface PackMessage {
  id: string;
  from: keyof VoicePack["voices"] | string;
  role: "staff" | "recruiter" | "journalist" | "regulator" | "rival" | "peer";
  body: (s: RunState) => string;
  /** Only sent when this is true, and only once per run. */
  when: (s: RunState) => boolean;
}

export interface PackNews {
  outlet: string;
  headline: string;
  body: (s: RunState) => string;
  tone: "good" | "bad" | "neutral";
}

export interface VoicePack {
  /** What the app calls the world it reports on. */
  world: string;
  voices: Record<string, Voice>;
  posts: PackPost[];
  messages: PackMessage[];
  news: PackNews[];
  /** The welcome message, from whoever would send it. */
  opening: { from: string; role: PackMessage["role"]; body: string };
  /**
   * How the world reacts to the week just resolved.
   *
   * Returns a line and a tone, or nothing when the week was unremarkable.
   * This is the only place a pack sees the simulation, and it is what stops
   * the feed being decoration: a review only exists because something
   * happened.
   */
  reaction?: (s: RunState) => { body: string; tone: FeedPost["tone"] } | null;
  /** What standing reads as, in this career's words. */
  identity: (social: PhoneState["social"]) => { label: string; blurb: string };
}

/* ------------------------------------------------------------- the machinery */

export function initialPhoneFrom(pack: VoicePack): PhoneState {
  const voice = pack.voices[pack.opening.from];
  return {
    social: { followers: 120, trust: 50, sentiment: 52, scrutiny: 0 },
    feed: [],
    messages: [
      {
        id: "welcome",
        week: 1,
        from: voice?.name ?? "A friend",
        handle: voice?.handle ?? "@friend",
        role: pack.opening.role,
        body: pack.opening.body,
        read: false,
      },
    ],
    news: [],
    lastPostWeek: 0,
    postsMade: [],
    recruitBoost: 0,
  };
}

const push = <T,>(list: T[], item: T, cap: number): T[] =>
  [item, ...list].slice(0, cap);

/**
 * One week of a world talking.
 *
 * Called at the end of `resolveWeek`, after the career has written whatever
 * the pack's `reaction` reads, and handed a stream of its own so the phone can
 * never disturb the simulation's dice.
 */
export function generateWeekFrom(
  pack: VoicePack,
  phone: PhoneState,
  s: RunState,
  rng: Rng,
): void {
  /* ------------------------------------------------- what the world noticed */
  const reaction = pack.reaction?.(s) ?? null;
  if (reaction) {
    const names = Object.values(pack.voices).filter((v) => !v.org);
    const voice = names[Math.floor(rng.next() * names.length)] ??
      Object.values(pack.voices)[0];
    phone.feed = push(
      phone.feed,
      {
        id: `re-${s.week}`,
        week: s.week,
        author: voice.name,
        handle: voice.handle,
        kind: "world",
        body: reaction.body,
        likes: Math.round(5 + phone.social.followers / 60 + 8 * rng.next()),
        comments: [],
        tone: reaction.tone,
      },
      MAX_FEED,
    );

    /* Being watched amplifies the bad weeks. That is what scrutiny means. */
    const watch = 1 + phone.social.scrutiny / 100;
    if (reaction.tone === "good") {
      phone.social.followers += Math.round(18 + 26 * rng.next());
      phone.social.sentiment = Math.min(100, phone.social.sentiment + 2);
    } else if (reaction.tone === "bad") {
      phone.social.sentiment = Math.max(0, phone.social.sentiment - 3 * watch);
    }
  }

  /* --------------------------------------------- somebody gets in touch */
  const sent = new Set(phone.messages.map((m) => m.id));
  const due = pack.messages.find((m) => !sent.has(m.id) && m.when(s));
  if (due) {
    const voice = pack.voices[due.from];
    phone.messages = push(
      phone.messages,
      {
        id: due.id,
        week: s.week,
        from: voice?.name ?? due.from,
        handle: voice?.handle ?? "@unknown",
        role: due.role,
        body: due.body(s),
        read: false,
      },
      MAX_MESSAGES,
    );
  }

  /* -------------------------------------------------------------- the news */
  if (pack.news.length > 0 && rng.chance(0.4)) {
    const item = pack.news[Math.floor(rng.next() * pack.news.length)];
    phone.news = push(
      phone.news,
      {
        id: `news-${s.week}`,
        week: s.week,
        outlet: item.outlet,
        headline: item.headline,
        body: item.body(s),
        tone: item.tone,
        read: false,
      },
      MAX_NEWS,
    );
  }
}

/**
 * Publish one of the pack's posts.
 *
 * Every gate is re-checked here rather than trusted from the composer, for
 * the same reason the hand-written phones re-check theirs: a disabled button
 * is a hint, not a rule.
 */
export function publishFrom(
  pack: VoicePack,
  phone: PhoneState,
  s: RunState,
  postId: string,
  rng: Rng,
): boolean {
  const def = pack.posts.find((p) => p.id === postId);
  if (!def) return false;
  if (phone.lastPostWeek >= s.week) return false;
  if (def.once && phone.postsMade.includes(def.id)) return false;
  if (!def.available(s)) return false;

  const misfired = def.hazard !== undefined && rng.chance(def.hazard);
  const e = def.effect;
  const sign = misfired ? -1 : 1;
  phone.social.followers = Math.max(
    0,
    phone.social.followers + (e.followers ?? 0) * (misfired ? 0.2 : 1),
  );
  phone.social.trust = clamp(phone.social.trust + (e.trust ?? 0) * sign);
  phone.social.sentiment = clamp(
    phone.social.sentiment + (e.sentiment ?? 0) * sign,
  );
  phone.social.scrutiny = clamp(
    phone.social.scrutiny + (e.scrutiny ?? 0) + (misfired ? 4 : 0),
  );

  phone.feed = push(
    phone.feed,
    {
      id: `you-${s.week}`,
      week: s.week,
      author: "You",
      handle: "@you",
      kind: "player",
      body: def.body(s),
      likes: Math.round(4 + phone.social.followers / 50),
      comments:
        misfired && def.backfire
          ? [
              {
                author: Object.values(pack.voices)[0]?.name ?? "Somebody",
                handle: Object.values(pack.voices)[0]?.handle ?? "@somebody",
                body: def.backfire.note,
              },
            ]
          : [],
      tone: misfired ? "bad" : "good",
    },
    MAX_FEED,
  );
  phone.lastPostWeek = s.week;
  phone.postsMade = [...phone.postsMade, def.id];
  return true;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Which handles are institutions, for the avatar's rounded treatment. */
export const orgHandles = (pack: VoicePack): string[] =>
  Object.values(pack.voices)
    .filter((v) => v.org)
    .map((v) => v.handle);
