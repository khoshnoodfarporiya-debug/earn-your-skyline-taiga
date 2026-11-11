import type { LedgerLine, Rng, RunState } from "../types";
import { makeRng } from "../rng";
import { pushLog } from "../engine";
import { applyRep } from "../reputation";
import { personIn, touchPerson } from "../people";
import { mark } from "../timeline";
import { RECOVERY } from "../setbacks";
import { setAmbition } from "../ambitions";
import {
  MAX_ACTIVE,
  MAX_CONTRACT_HISTORY,
  MAX_OFFERS,
  contractFee,
  readinessFor,
  resolveContract,
  rollComplication,
  startContract,
  type ContractOffer,
  type ContractRecord,
} from "../contracts";
import {
  initialRival,
  recordContest,
  refreshStance,
  rivalBid,
  tickRivals,
} from "../rivals";
import {
  acquitGrant,
  dividendOn,
  fundingOffers,
  repay,
  takeFunding,
  tickFinance,
} from "../finance";
import { MAX_WORLD_NEWS, rivalNews, worldNews, type NewsItem } from "../news";
import {
  CRISIS_LABEL,
  MAX_CRISES,
  stageOf,
  crisisRisk,
  isResolved,
  startCrisis,
  tickCrisis,
} from "../crisis";
import { CONTRACT_BY_ID, MEDICAL_CONTRACTS } from "./contractList";
import { PHYSICIAN_RIVALS } from "./rivalCast";
import { CAST_BY_ID } from "./cast";
import { cityOf } from "./cities";
import {
  averageLoad,
  cultureScore,
  hydrateStaff,
  tickStaff,
} from "./culture";
import { driftMarket, effectiveFee, marketOf } from "./economy";
import type { MedicalState } from "./types";
import { MAX_MESSAGES } from "./phone";

/**
 * PHASE 2, ASSEMBLED
 *
 * Six systems that only work because they read each other, wired in one place
 * so the couplings are inspectable rather than scattered through a
 * fifteen-hundred-line career file.
 *
 * `resolveWeek` in doctor.ts calls `runPhase2` once, after its own caseload
 * maths and before the phone. That ordering matters:
 *
 *   - the economy drifts FIRST, so contracts and payroll price at this
 *     week's market rather than last week's
 *   - rivals move before contracts, so a contest is against their current
 *     standing
 *   - crises tick last, because everything above can feed one
 *
 * Every subsystem here draws from `phase2Rng`, a stream derived from the seed
 * and the week and used by nothing else. That is the same discipline the phone
 * follows: adding a rival must not be able to shift the player's event roll,
 * or the balance harness stops measuring what it thinks it measures.
 */

export interface Phase2Context {
  m: MedicalState;
  ledger: LedgerLine[];
  /** Net worth, for borrowing capacity and the investor's interest. */
  netWorth: number;
  /** This week's operating profit before financing. */
  profit: number;
  /** Weeks of cash cover, for crisis risk. */
  cashWeeks: number;
  /** Weeks of supply cover, likewise. */
  supplyWeeks: number;
}

/** The stream nothing else touches. */
export const phase2Rng = (s: RunState): Rng =>
  makeRng((s.seed ^ (s.week * 0x27d4eb2f)) >>> 0);

export function runPhase2(s: RunState, ctx: Phase2Context): void {
  const rng = phase2Rng(s);
  const { m, ledger } = ctx;

  /* The crisis-time debt is collected by `timeBudget` and cleared here, so
     it costs exactly one week rather than compounding forever. */
  s.r._crisisBlocks = 0;
  /* What a lender would lend against, remembered for the funding panel. */
  s.r._lastRevenue = ctx.profit + (s.r._lastRevenue ?? 0) * 0;


  ensureSeeded(s, m);

  // 1. The world's prices move.
  const cityIds = m.cities.length ? m.cities : [m.homeCity];
  for (const city of Object.keys(m.markets ?? {})) {
    driftMarket(m.markets![city], rng, s.week);
  }

  // 2. Your team.
  const culture = cultureScore(m, s.week);
  const staffResult = tickStaff(
    m,
    {
      week: s.week,
      load: Math.min(100, averageLoad(m) * 0.5 + (s.r.burnout ?? 0) * 0.5),
      culture: culture.score,
      cashShort: s.r.cash < 0,
    },
    rng,
  );
  for (const note of staffResult.notes) pushLog(s, note, "neutral");
  if (staffResult.left.length > 0) {
    ledger.push({
      label: `${staffResult.left.length} resigned`,
      note: `workplace culture ${Math.round(culture.score)} — ${culture.word.toLowerCase()}`,
      kind: "info",
    });
    applyRep(
      s,
      "loyalty",
      -4 * staffResult.left.length,
      "people left, and everyone noticed",
    );
  }

  // 3. The competition.
  const moves = tickRivals(s, rng, cityIds);
  for (const r of s.rivals ?? []) refreshStance(s, r);
  for (const move of moves) {
    const rival = (s.rivals ?? []).find((x) => x.history[0] === move);
    const def = rival ? CAST_BY_ID.get(rival.id) : undefined;
    if (!def) continue;
    /* Rival moves are news, not messages: it is public information about the
       profession, and putting it in the inbox would make the inbox noise. */
    pushNews(s, rivalNews(s, def.name, move, rng));
  }

  // 4. The world reports itself.
  if (rng.chance(0.45)) {
    const item = worldNews(s, rng, {
      cities: cityIds,
      cityName: (id) => cityOf(id as never).name,
      markets: Object.fromEntries(
        cityIds.map((c) => {
          const mk = marketOf(m.markets, c as never);
          return [
            c,
            {
              salary: mk.salary,
              demand: mk.demand,
              regulation: mk.regulation,
              sentiment: mk.sentiment,
              shock: mk.shock,
            },
          ];
        }),
      ),
    });
    if (item) {
      pushNews(s, item);
      applyNewsEffect(s, m, item);
    }
  }

  // 5. Work.
  runContracts(s, ctx, culture.score, rng);

  // 6. Money that comes with strings.
  const fin = tickFinance(s);
  if (fin.interest > 0) {
    ledger.push({
      label: "Interest on borrowing",
      amount: -Math.round(fin.interest),
      kind: "expense",
    });
  }
  for (const note of fin.notes) pushLog(s, note, "neutral");
  for (const bad of fin.defaulted) {
    bad.settled = true;
    s.r.cash -= bad.outstanding * 0.5;
    applyRep(s, "credibility", -8, "you defaulted on a facility");
    pushLog(s, "A lender has called in a facility you could not service.", "bad");
  }
  const dividend = dividendOn(s, ctx.profit);
  if (dividend > 0) {
    s.r.cash -= dividend;
    ledger.push({
      label: "Paid out to shareholders",
      amount: -dividend,
      note: `${100 - Math.round(100 - equityHeld(s))}% of the practice is not yours`,
      kind: "expense",
    });
  }

  // 7. Bad weeks that last.
  runCrises(s, ctx, culture.score, rng);
}

const equityHeld = (s: RunState): number =>
  (s.obligations ?? []).reduce((n, o) => n + o.equity, 0);

/**
 * Backfill anything a migrated or older save is missing.
 *
 * Called every week rather than once at load, for the same reason the cast
 * arrival check is: a build that adds a rival should have that rival join an
 * in-progress save, not never appear.
 */
function ensureSeeded(s: RunState, m: MedicalState): void {
  if (!m.markets) {
    // Imported lazily to avoid a cycle with economy's city import.
    m.markets = {};
  }
  for (const city of Object.keys(m.panels)) {
    if (!m.markets[city]) {
      m.markets[city] = {
        demand: 1,
        salary: 1,
        rent: 1,
        fees: 1,
        talent: 1,
        sentiment: 50,
        regulation: 20,
        cycle: 0,
        shockWeeks: 0,
        shock: null,
      };
    }
  }

  if (!s.rivals) s.rivals = [];
  const known = new Set(s.rivals.map((r) => r.id));
  for (const def of PHYSICIAN_RIVALS) {
    if (!known.has(def.id)) s.rivals.push(initialRival(def));
  }
  s.offers ??= [];
  s.contracts ??= [];
  s.contractLog ??= [];
  s.obligations ??= [];
  s.news ??= [];
  s.crises ??= [];
}

function pushNews(s: RunState, item: NewsItem): void {
  if ((s.news ?? []).some((n) => n.id === item.id)) return;
  s.news = [item, ...(s.news ?? [])].slice(0, MAX_WORLD_NEWS);
}

/**
 * News that does something.
 *
 * The whole reason this module exists rather than the phone's decorative news
 * list: a headline about wages moves the wage multiplier.
 */
function applyNewsEffect(s: RunState, m: MedicalState, item: NewsItem): void {
  const e = item.effect;
  if (!e) return;
  const city = e.city;
  if (city && m.markets?.[city]) {
    const mk = m.markets[city];
    if (e.demand) mk.demand *= e.demand;
    if (e.fees) mk.fees *= e.fees;
    if (e.salary) mk.salary *= e.salary;
    if (e.rent) mk.rent *= e.rent;
    if (e.regulation) mk.regulation *= e.regulation;
    if (e.sentiment) mk.sentiment = Math.max(0, Math.min(100, mk.sentiment + e.sentiment));
  }
  for (const [id, delta] of Object.entries(e.rep ?? {})) {
    applyRep(s, id as never, delta as number, `reported: ${item.headline}`, true);
  }
  if (e.contractBoost) s.r._contractBoost = (s.r._contractBoost ?? 0) + e.contractBoost;
}

/* ------------------------------------------------------------- contracts */

/**
 * Blocks the player put into their live work this week.
 *
 * Spent on the contract closest to its deadline, because that is what a
 * person would do and because it removes a fiddly per-contract allocation UI
 * that would add clicks without adding a decision. The decision is *how many
 * blocks*, not which pile they go on.
 */
export function workContracts(s: RunState, blocks: number): void {
  let left = blocks;
  const live = [...(s.contracts ?? [])].sort((a, b) => a.dueWeek - b.dueWeek);
  for (const active of live) {
    if (left <= 0) break;
    const def = CONTRACT_BY_ID.get(active.defId);
    if (!def) continue;
    const room = Math.max(0, def.effort - active.progress);
    const put = Math.min(left, room);
    active.progress += put;
    left -= put;
    s.r.burnout += def.strain * put;
  }
}


function runContracts(
  s: RunState,
  ctx: Phase2Context,
  culture: number,
  rng: Rng,
): void {
  const { m, ledger } = ctx;

  // --- offers expire -----------------------------------------------------
  s.offers = (s.offers ?? []).filter((o) => o.expiresWeek > s.week);

  // --- new offers --------------------------------------------------------
  const boost = Math.max(0, s.r._contractBoost ?? 0);
  if (boost > 0) s.r._contractBoost = boost - 1;
  const offerChance = Math.min(0.55, 0.16 + boost * 0.02 + m.staff.length * 0.012);

  if ((s.offers ?? []).length < MAX_OFFERS && rng.chance(offerChance)) {
    const eligible = MEDICAL_CONTRACTS.filter(
      (c) =>
        c.requires(s) &&
        !(s.offers ?? []).some((o) => o.defId === c.id) &&
        !(s.contracts ?? []).some((a) => a.defId === c.id),
    );
    if (eligible.length > 0) {
      const weights = eligible.map((c) => Math.max(0.01, c.weight(s)));
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = rng.next() * total;
      let picked = eligible[0];
      for (let i = 0; i < eligible.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
          picked = eligible[i];
          break;
        }
      }
      const rival = picked.rival
        ? (s.rivals ?? []).find((r) => r.id === picked.rival)
        : undefined;
      const offer: ContractOffer = {
        defId: picked.id,
        city: m.homeCity,
        expiresWeek: s.week + 3,
        rivalBid: rival ? rivalBid(rival) : 0,
        rival: rival?.id,
      };
      s.offers = [...(s.offers ?? []), offer];
      pushMessage(s, m, {
        id: `msg.offer.${picked.id}.${s.week}`,
        week: s.week,
        from: picked.npc ? (CAST_BY_ID.get(picked.npc)?.name ?? "A client") : "A client",
        handle: picked.npc ? `@${CAST_BY_ID.get(picked.npc)?.handle ?? "client"}` : "@client",
        role: "peer",
        body: `${picked.title}. ${picked.blurb}`,
        read: false,
      });
    }
  }

  // --- work in progress --------------------------------------------------
  for (const active of [...(s.contracts ?? [])]) {
    const def = CONTRACT_BY_ID.get(active.defId);
    if (!def) {
      // A contract from a build where it existed. Drop it rather than crash.
      s.contracts = (s.contracts ?? []).filter((c) => c !== active);
      continue;
    }

    const c = rollComplication(def, active, s.week, rng);
    if (c) {
      pushLog(s, `${def.title}: ${c.text}`, "bad");
      if (c.ethics) applyRep(s, "ethics", -c.ethics * 8, `a complication on ${def.title}`);
    }

    if (s.week < active.dueWeek) continue;

    // --- the deadline ----------------------------------------------------
    const staffSkill =
      active.assigned.length === 0
        ? 0
        : active.assigned.reduce((n, id) => {
            const x = m.staff.find((p) => p.id === id);
            return n + (x ? hydrateStaff(x).skill : 0);
          }, 0) / active.assigned.length;

    const readiness = readinessFor(s, active, def, {
      skill: s.r.skill,
      burnout: s.r.burnout,
      standing: s.r.reputation,
      staffSkill,
      cityFactor: marketOf(m.markets, active.city as never).demand,
      culture,
    });
    const { won } = resolveContract(def, active, readiness, rng);
    const fee = contractFee(def, active, effectiveFee(m.markets, active.city as never));

    if (won) {
      s.r.cash += fee;
      ledger.push({
        label: `Completed: ${def.title}`,
        amount: fee,
        kind: "income",
      });
      for (const [id, delta] of Object.entries(def.onSuccess)) {
        applyRep(s, id as never, delta as number, `you delivered ${def.title}`);
      }
      if (def.kind === "public") acquitGrant(s);
      if (def.npc) {
        touchPerson(
          s,
          def.npc,
          { warmth: 8, trust: 6, respect: 8 },
          `you delivered ${def.title}`,
          "good",
        );
      }
      mark(
        s,
        `contract-${def.id}`,
        def.kind === "institutional" ? "business" : "award",
        def.title,
        `Completed for ${Math.round(fee).toLocaleString("en-US")}.`,
      );
    } else {
      for (const [id, delta] of Object.entries(def.onFailure)) {
        applyRep(s, id as never, delta as number, `${def.title} did not go well`);
      }
      ledger.push({
        label: `Failed: ${def.title}`,
        note:
          active.progress < def.effort * 0.5
            ? "you never put the hours in"
            : "it was beyond what you brought to it",
        kind: "info",
      });
      if (def.npc) {
        touchPerson(
          s,
          def.npc,
          { warmth: -6, trust: -8 },
          `${def.title} did not go well`,
          "bad",
        );
      }
    }

    const record: ContractRecord = {
      week: s.week,
      defId: def.id,
      title: def.title,
      outcome: won ? "won" : "lost",
      fee: won ? fee : 0,
    };
    s.contractLog = [record, ...(s.contractLog ?? [])].slice(
      0,
      MAX_CONTRACT_HISTORY,
    );
    s.contracts = (s.contracts ?? []).filter((c2) => c2 !== active);
  }
}

function pushMessage(
  s: RunState,
  m: MedicalState,
  msg: MedicalState["phone"]["messages"][number],
): void {
  if (m.phone.messages.some((x) => x.id === msg.id)) return;
  m.phone.messages = [msg, ...m.phone.messages].slice(0, MAX_MESSAGES);
}

/* ---------------------------------------------------------------- crises */

function runCrises(
  s: RunState,
  ctx: Phase2Context,
  culture: number,
  rng: Rng,
): void {
  const { m } = ctx;

  for (const c of [...(s.crises ?? [])]) {
    const { escalated, burnedOut } = tickCrisis(c);
    if (escalated) {
      pushLog(
        s,
        `${CRISIS_LABEL[c.kind]}: you left it too long, and it has moved on without you.`,
        "bad",
      );
    }
    if (burnedOut) {
      /* The bill for having done nothing, and then it is over. Deliberately
         worse than any of the choices that were on offer. */
      s.crises = (s.crises ?? []).filter((x) => x !== c);
      s.r.cash -= 60_000;
      applyRep(s, "credibility", -8, `you never dealt with the ${CRISIS_LABEL[c.kind].toLowerCase()}`);
      applyRep(s, "loyalty", -10, "nobody stepped in, including you");
      applyRep(s, "ethics", -5, "it was allowed to run");
      pushLog(
        s,
        `The ${CRISIS_LABEL[c.kind].toLowerCase()} resolved itself, in the worst available way.`,
        "bad",
      );
      mark(
        s,
        `crisis-burned-${c.id}`,
        "failure",
        `You let the ${CRISIS_LABEL[c.kind].toLowerCase()} run`,
        `${s.week - c.startedWeek} weeks, and you never answered it.`,
      );
      continue;
    }
    if (isResolved(c)) {
      s.crises = (s.crises ?? []).filter((x) => x !== c);
      mark(
        s,
        `crisis-${c.id}`,
        "recovery",
        `You came through the ${CRISIS_LABEL[c.kind].toLowerCase()}`,
        `${s.week - c.startedWeek} weeks of it.`,
      );
      applyRep(s, "credibility", 3, "you handled a crisis and it ended");
    }
  }

  if ((s.crises ?? []).length >= MAX_CRISES) return;

  const risk = crisisRisk({
    week: s.week,
    culture,
    ethics: s.r.repEthics ?? 70,
    risk: s.r.risk,
    regulation: marketOf(m.markets, m.homeCity).regulation,
    cashWeeks: ctx.cashWeeks,
    supplyWeeks: ctx.supplyWeeks,
    staff: m.staff.length,
    scrutiny: m.phone.social.scrutiny,
  });

  /* One of each kind at a time. Two simultaneous staff walkouts is not a
     harder game, it is a duplicated card — which is exactly what a probe
     screenshot showed before this check existed. */
  const running = new Set((s.crises ?? []).map((c) => c.kind));
  if (risk.kind && !running.has(risk.kind) && rng.chance(risk.chance)) {
    /* Starting severity is lower for a well-run practice. Prevention is not
       only "fewer crises" — it is also "the ones you get are survivable". */
    const severity = 40 + (60 - culture) * 0.4 + rng.int(0, 20);
    const crisis = startCrisis(risk.kind, s.week, severity, m.homeCity);
    s.crises = [...(s.crises ?? []), crisis];
    pushLog(s, `${CRISIS_LABEL[risk.kind]}. This one will not resolve itself.`, "bad");
    mark(
      s,
      `crisis-began-${crisis.id}`,
      "crisis",
      CRISIS_LABEL[risk.kind],
      risk.drivers.length
        ? `It came out of ${risk.drivers.slice(0, 2).join(" and ")}.`
        : "It came out of nowhere.",
    );
  }
}

/* ------------------------------------------------ commands from the UI */

/**
 * The player-driven half. Dispatched from `doctor.command` so every one of
 * these goes through the same audited path as hiring and buying — a disabled
 * button is a hint, not a rule.
 */
export function phase2Command(s: RunState, cmd: string, arg: string): boolean {
  const m = s.data.med as MedicalState;
  switch (cmd) {
    case "acceptContract": {
      const offer = (s.offers ?? []).find((o) => o.defId === arg);
      const def = CONTRACT_BY_ID.get(arg);
      if (!offer || !def) return true;
      if ((s.contracts ?? []).length >= MAX_ACTIVE) return true;

      /* The contest. Your case against theirs, decided on standing and
         preparation rather than a die — losing here is common early and is
         the main thing that makes a contract feel earned. */
      const playerCase =
        s.r.reputation * 0.5 +
        s.r.skill * 0.3 +
        (s.r.repInfluence ?? 20) * 0.25 +
        /* Capped. Headcount is evidence you can deliver, not a bid you
           can raise without limit — an uncapped term meant a fifty-person
           practice won every contest in the game, which a probe run over
           156 weeks showed as five rivals with zero wins between them. */
        Math.min(14, m.staff.length * 1.2);
      if (offer.rivalBid > playerCase) {
        if (offer.rival) recordContest(s, offer.rival, false, def.title);
        s.offers = (s.offers ?? []).filter((o) => o !== offer);
        pushLog(s, `${def.title} went to somebody else.`, "bad");
        const lost: ContractRecord = {
          week: s.week,
          defId: def.id,
          title: def.title,
          outcome: "lost",
          fee: 0,
        };
        s.contractLog = [lost, ...(s.contractLog ?? [])].slice(
          0,
          MAX_CONTRACT_HISTORY,
        );
        return true;
      }

      if (offer.rival) recordContest(s, offer.rival, true, def.title);
      s.contracts = [
        ...(s.contracts ?? []),
        startContract(def.id, offer.city, s.week, def.deadline),
      ];
      s.offers = (s.offers ?? []).filter((o) => o !== offer);
      pushLog(s, `You took on ${def.title}.`, "neutral");
      return true;
    }

    case "declineContract": {
      const offer = (s.offers ?? []).find((o) => o.defId === arg);
      if (!offer) return true;
      s.offers = (s.offers ?? []).filter((o) => o !== offer);
      return true;
    }

    case "assignToContract": {
      // arg is "defId:staffId"
      const [defId, staffId] = arg.split(":");
      const active = (s.contracts ?? []).find((c) => c.defId === defId);
      if (!active || !m.staff.some((x) => x.id === staffId)) return true;
      active.assigned = active.assigned.includes(staffId)
        ? active.assigned.filter((x) => x !== staffId)
        : [...active.assigned, staffId].slice(0, 3);
      return true;
    }

    default:
      return false;
  }
}

/* ------------------------------------------------ the rest of the commands */

/**
 * Financing, crisis response, and staff management.
 *
 * Split from `phase2Command` only for length; both are dispatched from
 * `doctor.command`, so every gate below is re-checked here rather than trusted
 * to a disabled button. That matters most for the exploit surfaces: equity
 * ceilings, borrowing capacity and the once-per-stage crisis choices are
 * enforced in this file and nowhere else.
 */
export function phase2Command2(
  s: RunState,
  cmd: string,
  arg: string,
  ctx: { netWorth: number; weeklyRevenue: number },
): boolean {
  const m = s.data.med as MedicalState;
  switch (cmd) {
    case "raiseFunds": {
      const offers = fundingOffers(s, {
        netWorth: ctx.netWorth,
        weeklyRevenue: ctx.weeklyRevenue,
        credibility: s.r.reputation,
        influence: s.r.repInfluence ?? 20,
        ethics: s.r.repEthics ?? 70,
        investorWarmth: personIn(s, "thorne")?.warmth ?? 0,
        partnerWarmth: personIn(s, "adeyemi")?.warmth ?? 0,
      });
      const offer = offers.find((o) => o.kind === arg);
      if (!offer) return true;
      const taken = takeFunding(s, offer);
      if (!taken) return true;

      pushLog(
        s,
        `Raised ${Math.round(offer.amount).toLocaleString("en-US")} — ${offer.label.toLowerCase()}.`,
        "neutral",
      );
      mark(
        s,
        `funding-${taken.id}`,
        "business",
        offer.label,
        offer.equity > 0
          ? `${offer.equity}% of the practice, for ${Math.round(offer.amount).toLocaleString("en-US")}.`
          : `${Math.round(offer.amount).toLocaleString("en-US")} raised.`,
      );
      if (offer.holder) {
        touchPerson(
          s,
          offer.holder,
          { warmth: 8, trust: 6, remember: ["funded-you"] },
          "they put money into the practice",
          "good",
        );
      }
      /* Equity has a standing cost as well as a financial one: the profession
         notices who owns you. */
      if (offer.equity > 0) {
        applyRep(s, "influence", 4, "you have a serious backer");
        applyRep(s, "ethics", -2, "the money came with strings");
      }
      return true;
    }

    case "repayFacility": {
      // arg is "obligationId:amount"
      const [id, amountRaw] = arg.split(":");
      const amount = Number(amountRaw);
      if (!Number.isFinite(amount) || amount <= 0) return true;
      const paid = repay(s, id, amount);
      if (paid > 0) {
        applyRep(s, "credibility", 1, "you paid down borrowing early", true);
      }
      return true;
    }

    case "crisisChoice": {
      // arg is "crisisId:choiceId"
      const [crisisId, choiceId] = arg.split(":");
      const c = (s.crises ?? []).find((x) => x.id === crisisId);
      if (!c) return true;
      const stage = stageOf(c);
      const choice = stage.choices.find((x) => x.id === choiceId);
      if (!choice) return true;
      /* One choice per stage. Without this a player could take every option
         on a stage and stack the severity reductions. */
      if (c.taken.includes(choiceId)) return true;
      if (choice.cost && s.r.cash < choice.cost) return true;

      if (choice.cost) s.r.cash -= choice.cost;
      if (choice.blocks) {
        s.r._crisisBlocks = (s.r._crisisBlocks ?? 0) + choice.blocks;
      }
      c.severity = Math.max(0, Math.min(100, c.severity + choice.severity));
      c.taken.push(choiceId);
      c.ignored = 0;
      if (choice.next !== undefined) c.stage = choice.next;

      for (const [id, delta] of Object.entries(choice.rep ?? {})) {
        applyRep(
          s,
          id as never,
          delta as number,
          `${CRISIS_LABEL[c.kind]}: ${choice.label.toLowerCase()}`,
        );
      }
      for (const p of choice.people ?? []) {
        touchPerson(
          s,
          p.id,
          { warmth: p.warmth, trust: p.trust, respect: p.respect },
          p.why,
          (p.warmth ?? 0) < 0 ? "bad" : "good",
        );
      }
      pushLog(s, choice.result, choice.severity < 0 ? "good" : "bad");
      return true;
    }

    /* ------------------------------------------------- staff management */

    case "trainStaff": {
      const x = m.staff.find((p) => p.id === arg);
      if (!x) return true;
      const cost = 9_000;
      if (s.r.cash < cost) return true;
      const h = hydrateStaff(x);
      if (h.training > 0) return true;
      s.r.cash -= cost;
      x.training = 4;
      x.morale = Math.min(100, h.morale + 8);
      x.loyalty = Math.min(100, h.loyalty + 5);
      pushLog(s, `${x.name} has gone on a course.`, "neutral");
      return true;
    }

    case "rewardStaff": {
      const x = m.staff.find((p) => p.id === arg);
      if (!x) return true;
      const h = hydrateStaff(x);
      /* A rise is permanent, which is what stops this being a free morale
         button: it raises payroll for the rest of the run. */
      const rise = Math.max(120, Math.round(h.expects - h.salary));
      if (s.r.cash < rise * 8) return true;
      x.salary = h.salary + rise;
      x.morale = Math.min(100, h.morale + 14);
      x.loyalty = Math.min(100, h.loyalty + 12);
      applyRep(s, "loyalty", 2, `you paid ${x.name} what they were worth`);
      return true;
    }

    case "promoteStaff": {
      const x = m.staff.find((p) => p.id === arg);
      if (!x) return true;
      const h = hydrateStaff(x);
      if (h.lead) return true;
      x.lead = true;
      x.salary = Math.round(h.salary * 1.2);
      x.morale = Math.min(100, h.morale + 18);
      x.loyalty = Math.min(100, h.loyalty + 15);
      /* Somebody else wanted it. Promotion is a choice between people, not a
         free upgrade — which is why the ambitious ones take a small hit. */
      for (const other of m.staff) {
        if (other.id === x.id) continue;
        const o = hydrateStaff(other);
        if (o.ambition > 55) other.morale = Math.max(0, o.morale - 6);
      }
      pushLog(s, `${x.name} now leads a team.`, "good");
      mark(
        s,
        `promoted-${x.id}`,
        "people",
        `You promoted ${x.name}`,
        "Somebody else wanted it.",
      );
      return true;
    }

    case "warnStaff": {
      const x = m.staff.find((p) => p.id === arg);
      if (!x) return true;
      const h = hydrateStaff(x);
      x.warnings = h.warnings + 1;
      x.morale = Math.max(0, h.morale - 16);
      x.loyalty = Math.max(0, h.loyalty - 10);
      /* Sometimes correct. Always visible in the culture score. */
      pushLog(s, `${x.name} has been given a formal warning.`, "neutral");
      return true;
    }

    case "recoverSetback": {
      // arg is "kind:stepId"
      const [kind, stepId] = arg.split(":");
      const sb = (s.setbacks ?? []).find((x) => x.kind === kind);
      if (!sb) return true;
      const step = (RECOVERY[kind as keyof typeof RECOVERY] ?? []).find(
        (x) => x.id === stepId,
      );
      if (!step) return true;
      /* Once each. A step you can repeat is a button, and the whole point of
         a comeback is that each thing you do only counts the first time. */
      if (sb.done.includes(stepId)) return true;
      if (!step.available(s)) return true;

      sb.done.push(stepId);
      sb.grip = Math.max(0, sb.grip - step.relief);
      pushLog(s, `${step.label}. ${step.detail}`, "good");
      /* Coming back costs money and it costs weeks; the relief above is the
         reward, and this is the price. */
      if (stepId === "support" || stepId === "remediation") s.r.cash -= 12_000;
      if (stepId === "restitution") s.r.cash -= 25_000;
      /* Restructuring writes debt down rather than costing cash — that is
         what a restructuring IS, and charging for it made the one route out
         of insolvency require solvency. */
      if (stepId === "restructure") {
        s.r.debt = Math.max(0, s.r.debt * 0.72);
        applyRep(s, "credibility", -3, "your creditors took a haircut");
      }
      /* Selling a site raises real money and costs real capacity. */
      if (stepId === "sellup") {
        const sold = m.facilities.pop();
        if (sold) {
          s.r.cash += 45_000;
          pushLog(s, `Sold ${sold.name}. It went for less than it was worth.`, "neutral");
        }
      }
      applyRep(s, "ethics", 2, "you did the work to come back", true);
      return true;
    }

    case "setAmbition": {
      setAmbition(s, arg as never);
      return true;
    }

    case "easeWorkload": {
      /* Practice-wide, not per person: the rota is one thing. Costs capacity
         this week and buys morale back. */
      if (m.staff.length === 0) return true;
      for (const raw of m.staff) {
        const h = hydrateStaff(raw);
        raw.workload = Math.max(0, h.workload - 22);
        raw.morale = Math.min(100, h.morale + 7);
      }
      s.r._easedWeeks = (s.r._easedWeeks ?? 0) + 1;
      applyRep(s, "loyalty", 3, "you took pressure off the rota");
      return true;
    }

    default:
      return false;
  }
}
