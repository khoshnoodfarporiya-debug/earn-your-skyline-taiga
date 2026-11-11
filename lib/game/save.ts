import type { RunState } from "./types";
import { getCareer } from "./careers";
import {
  PERSON_ROLES,
  PERSON_STATUSES,
  PERSON_TRAITS,
  initialPerson,
} from "./people";
import { TIMELINE_KINDS } from "./timeline";
import { REPUTATIONS } from "./reputation";
import { MAX_RIVAL_HISTORY, RIVAL_STANCES, RIVAL_STRATEGIES } from "./rivals";
import { FUNDING_KINDS, MAX_EQUITY } from "./finance";
import { MAX_WORLD_NEWS } from "./news";
import { CRISIS_KINDS } from "./crisis";
import { MAX_SETBACKS, SETBACK_KINDS } from "./setbacks";
import { TRAIT_CAP, TRAIT_IDS } from "./traits";
import { AMBITIONS } from "./ambitions";
import { BACKGROUNDS } from "./backgrounds";
import { MAX_ARCHIVE, type ArchivedCareer } from "./retirement";
import {
  every,
  isInt,
  isObj,
  isStr,
  numberMap,
  numbers,
  oneOf,
} from "./validate";

/**
 * SAVE VERSIONS
 *
 * The old rule was "an unreadable save must be discarded, not salvaged", and
 * for a *corrupt* save that is still exactly right — a half-repaired run is
 * quietly wrong for the rest of its life.
 *
 * But a save from an older build is not corrupt. It is complete and correct
 * for the game it was written by, and throwing away someone's ninety-week run
 * because a later build added a field is a different failure. So the two cases
 * are now separated:
 *
 *   - **Older but structurally sound** → migrated forward with safe defaults.
 *   - **Malformed, or for a career that no longer exists** → still rejected.
 *
 * `KEYS` is newest-first. `loadRun` reads the newest key present, migrates it
 * through every step above its version, validates the *result*, and writes it
 * back at the current version — so the upgrade happens once rather than on
 * every load.
 */
/*
 * The storage prefix is `career-tycoon`, and it stays that way.
 *
 * The game was renamed to Earn Your Skyline; these keys were not. They are
 * invisible internal identifiers, and renaming them would make every save
 * already sitting in a player's browser unreachable — the loader looks for
 * exactly these strings and would find nothing, silently, on the next visit.
 *
 * A rename here buys nothing and costs every existing run. If it ever has to
 * happen it needs a migration that reads the old prefix and writes the new
 * one, in the same shape as the v8 → v11 chain below.
 */
const KEY = "career-tycoon:save:v11";

/** Every key this build can read, newest first. Index is the version offset. */
const KEYS = [
  "career-tycoon:save:v11",
  "career-tycoon:save:v10",
  "career-tycoon:save:v9",
  "career-tycoon:save:v8",
] as const;

/**
 * Every key this build can read.
 *
 * Exported so the test harness clears all of them rather than maintaining its
 * own copy of the list — a duplicated list is what let a leftover newer save
 * shadow each fixture at v9 and again at v10, and it would have done so a
 * third time here.
 */
export const SAVE_KEYS: readonly string[] = KEYS;

export function saveRun(state: RunState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scoped(KEY), JSON.stringify(state));
  } catch {
    // Storage disabled or full — the run continues in memory either way.
  }
}

export function loadRun(): RunState | null {
  if (typeof window === "undefined") return null;
  try {
    for (const key of KEYS) {
      const raw = window.localStorage.getItem(scoped(key));
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (!isObj(parsed)) continue;

      const migrated = migrateRun(parsed);
      if (!migrated || !validateRun(migrated)) continue;

      if (key !== KEY) {
        /* Write forward and drop the old key, so the migration is paid once.
           The old value is only removed after the new one is written — a
           failure between the two leaves the player with their old save
           rather than with nothing. */
        try {
          window.localStorage.setItem(scoped(KEY), JSON.stringify(migrated));
          window.localStorage.removeItem(scoped(key));
        } catch {
          /* Out of quota. The run still loads; it will migrate again next
             time, which is wasteful and harmless. */
        }
      }
      return migrated as unknown as RunState;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * MIGRATION
 *
 * Additive and defensive. Every step fills a field that a later build expects
 * and an earlier one never wrote; none of them changes a value the player
 * earned. Anything already present is left alone, so running this on a
 * current save is a no-op and running it twice is safe.
 *
 * Returns null only when the object is too broken to be worth repairing —
 * which `validateRun` would have caught anyway, and catching it here keeps
 * the migration steps free of defensive noise.
 *
 * Exported for the round-trip tests, which drive it directly with saves the
 * engine wrote at earlier shapes.
 */
export function migrateRun(
  raw: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!isStr(raw.careerId)) return null;
  const career = getCareer(raw.careerId);
  if (!career) return null;

  const s = { ...raw };

  /* v8 → v9 ------------------------------------------------------------
   *
   * Added: the cast, the timeline, delayed consequences, the reputation
   * change log, and five new reputation categories.
   */

  // The cast. Everyone whose entry condition is already satisfied joins at
  // their starting standing — an existing run gains its people rather than
  // being told it has none.
  if (!Array.isArray(s.people)) {
    /* Same gate as `startRun`: only those whose condition the save already
       satisfies. The career's weekly arrival check picks up the rest, so a
       migrated run gains its investor at the moment it earns one rather than
       finding him already in the contacts. */
    const asRun = s as unknown as RunState;
    s.people = (career.cast ?? [])
      .filter((def) => {
        if (!def.appears) return true;
        try {
          return def.appears(asRun);
        } catch {
          /* An `appears` predicate reads career state, and migration runs
             before validation — so the shape it is reading may be anything.
             A throw here means "cannot tell yet", which is the same as not
             yet present. */
          return false;
        }
      })
      .map(initialPerson);
  }

  // The timeline starts empty on a migrated save, on purpose. Inventing a
  // "first employee" entry for a run whose history was never recorded would
  // make the whole feature untrustworthy — better an honest gap.
  if (!Array.isArray(s.timeline)) s.timeline = [];
  if (!Array.isArray(s.pending)) s.pending = [];
  if (!Array.isArray(s.repLog)) s.repLog = [];

  /*
   * Reputation categories.
   *
   * Seeded from signals the old save already carried, so a well-run practice
   * does not arrive claiming neutral everything. The rules are stated in full
   * at the head of lib/game/reputation.ts; this is their implementation.
   */
  if (isObj(s.r)) {
    const r = { ...s.r } as Record<string, number>;
    const credibility = typeof r.reputation === "number" ? r.reputation : 45;
    const social = readSocial(s.data);

    if (typeof r.repPatients !== "number") {
      // Patients thought roughly what the profession thought, pulled to
      // neutral: the old model never distinguished them, so claiming a
      // precise value would be inventing one.
      r.repPatients = clamp01to100(50 + (credibility - 50) * 0.5);
    }
    if (typeof r.repLoyalty !== "number") r.repLoyalty = 50;
    if (typeof r.repInfluence !== "number") {
      r.repInfluence = clamp01to100(20 + (social.trust - 50) * 0.6);
    }
    if (typeof r.repPopularity !== "number") {
      r.repPopularity = clamp01to100(10 + (social.sentiment - 50) * 0.8);
    }
    if (typeof r.repEthics !== "number") {
      r.repEthics = clamp01to100(70 - social.scrutiny * 0.4);
    }
    s.r = r;
  }

  /* v9 -> v10 ----------------------------------------------------------
   *
   * Added: rivals, contracts, financing, world news, crises, per-city
   * markets and the deeper staff record.
   *
   * All of them are empty-by-default rather than seeded with plausible
   * history, for the same reason the timeline is: a save that never had a
   * rival never had a relationship with one, and inventing twenty weeks of
   * competitor moves would put fiction in the news feed that the run did not
   * live through. `ensureSeeded` populates the rivals themselves on the first
   * resolved week, at their starting positions.
   */
  if (!Array.isArray(s.rivals)) s.rivals = [];
  if (!Array.isArray(s.offers)) s.offers = [];
  if (!Array.isArray(s.contracts)) s.contracts = [];
  if (!Array.isArray(s.contractLog)) s.contractLog = [];
  if (!Array.isArray(s.obligations)) s.obligations = [];
  if (!Array.isArray(s.news)) s.news = [];
  if (!Array.isArray(s.crises)) s.crises = [];

  /*
   * The staff record.
   *
   * An older roster has six fields per person. Filling the rest here means
   * the validator can require them, which is worth doing: a half-hydrated
   * staff member is the kind of thing that produces a NaN in the culture
   * score three systems away from the cause.
   */
  if (isObj(s.data) && isObj((s.data as Record<string, unknown>).med)) {
    const medState = (s.data as Record<string, unknown>).med as Record<
      string,
      unknown
    >;
    if (Array.isArray(medState.staff)) {
      medState.staff = medState.staff.map((raw) => {
        if (!isObj(raw)) return raw;
        const x = raw as Record<string, unknown>;
        const salary = typeof x.salary === "number" ? x.salary : 1000;
        return {
          ...x,
          morale: typeof x.morale === "number" ? x.morale : 60,
          loyalty: typeof x.loyalty === "number" ? x.loyalty : 55,
          ambition: typeof x.ambition === "number" ? x.ambition : 45,
          expects: typeof x.expects === "number" ? x.expects : Math.round(salary * 1.05),
          workload: typeof x.workload === "number" ? x.workload : 50,
          training: typeof x.training === "number" ? x.training : 0,
          traits: Array.isArray(x.traits) ? x.traits : ["steady"],
          record: Array.isArray(x.record) ? x.record : [],
          joinedWeek: typeof x.joinedWeek === "number" ? x.joinedWeek : 0,
          warnings: typeof x.warnings === "number" ? x.warnings : 0,
          lead: typeof x.lead === "boolean" ? x.lead : false,
        };
      });
    }
    /* Markets are left absent on purpose. `marketOf` returns a neutral
       market for a city that has none, so an un-seeded save behaves exactly
       like the old static world until the first resolved week fills it. */
  }

  /* v10 -> v11 ---------------------------------------------------------
   *
   * Phase 3: the sandbox layer. Setbacks, ambitions, backgrounds, traits and
   * the retirement flag.
   *
   * The important migration here is not a field — it is a *semantic* change.
   * A v10 save could carry `outcome: { kind: "lost" }` written by the old
   * automatic terminators, and those terminators no longer exist. Such a run
   * is un-resumable through the UI, so it is converted into what it always
   * really was: a character whose story stopped. It keeps its outcome and is
   * marked `retired`, which is the one state that legitimately produces a
   * summary screen.
   *
   * A v10 save that was still in play simply gains empty collections and
   * carries on — indefinitely, because nothing checks the week any more.
   */
  if (!Array.isArray(s.setbacks)) s.setbacks = [];
  if (!Array.isArray(s.setbacksSurvived)) s.setbacksSurvived = [];
  if (!Array.isArray(s.ambitionsDone)) s.ambitionsDone = [];
  if (!Array.isArray(s.traits)) s.traits = [];
  if (s.ambition === undefined) s.ambition = null;
  if (s.legacy === undefined) s.legacy = null;
  if (typeof s.retired !== "boolean") {
    s.retired = isObj(s.outcome);
  }

  return s;
}

const clamp01to100 = (n: number) =>
  Math.max(0, Math.min(100, Number.isFinite(n) ? n : 50));

/**
 * The phone's standing numbers, read defensively out of an arbitrary save.
 *
 * Migration runs *before* validation, so nothing about the shape can be
 * assumed here — this is the one place in the codebase that has to cope with
 * genuinely unknown input, and it returns neutral values rather than throwing.
 */
function readSocial(data: unknown): {
  trust: number;
  sentiment: number;
  scrutiny: number;
} {
  const neutral = { trust: 50, sentiment: 50, scrutiny: 0 };
  if (!isObj(data)) return neutral;
  const m = data.med;
  if (!isObj(m)) return neutral;
  const phone = m.phone;
  if (!isObj(phone)) return neutral;
  const social = phone.social;
  if (!isObj(social)) return neutral;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    trust: num(social.trust, 50),
    sentiment: num(social.sentiment, 50),
    scrutiny: num(social.scrutiny, 0),
  };
}

/* ------------------------------------------------------- the last plan */

/**
 * The allocation committed most recently, kept under its own key.
 *
 * Deliberately NOT part of RunState. It is a convenience for the "repeat last
 * week" button, not a fact about the run — putting it in the save would mean
 * bumping the save version, extending the validator and regenerating every
 * fixture for something that changes nothing about what happens in the game.
 *
 * Stored per career, so a plan from a physician run is never offered to a
 * different career. Read defensively: a stale or hand-edited value must not be
 * able to inject an action id, so callers filter against the real action list.
 */
/**
 * Which lessons the player has already been through.
 *
 * Its own key rather than a field on the save, for two reasons: a save
 * written before onboarding existed stays valid without a migration, and
 * having been taught what a time block is belongs to the person rather than
 * to the character — starting a second physician should not re-explain it.
 */
const TAUGHT_KEY = "career-tycoon:taught:v1";

export function loadTaught(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(scoped(TAUGHT_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    /* Anything that is not a list of strings is a corrupt value, and a
       corrupt value here should re-teach rather than crash. */
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function saveTaught(ids: readonly string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scoped(TAUGHT_KEY), JSON.stringify([...ids]));
  } catch {
    // Storage disabled or full. Lessons simply reappear next session.
  }
}

const PLAN_KEY = "career-tycoon:lastplan:v1";

export function saveLastPlan(careerId: string, alloc: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scoped(PLAN_KEY), JSON.stringify({ careerId, alloc }));
  } catch {
    // Storage disabled or full. The button simply does not appear.
  }
}

export function loadLastPlan(careerId: string): Record<string, number> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(scoped(PLAN_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isObj(parsed)) return null;
    if (parsed.careerId !== careerId) return null;
    if (!isObj(parsed.alloc) || !numberMap(parsed.alloc)) return null;
    const alloc = parsed.alloc as Record<string, number>;
    /* Non-negative integers only; anything else is a corrupt value, and a
       corrupt plan should vanish rather than half-apply. */
    for (const n of Object.values(alloc)) {
      if (!isInt(n) || n < 0) return null;
    }
    return Object.values(alloc).some((n) => n > 0) ? alloc : null;
  } catch {
    return null;
  }
}

const TONES = ["good", "bad", "neutral"] as const;

/**
 * VALIDATION
 *
 * Every rule below is a rejection. Nothing is repaired: a save patched into a
 * half-valid state produces a run that is quietly wrong for the rest of its
 * life, while discarding one costs a single run and is obvious immediately.
 *
 * This function knows about the *engine's* shape only — weeks, resources,
 * history, log, outcome. It does not know what a clinic is. The career's own
 * slice of `data` is handed to that career's `validateData` hook, so adding
 * a second career adds a validator beside it rather than a branch in here.
 *
 * Exported so the contract tests can drive it directly; `loadRun` is the only
 * caller in the application.
 */
export function validateRun(s: Record<string, unknown>): boolean {
  /*
   * An unknown career is not so much a corrupt save as a save for a game that
   * no longer exists: nothing downstream can render it, and the page must
   * never be handed one.
   */
  if (!isStr(s.careerId)) return false;
  const career = getCareer(s.careerId);
  if (!career) return false;

  if (!isInt(s.week) || s.week < 1) return false;
  if (!isInt(s.seed)) return false;

  if (!numberMap(s.r)) return false;
  /*
   * `numberMap` only says "whatever is here is finite" — it accepts an empty
   * bag, and a save with `cash` deleted sailed through it. The career already
   * declares exactly which resources it runs on, so require every one of
   * them, by the career's own catalogue rather than a hardcoded list. The
   * underscore-prefixed scratch fields stay optional: migrations default
   * them, and older saves legitimately lack them.
   */
  if (!numbers(s.r, career.resources.map((res) => res.id))) return false;
  if (!numberMap(s.owned)) return false;
  if (!numberMap(s.eventHistory)) return false;

  if (!every(s.history, (h) => isObj(h) && isInt(h.week) && numbers(h, ["net"]))) {
    return false;
  }
  if (
    !every(
      s.log,
      (l) => isObj(l) && isInt(l.week) && isStr(l.text) && oneOf(l.tone, TONES),
    )
  ) {
    return false;
  }

  if (s.outcome !== null) {
    const o = s.outcome;
    if (!isObj(o)) return false;
    if (!oneOf(o.kind, ["won", "lost"])) return false;
    if (!isStr(o.title) || !isStr(o.body)) return false;
  }

  if (!isObj(s.data)) return false;
  // The career validates its own state. A career without a hook is trusted,
  // which is the honest default for one whose shape is not yet settled.
  if (career.validateData && !career.validateData(s.data)) return false;

  /* ------------------------------------------------- the v9 subsystems
   *
   * Optional on the type, required here: `migrateRun` runs first and fills
   * them, so by this point a missing field means the object never went
   * through migration — which for an imported file is exactly the case worth
   * rejecting.
   */

  if (
    !every(
      s.people,
      (p) =>
        isObj(p) &&
        isStr(p.id) &&
        oneOf(p.role, PERSON_ROLES) &&
        oneOf(p.status, PERSON_STATUSES) &&
        every(p.traits, (t) => oneOf(t, PERSON_TRAITS)) &&
        numbers(p, ["warmth", "trust", "respect"]) &&
        isInt(p.lastSeen) &&
        every(p.memory, isStr) &&
        every(
          p.recent,
          (i) =>
            isObj(i) && isInt(i.week) && isStr(i.text) && oneOf(i.tone, TONES),
        ),
    )
  ) {
    return false;
  }

  if (
    !every(
      s.timeline,
      (t) =>
        isObj(t) &&
        isStr(t.id) &&
        isInt(t.week) &&
        oneOf(t.kind, TIMELINE_KINDS) &&
        isStr(t.title) &&
        isStr(t.detail),
    )
  ) {
    return false;
  }

  if (
    !every(
      s.pending,
      (p) =>
        isObj(p) &&
        isStr(p.id) &&
        isInt(p.dueWeek) &&
        isStr(p.kind) &&
        (p.notice === undefined || isStr(p.notice)) &&
        (p.payload === undefined || isObj(p.payload)),
    )
  ) {
    return false;
  }

  /* ------------------------------------------------- the v11 subsystems */

  if (
    !every(
      s.setbacks,
      (b) =>
        isObj(b) &&
        oneOf(b.kind, SETBACK_KINDS) &&
        isInt(b.startedWeek) &&
        isInt(b.weeks) &&
        numbers(b, ["grip"]) &&
        every(b.done, isStr),
    )
  ) {
    return false;
  }
  if (Array.isArray(s.setbacks) && s.setbacks.length > MAX_SETBACKS) return false;
  if (!every(s.setbacksSurvived, (k) => oneOf(k, SETBACK_KINDS))) return false;
  if (!every(s.traits, (t) => oneOf(t, TRAIT_IDS))) return false;
  if (Array.isArray(s.traits) && s.traits.length > TRAIT_CAP) return false;
  if (
    !every(s.ambitionsDone, (a) =>
      oneOf(
        a,
        AMBITIONS.map((x) => x.id),
      ),
    )
  ) {
    return false;
  }
  if (
    s.ambition !== null &&
    s.ambition !== undefined &&
    !AMBITIONS.some((a) => a.id === s.ambition)
  ) {
    return false;
  }
  if (
    s.background !== undefined &&
    !BACKGROUNDS.some((b) => b.id === s.background)
  ) {
    return false;
  }
  /*
   * Where the run began. Optional — every save written before the choice
   * existed has none — and checked against the career that wrote it, since a
   * city id is only meaningful to one career. The career's own validator is
   * what guards the copy the simulation reads; this guards the record.
   */
  if (s.startCity !== undefined) {
    if (typeof s.startCity !== "string") return false;
    const cities = getCareer(s.careerId)?.startCities ?? [];
    if (cities.length > 0 && !cities.some((c) => c.id === s.startCity)) {
      return false;
    }
  }

  /* ------------------------------------------------- the v10 subsystems */

  if (
    !every(
      s.rivals,
      (r) =>
        isObj(r) &&
        isStr(r.id) &&
        oneOf(r.strategy, RIVAL_STRATEGIES) &&
        oneOf(r.stance, RIVAL_STANCES) &&
        isStr(r.city) &&
        numbers(r, ["standing", "skill", "worth", "sites", "staff", "ambition"]) &&
        isInt(r.lastMove) &&
        isInt(r.losses) &&
        isInt(r.wins) &&
        Array.isArray(r.history) &&
        r.history.length <= MAX_RIVAL_HISTORY &&
        every(
          r.history,
          (h) => isObj(h) && isInt(h.week) && isStr(h.text) && isStr(h.kind),
        ),
    )
  ) {
    return false;
  }

  if (
    !every(
      s.contracts,
      (c) =>
        isObj(c) &&
        isStr(c.defId) &&
        isStr(c.city) &&
        isInt(c.acceptedWeek) &&
        isInt(c.dueWeek) &&
        numbers(c, ["progress", "extraDifficulty", "payFactor"]) &&
        every(c.assigned, isStr) &&
        every(c.complications, isStr),
    )
  ) {
    return false;
  }

  if (
    !every(
      s.offers,
      (o) =>
        isObj(o) &&
        isStr(o.defId) &&
        isStr(o.city) &&
        isInt(o.expiresWeek) &&
        numbers(o, ["rivalBid"]),
    )
  ) {
    return false;
  }

  if (
    !every(
      s.contractLog,
      (c) =>
        isObj(c) &&
        isInt(c.week) &&
        isStr(c.defId) &&
        isStr(c.title) &&
        oneOf(c.outcome, ["won", "lost", "expired", "declined"]) &&
        numbers(c, ["fee"]),
    )
  ) {
    return false;
  }

  if (
    !every(
      s.obligations,
      (o) =>
        isObj(o) &&
        isStr(o.id) &&
        oneOf(o.kind, FUNDING_KINDS) &&
        numbers(o, ["principal", "outstanding", "rate", "weekly", "equity"]) &&
        isInt(o.week) &&
        isInt(o.missed) &&
        typeof o.settled === "boolean",
    )
  ) {
    return false;
  }
  /* Nobody may hold a save that has sold control, whatever an editor did. */
  if (
    Array.isArray(s.obligations) &&
    (s.obligations as { equity?: number }[]).reduce(
      (n, o) => n + (o.equity ?? 0),
      0,
    ) > MAX_EQUITY
  ) {
    return false;
  }

  if (
    !every(
      s.news,
      (n) =>
        isObj(n) &&
        isStr(n.id) &&
        isInt(n.week) &&
        oneOf(n.scope, ["world", "city", "rival", "you"]) &&
        isStr(n.headline) &&
        isStr(n.body) &&
        oneOf(n.tone, TONES),
    )
  ) {
    return false;
  }
  if (Array.isArray(s.news) && s.news.length > MAX_WORLD_NEWS) return false;

  if (
    !every(
      s.crises,
      (c) =>
        isObj(c) &&
        isStr(c.id) &&
        oneOf(c.kind, CRISIS_KINDS) &&
        isInt(c.startedWeek) &&
        isInt(c.stage) &&
        isInt(c.ignored) &&
        numbers(c, ["severity"]) &&
        every(c.taken, isStr) &&
        /* Whose stage set. Absent is a crisis from before any career but the
           Physician had one, and reads as the Physician's. */
        (c.career === undefined || isStr(c.career)),
    )
  ) {
    return false;
  }

  if (
    !every(
      s.repLog,
      (c) =>
        isObj(c) &&
        isInt(c.week) &&
        oneOf(
          c.id,
          REPUTATIONS.map((r) => r.id),
        ) &&
        numbers(c, ["delta"]) &&
        isStr(c.why),
    )
  ) {
    return false;
  }

  return true;
}

export function clearRun() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(scoped(KEY));
  } catch {
    /* nothing to do */
  }
}

/* ------------------------------------------------------ the career archive */

/**
 * Retired characters, stored beside the save rather than inside it.
 *
 * A run cannot hold the archive: the archive outlives every run, and a brand
 * new character has to be able to read it (to offer a legacy) before their own
 * save exists. Its own key, its own validator, its own bound.
 */
const ARCHIVE_KEY = "career-tycoon:archive:v1";

/**
 * WHOSE SAVE THIS IS
 *
 * Every key above is a *base*. `scoped` puts the signed-in player's id into
 * it, so two people sharing a browser get two entirely separate games rather
 * than overwriting each other on the same key.
 *
 * With no player set the base key is returned unchanged, which is deliberate
 * and load-bearing: it is exactly the key every existing save is already
 * under. `adoptLegacySave` moves that run into the first account created, so
 * nobody who was mid-run loses it the day the sign-in page appears.
 *
 * This is also the seam the storage swap goes through later. A Neon-backed
 * store replaces the *reads and writes*; the key shape and the scoping rule
 * do not have to change at all.
 */
let SCOPE = "";

export function setSaveScope(playerId: string | null): void {
  SCOPE = playerId ? `p.${playerId}:` : "";
}

export const saveScope = (): string => SCOPE;

const scoped = (key: string): string =>
  SCOPE ? key.replace("career-tycoon:", `career-tycoon:${SCOPE}`) : key;

/**
 * Move an unscoped save into a player's scope, once.
 *
 * Called when an account is created and there is a run sitting under the old
 * key. It copies rather than moves until the write has succeeded, for the
 * same reason the version migration above does.
 */
export function adoptLegacySave(playerId: string): void {
  if (typeof window === "undefined") return;
  const bases = [...KEYS, TAUGHT_KEY, PLAN_KEY, ARCHIVE_KEY];
  const previous = SCOPE;
  try {
    for (const base of bases) {
      const raw = window.localStorage.getItem(base);
      if (raw === null) continue;
      SCOPE = `p.${playerId}:`;
      const target = scoped(base);
      SCOPE = previous;
      if (window.localStorage.getItem(target) !== null) continue;
      window.localStorage.setItem(target, raw);
      window.localStorage.removeItem(base);
    }
  } catch {
    /* Storage full or disabled. The legacy save stays where it is, which is
       still readable by an unscoped session. */
    SCOPE = previous;
  }
}


export function loadArchive(): ArchivedCareer[] {
  if (typeof window === "undefined") return [];
  try {
    let raw = window.localStorage.getItem(scoped(ARCHIVE_KEY));
    /*
     * RESCUE PATH — the write below was unscoped for a while (the scoping
     * pass replaced single-line `setItem` calls and this one is multiline),
     * so a signed-in player's archive could land under the bare key and then
     * be invisible to the scoped read. If the scoped slot is empty and the
     * bare one is not, adopt it into this scope — copy first, remove only
     * after the write succeeded, same discipline as the version migration.
     */
    if (raw === null && SCOPE) {
      const stranded = window.localStorage.getItem(ARCHIVE_KEY);
      if (stranded !== null) {
        window.localStorage.setItem(scoped(ARCHIVE_KEY), stranded);
        window.localStorage.removeItem(ARCHIVE_KEY);
        raw = stranded;
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    /* Filtered rather than rejected wholesale: one corrupt character should
       not cost the player the other eleven. */
    return parsed.filter(isArchived).slice(0, MAX_ARCHIVE);
  } catch {
    return [];
  }
}

export function saveArchive(list: ArchivedCareer[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      /* Scoped, like the read above. These two MUST use the same key — the
         mismatch is exactly the bug the rescue path in `loadArchive` cleans
         up after. */
      scoped(ARCHIVE_KEY),
      // Newest first, bounded, so a long-lived install cannot grow forever.
      JSON.stringify(list.slice(0, MAX_ARCHIVE)),
    );
  } catch {
    /* Out of quota. The run is unaffected; the character is simply not kept. */
  }
}

export function archiveCharacter(c: ArchivedCareer): ArchivedCareer[] {
  const next = [c, ...loadArchive().filter((x) => x.id !== c.id)].slice(
    0,
    MAX_ARCHIVE,
  );
  saveArchive(next);
  return next;
}

/**
 * An archived character is *display* data — it is never fed back into a
 * simulation, so the validator only has to establish that rendering it cannot
 * crash. Anything malformed is dropped rather than repaired.
 */
function isArchived(v: unknown): v is ArchivedCareer {
  if (!isObj(v)) return false;
  return (
    isStr(v.id) &&
    isStr(v.careerId) &&
    isStr(v.careerLabel) &&
    isStr(v.name) &&
    isInt(v.weeks) &&
    isInt(v.retiredWeek) &&
    numbers(v, ["netWorth", "overall", "businesses"]) &&
    every(v.cities, isStr) &&
    every(v.traits, isStr) &&
    every(v.setbacksSurvived, isStr) &&
    every(v.ambitionsCompleted, isStr) &&
    every(
      v.reputation,
      (r) => isObj(r) && isStr(r.id) && isStr(r.label) && numbers(r, ["value"]),
    ) &&
    every(
      v.relationships,
      (r) => isObj(r) && isStr(r.name) && isStr(r.standing) && numbers(r, ["warmth"]),
    ) &&
    every(
      v.milestones,
      (m) => isObj(m) && isInt(m.week) && isStr(m.title) && isStr(m.detail),
    ) &&
    isStr(v.retiredNote)
  );
}
