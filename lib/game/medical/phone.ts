import type { Rng } from "../types";
import { cityOf } from "./cities";
import { SPECIALTY_BY_ID } from "./data";
import { LIFESTYLE_BY_ID } from "./lifestyle";
import { OUTBREAK_BY_ID } from "./outbreaks";
import { botContext, botComments, botFeed } from "./bots";
import { QUALIFICATION_BY_ID } from "./progression";
import { INITIAL_SOCIAL } from "./social";
import type { MedicalState, PhoneState, PostContext } from "./types";

/**
 * THE PHONE
 *
 * The management screens show what the practice is doing. The phone shows how
 * everyone else reacts to it — staff, patients, rivals, journalists and
 * regulators, all reading the same run you are playing.
 *
 * Every line of content here is authored and selected deterministically from
 * run state and a seeded stream. Nothing is generated at runtime.
 */

/** Stored content is capped so a 156-week save cannot grow without limit. */
export const MAX_FEED = 60;
export const MAX_MESSAGES = 50;
export const MAX_NEWS = 40;

export function initialPhone(): PhoneState {
  return {
    social: { ...INITIAL_SOCIAL },
    feed: [],
    messages: [],
    news: [],
    lastPostWeek: 0,
    postsMade: [],
    recruitBoost: 0,
  };
}

/** Newest-first everywhere, trimmed to the cap. */
function prepend<T>(list: T[], item: T, cap: number): T[] {
  return [item, ...list].slice(0, cap);
}

export const unreadMessages = (m: MedicalState) =>
  m.phone.messages.filter((x) => !x.read).length;

export const unreadNews = (m: MedicalState) =>
  m.phone.news.filter((x) => !x.read).length;

export const unreadTotal = (m: MedicalState) =>
  unreadMessages(m) + unreadNews(m);

export const canPostThisWeek = (m: MedicalState, week: number) =>
  m.phone.lastPostWeek < week;

// ------------------------------------------------------------- post context

/**
 * Everything the post catalogue is allowed to know. Built once per render and
 * once per publish, so the composer preview and the published body cannot
 * disagree.
 */
export function postContext(m: MedicalState, s: {
  week: number;
  panel: number;
}): PostContext {
  const newestDept = [...m.departments].reverse().find((d) => d !== "general");
  const newestFacility = m.facilities[m.facilities.length - 1];
  const newestQual = [...m.qualifications]
    .reverse()
    .find((q) => q.id !== "md");
  const outbreak = m.outbreaks[0];
  const clinician = m.staff.find(
    (x) => x.role === "specialist" || x.role === "surgeon" || x.role === "gp",
  );
  const luxury = [...m.lifestyle]
    .reverse()
    .map((id) => LIFESTYLE_BY_ID.get(id))
    .find((l) => l && (l.status ?? 0) >= 6);

  return {
    week: s.week,
    cityName: cityOf(m.homeCity).name,
    departmentLabel: newestDept
      ? (SPECIALTY_BY_ID.get(newestDept)?.label ?? null)
      : null,
    newestFacility: newestFacility?.name ?? null,
    newestQualification: newestQual
      ? (QUALIFICATION_BY_ID.get(newestQual.id)?.label ?? null)
      : null,
    solvedPathogen: m.solved.length
      ? (OUTBREAK_BY_ID.get(m.solved[m.solved.length - 1])?.pathogen ?? null)
      : null,
    outbreakLabel: outbreak
      ? (OUTBREAK_BY_ID.get(outbreak.id)?.label ?? null)
      : null,
    outbreakCity: outbreak ? cityOf(outbreak.city).name : null,
    staffName: clinician?.name ?? null,
    staffCount: m.staff.length,
    panel: s.panel,
    luxuryItem: luxury?.label ?? null,
    followers: m.phone.social.followers,
    trust: m.phone.social.trust,
    sentiment: m.phone.social.sentiment,
  };
}

// --------------------------------------------------------- authored world

const RIVALS = [
  { author: "Meridian Health Group", handle: "@meridian" },
  { author: "Dr Adaeze Nwosu", handle: "@a.nwosu" },
  { author: "Northgate Private", handle: "@northgate" },
  { author: "Dr Henrik Sand", handle: "@h_sand" },
];

const OUTLETS = [
  "The Clinical Register",
  "Health Service Weekly",
  "Metro Evening",
  "The Lancet Brief",
];

/**
 * One week of world reaction.
 *
 * Takes its own RNG stream. The engine rolls events from the shared stream
 * *after* resolveWeek returns, so drawing from that stream here would shift
 * every event in the game and silently change balance.
 */
export function generateWeek(
  m: MedicalState,
  ctx: { week: number; burnout: number; risk: number; reputation: number; cash: number },
  rng: Rng,
): { logLines: string[] } {
  const p = m.phone;
  const logLines: string[] = [];

  // --- social drift -------------------------------------------------------
  // Attention decays. Standing creeps back toward neutral if you say nothing.
  p.social.followers = Math.max(0, p.social.followers * 0.985);
  p.social.trust += (50 - p.social.trust) * 0.02;
  p.social.sentiment += (50 - p.social.sentiment) * 0.02;
  p.social.scrutiny = Math.max(0, p.social.scrutiny - 0.8);

  // --- news ---------------------------------------------------------------
  for (const active of m.outbreaks) {
    const def = OUTBREAK_BY_ID.get(active.id);
    if (!def) continue;
    // Only report each outbreak once, in the week it starts.
    if (active.startedWeek !== ctx.week) continue;
    p.news = prepend(
      p.news,
      {
        id: `news.outbreak.${active.id}.${active.city}.${ctx.week}`,
        week: ctx.week,
        outlet: OUTLETS[0],
        headline: `${def.label} confirmed in ${cityOf(active.city).name}`,
        body: `Health officials have confirmed a cluster of ${def.pathogen}. Clinicians are asked to review presentations in ${def.affects.length} affected specialties.`,
        tone: "bad",
        read: false,
      },
      MAX_NEWS,
    );
    logLines.push(`${def.label} is in the news.`);
  }

  if (rng.chance(0.16)) {
    const rival = rng.pick(RIVALS);
    p.news = prepend(
      p.news,
      {
        id: `news.rival.${ctx.week}`,
        week: ctx.week,
        outlet: rng.pick(OUTLETS),
        headline: `${rival.author} announces expansion`,
        body: "A competitor has opened new capacity in the region. Analysts expect pressure on referral volumes.",
        tone: "neutral",
        read: false,
      },
      MAX_NEWS,
    );
  }

  if (rng.chance(0.1)) {
    p.news = prepend(
      p.news,
      {
        id: `news.reg.${ctx.week}`,
        week: ctx.week,
        outlet: OUTLETS[1],
        headline: "Regulator tightens documentation standards",
        body: "New guidance requires fuller record-keeping for complex cases. Practices with thin administrative cover are expected to feel it first.",
        tone: "neutral",
        read: false,
      },
      MAX_NEWS,
    );
  }

  // --- messages, triggered by the run's actual state ----------------------
  const has = (id: string) => p.messages.some((x) => x.id === id);

  if (ctx.burnout >= 72 && !has(`msg.burnout.${Math.floor(ctx.week / 20)}`)) {
    const from = m.staff[0];
    p.messages = prepend(
      p.messages,
      {
        id: `msg.burnout.${Math.floor(ctx.week / 20)}`,
        week: ctx.week,
        from: from?.name ?? "Practice manager",
        handle: "@team",
        role: "staff",
        body: "Are you alright? You have not taken a day in weeks and the rota is starting to show it. Nobody here expects you to keep this up.",
        read: false,
        choices: [
          {
            label: "Admit you are struggling",
            detail: "Honest, and it will get around.",
            effect: { trust: 2, sentiment: 2, followers: 60 },
            reply: "Thank you for saying it. I will take next weekend properly.",
          },
          {
            label: "Say you are fine",
            detail: "Keeps it private. Changes nothing.",
            effect: {},
            reply: "I am fine. Busy month, that is all.",
          },
        ],
      },
      MAX_MESSAGES,
    );
    logLines.push("A colleague asked whether you are coping.");
  }

  if (ctx.risk >= 52 && !has(`msg.journo.${Math.floor(ctx.week / 25)}`)) {
    p.messages = prepend(
      p.messages,
      {
        id: `msg.journo.${Math.floor(ctx.week / 25)}`,
        week: ctx.week,
        from: "Priya Raman",
        handle: "@p.raman",
        role: "journalist",
        body: "I am writing about complaint rates at private practices in the region and yours came up. Would you like to comment before it runs?",
        read: false,
        choices: [
          {
            label: "Comment on the record",
            detail: "Engage. Lowers scrutiny, costs a little standing.",
            effect: { scrutiny: -10, trust: 2, sentiment: -2, followers: 220 },
            reply: "I gave a straight answer and did not hide behind a press office.",
          },
          {
            label: "Decline to comment",
            detail: "Say nothing and let it run.",
            effect: { scrutiny: 6, sentiment: -4 },
            reply: "No comment. The piece ran anyway, with a photograph.",
          },
        ],
      },
      MAX_MESSAGES,
    );
    logLines.push("A journalist asked for comment.");
  }

  if (p.social.scrutiny >= 60 && !has(`msg.reg.${Math.floor(ctx.week / 30)}`)) {
    p.messages = prepend(
      p.messages,
      {
        id: `msg.reg.${Math.floor(ctx.week / 30)}`,
        week: ctx.week,
        from: "Professional Standards Board",
        handle: "@standards",
        role: "regulator",
        body: "We are reviewing recent public communications associated with your registration. No action is required at this stage. We would prefer that to remain the case.",
        read: false,
      },
      MAX_MESSAGES,
    );
    logLines.push("The standards board has been in touch.");
  }

  if (p.social.trust >= 68 && !has(`msg.recruiter.${Math.floor(ctx.week / 28)}`)) {
    p.messages = prepend(
      p.messages,
      {
        id: `msg.recruiter.${Math.floor(ctx.week / 28)}`,
        week: ctx.week,
        from: "Ines Duarte",
        handle: "@i.duarte",
        role: "recruiter",
        body: "Two consultants have asked me whether you are hiring. That does not usually happen. Whatever you are publishing, keep publishing it.",
        read: false,
      },
      MAX_MESSAGES,
    );
  }

  /* --- the cast ----------------------------------------------------------
   *
   * Accounts with positions, posting about what is actually happening in the
   * run — an outbreak in a named city, your hiring, your scrutiny. This
   * replaced a single random rival line per week, which made the feed read
   * as a screensaver rather than as a place other people were.
   *
   * Ambient chatter is still the fallback inside `botFeed`, so a quiet week
   * is quiet rather than empty.
   */
  const bctx = botContext(m, { week: ctx.week, reputation: ctx.reputation });
  for (const post of botFeed(bctx, rng, ctx.week)) {
    p.feed = prepend(p.feed, { ...post, comments: [] }, MAX_FEED);
  }

  return { logLines };
}

// --------------------------------------------------------- player posting

/**
 * Reactions to a player post.
 *
 * Delegates to the cast so the same accounts that post in your feed are the
 * ones replying to you. Which way the room leans is your standing — trust
 * decides the warmth of the pool, scrutiny brings the press and the
 * regulator in, reach decides how many bother to answer at all.
 */
export function reactionsFor(
  m: MedicalState,
  ctx: { week: number; reputation: number },
  rng: Rng,
): { likes: number; comments: { author: string; handle: string; body: string }[] } {
  const c = botContext(m, ctx);
  const base = Math.round(c.followers * 0.06) + rng.int(8, 60);
  const swing = c.trust >= 60 ? 1.35 : c.trust <= 40 ? 0.7 : 1;
  return {
    likes: Math.max(1, Math.round(base * swing)),
    comments: botComments(c, rng),
  };
}
