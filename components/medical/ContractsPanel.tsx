"use client";

import { Avatar } from "../ui/Avatar";
import type { ScreenId } from "@/lib/ui/navigation";
import { EmptyState } from "../ui/EmptyState";
import { useState } from "react";
import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import {
  KIND_WORD,
  contractFee,
  readinessFor,
  requiredScore,
} from "@/lib/game/contracts";
import { CONTRACT_BY_ID } from "@/lib/game/medical/contractList";
import { CAST_BY_ID } from "@/lib/game/medical/cast";
import { cultureScore, hydrateStaff } from "@/lib/game/medical/culture";
import { effectiveFee, marketOf } from "@/lib/game/medical/economy";
import { money } from "@/lib/game/format";
import { Panel } from "../ui/Panel";
import { ActionButton, ItemCard } from "../ui/ItemCard";

/**
 * ASSIGNMENTS
 *
 * Two lists: what is on the table, and what you are carrying.
 *
 * The design requirement that shaped this was "clear risk/reward" — so an
 * offer never shows a fee without also showing what it costs, what it needs,
 * and who else wants it, and a live contract always shows the *same*
 * readiness figure the resolver will use. A player who fails one must be able
 * to point at the line that says why.
 */
export function ContractsPanel({
  state,
  dispatch,
  onNavigate,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  const m = med(state);
  const offers = state.offers ?? [];
  const live = state.contracts ?? [];
  const log = state.contractLog ?? [];
  const [open, setOpen] = useState<string | null>(null);

  const culture = cultureScore(m, state.week).score;

  return (
    <div className="space-y-4">
      <Panel
        title="On the table"
        aside={`${offers.length} offer${offers.length === 1 ? "" : "s"}`}
        note="Offers lapse. Somebody else is usually asking for the same work."
        flush
      >
        {offers.length === 0 ? (
          <EmptyState
            icon="clipboard"
            what="Nothing on offer right now"
            why="Work comes to practices that have something to offer — open departments, credentials, standing, a team. Nobody commissions a service you cannot yet deliver."
            can="Opening a department or taking a qualification is what makes the next offer appear. Offers also lapse, so an empty list can simply mean you are between them."
            go={{ label: "Open a department", destination: "build" }}
            onNavigate={onNavigate}
          />
        ) : (
          <div className="divide-y divide-rule-soft">
            {offers.map((o) => {
              const def = CONTRACT_BY_ID.get(o.defId);
              if (!def) return null;
              const fee = Math.round(
                def.fee * effectiveFee(m.markets, o.city as never),
              );
              const contested = o.rivalBid > 0;
              const rivalName = o.rival
                ? (CAST_BY_ID.get(o.rival)?.name ?? "A competitor")
                : null;

              return (
                <ItemCard
                  key={o.defId}
                  title={def.title}
                  suffix={
                    <span className="num text-[11.5px] text-ink-faint">
                      {KIND_WORD[def.kind]}
                    </span>
                  }
                  blurb={def.blurb}
                  price={fee}
                  cash={state.r.cash}
                  chips={[
                    { text: `difficulty ${def.difficulty}/5` },
                    { text: `${def.effort} blocks of work` },
                    { text: `${def.deadline} weeks`, tone: "caution" },
                    ...(def.ethicalRisk >= 0.5
                      ? [{ text: "ethically exposed", tone: "alarm" as const }]
                      : def.ethicalRisk >= 0.2
                        ? [{ text: "grey area", tone: "caution" as const }]
                        : []),
                  ]}
                  footnote={
                    <>
                      Expires week {o.expiresWeek}
                      {contested && rivalName && o.rival ? (
                        <>
                          {" · "}
                          {/* The face of whoever is bidding against you. A
                              named rival competing for the same work is the
                              only place a portrait belongs on this screen —
                              uncontested offers get none, because there is
                              nobody there. */}
                          <Avatar
                            name={rivalName}
                            personId={o.rival}
                            size={20}
                            className="mr-1 inline-block align-text-bottom"
                          />
                          {rivalName} is bidding
                        </>
                      ) : (
                        ""
                      )}
                    </>
                  }
                >
                  <ActionButton
                    onClick={() => dispatch("acceptContract", o.defId)}
                  >
                    Take it
                  </ActionButton>
                  <ActionButton
                    variant="quiet"
                    onClick={() => dispatch("declineContract", o.defId)}
                  >
                    Pass
                  </ActionButton>
                </ItemCard>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel
        title="What you are carrying"
        aside={`${live.length} live`}
        note="Assign blocks with “Work your live cases” on the Overview. Unworked assignments fail on their deadline."
        flush
      >
        {live.length === 0 ? (
          <EmptyState
            icon="clipboard"
            what="Nothing in progress"
            why="You have not accepted any of the work on offer, so no deadlines are running against you."
            can="Accepted work needs casework blocks in the weekly plan to progress. Taking a contract you cannot staff is how a deadline turns into a penalty."
          />
        ) : (
          <ul className="divide-y divide-rule-soft">
            {live.map((a) => {
              const def = CONTRACT_BY_ID.get(a.defId);
              if (!def) return null;
              const staffSkill =
                a.assigned.length === 0
                  ? 0
                  : a.assigned.reduce((n, id) => {
                      const x = m.staff.find((p) => p.id === id);
                      return n + (x ? hydrateStaff(x).skill : 0);
                    }, 0) / a.assigned.length;
              const readiness = readinessFor(state, a, def, {
                skill: state.r.skill,
                burnout: state.r.burnout,
                standing: state.r.reputation,
                staffSkill,
                cityFactor: marketOf(m.markets, a.city as never).demand,
                culture,
              });
              const need = requiredScore(def, a);
              const margin = readiness.total - need;
              const weeksLeft = a.dueWeek - state.week;
              const expanded = open === a.defId;

              return (
                <li key={a.defId} className="px-4 py-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="t-card text-ink">{def.title}</h4>
                    <span
                      className={`num text-[12.5px] ${
                        weeksLeft <= 1 ? "text-alarm" : "text-ink-soft"
                      }`}
                    >
                      {weeksLeft <= 0
                        ? "due now"
                        : `${weeksLeft} week${weeksLeft === 1 ? "" : "s"} left`}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-3">
                    <div className="well h-1.5 flex-1 overflow-hidden p-0">
                      <div
                        className="h-full rounded-full bg-clinical transition-[width] duration-500"
                        style={{
                          width: `${Math.min(100, (a.progress / def.effort) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="num shrink-0 text-[12px] text-ink-faint">
                      {a.progress}/{def.effort} blocks
                    </span>
                  </div>

                  <p
                    className={`num mt-2 text-[12.5px] ${
                      margin >= 14
                        ? "text-good"
                        : margin <= -14
                          ? "text-alarm"
                          : "text-caution"
                    }`}
                  >
                    {margin >= 14
                      ? "On track to deliver this"
                      : margin <= -14
                        ? "Heading for failure as it stands"
                        : "Too close to call"}
                    {" · "}
                    {Math.round(readiness.total)} against {Math.round(need)}{" "}
                    needed
                  </p>

                  {a.complications.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {a.complications.map((cid) => {
                        const c = (def.complications ?? []).find(
                          (x) => x.id === cid,
                        );
                        return c ? (
                          <li
                            key={cid}
                            className="text-[12.5px] leading-snug text-caution"
                          >
                            {c.text}
                          </li>
                        ) : null;
                      })}
                    </ul>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : a.defId)}
                    aria-expanded={expanded}
                    className="mt-2 text-[12.5px] text-clinical transition hover:text-clinical-hover"
                  >
                    {expanded ? "Hide the detail" : "Why that number"}
                  </button>

                  {expanded && (
                    <>
                      <dl className="mt-2 grid gap-px overflow-hidden rounded-form bg-rule-soft sm:grid-cols-2">
                        {readiness.parts.map((p) => (
                          <div
                            key={p.label}
                            className="flex items-baseline justify-between bg-card px-3 py-1.5"
                          >
                            <dt className="text-[12.5px] text-ink-soft">
                              {p.label}
                            </dt>
                            <dd
                              className={`num text-[12.5px] ${
                                p.value < 0 ? "text-alarm" : "text-ink"
                              }`}
                            >
                              {p.value > 0 ? "+" : ""}
                              {Math.round(p.value)}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      {m.staff.length > 0 && (
                        <>
                          <p className="t-label mt-3 text-ink-faint">
                            Who is on it
                          </p>
                          <ul className="mt-1.5 flex flex-wrap gap-1.5">
                            {m.staff.slice(0, 8).map((x) => {
                              const on = a.assigned.includes(x.id);
                              return (
                                <li key={x.id}>
                                  <button
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() =>
                                      dispatch(
                                        "assignToContract",
                                        `${a.defId}:${x.id}`,
                                      )
                                    }
                                    className={`min-h-[34px] rounded-form px-2.5 text-[12.5px] transition ${
                                      on
                                        ? "bg-clinical-tint text-clinical"
                                        : "bg-paper text-ink-soft hover:text-ink"
                                    }`}
                                  >
                                    {x.name}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}

                      <p className="num mt-2.5 text-[12px] text-ink-faint">
                        Pays{" "}
                        {money(
                          contractFee(
                            def,
                            a,
                            effectiveFee(m.markets, a.city as never),
                          ),
                        )}{" "}
                        on delivery.
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {log.length > 0 && (
        <Panel
          title="Your record"
          aside={`${log.filter((c) => c.outcome === "won").length} delivered`}
          flush
        >
          <ul className="divide-y divide-rule-soft">
            {log.slice(0, 10).map((c, i) => (
              <li
                key={`${c.week}-${c.defId}-${i}`}
                className="flex items-baseline gap-3 px-5 py-2"
              >
                <span className="num w-12 shrink-0 text-[12px] text-ink-faint">
                  wk {c.week}
                </span>
                <span
                  className={`num w-16 shrink-0 text-[12px] ${
                    c.outcome === "won" ? "text-good" : "text-alarm"
                  }`}
                >
                  {c.outcome === "won" ? "Delivered" : "Lost"}
                </span>
                <span className="min-w-0 flex-1 text-[13px] text-ink-soft">
                  {c.title}
                </span>
                {c.fee > 0 && (
                  <span className="num shrink-0 text-[12.5px] text-good">
                    {money(c.fee)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
