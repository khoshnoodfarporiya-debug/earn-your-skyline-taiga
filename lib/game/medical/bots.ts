import type { Rng } from "../types";
import type { FeedPost, MedicalState } from "./types";
import { OUTBREAK_BY_ID } from "./outbreaks";
import { cityOf } from "./cities";

/**
 * THE CAST
 *
 * A fixed set of in-world accounts who post on their own and comment on
 * yours. They exist because a feed that only ever contained your own posts
 * and a canned reply was not a social network — it was a log with an avatar.
 *
 * Three rules hold this together:
 *
 *   1. **Nothing is generated.** Every line is authored here and selected by
 *      a seeded draw. No model writes game text, which is what keeps a run
 *      reproducible from its seed and keeps the game offline.
 *
 *   2. **They react to the actual run.** A bot posts about an outbreak
 *      because an outbreak is running, about your hiring because you hired,
 *      about your scrutiny because it is high. They never invent state.
 *
 *   3. **They have positions.** A rival is not a peer with different words.
 *      The same event pulls praise from one account and a dig from another,
 *      and which of them the feed gives more room to depends on your trust
 *      and scrutiny — so the timeline is a readout of your public standing.
 */

export type BotRole =
  | "peer" /* other clinicians */
  | "rival" /* the competing group across town */
  | "press" /* health journalism */
  | "public" /* patients and their families */
  | "authority" /* the regulator and public health */
  | "influencer"; /* wellness, reach without rigour */

export interface Bot {
  id: string;
  name: string;
  handle: string;
  role: BotRole;
  /** Their disposition before your standing is taken into account. */
  lean: "warm" | "neutral" | "cold";
}

export const BOTS: Bot[] = [
  { id: "sand", name: "Dr Henrik Sand", handle: "@h_sand", role: "peer", lean: "warm" },
  { id: "duarte", name: "Ines Duarte", handle: "@i.duarte", role: "peer", lean: "warm" },
  { id: "nwosu", name: "Dr Adaeze Nwosu", handle: "@a.nwosu", role: "peer", lean: "neutral" },
  { id: "meridian", name: "Meridian Health Group", handle: "@meridian", role: "rival", lean: "cold" },
  { id: "northgate", name: "Northgate Private", handle: "@northgate", role: "rival", lean: "cold" },
  { id: "vance", name: "Cora Vance", handle: "@coravance", role: "press", lean: "neutral" },
  { id: "lede", name: "The Clinical Lede", handle: "@clinicallede", role: "press", lean: "neutral" },
  { id: "mira", name: "Mira O.", handle: "@mira_ok", role: "public", lean: "warm" },
  { id: "tomas", name: "Tomás R.", handle: "@tomasr", role: "public", lean: "neutral" },
  { id: "kell", name: "J. Kell", handle: "@jkell", role: "public", lean: "cold" },
  { id: "board", name: "Regional Health Board", handle: "@rhb_press", role: "authority", lean: "neutral" },
  { id: "wellwise", name: "WellWise Daily", handle: "@wellwise", role: "influencer", lean: "warm" },
];

const BY_ROLE = (role: BotRole) => BOTS.filter((b) => b.role === role);

/* ------------------------------------------------------------- their posts
 *
 * Each entry says when it may be used and what it says. `when` reads run
 * state only — a line can never claim something that is not true.
 */
interface BotPost {
  role: BotRole;
  tone: "good" | "bad" | "neutral";
  /** Does the run currently justify saying this? */
  when: (c: BotContext) => boolean;
  /** The line. `city` is filled from context where a post names one. */
  body: (c: BotContext) => string;
}

export interface BotContext {
  week: number;
  reputation: number;
  trust: number;
  scrutiny: number;
  sentiment: number;
  followers: number;
  staff: number;
  cities: number;
  departments: number;
  /** The outbreak the world is currently talking about, if any. */
  outbreak: { label: string; pathogen: string; city: string; contained: boolean } | null;
  solved: number;
}

const POSTS: BotPost[] = [
  /* ------------------------------------------------------------ outbreaks */
  {
    role: "authority",
    tone: "bad",
    when: (c) => c.outbreak !== null && !c.outbreak.contained,
    body: (c) =>
      `Public health notice: ${c.outbreak!.label} confirmed in ${c.outbreak!.city}. Clinicians should review isolation procedure and report suspected cases the same day.`,
  },
  {
    role: "authority",
    tone: "neutral",
    when: (c) => c.outbreak !== null && c.outbreak.contained,
    body: (c) =>
      `${c.outbreak!.city}: containment measures for ${c.outbreak!.label} are in place and holding. Case growth has slowed. Do not stand down screening.`,
  },
  {
    role: "press",
    tone: "bad",
    when: (c) => c.outbreak !== null,
    body: (c) =>
      `We are hearing ${c.outbreak!.city} clinics are seeing ${c.outbreak!.pathogen} presentations well above baseline. Which providers are actually equipped for this?`,
  },
  {
    role: "public",
    tone: "bad",
    when: (c) => c.outbreak !== null && !c.outbreak.contained,
    body: (c) =>
      `Three hour wait in ${c.outbreak!.city} today. Nobody could tell us whether it was safe to bring my daughter in. This is not good enough.`,
  },
  {
    role: "peer",
    tone: "neutral",
    when: (c) => c.outbreak !== null,
    body: (c) =>
      `If you are covering ${c.outbreak!.city} this week — we are running a separate stream for suspected ${c.outbreak!.pathogen}. Happy to share the protocol with anyone who wants it.`,
  },

  /* --------------------------------------------------------- your standing */
  {
    role: "peer",
    tone: "good",
    when: (c) => c.reputation >= 65 && c.trust >= 55,
    body: () =>
      `Referred a complex case out this morning and it came back handled properly, with notes. That is rarer than it should be. Credit where it is due.`,
  },
  {
    role: "public",
    tone: "good",
    when: (c) => c.sentiment >= 58,
    body: () =>
      `Seen today, actually listened to, out in forty minutes. I did not expect to be writing a positive post about a clinic.`,
  },
  {
    role: "rival",
    tone: "bad",
    when: (c) => c.reputation >= 60 || c.cities >= 3,
    body: () =>
      `Interesting to watch a practice expand this quickly. We have chosen to grow at the pace our clinical governance can actually support.`,
  },
  {
    role: "press",
    tone: "bad",
    when: (c) => c.scrutiny >= 25,
    body: () =>
      `Working on a piece about growth-stage private clinics and the gap between what they advertise and what they are staffed to deliver. DMs open.`,
  },
  {
    role: "public",
    tone: "bad",
    when: (c) => c.sentiment <= 42,
    body: () =>
      `Booked six weeks out, turned up, told the department could not see me. Nobody rang. That is a whole day of work gone.`,
  },

  /* ------------------------------------------------------------- your build */
  {
    role: "peer",
    tone: "good",
    when: (c) => c.staff >= 4 && c.week > 12,
    body: () =>
      `Half the people I trained with are leaving clinical work entirely. Anyone actually hiring and treating staff properly is doing more for the profession than another op-ed.`,
  },
  {
    role: "influencer",
    tone: "neutral",
    when: (c) => c.followers >= 400,
    body: () =>
      `Reminder that the clinic with the best waiting room is not the clinic with the best outcomes. Ask what they are equipped to treat. Ask who is on that night.`,
  },
  {
    role: "rival",
    tone: "neutral",
    when: (c) => c.departments >= 5,
    body: () =>
      `Breadth is easy to buy and hard to staff. We would rather do four things properly than nine adequately.`,
  },
  {
    role: "press",
    tone: "good",
    when: (c) => c.solved >= 1,
    body: () =>
      `Genuinely good news for once: a published protocol out of a private practice, not a university. The pathogen it addresses should not trouble this region again.`,
  },

  /* ------------------------------------------------------------- ambient */
  {
    role: "public",
    tone: "neutral",
    when: () => true,
    body: () =>
      `Does anyone know a practice in this city that answers the phone before eleven? Genuine question.`,
  },
  {
    role: "peer",
    tone: "neutral",
    when: () => true,
    body: () =>
      `Rota out. Four nights, then a Saturday. Whoever designed this has never worked one.`,
  },
  {
    role: "influencer",
    tone: "neutral",
    when: () => true,
    body: () =>
      `Sleep, daylight, and going in early rather than late. That is most of it. The rest is marketing.`,
  },
];

/** Build the context a bot reads from real state. */
export function botContext(m: MedicalState, ctx: { week: number; reputation: number }): BotContext {
  const active = m.outbreaks[0] ?? null;
  const def = active ? OUTBREAK_BY_ID.get(active.id) : null;
  return {
    week: ctx.week,
    reputation: ctx.reputation,
    trust: m.phone.social.trust,
    scrutiny: m.phone.social.scrutiny,
    sentiment: m.phone.social.sentiment,
    followers: m.phone.social.followers,
    staff: m.staff.length,
    cities: m.cities.length,
    departments: m.departments.length,
    outbreak:
      active && def
        ? {
            label: def.label,
            pathogen: def.pathogen,
            city: cityOf(active.city).name,
            contained: active.contained,
          }
        : null,
    solved: m.solved.length,
  };
}

/**
 * What the cast posts this week.
 *
 * One or two posts, never more: a feed that adds five entries a week buries
 * the player's own posts and the news items that actually matter. Eligible
 * lines are gathered first, then drawn from — so a quiet week falls back to
 * ambient chatter rather than going silent.
 */
export function botFeed(
  c: BotContext,
  rng: Rng,
  week: number,
): Omit<FeedPost, "comments">[] {
  const eligible = POSTS.filter((p) => p.when(c));
  if (eligible.length === 0) return [];

  /* Busier weeks talk more: an outbreak or heavy scrutiny draws a crowd. */
  const count = c.outbreak !== null || c.scrutiny >= 30 ? 2 : rng.chance(0.55) ? 1 : 0;
  const out: Omit<FeedPost, "comments">[] = [];
  const usedRoles = new Set<BotRole>();

  for (let i = 0; i < count; i++) {
    /* One voice per role per week, so the same archetype does not answer
       itself in consecutive posts. */
    const pool = eligible.filter((p) => !usedRoles.has(p.role));
    if (pool.length === 0) break;
    const post = rng.pick(pool);
    const speakers = BY_ROLE(post.role);
    if (speakers.length === 0) continue;
    const bot = rng.pick(speakers);
    usedRoles.add(post.role);
    out.push({
      id: `bot.${bot.id}.${week}.${i}`,
      week,
      author: bot.name,
      handle: bot.handle,
      kind: "world",
      body: post.body(c),
      likes: rng.int(3, 140),
      tone: post.tone,
    });
  }
  return out;
}

/* ---------------------------------------------------------------- comments */

interface BotLine {
  role: BotRole;
  lean: "warm" | "neutral" | "cold";
  body: string;
}

const COMMENTS: BotLine[] = [
  { role: "peer", lean: "warm", body: "Saving this for teaching. Clear and correct." },
  { role: "peer", lean: "warm", body: "Sent to three registrars already." },
  { role: "peer", lean: "neutral", body: "Broadly agree, though I would caveat the second point." },
  { role: "peer", lean: "cold", body: "This is not what the current guidance says." },
  { role: "public", lean: "warm", body: "This is the clearest explanation of it I have read. Thank you." },
  { role: "public", lean: "neutral", body: "Does this apply to children as well, or only adults?" },
  { role: "public", lean: "cold", body: "Easy to say when you are not the one waiting six weeks." },
  { role: "rival", lean: "cold", body: "Bold claim. Where is the data?" },
  { role: "rival", lean: "cold", body: "We have run this differently for years without the fanfare." },
  { role: "press", lean: "neutral", body: "Would you be willing to go on record with this?" },
  { role: "influencer", lean: "warm", body: "Sharing this with my whole list. More of this please." },
  { role: "authority", lean: "neutral", body: "Please ensure any clinical claim links to the current standard." },
];

/**
 * Comments on a player post.
 *
 * Which way the room leans is your standing, not chance: trust decides how
 * many warm voices are in the pool, scrutiny pulls in the press and the
 * regulator. A post made from a bad position genuinely draws a worse room.
 */
export function botComments(
  c: BotContext,
  rng: Rng,
): { author: string; handle: string; body: string }[] {
  const warmth = c.trust >= 60 ? "warm" : c.trust <= 40 ? "cold" : "neutral";

  const pool = COMMENTS.filter((l) => {
    if (l.role === "press" || l.role === "authority") return c.scrutiny >= 18;
    if (warmth === "warm") return l.lean !== "cold";
    if (warmth === "cold") return l.lean !== "warm";
    return true;
  });
  if (pool.length === 0) return [];

  /* Reach decides how many people bother to reply. */
  const n = c.followers >= 800 ? 3 : c.followers >= 200 ? 2 : 1;
  const out: { author: string; handle: string; body: string }[] = [];
  const used = new Set<string>();

  for (let i = 0; i < n; i++) {
    const line = rng.pick(pool);
    const speakers = BY_ROLE(line.role).filter((b) => !used.has(b.id));
    if (speakers.length === 0) continue;
    const bot = rng.pick(speakers);
    used.add(bot.id);
    out.push({ author: bot.name, handle: bot.handle, body: line.body });
  }
  return out;
}
