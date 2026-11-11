"use client";

import type { CareerDef, RunState } from "@/lib/game/types";
import type { Alert } from "@/lib/ui/alerts";
import { med } from "@/lib/game/careers/doctor";
import { cityOf } from "@/lib/game/medical/cities";
import { PRACTICE_STAGES, practiceStageIndex, sectionVisual } from "@/lib/ui/visuals";
import { ArtFrame } from "../visuals/ArtFrame";

/**
 * THE OVERVIEW HERO
 *
 * The one place the run states what it is: who you are, how far in, where you
 * are standing, what you have built, and the single most urgent thing wrong.
 *
 * Everything on it is live HTML over the artwork — nothing is baked into the
 * picture. That matters beyond pedantry: the week counter and the warning
 * change every turn, and a screen reader gets a heading and a sentence rather
 * than "image".
 *
 * It is the only above-the-fold image in the app and therefore the only one
 * marked `priority`. It is also deliberately shallow: the weekly decision is
 * the point of this screen, and a hero that pushes it down has taken more
 * than it gave.
 */
export function OverviewHero({
  career,
  state,
  alerts,
}: {
  career: CareerDef;
  state: RunState;
  alerts: Alert[];
}) {
  const m = state.careerId === "doctor" ? med(state) : null;
  const stage = m ? practiceStageIndex(m) : -1;
  /* The practice ladder is the Physician's. A career without one shows what
     it is worth instead of being told it has no premises — a Chef starts on a
     market stall, so "No premises yet" was simply untrue. */
  const stageLabel = m
    ? (PRACTICE_STAGES[stage]?.label ?? "No premises yet")
    : career.scoreboard(state).label;
  const city = m ? cityOf(m.homeCity) : null;
  const urgent =
    alerts.find((a) => a.severity === "critical") ?? alerts[0] ?? null;

  /*
   * One sentence about the state of the run. Chosen from real figures rather
   * than written per-week, and ordered so the worst news wins: a practice
   * bleeding money does not need to be told how many patients it has.
   */
  const line = (() => {
    if (state.r.cash < 0) return "You are overdrawn. Fix the cash before anything else.";
    if (m && m.outbreaks.length > 0) {
      return `${m.outbreaks.length} outbreak${m.outbreaks.length === 1 ? "" : "s"} running in your network.`;
    }
    if (state.r.burnout >= 70) return "You are running on empty. Rest is not optional now.";
    if (state.r.debt <= 0) return "Debt-free. Everything from here is yours.";
    /*
     * The patient list is a Physician fact. A Chef has no `panel` at all, so
     * this read `NaN patients on your list` on their first week — visible on
     * screen, in the largest type the game uses. Every career has a
     * scoreboard, so fall through to the one it defines for itself.
     */
    if (!m) return career.scoreboard(state).sub;
    return `${Math.round(state.r.panel).toLocaleString("en-US")} patients on your list.`;
  })();

  /* Where you are and what you have built are medical framings; a career
     without them shows its own headline instead of two em dashes. */
  const facts: [string, string][] = m
    ? [
        ["Week", `${state.week}`],
        ["Based in", city?.name ?? "—"],
        ["Practice", stageLabel],
      ]
    : [
        ["Week", `${state.week}`],
        [career.scoreboard(state).label, career.scoreboard(state).value],
      ];

  return (
    <section aria-labelledby="overview-hero-title" className="form overflow-hidden">
      <ArtFrame
        visual={sectionVisual("overview")}
        /*
         * A fixed height rather than a ratio. The ratio alone gave a 370px
         * hero on a wide screen, which pushed the week's controls off the
         * fold — and the whole point of this screen is the week.
         *
         * Not `aspect-… max-h-…`: with both set, the browser satisfies the
         * ratio by shrinking the *width*, which left a third of the banner as
         * empty background. A fixed height with a full-width frame lets
         * `object-cover` crop, which is what was wanted.
         */
        ratio="h-[180px] w-full sm:h-[220px]"
        scrim="full"
        sizes="(min-width: 1152px) 1104px, 100vw"
        priority
      >
        <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="sign text-[11.5px] text-clinical drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                {career.label}
              </p>
              <h1
                id="overview-hero-title"
                className="display mt-0.5 text-[26px] leading-none text-ink drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] sm:text-4xl"
              >
                {stageLabel}
              </h1>
              <p className="mt-1.5 text-[13.5px] leading-snug text-ink-soft drop-shadow-[0_1px_5px_rgba(0,0,0,0.95)]">
                {line}
              </p>
            </div>

            {/* The most urgent warning, if the run has one. Colour is backed
                by the word "Warning" so it never depends on the red alone. */}
            {urgent && (
              <p
                className={`shrink-0 rounded-form border px-2.5 py-1.5 text-[12px] leading-tight backdrop-blur-[2px] ${
                  urgent.severity === "critical"
                    ? "border-alarm/60 bg-alarm-tint/95 text-alarm"
                    : "border-caution/60 bg-[#070E19]/85 text-caution"
                }`}
              >
                <span className="sign block text-[11px] opacity-80">
                  {urgent.severity === "critical" ? "Urgent" : "Warning"}
                </span>
                {urgent.title}
              </p>
            )}
          </div>

          <div>
            <dl className="flex flex-wrap gap-x-5 gap-y-1">
              {facts.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="sign text-[11px] text-ink-faint drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                    {label}
                  </dt>
                  <dd className="num truncate text-[14px] font-semibold text-ink drop-shadow-[0_1px_5px_rgba(0,0,0,0.95)]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {/* No run-progress hairline: see `StatusStrip`. There is no
                clock to draw. */}
          </div>
        </div>
      </ArtFrame>
    </section>
  );
}
