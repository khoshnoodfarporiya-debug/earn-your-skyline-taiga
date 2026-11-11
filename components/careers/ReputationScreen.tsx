"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { kitchen } from "@/lib/game/careers/chef";
import { cityOf } from "@/lib/game/careers/kitchen";
import {
  STANDINGS,
  recentStanding,
  sceneScore,
  standingOf,
  standingWord,
  trendOf,
} from "@/lib/game/careers/standing";
import {
  COMPLAINT_RESPONSES,
  expectationOf,
  openComplaints,
  reachWordFor,
} from "@/lib/game/careers/buzz";
import {
  averageRating,
  recurringProblems,
} from "@/lib/game/careers/reviews";
import { CRITIC_BY_ID, watchLine } from "@/lib/game/careers/critics";
import { cityRank } from "@/lib/game/careers/competitors";
import { SEGMENT_BY_ID } from "@/lib/game/careers/diners";
import {
  guideScore,
  starAtRisk,
  starLevel,
  starsOf,
  towardsNext,
  weeksToGuide,
} from "@/lib/game/careers/guide";
import { CRITIC_ART } from "@/lib/ui/chefArt";
import { ChefScene } from "./ChefScene";

/**
 * WORD OF MOUTH
 *
 * The screen that answers "why is this happening to me". Everything on it is
 * a reason rather than a score: each of the seven bars carries the sentence
 * the simulation wrote when it moved, the reviews quote facts from nights
 * that actually ran, and the recurring-problems panel counts the complaints
 * that keep coming back and names the control that fixes each one.
 *
 * The one thing on this screen that is a decision rather than a read-out is
 * the open complaint. It sits at the top, because it is spreading while the
 * player reads the rest.
 */
export function ReputationScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const scores = standingOf(k, state.r.reputation);
  const changes = recentStanding(k, state.week, 4);
  const reviews = k.reviews ?? [];
  const problems = recurringProblems(reviews);
  const rating = averageRating(reviews);
  const complaints = openComplaints(k);
  const watch = k.criticWatch;
  const critic = watch ? CRITIC_BY_ID.get(watch.critic) : null;
  const verdicts = k.verdicts ?? [];
  const awards = k.awards ?? [];
  const rank = cityRank(k, sceneScore(k, state.r.reputation));
  const bar = expectationOf(k);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------ complaints */}
      {complaints.map((c) => (
        <section
          key={c.id}
          aria-labelledby={`cmp-${c.id}`}
          className="rounded-lg border border-alarm/50 bg-card p-4"
        >
          <h2 id={`cmp-${c.id}`} className="text-sm font-semibold text-ink">
            {c.author} has complained, and it is being shared
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            {reachWordFor(c.reach)} · raised in week {c.week}
            {state.week > c.week
              ? ` · ${state.week - c.week} week${state.week - c.week === 1 ? "" : "s"} unanswered`
              : ""}
          </p>
          <blockquote className="mt-2.5 border-l-2 border-rule pl-3 text-xs italic leading-relaxed text-ink-soft">
            {c.body}
          </blockquote>
          {/*
           * Whether it is true is *not* stated here, and that is the point of
           * the mechanic: the player has the service dashboard for that same
           * week, which says exactly what the waits and the mistakes were.
           * Reading it is the skill.
           */}
          <p className="mt-2 rounded border border-rule-soft px-3 py-1.5 text-xs text-ink-faint">
            Check the service for week {c.week} before you answer. The pass
            knows whether this happened.
          </p>

          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {COMPLAINT_RESPONSES.map((r) => (
              <li
                key={r.id}
                className="flex flex-col justify-between gap-2 rounded border border-rule-soft p-3 text-xs"
              >
                <div>
                  <p className="font-medium text-ink">{r.label}</p>
                  <p className="mt-0.5 text-ink-faint">{r.detail}</p>
                  <p className="mt-1 text-ink-faint">{r.worksWhen}</p>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <button
                    type="button"
                    disabled={c.answeredWeek === state.week}
                    onClick={() => onCommand("respondComplaint", `${c.id}|${r.id}`)}
                    className="rounded border border-rule px-2.5 py-1 text-ink enabled:hover:border-clinical disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {r.label}
                  </button>
                  <span className="text-ink-faint">{r.cost}</span>
                </div>
              </li>
            ))}
          </ul>
          {c.outcome && (
            <p className="mt-2 text-xs text-ink-soft">{c.outcome}</p>
          )}
        </section>
      ))}

      {/* ------------------------------------------------------- the guide */}
      <GuidePanel state={state} />

      {/* -------------------------------------------------- the seven parts */}
      <section
        aria-labelledby="standing-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="standing-h" className="text-sm font-semibold text-ink">
            What the city thinks
          </h2>
          <p className="text-xs text-ink-faint">
            Overall {Math.round(state.r.reputation)} ·{" "}
            {standingWord(state.r.reputation)}
          </p>
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          Seven parts, because &ldquo;reputation 62&rdquo; never told you which
          of your problems was the one costing you covers. Nothing here moves
          without a reason, and the reason is underneath it.
        </p>

        <ul className="mt-3 space-y-2.5">
          {STANDINGS.map((def) => {
            const value = scores[def.id];
            const trend = trendOf(k, def.id);
            const why = changes.find((c) => c.id === def.id);
            return (
              <li
                key={def.id}
                className="rounded border border-rule-soft px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium text-ink">{def.label}</span>
                  <span className="text-ink-faint">
                    {Math.round(value)} · {standingWord(value)}
                    {trend && Math.abs(trend.delta) >= 1 && (
                      <span
                        className={
                          trend.delta > 0 ? " text-good" : " text-alarm"
                        }
                      >
                        {" "}
                        {trend.delta > 0 ? "+" : ""}
                        {Math.round(trend.delta)} over{" "}
                        {(k.repTrend ?? []).length} weeks
                      </span>
                    )}
                  </span>
                </div>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-rule">
                  <span
                    className={`block h-1.5 rounded-full ${
                      value >= 62 ? "bg-good" : value >= 38 ? "bg-chef" : "bg-alarm"
                    }`}
                    style={{ width: `${Math.round(Math.max(2, value))}%` }}
                  />
                </span>
                <p className="mt-1 text-ink-faint">{def.hint}</p>
                {why && (
                  <p className="mt-1 text-ink-soft">
                    <span className="text-ink-faint">
                      wk {why.week} {why.delta > 0 ? "+" : ""}
                      {why.delta.toFixed(1)} —{" "}
                    </span>
                    {why.why}.
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-xs text-ink-faint">
          In {cityOf(k).name} you are {ordinal(rank.rank)} of {rank.of}
          {rank.above ? `, with ${rank.above} just above you` : ", at the top"}.
          {bar >= 5 &&
            ` Expectations are ${Math.round(bar)} points above where they would otherwise be — every night is now judged against what you have promised.`}
        </p>
      </section>

      {/* --------------------------------------------------- the complaints */}
      {problems.length > 0 && (
        <section
          aria-labelledby="problems-h"
          className="rounded-lg border border-caution/45 bg-card p-4"
        >
          <h2 id="problems-h" className="text-sm font-semibold text-ink">
            What keeps coming up
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            Counted across the {reviews.length} most recent reviews. One unhappy
            table is a restaurant; the same complaint five times is a fault.
          </p>
          <ul className="mt-2.5 space-y-2">
            {problems.map((p) => (
              <li key={p.tag} className="text-xs">
                <p className="text-ink">
                  <span className="font-medium">{p.label}</span> — {p.count} of
                  the last {p.of}.
                </p>
                <p className="mt-0.5 text-ink-faint">{p.fix}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------------- the critic */}
      {(watch || verdicts.length > 0 || awards.length > 0) && (
        <ChefScene
          art={CRITIC_ART}
          kicker="The press"
          title={
            watch && critic
              ? "Somebody is going to review you"
              : verdicts.length > 0
                ? "What has been written about you"
                : "The press"
          }
          note={
            watch && critic
              ? watchLine(watch, state.week)
              : verdicts[0]
                ? `${CRITIC_BY_ID.get(verdicts[0].critic)?.outlet}, week ${verdicts[0].week}`
                : undefined
          }
          tone={watch ? "warning" : "quiet"}
        >
          <div className="space-y-2.5 text-xs">
            {watch && critic && (
              <div>
                <p className="text-ink">
                  You do not know who, and you do not know which night. What you
                  have heard:
                </p>
                <ul className="mt-1.5 space-y-1">
                  {watch.clues.map((clue, i) => (
                    <li key={i} className="text-ink-soft">
                      &ldquo;{clue}&rdquo;
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {verdicts.slice(0, 2).map((v) => (
              <div key={v.id}>
                <p className="font-medium text-ink">
                  {CRITIC_BY_ID.get(v.critic)?.name} — {v.score} out of 100
                </p>
                <p className="mt-0.5 leading-relaxed text-ink-soft">{v.body}</p>
              </div>
            ))}
            {awards.length > 0 && (
              <div>
                <p className="font-medium text-ink">On the wall</p>
                <ul className="mt-0.5 space-y-0.5 text-ink-soft">
                  {awards.map((a) => (
                    <li key={`${a.week}-${a.label}`}>
                      {a.label} <span className="text-ink-faint">· wk {a.week}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ChefScene>
      )}

      {/* ------------------------------------------------------ the reviews */}
      <section
        aria-labelledby="reviews-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="reviews-h" className="text-sm font-semibold text-ink">
            What people wrote
          </h2>
          {rating !== null && (
            <p className="text-xs text-ink-faint">
              {rating} out of 5 across {reviews.length}
            </p>
          )}
        </div>
        {reviews.length === 0 ? (
          <p className="mt-3 rounded border border-dashed border-rule px-3 py-4 text-center text-xs text-ink-faint">
            Nobody has written about you yet. Serve a night and they will.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {reviews.slice(0, 8).map((r) => (
              <li
                key={r.id}
                className="rounded border border-rule-soft px-3 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium text-ink">
                    {r.author}
                    <span className="ml-2 font-normal text-ink-faint">
                      {SEGMENT_BY_ID.get(r.segment)?.label ?? r.segment}
                    </span>
                  </span>
                  <span
                    className={
                      r.rating >= 4
                        ? "text-good"
                        : r.rating <= 2
                          ? "text-alarm"
                          : "text-ink-faint"
                    }
                  >
                    {r.rating} / 5 · wk {r.week}
                  </span>
                </div>
                <p className="mt-1 leading-relaxed text-ink-soft">{r.body}</p>
                {r.dish && (
                  <p className="mt-1 text-ink-faint">
                    Ordered the {r.dish.toLowerCase()} · waited{" "}
                    {Math.round(r.wait * 15)} minutes
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * THE GUIDE
 *
 * Separate from the critics below it, and the screen says why: a critic
 * writes a piece and moves on, and the guide comes back every year and can
 * take back what it gave.
 *
 * It shows the six things the guide measures all year round rather than only
 * in the week it publishes, because a standard nobody can see is a lottery.
 * It never shows a formula and never promises a star.
 */
function GuidePanel({ state }: { state: RunState }) {
  const k = kitchen(state);
  const stars = starsOf(k);
  const level = starLevel(stars);
  const score = guideScore(k, state.r.reputation);
  const toward = towardsNext(k, state.r.reputation);
  const risk = starAtRisk(k, state.r.reputation);
  const away = weeksToGuide(state.week);
  const history = k.guide ?? [];

  return (
    <section
      aria-labelledby="guide-h"
      className={`rounded-lg border bg-card p-4 ${
        risk ? "border-alarm/50" : stars > 0 ? "border-good/40" : "border-rule"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="guide-h" className="text-sm font-semibold text-ink">
          The guide
        </h2>
        <p className="text-xs text-ink-faint">
          {stars > 0 ? level.label : "Not in the guide"} · publishes in {away}{" "}
          week{away === 1 ? "" : "s"}
        </p>
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        {stars > 0
          ? level.blurb
          : "It comes once a year, measures the same six things in every restaurant it visits, and gives no reasons."}
      </p>

      {stars > 0 && (
        <p className="mt-2 text-xs text-ink-soft">
          A star fills the room and raises what a cover is worth — and it is a
          standard you now have to hold. Every night is judged{" "}
          {level.expectation} points harder than it would otherwise be.
        </p>
      )}
      {risk && (
        <p className="mt-2 rounded border border-alarm/50 px-3 py-1.5 text-xs text-alarm">
          On current form this is close to what the guide takes a star back
          for. It gives no warning of its own.
        </p>
      )}

      <ul className="mt-3 space-y-1.5">
        {score.parts.map((part) => (
          <li key={part.id} className="text-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-ink">{part.label}</span>
              <span
                className={
                  part.id === toward.weakest?.id ? "text-alarm" : "text-ink-faint"
                }
              >
                {Math.round(part.value)}
              </span>
            </div>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-rule">
              <span
                className={`block h-1 rounded-full ${
                  part.id === toward.weakest?.id ? "bg-alarm" : "bg-good/70"
                }`}
                style={{ width: `${Math.round(Math.max(2, part.value))}%` }}
              />
            </span>
            <p className="mt-0.5 text-ink-faint">{part.note}</p>
          </li>
        ))}
      </ul>

      {toward.next && (
        <p className="mt-2.5 text-xs text-ink-faint">
          {toward.short === 0
            ? `On current form ${toward.next.label.toLowerCase()} is within reach.`
            : `${toward.short} points short of ${toward.next.label.toLowerCase()}.`}
          {toward.weakest &&
            ` Their weakest note would be ${toward.weakest.label.toLowerCase()}.`}
        </p>
      )}

      {history.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-rule pt-2.5 text-xs">
          {history.slice(0, 3).map((g) => (
            <li key={g.week}>
              <span className="text-ink-faint">wk {g.week} — </span>
              <span
                className={
                  g.to > g.from
                    ? "text-good"
                    : g.to < g.from
                      ? "text-alarm"
                      : "text-ink-soft"
                }
              >
                {g.note}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const ordinal = (n: number): string => {
  if (n === 1) return "first";
  if (n === 2) return "second";
  if (n === 3) return "third";
  if (n === 4) return "fourth";
  return `${n}th`;
};

/** Kept beside the screen it belongs to, so the money format is one import. */
export const complaintCost = (amount: number): string => money(amount);
