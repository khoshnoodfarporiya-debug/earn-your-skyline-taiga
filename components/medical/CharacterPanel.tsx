"use client";

import type { RunState } from "@/lib/game/types";
import { AMBITIONS, currentAmbition, isComplete } from "@/lib/game/ambitions";
import { backgroundOf } from "@/lib/game/backgrounds";
import { TRAIT_CAP, traitProgress } from "@/lib/game/traits";
import { Panel } from "../ui/Panel";
import { ActionButton } from "../ui/ItemCard";

/**
 * WHO YOU ARE
 *
 * Background, personality, and the thing you decided this career was for.
 *
 * The design note that shaped this: personality is a *readout*, not a
 * character sheet you fill in. So held traits are shown as facts about you,
 * and unheld ones are shown as progress bars with the behaviour that earns
 * them — the player can see they are two-thirds of the way to being thought
 * ruthless, and can decide whether they want that.
 *
 * Ambitions are the one thing here the player picks directly, and picking one
 * changes nothing mechanically except which progress bar is on screen. That is
 * deliberate: an ambition is a lens on the run, not a buff.
 */
export function CharacterPanel({
  state,
  dispatch,
  onRetire,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
  /** Opens the summary. Cancellable, and writes nothing on its own. */
  onRetire?: () => void;
}) {
  const bg = backgroundOf(state);
  const traits = traitProgress(state);
  const held = traits.filter((t) => t.held);
  const earning = traits
    .filter((t) => !t.held && t.progress > 0)
    .sort((a, b) => b.progress - a.progress);
  const ambition = currentAmbition(state);

  return (
    <div className="space-y-4">
      {bg && (
        <Panel title="Where you came from" aside={bg.label} flush>
          <div className="px-5 py-4">
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              {bg.blurb}
            </p>
            <dl className="mt-3 grid gap-px overflow-hidden rounded-form bg-rule-soft sm:grid-cols-2">
              <div className="bg-card px-4 py-2.5">
                <dt className="t-label text-good">What it gave you</dt>
                <dd className="mt-0.5 text-[13px] text-ink-soft">
                  {bg.benefit}
                </dd>
              </div>
              <div className="bg-card px-4 py-2.5">
                <dt className="t-label text-caution">What it cost you</dt>
                <dd className="mt-0.5 text-[13px] text-ink-soft">{bg.cost}</dd>
              </div>
            </dl>
          </div>
        </Panel>
      )}

      <Panel
        title="Personality"
        aside={`${held.length} of ${TRAIT_CAP}`}
        note="Two came from your background. The rest are earned by what you keep doing, and none of them can be traded away."
        flush
      >
        {held.length > 0 && (
          <ul className="divide-y divide-rule-soft">
            {held.map(({ def }) => (
              <li key={def.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="t-card text-ink">{def.label}</h4>
                  <span className="num text-[11.5px] text-clinical">held</span>
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
                  {def.blurb}
                </p>
                <p className="num mt-1.5 text-[12px] text-good">
                  Opens: {def.unlocks}
                </p>
                <p className="num text-[12px] text-caution">
                  Costs: {def.friction}
                </p>
              </li>
            ))}
          </ul>
        )}

        {earning.length > 0 && (
          <div className="border-t border-rule-soft px-5 py-3.5">
            <p className="t-label text-ink-faint">Becoming</p>
            <ul className="mt-2 space-y-2.5">
              {earning.slice(0, 4).map(({ def, progress }) => (
                <li key={def.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13.5px] text-ink">{def.label}</span>
                    <span className="num text-[12px] text-ink-faint">
                      {Math.round(progress * 100)}%
                    </span>
                  </div>
                  <div className="well mt-1 h-1 overflow-hidden p-0">
                    <div
                      className="h-full rounded-full bg-caution transition-[width] duration-500"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[12px] text-ink-soft">
                    {def.earnedBy}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {held.length === 0 && earning.length === 0 && (
          <p className="px-5 py-5 text-[14px] text-ink-soft">
            Nothing settled yet. Personality here is a description of how you
            have been playing, and you have not been playing long.
          </p>
        )}
      </Panel>

      {onRetire && (
        <Panel
          title="Finishing"
          note="Only you decide when this character's story is over. There is no week, wealth or rank that ends it for you."
        >
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            Retiring writes {state.week} weeks into your Career Archive and
            stops play as this character. You will see the full summary first
            and can back out of it.
          </p>
          <div className="mt-3">
            <ActionButton variant="quiet" onClick={onRetire}>
              Consider retiring…
            </ActionButton>
          </div>
        </Panel>
      )}

      <Panel
        title="What this is for"
        aside={ambition ? "1 chosen" : "none chosen"}
        note="A long-term ambition. Meeting one is celebrated and then you carry on — it is not a win condition."
        flush
      >
        <ul className="divide-y divide-rule-soft">
          {AMBITIONS.map((a) => {
            const done = isComplete(state, a.id);
            const active = ambition?.id === a.id;
            const progress = a.progress(state);
            return (
              <li key={a.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4
                    className={`t-card ${done ? "text-good" : active ? "text-clinical" : "text-ink"}`}
                  >
                    {a.label}
                  </h4>
                  {done ? (
                    <span className="num text-[11.5px] text-good">met</span>
                  ) : (
                    <span className="num text-[12px] text-ink-faint">
                      {Math.round(progress * 100)}%
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
                  {a.blurb}
                </p>

                {!done && (
                  <>
                    <div className="well mt-2 h-1 overflow-hidden p-0">
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${active ? "bg-clinical" : "bg-rule"}`}
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                    <p className="num mt-1 text-[12px] text-ink-faint">
                      {a.readout(state)}
                    </p>
                    <p className="mt-1 text-[12px] leading-snug text-caution">
                      {a.tension}
                    </p>
                    {!active && (
                      <div className="mt-2.5">
                        <ActionButton
                          variant="quiet"
                          onClick={() => dispatch("setAmbition", a.id)}
                        >
                          Make this the goal
                        </ActionButton>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
