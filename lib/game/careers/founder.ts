import type { CareerDef, LedgerLine, RunState } from "../types";
import type { SetbackKind } from "../setbacks";
import { money } from "../format";
import { pushLog } from "../engine";
import { validatePhone } from "../phone/validate";
import { makeRng } from "../rng";
import { FOUNDER_EVENTS } from "./newEvents";
import {
  generateWeekFrom,
  initialPhoneFrom,
  publishFrom,
} from "../phone/voicePack";
import { FOUNDER_PACK } from "../phone/packs";
import {
  BRAND_DECAY,
  ROUND_BY_ID,
  STARTUP_CITIES,
  STARTUP_CITY_BY_ID,
  STARTUP_ROLE_BY_ID,
  burnOf,
  churnRate,
  defaultAlive,
  dilutionFor,
  initialVenture,
  organicUsers,
  payroll,
  pitchPerBlock,
  revenueOf,
  roundAmount,
  roundBlocker,
  rolePrice,
  runwayLabel,
  runwayOf,
  stakeOf,
  startupCityOf,
  teamOutput,
  valuationOf,
  type Hire,
  type VentureState,
  venture,
  EXPERIMENT_BY_ID,
  STANCES,
  buildLiftOf,
  experimentCost,
  experimentsOf,
  funnelOf,
  insightOf,
  stanceOf,
  techDebtOf,
  unitEconomicsOf,
} from "./startup";

/**
 * THE FOUNDER
 *
 * A career played against a clock rather than a balance. See `startup.ts` for
 * the model and the reasoning; this file is the engine contract.
 *
 * ------------------------------------------------------------- the week
 *
 * Four things compete for the same blocks, and each is the right answer at a
 * different moment:
 *
 *   Build    raises the product, which cuts churn — the only permanent win
 *   Sell     users this week, none of which compound
 *   Market   brand, which compounds and decays if you stop
 *   Pitch    progress toward a round: weeks bought with ownership
 *
 * Nothing here is a placeholder. Every block moves a number the following
 * Monday reads, and the briefing shows the runway the allocation produces
 * *before* it is committed — which is how a player learns that hiring an
 * engineer to go faster can be the thing that kills the company.
 */

const START_CASH = 55_000;
const NAMES = [
  "Priya Raman", "Sam Okonkwo", "Lena Vogt", "Tomas Alvear", "Mei Chen",
  "Ade Balogun", "Ivan Petrov", "Sofia Reyes", "Ruth Adler", "Kofi Mensah",
  "Elin Dahl", "Omar Haddad",
];

/* Defined with the model; re-exported so every existing import of it
   from this module keeps working. */
export { venture };

const hireName = (n: number) => NAMES[n % NAMES.length];

/**
 * The goal scales with where you started, like every other career's.
 *
 * Four million, not the original one and a half: the balance bots reached
 * the old number in every city, every seed, by week ~80 — a plain company
 * at fifteen per cent market penetration already valued past it. At four
 * million the same bot lands at roughly half to two-thirds progress over
 * 120 weeks, which is what a three-year yardstick is supposed to feel like
 * from the floor.
 */
const goalFor = (s: RunState): number => {
  /*
   * Scaled by the market's ceiling, not by local wages. Scaling by the
   * salary index gave Mumbai — the largest market on the board — the
   * smallest goal, and the balance bot reached it every seed while the
   * expensive cities held. The yardstick is now 45% of what a saturated,
   * finished product would be worth here: reaching it means winning a
   * meaningful share of THIS market, whichever market that is.
   */
  const city = startupCityOf(venture(s));
  const priceHere = Math.round(24 * (0.8 + city.salaryIndex * 0.25));
  const saturated = ((city.market * priceHere) / 4.33) * 52 * 3;
  /*
   * Eighty per cent of the ceiling, because the measurement showed a plain
   * bot capturing ~70% of it by week 120 — a goal much below that is reached
   * on autopilot. At 0.8 the gentle city stays winnable for an ordinary
   * operator, the even cities read ~70-80% at the horizon, and the hard one
   * makes you fight the slow capital for it.
   */
  return Math.round(saturated * 0.8);
};

/**
 * The phone, created on first touch.
 *
 * Optional on the state so an older save loads; created here so that
 * save gains a handset rather than being rejected for not having one.
 */
function ensurePhone(s: RunState) {
  const st = venture(s);
  if (!st.phone) st.phone = initialPhoneFrom(FOUNDER_PACK);
  return st.phone;
}

export const founder: CareerDef = {
  id: "founder",
  label: "Founder",
  tagline:
    "An idea, eleven weeks of savings, and a market that has not asked for it yet.",
  distinctRule:
    "Your constraint is runway. Everything is priced in weeks of survival rather than money, and raising more buys time at the cost of owning less of what you are building.",
  icon: "rocket",
  available: true,
  weekLimit: 156,

  /* Founders work the hours they have. Burnout takes them away, nothing else. */
  timeBudget: (s) => (s.r.burnout > 80 ? 5 : 6),

  resources: [
    {
      id: "cash",
      label: "In the bank",
      hint: "Interesting only as the top half of a division. What matters is how many weeks it is.",
      format: "money",
      polarity: "higher-better",
      display: "stat",
    },
    {
      id: "debt",
      label: "Money owed",
      hint: "What you put in yourself, and anything the company has borrowed since.",
      format: "money",
      polarity: "lower-better",
      display: "stat",
    },
    {
      id: "reputation",
      label: "Standing",
      hint: "Whether the room takes the meeting. It does not sell the product for you.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "higher-better",
      display: "meter",
    },
    {
      id: "skill",
      label: "Judgement",
      hint: "What you have learned about the thing you are building. Makes every block worth more.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "higher-better",
      display: "meter",
    },
    {
      id: "burnout",
      label: "Burnout",
      hint: "Founders do not get signed off by anyone but their own body.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "lower-better",
      display: "meter",
    },
  ],

  actions: [
    {
      id: "build",
      label: "Build",
      blurb: "Ship. The only work that makes people stay rather than arrive.",
      timeCost: 1,
      cashCost: 0,
      preview: (s) => {
        const v = venture(s);
        const gain = 0.25 * (2.4 + s.r.skill * 0.03);
        return [
          `Product +${gain.toFixed(1)}`,
          `Churn is ${(churnRate(v) * 100).toFixed(1)}% a week and falls as this rises`,
        ];
      },
    },
    {
      id: "sell",
      label: "Sell",
      blurb:
        "Talk to people one at a time. It works, and none of it is still working next month.",
      timeCost: 1,
      cashCost: 0,
      preview: (s) => {
        const v = venture(s);
        const users = Math.round(9 + s.r.skill * 0.14 + v.product * 0.1);
        return [
          `About ${users} customers this week`,
          "Nothing here compounds — next week starts from the same place",
        ];
      },
    },
    {
      id: "market",
      label: "Market",
      blurb:
        "Build the channel instead of the customer. Slow, and then it is the only thing working.",
      timeCost: 1,
      cashCost: 900,
      preview: (s) => {
        const v = venture(s);
        return [
          `Brand +${(3.2 + s.r.skill * 0.02).toFixed(1)}, and it decays ${Math.round(BRAND_DECAY * 100)}% a week`,
          `Currently worth about ${Math.round(organicUsers(v))} customers a week on its own`,
        ];
      },
    },
    {
      id: "pitch",
      label: "Pitch",
      blurb:
        "Rooms, decks and follow-ups. Buys weeks, and costs a piece of the company forever.",
      timeCost: 1,
      cashCost: 0,
      unlocked: (s) => venture(s).pitchRound !== undefined,
      preview: (s) => {
        const v = venture(s);
        const round = v.pitchRound ? ROUND_BY_ID.get(v.pitchRound) : undefined;
        if (!round) return ["Choose a round to raise first."];
        return [
          `Progress +${Math.round(pitchPerBlock(v, round))} of 100`,
          `Closing pays ${money(roundAmount(v, round))} for ${dilutionFor(v, round)}% of the company`,
        ];
      },
    },
    {
      id: "interview",
      label: "Talk to customers",
      blurb:
        "An hour each with people who use it, nearly used it, or left. Nothing ships, and everything you ship after lands better.",
      timeCost: 1,
      cashCost: 0,
      preview: (s) => {
        const v = venture(s);
        const gain = 5.5 + s.r.skill * 0.04;
        return [
          `Insight +${gain.toFixed(1)} of 100, and it fades if you stop asking`,
          `Right now building lands at ${Math.round(buildLiftOf(v) * 100)}% and ${Math.round(
            (funnelOf(v).buyRate / 0.24 - 1) * 100,
          )}% more trials convert`,
        ];
      },
    },
    {
      id: "rest",
      label: "Step away",
      blurb: "The company survives a week of you being a person.",
      timeCost: 1,
      cashCost: 0,
      preview: () => ["Burnout −9", "Nothing else moves"],
    },
  ],

  events: FOUNDER_EVENTS,

  initialResources: () => ({
    cash: START_CASH,
    debt: 0,
    reputation: 8,
    skill: 34,
    burnout: 10,
    _lastRevenue: 0,
    _burnoutPeak: 0,
  }),

  initialData: () => {
    /* The handset exists from week one, so the button is there the
       first time anybody looks for it. */
    const st = initialVenture();
    st.phone = initialPhoneFrom(FOUNDER_PACK);
    return { venture: st };
  },

  startCities: STARTUP_CITIES,

  applyStartCity: (s, cityId) => {
    const city = STARTUP_CITY_BY_ID.get(cityId);
    if (!city) return;
    const v = venture(s);
    v.city = cityId;
    /*
     * Savings are personal, so they do not scale with the city's payroll —
     * which is the point. The same $55,000 is eleven weeks in Berlin and five
     * in San Francisco, and the player feels that on the first screen rather
     * than reading it in a table.
     */
    v.price = Math.round(24 * (0.8 + city.salaryIndex * 0.25));
  },

  command: (s, cmd, arg) => {
    const v = venture(s);
    switch (cmd) {
      /*
       * THE HANDSET.
       *
       * Four commands, identical in every career that has a phone.
       * The content differs; the transaction does not.
       */
      case "post": {
        const phone = ensurePhone(s);
        publishFrom(
          FOUNDER_PACK,
          phone,
          s,
          arg,
          makeRng((s.seed ^ (s.week * 0x2f6f2b79)) >>> 0),
        );
        break;
      }
      case "readMessages": {
        for (const m of ensurePhone(s).messages) m.read = true;
        break;
      }
      case "readNews": {
        for (const n of ensurePhone(s).news) n.read = true;
        break;
      }

      /* Take somebody on. Capacity now, burn forever. */
      case "hireVenture": {
        const role = STARTUP_ROLE_BY_ID.get(arg);
        if (!role) return;
        const { salary, hireCost } = rolePrice(v, role);
        if (s.r.cash < hireCost) return;
        s.r.cash -= hireCost;
        const n = v.nextId++;
        const hire: Hire = {
          id: `hv-${n}`,
          name: hireName(n),
          role: role.id,
          salary,
          since: s.week,
        };
        v.team.push(hire);
        break;
      }

      /*
       * Letting somebody go.
       *
       * The only lever that lengthens the runway without raising, and it is
       * meant to feel bad: you lose the capacity immediately and the burn
       * only stops next week.
       */
      case "letGo": {
        const idx = v.team.findIndex((h) => h.id === arg);
        if (idx < 0) return;
        const [gone] = v.team.splice(idx, 1);
        /* Notice, in the only currency that matters here. */
        s.r.cash -= Math.round(gone.salary * 2);
        s.r.burnout = Math.min(100, s.r.burnout + 4);
        pushLog(s, `You let ${gone.name} go. Two weeks' notice, paid.`, "bad");
        break;
      }

      /* Decide which round you are out raising. Pitching does the work. */
      case "startRaise": {
        const round = ROUND_BY_ID.get(arg);
        if (!round) return;
        if (roundBlocker(v, round)) return;
        v.pitchRound = round.id;
        v.pitch = 0;
        break;
      }

      case "stopRaise": {
        v.pitchRound = undefined;
        v.pitch = 0;
        break;
      }

      /* What you charge. Raising it loses people; lowering it wins a few. */
      case "setRoadmap": {
        const stance = arg as keyof typeof STANCES;
        if (!STANCES[stance]) return;
        if (stanceOf(v) === stance) return;
        v.stance = stance;
        pushLog(
          s,
          stance === "ship"
            ? "The roadmap now says ship. Everything moves faster, and the corners you cut stay cut."
            : stance === "stability"
              ? "The roadmap now says stability. Refactor weeks — little ships, and the debt comes down."
              : "The roadmap is back to steady: the pace the code can carry.",
          "neutral",
        );
        break;
      }

      case "runExperiment": {
        const def = EXPERIMENT_BY_ID.get(arg);
        if (!def) return;
        /* One test at a time — two running make both unreadable — and each
           runs once: the second rewrite is a redesign, not an experiment. */
        if (v.experimentRun) return;
        if (experimentsOf(v).some((e) => e.id === def.id)) return;
        const cost = experimentCost(v, def);
        if (s.r.cash < cost) return;
        s.r.cash -= cost;
        v.experimentRun = { id: def.id, started: s.week };
        pushLog(
          s,
          `${def.label} is live: ${money(cost)}, and about two weeks before the numbers mean anything.`,
          "neutral",
        );
        break;
      }

      case "setPrice": {
        const next = Number(arg);
        if (!Number.isFinite(next) || next < 4 || next > 400) return;
        const old = v.price;
        v.price = Math.round(next);
        /* A price rise sheds the least committed immediately. */
        if (v.price > old) {
          const shed = v.users * Math.min(0.35, (v.price / old - 1) * 0.55);
          v.users = Math.max(0, v.users - shed);
        }
        break;
      }
    }
  },

  applyAction: (s, actionId, rng) => {
    const v = venture(s);
    switch (actionId) {
      case "build": {
        /*
         * A quarter of the old rate. The balance trace showed the product at
         * 100 by week twenty — which flattened churn, fattened the sell
         * yield and maxed the valuation multiple all in the first act. A
         * product is now roughly a year of focused building, which is what
         * the roadmap events were priced against all along.
         *
         * Times the roadmap's pace and what you know about the customer —
         * both exactly 1 for a founder who has touched neither.
         */
        v.product = Math.min(
          100,
          v.product + 0.25 * (2.4 + s.r.skill * 0.03) * buildLiftOf(v),
        );
        s.r.skill = Math.min(100, s.r.skill + 0.35);
        s.r.burnout = Math.min(100, s.r.burnout + 3.5);
        break;
      }
      case "interview": {
        v.insight = Math.min(100, insightOf(v) + 5.5 + s.r.skill * 0.04);
        s.r.burnout = Math.min(100, s.r.burnout + 2);
        break;
      }
      case "sell": {
        const got = 9 + s.r.skill * 0.14 + v.product * 0.1;
        /* Selling is a conversation, so it varies. Building does not. */
        v.users += got * (0.82 + rng.next() * 0.36);
        s.r.burnout = Math.min(100, s.r.burnout + 3);
        break;
      }
      case "market": {
        v.brand = Math.min(100, v.brand + 3.2 + s.r.skill * 0.02);
        s.r.burnout = Math.min(100, s.r.burnout + 2.5);
        break;
      }
      case "pitch": {
        const round = v.pitchRound ? ROUND_BY_ID.get(v.pitchRound) : undefined;
        if (!round) return;
        v.pitch = Math.min(100, v.pitch + pitchPerBlock(v, round));
        s.r.reputation = Math.min(100, s.r.reputation + 0.4);
        s.r.burnout = Math.min(100, s.r.burnout + 3);
        break;
      }
      case "rest": {
        s.r.burnout = Math.max(0, s.r.burnout - 9);
        break;
      }
    }
  },

  resolveWeek: (s, rng) => {
    const v = venture(s);
    const out: LedgerLine[] = [];
    const city = startupCityOf(v);

    /* ------------------------------------------------ the team's own week */
    const team = teamOutput(v);
    if (team.build > 0) {
      /* The team ships at the roadmap's pace too — a stance is the whole
         engineering organisation's answer, not a personal habit. */
      v.product = Math.min(100, v.product + team.build * buildLiftOf(v));
    }
    if (team.market > 0) {
      v.brand = Math.min(100, v.brand + team.market);
    }
    const sold = team.sell * (0.85 + rng.next() * 0.3);

    /* ------------------------------------------------------- growth, churn */
    const organic = organicUsers(v);
    const gained = organic + sold;
    const churned = v.users * churnRate(v);
    v.users = Math.max(0, v.users + gained - churned);

    /* Attention is a stock and it leaks. Stop marketing and it drains. */
    v.brand = Math.max(0, v.brand * (1 - BRAND_DECAY));

    /* ------------------------------------------------------ the product work */
    /* The roadmap's bill. Ship accrues, stability pays down, steady is
       exactly neutral — the compatibility promise for every old save. */
    const debtDelta = STANCES[stanceOf(v)].debtPerWeek;
    if (debtDelta !== 0) {
      v.techDebt = Math.max(0, Math.min(100, techDebtOf(v) + debtDelta));
    }
    /* What you knew about the market last quarter is not what is true now. */
    if (insightOf(v) > 0) {
      v.insight = Math.max(0, insightOf(v) * 0.98);
    }

    /* An experiment reads out after two weeks: the lift is measured, not
       promised, and most of the measurement is how well you knew what to
       test. The result is permanent on its stage of the funnel. */
    if (v.experimentRun && s.week - v.experimentRun.started >= 2) {
      const def = EXPERIMENT_BY_ID.get(v.experimentRun.id);
      if (def) {
        const informed = 0.5 + (insightOf(v) / 100) * 0.75;
        const lift = def.baseLift * informed * (0.85 + rng.next() * 0.3);
        v.experiments = [
          ...experimentsOf(v),
          { id: def.id, week: s.week, lift },
        ];
        out.push({
          label: `${def.label} read out`,
          kind: "info",
          note: `${def.stage === "visitors" ? "Visits" : def.stage === "trials" ? "Trials" : "Conversion"} up ${(lift * 100).toFixed(0)}%, permanently.`,
        });
        pushLog(
          s,
          `The ${def.label.toLowerCase()} read out: ${(lift * 100).toFixed(0)}% more ${
            def.stage === "visitors"
              ? "people finding the product"
              : def.stage === "trials"
                ? "visitors trying it"
                : "trials converting"
          }. It stays.`,
          "good",
        );
      }
      v.experimentRun = undefined;
    }

    /* ----------------------------------------------------------- the money */
    const revenue = revenueOf(v);
    const wages = payroll(v);
    /* Debt makes every server dearer: pages that load twice, jobs that
       retry. Zero debt is exactly the old bill. */
    const infra = Math.round(v.users * 0.35 * (1 + techDebtOf(v) / 250));

    if (revenue > 0) {
      out.push({
        label: `Subscriptions — ${Math.round(v.users).toLocaleString("en-US")} customers`,
        amount: revenue,
        kind: "income",
      });
      s.r.cash += revenue;
    }
    if (wages > 0) {
      out.push({
        label: `Payroll — ${v.team.length} on the team`,
        amount: -wages,
        kind: "expense",
      });
      s.r.cash -= wages;
    }
    out.push({
      label: `Desks in ${city.name}`,
      amount: -city.rent,
      kind: "expense",
    });
    s.r.cash -= city.rent;
    out.push({
      label: "Living",
      amount: -city.living,
      kind: "expense",
      note: "Rent and food. It comes out whether or not the company works.",
    });
    s.r.cash -= city.living;
    if (infra > 0) {
      out.push({
        label: "Servers and tooling",
        amount: -infra,
        kind: "expense",
        note: "Scales with the customers you have.",
      });
      s.r.cash -= infra;
    }
    s.r._lastRevenue = revenue;

    /* ------------------------------------------------------- closing a round */
    if (v.pitchRound && v.pitch >= 100) {
      const round = ROUND_BY_ID.get(v.pitchRound);
      if (round) {
        const blocked = roundBlocker(v, round);
        if (blocked) {
          /* Traction fell away mid-raise. The round dies rather than closing
             on numbers that are no longer true. */
          out.push({
            label: `The ${round.label.toLowerCase()} fell through`,
            kind: "info",
            note: blocked,
          });
          pushLog(
            s,
            `The ${round.label.toLowerCase()} fell apart in diligence. ${blocked}`,
            "bad",
          );
          v.pitchRound = undefined;
          v.pitch = 0;
        } else {
          const amount = roundAmount(v, round);
          const dilution = dilutionFor(v, round);
          s.r.cash += amount;
          v.raised += amount;
          v.equity = Math.max(1, v.equity * (1 - dilution / 100));
          v.roundsClosed.push(round.id);
          v.pitchRound = undefined;
          v.pitch = 0;
          s.r.reputation = Math.min(100, s.r.reputation + 12);
          out.push({
            label: `${round.label} closed`,
            amount,
            kind: "income",
            note: `${dilution}% of the company. You keep ${v.equity.toFixed(1)}%.`,
          });
          pushLog(
            s,
            `The ${round.label.toLowerCase()} closed: ${money(amount)} for ${dilution}% of the company. You own ${v.equity.toFixed(1)}%.`,
            "good",
          );
        }
      }
    }

    /* --------------------------------------------------------- the headline */
    const burn = burnOf(v);
    const weeks = runwayOf(s.r.cash, v);
    const alive = defaultAlive(v);

    out.push({
      label: "Runway",
      kind: "info",
      note: alive
        ? "Revenue covers burn. You are default alive — nothing is running out."
        : `${runwayLabel(s.r.cash, v)} at ${money(burn - revenue)} a week net.`,
    });

    v.lastWeek = {
      week: s.week,
      gained: Math.round(gained),
      churned: Math.round(churned),
      revenue,
      burn,
      runway: weeks,
      alive,
      lines: [],
    };

    /* The week you stop dying is worth saying out loud, once. */
    if (alive && !(s.r._wasAlive ?? 0)) {
      s.r._wasAlive = 1;
      pushLog(
        s,
        "Revenue covered burn this week. You are default alive: the company no longer needs anybody's permission to exist.",
        "good",
      );
    } else if (!alive && (s.r._wasAlive ?? 0)) {
      s.r._wasAlive = 0;
      pushLog(
        s,
        "Burn went back above revenue. The clock is running again.",
        "bad",
      );
    }

    s.r.burnout = Math.max(0, s.r.burnout - 1);
    /* What the world says about the week that just happened. Its own
       stream, so the phone can never disturb the simulation's dice. */
    generateWeekFrom(
      FOUNDER_PACK,
      ensurePhone(s),
      s,
      makeRng((s.seed ^ (s.week * 0x51a3f27b)) >>> 0),
    );

    s.r._burnoutPeak = Math.max(s.r._burnoutPeak ?? 0, s.r.burnout);
    return out;
  },

  checkSetbacks: (s) => {
    const out: SetbackKind[] = [];
    const v = venture(s);
    if (Math.max(s.r.burnout, s.r._burnoutPeak ?? 0) >= 100) out.push("collapse");
    /*
     * Out of road. Not the end of the run — the engine's recovery is a bridge
     * on terrible terms, which is exactly what happens to a company that runs
     * out of money and still has something worth saving.
     */
    if (s.r.cash < 0 && !defaultAlive(v)) out.push("insolvency");
    if (out.includes("collapse")) s.r._burnoutPeak = 0;
    return out;
  },

  validateData: (data) => {
    const d = data as { venture?: unknown };
    if (typeof d !== "object" || d === null) return false;
    const v = d.venture as VentureState | undefined;
    if (typeof v !== "object" || v === null) return false;
    /* The phone is optional — a save from before this career had one
       still loads — but a present one must be the real shape. This
       career previously did not look at it at all. */
    if (v.phone !== undefined && !validatePhone(v.phone)) {
      return false;
    }
    if (!STARTUP_CITY_BY_ID.has(v.city)) return false;
    if (
      [v.users, v.price, v.product, v.brand, v.equity, v.raised, v.pitch].some(
        (n) => typeof n !== "number" || !Number.isFinite(n),
      )
    ) {
      return false;
    }
    if (v.equity <= 0 || v.equity > 100) return false;
    if (!Array.isArray(v.team)) return false;
    if (v.team.some((h) => !STARTUP_ROLE_BY_ID.has(h.role))) return false;
    if (!Array.isArray(v.roundsClosed)) return false;
    if (v.roundsClosed.some((id) => !ROUND_BY_ID.has(id))) return false;
    if (v.pitchRound !== undefined && !ROUND_BY_ID.has(v.pitchRound)) {
      return false;
    }
    /* Phase 5 fields, optional to the last: a save from before the product
       work carries none of them and still loads. Present ones must be the
       real shape — an insight of "lots" is a corrupted save, not a style. */
    for (const n of [v.insight, v.techDebt]) {
      if (
        n !== undefined &&
        (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 100)
      ) {
        return false;
      }
    }
    if (v.stance !== undefined && !STANCES[v.stance]) return false;
    if (v.experiments !== undefined) {
      if (!Array.isArray(v.experiments)) return false;
      for (const e of v.experiments) {
        if (
          typeof e !== "object" ||
          e === null ||
          !EXPERIMENT_BY_ID.has(e.id) ||
          !Number.isInteger(e.week) ||
          typeof e.lift !== "number" ||
          !Number.isFinite(e.lift)
        ) {
          return false;
        }
      }
    }
    if (v.experimentRun !== undefined) {
      const r = v.experimentRun;
      if (
        typeof r !== "object" ||
        r === null ||
        !EXPERIMENT_BY_ID.has(r.id) ||
        !Number.isInteger(r.started)
      ) {
        return false;
      }
    }
    return true;
  },

  scoreboard: (s) => {
    const v = venture(s);
    return {
      label: "Your stake",
      value: money(stakeOf(v)),
      sub: `${runwayLabel(s.r.cash, v)} · ${Math.round(v.users).toLocaleString("en-US")} customers · you own ${v.equity.toFixed(1)}%`,
    };
  },

  briefing: (s, alloc) => {
    const v = venture(s);
    /*
     * The forecast is the teaching tool.
     *
     * It answers the one question the career is about — how many weeks does
     * this plan leave me — before the week is committed, so the player can
     * see a hire eat the runway rather than discovering it on Monday.
     */
    const team = teamOutput(v);
    const build = (alloc.build ?? 0) * 0.25 * (2.4 + s.r.skill * 0.03) + team.build;
    const sell = (alloc.sell ?? 0) * (9 + s.r.skill * 0.14 + v.product * 0.1);
    const spend = (alloc.market ?? 0) * 900;

    const projected: VentureState = {
      ...v,
      product: Math.min(100, v.product + build),
      users: v.users + sell + team.sell + organicUsers(v) - v.users * churnRate(v),
    };
    const weeks = runwayOf(s.r.cash - spend, projected);
    const net = burnOf(projected) - revenueOf(projected);

    const out = [
      {
        label: "Runway after this week",
        value: runwayLabel(s.r.cash - spend, projected),
        tone: defaultAlive(projected)
          ? ("good" as const)
          : weeks < 6
            ? ("bad" as const)
            : ("neutral" as const),
        note: defaultAlive(projected)
          ? "Revenue covers burn. Nothing is running out."
          : `${money(net)} a week going out, net of revenue.`,
      },
      {
        label: "Customers",
        value: `${Math.round(projected.users).toLocaleString("en-US")}`,
        tone:
          projected.users > v.users ? ("good" as const) : ("bad" as const),
        note: `${Math.round(organicUsers(v))} arrive on their own, ${Math.round(v.users * churnRate(v))} leave.`,
      },
    ];

    if (techDebtOf(v) >= 50) {
      const econ = unitEconomicsOf(v);
      out.push({
        label: "Technical debt",
        value: `${Math.round(techDebtOf(v))} of 100`,
        tone: "bad" as const,
        note: `Churn and server costs are carrying it. A customer is worth ${money(Math.round(econ.lifetimeValue))} over their stay — stability weeks bring it back.`,
      });
    }

    if (v.pitchRound) {
      const round = ROUND_BY_ID.get(v.pitchRound);
      if (round) {
        const after = Math.min(
          100,
          v.pitch + (alloc.pitch ?? 0) * pitchPerBlock(v, round),
        );
        out.push({
          label: `${round.label} progress`,
          value: `${Math.round(after)}%`,
          tone: after >= 100 ? ("good" as const) : ("neutral" as const),
          note:
            after >= 100
              ? `Closes this week: ${money(roundAmount(v, round))} for ${dilutionFor(v, round)}%.`
              : `${money(roundAmount(v, round))} when it closes.`,
        });
      }
    }

    return out;
  },

  objective: (s) => {
    const v = venture(s);
    const goal = goalFor(s);
    const alive = defaultAlive(v);
    return {
      text: `Get ${startupCityOf(v).name} to default alive and build your own stake to ${money(goal)}. Every week is priced in survival, and every raise costs a piece of the company for good.${alive ? " Revenue covers burn — the clock has stopped." : ""}`,
      progress: Math.max(0, Math.min(1, stakeOf(v) / goal)),
    };
  },
};

/** Re-exported so the panel and the tests read valuation from one place. */
export { valuationOf, stakeOf };
