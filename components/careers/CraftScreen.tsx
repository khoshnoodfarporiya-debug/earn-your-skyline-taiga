"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { kitchen, localSum } from "@/lib/game/careers/chef";
import {
  DISCIPLINES,
  RANKS,
  STAGES,
  TECHNIQUES,
  chefRank,
  knowsTechnique,
  nextRank,
  rankIndex,
  stageBlocker,
  techniqueBlocker,
} from "@/lib/game/careers/craft";
import { BRIGADE_ART } from "@/lib/ui/chefArt";
import { ChefScene } from "./ChefScene";

/**
 * THE CRAFT
 *
 * What the chef can personally do, what they are learning, and where they
 * could go to learn faster.
 *
 * It is under "You" rather than under Kitchen because none of it belongs to
 * the restaurant. A technique learned is learned whatever room you are
 * standing in, and it is the only thing on any of these screens that cannot
 * be bought — practice takes blocks of the week, and a stage takes the whole
 * week.
 */
export function CraftScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const rank = chefRank(k, state.r.reputation);
  const next = nextRank(k, state.r.reputation);
  const rankAt = rankIndex(k, state.r.reputation);
  const progress = k.techniques ?? {};
  const chosen = k.practising;
  const staging = (k.stagingUntil ?? 0) > state.week;
  const done = k.stages ?? [];

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- the standing */}
      <ChefScene
        art={BRIGADE_ART}
        kicker="In the trade"
        title={rank.label}
        note={rank.blurb}
        tone={rankAt >= 3 ? "live" : "quiet"}
      >
        <div className="space-y-2 text-xs">
          <p className="text-ink-soft">
            This is not a title you buy. It is computed from what you have
            actually done — techniques learned, stars held, the room you run and
            whether the city has a dish it associates with you — and it decides
            who will come and work for you, which kitchens will have you for a
            stage, and what you get offered.
          </p>
          {next && (
            <p className="text-ink-faint">
              {next.short} points from{" "}
              <span className="text-ink">{next.rank.label.toLowerCase()}</span>.
            </p>
          )}
          <ol className="mt-1 flex flex-wrap gap-1">
            {RANKS.map((r, i) => (
              <li
                key={r.id}
                className={`rounded-sm border px-1.5 py-0.5 text-[11px] ${
                  i === rankAt
                    ? "border-chef/60 text-chef"
                    : i < rankAt
                      ? "border-rule text-ink-faint"
                      : "border-rule-soft text-ink-faint/60"
                }`}
              >
                {r.label}
              </li>
            ))}
          </ol>
        </div>
      </ChefScene>

      {/* ------------------------------------------------------ the techniques */}
      <section
        aria-labelledby="tech-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="tech-h" className="text-sm font-semibold text-ink">
          What you can do
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Fourteen techniques across five disciplines. Every one is learned by
          doing the work — a block of practice, a week in somebody else&rsquo;s
          kitchen, or twenty weeks of cooking it — and every one does a stated
          thing rather than adding to a score.
          {chosen && (
            <>
              {" "}
              Practice blocks are currently going into{" "}
              <span className="text-ink">
                {TECHNIQUES.find((t) => t.id === chosen)?.label.toLowerCase()}
              </span>
              .
            </>
          )}
        </p>

        <div className="mt-3 space-y-4">
          {DISCIPLINES.map((discipline) => {
            const list = TECHNIQUES.filter((t) => t.discipline === discipline.id);
            return (
              <div key={discipline.id}>
                <h3 className="sign text-[11.5px] text-ink-soft">
                  {discipline.label}
                </h3>
                <p className="text-xs text-ink-faint">{discipline.blurb}</p>
                <ul className="mt-2 space-y-2">
                  {list.map((t) => {
                    const held = progress[t.id] ?? 0;
                    const known = knowsTechnique(k, t.id);
                    const why = techniqueBlocker(k, t);
                    const locked = !known && !!why;
                    return (
                      <li
                        key={t.id}
                        className={`rounded border px-3 py-2 text-xs ${
                          known
                            ? "border-good/40"
                            : chosen === t.id
                              ? "border-chef/50"
                              : "border-rule-soft"
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span
                            className={`font-medium ${known ? "text-good" : "text-ink"}`}
                          >
                            {t.label}
                          </span>
                          <span className="text-ink-faint">
                            {known ? "Learned" : `${held} of ${t.cost}`}
                          </span>
                        </div>
                        {!known && (
                          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-rule">
                            <span
                              className="block h-1.5 rounded-full bg-chef"
                              style={{
                                width: `${Math.round((held / t.cost) * 100)}%`,
                              }}
                            />
                          </span>
                        )}
                        <p className="mt-1 text-ink-faint">{t.blurb}</p>
                        <p className="mt-0.5 text-ink-soft">{t.effect}</p>
                        {!known && (
                          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                            {/* The one already chosen is a statement, not a
                                greyed-out control: a disabled button with
                                nothing to say is the dead end this project
                                refuses to ship. */}
                            {chosen === t.id ? (
                              <span className="rounded border border-chef/50 px-2.5 py-1 text-chef">
                                Practising this
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={locked}
                                onClick={() => onCommand("setPractice", t.id)}
                                className="rounded border border-rule px-2.5 py-1 text-ink enabled:hover:border-clinical disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                Practise this
                              </button>
                            )}
                            {locked && (
                              <span className="text-ink-faint">{why}</span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------- the stages */}
      <section
        aria-labelledby="stage-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="stage-h" className="text-sm font-semibold text-ink">
          A week in somebody else&rsquo;s kitchen
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Unpaid, exhausting, and the fastest way to learn anything. You pay for
          the travel and you lose most of the week — the services you were going
          to open are services you do not open, and the rent arrives anyway.
        </p>
        {staging && (
          <p className="mt-2 rounded border border-chef/45 px-3 py-1.5 text-xs text-chef">
            You are away this week. Your own kitchen is running without you.
          </p>
        )}
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {STAGES.map((stage) => {
            const why = stageBlocker(stage, k, state.r.reputation, done);
            const price = localSum(state, stage.cost);
            const poor = state.r.cash < price;
            return (
              <li
                key={stage.id}
                className="flex flex-col justify-between gap-2 rounded border border-rule-soft p-3 text-xs"
              >
                <div>
                  <p className="font-medium text-ink">{stage.label}</p>
                  <p className="mt-0.5 text-ink-faint">
                    {stage.city} · {stage.discipline}
                  </p>
                  <p className="mt-1 text-ink-faint">{stage.blurb}</p>
                  <p className="mt-1 text-ink-soft">
                    {stage.points} points, +{stage.burnout} burnout, and most of
                    a week you will not trade in.
                  </p>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <button
                    type="button"
                    disabled={!!why || poor || staging}
                    onClick={() => onCommand("stage", stage.id)}
                    className="rounded border border-rule px-2.5 py-1 text-ink enabled:hover:border-clinical disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {money(price)}
                  </button>
                  {(why || poor || staging) && (
                    <span className="text-ink-faint">
                      {why ?? (poor ? "Costs more than you have" : "Not yet — you are away this week")}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
