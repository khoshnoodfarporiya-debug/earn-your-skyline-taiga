"use client";

import type { RunState } from "@/lib/game/types";
import {
  CRISIS_LABEL,
  severityWord,
  stageOf,
  type ActiveCrisis,
} from "@/lib/game/crisis";
import { money } from "@/lib/game/format";
import {
  crisisCostIn,
  crisisGuideFor,
  crisisProgress,
} from "@/lib/ui/pressure";
import { MedIcon } from "../visuals/MedIcon";
import { Panel } from "../ui/Panel";
import { ActionButton } from "../ui/ItemCard";

/**
 * A CRISIS, OPEN
 *
 * Rendered inline on the Overview rather than behind a tab, because a crisis
 * is the thing that most needs attention and a system that requires the player
 * to go looking for it is a system they will ignore until it escalates.
 *
 * Each stage shows the situation and the choices with their real costs. One
 * choice per stage — taken options disappear rather than greying out, because
 * a stage is a decision you made, not a menu you return to.
 */
export function CrisisPanel({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const crises = state.crises ?? [];
  if (crises.length === 0) return null;

  return (
    <div className="space-y-4">
      {crises.map((c) => (
        <CrisisCard key={c.id} crisis={c} state={state} dispatch={dispatch} />
      ))}
    </div>
  );
}

function CrisisCard({
  crisis,
  state,
  dispatch,
}: {
  crisis: ActiveCrisis;
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const stage = stageOf(crisis);
  const open = stage.choices.filter((c) => !crisis.taken.includes(c.id));
  const weeks = state.week - crisis.startedWeek;
  /* Both the explanation and the stage count belong to whoever is having the
     crisis: a solicitor's client-account audit is not a doctor's inspection,
     and a career's set may not even be the same length. */
  const guide = crisisGuideFor(state.careerId, crisis.kind);
  const progress = crisisProgress(
    crisis.kind,
    crisis.stage,
    crisis.ignored,
    crisis.career ?? state.careerId,
  );

  return (
    <section
      className="spine form overflow-hidden"
      style={{
        ["--dept" as string]: crisis.severity >= 60 ? "#EF6461" : "#F59E55",
      }}
    >
      <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
        <h3 className="t-label flex items-center gap-2 text-alarm">
          <MedIcon name={guide.icon} className="h-4 w-4" />
          {CRISIS_LABEL[crisis.kind]}
        </h3>
        <span className="num text-[12px] text-ink-soft">
          {severityWord(crisis.severity)} · week {weeks} of it
        </span>
      </div>

      {/*
       * Which beat this is, drawn as a rail.
       *
       * A crisis is a sequence, and knowing you are on the second of three
       * changes what a choice is worth — the cheap option at stage one is
       * often unavailable at stage three. The rail is the only thing on the
       * card that says the sequence exists.
       */}
      <div className="px-5 pt-3">
        <ol className="flex gap-1" aria-label="Crisis stages">
          {Array.from({ length: progress.stagesTotal }).map((_, i) => (
            <li
              key={i}
              aria-current={i === crisis.stage ? "step" : undefined}
              className={`h-1.5 flex-1 rounded-full ${
                i < crisis.stage
                  ? "bg-alarm/45"
                  : i === crisis.stage
                    ? "bg-alarm"
                    : "bg-paper"
              }`}
            />
          ))}
        </ol>
        <p className="t-label mt-1 text-ink-faint">
          Stage {progress.stage} of {progress.stagesTotal}
        </p>
      </div>

      <div className="px-5 py-2.5">
        <div
          className="well h-1.5 overflow-hidden p-0"
          role="meter"
          aria-valuenow={Math.round(crisis.severity)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${CRISIS_LABEL[crisis.kind]} severity`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${
              crisis.severity >= 60 ? "bg-alarm" : "bg-caution"
            }`}
            style={{ width: `${crisis.severity}%` }}
          />
        </div>
        {crisis.ignored >= 1 && (
          <p className="num mt-2 text-[12px] text-alarm">
            Not acted on for {crisis.ignored} week
            {crisis.ignored === 1 ? "" : "s"}.
            {progress.weeksToEscalation > 0
              ? ` ${progress.weeksToEscalation} more and it jumps to the last stage.`
              : progress.weeksToBurnout > 0
                ? ` ${progress.weeksToBurnout} more and it resolves itself, badly.`
                : " It is about to resolve itself, badly."}
          </p>
        )}
      </div>

      {/* Where it came from, what makes it worse, and who is feeling it —
          the three questions a severity bar cannot answer. */}
      <dl className="grid gap-x-6 gap-y-2 border-y border-rule-soft bg-paper px-5 py-3 sm:grid-cols-3">
        <div>
          <dt className="t-label text-ink-faint">What caused it</dt>
          <dd className="mt-0.5 text-[12px] leading-snug text-ink-soft">
            {guide.cause}
          </dd>
        </div>
        <div>
          <dt className="t-label text-ink-faint">What makes it worse</dt>
          <dd className="mt-0.5 text-[12px] leading-snug text-ink-soft">
            {guide.worsens}
          </dd>
        </div>
        <div>
          <dt className="t-label text-ink-faint">Who it affects</dt>
          <dd className="mt-0.5 text-[12px] leading-snug text-ink-soft">
            {guide.affects}
          </dd>
        </div>
      </dl>

      <div className="px-5 pb-4">
        <h4 className="t-card text-ink">{stage.title}</h4>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
          {stage.body}
        </p>

        {open.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-soft">
            You have done what you can this week. It will move on its own.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {open.map((choice) => {
              /* What it costs *here*. Authored in London money and localised
                 by the same function the command charges through, so the
                 figure on the button is the figure the engine takes. */
              const cost = crisisCostIn(state, choice.cost ?? 0);
              const unaffordable = cost > 0 && state.r.cash < cost;
              return (
                <div
                  key={choice.id}
                  className="rounded-form bg-card-high px-4 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[14px] font-semibold text-ink">
                      {choice.label}
                    </p>
                    {cost > 0 ? (
                      <p
                        className={`num text-[13px] ${
                          unaffordable ? "text-alarm" : "text-ink"
                        }`}
                      >
                        {money(cost)}
                      </p>
                    ) : null}
                  </div>
                  <p className="num mt-0.5 text-[12.5px] text-ink-soft">
                    {choice.detail}
                    {choice.blocks
                      ? ` · costs ${choice.blocks} block${choice.blocks === 1 ? "" : "s"} next week`
                      : ""}
                    {choice.debt
                      ? ` · adds ${money(crisisCostIn(state, choice.debt))} of borrowing`
                      : ""}
                  </p>
                  <div className="mt-2.5">
                    <ActionButton
                      onClick={() =>
                        dispatch("crisisChoice", `${crisis.id}:${choice.id}`)
                      }
                      disabled={unaffordable}
                    >
                      Do this
                    </ActionButton>
                    {unaffordable && (
                      <span className="ml-2.5 text-[12px] text-ink-faint">
                        Costs {money(cost)} and you have {money(state.r.cash)}.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/** The compact form, for the Overview's alert stack. */
export function CrisisSummary({ state }: { state: RunState }) {
  const crises = state.crises ?? [];
  if (crises.length === 0) return null;
  return (
    <Panel title="Open crises" aside={`${crises.length}`} flush>
      <ul className="divide-y divide-rule-soft">
        {crises.map((c) => (
          <li key={c.id} className="flex items-baseline gap-3 px-5 py-2.5">
            <span className="num w-24 shrink-0 text-[12.5px] text-alarm">
              {CRISIS_LABEL[c.kind]}
            </span>
            <span className="min-w-0 flex-1 text-[13px] text-ink-soft">
              {stageOf(c).title}
            </span>
            <span className="num shrink-0 text-[12px] text-ink-faint">
              {severityWord(c.severity)}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
