"use client";

import { EmptyState } from "../ui/EmptyState";
import { useState } from "react";
import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import {
  SPECIALTY_BY_ID,
  STAFF_ROLES,
  colourFor,
} from "@/lib/game/medical/data";
import type { SpecialtyId } from "@/lib/game/medical/types";
import { money } from "@/lib/game/format";
import { Panel } from "../ui/Panel";
import { ActionButton, ItemCard } from "../ui/ItemCard";
import { STAFF_ART } from "@/lib/ui/careerSceneArt";

export function StaffPanel({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const m = med(state);
  const cash = state.r.cash;
  const [specialtyFor, setSpecialtyFor] = useState<Record<string, SpecialtyId>>(
    {},
  );

  const payrollTotal = m.staff.reduce((sum, s) => sum + s.salary, 0);

  return (
    <div className="space-y-4">
      {/* ----------------------------------------------------------- hire */}
      <Panel
        title="Recruit"
        note="Recruits arrive stronger when your reputation, qualifications and standing are higher."
        flush
      >
        <div className="divide-y divide-rule-soft">
          {STAFF_ROLES.map((role) => {
            const chosen =
              specialtyFor[role.id] ??
              m.departments.find((d) => d !== "general") ??
              "general";
            const affordable = cash >= role.hireCost;
            const arg = role.specialised ? `${role.id}:${chosen}` : role.id;
            const onPayroll = m.staff.filter((s) => s.role === role.id).length;

            return (
              <ItemCard
                key={role.id}
                title={role.label}
                suffix={
                  onPayroll > 0 ? (
                    <span className="num text-[12px] text-clinical">
                      ×{onPayroll}
                    </span>
                  ) : undefined
                }
                blurb={role.blurb}
                price={role.hireCost}
                affordable={affordable}
                cash={cash}
                accent={role.specialised ? colourFor(chosen) : undefined}
                chips={[
                  ...(role.units > 0
                    ? [
                        {
                          text: `+${role.units} units/wk`,
                          tone: "accent" as const,
                        },
                      ]
                    : []),
                  { text: `${money(role.salary)}/wk salary`, tone: "caution" },
                ]}
                consequence={{
                  now: `${money(role.hireCost)} to recruit them. They start this week.`,
                  later: `${money(role.salary)} in salary every week from now on${
                    role.units > 0
                      ? `, and ${role.units} more treatment unit${role.units === 1 ? "" : "s"} of capacity`
                      : ""
                  }.`,
                  risk: "Salary is a fixed cost. It is charged in quiet weeks too, and letting someone go costs the team's loyalty.",
                }}
                blocker={
                  !affordable
                    ? `${money(role.hireCost - cash)} short of the recruitment cost.`
                    : undefined
                }
                visual={STAFF_ART[role.id]}
              >
                {role.specialised && (
                  <label className="flex items-center gap-2">
                    <span className="sr-only">Specialty for {role.label}</span>
                    <select
                      value={chosen}
                      onChange={(e) =>
                        setSpecialtyFor({
                          ...specialtyFor,
                          [role.id]: e.target.value as SpecialtyId,
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
                  onClick={() => dispatch("hire", arg)}
                  disabled={!affordable}
                >
                  Hire
                </ActionButton>
              </ItemCard>
            );
          })}
        </div>
      </Panel>

      {/* --------------------------------------------------------- roster */}
      <Panel
        title="Your team"
        aside={`${m.staff.length} people · ${money(payrollTotal)}/wk`}
        flush
      >
        {m.staff.length === 0 ? (
          <EmptyState
            icon="team"
            what="Nobody on the payroll"
            why="Every hour of treatment is currently your own, which caps the practice at how many clinic blocks you are willing to spend and how much burnout you can carry."
            can="A general practitioner adds twenty-six units of capacity a week and costs no burnout at all. A nurse is cheaper and makes every clinic block you take yourself easier."
          />
        ) : (
          <ul className="divide-y divide-rule-soft">
            {m.staff.map((s) => (
              <li
                key={s.id}
                className="spine flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
                style={{
                  ["--dept" as string]: s.specialty
                    ? colourFor(s.specialty)
                    : "transparent",
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="t-card text-ink">{s.name}</p>
                  <p className="num text-[12px] text-ink-soft">
                    {STAFF_ROLES.find((r) => r.id === s.role)?.label}
                    {s.specialty &&
                      ` · ${SPECIALTY_BY_ID.get(s.specialty)?.label}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-[13px] text-ink">skill {s.skill}</p>
                  <p className="num text-[12px] text-ink-faint">
                    {money(s.salary)}/wk
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dispatch("fire", s.id)}
                  title={`Let go — costs ${money(s.salary * 2)} severance`}
                  className="min-h-[44px] rounded-form bg-paper px-3 text-[12.5px] text-ink-soft transition hover:text-alarm"
                >
                  Let go
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
