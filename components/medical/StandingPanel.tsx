"use client";

import type { RunState } from "@/lib/game/types";
import {
  overallReputation,
  recentRepChanges,
  repWord,
} from "@/lib/game/reputation";
import { standingRows } from "@/lib/ui/standing";
import type { ScreenId } from "@/lib/ui/navigation";
import { MedIcon } from "../visuals/MedIcon";
import { Sparkline } from "../visuals/Sparkline";
import { Panel } from "../ui/Panel";

/**
 * STANDING
 *
 * Six numbers, each with the thing that moves it written next to it, and a
 * list underneath of what actually moved them in the last few weeks.
 *
 * The reason this is a screen and not six more meters on the Overview: a bar
 * that changes without saying why is the exact failure this system was built
 * to fix. Every entry in the "what changed" list is a real `applyRep` call
 * with its stated reason, so the explanation cannot drift from the maths.
 */
export function StandingPanel({
  state,
  onNavigate,
}: {
  state: RunState;
  onNavigate: (screen: ScreenId) => void;
}) {
  const overall = overallReputation(state);
  const changes = recentRepChanges(state, 6);
  /* Twelve weeks of history per category, reconstructed exactly by walking
     the log backwards from the current value. */
  const rows = standingRows(state, 12);

  return (
    <div className="space-y-4">
      <Panel
        title="Overall"
        aside={`${Math.round(overall)} · ${repWord(overall)}`}
        note="A weighted blend of the five standing categories, scaled by whether you are believed to be honest. Credibility carries the most weight; ethics multiplies the rest."
      >
        <Bar value={overall} />
      </Panel>

      {/*
       * Six separate labelled indicators, deliberately not a radar chart.
       *
       * A hexagon would fit all six on one screen and answer none of the
       * questions that matter — which way is it moving, why, what does it do,
       * and what raises it. Those four things are a paragraph each, so the
       * layout is a list.
       */}
      <Panel title="How you are seen" flush>
        <ul className="divide-y divide-rule-soft">
          {rows.map((row) => {
            /* The most recent movement for this category, so the "why" is
               attached to the number rather than filed separately. */
            const last = changes.find((c) => c.id === row.id);
            return (
              <li key={row.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="t-card flex items-center gap-2 text-ink">
                    <span className="text-ink-faint">
                      <MedIcon name={row.guide.icon} className="h-4 w-4" />
                    </span>
                    {row.label}
                  </h4>
                  <p className="flex items-baseline gap-2">
                    {/* Direction over twelve weeks, which a value and a
                        delta together still cannot show. */}
                    <Sparkline
                      values={row.trend}
                      tone={
                        row.delta > 0.5
                          ? "good"
                          : row.delta < -0.5
                            ? "bad"
                            : "neutral"
                      }
                    />
                    <span className="num text-[15px] font-semibold text-ink">
                      {Math.round(row.value)}
                    </span>
                    <span className="text-[12px] font-normal text-ink-soft">
                      {repWord(row.value)}
                    </span>
                  </p>
                </div>

                <Bar value={row.value} />

                {/* Movement over the window, in words as well as in the line. */}
                <p className="num mt-1.5 text-[12px]">
                  <span
                    className={
                      Math.abs(row.delta) < 0.5
                        ? "text-ink-faint"
                        : row.delta > 0
                          ? "text-good"
                          : "text-alarm"
                    }
                  >
                    {Math.abs(row.delta) < 0.5
                      ? "Flat over 12 weeks"
                      : `${row.delta > 0 ? "+" : "−"}${Math.abs(row.delta).toFixed(1)} over 12 weeks`}
                  </span>
                  {last && <span className="text-ink-soft"> — {last.why}</span>}
                </p>

                <dl className="mt-2.5 space-y-1.5 border-t border-rule-soft pt-2">
                  <div>
                    {/* The mechanisms that touch this number, from the game
                        data — kept distinct from the route below, which is
                        advice about what to do next. */}
                    <dt className="t-label text-ink-faint">Moved by:</dt>
                    <dd className="num mt-0.5 text-[12px] text-ink-faint">
                      {row.driver}
                    </dd>
                  </div>
                  <div>
                    <dt className="t-label text-ink-faint">What it does</dt>
                    <dd className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">
                      {row.guide.effect}
                    </dd>
                  </div>
                  <div>
                    <dt className="t-label text-ink-faint">How to raise it</dt>
                    <dd className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">
                      {row.guide.route}
                    </dd>
                    <dd className="mt-1.5">
                      <button
                        type="button"
                        onClick={() => onNavigate(row.guide.destination)}
                        className="min-h-[44px] rounded-form bg-card-high px-3 text-[12.5px] text-clinical transition hover:text-clinical-hover"
                      >
                        Go there
                      </button>
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel
        title="What changed"
        aside={`last ${Math.min(6, state.week)} weeks`}
        note="Every movement, with the reason recorded at the moment it happened."
        flush
      >
        {changes.length === 0 ? (
          <p className="px-5 py-5 text-[14px] text-ink-soft">
            Nothing has moved recently. Standing drifts slowly when the weeks
            are quiet.
          </p>
        ) : (
          <ul className="divide-y divide-rule-soft">
            {changes.slice(0, 24).map((c, i) => (
              <li
                key={`${c.week}-${c.id}-${i}`}
                className="flex items-baseline gap-3 px-5 py-2"
              >
                <span className="num w-12 shrink-0 text-[12px] text-ink-faint">
                  wk {c.week}
                </span>
                <span
                  className={`num w-12 shrink-0 text-[12.5px] ${
                    c.delta > 0 ? "text-good" : "text-alarm"
                  }`}
                >
                  {c.delta > 0 ? "+" : "−"}
                  {Math.abs(c.delta).toFixed(1)}
                </span>
                <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink-soft">
                  {c.why}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/**
 * Continuous, not segmented — the segmented instrument look belonged to the
 * previous visual system and was removed with it.
 */
function Bar({ value }: { value: number }) {
  const tone =
    value >= 62 ? "bg-good" : value >= 40 ? "bg-caution" : "bg-alarm";
  return (
    <div
      className="well mt-2 h-1.5 overflow-hidden p-0"
      role="meter"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${tone}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
