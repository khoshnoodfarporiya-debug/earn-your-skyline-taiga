"use client";

import type { WeekSummary } from "@/lib/game/types";
import { money } from "@/lib/game/format";

/**
 * Recent weekly performance as a column chart.
 *
 * "Is the practice improving or deteriorating?" is a question about a shape,
 * not a number — a run of shortening bars says it faster than any figure.
 *
 * History is recorded by the engine and saved with the run, so the trend
 * survives a reload rather than restarting empty each session.
 */
export function TrendCard({
  history,
  treatedShare,
}: {
  history: WeekSummary[];
  /** Share of last week's arrivals actually treated, if the career tracks it. */
  treatedShare?: number;
}) {
  // Defensive: a save that predates weekly history should degrade to the
  // empty state rather than take the whole screen down with it.
  const recent = (history ?? []).slice(-12);

  if (recent.length < 2) {
    return (
      <section className="form">
        <h3 className="form-head sign px-4 py-2.5 text-[11.5px] text-ink-soft">
          Recent weeks
        </h3>
        <p className="px-4 py-5 text-[14px] leading-relaxed text-ink-soft">
          Commit a few weeks and the trend in takings appears here.
        </p>
      </section>
    );
  }

  const peak = Math.max(...recent.map((r) => Math.abs(r.net)), 1);
  const latest = recent[recent.length - 1];
  const previous = recent[recent.length - 2];
  const delta = latest.net - previous.net;

  return (
    <section className="form">
      <h3 className="form-head sign px-4 py-2.5 text-[11.5px] text-ink-soft">
        Recent weeks
      </h3>

      <div className="px-4 py-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={`num text-2xl font-semibold tracking-tight ${latest.net >= 0 ? "text-good" : "text-alarm"}`}
          >
            {money(latest.net)}
          </span>
          <span className="text-[13px] text-ink-soft">
            last week ·{" "}
            <span className={delta >= 0 ? "text-good" : "text-alarm"}>
              {delta >= 0 ? "▲" : "▼"} {money(Math.abs(delta))}
            </span>{" "}
            on the week before
          </span>
        </div>

        {/* Columns above/below a zero rule. Height encodes magnitude; the
            side of the rule encodes profit or loss, so it reads without
            relying on colour. */}
        <div
          className="mt-3 flex h-24 items-stretch gap-1"
          role="img"
          aria-label={`Net result for the last ${recent.length} weeks, most recent ${money(latest.net)}`}
        >
          {recent.map((r) => {
            const magnitude = Math.min(1, Math.abs(r.net) / peak);
            const up = r.net >= 0;
            return (
              <div
                key={r.week}
                className="flex flex-1 flex-col justify-center"
                title={`Week ${r.week}: ${money(r.net)}`}
              >
                <div className="flex h-1/2 items-end">
                  {up && (
                    <div
                      className="w-full rounded-t-sm bg-good/70"
                      style={{ height: `${magnitude * 100}%` }}
                    />
                  )}
                </div>
                <div className="h-px w-full bg-rule" />
                <div className="flex h-1/2 items-start">
                  {!up && (
                    <div
                      className="w-full rounded-b-sm bg-alarm/70"
                      style={{ height: `${magnitude * 100}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="num mt-2 text-[12px] text-ink-faint">
          weeks {recent[0].week}–{latest.week}
          {treatedShare !== undefined &&
            ` · treated ${treatedShare}% of arrivals last week`}
        </p>
      </div>
    </section>
  );
}
