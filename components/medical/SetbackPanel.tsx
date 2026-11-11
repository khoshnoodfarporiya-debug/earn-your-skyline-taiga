"use client";

import type { RunState } from "@/lib/game/types";
import {
  RECOVERY,
  SETBACK_BLURB,
  SETBACK_LABEL,
  gripWord,
  type ActiveSetback,
} from "@/lib/game/setbacks";
import { ActionButton } from "../ui/ItemCard";
import { SETBACK_ART, asBanner } from "@/lib/ui/careerSceneArt";
import { ArtFrame } from "../visuals/ArtFrame";

/**
 * A SETBACK, AND THE WAY OUT
 *
 * Rendered above every screen, like a crisis, because this is the state the
 * player most needs to be able to act on — and because a setback used to be a
 * results screen, so it had better be visibly *not* one.
 *
 * The panel's job is to answer one question: what do I do about this. Every
 * route out is listed, with what it requires; the ones you do not qualify for
 * are shown greyed with the reason rather than hidden, so the player can see
 * what they are working toward.
 */
export function SetbackPanel({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const list = state.setbacks ?? [];
  if (list.length === 0) return null;
  return (
    <div className="space-y-4">
      {list.map((sb) => (
        <SetbackCard key={sb.kind} sb={sb} state={state} dispatch={dispatch} />
      ))}
    </div>
  );
}

function SetbackCard({
  sb,
  state,
  dispatch,
}: {
  sb: ActiveSetback;
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const steps = RECOVERY[sb.kind] ?? [];
  const remaining = steps.filter((x) => !sb.done.includes(x.id));

  return (
    <section
      className="spine form overflow-hidden"
      style={{ ["--dept" as string]: "#EF6461" }}
    >
      <ArtFrame
        visual={asBanner(SETBACK_ART[sb.kind])}
        ratio="aspect-[21/6]"
        scrim="full"
        sizes="(min-width: 1152px) 1104px, 100vw"
        className="border-b border-rule"
      >
        <div className="absolute inset-x-0 bottom-0 px-5 py-3">
          <p className="sign text-[11px] text-alarm drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
            Active setback · recovery remains possible
          </p>
        </div>
      </ArtFrame>
      <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
        <h3 className="t-label text-alarm">{SETBACK_LABEL[sb.kind]}</h3>
        <span className="num text-[12px] text-ink-soft">
          {gripWord(sb.grip)} · week {sb.weeks} of it
        </span>
      </div>

      <div className="px-5 py-3">
        <div
          className="well h-1.5 overflow-hidden p-0"
          role="meter"
          aria-valuenow={Math.round(sb.grip)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${SETBACK_LABEL[sb.kind]} severity`}
        >
          <div
            className="h-full rounded-full bg-alarm transition-[width] duration-500"
            style={{ width: `${sb.grip}%` }}
          />
        </div>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">
          {SETBACK_BLURB[sb.kind]}
        </p>
        {/* The line that makes this not a game-over screen. */}
        <p className="num mt-2 text-[12.5px] text-clinical">
          This does not end your career. It is going to take a while.
        </p>
      </div>

      <div className="border-t border-rule-soft px-5 py-3.5">
        <p className="t-label text-ink-faint">The way back</p>
        {remaining.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-soft">
            You have done everything available. What is left is time.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {remaining.map((step) => {
              const ready = step.available(state);
              return (
                <li
                  key={step.id}
                  className="rounded-form bg-card-high px-4 py-3"
                >
                  <p
                    className={`text-[14px] font-semibold ${ready ? "text-ink" : "text-ink-faint"}`}
                  >
                    {step.label}
                  </p>
                  <p className="num mt-0.5 text-[12.5px] text-ink-soft">
                    {step.detail}
                  </p>
                  <div className="mt-2.5">
                    <ActionButton
                      onClick={() =>
                        dispatch("recoverSetback", `${sb.kind}:${step.id}`)
                      }
                      disabled={!ready}
                    >
                      {ready ? "Do this" : "Not yet"}
                    </ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {sb.done.length > 0 && (
          <p className="num mt-3 text-[12px] text-good">
            Already done: {sb.done.length} of {steps.length}.
          </p>
        )}
      </div>
    </section>
  );
}
