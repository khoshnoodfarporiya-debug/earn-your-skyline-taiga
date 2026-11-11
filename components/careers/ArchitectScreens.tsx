"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { screenOf, type ScreenId } from "@/lib/ui/navigation";
import { studio } from "@/lib/game/careers/architect";
import {
  KIND_BY_ID,
  PROJECT_KINDS,
  STAGES,
  STUDIO_ROLES,
  STUDIO_ROLE_BY_ID,
  competitionOdds,
  entryFee,
  feeFor,
  overallProgress,
  revisionRisk,
  rolePayStudio,
  stageOf,
  stageProgress,
  studioCityOf,
  studioWages,
  workOnTheBoards,
  BRIEFS,
  MATERIALS,
  MATERIAL_BY_ID,
  budgetLoad,
  consentCost,
  overBudget,
  stageWeeksOf,
  type BriefEmphasis,
} from "@/lib/game/careers/studio";
import { CareerSceneBanner } from "./CareerSceneBanner";

/**
 * THE ARCHITECT'S SCREENS
 *
 * A commission is a thing you have to be able to see the *shape* of: which
 * stage it is in, how much of the fee is already yours, and how likely the
 * client is to send it backwards this week. All three are on every card,
 * because the decision the career is about — draw, or go and see them — is
 * unanswerable without the third one.
 *
 * That is per-commission and stays on the commission, so the split costs it
 * nothing. What every other screen needs is the practice-wide version of the
 * same question — how much fee is unearned and how much has already been
 * redrawn — so `BoardsStrip` carries it everywhere but the boards themselves.
 */
export function ArchitectScreens({
  screen,
  state,
  onCommand,
}: {
  screen: ScreenId;
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  if (state.careerId !== "architect") return null;

  const body =
    screen === "boards" ? (
      <BoardsScreen state={state} onCommand={onCommand} />
    ) : screen === "offers" ? (
      <OffersScreen state={state} onCommand={onCommand} />
    ) : screen === "competitions" ? (
      <CompetitionsScreen state={state} onCommand={onCommand} />
    ) : screen === "atelier" ? (
      <StudioScreen state={state} onCommand={onCommand} />
    ) : null;

  if (!body) return null;

  const def = screenOf(screen);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-[19px] leading-tight text-ink">{def.label}</h1>
        <p className="mt-0.5 text-xs text-ink-faint">{def.purpose}</p>
      </div>
      <CareerSceneBanner career="architect" screen={screen} />
      {screen !== "boards" && <BoardsStrip state={state} />}
      {body}
    </div>
  );
}

/**
 * What is unearned, and what has already been sent back.
 *
 * The career is paid in stages and the risk is being made to draw one twice,
 * so those are the two figures every other decision is taken against — hiring
 * somebody, entering a competition, or accepting more work.
 */
function BoardsStrip({ state }: { state: RunState }) {
  const a = studio(state);
  const live = a.commissions.filter((c) => !c.done);
  const redrawn = a.commissions.reduce((n, c) => n + c.revisions, 0);

  return (
    <dl
      aria-label="On the boards"
      className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-rule bg-card p-3 sm:grid-cols-4"
    >
      <Stat label="On the boards" value={String(live.length)} />
      <Stat label="Fee still to earn" value={money(workOnTheBoards(a))} />
      <Stat
        label="Redrawn"
        value={redrawn === 0 ? "Never" : `${redrawn}×`}
        tone={redrawn > 0 ? "bad" : undefined}
      />
      <Stat label="Studio" value={`${money(studioWages(a))}/wk`} />
    </dl>
  );
}

/** The live commissions, and everything already finished. */
function BoardsScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const a = studio(state);
  const city = studioCityOf(a);
  const live = a.commissions.filter((c) => !c.done);
  const built = a.commissions.filter((c) => c.done);

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- on the boards */}
      <section
        aria-labelledby="boards-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="boards-h" className="text-sm font-semibold text-ink">
          On the boards in {city.name}
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          {money(workOnTheBoards(a))} of fee still to earn. Every stage you
          finish is banked for good — and every client who has not seen you can
          send the building back a stage.
        </p>

        {live.length === 0 ? (
          <p className="mt-3 rounded border border-dashed border-rule px-3 py-4 text-center text-xs text-ink-faint">
            Nothing on the boards. Court work until somebody offers you
            something.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {live.map((c) => {
              const kind = KIND_BY_ID.get(c.kind);
              const stage = stageOf(c);
              const risk = revisionRisk(a, c, state.week);
              const need = kind ? stageWeeksOf(c, kind, stage) : 0;
              const focused = (a.focus ?? live[0]?.id) === c.id;
              const seen = Math.max(0, state.week - c.lastSeen);
              return (
                <li
                  key={c.id}
                  className={`rounded border p-3 text-xs ${
                    focused ? "border-clinical bg-clinical-tint" : "border-rule-soft"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">{kind?.label}</span>
                    <span className="num text-ink-faint">
                      {money(c.paid)} of {kind ? money(feeFor(a, kind)) : "—"}{" "}
                      banked
                    </span>
                  </div>
                  <p className="text-ink-faint">for {c.client}</p>

                  {/* Which stage, and how far through it. */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="sign shrink-0 text-[10.5px] text-ink-faint">
                      {stage.label}
                    </span>
                    <span
                      role="meter"
                      aria-valuenow={Math.round(stageProgress(c) * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${stage.label} progress`}
                      className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-rule-soft"
                    >
                      <span
                        className="block h-full rounded-full bg-clinical transition-[width] duration-500"
                        style={{
                          width: `${Math.max(2, stageProgress(c) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="num shrink-0 text-[11.5px] text-ink-soft">
                      {c.progress.toFixed(1)}/{need}
                    </span>
                  </div>

                  {/* The five stages, so being sent back is legible. */}
                  <ol className="mt-2 flex gap-1" aria-label="Stages">
                    {STAGES.map((st, i) => (
                      <li
                        key={st.id}
                        title={st.label}
                        className={`h-1 flex-1 rounded-full ${
                          i < c.stage
                            ? "bg-good"
                            : i === c.stage
                              ? "bg-clinical"
                              : "bg-rule-soft"
                        }`}
                      />
                    ))}
                  </ol>

                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className={
                        risk > 0.2
                          ? "text-alarm"
                          : risk > 0.08
                            ? "text-caution"
                            : "text-good"
                      }
                    >
                      {(risk * 100).toFixed(0)}% chance they change the brief
                    </span>
                    <span className="text-ink-faint">
                      Last seen {seen === 0 ? "this week" : `${seen} weeks ago`}
                    </span>
                    {c.revisions > 0 && (
                      <span className="text-caution">
                        Redrawn {c.revisions}×
                      </span>
                    )}
                    <span className="text-ink-faint">
                      {Math.round(overallProgress(a, c) * 100)}% of the fee
                      earned
                    </span>
                  </p>

                  {/* ---------------------- the decisions, in one strip */}
                  {/* Brief, palette, consent and the cost plan on a single
                      wrapping line: a decided item is a chip with its story
                      in the tooltip, an open one is a tiny inline chooser,
                      and a card from an older save shows none of it. */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-rule-soft pt-2">
                    <span className="flex items-center gap-1.5">
                      <span className="sign text-[10px] text-ink-faint">
                        Brief:
                      </span>
                      {c.brief ? (
                        <span
                          title={BRIEFS[c.brief].blurb}
                          className="rounded border border-rule-soft bg-paper px-1.5 py-0.5 text-ink"
                        >
                          {BRIEFS[c.brief].label}
                        </span>
                      ) : c.stage <= 1 ? (
                        (Object.keys(BRIEFS) as BriefEmphasis[]).map((b) => (
                          <button
                            key={b}
                            type="button"
                            title={BRIEFS[b].blurb}
                            onClick={() => onCommand("setBrief", `${c.id}:${b}`)}
                            className="rounded border border-rule px-1.5 py-0.5 text-ink hover:border-clinical hover:text-clinical"
                          >
                            {BRIEFS[b].label}
                          </button>
                        ))
                      ) : (
                        <span
                          title="Past design, the brief stays loose."
                          className="text-ink-faint"
                        >
                          never pinned down
                        </span>
                      )}
                    </span>

                    {(c.material || c.stage <= 2) && (
                      <span className="flex items-center gap-1.5">
                        <span className="sign text-[10px] text-ink-faint">
                          Palette:
                        </span>
                        {c.material ? (
                          <span
                            title={MATERIAL_BY_ID.get(c.material)?.blurb}
                            className="rounded border border-rule-soft bg-paper px-1.5 py-0.5 text-ink"
                          >
                            {MATERIAL_BY_ID.get(c.material)?.label}
                            {city.lowCarbon &&
                              (MATERIAL_BY_ID.get(c.material)?.carbon ?? 1) <=
                                0.6 && (
                                <span
                                  title={`${city.name} prices embodied carbon.`}
                                  className="text-good"
                                >
                                  {" "}
                                  · reads well here
                                </span>
                              )}
                          </span>
                        ) : (
                          MATERIALS.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              title={m.blurb}
                              onClick={() =>
                                onCommand("chooseMaterial", `${c.id}:${m.id}`)
                              }
                              className="rounded border border-rule px-1.5 py-0.5 text-ink hover:border-clinical hover:text-clinical"
                            >
                              {m.label}
                            </button>
                          ))
                        )}
                      </span>
                    )}

                    {c.consent === "granted" ? (
                      <span
                        title="The revision maths is halved for good."
                        className="text-good"
                      >
                        Consented
                      </span>
                    ) : c.consent === "lodged" ? (
                      <span className="text-ink-soft">
                        {c.consentDelayed
                          ? "At committee — objections heard"
                          : "At committee"}
                      </span>
                    ) : c.stage <= 1 && kind ? (
                      <button
                        type="button"
                        title="A consented scheme is far harder to reinvent."
                        onClick={() => onCommand("lodgeConsent", c.id)}
                        disabled={state.r.cash < consentCost(a, kind)}
                        className="rounded border border-rule px-1.5 py-0.5 text-ink transition hover:border-clinical hover:text-clinical disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Lodge planning — {money(consentCost(a, kind))}
                      </button>
                    ) : null}

                    {(c.brief || c.material) && (
                      <span className="flex items-center gap-1.5">
                        <span className="sign text-[10px] text-ink-faint">
                          Cost plan:
                        </span>
                        <span
                          title={
                            overBudget(c)
                              ? "The tender will fight unless it is value-engineered."
                              : "What the choices add up to against the client's budget."
                          }
                          className={
                            overBudget(c)
                              ? "text-alarm"
                              : budgetLoad(c) < -0.05
                                ? "text-good"
                                : "text-ink-faint"
                          }
                        >
                          {overBudget(c)
                            ? c.valueEngineered
                              ? "back inside the budget"
                              : "over budget"
                            : budgetLoad(c) < -0.05
                              ? "comfortable"
                              : "on budget"}
                        </span>
                        {overBudget(c) &&
                          !c.valueEngineered &&
                          c.stage >= 2 && (
                            <button
                              type="button"
                              onClick={() => onCommand("valueEngineer", c.id)}
                              className="rounded border border-rule px-1.5 py-0.5 text-ink hover:border-clinical hover:text-clinical"
                            >
                              Value-engineer it
                            </button>
                          )}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {!focused && (
                      <button
                        type="button"
                        onClick={() => onCommand("focusCommission", c.id)}
                        className="rounded border border-rule px-2.5 py-1 text-ink hover:border-clinical"
                      >
                        Put this on the board
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCommand("resignCommission", c.id)}
                      className="rounded border border-rule-soft px-2.5 py-1 text-ink-faint hover:border-alarm hover:text-alarm"
                    >
                      Resign the job
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------ the portfolio */}
      {built.length > 0 && (
        <section
          aria-labelledby="built-h"
          className="rounded-lg border border-rule bg-card p-4"
        >
          <h2 id="built-h" className="text-sm font-semibold text-ink">
            Built
          </h2>
          <ul className="mt-2 space-y-1">
            {built.map((c) => {
              const kind = KIND_BY_ID.get(c.kind);
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 text-xs"
                >
                  <span className="text-ink">{kind?.label}</span>
                  <span className="text-ink-faint">
                    {c.client} · {money(c.paid)}
                    {c.revisions > 0 ? ` · redrawn ${c.revisions}×` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/** What you are being asked for, which depends on what you have built. */
function OffersScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const a = studio(state);

  return (
    <section
      aria-labelledby="offers-h"
      className="rounded-lg border border-rule bg-card p-4"
    >
      <h2 id="offers-h" className="text-sm font-semibold text-ink">
        Offered to you
      </h2>
      <p className="mt-1 text-xs text-ink-faint">
        What a practice is asked for depends on what it has already built.
        Offers left on the table go elsewhere.
      </p>
      {a.offers.length === 0 ? (
        <p className="mt-3 rounded border border-dashed border-rule px-3 py-4 text-center text-xs text-ink-faint">
          Nothing offered. Spend a week courting work.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {a.offers.map((o) => {
            const kind = KIND_BY_ID.get(o.kind);
            return (
              <li
                key={o.id}
                className="rounded border border-rule-soft px-3 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-ink">{kind?.label}</span>
                  <span className="num text-ink-faint">
                    {kind ? money(feeFor(a, kind)) : ""}
                  </span>
                </div>
                <p className="text-ink-faint">
                  {o.client} · {kind?.blurb}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onCommand("takeCommission", o.id)}
                    className="rounded border border-rule px-2.5 py-1 text-ink hover:border-clinical"
                  >
                    Take it on
                  </button>
                  <button
                    type="button"
                    onClick={() => onCommand("declineCommission", o.id)}
                    className="rounded border border-rule-soft px-2.5 py-1 text-ink-faint hover:border-alarm hover:text-alarm"
                  >
                    Turn it down
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Months of unpaid work, and the only route to the buildings that matter. */
function CompetitionsScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const a = studio(state);

  return (
    <section
      aria-labelledby="comp-h"
      className="rounded-lg border border-rule bg-card p-4"
    >
      <h2 id="comp-h" className="text-sm font-semibold text-ink">
        Competitions
      </h2>
      {a.competition ? (
        <>
          <p className="mt-1 text-xs text-ink-faint">
            {KIND_BY_ID.get(a.competition.kind)?.label}, judged in week{" "}
            {a.competition.judgedWeek}, against {a.competition.entrants}{" "}
            practices. Unpaid until it is won, and usually not then.
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="sign shrink-0 text-[10.5px] text-ink-faint">
              Odds
            </span>
            <span
              role="meter"
              aria-valuenow={Math.round(
                competitionOdds(a.competition, state.r.reputation) * 100,
              )}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Chance of winning the competition"
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-rule-soft"
            >
              <span
                className="block h-full rounded-full bg-gold transition-[width] duration-500"
                style={{
                  width: `${Math.max(
                    2,
                    competitionOdds(a.competition, state.r.reputation) * 100,
                  )}%`,
                }}
              />
            </span>
            <span className="num shrink-0 text-ink-soft">
              {Math.round(
                competitionOdds(a.competition, state.r.reputation) * 100,
              )}
              %
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {a.competition.effort.toFixed(1)} weeks of drawing in. More work
            is better odds.
          </p>
          <button
            type="button"
            onClick={() => onCommand("withdrawCompetition", "")}
            className="mt-2 rounded border border-rule-soft px-2.5 py-1 text-xs text-ink-faint hover:border-alarm hover:text-alarm"
          >
            Withdraw
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-ink-faint">
            Months of unpaid work for a building nobody has promised you. It
            is also the only way a museum is ever yours.
          </p>
          <ul className="mt-3 grid gap-1.5">
            {PROJECT_KINDS.filter((k) => k.prestige >= 9).map((k) => {
              const cost = entryFee(a, k);
              const tooDear = state.r.cash < cost;
              return (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-rule-soft px-3 py-2 text-xs"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">
                      {k.label}
                    </span>
                    <span className="block text-ink-faint">
                      {money(feeFor(a, k))} of work · entry {money(cost)}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={tooDear}
                    onClick={() => onCommand("enterCompetition", k.id)}
                    className="shrink-0 rounded border border-rule px-2.5 py-1 text-ink enabled:hover:border-clinical disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Enter
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** Who draws, and the one hire that is really about the clients. */
function StudioScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const a = studio(state);

  return (
    <section
      aria-labelledby="studio-h"
      className="rounded-lg border border-rule bg-card p-4"
    >
      <h2 id="studio-h" className="text-sm font-semibold text-ink">
        The studio
      </h2>
      <p className="mt-1 text-xs text-ink-faint">
        {a.team.length === 0
          ? "Just you and a board. Everything drawn this week, you drew."
          : `${a.team.length} in the studio, ${money(studioWages(a))} a week. They draw whatever is on the board.`}
      </p>

      {a.team.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {a.team.map((h) => (
            <li
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-rule-soft px-3 py-2 text-xs"
            >
              <span>
                <span className="font-medium text-ink">{h.name}</span>
                <span className="text-ink-faint">
                  {" "}
                  · {STUDIO_ROLE_BY_ID.get(h.role)?.label}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="num text-ink-faint">
                  {money(h.salary)}/wk
                </span>
                <button
                  type="button"
                  onClick={() => onCommand("letGoStudio", h.id)}
                  className="rounded border border-rule-soft px-2 py-0.5 text-ink-faint hover:border-alarm hover:text-alarm"
                >
                  Let go
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ul className="mt-3 grid gap-1.5 border-t border-rule-soft pt-3">
        {STUDIO_ROLES.map((r) => {
          const { salary, hireCost } = rolePayStudio(a, r);
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
                  onClick={() => onCommand("hireStudio", r.id)}
                  className="rounded-form border border-rule px-3 py-1.5 text-ink enabled:hover:border-clinical disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Take them on
                </button>
                <span className="text-ink-faint">
                  {tooDear
                    ? `Costs ${money(hireCost)} and you have ${money(state.r.cash)}.`
                    : r.id === "associate"
                      ? "Sees clients for you, which cuts every brief-change risk."
                      : `Draws ${r.output} week${r.output === 1 ? "" : "s"} a week, on whatever is on the board.`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
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
