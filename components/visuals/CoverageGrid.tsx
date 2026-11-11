"use client";

import { useMemo, useState } from "react";
import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import {
  DEPARTMENT_BY_ID,
  departmentCoverage,
  staffingNeed,
  type CoverageLevel,
} from "@/lib/ui/departments";
import { ROLE_BY_ID } from "@/lib/game/medical/data";
import type { ScreenId } from "@/lib/ui/navigation";
import { MedIcon } from "./MedIcon";

/**
 * THE ROTA
 *
 * Which departments are actually covered, and by whom.
 *
 * A staff list answers "who do I employ". It does not answer "can Cardiology
 * take the case that arrives on Tuesday", which is the question that decides
 * whether a department earns its upkeep. This is that question, one row per
 * department, showing the severity the organisation can take against the
 * severity that arrives.
 *
 * ------------------------------------------------------------ the two numbers
 *
 * `covered` comes from `coverageFor`, the same function the simulation calls
 * when it decides whether a case is treatable — so a department shown as
 * covered here cannot turn work away for staffing next week. `needed` is the
 * top severity that field generates.
 *
 * Together they are a ceiling and a demand, and the gap between them is
 * precisely the work being referred out. That is why the row reads "takes
 * severity 3 of 5" rather than showing a percentage: three of five is a
 * fact about your bench, and 60% is a number about nothing.
 *
 * ----------------------------------------------------------------- not a grid
 *
 * Named a grid, drawn as a list. A twelve-by-five matrix of ticks is legible on
 * a desktop and unusable on a phone, and the honest content of each row is a
 * sentence, not a cell.
 */
export function CoverageGrid({
  state,
  onNavigate,
}: {
  state: RunState;
  onNavigate: (screen: ScreenId) => void;
}) {
  const m = med(state);
  const rows = useMemo(() => departmentCoverage(m), [m]);
  const [open, setOpen] = useState<string | null>(null);

  const openDepartments = rows.filter((r) => r.open);
  const thin = openDepartments.filter((r) => r.level !== "covered");

  return (
    <section className="form" aria-labelledby="coverage-title">
      <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
        <h3 id="coverage-title" className="sign text-[11.5px] text-ink-soft">
          Departmental cover
        </h3>
        <span className="num text-[12px] text-ink-soft">
          {openDepartments.length - thin.length} of {openDepartments.length}{" "}
          fully covered
        </span>
      </div>

      <p className="border-b border-rule-soft px-5 py-3 text-[13px] leading-relaxed text-ink-soft">
        {openDepartments.length === 0 ? (
          "No departments open yet."
        ) : thin.length === 0 ? (
          "Every open department can take the hardest case its field produces."
        ) : (
          <>
            <span className="text-caution">{thin.length}</span> of your open
            departments cannot take the top of their own field. The work they
            turn away is the gap between the two numbers on each row.
          </>
        )}
      </p>

      <ul className="divide-y divide-rule-soft">
        {openDepartments.map((r) => {
          const identity = DEPARTMENT_BY_ID.get(r.id)!;
          const isOpen = open === r.id;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.id)}
                aria-expanded={isOpen}
                className="spine flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-card-high"
                style={{ ["--dept" as string]: identity.colour }}
              >
                <span style={{ color: identity.colour }} className="shrink-0">
                  <MedIcon name={identity.icon} className="h-5 w-5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-ink">
                    {identity.label}
                  </span>
                  <span className="block text-[12px] leading-snug text-ink-soft">
                    {r.note}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="num block text-[14px] font-semibold text-ink">
                    {r.covered}
                    <span className="text-ink-faint">/{r.needed}</span>
                  </span>
                  {/* The state as a word. The colour agrees with it and never
                      replaces it. */}
                  <span className={`t-label block ${LEVEL_TEXT[r.level]}`}>
                    {LEVEL_WORD[r.level]}
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="bg-paper px-4 py-3.5">
                  <p className="text-[12.5px] leading-relaxed text-ink-soft">
                    {identity.purpose} Takes severity up to {r.needed}.{" "}
                    {staffingNeed(r.id)}.
                  </p>

                  <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    <div>
                      <dt className="t-label text-ink-faint">Who covers it</dt>
                      <dd className="mt-0.5 text-[12.5px] text-ink-soft">
                        {r.staff.length === 0 ? (
                          <>Nobody but you.</>
                        ) : (
                          <ul>
                            {r.staff.map((s) => (
                              <li key={s.name}>
                                {s.name} —{" "}
                                {ROLE_BY_ID.get(s.role as never)?.label ??
                                  s.role}
                                , skill {s.skill}
                              </li>
                            ))}
                          </ul>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="t-label text-ink-faint">
                        Equipment it needs
                      </dt>
                      <dd className="mt-0.5 text-[12.5px] text-ink-soft">
                        {identity.equipment.length === 0 ? (
                          "None."
                        ) : (
                          <ul>
                            {identity.equipment.map((e) => (
                              <li
                                key={e.id}
                                className={
                                  r.missingEquipment.includes(e.label)
                                    ? "text-caution"
                                    : undefined
                                }
                              >
                                {e.label}
                                {r.missingEquipment.includes(e.label)
                                  ? " — not installed"
                                  : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </dd>
                    </div>
                  </dl>

                  {r.level !== "covered" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate("staff")}
                        className="min-h-[44px] rounded-form bg-clinical px-3.5 text-[12.5px] font-semibold text-on-accent transition hover:bg-clinical-hover"
                      >
                        Hire for it
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate("career")}
                        className="min-h-[44px] rounded-form bg-card-high px-3.5 text-[12.5px] text-ink-soft transition hover:text-ink"
                      >
                        Qualify yourself
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {openDepartments.length === 0 && (
        <p className="px-5 py-5 text-[13px] text-ink-soft">
          Open a department on the Build screen and its cover appears here.
        </p>
      )}
    </section>
  );
}

const LEVEL_WORD: Record<CoverageLevel, string> = {
  covered: "Covered",
  partial: "Thin",
  uncovered: "Uncovered",
};

const LEVEL_TEXT: Record<CoverageLevel, string> = {
  covered: "text-good",
  partial: "text-caution",
  uncovered: "text-alarm",
};
