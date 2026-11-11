import type { CareerDef, LedgerLine, RunState } from "../types";
import type { SetbackKind } from "../setbacks";
import { pushLog } from "../engine";
import { money } from "../format";
import { validatePhone } from "../phone/validate";
import { makeRng } from "../rng";
import { SEAT_EVENTS } from "./newEvents";
import {
  generateWeekFrom,
  initialPhoneFrom,
  publishFrom,
} from "../phone/voicePack";
import { POLITICIAN_PACK } from "../phone/packs";
import {
  BLOCS,
  BLOC_BY_ID,
  ISSUE_BY_ID,
  OFFICE_BY_ID,
  SEATS,
  SEAT_BY_ID,
  allowanceOf,
  inOffice,
  initialCampaign,
  leanOf,
  nextOffice,
  officeOf,
  projectedShare,
  seatOf,
  selectionBlocker,
  stanceOf,
  survivesToPoll,
  thresholdFor,
  weeksToPoll,
  type CampaignState,
  campaign,
  CASE_DESK,
  FOCUS_GROUP_COST,
  constituentsOf,
  drawCase,
  gotvBonus,
  pollBandOf,
  recordOf,
  volunteerLift,
  volunteersOf,
  warchestOf,
} from "./constituency";

/**
 * THE POLITICIAN
 *
 * See `constituency.ts` for the model. This file is the engine contract, and
 * the two places the career's whole idea actually lives are here:
 *
 *   `resolveWeek`  — support drifts toward your positions, every week, always
 *   the polling-day block inside it — the one moment any of it is banked
 *
 * Everything else is a way of pushing support up before that afternoon.
 */

const START_CASH = 9_000;
const START_DEBT = 14_000;

/* Defined with the model; re-exported so every existing import of it
   from this module keeps working. */
export { campaign };

/** A run's goal: climb the ladder and hold what you climbed to. */
const goalFor = (): number => 3;

/**
 * The phone, created on first touch.
 *
 * Optional on the state so an older save loads; created here so that
 * save gains a handset rather than being rejected for not having one.
 */
function ensurePhone(s: RunState) {
  const st = campaign(s);
  if (!st.phone) st.phone = initialPhoneFrom(POLITICIAN_PACK);
  return st.phone;
}

export const politician: CareerDef = {
  id: "politician",
  label: "Politician",
  tagline:
    "A ward nobody wants, a party that has not decided about you, and an electorate that has.",
  distinctRule:
    "Your constraint is the electoral cycle. Support decays continuously and is only banked on polling day, so the whole run is spent spending capital you cannot keep.",
  icon: "podium",
  available: true,
  weekLimit: 156,

  timeBudget: (s) => (s.r.burnout > 80 ? 5 : 6),

  resources: [
    {
      id: "cash",
      label: "Cash",
      hint: "The allowance, minus a campaign that never stops needing money.",
      format: "money",
      polarity: "higher-better",
      display: "stat",
    },
    {
      id: "debt",
      label: "Campaign debt",
      hint: "What the first campaign cost, and what every one since has added.",
      format: "money",
      polarity: "lower-better",
      display: "stat",
    },
    {
      id: "reputation",
      label: "Profile",
      hint: "How widely you are known. It moves support faster; it does not vote.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "higher-better",
      display: "meter",
    },
    {
      id: "skill",
      label: "Political skill",
      hint: "Reading a room, working a chamber, knowing when to say nothing.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "higher-better",
      display: "meter",
    },
    {
      id: "burnout",
      label: "Burnout",
      hint: "Surgeries, doorsteps and late votes. It is a job that eats people.",
      format: "int",
      min: 0,
      max: 100,
      polarity: "lower-better",
      display: "meter",
    },
  ],

  actions: [
    {
      id: "canvass",
      label: "Canvass",
      blurb:
        "Doorsteps and street stalls. It works, and it starts leaking the moment you stop.",
      timeCost: 1,
      cashCost: 120,
      preview: (s) => {
        const c = campaign(s);
        const lift = (3.2 + s.r.skill * 0.03) * volunteerLift(c);
        return [
          `Support +${lift.toFixed(1)} across every bloc${volunteersOf(c) > 0 ? " — the volunteers carry boards too" : ""}`,
          `About +${survivesToPoll(c, s.week, lift).toFixed(1)} of that survives to polling day`,
        ];
      },
    },
    {
      id: "target",
      label: "Target a bloc",
      blurb:
        "Pick one group and go at them properly. Nobody else notices you were there.",
      timeCost: 1,
      cashCost: 260,
      preview: (s) => {
        const lift = (7.5 + s.r.skill * 0.05) * volunteerLift(campaign(s));
        return [
          `+${lift.toFixed(1)} with whichever bloc you have chosen`,
          "Chosen on the Seat screen. Everyone else is unmoved.",
        ];
      },
    },
    {
      id: "casework",
      label: "Surgery",
      blurb:
        "Housing letters and immigration cases. Slow, unglamorous, and it sticks.",
      timeCost: 1,
      cashCost: 0,
      preview: (s) => {
        const open = constituentsOf(campaign(s));
        return [
          "Support +1.8, and it decays at half the usual rate this week",
          open.length > 0
            ? `And ${open[0].name}'s case gets worked — delivered cases move the lean itself, for good`
            : "Party standing +0.8 — the machine notices who does the work",
        ];
      },
    },
    {
      id: "party",
      label: "Party work",
      blurb:
        "Committees, fundraisers, and being seen to be sound. This is how selection happens.",
      timeCost: 1,
      cashCost: 0,
      preview: (s) => [
        `Party standing +${(2.6 + s.r.skill * 0.02).toFixed(1)}`,
        "Does nothing for the voters at all",
      ],
    },
    {
      id: "organise",
      label: "Organise",
      blurb:
        "Phone trees, rotas, and somebody to run them. Volunteers knock doors you cannot reach.",
      timeCost: 1,
      cashCost: 0,
      preview: (s) => {
        const c = campaign(s);
        return [
          `Volunteers +${(4 + s.r.skill * 0.05).toFixed(1)} — currently ${Math.round(volunteersOf(c))}, and they drift away untended`,
          `They add ${Math.round((volunteerLift(c) - 1) * 100)}% to canvassing and knock doors on polling day itself`,
        ];
      },
    },
    {
      id: "fundraise",
      label: "Fundraise",
      blurb:
        "Dinners, raffles and asks. The fund pays for campaigning — never the rent, which is the law.",
      timeCost: 1,
      cashCost: 0,
      preview: (s) => {
        const c = campaign(s);
        const take =
          350 +
          c.party * 11 +
          ((c.support.business ?? 0) + (c.support.professional ?? 0)) * 4;
        return [
          `About ${money(Math.round(take))} into the campaign fund (now ${money(warchestOf(c))})`,
          "The fund reimburses canvassing, targeting and media, and buys focus groups",
        ];
      },
    },
    {
      id: "media",
      label: "Media",
      blurb:
        "Studios, columns and rows. It raises your profile, which is not the same as being liked.",
      timeCost: 1,
      cashCost: 340,
      preview: (s) => [
        "Profile +3.5",
        `Support +${(1.4 + s.r.reputation * 0.05).toFixed(1)}, scaled by how known you already are`,
      ],
    },
    {
      id: "rest",
      label: "Step back",
      blurb: "A week nobody sees you. The support drifts without you.",
      timeCost: 1,
      cashCost: 0,
      preview: () => ["Burnout −9", "Support drifts as usual"],
    },
  ],

  events: SEAT_EVENTS,

  initialResources: () => ({
    cash: START_CASH,
    debt: START_DEBT,
    reputation: 6,
    skill: 30,
    burnout: 10,
    _lastRevenue: 0,
    _burnoutPeak: 0,
  }),

  initialData: () => {
    /* The handset exists from week one, so the button is there the
       first time anybody looks for it. */
    const st = initialCampaign();
    st.phone = initialPhoneFrom(POLITICIAN_PACK);
    return { campaign: st };
  },

  startCities: SEATS,

  applyStartCity: (s, cityId) => {
    const seat = SEAT_BY_ID.get(cityId);
    if (!seat) return;
    const c = campaign(s);
    c.seat = cityId;
    c.support = { ...seat.opening };
    /* A first campaign costs what it costs here, and you borrowed it. */
    s.r.debt = Math.round(START_DEBT * (seat.allowance / SEATS[0].allowance));
  },

  command: (s, cmd, arg) => {
    const c = campaign(s);
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
          POLITICIAN_PACK,
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

      /*
       * TAKE A POSITION.
       *
       * The permanent half of the career. This does not move support today —
       * it moves where support *settles*, which is why the effect shows up
       * over the following weeks rather than immediately, and why it cannot
       * be undone for free.
       */
      case "takePosition": {
        const [issueId, stanceId] = arg.split(":");
        const issue = ISSUE_BY_ID.get(issueId);
        if (!issue) return;
        const stance = stanceOf(issue, stanceId);
        if (!stance) return;
        const already = c.positions[issueId];
        if (already === stanceId) return;
        /* Changing a stated position is a reversal, and it is remembered. */
        if (already && !c.reversals.includes(issueId)) {
          c.reversals.push(issueId);
          pushLog(
            s,
            `You changed your position on ${issue.label.toLowerCase()}. It will be quoted back at you for the rest of the run.`,
            "bad",
          );
        }
        c.positions[issueId] = stanceId;
        break;
      }

      /* Which bloc the "target" action goes after. */
      case "targetBloc": {
        if (!BLOCS.some((b) => b.id === arg)) return;
        s.r._target = BLOCS.findIndex((b) => b.id === arg);
        break;
      }

      /* Ask the party to select you for the rung above. */
      case "seekSelection": {
        const next = nextOffice(c);
        if (!next || selectionBlocker(c)) return;
        /*
         * Selection does not make you a member of anything — it makes you the
         * candidate, and the voters still decide. The clock restarts at the
         * new office's term.
         */
        c.office = next.id;
        c.outOfOffice = false;
        c.electionWeek = s.week + Math.min(52, next.term / 2);
        s.r.debt += 9_000;
        pushLog(
          s,
          `The party selected you as their ${next.label.toLowerCase()}. Polling day is week ${c.electionWeek}, and the campaign is on the account.`,
          "good",
        );
        break;
      }

      /* Stand again after losing. The only route back. */
      case "focusGroup": {
        /* Paid from the fund and nowhere else — a personal cheque for
           polling is exactly the compliance story this career avoids. */
        if (warchestOf(c) < FOCUS_GROUP_COST) return;
        c.warchest = warchestOf(c) - FOCUS_GROUP_COST;
        c.focusUntil = s.week + 6;
        pushLog(
          s,
          `A focus group read the seat: for the next six weeks the count is a tighter band.`,
          "neutral",
        );
        break;
      }

      case "standAgain": {
        if (!c.outOfOffice) return;
        c.outOfOffice = false;
        c.electionWeek = s.week + 40;
        s.r.debt += 6_000;
        pushLog(
          s,
          `You put your name forward again. Polling day is week ${c.electionWeek}.`,
          "neutral",
        );
        break;
      }
    }
  },

  applyAction: (s, actionId, rng) => {
    const c = campaign(s);
    const bump = (blocId: string, n: number) => {
      c.support[blocId] = Math.max(0, Math.min(100, (c.support[blocId] ?? 0) + n));
    };
    switch (actionId) {
      case "canvass": {
        const lift = (3.2 + s.r.skill * 0.03) * volunteerLift(c);
        for (const b of BLOCS) bump(b.id, lift * (0.85 + rng.next() * 0.3));
        s.r.skill = Math.min(100, s.r.skill + 0.25);
        s.r.burnout = Math.min(100, s.r.burnout + 3.5);
        s.r._campaignSpend = (s.r._campaignSpend ?? 0) + 120;
        break;
      }
      case "target": {
        const idx = Math.max(
          0,
          Math.min(BLOCS.length - 1, Math.round(s.r._target ?? 0)),
        );
        bump(BLOCS[idx].id, (7.5 + s.r.skill * 0.05) * volunteerLift(c));
        s.r.burnout = Math.min(100, s.r.burnout + 3);
        s.r._campaignSpend = (s.r._campaignSpend ?? 0) + 260;
        break;
      }
      case "casework": {
        for (const b of BLOCS) bump(b.id, 1.8);
        c.party = Math.min(100, c.party + 0.8);
        /* Work done for people decays more slowly — see `resolveWeek`. */
        s.r._sticky = (s.r._sticky ?? 0) + 1;
        /* And the oldest name on the desk gets their answer: a delivered
           case moves this bloc's lean itself, capped in `leanOf`. A desk
           that was always empty behaves exactly as it always did. */
        const open = constituentsOf(c);
        if (open.length > 0) {
          const [done] = open.splice(0, 1);
          c.constituents = open;
          c.record = {
            ...recordOf(c),
            [done.bloc]: (recordOf(c)[done.bloc] ?? 0) + 2.5,
          };
          bump(done.bloc, 1.5);
          pushLog(
            s,
            `${done.name}'s case — ${done.matter} — is settled. ${BLOC_BY_ID.get(done.bloc)?.label ?? done.bloc} remember.`,
            "good",
          );
        }
        s.r.burnout = Math.min(100, s.r.burnout + 2.5);
        break;
      }
      case "party": {
        c.party = Math.min(100, c.party + 2.6 + s.r.skill * 0.02);
        s.r.skill = Math.min(100, s.r.skill + 0.2);
        s.r.burnout = Math.min(100, s.r.burnout + 2.5);
        break;
      }
      case "organise": {
        c.volunteers = Math.min(120, volunteersOf(c) + 4 + s.r.skill * 0.05);
        c.party = Math.min(100, c.party + 0.4);
        s.r.burnout = Math.min(100, s.r.burnout + 2);
        break;
      }
      case "fundraise": {
        const take =
          350 +
          c.party * 11 +
          ((c.support.business ?? 0) + (c.support.professional ?? 0)) * 4;
        c.warchest = warchestOf(c) + Math.round(take * (0.85 + rng.next() * 0.3));
        s.r.burnout = Math.min(100, s.r.burnout + 2.5);
        break;
      }
      case "media": {
        s.r.reputation = Math.min(100, s.r.reputation + 3.5);
        for (const b of BLOCS) bump(b.id, 1.4 + s.r.reputation * 0.05);
        s.r.burnout = Math.min(100, s.r.burnout + 3);
        s.r._campaignSpend = (s.r._campaignSpend ?? 0) + 340;
        break;
      }
      case "rest": {
        s.r.burnout = Math.max(0, s.r.burnout - 9);
        break;
      }
    }
  },

  resolveWeek: (s) => {
    const c = campaign(s);
    const out: LedgerLine[] = [];
    const seat = seatOf(c);
    const office = officeOf(c);

    /* ------------------------------------------------------------ the money */
    const pay = allowanceOf(c);
    if (pay > 0) {
      out.push({
        label: `${office.label} allowance`,
        amount: pay,
        kind: "income",
      });
      s.r.cash += pay;
    } else {
      out.push({
        label: "No allowance",
        kind: "info",
        note: "A candidate is not paid. The campaign is funded out of your own pocket.",
      });
    }
    const office_costs = Math.round(180 + seat.allowance * 0.12);
    out.push({
      label: "Office and staff",
      amount: -office_costs,
      kind: "expense",
    });
    s.r.cash -= office_costs;
    s.r._lastRevenue = pay;

    /* -------------------------------------------------- the campaign fund */
    /* Donations pay for campaigning: what the week spent on canvassing,
       targeting and media comes back out of the fund while it lasts. A
       campaign with no fund pays out of pocket, exactly as it always did. */
    {
      const spend = s.r._campaignSpend ?? 0;
      const refund = Math.min(spend, warchestOf(c));
      if (refund > 0) {
        c.warchest = warchestOf(c) - refund;
        s.r.cash += refund;
        out.push({
          label: "Campaign costs met by the fund",
          amount: refund,
          kind: "income",
          note: `${money(warchestOf(c))} left in it. The fund never pays the rent — that is the law.`,
        });
      }
      s.r._campaignSpend = 0;
    }

    /* Volunteers drift away untended, like everything else here. */
    if (volunteersOf(c) > 0) {
      c.volunteers = volunteersOf(c) * 0.96;
    }

    /* ------------------------------------------------------- the postbag */
    /* Names arrive on their own schedule — a derived stream, so the phone
       and the dice cannot disturb each other. Cases past their deadline
       are referred on silently: nobody punishes an office for a letter it
       never took up, they simply stop being moved by it. */
    {
      const desk = constituentsOf(c).filter((k) => k.deadline >= s.week);
      const post = makeRng((s.seed ^ (s.week * 0x3d8c74f1)) >>> 0);
      let n = 0;
      if (post.next() < 0.75 && desk.length < CASE_DESK) {
        desk.push(drawCase(c, s.week, n++, post));
      }
      if (post.next() < 0.3 && desk.length < CASE_DESK) {
        desk.push(drawCase(c, s.week, n++, post));
      }
      if (desk.length > 0 || c.constituents !== undefined) {
        c.constituents = desk;
      }
    }

    /*
     * ------------------------------------------------------------- THE DRIFT
     *
     * The mechanism the whole career is built on. Support moves toward where
     * your positions have left you, every single week, whatever you did. A
     * week of canvassing is a loan against this, not a deposit.
     *
     * Surgery work is the one thing that slows it, and only for the week it
     * was done — casework buys loyalty, not immunity.
     */
    const sticky = Math.min(0.5, (s.r._sticky ?? 0) * 0.25);
    const rate = seat.drift * (1 - sticky);
    const lean = leanOf(c);
    for (const b of BLOCS) {
      const now = c.support[b.id] ?? 0;
      const to = lean[b.id] ?? 0;
      c.support[b.id] = now + (to - now) * rate;
    }
    s.r._sticky = 0;

    const share = projectedShare(c);
    const need = thresholdFor(c);

    /* ------------------------------------------------------- POLLING DAY */
    if (s.week >= c.electionWeek && !c.outOfOffice) {
      /* The turnout operation: every volunteer knocks doors on the day,
         and knocked doors become cast votes. Worth up to two points, and
         exactly nothing to a campaign that never organised. */
      const gotv = gotvBonus(c);
      const dayShare = share + gotv;
      if (gotv > 0) {
        out.push({
          label: `Get-out-the-vote — ${Math.round(volunteersOf(c))} volunteers`,
          kind: "info",
          note: `Worth about ${(gotv * 100).toFixed(1)} points of turnout on the day.`,
        });
      }
      const won = dayShare >= need;
      c.results.push({
        week: s.week,
        office: c.office,
        share: dayShare,
        threshold: need,
        won,
      });

      if (won) {
        /* Banked. The only moment in the run that anything is. */
        c.electionWeek = s.week + office.term;
        s.r.reputation = Math.min(100, s.r.reputation + 6);
        c.party = Math.min(100, c.party + 8);
        out.push({
          label: `Held the seat with ${(dayShare * 100).toFixed(1)}%`,
          kind: "info",
          note: `Next polling day is week ${c.electionWeek}.`,
        });
        pushLog(
          s,
          `You held ${seat.name} with ${(dayShare * 100).toFixed(1)}% against a bar of ${(need * 100).toFixed(1)}%. The next election is week ${c.electionWeek}.`,
          "good",
        );
      } else {
        /*
         * Lost. Not the end of anything — you are out of office, the
         * allowance stops, and standing again is a command away. That is the
         * recovery route, and it costs a campaign to walk it.
         */
        c.outOfOffice = true;
        c.office = "candidate";
        s.r.reputation = Math.max(0, s.r.reputation - 8);
        out.push({
          label: `Lost the seat on ${(dayShare * 100).toFixed(1)}%`,
          kind: "info",
          note: `The bar was ${(need * 100).toFixed(1)}%.`,
        });
        pushLog(
          s,
          `You lost ${seat.name} on ${(dayShare * 100).toFixed(1)}%, against a bar of ${(need * 100).toFixed(1)}%. You are out of office — and you can stand again.`,
          "bad",
        );
      }
    } else if (!c.outOfOffice) {
      out.push({
        label: `Polling day in ${weeksToPoll(c, s.week)} weeks`,
        kind: "info",
        note: `${(share * 100).toFixed(1)}% today against a bar of ${(need * 100).toFixed(1)}%.`,
      });
    }

    s.r.burnout = Math.max(0, s.r.burnout - 1);
    /* What the world says about the week that just happened. Its own
       stream, so the phone can never disturb the simulation's dice. */
    generateWeekFrom(
      POLITICIAN_PACK,
      ensurePhone(s),
      s,
      makeRng((s.seed ^ (s.week * 0x2c9e4d13)) >>> 0),
    );

    s.r._burnoutPeak = Math.max(s.r._burnoutPeak ?? 0, s.r.burnout);
    return out;
  },

  checkSetbacks: (s) => {
    const out: SetbackKind[] = [];
    const c = campaign(s);
    if (Math.max(s.r.burnout, s.r._burnoutPeak ?? 0) >= 100) out.push("collapse");
    if (s.r.cash < -30_000) out.push("insolvency");
    /* Reversing three positions is not a bad week, it is a reputation. */
    if (c.reversals.length >= 3 && s.r.reputation <= 20) out.push("disgrace");
    if (out.includes("collapse")) s.r._burnoutPeak = 0;
    return out;
  },

  validateData: (data) => {
    const d = data as { campaign?: unknown };
    if (typeof d !== "object" || d === null) return false;
    const c = d.campaign as CampaignState | undefined;
    if (typeof c !== "object" || c === null) return false;
    /* The phone is optional — a save from before this career had one
       still loads — but a present one must be the real shape. This
       career previously did not look at it at all. */
    if (c.phone !== undefined && !validatePhone(c.phone)) {
      return false;
    }
    if (!SEAT_BY_ID.has(c.seat)) return false;
    if (!OFFICE_BY_ID.has(c.office)) return false;
    if (typeof c.support !== "object" || c.support === null) return false;
    if (
      BLOCS.some(
        (b) =>
          typeof c.support[b.id] !== "number" ||
          !Number.isFinite(c.support[b.id]),
      )
    ) {
      return false;
    }
    if (typeof c.positions !== "object" || c.positions === null) return false;
    for (const [issueId, stanceId] of Object.entries(c.positions)) {
      const issue = ISSUE_BY_ID.get(issueId);
      if (!issue || !stanceOf(issue, stanceId)) return false;
    }
    if (!Array.isArray(c.reversals) || !Array.isArray(c.results)) return false;
    if (typeof c.electionWeek !== "number" || !Number.isFinite(c.electionWeek)) {
      return false;
    }
    /* Phase 5 fields, optional to the last: a save from before the ground
       game carries none of them and still loads. */
    for (const n of [c.volunteers, c.warchest]) {
      if (
        n !== undefined &&
        (typeof n !== "number" || !Number.isFinite(n) || n < 0)
      ) {
        return false;
      }
    }
    if (
      c.focusUntil !== undefined &&
      (!Number.isInteger(c.focusUntil) || c.focusUntil < 0)
    ) {
      return false;
    }
    if (c.record !== undefined) {
      if (typeof c.record !== "object" || c.record === null) return false;
      for (const [bloc, n] of Object.entries(c.record)) {
        if (!BLOC_BY_ID.has(bloc)) return false;
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return false;
      }
    }
    if (c.constituents !== undefined) {
      if (!Array.isArray(c.constituents)) return false;
      for (const k of c.constituents) {
        if (
          typeof k !== "object" ||
          k === null ||
          typeof k.id !== "string" ||
          typeof k.name !== "string" ||
          k.name.length === 0 ||
          !BLOC_BY_ID.has(k.bloc) ||
          typeof k.matter !== "string" ||
          !Number.isInteger(k.arrived) ||
          !Number.isInteger(k.deadline)
        ) {
          return false;
        }
      }
    }
    return true;
  },

  scoreboard: (s) => {
    const c = campaign(s);
    const share = projectedShare(c);
    return {
      label: officeOf(c).label,
      value: `${(share * 100).toFixed(1)}%`,
      sub: c.outOfOffice
        ? `Out of office · ${c.results.filter((r) => r.won).length} won, ${c.results.filter((r) => !r.won).length} lost`
        : `Polling day week ${c.electionWeek} · bar is ${(thresholdFor(c) * 100).toFixed(1)}% · party standing ${Math.round(c.party)}`,
    };
  },

  briefing: (s, alloc) => {
    const c = campaign(s);
    /*
     * The forecast has to answer the question the career is about, which is
     * not "what is my support" but "what will it be when it is counted". So
     * it projects the drift forward to polling day rather than showing today.
     */
    const lift =
      (alloc.canvass ?? 0) * (3.2 + s.r.skill * 0.03) +
      (alloc.casework ?? 0) * 1.8 +
      (alloc.media ?? 0) * (1.4 + s.r.reputation * 0.05);
    const today = projectedShare(c) * 100;
    const survives = survivesToPoll(c, s.week, lift);
    const need = thresholdFor(c) * 100;

    /* Nobody knows the share to a decimal. The band is what a campaign
       would actually know, and a recent focus group tightens it. */
    const band = pollBandOf(c, s.week);
    const out = [
      {
        label: "Share today",
        value: `${today.toFixed(1)}% ± ${band.toFixed(0)}`,
        tone:
          today - band >= need
            ? ("good" as const)
            : today + band < need
              ? ("bad" as const)
              : ("neutral" as const),
        note:
          today - band >= need
            ? `The bar is ${need.toFixed(1)}% — clear of it even at the bottom of the band.`
            : today + band < need
              ? `The bar is ${need.toFixed(1)}% — short of it even at the top of the band.`
              : `The bar is ${need.toFixed(1)}% — inside the margin. A focus group narrows it.`,
      },
      {
        label: "Of this week's push",
        value: `+${survives.toFixed(1)} at the poll`,
        tone: survives > lift * 0.5 ? ("good" as const) : ("neutral" as const),
        note:
          weeksToPoll(c, s.week) > 0
            ? `You lifted ${lift.toFixed(1)} points, ${weeksToPoll(c, s.week)} weeks out. The rest leaks away before anybody votes.`
            : "Polling day is this week — all of it counts.",
      },
    ];

    if (c.outOfOffice) {
      out.push({
        label: "Out of office",
        value: "No allowance",
        tone: "bad" as const,
        note: "Stand again from the Seat screen. It costs a campaign.",
      });
    }
    return out;
  },

  objective: (s) => {
    const c = campaign(s);
    const won = c.results.filter((r) => r.won).length;
    const goal = goalFor();
    return {
      text: `Win ${goal} elections in ${seatOf(c).name} and climb as far up the ladder as the party will carry you. Support drains toward your positions every week, and only the afternoon of the count converts any of it into anything.`,
      progress: Math.max(0, Math.min(1, won / goal)),
    };
  },
};

export { inOffice };
