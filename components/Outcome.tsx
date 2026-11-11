"use client";

import type { CareerDef, RunState } from "@/lib/game/types";
import { formatResource } from "@/lib/game/format";
import { MILESTONE_VISUAL } from "@/lib/ui/visuals";
import { ArtFrame } from "./visuals/ArtFrame";

export function Outcome({
  career,
  state,
  onRestart,
  onMenu,
}: {
  career: CareerDef;
  state: RunState;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const outcome = state.outcome!;
  const won = outcome.kind === "won";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-14 sm:px-8">
      {/*
       * The milestone artwork is shown for a WON run and nothing else. The
       * doctor career grants that only when the student debt is cleared and
       * net worth clears the goal — a timeout or a collapse gets the plain
       * stamped header below, because it has not been earned.
       */}
      {won && (
        <ArtFrame
          visual={MILESTONE_VISUAL}
          ratio="aspect-[21/9]"
          scrim="full"
          sizes="(min-width: 768px) 672px, 100vw"
          priority
          className="rise mb-8 rounded-form border border-clinical/40 shadow-[0_0_40px_-16px_rgba(53,224,192,0.55)]"
        >
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            <span className="sign text-[11.5px] text-clinical drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              Milestone reached
            </span>
            {/* The page heading, not a styled paragraph: a won run must still
                announce itself to a screen reader the way a lost one does. */}
            <h1 className="display mt-1 text-3xl leading-none text-ink drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] sm:text-4xl">
              {outcome.title}
            </h1>
          </div>
        </ArtFrame>
      )}

      {/* The file is closed and stamped. */}
      <div className="rise">
        <div className="flex items-baseline gap-3">
          <span
            className={`sign text-[11.5px] ${won ? "text-good" : "text-alarm"}`}
          >
            {won ? "Case closed" : "File closed"}
          </span>
          <span className="h-px flex-1 bg-rule" />
          <span className="num text-[12px] text-ink-faint">
            WEEK {state.week}
          </span>
        </div>

        {!won && (
          <h1 className="display mt-6 text-5xl leading-[1.02] sm:text-6xl">
            {outcome.title}
          </h1>
        )}
        <p
          className={`text-[15px] leading-relaxed text-ink-soft ${won ? "mt-4" : "mt-5"}`}
        >
          {outcome.body}
        </p>
      </div>

      <div className="form rise mt-10" style={{ animationDelay: "80ms" }}>
        <h2 className="form-head sign px-5 py-2.5 text-[11.5px] text-ink-soft">
          Final position
        </h2>
        <div className="grid grid-cols-2 gap-px bg-rule-soft sm:grid-cols-4">
          {career.resources.map((def) => (
            <div key={def.id} className="bg-card px-4 py-3">
              <p className="sign text-[11.5px] text-ink-faint">{def.label}</p>
              <p className="num mt-0.5 text-base">
                {formatResource(def, state.r[def.id] ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="rise mt-7 flex flex-wrap gap-3"
        style={{ animationDelay: "160ms" }}
      >
        <button
          onClick={onRestart}
          className="rounded-form bg-clinical px-5 py-2.5 text-sm font-medium text-on-accent transition hover:brightness-110"
        >
          Run it again
        </button>
        <button
          onClick={onMenu}
          className="rounded-form border border-rule bg-card px-5 py-2.5 text-sm font-medium transition hover:border-clinical hover:text-clinical"
        >
          Choose another career
        </button>
      </div>

      <div className="form rise mt-10" style={{ animationDelay: "240ms" }}>
        <h2 className="form-head sign px-5 py-2.5 text-[11.5px] text-ink-soft">
          How it went
        </h2>
        <ol className="scroll-thin max-h-64 overflow-y-auto">
          {state.log.map((entry, i) => (
            <li
              key={i}
              className="spine flex gap-3 border-b border-rule-soft px-4 py-2.5 text-[13.5px] leading-relaxed last:border-0"
              style={{
                ["--dept" as string]:
                  entry.tone === "bad"
                    ? "#FF6B6B"
                    : entry.tone === "good"
                      ? "#4ADE80"
                      : "#26375A",
              }}
            >
              <span className="num shrink-0 text-ink-faint">w{entry.week}</span>
              <span className="text-ink-soft">{entry.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
