import type { CareerDef, LedgerLine, RunState } from "../types";
import type { SetbackKind } from "../setbacks";
import { money } from "../format";
import { pushLog } from "../engine";
import { validatePhone } from "../phone/validate";
import { makeRng } from "../rng";
import { STUDIO_EVENTS } from "./newEvents";
import {
  generateWeekFrom,
  initialPhoneFrom,
  publishFrom,
} from "../phone/voicePack";
import { ARCHITECT_PACK } from "../phone/packs";
import {
  KIND_BY_ID,
  STAGE_COUNT,
  STUDIO_CITIES,
  STUDIO_CITY_BY_ID,
  STUDIO_ROLE_BY_ID,
  clientName,
  competitionOdds,
  entryFee,
  feeFor,
  initialStudio,
  offerableKinds,
  revisionDepth,
  revisionRisk,
  rolePayStudio,
  stageFee,
  stageOf,
  stageWeeks,
  studioCityOf,
  studioOutput,
  studioWages,
  workOnTheBoards,
  type Commission,
  type StudioState,
  studio,
  BRIEFS,
  CONSENT_WEEKS,
  MATERIAL_BY_ID,
  briefOf,
  consentCost,
  stageWeeksOf,
} from "./studio";

/**
 * THE ARCHITECT
 *
 * See `studio.ts` for the model. The two things that make this career its own
 * both live in `resolveWeek`:
 *
 *   the staging block   — each completed stage banks its share of the fee,
 *                         permanently, whatever happens to the building after
 *   the revision block  — and a client who has not seen you can send the
 *                         whole thing back a stage, destroying the drawings
 *                         but never the money
 *
 * A Solicitor gambles everything on one outcome at the end. An architect is
 * paid all the way along and can still be made to draw the same building
 * three times.
 */

const START_CASH = 16_000;
const START_DEBT = 22_000;

/* Defined with the model; re-exported so every existing import of it
   from this module keeps working. */
export { studio };

const goalFor = (s: RunState): number =>
  Math.round(900_000 * studioCityOf(studio(s)).feeIndex);

/** Everything the practice is worth: cash, less debt, plus work in hand. */
const practiceWorth = (s: RunState): number =>
  s.r.cash - s.r.debt + Math.round(workOnTheBoards(studio(s)) * 0.45);

/** The commission the board is pointed at, or the nearest thing to it. */
function focused(a: StudioState): Commission | undefined {
  const live = a.commissions.filter((c) => !c.done);
  return live.find((c) => c.id === a.focus) ?? live[0];
}

/**
 * The phone, created on first touch.
 *
 * Optional on the state so an older save loads; created here so that
 * save gains a handset rather than being rejected for not having one.
 */
function ensurePhone(s: RunState) {
  const st = studio(s);
  if (!st.phone) st.phone = initialPhoneFrom(ARCHITECT_PACK);
  return st.phone;
}

export const architect: CareerDef = {
  id: "architect",
  label: "Architect",
  tagline:
    "A practice of one, a competition entry nobody asked for, and a fee scale set by people who have never drawn anything.",
  distinctRule:
    "Your constraint is the long commission. Buildings take years, payment is staged against milestones you do not control, and a client can change their mind in month eighteen and reset the work.",
  icon: "compass",
  available: true,
  weekLimit: 156,

  timeBudget: (s) => (s.r.burnout > 80 ? 5 : 6),

  resources: [
    {
      id: "cash",
      label: "Cash",
      hint: "Banked fees. Every stage you finish adds to this and nothing takes it back.",
      format: "money",
      polarity: "higher-better",
      display: "stat",
    },
    {
      id: "debt",
      label: "Practice loan",
      hint: "The studio, the insurance, and the first year of being unknown.",
      format: "money",
      polarity: "lower-better",
      display: "stat",
    },
    {
      id: "reputation",
      label: "Standing",
      hint: "What you are allowed to be asked to design. Built by finishing things.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "higher-better",
      display: "meter",
    },
    {
      id: "skill",
      label: "Craft",
      hint: "How much building you get out of a week at the board.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "higher-better",
      display: "meter",
    },
    {
      id: "burnout",
      label: "Burnout",
      hint: "Charrettes, deadlines, and the last three weeks of every tender.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "lower-better",
      display: "meter",
    },
  ],

  actions: [
    {
      id: "draw",
      label: "At the board",
      blurb: "Drawing the job in front of you. This is the work.",
      timeCost: 1,
      cashCost: 0,
      preview: (s) => {
        const a = studio(s);
        const c = focused(a);
        const rate = 0.25 * (1 + s.r.skill * 0.008);
        if (!c) return ["Nothing on the boards. Court a client first."];
        const kind = KIND_BY_ID.get(c.kind);
        const stage = stageOf(c);
        return [
          `${rate.toFixed(2)} weeks of ${stage.label.toLowerCase()}`,
          kind
            ? `Finishing it banks ${money(stageFee(a, kind, stage))}`
            : "Progress on the current stage",
        ];
      },
    },
    {
      id: "client",
      label: "See the client",
      blurb:
        "Lunches, walkthroughs and reassurance. It draws nothing and it saves everything.",
      timeCost: 1,
      cashCost: 90,
      preview: (s) => {
        const a = studio(s);
        const c = focused(a);
        if (!c) return ["Nobody to see yet."];
        const before = revisionRisk(a, c, s.week);
        const after = revisionRisk(a, { ...c, lastSeen: s.week }, s.week);
        return [
          `Brief change risk ${(before * 100).toFixed(0)}% → ${(after * 100).toFixed(0)}%`,
          "Resets how recently they have seen you, which is the whole defence",
        ];
      },
    },
    {
      id: "court",
      label: "Court work",
      blurb:
        "Coffees, awards dinners, and being the practice somebody thinks of.",
      timeCost: 1,
      cashCost: 60,
      preview: (s) => [
        "A chance of an offer, better the higher your standing",
        `Standing ${Math.round(s.r.reputation)} decides what kind of work is offered`,
      ],
    },
    {
      id: "compete",
      label: "Competition",
      blurb:
        "Unpaid months for a building nobody has promised you. This is how names are made.",
      timeCost: 1,
      cashCost: 0,
      unlocked: (s) => studio(s).competition !== undefined,
      preview: (s) => {
        const a = studio(s);
        if (!a.competition) return ["Enter a competition first."];
        const odds = competitionOdds(a.competition, s.r.reputation);
        return [
          `Effort ${a.competition.effort.toFixed(1)} weeks in`,
          `Odds of winning about ${(odds * 100).toFixed(0)}%`,
        ];
      },
    },
    {
      id: "rest",
      label: "Step away",
      blurb: "A week away from the board. The drawings wait.",
      timeCost: 1,
      cashCost: 0,
      preview: () => ["Burnout −9", "Nothing is drawn"],
    },
  ],

  events: STUDIO_EVENTS,

  initialResources: () => ({
    cash: START_CASH,
    debt: START_DEBT,
    reputation: 6,
    skill: 36,
    burnout: 10,
    _lastRevenue: 0,
    _burnoutPeak: 0,
  }),

  initialData: () => {
    /* The handset exists from week one, so the button is there the
       first time anybody looks for it. */
    const st = initialStudio();
    st.phone = initialPhoneFrom(ARCHITECT_PACK);
    return { studio: st };
  },

  startCities: STUDIO_CITIES,

  applyStartCity: (s, cityId) => {
    const city = STUDIO_CITY_BY_ID.get(cityId);
    if (!city) return;
    const a = studio(s);
    a.city = cityId;
    s.r.debt = Math.round(START_DEBT * city.feeIndex);
    s.r.cash = Math.round(START_CASH * city.feeIndex);
    /* One small job to start, so week one has a board to stand at. */
    const n = a.nextId++;
    a.offers.push({
      id: `of-${n}`,
      kind: "extension",
      client: clientName(n),
    });
  },

  command: (s, cmd, arg) => {
    const a = studio(s);
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
          ARCHITECT_PACK,
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

      case "takeCommission": {
        const idx = a.offers.findIndex((o) => o.id === arg);
        if (idx < 0) return;
        const [offer] = a.offers.splice(idx, 1);
        const n = a.nextId++;
        a.commissions.push({
          id: `cm-${n}`,
          kind: offer.kind,
          client: offer.client,
          stage: 0,
          progress: 0,
          paid: 0,
          revisions: 0,
          /* They have just met you, so the clock starts warm. */
          lastSeen: s.week,
          startedWeek: s.week,
        });
        if (!a.focus) a.focus = `cm-${n}`;
        break;
      }

      /*
       * THE BRIEF MEETING. `arg` is "commissionId:choice" — the same
       * transaction shape throughout this block. Each is agreed once and
       * early; repricing a building at tender is what revisions are for.
       */
      case "setBrief": {
        const [id, choice] = arg.split(":");
        const c = a.commissions.find((x) => x.id === id && !x.done);
        if (!c || c.brief !== undefined || c.stage > 1) return;
        if (!BRIEFS[choice as keyof typeof BRIEFS]) return;
        c.brief = choice as keyof typeof BRIEFS;
        c.lastSeen = s.week;
        pushLog(
          s,
          `The brief for ${c.client} is agreed: ${BRIEFS[c.brief].label.toLowerCase()}. ${BRIEFS[c.brief].blurb}`,
          "neutral",
        );
        break;
      }

      case "chooseMaterial": {
        const [id, choice] = arg.split(":");
        const c = a.commissions.find((x) => x.id === id && !x.done);
        const mat = MATERIAL_BY_ID.get(choice as never);
        if (!c || c.material !== undefined || c.stage > 2 || !mat) return;
        c.material = mat.id;
        pushLog(
          s,
          `${c.client}'s building will be ${mat.label.toLowerCase()}. ${mat.blurb}`,
          "neutral",
        );
        break;
      }

      case "lodgeConsent": {
        const c = a.commissions.find((x) => x.id === arg && !x.done);
        if (!c || c.consent !== undefined || c.stage > 1) return;
        const kind = KIND_BY_ID.get(c.kind);
        if (!kind) return;
        const cost = consentCost(a, kind);
        if (s.r.cash < cost) return;
        s.r.cash -= cost;
        c.consent = "lodged";
        c.consentWeek = s.week;
        pushLog(
          s,
          `The planning application for ${c.client} is lodged: ${money(cost)}, and the committee sits in about ${CONSENT_WEEKS} weeks.`,
          "neutral",
        );
        break;
      }

      case "valueEngineer": {
        const c = a.commissions.find((x) => x.id === arg && !x.done);
        if (!c || c.valueEngineered || c.stage < 2) return;
        c.valueEngineered = true;
        c.lastSeen = s.week;
        pushLog(
          s,
          `${c.client}'s cost plan is value-engineered: the tender will land, and the building is a little less than it was drawn to be.`,
          "neutral",
        );
        break;
      }

      case "declineCommission": {
        const idx = a.offers.findIndex((o) => o.id === arg);
        if (idx < 0) return;
        a.offers.splice(idx, 1);
        break;
      }

      /* Which job the board is pointed at this week. */
      case "focusCommission": {
        if (a.commissions.some((c) => c.id === arg && !c.done)) a.focus = arg;
        break;
      }

      /*
       * Resign a commission.
       *
       * The fees already banked stay banked — that is the point of staged
       * payment — but the standing hit is real, because the profession is
       * small and everybody hears.
       */
      case "resignCommission": {
        const c = a.commissions.find((x) => x.id === arg && !x.done);
        if (!c) return;
        c.done = true;
        s.r.reputation = Math.max(0, s.r.reputation - 6);
        pushLog(
          s,
          `You resigned from ${c.client}'s job. You keep ${money(c.paid)} and the profession keeps the memory.`,
          "bad",
        );
        break;
      }

      case "enterCompetition": {
        if (a.competition) return;
        const kind = KIND_BY_ID.get(arg);
        if (!kind) return;
        const cost = entryFee(a, kind);
        if (s.r.cash < cost) return;
        s.r.cash -= cost;
        const n = a.nextId++;
        a.competition = {
          id: `cp-${n}`,
          kind: kind.id,
          effort: 0,
          judgedWeek: s.week + 12,
          /* A famous practice draws a bigger field, not a smaller one. */
          entrants: 4 + Math.round(s.r.reputation / 18),
        };
        break;
      }

      case "withdrawCompetition": {
        a.competition = undefined;
        break;
      }

      case "hireStudio": {
        const role = STUDIO_ROLE_BY_ID.get(arg);
        if (!role) return;
        const { salary, hireCost } = rolePayStudio(a, role);
        if (s.r.cash < hireCost) return;
        s.r.cash -= hireCost;
        const n = a.nextId++;
        a.team.push({
          id: `sh-${n}`,
          name: clientName(n + 5),
          role: role.id,
          salary,
          since: s.week,
        });
        break;
      }

      case "letGoStudio": {
        const idx = a.team.findIndex((h) => h.id === arg);
        if (idx < 0) return;
        const [gone] = a.team.splice(idx, 1);
        s.r.cash -= Math.round(gone.salary * 2);
        break;
      }
    }
  },

  applyAction: (s, actionId, rng) => {
    const a = studio(s);
    switch (actionId) {
      case "draw": {
        const c = focused(a);
        if (!c) return;
        /*
         * A quarter of a drawing-week per block, not a whole one.
         *
         * `stage.weeks` means weeks of drawing at one board, and a week has
         * about four blocks of board time in it — so a block that yielded a
         * full week made every building four times faster than its own unit
         * said, and the balance bots banked a school's whole fee in seven
         * calendar weeks. With the unit honest, one focused week ≈ one
         * drawing-week, an assistant (output 0.55/wk) is genuinely half of
         * you, and buildings take the months the fiction says they do.
         */
        c.progress += 0.25 * (1 + s.r.skill * 0.008);
        s.r.skill = Math.min(100, s.r.skill + 0.3);
        s.r.burnout = Math.min(100, s.r.burnout + 3.5);
        break;
      }
      case "client": {
        const c = focused(a);
        if (!c) return;
        c.lastSeen = s.week;
        s.r.burnout = Math.min(100, s.r.burnout + 2);
        break;
      }
      case "court": {
        /*
         * Work arrives through people. The roll is here rather than in the
         * command because a command must never touch the RNG — see the note
         * in the engine.
         */
        const kinds = offerableKinds(a, s.r.reputation);
        if (kinds.length === 0) return;
        const chance = 0.3 + s.r.reputation / 260;
        if (rng.chance(chance) && a.offers.length < 4) {
          /* The best thing you are allowed to be asked for, most of the time. */
          const pick =
            kinds[
              rng.chance(0.6)
                ? kinds.length - 1
                : Math.floor(rng.next() * kinds.length)
            ];
          const n = a.nextId++;
          a.offers.push({
            id: `of-${n}`,
            kind: pick.id,
            client: clientName(n),
          });
        }
        s.r.reputation = Math.min(100, s.r.reputation + 0.3);
        s.r.burnout = Math.min(100, s.r.burnout + 2);
        break;
      }
      case "compete": {
        if (!a.competition) return;
        /* Same unit as the board: a block is a quarter-week of work. */
        a.competition.effort += 0.25 * (1 + s.r.skill * 0.006);
        s.r.skill = Math.min(100, s.r.skill + 0.25);
        s.r.burnout = Math.min(100, s.r.burnout + 4);
        break;
      }
      case "rest": {
        s.r.burnout = Math.max(0, s.r.burnout - 9);
        break;
      }
    }
  },

  resolveWeek: (s, rng) => {
    const a = studio(s);
    const out: LedgerLine[] = [];
    const city = studioCityOf(a);

    /* --------------------------------------------- what the studio drew */
    const helped = studioOutput(a);
    const target = focused(a);
    if (helped > 0 && target) target.progress += helped;

    /* ------------------------------------------------ stages completing */
    let banked = 0;
    for (const c of a.commissions) {
      if (c.done) continue;
      const kind = KIND_BY_ID.get(c.kind);
      if (!kind) continue;

      /* A stage can complete more than once in a week on a small job. */
      let guard = 0;
      while (
        !c.done &&
        c.progress >= stageWeeksOf(c, kind, stageOf(c)) &&
        guard++ < STAGE_COUNT
      ) {
        const stage = stageOf(c);
        /* The brief's fee, the consented uplift, and the value-engineering
           haircut — each exactly one on a commission that never chose. */
        const fee = Math.round(
          stageFee(a, kind, stage) *
            briefOf(c).fee *
            (c.consent === "granted" ? 1.06 : 1) *
            (c.valueEngineered ? 0.96 : 1),
        );
        c.progress -= stageWeeksOf(c, kind, stage);
        c.paid += fee;
        banked += fee;
        s.r.cash += fee;
        out.push({
          label: `${stage.label} — ${c.client}`,
          amount: fee,
          kind: "income",
          note: "Banked. Nothing that happens next takes it back.",
        });

        if (c.stage >= STAGE_COUNT - 1) {
          /* Finished. This is what standing is actually made of — and since
             Phase 5, what it was finished IN counts too: the brief's
             ambition, the palette, and whether this market prices carbon. */
          c.done = true;
          a.built.push(c.kind);
          /* The VE haircut reaches the reviews too — the building is a
             little less than it was drawn to be, and critics can tell. */
          let name = kind.prestige + briefOf(c).prestige - (c.valueEngineered ? 1 : 0);
          const mat = c.material ? MATERIAL_BY_ID.get(c.material) : undefined;
          if (mat) {
            name += mat.prestige;
            if (city.lowCarbon && mat.carbon <= 0.6) {
              name += 2;
              pushLog(
                s,
                `${city.name} noticed the carbon number: a ${mat.label.toLowerCase()} building here is its own advertisement.`,
                "good",
              );
            } else if (city.lowCarbon && mat.carbon >= 0.85) {
              name -= 1;
              pushLog(
                s,
                `${city.name} reads embodied carbon these days, and ${mat.label.toLowerCase()} reads badly. The reviews said so.`,
                "bad",
              );
            }
          }
          s.r.reputation = Math.max(0, Math.min(100, s.r.reputation + name));
          pushLog(
            s,
            `${kind.label} for ${c.client} is finished. ${money(c.paid)} over ${s.week - c.startedWeek} weeks, and it is standing there for everybody to see.`,
            "good",
          );
        } else {
          c.stage += 1;
        }
      }
    }
    s.r._lastRevenue = banked;

    /* --------------------------------------------------- the committee */
    /* Consent is the one de-risking a client cannot revoke: granted, it
       halves the revision maths for the rest of the job. The committee is
       slow, and roughly one scheme in four is asked to come back once. */
    for (const c of a.commissions) {
      if (c.done || c.consent !== "lodged") continue;
      if (s.week - (c.consentWeek ?? s.week) < CONSENT_WEEKS) continue;
      if (!c.consentDelayed && rng.chance(0.25)) {
        c.consentDelayed = true;
        c.consentWeek = s.week;
        out.push({
          label: `Objections heard — ${c.client}`,
          kind: "info",
          note: "The committee wants another look. A few more weeks.",
        });
        pushLog(
          s,
          `The committee heard objections to ${c.client}'s scheme and deferred it. It goes back in a few weeks.`,
          "neutral",
        );
      } else {
        c.consent = "granted";
        out.push({
          label: `Planning granted — ${c.client}`,
          kind: "info",
          note: "A consented scheme. The revision maths just halved.",
        });
        pushLog(
          s,
          `Planning consent for ${c.client}'s scheme is granted. A consented building is far harder to reinvent.`,
          "good",
        );
      }
    }

    /*
     * ------------------------------------------------------ THE REVISION
     *
     * The career's own sentence. A client who has not seen anybody reinvents
     * the brief, the commission drops back, and the drawings for those stages
     * are gone. The fees they already paid are not — which is why this is a
     * setback rather than a disaster, and why it can happen again.
     */
    for (const c of a.commissions) {
      if (c.done || c.stage === 0) continue;
      if (!rng.chance(revisionRisk(a, c, s.week))) continue;
      const kind = KIND_BY_ID.get(c.kind);
      const depth = revisionDepth(c);
      c.stage = Math.max(0, c.stage - depth);
      c.progress = 0;
      c.revisions += 1;
      /* They have just been in the room telling you, so the clock resets. */
      c.lastSeen = s.week;
      out.push({
        label: `${c.client} changed the brief`,
        kind: "info",
        note: `Back to ${stageOf(c).label.toLowerCase()}. The fees already paid stay paid.`,
      });
      pushLog(
        s,
        `${c.client} has reinvented the brief for the ${kind?.label.toLowerCase() ?? "job"}. You are back at ${stageOf(c).label.toLowerCase()}, and the drawings for the stages after it are waste paper.`,
        "bad",
      );
    }

    /* -------------------------------------------------- the competition */
    if (a.competition && s.week >= a.competition.judgedWeek) {
      const entry = a.competition;
      const odds = competitionOdds(entry, s.r.reputation);
      const kind = KIND_BY_ID.get(entry.kind);
      a.competition = undefined;
      if (kind && rng.chance(odds)) {
        const n = a.nextId++;
        a.commissions.push({
          id: `cm-${n}`,
          kind: kind.id,
          client: "the competition jury",
          stage: 0,
          progress: 0,
          paid: 0,
          revisions: 0,
          lastSeen: s.week,
          startedWeek: s.week,
        });
        a.wonCompetitions += 1;
        s.r.reputation = Math.min(100, s.r.reputation + 12);
        out.push({
          label: `Won the ${kind.label.toLowerCase()} competition`,
          kind: "info",
          note: `${money(feeFor(a, kind))} of work, and a name.`,
        });
        pushLog(
          s,
          `You won it. The ${kind.label.toLowerCase()} is yours to build, and every practice in ${city.name} now knows who you are.`,
          "good",
        );
      } else {
        out.push({
          label: "Lost the competition",
          kind: "info",
          note: `${entry.effort.toFixed(0)} weeks of work, for nothing. That is the trade.`,
        });
        pushLog(
          s,
          `The competition went to somebody else. ${entry.effort.toFixed(0)} weeks of drawing, and the only thing you keep is the drawing.`,
          "bad",
        );
      }
    }

    /* --------------------------------------------------------- the bills */
    const wages = studioWages(a);
    if (wages > 0) {
      out.push({
        label: `Studio — ${a.team.length} on the payroll`,
        amount: -wages,
        kind: "expense",
      });
      s.r.cash -= wages;
    }
    out.push({
      label: `Studio rent in ${city.name}`,
      amount: -city.rent,
      kind: "expense",
    });
    s.r.cash -= city.rent;

    /* Offers do not sit on the table forever. */
    if (a.offers.length > 0 && rng.chance(0.18)) {
      const [gone] = a.offers.splice(0, 1);
      out.push({
        label: `${gone.client} went elsewhere`,
        kind: "info",
        note: "An offer left on the table is an offer somebody else took.",
      });
    }

    s.r.burnout = Math.max(0, s.r.burnout - 1);
    /* What the world says about the week that just happened. Its own
       stream, so the phone can never disturb the simulation's dice. */
    generateWeekFrom(
      ARCHITECT_PACK,
      ensurePhone(s),
      s,
      makeRng((s.seed ^ (s.week * 0x7b1f6a29)) >>> 0),
    );

    s.r._burnoutPeak = Math.max(s.r._burnoutPeak ?? 0, s.r.burnout);
    return out;
  },

  checkSetbacks: (s) => {
    const out: SetbackKind[] = [];
    if (Math.max(s.r.burnout, s.r._burnoutPeak ?? 0) >= 100) out.push("collapse");
    if (s.r.cash < -35_000) out.push("insolvency");
    if (s.r.reputation <= 2 && s.week > 24) out.push("disgrace");
    if (out.includes("collapse")) s.r._burnoutPeak = 0;
    return out;
  },

  validateData: (data) => {
    const d = data as { studio?: unknown };
    if (typeof d !== "object" || d === null) return false;
    const a = d.studio as StudioState | undefined;
    if (typeof a !== "object" || a === null) return false;
    /* The phone is optional — a save from before this career had one
       still loads — but a present one must be the real shape. This
       career previously did not look at it at all. */
    if (a.phone !== undefined && !validatePhone(a.phone)) {
      return false;
    }
    if (!STUDIO_CITY_BY_ID.has(a.city)) return false;
    if (!Array.isArray(a.commissions) || !Array.isArray(a.offers)) return false;
    if (!Array.isArray(a.team) || !Array.isArray(a.built)) return false;
    for (const c of a.commissions) {
      if (!KIND_BY_ID.has(c.kind)) return false;
      if (
        typeof c.stage !== "number" ||
        c.stage < 0 ||
        c.stage >= STAGE_COUNT ||
        typeof c.paid !== "number" ||
        !Number.isFinite(c.paid)
      ) {
        return false;
      }
      /* Phase 5 fields, optional to the last. Present ones must be real. */
      if (c.brief !== undefined && !BRIEFS[c.brief]) return false;
      if (c.material !== undefined && !MATERIAL_BY_ID.has(c.material)) {
        return false;
      }
      if (
        c.consent !== undefined &&
        c.consent !== "lodged" &&
        c.consent !== "granted"
      ) {
        return false;
      }
      if (
        c.consentWeek !== undefined &&
        (!Number.isInteger(c.consentWeek) || c.consentWeek < 0)
      ) {
        return false;
      }
    }
    if (a.offers.some((o) => !KIND_BY_ID.has(o.kind))) return false;
    if (a.team.some((h) => !STUDIO_ROLE_BY_ID.has(h.role))) return false;
    if (a.competition && !KIND_BY_ID.has(a.competition.kind)) return false;
    return true;
  },

  scoreboard: (s) => {
    const a = studio(s);
    const live = a.commissions.filter((c) => !c.done).length;
    return {
      label: "The practice",
      value: money(practiceWorth(s)),
      sub: `${live} on the boards · ${money(workOnTheBoards(a))} still to earn · ${a.built.length} built`,
    };
  },

  briefing: (s, alloc) => {
    const a = studio(s);
    const c = focused(a);
    if (!c) {
      return [
        {
          label: "Nothing on the boards",
          value: "—",
          tone: "bad" as const,
          note: "Court work until somebody offers you something.",
        },
      ];
    }
    const kind = KIND_BY_ID.get(c.kind);
    const stage = stageOf(c);
    const need = kind ? stageWeeks(kind, stage) : 0;
    const drawn =
      (alloc.draw ?? 0) * 0.25 * (1 + s.r.skill * 0.008) + studioOutput(a);
    const after = c.progress + drawn;
    /* Seeing them this week is the whole point of the risk line. */
    const seen = (alloc.client ?? 0) > 0;
    const risk = revisionRisk(a, seen ? { ...c, lastSeen: s.week } : c, s.week);

    return [
      {
        label: stage.label,
        value: `${Math.min(need, after).toFixed(1)} of ${need} weeks`,
        tone: after >= need ? ("good" as const) : ("neutral" as const),
        note:
          after >= need && kind
            ? `Completes this week and banks ${money(stageFee(a, kind, stage))}.`
            : `${Math.max(0, need - after).toFixed(1)} weeks left on this stage.`,
      },
      {
        label: "Brief change risk",
        value: `${(risk * 100).toFixed(0)}%`,
        tone:
          risk < 0.08
            ? ("good" as const)
            : risk > 0.2
              ? ("bad" as const)
              : ("neutral" as const),
        note: seen
          ? `${c.client} will have seen you this week.`
          : `${c.client} last saw somebody ${Math.max(0, s.week - c.lastSeen)} weeks ago. A revision sends you back a stage.`,
      },
    ];
  },

  objective: (s) => {
    const goal = goalFor(s);
    return {
      text: `Build a practice worth ${money(goal)} in ${studioCityOf(studio(s)).name}. You are paid in stages and every one you finish is yours for good — but a client who has not seen you can send the whole building back to the drawing it started as.`,
      progress: Math.max(0, Math.min(1, practiceWorth(s) / goal)),
    };
  },
};

export { practiceWorth };
