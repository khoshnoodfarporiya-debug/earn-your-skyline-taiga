"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import {
  LEGAL_ROLES,
  chambersSeats,
  legalLabourIndex,
  legalWages,
  chambersOf,
  seatsFree,
  seatsUsed,
  staffHours,
} from "@/lib/game/careers/casework";
import { practice } from "@/lib/game/careers/lawyer";
import { AppHeader } from "./AppHeader";

/**
 * THE ROLL, ON THE PHONE
 *
 * Taking somebody on used to be a shelf at the bottom of the Solicitor's one
 * screen, underneath the live files and the instructions on the table — which
 * meant the decision that changes how many hours a week the firm has was the
 * third thing on a page you opened to settle a case.
 *
 * It is a call, so it is on the handset, and the Firm screen keeps its real
 * job: who is here, what they cost, and what the record says. Same split the
 * Chef's agency went through.
 *
 * Every salary here is this market's, not London's — `legalLabourIndex` is
 * applied before the figure is shown and again when the command charges it,
 * from the same function, so the card cannot quote a price the engine does
 * not take.
 */
export function RollApp({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const p = practice(state);
  const labour = legalLabourIndex(p);
  const hours = staffHours(p);

  return (
    <div>
      <AppHeader
        app="roll"
        title="The roll"
        blurb="Who is admitted, and who is looking for a seat. A practice that is winning things gets its calls returned; one that is not, does not."
        stats={[
          {
            label: "In the firm",
            value:
              p.staff.length === 0
                ? "Only you"
                : `${p.staff.length} other${p.staff.length === 1 ? "" : "s"}`,
          },
          { label: "Salaries", value: `${money(legalWages(p))}/wk` },
          {
            label: "Their hours",
            value: `${hours}/wk`,
            tone: hours > 0 ? "good" : undefined,
          },
          {
            label: "Seats",
            value: `${seatsUsed(p)}/${chambersSeats(p)}`,
            tone: seatsFree(p) === 0 ? ("bad" as const) : undefined,
          },
        ]}
      />

      <ul className="divide-y divide-rule/40">
        {LEGAL_ROLES.map((r) => {
          const salary = Math.round(r.salary * labour);
          const hireCost = Math.round(r.hireCost * labour);
          const tooDear = state.r.cash < hireCost;
          const noRoom = seatsFree(p) <= 0;
          return (
            <li key={r.id} className="px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14.5px] font-semibold text-ink">
                  {r.label}
                </span>
                <span className="num shrink-0 text-[11.5px] text-ink-faint">
                  {money(salary)}/wk
                </span>
              </div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-ink-faint">
                {r.blurb}
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-good-tint px-2 py-0.5 text-[11.5px] text-good">
                  <span className="num">+{r.hours}h</span> into the files
                </span>
                {r.weight > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-clinical-tint px-2 py-0.5 text-[11.5px] text-clinical">
                    <span className="num">
                      +{Math.round(r.weight * 100)}
                    </span>{" "}
                    on every set of odds
                  </span>
                )}
                {/* The clerk's real job, stated where the hiring decision is
                    made rather than discovered three adjournments later. */}
                {r.id === "clerk" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-caution-tint px-2 py-0.5 text-[11.5px] text-caution">
                    Hearings stop moving
                  </span>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <button
                  type="button"
                  disabled={tooDear || noRoom}
                  onClick={() => dispatch("hireLegal", r.id)}
                  className="rounded-form border border-rule bg-card/60 px-3.5 py-2 text-[13px] font-medium text-ink transition enabled:hover:border-clinical enabled:hover:bg-card-high enabled:hover:text-clinical disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Take them on · {money(hireCost)}
                </button>
                {noRoom ? (
                  <span className="text-[12px] text-ink-faint">
                    {chambersOf(p).label} seats {chambersSeats(p)} and is full.
                    The firm has to move before it can grow.
                  </span>
                ) : (
                  tooDear && (
                    <span className="text-[12px] text-ink-faint">
                      You have {money(state.r.cash)}.
                    </span>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="px-4 py-4 text-center text-[12.5px] leading-relaxed text-ink-faint">
        Whoever you take on appears on the Firm screen, and their salary falls
        due every week whether or not anything has settled.
      </p>
    </div>
  );
}
