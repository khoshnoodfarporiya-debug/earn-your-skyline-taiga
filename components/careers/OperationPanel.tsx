"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { Shelf } from "./Shelf";
import {
  CASE_BY_ID,
  LEGAL_ROLES,
  feeIn,
  legalCityOf,
  legalLabourIndex,
  oddsFor,
  settlementFor,
  workInProgress,
} from "@/lib/game/careers/casework";
import { practice } from "@/lib/game/careers/lawyer";

/**
 * THE ONE SCREEN A CAREER WITH NO BESPOKE SCREENS HAS
 *
 * The Physician has seventeen panels, the Chef seven and the Solicitor four.
 * This is what a career has *before* it has any of those: one screen carrying
 * the decision the career is built around and nothing else, while everything
 * around it — planning the week, the ledger, events, setbacks — is
 * engine-level and already renders for anybody.
 *
 * ------------------------------------------------------------ current state
 *
 * Nothing routes here any more. Both careers that ever used the generic shell
 * have outgrown it: the Chef into `ChefScreens`, and the Solicitor into
 * `LawyerScreens` — see `LAWYER_SECTIONS` in `lib/ui/navigation.ts` for what
 * replaced the single column below and why.
 *
 * It is kept, rather than deleted, because it is the landing place for the
 * next career: a new `CareerDef` becomes playable the moment it has a panel
 * here, without needing a section set, a phone or artwork first. That was the
 * point of the shell and it is still the point of it.
 *
 * The body below is therefore a *reference implementation*, not a live
 * screen. If the Solicitor's rules change, the current version is in
 * `LawyerScreens.tsx`; this one is not on any route and cannot disagree with
 * the simulation in front of a player.
 */

export function OperationPanel({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  if (state.careerId === "lawyer")
    return <PracticePanel state={state} onCommand={onCommand} />;
  return null;
}

/* -------------------------------------------------------------- solicitor */

function PracticePanel({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const p = practice(state);

  return (
    <div className="space-y-6">
      <section aria-labelledby="live-h" className="rounded-lg border border-rule bg-card p-4">
        <h2 id="live-h" className="text-sm font-semibold text-ink">
          On the books in {legalCityOf(p).name}
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          None of this is money yet. {money(workInProgress(p))} of work in
          progress, and a court decides what it is worth.
        </p>

        {p.cases.length === 0 ? (
          <p className="mt-3 rounded border border-dashed border-rule px-3 py-4 text-center text-xs text-ink-faint">
            Nothing live. Take an instruction below, or pitch for one.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {[...p.cases]
              .sort((a, b) => a.dueWeek - b.dueWeek)
              .map((c) => {
                const k = CASE_BY_ID.get(c.kind);
                const odds = oddsFor(c, p, state.r.skill);
                const offer = settlementFor(c, p, state.r.skill);
                const ready = k ? Math.min(1, c.hoursDone / k.hours) : 0;
                const urgent = c.dueWeek - state.week <= 3;
                return (
                  <li
                    key={c.id}
                    className="rounded border border-rule-soft px-3 py-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{k?.label}</p>
                        <p className="text-ink-faint">for {c.client}</p>
                      </div>
                      <p className={urgent ? "font-semibold text-alarm" : "text-ink-faint"}>
                        {c.dueWeek - state.week <= 0
                          ? "Due now"
                          : `${c.dueWeek - state.week} weeks`}
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-faint">
                      <span>
                        Prepared{" "}
                        <span className={ready < 1 ? "text-caution" : "text-ink"}>
                          {Math.round(ready * 100)}%
                        </span>
                      </span>
                      <span>
                        Odds <span className="text-ink">{Math.round(odds * 100)}%</span>
                      </span>
                      <span>
                        Wins{" "}
                        <span className="text-ink">
                          {money(k ? feeIn(p, k) : 0)}
                        </span>
                      </span>
                    </div>

                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onCommand("settleCase", c.id)}
                        className="rounded border border-rule px-2.5 py-1 text-ink hover:border-clinical"
                      >
                        Settle for {money(offer)}
                      </button>
                      <button
                        type="button"
                        onClick={() => onCommand("dropCase", c.id)}
                        className="rounded border border-rule-soft px-2.5 py-1 text-ink-faint hover:border-alarm hover:text-alarm"
                      >
                        Come off the record
                      </button>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section aria-labelledby="offers-h" className="rounded-lg border border-rule bg-card p-4">
        <h2 id="offers-h" className="text-sm font-semibold text-ink">
          Instructions on the table
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Bigger work needs standing before it is offered at all.
        </p>
        {p.offers.length === 0 ? (
          <p className="mt-3 rounded border border-dashed border-rule px-3 py-4 text-center text-xs text-ink-faint">
            Nothing on offer. Pitch for work this week.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {p.offers.map((o) => {
              const k = CASE_BY_ID.get(o.kind);
              return (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded border border-rule-soft px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-medium text-ink">{k?.label}</p>
                    <p className="text-ink-faint">
                      {o.client} · {k?.hours}h · wins {money(k ? feeIn(p, k) : 0)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCommand("takeCase", o.id)}
                    className="shrink-0 rounded border border-rule px-2.5 py-1 text-ink hover:border-clinical"
                  >
                    Accept
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Shelf
        title="The firm"
        note="Hours you do not have to find yourself. Salaries are due every week."
        items={LEGAL_ROLES.map((r) => {
          /* This market's salaries, which is what the command charges. */
          const labour = legalLabourIndex(p);
          const hireCost = Math.round(r.hireCost * labour);
          return {
            id: r.id,
            label: r.label,
            blurb: r.blurb,
            price: hireCost,
            meta: `${money(Math.round(r.salary * labour))}/wk · +${r.hours}h a week`,
            disabled: state.r.cash < hireCost,
            why: `Costs ${money(hireCost)} and you have ${money(state.r.cash)}.`,
          };
        })}
        cmd="hireLegal"
        onCommand={onCommand}
      />
    </div>
  );
}
