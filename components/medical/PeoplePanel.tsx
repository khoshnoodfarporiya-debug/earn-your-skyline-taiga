"use client";

import { Avatar } from "../ui/Avatar";
import { useState } from "react";
import type { RunState } from "@/lib/game/types";
import type { PersonState } from "@/lib/game/people";
import { standingOf } from "@/lib/game/people";
import { personDefIn } from "@/lib/ui/castAccess";
import { Panel } from "../ui/Panel";

/**
 * PEOPLE
 *
 * Characters, not a table.
 *
 * The obvious implementation is a grid with three numeric columns, and it
 * would be worse than useless: nobody forms an opinion about a person from
 * "warmth 42". So the card leads with who they are and what they last did
 * about you, and the numbers are a single line underneath.
 *
 * Progressive disclosure: the list shows face, name, role and standing; one
 * tap opens the bio, the numbers and their memory of you. On a phone that
 * means ten people fit on a screen instead of two.
 */
export function PeoplePanel({ state }: { state: RunState }) {
  const people = state.people ?? [];
  const careerId = state.careerId;
  const [open, setOpen] = useState<string | null>(null);

  if (people.length === 0) {
    return (
      <Panel
        title="People"
        note="Nobody yet. The people in a career arrive with the career."
      >
        <p className="text-[14px] text-ink-soft">
          The people you trained under, the ones across the table from you and
          the ones who will work for you appear as the run gives them a reason
          to.
        </p>
      </Panel>
    );
  }

  /* Whoever moved most recently first — the person you just disappointed is
     the one you came to this screen about. */
  const sorted = [...people].sort((a, b) => b.lastSeen - a.lastSeen);

  return (
    <Panel
      title="People"
      aside={`${people.filter((p) => p.status === "active").length} of ${people.length} on good terms`}
      note="They remember what you decided. What they remember changes what they offer you later."
      flush
    >
      <ul className="divide-y divide-rule-soft">
        {sorted.map((p) => (
          <PersonCard
            key={p.id}
            careerId={careerId}
            person={p}
            week={state.week}
            open={open === p.id}
            onToggle={() => setOpen(open === p.id ? null : p.id)}
          />
        ))}
      </ul>
    </Panel>
  );
}

function PersonCard({
  careerId,
  person,
  week,
  open,
  onToggle,
}: {
  /** Whose cast to look the authored detail up in. */
  careerId: string;
  person: PersonState;
  week: number;
  open: boolean;
  onToggle: () => void;
}) {
  const def = personDefIn(careerId, person.id);
  if (!def) return null;

  const silence = week - person.lastSeen;
  const standing = standingOf(person);
  const tone =
    person.status === "estranged" || person.warmth < -10
      ? "text-alarm"
      : person.warmth >= 40
        ? "text-good"
        : "text-ink-soft";

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-card-high"
      >
        {/* Keyed on the person id, not the handle: on this screen `meridian`
            is Dr Anneke Roth, and the handle would resolve to her employer. */}
        <Avatar
          name={def.name}
          personId={def.id}
          size={44}
          gone={person.status === "gone"}
        />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="t-card text-ink">{def.name}</span>
            <span className="num text-[11.5px] text-ink-faint">
              {def.title}
            </span>
          </span>
          <span className={`num block text-[12px] ${tone}`}>
            {standing}
            {person.status === "gone"
              ? " · no longer in your life"
              : silence > 20
                ? ` · not spoken in ${silence} weeks`
                : person.recent[0]
                  ? ` · ${person.recent[0].text}`
                  : ""}
          </span>
        </span>

        <span aria-hidden className="shrink-0 text-[13px] text-ink-faint">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="border-t border-rule-soft bg-paper px-4 py-3.5">
          {/*
           * The profile portrait sits beside the biography rather than above
           * it: a face at the top of an expanded card pushes the numbers the
           * screen exists for below the fold, and the point of the picture is
           * recognition, not spectacle. A rounded square rather than a circle,
           * because more of the frame survives.
           */}
          <div className="flex gap-3.5">
            <Avatar
              name={def.name}
              personId={def.id}
              size={88}
              variant="profile"
              gone={person.status === "gone"}
              className="hidden sm:block"
            />
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              {def.bio}
            </p>
          </div>

          <ul className="mt-3 flex flex-wrap gap-1.5">
            {def.traits.map((t) => (
              <li
                key={t}
                className="num rounded-sm bg-card px-1.5 py-0.5 text-[12px] text-ink-soft"
              >
                {t}
              </li>
            ))}
          </ul>

          <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-form bg-rule-soft">
            <Stat label="Warmth" value={person.warmth} signed />
            <Stat label="Trust" value={person.trust} />
            <Stat label="Respect" value={person.respect} />
          </dl>

          {person.recent.length > 0 && (
            <>
              <p className="t-label mt-3.5 text-ink-faint">Between you</p>
              <ul className="mt-1.5 space-y-1">
                {person.recent.map((r, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-[13px] leading-snug text-ink-soft"
                  >
                    <span className="num shrink-0 text-[11.5px] text-ink-faint">
                      wk {r.week}
                    </span>
                    <span
                      className={
                        r.tone === "bad"
                          ? "text-alarm"
                          : r.tone === "good"
                            ? "text-good"
                            : undefined
                      }
                    >
                      {r.text}
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
}

function Stat({
  label,
  value,
  signed,
}: {
  label: string;
  value: number;
  signed?: boolean;
}) {
  return (
    <div className="bg-card px-3 py-2">
      <dt className="t-label text-ink-faint">{label}</dt>
      <dd className="num mt-0.5 text-[15px] font-semibold text-ink">
        {signed && value > 0 ? "+" : ""}
        {Math.round(value)}
      </dd>
    </div>
  );
}
