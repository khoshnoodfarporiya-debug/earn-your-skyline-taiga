"use client";

import { CareerPathway } from "../visuals/CareerPathway";
import { useState } from "react";
import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import { SPECIALTY_BY_ID, colourFor } from "@/lib/game/medical/data";
import {
  QUALIFICATIONS,
  QUALIFICATION_BY_ID,
  enrolBlocker,
  playerCoverage,
  titleFor,
} from "@/lib/game/medical/progression";
import type { SpecialtyId } from "@/lib/game/medical/types";
import { money } from "@/lib/game/format";
import { Panel } from "../ui/Panel";
import { ActionButton, ItemCard } from "../ui/ItemCard";

const SEVERITY_WORD = ["", "minor", "routine", "serious", "major", "critical"];

export function CareerPanel({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const m = med(state);
  const cash = state.r.cash;
  const [pick, setPick] = useState<Record<string, SpecialtyId>>({});
  const defaultSpecialty =
    m.departments.find((d) => d !== "general") ?? "general";

  return (
    <div className="space-y-4">
      {/* The whole ladder first: where you are on it, what is one step away,
          and what each locked rung is waiting for. The enrolment controls
          below are the same rungs, with the buttons attached. */}
      <CareerPathway state={state} />

      {/* --------------------------------------------------------- standing */}
      <Panel
        title="Your standing"
        aside={`${Math.round(state.r.cpd)} CPD banked`}
      >
        <span className="stamp num inline-block px-3 py-1 text-[14px] tracking-wider">
          {titleFor(m)}
        </span>

        <p className="t-label mt-4 text-ink-faint">
          What you can personally treat
        </p>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {m.departments.map((d) => {
            const level = playerCoverage(m, d);
            return (
              <li
                key={d}
                className="spine flex items-baseline justify-between gap-2 rounded-form bg-paper py-1.5 pl-3 pr-2.5"
                style={{ ["--dept" as string]: colourFor(d) }}
              >
                <span className="text-[13.5px] text-ink">
                  {SPECIALTY_BY_ID.get(d)?.label}
                </span>
                <span
                  className={`num text-[12px] ${level >= 4 ? "text-clinical" : "text-ink-faint"}`}
                >
                  sev {level} · {SEVERITY_WORD[level]}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* ------------------------------------------------------- the ladder */}
      <Panel
        title="Enrol"
        aside={`${m.qualifications.length} held`}
        note="The same rungs as the ladder above, with the price, the gate and the button attached."
        flush
      >
        <div className="divide-y divide-rule-soft">
          {QUALIFICATIONS.filter((q) => q.id !== "md").map((q) => {
            const specialty = q.specialised
              ? (pick[q.id] ?? defaultSpecialty)
              : null;
            const blocked = enrolBlocker(
              m,
              q,
              cash,
              state.r.cpd,
              state.r.skill,
              specialty,
            );
            const held = m.qualifications.filter((h) => h.id === q.id);
            const owned = held.length > 0;

            return (
              <ItemCard
                key={q.id}
                title={q.label}
                suffix={
                  <span className="num text-[12px] text-clinical">
                    {q.postNominal}
                  </span>
                }
                /* No blurb and no effects list: the ladder above already
                   prints both, in the same order, for the same qualification.
                   This panel is where you *act*, so it carries the price, the
                   gate and the button and nothing the reference above says
                   better. */
                price={q.tuition}
                owned={owned}
                ownedLabel={
                  held[0]?.specialty
                    ? `Held · ${held
                        .map((h) => SPECIALTY_BY_ID.get(h.specialty!)?.label)
                        .join(", ")}`
                    : "Held"
                }
                affordable={cash >= q.tuition}
                cash={cash}
                accent={specialty ? colourFor(specialty) : undefined}
                /* CPD is the real gate on this ladder far more often than
                   cash is, so it sits beside the effects rather than being
                   folded into the price line where it used to hide. */
                chips={[
                  {
                    text: `${q.cpd} CPD`,
                    tone: state.r.cpd >= q.cpd ? "good" : "caution",
                  },
                ]}
                footnote={
                  q.requires.length > 0 ? (
                    <>
                      Requires{" "}
                      {q.requires
                        .map((r) => QUALIFICATION_BY_ID.get(r)?.postNominal)
                        .join(" + ")}
                    </>
                  ) : undefined
                }
                blocker={blocked || undefined}
              >
                {q.specialised && (
                  <label className="flex items-center gap-2">
                    <span className="sr-only">Specialty for {q.label}</span>
                    <select
                      value={specialty ?? ""}
                      onChange={(e) =>
                        setPick({
                          ...pick,
                          [q.id]: e.target.value as SpecialtyId,
                        })
                      }
                      className="num min-h-[44px] rounded-form bg-paper px-2.5 text-[13px] text-ink"
                    >
                      {m.departments.map((d) => (
                        <option key={d} value={d}>
                          {SPECIALTY_BY_ID.get(d)?.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <ActionButton
                  onClick={() =>
                    dispatch(
                      "enrol",
                      q.specialised ? `${q.id}:${specialty}` : q.id,
                    )
                  }
                  disabled={!!blocked}
                >
                  Enrol · {money(q.tuition)}
                </ActionButton>
              </ItemCard>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
