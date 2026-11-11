"use client";

import { EmptyState } from "../ui/EmptyState";
import type { RunState } from "@/lib/game/types";
import { timelineOf, type TimelineKind } from "@/lib/game/timeline";
import { upcoming } from "@/lib/game/consequences";
import { Panel } from "../ui/Panel";
import { MILESTONE_ART } from "@/lib/ui/careerSceneArt";
import { ArtFrame } from "../visuals/ArtFrame";

/**
 * THE TIMELINE
 *
 * What actually happened, oldest first.
 *
 * Every entry was written by the simulation at the moment the thing became
 * true — there is no generator here and no inference. That is why a run
 * migrated from an older save shows a gap at the start rather than a
 * plausible-looking history: the entries it never recorded are simply not
 * facts this game knows.
 *
 * The "what is coming" panel is the other half. Delayed consequences that the
 * fiction says you would know about carry a notice, and this is where you can
 * see them — a decision with a fuse on it should not be invisible.
 */

const KIND_TONE: Record<TimelineKind, string> = {
  start: "bg-rule",
  qualification: "bg-clinical",
  promotion: "bg-clinical",
  business: "bg-info",
  expansion: "bg-info",
  people: "bg-good",
  social: "bg-gold",
  crisis: "bg-caution",
  award: "bg-gold",
  money: "bg-good",
  failure: "bg-alarm",
  recovery: "bg-good",
};

const KIND_WORD: Record<TimelineKind, string> = {
  start: "Beginning",
  qualification: "Qualification",
  promotion: "Promotion",
  business: "Business",
  expansion: "Expansion",
  people: "People",
  social: "Public",
  crisis: "Crisis",
  award: "Recognition",
  money: "Money",
  failure: "Failure",
  recovery: "Recovery",
};

export function TimelinePanel({ state }: { state: RunState }) {
  const entries = timelineOf(state);
  const ahead = upcoming(state);

  return (
    <div className="space-y-4">
      {ahead.length > 0 && (
        <Panel
          title="Still to come"
          note="Decisions you have already made that have not finished happening."
          flush
        >
          <ul className="divide-y divide-rule-soft">
            {ahead.map((p) => (
              <li key={p.id} className="flex items-baseline gap-3 px-5 py-3">
                <span className="num w-16 shrink-0 text-[12px] text-caution">
                  wk {p.dueWeek}
                </span>
                <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink-soft">
                  {p.notice}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Your career so far"
        aside={`${entries.length} ${entries.length === 1 ? "moment" : "moments"}`}
        note="Recorded as it happened. Nothing here is reconstructed."
        flush
      >
        {entries.length === 0 ? (
          <EmptyState
            icon="certificate"
            what="Nothing recorded yet"
            why="Milestones are written the week they become true — a first hire, a qualification, a city, a claim lost. Nothing here is reconstructed afterwards."
            can="Play a few weeks. The first entry usually arrives with your first hire or your first department."
          />
        ) : (
          <ol className="px-5 py-4">
            {entries.map((e, i) => (
              <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
                {/* The spine. Drawn per-item rather than as one absolute
                    element so it never runs past the last entry. */}
                {i < entries.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[5px] top-4 h-full w-px bg-rule-soft"
                  />
                )}
                <span
                  aria-hidden
                  className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ${KIND_TONE[e.kind]}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="num text-[12px] text-ink-faint">
                      Week {e.week}
                    </span>
                    <span className="sign text-[11px] text-ink-faint">
                      {KIND_WORD[e.kind]}
                    </span>
                  </div>
                  <h4 className="t-card mt-0.5 text-ink">{e.title}</h4>
                  {MILESTONE_ART[e.id] ? (
                    <ArtFrame
                      visual={MILESTONE_ART[e.id]}
                      ratio="aspect-[3/1]"
                      scrim="bottom"
                      sizes="(min-width: 768px) 560px, 85vw"
                      className="mt-2 rounded-form border border-rule-soft"
                    />
                  ) : null}
                  <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
                    {e.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
