"use client";

import { EmptyState } from "../ui/EmptyState";
import type { ScreenId } from "@/lib/ui/navigation";
import { CoverageGrid } from "../visuals/CoverageGrid";
import { useState } from "react";
import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import {
  SPECIALTY_BY_ID,
  STAFF_ROLES,
  colourFor,
} from "@/lib/game/medical/data";
import {
  TRAIT_BLURB,
  cultureScore,
  hydrateStaff,
  payGap,
} from "@/lib/game/medical/culture";
import { money } from "@/lib/game/format";
import { Panel, StatRow } from "../ui/Panel";
import { ActionButton } from "../ui/ItemCard";

/**
 * THE TEAM
 *
 * Culture first, then people.
 *
 * The culture number is derived and always shows its working — the panel lists
 * the components that produced it, worst first, because the useful question is
 * never "what is my culture" but "what is dragging it down".
 *
 * Each person is collapsed to a name, a role and the one thing currently true
 * about them. Their numbers and the five management actions are one tap away.
 * That ordering is the whole design: a roster of twenty people with six
 * statistics each is a spreadsheet, and the brief was explicit about not
 * building one.
 */
export function TeamPanel({
  state,
  dispatch,
  onNavigate,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  const m = med(state);
  const culture = cultureScore(m, state.week);
  const [open, setOpen] = useState<string | null>(null);
  const gap = payGap(m);

  return (
    <div className="space-y-4">
      {/* Who covers what, before who is on the payroll. A staff list answers
          "who do I employ"; this answers "can Cardiology take Tuesday's
          case", which is the question that decides whether a department is
          earning its upkeep. */}
      <CoverageGrid state={state} onNavigate={onNavigate} />

      <Panel
        title="Workplace culture"
        aside={`${Math.round(culture.score)} · ${culture.word}`}
        note="Not something you buy. It is what the conditions add up to."
        flush
      >
        <div className="px-5 pt-4">
          <div
            className="well h-2 overflow-hidden p-0"
            role="meter"
            aria-valuenow={Math.round(culture.score)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Workplace culture"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                culture.score >= 60
                  ? "bg-good"
                  : culture.score >= 40
                    ? "bg-caution"
                    : "bg-alarm"
              }`}
              style={{ width: `${culture.score}%` }}
            />
          </div>
        </div>

        <ul className="mt-3 divide-y divide-rule-soft">
          {culture.drivers.map((d) => (
            <li key={d.label} className="flex items-baseline gap-3 px-5 py-2">
              <span
                className={`num w-10 shrink-0 text-[12.5px] ${
                  d.effect > 0
                    ? "text-good"
                    : d.effect < 0
                      ? "text-alarm"
                      : "text-ink-faint"
                }`}
              >
                {d.effect > 0 ? "+" : ""}
                {d.effect}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] text-ink">{d.label}</span>
                <span className="block text-[12px] text-ink-soft">
                  {d.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <StatRow
          stats={[
            {
              label: "Output",
              value: `${Math.round((0.86 + (culture.score / 100) * 0.28) * 100)}%`,
              note: "of nominal capacity",
              tone: culture.score >= 55 ? "good" : "caution",
            },
            {
              label: "Pay gap",
              value: gap > 0 ? money(gap) : "None",
              note: "per week, to meet expectations",
              tone: gap > 0 ? "caution" : "good",
            },
            {
              label: "Team",
              value: m.staff.length,
              note: "people employed",
            },
            {
              label: "Leads",
              value: m.staff.filter((x) => hydrateStaff(x).lead).length,
              note: "with delegated responsibility",
            },
          ]}
        />

        {m.staff.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-rule-soft px-5 py-3">
            <ActionButton
              variant="quiet"
              onClick={() => dispatch("easeWorkload", "")}
            >
              Ease the rota
            </ActionButton>
            <span className="self-center text-[12.5px] text-ink-soft">
              Takes pressure off everyone at once. Costs capacity this week.
            </span>
          </div>
        )}
      </Panel>

      <Panel
        title="Your people"
        aside={`${money(m.staff.reduce((n, x) => n + x.salary, 0))}/wk`}
        flush
      >
        {m.staff.length === 0 ? (
          <EmptyState
            icon="team"
            what="No team to have a culture yet"
            why="Workplace culture is built from pay, workload and morale across the people you employ. With nobody employed there is nothing for it to measure."
            can="It starts mattering with your first hire — it multiplies everything your staff get through, between ×0.86 and ×1.14."
            go={{ label: "Hire someone", destination: "staff" }}
            onNavigate={onNavigate}
          />
        ) : (
          <ul className="divide-y divide-rule-soft">
            {m.staff.map((raw) => {
              const x = hydrateStaff(raw);
              const expanded = open === x.id;
              const role = STAFF_ROLES.find((r) => r.id === x.role);
              const state1 =
                x.loyalty < 30
                  ? { text: "looking elsewhere", tone: "text-alarm" }
                  : x.workload > 78
                    ? { text: "overloaded", tone: "text-alarm" }
                    : x.morale < 40
                      ? { text: "unhappy", tone: "text-caution" }
                      : x.training > 0
                        ? {
                            text: `on a course, ${x.training} weeks left`,
                            tone: "text-info",
                          }
                        : x.salary < x.expects * 0.92
                          ? { text: "underpaid", tone: "text-caution" }
                          : { text: "settled", tone: "text-ink-soft" };

              return (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : x.id)}
                    aria-expanded={expanded}
                    className="spine flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-card-high"
                    style={{
                      ["--dept" as string]: x.specialty
                        ? colourFor(x.specialty)
                        : "transparent",
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="t-card text-ink">{x.name}</span>
                        {x.lead && (
                          <span className="num rounded-sm bg-clinical-tint px-1.5 text-[11px] text-clinical">
                            lead
                          </span>
                        )}
                      </span>
                      <span className="num block text-[12px] text-ink-soft">
                        {role?.label}
                        {x.specialty &&
                          ` · ${SPECIALTY_BY_ID.get(x.specialty)?.label}`}
                        {" · "}
                        <span className={state1.tone}>{state1.text}</span>
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="shrink-0 text-[13px] text-ink-faint"
                    >
                      {expanded ? "▴" : "▾"}
                    </span>
                  </button>

                  {expanded && (
                    <div className="border-t border-rule-soft bg-paper px-4 py-3.5">
                      <ul className="flex flex-wrap gap-1.5">
                        {x.traits.map((t) => (
                          <li
                            key={t}
                            title={TRAIT_BLURB[t]}
                            className="num rounded-sm bg-card px-1.5 py-0.5 text-[12px] text-ink-soft"
                          >
                            {t}
                          </li>
                        ))}
                      </ul>

                      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-form bg-rule-soft sm:grid-cols-4">
                        <Stat label="Morale" value={x.morale} />
                        <Stat label="Loyalty" value={x.loyalty} />
                        <Stat label="Workload" value={x.workload} invert />
                        <Stat label="Skill" value={x.skill} />
                      </dl>

                      <p className="num mt-2.5 text-[12.5px] text-ink-soft">
                        {money(x.salary)}/wk
                        {x.expects > x.salary && (
                          <span className="text-caution">
                            {" "}
                            · expects {money(x.expects)}
                          </span>
                        )}
                        {x.warnings > 0 && (
                          <span className="text-alarm">
                            {" "}
                            · {x.warnings} warning{x.warnings === 1 ? "" : "s"}
                          </span>
                        )}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <ActionButton
                          onClick={() => dispatch("rewardStaff", x.id)}
                          disabled={x.expects <= x.salary}
                        >
                          Give a rise
                        </ActionButton>
                        <ActionButton
                          variant="quiet"
                          onClick={() => dispatch("trainStaff", x.id)}
                          disabled={x.training > 0 || state.r.cash < 9_000}
                        >
                          Train · {money(9_000)}
                        </ActionButton>
                        <ActionButton
                          variant="quiet"
                          onClick={() => dispatch("promoteStaff", x.id)}
                          disabled={x.lead}
                        >
                          Promote
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          onClick={() => dispatch("warnStaff", x.id)}
                        >
                          Formal warning
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          onClick={() => dispatch("fire", x.id)}
                        >
                          Let go
                        </ActionButton>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({
  label,
  value,
  invert,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  const good = invert ? value < 55 : value >= 55;
  const bad = invert ? value > 78 : value < 35;
  return (
    <div className="bg-card px-3 py-2">
      <dt className="t-label text-ink-faint">{label}</dt>
      <dd
        className={`num mt-0.5 text-[15px] font-semibold ${
          bad ? "text-alarm" : good ? "text-good" : "text-ink"
        }`}
      >
        {Math.round(value)}
      </dd>
    </div>
  );
}
