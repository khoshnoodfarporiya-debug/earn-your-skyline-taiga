"use client";

import { Avatar } from "../ui/Avatar";
import { useState } from "react";
import type { RunState } from "@/lib/game/types";
import { STANCE_WORD, STRATEGY_WORD } from "@/lib/game/rivals";
import { personIn, standingOf } from "@/lib/game/people";
import { CAST_BY_ID } from "@/lib/game/medical/cast";
import { cityOf } from "@/lib/game/medical/cities";
import { money } from "@/lib/game/format";
import { Panel } from "../ui/Panel";

/**
 * THE COMPETITION
 *
 * Five careers, summarised.
 *
 * The design note from the brief was "visible but not intrusive", which is why
 * this is a screen you visit rather than a stream you cannot escape: rival
 * moves reach the player as news items in the phone, and this is where you go
 * when one of them starts mattering.
 *
 * Each card leads with what they are *doing* — their strategy and their last
 * move — because that is the thing that changes your decisions. The numbers
 * are one tap down.
 */
export function RivalsPanel({ state }: { state: RunState }) {
  const rivals = state.rivals ?? [];
  const [open, setOpen] = useState<string | null>(null);

  if (rivals.length === 0) {
    return (
      <Panel
        title="The competition"
        note="Nobody on your radar yet. They arrive with the run."
      >
        <p className="text-[14px] text-ink-soft">
          Other people are building careers at the same time as you. You will
          hear about them before you meet them.
        </p>
      </Panel>
    );
  }

  const sorted = [...rivals].sort((a, b) => b.standing - a.standing);

  return (
    <Panel
      title="The competition"
      aside={`${rivals.filter((r) => r.stance === "enemy" || r.stance === "competitor").length} competing with you`}
      note="They progress whether or not you are watching. Beating one to a contract is something they remember."
      flush
    >
      {/* Labelled so a screen reader announces what the list is when jumping
          into it, rather than "list, five items". */}
      <ul aria-label="Rivals" className="divide-y divide-rule-soft">
        {sorted.map((r) => {
          const def = CAST_BY_ID.get(r.id);
          if (!def) return null;
          const person = personIn(state, r.id);
          const expanded = open === r.id;

          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : r.id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-card-high"
              >
                {/* Their own face, not a silhouette. These are colleagues who
                    happen to compete with you — the panel's copy is careful
                    about that, and a generic villain tile would undo it. */}
                <Avatar name={def.name} personId={r.id} size={44} />

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="t-card text-ink">{def.name}</span>
                    <span className="num text-[11.5px] text-ink-faint">
                      {STRATEGY_WORD[r.strategy]}
                    </span>
                  </span>
                  <span className="block text-[12.5px] text-ink-soft">
                    {r.history[0]
                      ? `Week ${r.history[0].week}: ${r.history[0].text}`
                      : `Based in ${cityOf(r.city as never).name}`}
                  </span>
                </span>

                <span
                  className={`num shrink-0 text-[11.5px] ${
                    r.stance === "enemy"
                      ? "text-alarm"
                      : r.stance === "ally"
                        ? "text-good"
                        : "text-ink-faint"
                  }`}
                >
                  {STANCE_WORD[r.stance]}
                </span>
              </button>

              {expanded && (
                <div className="border-t border-rule-soft bg-paper px-4 py-3.5">
                  <p className="text-[13.5px] leading-relaxed text-ink-soft">
                    {def.bio}
                  </p>

                  <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-form bg-rule-soft sm:grid-cols-4">
                    <Cell label="Standing" value={Math.round(r.standing)} />
                    <Cell label="Sites" value={r.sites} />
                    <Cell label="Business" value={money(r.worth)} />
                    <Cell
                      label="Against you"
                      value={`${r.wins}–${r.losses}`}
                      note="their wins–losses"
                    />
                  </dl>

                  {person && (
                    <p className="num mt-2.5 text-[12.5px] text-ink-soft">
                      Personally: {standingOf(person).toLowerCase()} · warmth{" "}
                      {Math.round(person.warmth)} · respect{" "}
                      {Math.round(person.respect)}
                    </p>
                  )}

                  {r.history.length > 0 && (
                    <>
                      <p className="t-label mt-3 text-ink-faint">
                        What they have been doing
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {r.history.slice(0, 6).map((h, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-[13px] leading-snug text-ink-soft"
                          >
                            <span className="num shrink-0 text-[11.5px] text-ink-faint">
                              wk {h.week}
                            </span>
                            <span
                              className={
                                h.kind === "setback"
                                  ? "text-good"
                                  : h.kind === "clash"
                                    ? "text-caution"
                                    : undefined
                              }
                            >
                              {h.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Cell({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="bg-card px-3 py-2">
      <dt className="t-label text-ink-faint">{label}</dt>
      <dd className="num mt-0.5 text-[14px] font-semibold text-ink">{value}</dd>
      {note && <dd className="text-[11.5px] text-ink-faint">{note}</dd>}
    </div>
  );
}
