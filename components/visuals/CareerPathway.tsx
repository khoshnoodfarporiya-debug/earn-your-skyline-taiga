"use client";

import { useMemo } from "react";
import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import {
  QUALIFICATIONS,
  QUALIFICATION_BY_ID,
  enrolBlocker,
  holds,
  titleFor,
} from "@/lib/game/medical/progression";
import { SPECIALTY_BY_ID } from "@/lib/game/medical/data";
import { DEPARTMENT_BY_ID } from "@/lib/ui/departments";
import { money } from "@/lib/game/format";
import { MedIcon } from "./MedIcon";

/**
 * THE LADDER
 *
 * Where you are on the clinical ladder, what is one step away, and exactly what
 * each locked rung is waiting for.
 *
 * ------------------------------------------------------------ why a ladder
 *
 * The qualification tree branches once — everything descends from MD, and the
 * split is between the clinical line (MRCP → FRCP → FRCS, each taken *per
 * department*) and the academic line (PhD, then a chair that needs both). Drawn
 * as tiers with the dependency stated on each card rather than as a graph with
 * edges: two chains and one join do not need a graph, and a graph would not fit
 * on a phone.
 *
 * ---------------------------------------------------------- the locked rungs
 *
 * Every locked card names its exact requirement, from `enrolBlocker` — the same
 * function the enrolment action calls, so a card that says "needs 90 CPD"
 * cannot be a rung you could actually take. The requirement is a number and a
 * gap, never "requirements not met".
 *
 * ------------------------------------------------------------------- status
 *
 * Four states, each carrying a word as well as a colour: Held, Available,
 * Locked, Long term. "Long term" is the honest label for a rung whose
 * prerequisites you do not hold yet — it is not locked in the sense of being
 * refused, it is simply further up.
 */
export function CareerPathway({ state }: { state: RunState }) {
  const m = med(state);

  const tiers = useMemo(() => {
    /* Depth from MD, computed from `requires` rather than hardcoded, so a new
       qualification lands in the right tier without touching this file. */
    const depth = new Map<string, number>();
    const walk = (id: string): number => {
      if (depth.has(id)) return depth.get(id)!;
      const q = QUALIFICATION_BY_ID.get(id as never);
      const d =
        !q || q.requires.length === 0
          ? 0
          : 1 + Math.max(...q.requires.map((r) => walk(r)));
      depth.set(id, d);
      return d;
    };
    for (const q of QUALIFICATIONS) walk(q.id);

    const grouped = new Map<number, typeof QUALIFICATIONS>();
    for (const q of QUALIFICATIONS) {
      const d = depth.get(q.id)!;
      grouped.set(d, [...(grouped.get(d) ?? []), q]);
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  }, []);

  return (
    <section className="form" aria-labelledby="pathway-title">
      <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
        <h3 id="pathway-title" className="sign text-[11.5px] text-ink-soft">
          The clinical ladder
        </h3>
        <span className="num text-[12px] text-ink-soft">{titleFor(m)}</span>
      </div>

      <p className="border-b border-rule-soft px-5 py-3 text-[13px] leading-relaxed text-ink-soft">
        Every rung changes what you personally may treat — the same gate that
        employing a consultant opens. Employing is faster; qualifying is cheaper
        forever, and the academic rungs do things no hire can.
      </p>

      <div className="space-y-0">
        {tiers.map(([depthLevel, quals], tierIndex) => (
          <div
            key={depthLevel}
            className="border-b border-rule-soft px-5 py-4 last:border-0"
          >
            <h4 className="t-label text-ink-faint">
              {TIER_NAME[tierIndex] ?? `Step ${tierIndex + 1}`}
            </h4>

            <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {quals.map((q) => {
                /* Specialised rungs are held per department, so "held" means
                   held somewhere and the card lists where. */
                const heldIn = m.qualifications.filter((h) => h.id === q.id);
                const isHeld = q.specialised
                  ? heldIn.length > 0
                  : holds(m, q.id);

                /* Availability is checked against the departments you actually
                   have open, because a specialised rung needs one. The best
                   case across them is what the card reports. */
                const candidates = q.specialised
                  ? m.departments
                  : [null as null];
                let blocker: string | null = "Choose a department";
                for (const spec of candidates) {
                  const b = enrolBlocker(
                    m,
                    q,
                    state.r.cash,
                    state.r.cpd,
                    state.r.skill,
                    spec,
                  );
                  if (b === null) {
                    blocker = null;
                    break;
                  }
                  blocker = b;
                }
                if (!q.specialised) {
                  blocker = enrolBlocker(
                    m,
                    q,
                    state.r.cash,
                    state.r.cpd,
                    state.r.skill,
                    null,
                  );
                }

                const prereqsHeld = q.requires.every((r) =>
                  q.specialised
                    ? m.qualifications.some((h) => h.id === r)
                    : holds(m, r),
                );

                const status: Status = isHeld
                  ? "held"
                  : blocker === null
                    ? "available"
                    : prereqsHeld
                      ? "locked"
                      : "later";

                return (
                  <li
                    key={q.id}
                    className={`spine rounded-form px-3.5 py-3 ${
                      status === "held"
                        ? "bg-card-high"
                        : status === "available"
                          ? "bg-clinical-tint"
                          : "bg-card"
                    }`}
                    style={{
                      ["--dept" as string]: STATUS_SPINE[status],
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h5 className="t-card text-ink">
                          {q.label}
                          <span className="num ml-2 text-[12px] font-normal text-ink-faint">
                            {q.postNominal}
                          </span>
                        </h5>
                        <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">
                          {q.blurb}
                        </p>
                      </div>
                      <span
                        className={`t-label shrink-0 ${STATUS_TEXT[status]}`}
                      >
                        {STATUS_WORD[status]}
                      </span>
                    </div>

                    {/* what it does for you */}
                    <ul className="mt-2 space-y-0.5">
                      {q.effect.map((e) => (
                        <li
                          key={e}
                          className="flex gap-1.5 text-[12px] leading-snug text-ink-soft"
                        >
                          <span aria-hidden className="text-clinical">
                            ·
                          </span>
                          {e}
                        </li>
                      ))}
                    </ul>

                    {/* held: in which departments */}
                    {isHeld && q.specialised && heldIn.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {heldIn.map((h) => {
                          const d = h.specialty
                            ? DEPARTMENT_BY_ID.get(h.specialty)
                            : null;
                          return (
                            <li
                              key={h.specialty ?? "none"}
                              className="flex items-center gap-1 rounded-sm bg-paper px-1.5 py-0.5 text-[12px]"
                              style={{ color: d?.colour }}
                            >
                              {d && <MedIcon name={d.icon} className="h-3.5 w-3.5" />}
                              {h.specialty
                                ? SPECIALTY_BY_ID.get(h.specialty)?.label
                                : "—"}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* what it costs, and exactly what is missing */}
                    {!isHeld && (
                      <dl className="mt-2.5 space-y-1 border-t border-rule-soft pt-2">
                        <Req
                          label="Tuition"
                          value={money(q.tuition)}
                          short={state.r.cash < q.tuition}
                        />
                        <Req
                          label="CPD"
                          value={`${q.cpd} points`}
                          short={state.r.cpd < q.cpd}
                          gap={
                            state.r.cpd < q.cpd
                              ? `${Math.ceil(q.cpd - state.r.cpd)} more`
                              : undefined
                          }
                        />
                        <Req
                          label="Skill"
                          value={`${q.minSkill}`}
                          short={state.r.skill < q.minSkill}
                          gap={
                            state.r.skill < q.minSkill
                              ? `${Math.ceil(q.minSkill - state.r.skill)} more`
                              : undefined
                          }
                        />
                        {q.requires.length > 0 && (
                          <Req
                            label="After"
                            value={q.requires
                              .map(
                                (r) =>
                                  QUALIFICATION_BY_ID.get(r)?.postNominal ?? r,
                              )
                              .join(" and ")}
                            short={!prereqsHeld}
                          />
                        )}
                        {blocker && (
                          <div className="pt-1">
                            <dt className="sr-only">Blocked</dt>
                            <dd className="text-[12px] leading-snug text-caution">
                              {blocker}
                            </dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Req({
  label,
  value,
  short,
  gap,
}: {
  label: string;
  value: string;
  short: boolean;
  gap?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="t-label w-[52px] shrink-0 text-ink-faint">{label}</dt>
      <dd
        className={`num text-[12.5px] ${short ? "text-caution" : "text-ink-soft"}`}
      >
        {value}
        {gap && <span className="ml-1.5">({gap})</span>}
      </dd>
    </div>
  );
}

type Status = "held" | "available" | "locked" | "later";

const TIER_NAME = ["Where everyone starts", "The first specialisation", "Consultant standing", "The top of the ladder"];

const STATUS_WORD: Record<Status, string> = {
  held: "Held",
  available: "Available now",
  locked: "Locked",
  later: "Long term",
};

const STATUS_TEXT: Record<Status, string> = {
  held: "text-clinical",
  available: "text-good",
  locked: "text-caution",
  later: "text-ink-faint",
};

const STATUS_SPINE: Record<Status, string> = {
  held: "rgb(var(--accent))",
  available: "#43C78B",
  locked: "#F59E55",
  later: "transparent",
};
