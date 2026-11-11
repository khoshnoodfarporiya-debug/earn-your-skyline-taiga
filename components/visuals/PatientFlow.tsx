"use client";

import { useMemo, useState } from "react";
import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import { patientFlow, upstreamLimits, type FlowTone } from "@/lib/ui/flow";
import { DEPARTMENT_BY_ID } from "@/lib/ui/departments";
import type { ScreenId } from "@/lib/ui/navigation";
import { MedIcon } from "./MedIcon";

/**
 * THE FUNNEL
 *
 * 146 arrived and 65 were treated. This is the eighty-one.
 *
 * ------------------------------------------------------------ why not a chart
 *
 * A Sankey would be the textbook answer and the wrong one. The interesting
 * quantity is not the *shape* of the flow, it is the reason attached to each
 * loss and the screen that fixes it — and a ribbon diagram cannot carry a
 * sentence, a number and a button at every branch without becoming unreadable
 * on a 375px phone.
 *
 * So: proportional bars in ordinary HTML, one row per gate, with the losses
 * called out between them. It reflows to a single column without any change of
 * meaning, every figure is selectable text, and nothing depends on an SVG
 * viewBox surviving a narrow screen.
 *
 * ----------------------------------------------------------------- on colour
 *
 * Blue entering, teal through, amber constrained, red failed, grey referred —
 * and every one of them also carries its count and its label. Colour is the
 * fastest read here, never the only one: the same rows are complete with the
 * stylesheet switched off.
 *
 * ------------------------------------------------------------------ on truth
 *
 * The numbers come from `patientFlow`, which sums the week the engine actually
 * resolved. The funnel closes — drops equal arrivals minus treated — and a test
 * asserts it against real simulated states rather than trusting the component.
 */
export function PatientFlow({
  state,
  onNavigate,
}: {
  state: RunState;
  onNavigate: (screen: ScreenId) => void;
}) {
  const m = med(state);
  /* The week's caseload can be a few hundred rows across a large network, and
     this re-derives on every keystroke elsewhere in the tree without it. */
  const flow = useMemo(() => patientFlow(m), [m]);
  const limits = useMemo(() => upstreamLimits(m), [m]);
  const [open, setOpen] = useState<string | null>(null);

  if (!flow.hasData) {
    return (
      <section className="form px-5 py-5">
        <h3 className="t-card text-ink">Where your patients go</h3>
        <p className="mt-1 text-[13px] text-ink-soft">
          Nothing has resolved yet. Commit a week and every patient who arrives
          is accounted for here — treated, referred, or turned away with the
          reason.
        </p>
      </section>
    );
  }

  const pct = (n: number) => `${(n / Math.max(1, flow.arrived)) * 100}%`;

  return (
    <section className="form" aria-labelledby="flow-title">
      <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
        <h3 id="flow-title" className="sign text-[11.5px] text-ink-soft">
          Where your patients went
        </h3>
        <span className="num text-[12px] text-ink-soft">
          {flow.treated} of {flow.arrived} treated
        </span>
      </div>

      {/* A plain-language statement of the whole diagram, first and always.
          It is the fallback for anyone who cannot use the bars, and the
          summary everyone else reads before studying them. */}
      <p className="border-b border-rule-soft px-5 py-3 text-[13px] leading-relaxed text-ink-soft">
        {flow.arrived} patients presented last week.{" "}
        {flow.treated > 0 && (
          <>
            You treated <span className="text-ink">{flow.treated}</span>
            {flow.failed > 0 ? (
              <>
                , of which <span className="text-alarm">{flow.failed}</span> went
                badly
              </>
            ) : null}
            .{" "}
          </>
        )}
        {flow.turnedAway > 0 ? (
          <>
            <span className="text-caution">{flow.turnedAway}</span> did not get
            treated. Every one of them is accounted for below.
          </>
        ) : (
          <>Nobody was turned away.</>
        )}
      </p>

      <ol className="px-5 py-4">
        {flow.stages.map((stage, i) => {
          const prev = flow.stages[i - 1];
          const lost = prev ? prev.count - stage.count : 0;
          /* The drop that sits between these two stages, if any. Matched by
             position rather than by name so the list stays in step when a
             blocker is absent. */
          const drops =
            i === 1
              ? flow.drops.filter((d) => d.id === "department")
              : i === 2
                ? flow.drops.filter(
                    (d) => d.id === "equipment" || d.id === "staff",
                  )
                : i === 3
                  ? flow.drops.filter((d) => d.id === "capacity")
                  : [];

          return (
            <li key={stage.id}>
              {/* the loss between the previous gate and this one */}
              {i > 0 && lost > 0 && (
                <ul className="my-1.5 space-y-1.5 border-l-2 border-rule-soft pl-4">
                  {drops.map((d) => {
                    const isOpen = open === d.id;
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => setOpen(isOpen ? null : d.id)}
                          aria-expanded={isOpen}
                          className="flex min-h-[44px] w-full items-center gap-2.5 rounded-form bg-paper px-3 text-left transition hover:bg-card-high"
                        >
                          <span className={TONE_TEXT[d.tone]}>
                            <MedIcon
                              name={d.tone === "referred" ? "globe" : "alert"}
                              className="h-4 w-4"
                            />
                          </span>
                          <span className={`num text-[13px] ${TONE_TEXT[d.tone]}`}>
                            −{d.count}
                          </span>
                          <span className="min-w-0 flex-1 text-[12.5px] text-ink-soft">
                            {d.label}
                          </span>
                          <span aria-hidden className="text-[13px] text-ink-faint">
                            {isOpen ? "−" : "+"}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="mt-1.5 rounded-form bg-card-high px-3.5 py-3">
                            <p className="text-[12.5px] leading-relaxed text-ink-soft">
                              {d.reason}
                            </p>
                            {d.departments.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {d.departments.slice(0, 6).map((dept) => {
                                  const identity = DEPARTMENT_BY_ID.get(dept.id);
                                  return (
                                    <li
                                      key={dept.id}
                                      className="flex items-center gap-2 text-[12.5px]"
                                    >
                                      <span
                                        style={{ color: identity?.colour }}
                                        className="shrink-0"
                                      >
                                        <MedIcon
                                          name={identity?.icon ?? "stethoscope"}
                                          className="h-4 w-4"
                                        />
                                      </span>
                                      <span className="flex-1 text-ink-soft">
                                        {dept.label}
                                      </span>
                                      <span className="num text-ink">
                                        {dept.count}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                            <p className="mt-2.5 text-[12.5px] text-ink">
                              {d.fix}
                            </p>
                            <button
                              type="button"
                              onClick={() => onNavigate(d.destination)}
                              className="mt-2 min-h-[44px] rounded-form bg-clinical px-3.5 text-[12.5px] font-semibold text-on-accent transition hover:bg-clinical-hover"
                            >
                              Go there
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* the gate itself */}
              <div className="py-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-semibold text-ink">
                    {stage.label}
                  </p>
                  <p className={`num text-[15px] font-semibold ${TONE_TEXT[stage.tone]}`}>
                    {stage.count}
                  </p>
                </div>
                <div
                  className="mt-1 h-2.5 overflow-hidden rounded-full bg-paper"
                  /* The bar is decorative: the count is stated above it and
                     the detail below, so a screen reader gets the whole row
                     without being read a percentage twice. */
                  aria-hidden
                >
                  <div
                    className={`h-full rounded-full ${TONE_BAR[stage.tone]}`}
                    style={{ width: pct(stage.count) }}
                  />
                </div>
                <p className="mt-1 text-[12px] leading-snug text-ink-faint">
                  {stage.detail}
                </p>
              </div>
            </li>
          );
        })}

        {/* Outcomes are not a gate — they are what happened to the treated. */}
        {flow.failed > 0 && (
          <li className="mt-1 border-t border-rule-soft pt-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-semibold text-alarm">
                Poor outcome
              </p>
              <p className="num text-[15px] font-semibold text-alarm">
                {flow.failed}
              </p>
            </div>
            <p className="mt-1 text-[12px] leading-snug text-ink-faint">
              Treated, and it did not go well. Drives malpractice risk and costs
              credibility — the fix is skill and equipment, not capacity.
            </p>
          </li>
        )}
      </ol>

      {limits.length > 0 && (
        <div className="border-t border-rule bg-paper px-5 py-3">
          <h4 className="t-label text-ink-faint">
            Two things the count cannot show
          </h4>
          <ul className="mt-1.5 space-y-2">
            {limits.map((l) => (
              <li key={l.label}>
                <button
                  type="button"
                  onClick={() => onNavigate(l.destination)}
                  className="min-h-[44px] w-full rounded-form px-1 text-left transition hover:bg-card-high"
                >
                  <span className="text-[12.5px] font-semibold text-ink">
                    {l.label}
                  </span>
                  <span className="block text-[12px] leading-snug text-ink-soft">
                    {l.detail}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const TONE_TEXT: Record<FlowTone, string> = {
  entering: "text-info",
  processed: "text-clinical",
  constrained: "text-caution",
  failed: "text-alarm",
  referred: "text-ink-faint",
};

const TONE_BAR: Record<FlowTone, string> = {
  entering: "bg-info",
  processed: "bg-clinical",
  constrained: "bg-caution",
  failed: "bg-alarm",
  referred: "bg-ink-faint",
};
