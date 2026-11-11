"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { screenOf, type ScreenId } from "@/lib/ui/navigation";
import { venture } from "@/lib/game/careers/founder";
import {
  ROUNDS,
  ROUND_BY_ID,
  STARTUP_ROLES,
  STARTUP_ROLE_BY_ID,
  burnOf,
  churnRate,
  defaultAlive,
  dilutionFor,
  organicUsers,
  payroll,
  revenueOf,
  roundAmount,
  roundBlocker,
  rolePrice,
  runwayLabel,
  runwayOf,
  stakeOf,
  startupCityOf,
  valuationOf,
  EXPERIMENTS,
  STANCES,
  buildLiftOf,
  experimentCost,
  experimentsOf,
  funnelOf,
  insightOf,
  stanceOf,
  techDebtOf,
  unitEconomicsOf,
  type RoadmapStance,
} from "@/lib/game/careers/startup";
import { CareerSceneBanner } from "./CareerSceneBanner";

/**
 * THE FOUNDER'S SCREENS
 *
 * This was one scrolling page, and the note that stood here defended it: the
 * career has exactly one question in it — how many weeks are left, and what
 * are you spending them on — and splitting that across tabs would hide the
 * arithmetic that makes each option a decision.
 *
 * The arithmetic survived the split, because it was never in the summary. What
 * makes a hire a decision is the line under the hire reading "costs you about
 * three weeks of runway", and that is computed per-option, next to the option.
 * What would have been lost is the clock itself — so every screen outside
 * Runway opens with `RunwayStrip`, and none of them can be read without it.
 *
 * Nothing here decides anything: every figure comes from a pure function in
 * `startup.ts`, and every control dispatches a command the engine already had.
 */
export function FounderScreens({
  screen,
  state,
  onCommand,
}: {
  screen: ScreenId;
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  if (state.careerId !== "founder") return null;

  const body =
    screen === "runway" ? (
      <RunwayScreen state={state} onCommand={onCommand} />
    ) : screen === "product" ? (
      <ProductScreen state={state} onCommand={onCommand} />
    ) : screen === "crew" ? (
      <TeamScreen state={state} onCommand={onCommand} />
    ) : screen === "raising" ? (
      <RaisingScreen state={state} onCommand={onCommand} />
    ) : null;

  if (!body) return null;

  const def = screenOf(screen);
  return (
    <div className="space-y-6">
      {/* The Physician's ScreenHeader reads medical state, which is null for a
          founder, so this career states where it is itself — the same reason
          the Chef's screens and the Solicitor's do. */}
      <div>
        <h1 className="display text-[19px] leading-tight text-ink">{def.label}</h1>
        <p className="mt-0.5 text-xs text-ink-faint">{def.purpose}</p>
      </div>
      <CareerSceneBanner career="founder" screen={screen} />
      {/* The clock, everywhere it is not already the subject. */}
      {screen !== "runway" && <RunwayStrip state={state} />}
      {body}
    </div>
  );
}

/**
 * The clock, in one line.
 *
 * Deliberately the same figures as the Runway screen's summary, in the same
 * order, so moving between screens does not mean re-finding them.
 */
function RunwayStrip({ state }: { state: RunState }) {
  const v = venture(state);
  const burn = burnOf(v);
  const revenue = revenueOf(v);
  const weeks = runwayOf(state.r.cash, v);
  const alive = defaultAlive(v);

  return (
    <dl
      aria-label="Runway"
      className={`grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border p-3 sm:grid-cols-4 ${
        alive
          ? "border-good/50 bg-good-tint"
          : weeks < 6
            ? "border-alarm/50 bg-alarm-tint"
            : "border-rule bg-card"
      }`}
    >
      <Stat
        label="Runway"
        value={runwayLabel(state.r.cash, v)}
        tone={alive ? "good" : weeks < 6 ? "bad" : undefined}
      />
      <Stat label="Burn" value={`${money(burn)}/wk`} tone="bad" />
      <Stat
        label="Revenue"
        value={`${money(revenue)}/wk`}
        tone={revenue > 0 ? "good" : undefined}
      />
      <Stat label="You own" value={`${v.equity.toFixed(1)}%`} />
    </dl>
  );
}

/** The clock, and the two flows that move it. */
function RunwayScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const v = venture(state);
  const burn = burnOf(v);
  const revenue = revenueOf(v);
  const weeks = runwayOf(state.r.cash, v);
  const alive = defaultAlive(v);
  const churn = churnRate(v);
  const organic = organicUsers(v);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- the clock */}
      <section
        aria-labelledby="runway-h"
        className={`rounded-lg border p-4 ${
          alive
            ? "border-good/50 bg-good-tint"
            : weeks < 6
              ? "border-alarm/50 bg-alarm-tint"
              : "border-rule bg-card"
        }`}
      >
        <h2 id="runway-h" className="text-sm font-semibold text-ink">
          Runway
        </h2>
        <p
          className={`num mt-1 text-3xl leading-none ${
            alive ? "text-good" : weeks < 6 ? "text-alarm" : "text-ink"
          }`}
        >
          {runwayLabel(state.r.cash, v)}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          {alive
            ? "Revenue covers burn. Nothing is running out any more — this is what the whole run was for."
            : `${money(burn)} goes out a week and ${money(revenue)} comes in, so ${money(burn - revenue)} of your ${money(state.r.cash)} disappears every Monday.`}
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-rule-soft pt-3 sm:grid-cols-4">
          <Stat label="Burn" value={`${money(burn)}/wk`} tone="bad" />
          <Stat
            label="Revenue"
            value={`${money(revenue)}/wk`}
            tone={revenue > 0 ? "good" : undefined}
          />
          <Stat label="Customers" value={Math.round(v.users).toLocaleString("en-US")} />
          <Stat label="You own" value={`${v.equity.toFixed(1)}%`} />
        </dl>
      </section>

      {/* --------------------------------------------------- who comes and goes */}
      <section
        aria-labelledby="growth-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="growth-h" className="text-sm font-semibold text-ink">
          Where the customers come from
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Selling wins people this week. Building keeps the ones you have, which
          is the only thing that compounds.
        </p>

        <ul className="mt-3 space-y-2 text-xs">
          <Flow
            label="Arrive on their own"
            value={organic >= 1 ? `+${Math.round(organic)}` : "Nobody yet"}
            note={
              organic >= 1
                ? `Brand is at ${Math.round(v.brand)} and decays 6% a week.`
                : `Brand is only at ${Math.round(v.brand)}. Marketing is what turns it into arrivals.`
            }
            tone="good"
          />
          <Flow
            label="Leave"
            value={
              v.users * churn >= 1
                ? `−${Math.round(v.users * churn)}`
                : "Nobody to lose"
            }
            note={`${(churn * 100).toFixed(1)}% a week. Falls as the product improves.`}
            tone="bad"
          />
        </ul>

        <div className="mt-3 border-t border-rule-soft pt-3">
          <div className="flex items-center gap-2">
            <span className="sign shrink-0 text-[10.5px] text-ink-faint">
              Product
            </span>
            <span
              role="meter"
              aria-valuenow={Math.round(v.product)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="How finished the product is"
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-rule-soft"
            >
              <span
                className="block h-full rounded-full bg-clinical transition-[width] duration-500"
                style={{ width: `${Math.max(2, Math.min(100, v.product))}%` }}
              />
            </span>
            <span className="num shrink-0 text-[11.5px] text-ink-soft">
              {Math.round(v.product)}
            </span>
          </div>

          {/* Price is a real lever and a real risk: put it up and the least
              committed leave on the spot. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-soft">
              {money(v.price)} per customer, per month
            </span>
            <button
              type="button"
              onClick={() => onCommand("setPrice", String(v.price + 4))}
              className="rounded-form border border-rule px-2.5 py-1 text-xs text-ink transition hover:border-clinical hover:text-clinical"
            >
              Raise to {money(v.price + 4)}
            </button>
            <button
              type="button"
              disabled={v.price <= 4}
              onClick={() => onCommand("setPrice", String(Math.max(4, v.price - 4)))}
              className="rounded-form border border-rule px-2.5 py-1 text-xs text-ink transition enabled:hover:border-clinical enabled:hover:text-clinical disabled:cursor-not-allowed disabled:opacity-45"
            >
              Drop to {money(Math.max(4, v.price - 4))}
            </button>
            <span className="text-xs text-ink-faint">
              Putting it up loses the least committed straight away.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Who is on the payroll, and what another one would cost in weeks. */
function TeamScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const v = venture(state);
  const weeks = runwayOf(state.r.cash, v);

  return (
    <section
      aria-labelledby="team-h"
      className="rounded-lg border border-rule bg-card p-4"
    >
      <h2 id="team-h" className="text-sm font-semibold text-ink">
        The team
      </h2>
      <p className="mt-1 text-xs text-ink-faint">
        {v.team.length === 0
          ? "Just you. Everything the company does this week, you do."
          : `${v.team.length} on the payroll, ${money(payroll(v))} a week. Every one of them shortens the runway that pays them.`}
      </p>

      {v.team.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {v.team.map((h) => {
            const role = STARTUP_ROLE_BY_ID.get(h.role);
            return (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-rule-soft px-3 py-2 text-xs"
              >
                <span>
                  <span className="font-medium text-ink">{h.name}</span>
                  <span className="text-ink-faint"> · {role?.label}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="num text-ink-faint">
                    {money(h.salary)}/wk
                  </span>
                  <button
                    type="button"
                    onClick={() => onCommand("letGo", h.id)}
                    className="rounded border border-rule-soft px-2 py-0.5 text-ink-faint transition hover:border-alarm hover:text-alarm"
                  >
                    Let go
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <ul className="mt-3 grid gap-1.5 border-t border-rule-soft pt-3">
        {STARTUP_ROLES.map((r) => {
          const { salary, hireCost } = rolePrice(v, r);
          /* The honest cost of a hire is not the fee — it is the weeks. */
          const after = runwayOf(state.r.cash - hireCost, {
            ...v,
            team: [
              ...v.team,
              { id: "x", name: "x", role: r.id, salary, since: 0 },
            ],
          });
          const cost = Number.isFinite(weeks) && Number.isFinite(after)
            ? Math.max(0, Math.floor(weeks) - Math.floor(after))
            : 0;
          const tooDear = state.r.cash < hireCost;
          return (
            <li
              key={r.id}
              className="rounded border border-rule-soft px-3 py-2.5 text-xs"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-ink">{r.label}</span>
                <span className="num text-ink-faint">
                  {money(salary)}/wk · {money(hireCost)} to hire
                </span>
              </div>
              <p className="mt-0.5 text-ink-faint">{r.blurb}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={tooDear}
                  onClick={() => onCommand("hireVenture", r.id)}
                  className="rounded-form border border-rule px-3 py-1.5 text-ink transition enabled:hover:border-clinical enabled:hover:text-clinical disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Take them on
                </button>
                <span className="text-ink-faint">
                  {tooDear
                    ? `Costs ${money(hireCost)} and you have ${money(state.r.cash)}.`
                    : Number.isFinite(weeks) && cost > 0
                      ? `Costs you about ${cost} week${cost === 1 ? "" : "s"} of runway.`
                      : "Adds to the burn every week from now on."}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** What a round buys, and the share of the company it costs for good. */
function RaisingScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const v = venture(state);
  const city = startupCityOf(v);

  return (
    <section
      aria-labelledby="raise-h"
      className="rounded-lg border border-rule bg-card p-4"
    >
      <h2 id="raise-h" className="text-sm font-semibold text-ink">
        Raising
      </h2>
      <p className="mt-1 text-xs text-ink-faint">
        {valuationOf(v) > 0
          ? `The company is worth about ${money(valuationOf(v))}, and your share of it ${money(stakeOf(v))}.`
          : "Nothing has put a price on the company yet — the first round is what does that."}{" "}
        Money buys weeks; it costs a piece of that share, permanently.
      </p>

      {v.pitchRound ? (
        <RaiseInProgress state={state} onCommand={onCommand} />
      ) : (
        <ul className="mt-3 space-y-2">
          {ROUNDS.map((r) => {
            const blocked = roundBlocker(v, r);
            return (
              <li
                key={r.id}
                className="rounded border border-rule-soft px-3 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-ink">{r.label}</span>
                  <span className="num text-ink-faint">
                    {money(roundAmount(v, r))} for about {dilutionFor(v, r)}%
                  </span>
                </div>
                <p className="mt-0.5 text-ink-faint">{r.blurb}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={blocked !== null}
                    onClick={() => onCommand("startRaise", r.id)}
                    className="rounded-form border border-rule px-3 py-1.5 text-ink transition enabled:hover:border-clinical enabled:hover:text-clinical disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Go out and raise it
                  </button>
                  <span className="text-ink-faint">
                    {blocked ??
                      `About ${r.effort} weeks of pitching in ${city.name}.`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The round you are currently out raising. */
function RaiseInProgress({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const v = venture(state);
  const round = v.pitchRound ? ROUND_BY_ID.get(v.pitchRound) : undefined;
  if (!round) return null;
  const dilution = dilutionFor(v, round);
  const blocked = roundBlocker(v, round);

  return (
    <div className="mt-3 rounded border border-clinical/40 bg-clinical-tint px-3 py-3 text-xs">
      <p className="font-medium text-ink">Out raising the {round.label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span
          role="meter"
          aria-valuenow={Math.round(v.pitch)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress toward the ${round.label}`}
          className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-rule-soft"
        >
          <span
            className="block h-full rounded-full bg-clinical transition-[width] duration-500"
            style={{ width: `${Math.max(2, Math.min(100, v.pitch))}%` }}
          />
        </span>
        <span className="num shrink-0 text-ink-soft">
          {Math.round(v.pitch)}%
        </span>
      </div>
      <p className="mt-2 text-ink-soft">
        {money(roundAmount(v, round))} when it closes, for {dilution}% of the
        company — you would keep{" "}
        {(v.equity * (1 - dilution / 100)).toFixed(1)}%. Spend blocks on
        pitching to move this.
      </p>
      {blocked && (
        <p className="mt-2 text-caution">
          Careful: {blocked.toLowerCase()} If that is still true when it closes,
          the round falls through in diligence.
        </p>
      )}
      <button
        type="button"
        onClick={() => onCommand("stopRaise", "")}
        className="mt-2 rounded border border-rule-soft px-2.5 py-1 text-ink-faint transition hover:border-alarm hover:text-alarm"
      >
        Stop raising
      </button>
    </div>
  );
}

/**
 * THE PRODUCT SCREEN (Phase 5)
 *
 * The three levers the audit's slice names, in the order a founder actually
 * pulls them: learn what to build (discovery), decide how fast to build it
 * (the roadmap, with the bill it accrues), and test how it is found and
 * bought (the funnel and its experiments). Everything here reads from
 * `startup.ts` and dispatches commands the engine tests already cover.
 */
function ProductScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const v = venture(state);
  const insight = insightOf(v);
  const debt = techDebtOf(v);
  const stance = stanceOf(v);
  const funnel = funnelOf(v);
  const econ = unitEconomicsOf(v);
  const done = experimentsOf(v);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------ the product work */}
      <section aria-labelledby="discovery-h" className="rounded-lg border border-rule bg-card p-4">
        <h2 id="discovery-h" className="sign text-[11.5px] text-ink-faint">
          The product work — what you know, and how fast you build
        </h2>
        <div className="mt-2.5 flex items-center gap-2">
          <span
            role="meter"
            aria-valuenow={Math.round(insight)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Customer insight"
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-rule-soft"
          >
            <span
              className="block h-full rounded-full bg-clinical transition-[width] duration-500"
              style={{ width: `${Math.max(2, Math.min(100, insight))}%` }}
            />
          </span>
          <span className="num shrink-0 text-[11.5px] text-ink-soft">
            {Math.round(insight)}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          {insight < 5
            ? "You are guessing. Spend a block of the week talking to customers and everything you build after lands better."
            : `Building lands at ${Math.round(buildLiftOf(v) * 100)}% of its base rate and ${Math.max(
                0,
                Math.round((funnel.buyRate / 0.24 - 1) * 100),
              )}% more trials convert — and it fades if you stop asking.`}
        </p>
        {/* ------------------------------------- the roadmap, same room */}
        <div className="mt-3 grid gap-2 border-t border-rule-soft pt-3 sm:grid-cols-3">
          {(Object.keys(STANCES) as RoadmapStance[]).map((id) => {
            const def = STANCES[id];
            const active = stance === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                title={def.blurb}
                onClick={() => onCommand("setRoadmap", id)}
                className={`min-h-[40px] rounded-form border px-3 py-1.5 text-center text-[13px] font-semibold transition ${
                  active
                    ? "border-clinical bg-clinical-tint text-clinical"
                    : "border-rule bg-paper text-ink hover:border-clinical/40"
                }`}
              >
                {def.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">
          {STANCES[stance].blurb}
        </p>

        <div className="mt-3 border-t border-rule-soft pt-3">
          <div className="flex items-center gap-2">
            <span className="sign shrink-0 text-[10.5px] text-ink-faint">
              Technical debt
            </span>
            <span
              role="meter"
              aria-valuenow={Math.round(debt)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Technical debt"
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-rule-soft"
            >
              <span
                className={`block h-full rounded-full transition-[width] duration-500 ${
                  debt >= 60 ? "bg-alarm" : debt >= 30 ? "bg-caution" : "bg-clinical"
                }`}
                style={{ width: `${Math.max(2, Math.min(100, debt))}%` }}
              />
            </span>
            <span className="num shrink-0 text-[11.5px] text-ink-soft">
              {Math.round(debt)}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-ink-faint">
            {debt < 1
              ? "Clean. Nothing is compounding against you."
              : `Costing about ${(debt * 0.02).toFixed(1)}% extra churn a week and ${Math.round(debt / 2.5)}% dearer servers. Stability weeks pay it down.`}
          </p>
        </div>
      </section>

      {/* --------------------------------------- the market, one section */}
      <section aria-labelledby="funnel-h" className="rounded-lg border border-rule bg-card p-4">
        <h2 id="funnel-h" className="sign text-[11.5px] text-ink-faint">
          How a stranger becomes a customer, this week
        </h2>
        <dl className="mt-2.5 grid grid-cols-3 gap-x-4 gap-y-2">
          <Stat label="Looked" value={`${Math.round(funnel.visitors)}`} />
          <Stat
            label={`Tried (${Math.round(funnel.trialRate * 100)}%)`}
            value={`${Math.round(funnel.trials)}`}
          />
          <Stat
            label={`Paid (${Math.round(funnel.buyRate * 100)}%)`}
            value={`${Math.round(funnel.gained)}`}
            tone={funnel.gained >= 1 ? "good" : undefined}
          />
        </dl>
        <p className="mt-2.5 border-t border-rule-soft pt-2.5 text-[12.5px] leading-relaxed text-ink-soft">
          A customer stays about {Math.round(econ.weeksRetained)} weeks and is
          worth {money(Math.max(0, Math.round(econ.lifetimeValue)))} over their
          stay, on a margin of {money(Math.max(0, Math.round(econ.weeklyMargin)))}{" "}
          a week each.
        </p>
        {/* ------------------------------- the experiments, same room */}
        <h3
          id="experiments-h"
          className="sign mt-3 border-t border-rule-soft pt-3 text-[11.5px] text-ink-faint"
        >
          Experiments — run once, measured, permanent
        </h3>
        <ul className="mt-2.5 space-y-2.5">
          {EXPERIMENTS.map((def) => {
            const finished = done.find((e) => e.id === def.id);
            const running = v.experimentRun?.id === def.id;
            const cost = experimentCost(v, def);
            const blocked =
              v.experimentRun !== undefined || state.r.cash < cost;
            return (
              <li
                key={def.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-rule-soft pb-2.5 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-ink">
                    {def.label}
                  </p>
                  <p className="text-[12px] leading-snug text-ink-faint">
                    {def.blurb}
                  </p>
                </div>
                {finished ? (
                  <span className="num shrink-0 text-[12.5px] text-good">
                    +{Math.round(finished.lift * 100)}%{" "}
                    {def.stage === "visitors"
                      ? "visits"
                      : def.stage === "trials"
                        ? "trials"
                        : "conversion"}
                  </span>
                ) : running ? (
                  <span className="sign shrink-0 text-[11px] text-ink-soft">
                    reading out…
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCommand("runExperiment", def.id)}
                    disabled={blocked}
                    className="min-h-[40px] shrink-0 rounded-form border border-rule bg-paper px-3 text-[12.5px] font-semibold text-ink transition hover:border-clinical hover:text-clinical disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Run — {money(cost)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {insight < 30 && done.length < EXPERIMENTS.length && (
          <p className="mt-2.5 text-[12px] leading-snug text-ink-faint">
            A test finds more when you know what to test — talk to customers
            first and the same money buys a bigger result.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div>
      <dt className="sign text-[10.5px] leading-none text-ink-faint">{label}</dt>
      <dd
        className={`num mt-1 text-[13.5px] leading-none ${
          tone === "bad"
            ? "text-alarm"
            : tone === "good"
              ? "text-good"
              : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Flow({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "good" | "bad";
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <span className="text-ink">{label}</span>
      <span className={`num ${tone === "good" ? "text-good" : "text-alarm"}`}>
        {value} a week
      </span>
      <span className="w-full text-ink-faint">{note}</span>
    </li>
  );
}
