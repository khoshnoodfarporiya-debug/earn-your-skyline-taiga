"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { screenOf, type ScreenId } from "@/lib/ui/navigation";
import { Stat } from "./Shelf";
import {
  CASE_BY_ID,
  CASE_KINDS,
  LEGAL_ROLE_BY_ID,
  MAX_ADJOURNMENTS,
  SPECIALIST_HOURS,
  areaBand,
  areaHours,
  areaSkill,
  billsOf,
  billsOwed,
  MAX_RETAINERS,
  RETAINER_BY_ID,
  chambersRent,
  retainerHours,
  retainerIncome,
  retainerOffersOf,
  retainersOf,
  chambersSeats,
  nextChambers,
  chambersOf,
  chambersPrice,
  chambersRank,
  seatsFree,
  seatsUsed,
  factorValue,
  feeIn,
  hasClerk,
  hoursNeededFor,
  hoursOutstanding,
  legalCityOf,
  legalWages,
  oddsFor,
  payerOf,
  settlementFor,
  staffHours,
  workInProgress,
} from "@/lib/game/careers/casework";
import { firmWorth, goalFor, practice } from "@/lib/game/careers/lawyer";
import {
  SOLICITOR_ART,
  asBanner,
  type SolicitorSceneId,
} from "@/lib/ui/careerSceneArt";
import { ArtFrame } from "../visuals/ArtFrame";
import { PeoplePanel } from "../medical/PeoplePanel";

/**
 * THE SOLICITOR'S SCREENS
 *
 * One practice, four questions, one screen each — see `LAWYER_SECTIONS` in
 * `lib/ui/navigation.ts` for why the destination was split and why it is still
 * a single entry in the nav bar.
 *
 * Nothing here decides anything. Every number is read from the practice model
 * or from a pure function in `casework.ts`, and every control dispatches a
 * command the engine already had. Where a figure is quoted next to a button —
 * a settlement, a factor's price — it comes from the same function the command
 * uses, because a presentation layer that restates a number is one that will
 * eventually restate it wrongly.
 */
export function LawyerScreens({
  screen,
  state,
  onCommand,
  onCall,
}: {
  screen: ScreenId;
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
  /** Open the phone on an app — how a screen rings the list or the roll. */
  onCall: (app: "listings" | "roll") => void;
}) {
  if (state.careerId !== "lawyer") return null;

  const body =
    screen === "instructions" ? (
      <InstructionsScreen state={state} onCommand={onCommand} />
    ) : screen === "casework" ? (
      <CaseworkScreen state={state} onCommand={onCommand} onCall={onCall} />
    ) : screen === "ledger" ? (
      <BooksScreen state={state} onCommand={onCommand} />
    ) : screen === "firm" ? (
      <FirmScreen state={state} onCommand={onCommand} onCall={onCall} />
    ) : null;

  if (!body) return null;

  const def = screenOf(screen);
  const scene = solicitorScene(screen, state);
  return (
    <div className="space-y-6">
      {/* The Physician's ScreenHeader reads medical state, so the Solicitor
          states where it is itself rather than borrowing a component that
          would be null for it. Same reason the Chef's does. */}
      <div>
        <h1 className="display text-[19px] leading-tight text-ink">{def.label}</h1>
        <p className="mt-0.5 text-xs text-ink-faint">{def.purpose}</p>
      </div>
      <ArtFrame
        visual={asBanner(SOLICITOR_ART[scene])}
        ratio="aspect-[21/7]"
        scrim="bottom"
        sizes="(min-width: 1152px) 1104px, 100vw"
        className="rounded-lg border border-rule"
      >
        <p className="sign absolute bottom-3 left-4 text-[11px] text-ink drop-shadow-[0_1px_5px_rgba(0,0,0,0.95)]">
          {SOLICITOR_SCENE_LABEL[scene]}
        </p>
      </ArtFrame>
      {body}
    </div>
  );
}

const SOLICITOR_SCENE_LABEL: Record<SolicitorSceneId, string> = {
  "borrowed-desk": "Starting with borrowed space",
  chambers: "Your chambers",
  "established-firm": "An established practice",
  "court-corridor": "The hearing is close",
  "client-meeting": "New instructions",
  "case-files": "The active file room",
  "case-preparation": "Preparing the argument",
  negotiation: "Settlement remains possible",
  hearing: "Before the court",
  "legal-team": "The firm at work",
  "regulatory-investigation": "Regulatory scrutiny",
};

/** Choose artwork from facts already present in the live practice. */
function solicitorScene(screen: ScreenId, state: RunState): SolicitorSceneId {
  const p = practice(state);

  if (screen === "instructions") {
    if (p.offers.some((offer) => offer.conflict)) return "regulatory-investigation";
    return p.offers.length > 0 ? "client-meeting" : "chambers";
  }

  if (screen === "casework") {
    if (p.cases.some((matter) => matter.conflicted)) {
      return "regulatory-investigation";
    }
    if (p.cases.some((matter) => matter.dueWeek <= state.week)) return "hearing";
    if (p.cases.some((matter) => matter.dueWeek <= state.week + 2)) {
      return "court-corridor";
    }
    if (p.cases.some((matter) => matter.hoursDone > 0)) return "negotiation";
    return p.cases.length > 0 ? "case-preparation" : "case-files";
  }

  if (screen === "ledger") return "case-files";

  if (p.staff.length >= 3) return "legal-team";
  if (p.staff.length > 0 || chambersRank(p) > 0) return "established-firm";
  return "borrowed-desk";
}

/* ------------------------------------------------------------- the shared */

/** An empty screen that says what to do about being empty. */
function Nothing({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded border border-dashed border-rule px-3 py-4 text-center text-xs text-ink-faint">
      {children}
    </p>
  );
}

/**
 * How ready a file is, as something you can look at.
 *
 * A real meter rather than a decorated div: a screen reader announces the
 * percentage instead of skipping a bare span, and the global reduced-motion
 * rule targets `[role="meter"] > *`, so the fill stops animating its width for
 * anyone who asked for that.
 */
function Prepared({ pct, label }: { pct: number; label: string }) {
  const value = Math.round(pct * 100);
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="sign shrink-0 text-[10.5px] text-ink-faint">Prepared</span>
      <span
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Preparation on ${label}`}
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-rule-soft"
      >
        <span
          className={`block h-full rounded-full transition-[width] duration-500 ${
            value >= 100 ? "bg-good" : "bg-caution"
          }`}
          style={{ width: value <= 0 ? "0%" : `${Math.min(100, Math.max(5, value))}%` }}
        />
      </span>
      <span className="num shrink-0 text-[11.5px] text-ink-soft">{value}%</span>
    </div>
  );
}

/** The payer, as a badge with the consequence written next to it. */
function PayerBadge({ payer }: { payer: string | undefined }) {
  const p = payerOf(payer as never);
  const tone =
    p.id === "prompt"
      ? "bg-good-tint text-good"
      : p.id === "slow"
        ? "bg-caution-tint text-caution"
        : "bg-alarm-tint text-alarm";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${tone}`}>
      {p.label}
      {p.weeks > 0 ? ` · pays ${p.weeks} weeks after judgment` : ""}
    </span>
  );
}

/* ------------------------------------------------------------ instructions */

function InstructionsScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const p = practice(state);
  const city = legalCityOf(p);

  /*
   * The two gates, computed from the same expression `newOffers` uses.
   *
   * Reputation is what you have earned and rises; `reach` is what this market
   * has and does not. Stating both is the difference between a player who
   * knows they are grinding towards a group claim and one who thinks the game
   * is broken because Lagos never sends them one.
   */
  const earned = CASE_KINDS.filter((k) => k.prestige <= 2 + state.r.reputation / 3.2);
  const reachable = earned.filter((k) => k.prestige <= city.reach);
  const best = [...reachable].sort((a, b) => b.prestige - a.prestige)[0];
  const ceiling = [...CASE_KINDS]
    .filter((k) => k.prestige <= city.reach)
    .sort((a, b) => b.prestige - a.prestige)[0];
  const beyond = [...CASE_KINDS]
    .filter((k) => k.prestige > city.reach)
    .sort((a, b) => a.prestige - b.prestige)[0];

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="market-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="market-h" className="text-sm font-semibold text-ink">
          Practising in {city.name}
        </h2>
        <p className="mt-1 text-xs text-ink-faint">{city.blurb}</p>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat label="On every fee" value={`${Math.round(city.fee * 100)}%`} />
          <Stat label="Chambers rent" value={`${Math.round(city.rent * 100)}%`} />
          <Stat
            label="Work in the door"
            value={`${Math.round(city.flow * 100)}%`}
          />
          <Stat label="Standing" value={`${Math.round(state.r.reputation)}`} />
        </dl>

        <p className="mt-3 border-t border-rule-soft pt-3 text-xs text-ink-soft">
          At this standing you are offered up to{" "}
          <span className="text-ink">{best ? best.label.toLowerCase() : "nothing yet"}</span>.{" "}
          {beyond
            ? `This market never sends ${beyond.label.toLowerCase()} however well the firm is regarded — the biggest work here is ${ceiling?.label.toLowerCase()}.`
            : "Everything this trade has passes through here eventually."}
        </p>
      </section>

      {/*
       * WHAT THIS FIRM TURNED OUT TO BE
       *
       * Only the work this market actually sends, because a bar showing zero
       * hours of group claims to a practice in a city that has never had one
       * is a reproach rather than information.
       */}
      <section
        aria-labelledby="areas-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="areas-h" className="text-sm font-semibold text-ink">
          What this firm is known for
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Hours on matters you <em>finished</em>. Doing a lot of one thing makes
          you faster at it, better at it when it is heard, and dearer — and
          makes the market send you more of it. {SPECIALIST_HOURS} hours in one
          area is a specialist practice.
        </p>

        {reachable.every((k) => areaHours(p, k.id) === 0) ? (
          <Nothing>
            Nothing finished yet. What you accept from here decides what this
            firm becomes.
          </Nothing>
        ) : (
          <ul className="mt-3 space-y-2">
            {[...reachable]
              .sort((a, b) => areaHours(p, b.id) - areaHours(p, a.id))
              .map((k) => {
                const skill = areaSkill(p, k.id);
                const hours = Math.round(areaHours(p, k.id));
                return (
                  <li key={k.id} className="text-xs">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-ink">{k.label}</span>
                      <span className="num text-ink-faint">
                        {hours}h · {areaBand(skill)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        role="meter"
                        aria-valuenow={Math.round(skill * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Experience in ${k.label}`}
                        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-rule-soft"
                      >
                        <span
                          className="block h-full rounded-full bg-clinical transition-[width] duration-500"
                          style={{
                            width:
                              skill <= 0
                                ? "0%"
                                : `${Math.max(4, Math.min(100, skill * 100))}%`,
                          }}
                        />
                      </span>
                      {skill > 0 && (
                        <span className="num shrink-0 text-[11px] text-ink-faint">
                          −{Math.round(skill * 12)}% hours · +
                          {Math.round(skill * 6)} odds · +
                          {Math.round(skill * 6)}% fee
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      {/*
       * Standing arrangements sit above the instructions, because deciding to
       * take one changes what the rest of this screen is worth: retained
       * hours come off the top of every week before a single one reaches a
       * matter, and a retained client stops appearing here at all.
       */}
      {retainerOffersOf(p).length > 0 && (
        <section
          aria-labelledby="retainer-h"
          className="rounded-lg border border-rule bg-card p-4"
        >
          <h2 id="retainer-h" className="text-sm font-semibold text-ink">
            Somebody wants you on a retainer
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            The only money in this career that arrives on a day you can name —
            paid for in hours off the top of every week, and in never being
            instructed by them again.
          </p>
          <ul className="mt-3 space-y-2">
            {retainerOffersOf(p).map((o) => {
              const kind = RETAINER_BY_ID.get(o.kind);
              if (!kind) return null;
              return (
                <li
                  key={o.id}
                  className="rounded border border-rule-soft px-3 py-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{kind.label}</p>
                      <p className="text-ink-faint">from {o.client}</p>
                    </div>
                    <p className="num shrink-0 text-ink-faint">
                      off the table after week {o.expiresWeek}
                    </p>
                  </div>
                  <p className="mt-1.5 text-ink-faint">{kind.blurb}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-faint">
                    <span>
                      Pays{" "}
                      <span className="text-good">
                        {money(Math.round(kind.fee * legalCityOf(p).fee))}
                      </span>{" "}
                      a week
                    </span>
                    <span>
                      Costs <span className="text-caution">{kind.hours}h</span> a
                      week
                    </span>
                    <span>
                      Runs <span className="text-ink">{kind.weeks} weeks</span>
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <button
                      type="button"
                      disabled={retainersOf(p).length >= MAX_RETAINERS}
                      onClick={() => onCommand("takeRetainer", o.id)}
                      className="rounded border border-rule px-2.5 py-1 text-ink enabled:hover:border-clinical disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Take the retainer
                    </button>
                    <span className="text-ink-faint">
                      {retainersOf(p).length >= MAX_RETAINERS
                        ? `You already hold ${MAX_RETAINERS}, which is as many as a practice can be available for.`
                        : "Fewer instructions will come in the door while you hold it."}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section
        aria-labelledby="offers-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="offers-h" className="text-sm font-semibold text-ink">
          On the table
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Who is paying, and when, is a term of the work — not a surprise
          afterwards. Accepting is the only thing on this screen that costs you
          anything.
        </p>

        {p.offers.length === 0 ? (
          <Nothing>
            Nothing on offer. Spend a block pitching for work, or publish
            something people will read.
          </Nothing>
        ) : (
          <ul className="mt-3 space-y-2">
            {p.offers.map((o) => {
              const k = CASE_BY_ID.get(o.kind);
              if (!k) return null;
              return (
                <li
                  key={o.id}
                  className="rounded border border-rule-soft px-3 py-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{k.label}</p>
                      <p className="text-ink-faint">for {o.client}</p>
                    </div>
                    <p className="num shrink-0 text-ink-faint">
                      off the table after week {o.expiresWeek}
                    </p>
                  </div>

                  <p className="mt-1.5 text-ink-faint">{k.blurb}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-faint">
                    <span>
                      Needs{" "}
                      <span className="text-ink">{hoursNeededFor(p, k)}h</span>
                      {hoursNeededFor(p, k) < k.hours && (
                        <span className="text-good">
                          {" "}
                          (was {k.hours}h)
                        </span>
                      )}
                    </span>
                    <span>
                      Wins <span className="text-ink">{money(feeIn(p, k))}</span>
                    </span>
                    <span>
                      Heard in <span className="text-ink">{k.window} weeks</span>
                    </span>
                    <span>
                      Odds about{" "}
                      <span className="text-ink">
                        {Math.round(k.baseOdds * 100)}%
                      </span>
                    </span>
                  </div>

                  {areaSkill(p, k.id) > 0 && (
                    <p className="mt-2 text-good">
                      {areaBand(areaSkill(p, k.id))} — {Math.round(areaHours(p, k.id))}
                      h finished in this area, and the odds and the fee above
                      already say so.
                    </p>
                  )}

                  <div className="mt-2">
                    <PayerBadge payer={o.payer} />
                    <p className="mt-1 text-ink-faint">
                      {payerOf(o.payer as never).note}
                    </p>
                  </div>

                  {/*
                   * A conflict is the one thing on this screen that is a
                   * reason NOT to press the button, so it is stated as a
                   * block rather than as a badge among four others.
                   */}
                  {o.conflict && (
                    <p className="mt-2 rounded border border-alarm/50 bg-alarm-tint px-2.5 py-1.5 text-alarm">
                      This is against {o.opponent}, who you have acted for. You
                      may take it. If you do, the regulator may read the file
                      after judgment — and standing is what decides the size of
                      everything you are sent afterwards.
                    </p>
                  )}

                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => onCommand("takeCase", o.id)}
                      className="rounded border border-rule px-2.5 py-1 text-ink hover:border-clinical"
                    >
                      Accept the instruction
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- casework */

function CaseworkScreen({
  state,
  onCommand,
  onCall,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
  onCall: (app: "listings" | "roll") => void;
}) {
  const p = practice(state);
  const owed = hoursOutstanding(p);
  const live = [...p.cases].sort((a, b) => a.dueWeek - b.dueWeek);

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="live-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="live-h" className="text-sm font-semibold text-ink">
          On the books in {legalCityOf(p).name}
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          None of this is money yet. {money(workInProgress(p))} of work in
          progress, {Math.round(owed)} hours still owed across the pipeline, and
          a court decides what any of it is worth.
        </p>

        {live.length === 0 ? (
          <Nothing>
            Nothing live. Take an instruction, or pitch for one — the rent falls
            due either way.
          </Nothing>
        ) : (
          <ul className="mt-3 space-y-2">
            {live.map((c) => {
              const k = CASE_BY_ID.get(c.kind);
              if (!k) return null;
              const odds = oddsFor(c, p, state.r.skill);
              const offer = settlementFor(c, p, state.r.skill);
              const ready = Math.min(1, c.hoursDone / hoursNeededFor(p, k));
              const away = c.dueWeek - state.week;
              const putBack = c.adjournments ?? 0;

              return (
                <li
                  key={c.id}
                  className="rounded border border-rule-soft px-3 py-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{k.label}</p>
                      <p className="text-ink-faint">
                        for {c.client}
                        {c.opponent ? ` · against ${c.opponent}` : ""}
                      </p>
                    </div>
                    <p
                      className={
                        away <= 3 ? "font-semibold text-alarm" : "text-ink-faint"
                      }
                    >
                      {away <= 0 ? "Heard this week" : `${away} weeks`}
                    </p>
                  </div>

                  <Prepared pct={ready} label={k.label} />

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-faint">
                    <span>
                      Odds <span className="text-ink">{Math.round(odds * 100)}%</span>
                    </span>
                    <span>
                      Wins <span className="text-ink">{money(feeIn(p, k))}</span>
                    </span>
                    <span>
                      Loses{" "}
                      <span className="text-alarm">
                        {money(
                          Math.round(feeIn(p, k) * 0.16 * (c.counsel ? 0.55 : 1)),
                        )}
                      </span>{" "}
                      in their costs
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <PayerBadge payer={c.payer} />
                    {c.counsel && (
                      <span className="inline-flex rounded-full bg-good-tint px-2 py-0.5 text-[11px] text-good">
                        Counsel briefed
                      </span>
                    )}
                  </div>

                  {putBack > 0 && (
                    <p className="mt-2 rounded border border-caution/50 bg-caution-tint px-2.5 py-1.5 text-caution">
                      Relisted {putBack} time{putBack === 1 ? "" : "s"}.{" "}
                      {putBack >= MAX_ADJOURNMENTS
                        ? "It will be heard next time it is listed."
                        : `Their offer is ${putBack * 4}% lower for the wait, and yours is the practice paying rent through it.`}
                    </p>
                  )}

                  {c.conflicted && (
                    <p className="mt-2 rounded border border-alarm/50 bg-alarm-tint px-2.5 py-1.5 text-alarm">
                      Taken against a former client. The regulator may read this
                      one after judgment.
                    </p>
                  )}

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onCommand("settleCase", c.id)}
                      className="rounded border border-rule px-2.5 py-1 text-ink hover:border-clinical"
                    >
                      Settle for {money(offer)}
                    </button>
                    <button
                      type="button"
                      onClick={() => onCommand("dropCase", c.id)}
                      className="rounded border border-rule-soft px-2.5 py-1 text-ink-faint hover:border-alarm hover:text-alarm"
                    >
                      Come off the record
                    </button>
                  </div>
                  <p className="mt-1.5 text-ink-faint">
                    Settling is certain and avoids their costs entirely. It is
                    what a court would call a discount and what a bank would
                    call solvency.
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/*
       * The doorway. Hearing dates and counsel are the court's business
       * rather than the file's, and briefing counsel is a call you make —
       * so it is on the handset and this screen names the two things a
       * player would open it to do.
       */}
      <section
        aria-labelledby="listings-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="listings-h" className="text-sm font-semibold text-ink">
          When is any of this being heard?
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          The cause list is on the phone, under Listings — every date, what has
          been put back, and the call to counsel that moves the odds before a
          hearing rather than after it.{" "}
          {hasClerk(p)
            ? "Your clerk is on the list every morning, which is why fewer of your dates move."
            : "Nothing you own currently stops a date moving."}
        </p>
        <button
          type="button"
          onClick={() => onCall("listings")}
          className="mt-3 rounded-form border border-rule px-3 py-1.5 text-xs text-ink transition hover:border-clinical hover:text-clinical"
        >
          Call the listings office
        </button>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------- the books */

function BooksScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const p = practice(state);
  const bills = [...billsOf(p)].sort((a, b) => a.dueWeek - b.dueWeek);
  const owed = billsOwed(p);
  const wip = workInProgress(p);
  const weekly = chambersRent(p) + legalWages(p);
  const goal = goalFor(state);
  const worth = firmWorth(state);
  /* What fighting has cost, read from the record rather than tallied
     separately — one source, and no way for the two to disagree. */
  const costsPaid = p.lastVerdicts.reduce((n, v) => n + (v.costs ?? 0), 0);
  const canPay = state.r.debt > 0 && state.r.cash > 0;

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="worth-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="worth-h" className="text-sm font-semibold text-ink">
          What the firm is worth
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Cash, plus judgments you are owed, plus hours in unresolved files,
          less the practice loan. Only the first of those pays chambers.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat label="Cash" value={money(state.r.cash)} tone={state.r.cash < weekly * 3 ? "bad" : undefined} />
          <Stat label="Owed to you" value={money(owed)} />
          <Stat label="Unbilled work" value={money(wip)} />
          <Stat label="Practice loan" value={money(state.r.debt)} tone={state.r.debt > 0 ? "bad" : undefined} />
        </dl>
        <p className="mt-3 border-t border-rule-soft pt-3 text-xs text-ink-soft">
          <span className="num text-ink">{money(worth)}</span> against a target
          of <span className="num text-ink">{money(goal)}</span> in{" "}
          {legalCityOf(p).name}.
        </p>
      </section>

      <section
        aria-labelledby="bills-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="bills-h" className="text-sm font-semibold text-ink">
          Judgments waiting to become money
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          A court has said this is yours. You cannot pay rent with that
          sentence. A factor will buy the wait off you, and the price of the
          wait is worse the further off it is.
        </p>

        {bills.length === 0 ? (
          <Nothing>
            Nothing billed out. Every judgment so far either paid on the nail or
            has not happened yet.
          </Nothing>
        ) : (
          <ul className="mt-3 space-y-2">
            {bills.map((b) => {
              const k = CASE_BY_ID.get(b.kind);
              const now = factorValue(b, state.week);
              const weeksLeft = Math.max(0, b.dueWeek - state.week);
              return (
                <li
                  key={b.id}
                  className="rounded border border-rule-soft px-3 py-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{b.client}</p>
                      <p className="text-ink-faint">{k?.label}</p>
                    </div>
                    <p className="num shrink-0 text-ink">{money(b.amount)}</p>
                  </div>
                  <p className="mt-1 text-ink-faint">
                    {weeksLeft === 0
                      ? "Due now."
                      : `Lands week ${b.dueWeek}, ${weeksLeft} week${weeksLeft === 1 ? "" : "s"} away.`}{" "}
                    {payerOf(b.payer).doubt > 0
                      ? "This one may still be argued down when it matures."
                      : "It will arrive in full."}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <button
                      type="button"
                      onClick={() => onCommand("factorBill", b.id)}
                      className="rounded border border-rule px-2.5 py-1 text-ink hover:border-clinical"
                    >
                      Sell it today for {money(now)}
                    </button>
                    <span className="text-ink-faint">
                      Giving up {money(b.amount - now)} to stop waiting.
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="retained-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="retained-h" className="text-sm font-semibold text-ink">
          Money that arrives on a day you can name
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Retainers are the only income here that does not wait for a court.
          They are paid for in hours reserved every week whether or not the
          client rings, and in never being instructed by them separately.
        </p>

        {retainersOf(p).length === 0 ? (
          <Nothing>
            Nothing standing. Every penny this firm earns is waiting on
            somebody else&rsquo;s decision.
          </Nothing>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <Stat
                label="Every week"
                value={`${money(retainerIncome(p))}/wk`}
              />
              <Stat label="Hours reserved" value={`${retainerHours(p)}/wk`} />
              <Stat
                label="Covers"
                value={
                  weekly > 0
                    ? `${Math.round((retainerIncome(p) / weekly) * 100)}% of costs`
                    : "—"
                }
                tone={retainerIncome(p) >= weekly ? "good" : undefined}
              />
            </dl>

            <ul className="mt-3 space-y-2">
              {retainersOf(p).map((held) => {
                const kind = RETAINER_BY_ID.get(held.kind);
                if (!kind) return null;
                return (
                  <li
                    key={held.id}
                    className="rounded border border-rule-soft px-3 py-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{held.client}</p>
                        <p className="text-ink-faint">{kind.label}</p>
                      </div>
                      <p className="num shrink-0 text-ink-faint">
                        {held.weeks} weeks left
                      </p>
                    </div>
                    <p className="mt-1 text-ink-faint">
                      {money(Math.round(kind.fee * legalCityOf(p).fee))} a week ·{" "}
                      {kind.hours}h a week reserved
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <button
                        type="button"
                        onClick={() => onCommand("endRetainer", held.id)}
                        className="rounded border border-rule-soft px-2.5 py-1 text-ink-faint hover:border-alarm hover:text-alarm"
                      >
                        Give notice
                      </button>
                      <span className="text-ink-faint">
                        You get the hours back and the profession hears you
                        walked away from a client.
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section
        aria-labelledby="outgoings-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="outgoings-h" className="text-sm font-semibold text-ink">
          What falls due whatever happens
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat label="Chambers" value={`${money(chambersRent(p))}/wk`} />
          <Stat label="Salaries" value={`${money(legalWages(p))}/wk`} />
          <Stat
            label="Weeks of cover"
            value={
              weekly > 0
                ? `${Math.max(0, Math.floor(state.r.cash / weekly))}`
                : "—"
            }
            tone={weekly > 0 && state.r.cash < weekly * 3 ? "bad" : undefined}
          />
          <Stat
            label="Their costs, paid"
            value={money(costsPaid)}
            tone={costsPaid > 0 ? "bad" : undefined}
          />
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-rule-soft pt-3">
          <button
            type="button"
            disabled={!canPay}
            onClick={() => onCommand("payLoan", "")}
            className="rounded border border-rule px-2.5 py-1 text-xs text-ink enabled:hover:border-clinical disabled:cursor-not-allowed disabled:opacity-45"
          >
            Pay down the loan
          </button>
          <span className="text-xs text-ink-faint">
            {state.r.debt <= 0
              ? "The practice loan is clear."
              : state.r.cash <= 0
                ? `You owe ${money(state.r.debt)} and have ${money(state.r.cash)} — there is nothing to pay it with.`
                : `Up to ${money(Math.min(10_000, state.r.debt, state.r.cash))} off the ${money(state.r.debt)} outstanding.`}
          </span>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------- the firm */

function FirmScreen({
  state,
  onCommand,
  onCall,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
  onCall: (app: "listings" | "roll") => void;
}) {
  const p = practice(state);
  const hours = staffHours(p);
  const record = [...p.lastVerdicts].reverse();
  const decided = record.filter((v) => !v.settled);
  const wins = decided.filter((v) => v.won).length;
  const settled = record.filter((v) => v.settled).length;
  const billed = record.reduce((n, v) => n + v.fee, 0);
  const costs = record.reduce((n, v) => n + (v.costs ?? 0), 0);

  return (
    <div className="space-y-6">
      {/*
       * WHERE THE FIRM SITS
       *
       * First on the screen, because it is the thing that caps everything
       * below it: rooms hold people, and people are the only source of hours
       * other than you.
       */}
      <section
        aria-labelledby="chambers-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="chambers-h" className="text-sm font-semibold text-ink">
          {chambersOf(p).label}
        </h2>
        <p className="mt-1 text-xs text-ink-faint">{chambersOf(p).blurb}</p>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat
            label="Seats"
            value={`${seatsUsed(p)} of ${chambersSeats(p)}`}
            tone={seatsFree(p) === 0 ? "bad" : undefined}
          />
          <Stat label="Rent" value={`${money(chambersRent(p))}/wk`} />
          <Stat
            label="Walk-ins"
            value={`${Math.round((chambersOf(p).draw - 1) * 100)}%`}
          />
          <Stat
            label="Room to grow"
            value={
              seatsFree(p) === 0
                ? "None"
                : `${seatsFree(p)} more`
            }
            tone={seatsFree(p) === 0 ? "bad" : undefined}
          />
        </dl>

        {seatsFree(p) === 0 && (
          <p className="mt-3 rounded border border-caution/50 bg-caution-tint px-2.5 py-1.5 text-xs text-caution">
            These rooms are full. Nobody else can be taken on until the firm
            moves.
          </p>
        )}

        {nextChambers(p) ? (
          <div className="mt-3 border-t border-rule-soft pt-3">
            <p className="text-xs font-medium text-ink">
              {nextChambers(p)!.label}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint">
              {nextChambers(p)!.blurb}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              Seats {nextChambers(p)!.seats} ·{" "}
              {money(
                Math.round(
                  nextChambers(p)!.rent * legalCityOf(p).rent,
                ),
              )}
              /wk ·{" "}
              {Math.round((nextChambers(p)!.draw - 1) * 100)}% more walking in
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <button
                type="button"
                disabled={state.r.cash < chambersPrice(p, nextChambers(p)!)}
                onClick={() => onCommand("takeChambers", nextChambers(p)!.id)}
                className="rounded border border-rule px-2.5 py-1 text-xs text-ink enabled:hover:border-clinical disabled:cursor-not-allowed disabled:opacity-45"
              >
                Take it · {money(chambersPrice(p, nextChambers(p)!))}
              </button>
              <span className="text-xs text-ink-faint">
                {state.r.cash < chambersPrice(p, nextChambers(p)!)
                  ? `Costs ${money(chambersPrice(p, nextChambers(p)!))} and you have ${money(state.r.cash)}.`
                  : "The rent is due from the week you move, full or empty."}
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-3 border-t border-rule-soft pt-3 text-xs text-ink-faint">
            There is nowhere further up to go. Everything from here is people
            and the work you put them on.
          </p>
        )}
      </section>

      <section
        aria-labelledby="people-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="people-h" className="text-sm font-semibold text-ink">
          Who is billing hours
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Hours you do not have to find yourself, at a salary that falls due
          every week whether or not anything has settled.
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat
            label="In the firm"
            value={p.staff.length === 0 ? "Only you" : `${p.staff.length}`}
          />
          <Stat label="Their hours" value={`${hours}/wk`} />
          <Stat label="Salaries" value={`${money(legalWages(p))}/wk`} />
          <Stat
            label="Chambers"
            value={`${seatsUsed(p)}/${chambersSeats(p)} · ${money(chambersRent(p))}/wk`}
          />
        </dl>

        {p.staff.length === 0 ? (
          <Nothing>
            Nobody but you. Every hour in every file this week is one you found
            yourself.
          </Nothing>
        ) : (
          <ul className="mt-3 space-y-2">
            {p.staff.map((x) => {
              const role = LEGAL_ROLE_BY_ID.get(x.role);
              return (
                <li
                  key={x.id}
                  className="flex items-start justify-between gap-3 rounded border border-rule-soft px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{x.name}</p>
                    <p className="text-ink-faint">
                      {role?.label}
                      {role ? ` · +${role.hours}h a week` : ""}
                      {role && role.weight > 0
                        ? ` · +${Math.round(role.weight * 100)} on every set of odds`
                        : ""}
                    </p>
                  </div>
                  <p className="num shrink-0 text-ink-faint">
                    {money(x.salary)}/wk
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={() => onCall("roll")}
          className="mt-3 rounded-form border border-rule px-3 py-1.5 text-xs text-ink transition hover:border-clinical hover:text-clinical"
        >
          Ring round for a seat
        </button>
      </section>

      {/*
       * WHO REMEMBERS YOU
       *
       * The people around a practice rather than the people in it: the
       * solicitor who trained you, the barrister's clerk, the opponent you
       * keep meeting, the client who came back. Three of them are the same
       * accounts that talk to you on the handset, so answering Julian Farrow
       * there is answering the person whose card is here.
       *
       * The panel itself is shared — the machinery in `people.ts` never had
       * anything medical in it, only its lookup did. See `castAccess.ts`.
       */}
      <PeoplePanel state={state} />

      {/*
       * THE RECORD
       *
       * The honest scoreboard, and the only place a player can check whether
       * the odds they were shown have actually held. Printed from
       * `lastVerdicts`, which is the same list the ledger lines came from.
       */}
      <section
        aria-labelledby="record-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="record-h" className="text-sm font-semibold text-ink">
          The record
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          What a court has actually said, against what you were told it might.
        </p>

        {record.length === 0 ? (
          <Nothing>
            Nothing decided yet. The record starts the first time a hearing is
            reached or an offer is taken.
          </Nothing>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Stat
                label="Fought"
                value={
                  decided.length === 0 ? "None" : `${wins} of ${decided.length}`
                }
              />
              <Stat label="Settled" value={`${settled}`} />
              <Stat label="Billed" value={money(billed)} />
              <Stat
                label="Their costs"
                value={money(costs)}
                tone={costs > 0 ? "bad" : undefined}
              />
            </dl>

            <ul className="mt-3 space-y-1.5">
              {record.slice(0, 10).map((v, i) => {
                const k = CASE_BY_ID.get(v.kind);
                return (
                  <li
                    key={`${v.caseId}-${i}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded border border-rule-soft px-3 py-2 text-xs"
                  >
                    <span className="text-ink">
                      {k?.label}
                      {v.week ? (
                        <span className="num text-ink-faint"> · wk {v.week}</span>
                      ) : null}
                    </span>
                    <span
                      className={
                        v.settled
                          ? "text-ink-soft"
                          : v.won
                            ? "text-good"
                            : "text-alarm"
                      }
                    >
                      {v.settled
                        ? `Settled · ${money(v.fee)}`
                        : v.won
                          ? `Won at ${Math.round(v.odds * 100)}% · ${money(v.fee)}${v.billed ? " billed" : ""}`
                          : `Lost at ${Math.round(v.odds * 100)}%${(v.costs ?? 0) > 0 ? ` · ${money(v.costs ?? 0)} of their costs` : ""}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
