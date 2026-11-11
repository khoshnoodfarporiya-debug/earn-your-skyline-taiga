"use client";

import type { CareerDef, RunState } from "@/lib/game/types";
import type { Allocation } from "@/lib/game/engine";
import type { Alert } from "@/lib/ui/alerts";
import type { Step } from "@/lib/ui/guidance";
import type { ScreenId } from "@/lib/ui/navigation";
import { money } from "@/lib/game/format";
import { med } from "@/lib/game/careers/doctor";
import { ActionBoard } from "../ActionBoard";
import { Meters } from "../Meters";
import { AlertStack } from "./AlertStack";
import { topAlerts } from "@/lib/ui/alerts";
import { NextStep } from "./NextStep";
import { StatusStrip } from "./StatusStrip";
import { OverviewHero } from "./OverviewHero";
import { QuickPlan } from "./QuickPlan";
import { CommitBar } from "./CommitBar";
import { TrendCard } from "./TrendCard";

/**
 * The screen that answers "what do I do this week?".
 *
 * Order is deliberate and matches urgency: what is on fire, what to do about
 * it, what the goal is, then the week itself, then the commit. Supporting
 * detail (vitals, trend, notes) sits below the fold on mobile and beside the
 * loop on desktop.
 */
/**
 * The running record, in each career's own words.
 *
 * Presentation only: the log itself is engine-level and identical everywhere.
 */
const LOG_HEADING: Record<string, string> = {
  doctor: "Case notes",
  chef: "The service book",
  lawyer: "Attendance notes",
};

export function Overview({
  career,
  state,
  alloc,
  budget,
  spent,
  briefing,
  alerts,
  step,
  onAllocate,
  lastWeek,
  onCommit,
  onNavigate,
  onDismissStep,
  onPayLoan,
}: {
  career: CareerDef;
  state: RunState;
  alloc: Allocation;
  budget: number;
  spent: number;
  briefing: ReturnType<CareerDef["briefing"]>;
  alerts: Alert[];
  step: Step | null;
  onAllocate: (updater: (prev: Allocation) => Allocation) => void;
  /** Last week's committed plan, for the one-tap repeat. */
  lastWeek: Allocation | null;
  onCommit: () => void;
  onNavigate: (screen: ScreenId) => void;
  onDismissStep: (id: string) => void;
  onPayLoan: () => void;
}) {
  const objective = career.objective(state);
  const score = career.scoreboard(state);
  const m = state.careerId === "doctor" ? med(state) : null;
  /**
   * One figure for the sticky bar. A warning outranks everything — if the
   * forecast says something is about to go wrong, that is what should be
   * under your thumb. Otherwise show capacity, which is the number the whole
   * career turns on.
   */
  const headline =
    briefing.find((b) => b.tone === "bad") ??
    briefing.find((b) => /capacity/i.test(b.label)) ??
    briefing[0];

  // Share of last week's arrivals actually treated, read off the live
  // caseload rather than stored — it only ever describes the latest week.
  const arrived = m?.lastCases.reduce((n, c) => n + c.arrived, 0) ?? 0;
  const treatedShare =
    m && arrived > 0
      ? Math.round(
          (m.lastCases.reduce((n, c) => n + c.treated, 0) / arrived) * 100,
        )
      : undefined;

  return (
    /*
     * The reading order is the decision order: who and where you are, the four
     * numbers that constrain the week, what to do about it, then the week
     * itself. Secondary history and observations sit below the fold on the
     * right, where they inform without competing.
     *
     * Spacing carries the grouping rather than borders — `space-y-5` between
     * major blocks, tighter inside them — which is what lets the nested card
     * outlines come out.
     */
    <div className="space-y-5">
      <OverviewHero career={career} state={state} alerts={alerts} />

      <StatusStrip state={state} spent={spent} budget={budget} />

      {/* One primary recommendation and at most one secondary. Everything
          else stays reachable through the section badges — see `topAlerts`. */}
      <AlertStack
        alerts={topAlerts(alerts)}
        remaining={Math.max(0, alerts.length - topAlerts(alerts).length)}
        onNavigate={onNavigate}
      />

      {step && (
        <NextStep
          step={step}
          onDismiss={onDismissStep}
          onNavigate={onNavigate}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_336px]">
        <div className="min-w-0 space-y-5">
          {/* -------------------------------------------------- objective */}
          <section className="form p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="sign text-[11.5px] text-ink-faint">Objective</h2>
              <span className="num text-[13px] font-semibold text-clinical">
                {Math.round(objective.progress * 100)}%
              </span>
            </div>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink">
              {objective.text}
            </p>
            <div
              className="gauge mt-2.5"
              style={{
                ["--fill" as string]: `${Math.max(0, Math.min(1, objective.progress)) * 100}%`,
              }}
              role="progressbar"
              aria-label="Objective progress"
              aria-valuenow={Math.round(objective.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
            <p className="num mt-2 text-[12px] text-ink-faint">
              {score.label} {score.value} · {score.sub}
            </p>
          </section>

          {/* ------------------------------------------------- the week */}
          <section className="form overflow-hidden">
            <QuickPlan
              career={career}
              state={state}
              budget={budget}
              spent={spent}
              lastWeek={lastWeek}
              onApply={(next) => onAllocate(() => next)}
            />
            <ActionBoard
              career={career}
              state={state}
              alloc={alloc}
              budget={budget}
              spent={spent}
              onChange={onAllocate}
              bare
            />
          </section>

          {/* --------------------------------------- forecast and commit */}
          <section className="form">
            <h2 className="form-head sign px-4 py-2.5 text-[11.5px] text-ink-soft">
              If you commit this week
            </h2>
            {/*
             * A tinted grid rather than a grid of bordered cards. The old
             * version drew a hairline around every figure, which turned the
             * forecast into a spreadsheet; the numbers separate perfectly
             * well on background alone.
             */}
            <div className="grid grid-cols-2 gap-px bg-rule-soft lg:grid-cols-4">
              {briefing.map((b) => (
                <div
                  key={b.label}
                  className={`px-4 py-3.5 ${
                    b.tone === "bad"
                      ? "bg-alarm-tint"
                      : b.tone === "good"
                        ? "bg-good-tint"
                        : "bg-card"
                  }`}
                >
                  <p className="sign text-[11.5px] text-ink-faint">{b.label}</p>
                  <p
                    className={`num mt-1 text-[21px] font-semibold leading-tight tracking-tight ${
                      b.tone === "good"
                        ? "text-good"
                        : b.tone === "bad"
                          ? "text-alarm"
                          : "text-ink"
                    }`}
                  >
                    {b.value}
                  </p>
                  {b.note && (
                    <p className="mt-1 text-[13px] leading-snug text-ink-soft">
                      {b.note}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile gets the sticky CommitBar instead; duplicating the
                control on small screens would just push content further down. */}
            <div className="hidden border-t border-rule-soft p-3 lg:block">
              <button
                onClick={onCommit}
                disabled={spent === 0}
                className="min-h-[52px] w-full rounded-form bg-clinical px-4 text-[15px] font-bold text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint"
              >
                {spent === 0
                  ? "Assign your time first"
                  : spent < budget
                    ? `Commit week — ${budget - spent} block${budget - spent === 1 ? "" : "s"} unused`
                    : "Commit week"}
              </button>
            </div>
          </section>

          {/* ------------------------------------------------------- debt */}
          {state.r.debt > 0 && (
            <section className="form flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <h2 className="text-[14px] font-semibold text-ink">
                  {/* The career's own word for what it owes. Hardcoding
                      "Student debt" put a Physician's loan on a Chef's
                      overview, where it is a fit-out loan and nothing to do
                      with medical school. */}
                  {career.resources.find((r) => r.id === "debt")?.label ??
                    "Outstanding loan"}
                </h2>
                <p className="num mt-0.5 text-[13px] text-ink-soft">
                  {money(state.r.debt)} outstanding
                </p>
              </div>
              <button
                onClick={onPayLoan}
                disabled={state.r.cash < 1_000}
                className="min-h-[44px] shrink-0 rounded-form border border-rule px-4 text-[14px] font-medium transition hover:border-clinical hover:text-clinical disabled:cursor-not-allowed disabled:opacity-40"
              >
                Pay {money(Math.min(10_000, state.r.debt, state.r.cash))}
              </button>
            </section>
          )}

          <TrendCard history={state.history} treatedShare={treatedShare} />
        </div>

        {/* ------------------------------------------------ supporting
            Secondary by construction: on desktop it sits beside the week, on
            mobile it falls below it, so the decision always comes first. */}
        <div className="min-w-0 space-y-5">
          <Meters career={career} state={state} />

          {m && (
            <section className="form">
              <h2 className="form-head sign px-4 py-2.5 text-[11.5px] text-ink-soft">
                The practice
              </h2>
              <div className="grid grid-cols-3 gap-px bg-rule-soft">
                {[
                  ["Sites", m.facilities.length, "cities" as ScreenId],
                  ["Depts", m.departments.length, "build" as ScreenId],
                  ["Staff", m.staff.length, "staff" as ScreenId],
                ].map(([label, value, dest]) => (
                  <button
                    key={label as string}
                    onClick={() => onNavigate(dest as ScreenId)}
                    className="bg-card px-3 py-3 text-left transition hover:bg-clinical-tint"
                  >
                    <p className="sign text-[11.5px] text-ink-faint">
                      {label as string}
                    </p>
                    <p className="num mt-0.5 text-[19px] font-semibold">
                      {value as number}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="form">
            <h2 className="form-head sign px-4 py-2.5 text-[11.5px] text-ink-soft">
              {/* What this career calls its own running record. "Case notes"
                  is what a doctor keeps; a kitchen keeps a service book and a
                  firm keeps attendance notes. The default is deliberately
                  plain so a career added later reads sensibly without needing
                  an entry here. */}
              {LOG_HEADING[state.careerId] ?? "What has happened"}
            </h2>
            {state.log.length === 0 ? (
              <p className="px-4 py-4 text-[14px] text-ink-soft">
                Nothing has happened yet.
              </p>
            ) : (
              <ol className="scroll-thin max-h-72 overflow-y-auto">
                {state.log.slice(0, 25).map((entry, i) => (
                  <li
                    key={i}
                    className="spine flex gap-3 border-b border-rule-soft px-4 py-2.5 text-[13.5px] leading-relaxed last:border-0"
                    style={{
                      ["--dept" as string]:
                        entry.tone === "bad"
                          ? "#FF6B6B"
                          : entry.tone === "good"
                            ? "#4ADE80"
                            : "#26375A",
                    }}
                  >
                    <span className="num shrink-0 text-ink-faint">
                      w{entry.week}
                    </span>
                    <span className="text-ink-soft">{entry.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <CommitBar
        spent={spent}
        budget={budget}
        headline={headline}
        onCommit={onCommit}
      />
    </div>
  );
}
