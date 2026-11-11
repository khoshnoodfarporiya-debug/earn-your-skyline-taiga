"use client";

import { EmptyState } from "../ui/EmptyState";
import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import { CONDITIONS } from "@/lib/game/medical/data";
import type { TriagePolicy } from "@/lib/game/medical/types";
import { money } from "@/lib/game/format";
import type { ScreenId } from "@/lib/ui/navigation";
import { PatientFlow } from "../visuals/PatientFlow";
import { CapacityPipeline } from "../visuals/CapacityPipeline";
import { CaseCard } from "../visuals/CaseCard";

const TRIAGE: { id: TriagePolicy; label: string; blurb: string }[] = [
  {
    id: "urgent",
    label: "Sickest first",
    blurb: "Severity order. Best for reputation, worst for throughput.",
  },
  {
    id: "profitable",
    label: "Best value first",
    blurb: "Fee per unit of capacity. Fills the bank, thins the goodwill.",
  },
  {
    id: "volume",
    label: "Quickest first",
    blurb: "Clear the most people. Minor cases get seen, big ones wait.",
  },
];

export function CasesPanel({
  state,
  dispatch,
  onNavigate,
  clinicBlocks = 0,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
  onNavigate: (screen: ScreenId) => void;
  /**
   * Clinic blocks currently in the plan, so the capacity figure describes the
   * week the player is actually building rather than a hypothetical one with
   * no clinical time in it.
   */
  clinicBlocks?: number;
}) {
  const m = med(state);
  const cases = m.lastCases;

  const missed = cases.filter((c) => c.turnedAway > 0);
  // What last week's referrals would have billed — the most useful number for
  // deciding what to buy next.
  const missedValue = missed.reduce((sum, c) => {
    const fee = CONDITIONS.find((x) => x.id === c.conditionId)?.fee ?? 0;
    return sum + c.turnedAway * fee;
  }, 0);

  return (
    <div className="space-y-4">
      {/*
       * The funnel first, then what limits it, then the policy that decides
       * who the limit falls on. That is the order the questions arrive in:
       * why did I treat 65 of 146 — because capacity ran out — and capacity
       * ran out at whichever gate this says.
       */}
      <PatientFlow state={state} onNavigate={onNavigate} />
      <CapacityPipeline
        state={state}
        clinicBlocks={clinicBlocks}
        onNavigate={onNavigate}
      />

      {/* --------------------------------------------------------- triage */}
      <section className="form">
        <div className="form-head px-5 py-2.5">
          <h3 className="sign text-[11.5px] text-ink-soft">Triage policy</h3>
        </div>
        <p className="border-b border-rule-soft px-5 py-2.5 text-[12px] text-ink-soft">
          When more arrives than you can treat, this decides who gets seen.
        </p>
        <div className="grid gap-px bg-rule-soft sm:grid-cols-3">
          {TRIAGE.map((t) => (
            <button
              key={t.id}
              onClick={() => dispatch("triage", t.id)}
              aria-pressed={m.triage === t.id}
              className={`px-4 py-3 text-left transition ${
                m.triage === t.id
                  ? "bg-clinical-tint"
                  : "bg-card hover:bg-clinical-tint"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full border ${
                    m.triage === t.id
                      ? "border-clinical bg-clinical"
                      : "border-rule"
                  }`}
                />
                <h4 className="text-[14px] font-semibold text-ink">
                  {t.label}
                </h4>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-ink-soft">
                {t.blurb}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- caseload */}
      {/* A labelled region, like the diagrams above it — the case list is a
          landmark a keyboard user should be able to jump to. */}
      <section className="form" aria-labelledby="caseload-title">
        <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
          <h3 id="caseload-title" className="sign text-[11.5px] text-ink-soft">
            Last week&rsquo;s caseload
          </h3>
          {cases.length > 0 && (
            <span className="num text-[12px] text-ink-soft">
              {cases.reduce((n, c) => n + c.arrived, 0)} presented
            </span>
          )}
        </div>

        {cases.length === 0 ? (
          <EmptyState
            icon="patient"
            what="No week has resolved yet"
            why="Patients arrive when a week is committed, not before — so there is nothing to report on until you have spent your first six blocks."
            can="Assign your time on the Overview and commit. Every patient who arrives is accounted for here afterwards, including the ones you could not treat."
            go={{ label: "Plan the week", destination: "overview" }}
            onNavigate={onNavigate}
          />
        ) : (
          /* Cards rather than a table: the four columns were the only four
             facts on offer, and every question a player had about a line —
             what does it need, what does it pay, what does an hour of it cost
             me — needed a different screen to answer. */
          <ul className="scroll-thin max-h-[32rem] divide-y divide-rule-soft overflow-y-auto">
            {cases.map((c) => (
              <CaseCard key={c.conditionId} result={c} m={m} />
            ))}
          </ul>
        )}

        {missed.length > 0 && (
          <p className="border-t border-rule bg-paper px-5 py-3 text-[12.5px] leading-relaxed text-ink-soft">
            <span className="text-caution">Amber</span> figures are patients you
            turned away — about{" "}
            <span className="num text-ink">{money(missedValue)}</span> of
            billing. Open the department, buy the equipment or hire the staff
            and that becomes yours.
          </p>
        )}
      </section>
    </div>
  );
}
