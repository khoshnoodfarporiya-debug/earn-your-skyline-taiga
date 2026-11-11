"use client";

import Image from "next/image";
import type { MedicalState } from "@/lib/game/medical/types";
import { FACILITY_BY_ID } from "@/lib/game/medical/data";
import { activeCities } from "@/lib/game/medical/sim";
import { money } from "@/lib/game/format";
import { MedIcon, type MedIconName } from "./MedIcon";
import {
  PRACTICE_STAGES,
  PRACTICE_VISUAL,
  practiceStageIndex,
} from "@/lib/ui/visuals";

/* Kept on next/image directly rather than ArtFrame: the per-stage veils need
   to sit between the photograph and the caption scrim, which the shared
   frame deliberately does not allow. */

/**
 * Practice evolution.
 *
 * One cutaway strip of all four premises, with everything you have not built
 * yet held behind a veil. The point is environmental — this is the street
 * your practice stands on, and it fills in as you buy — rather than a
 * shop window for things you could purchase.
 *
 * The current stage is named in text as well as marked, so the state is not
 * carried by the picture alone.
 */
export function PracticeEvolution({
  m,
  cash = 0,
}: {
  m: MedicalState;
  /** Used only to say whether the next rung is within reach. */
  cash?: number;
}) {
  const current = practiceStageIndex(m);
  const cities = activeCities(m).length;
  const currentStage = PRACTICE_STAGES[current] ?? null;
  const nextStage = PRACTICE_STAGES[current + 1] ?? null;

  return (
    <section className="form overflow-hidden">
      <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
        <h3 className="sign text-[11.5px] text-ink-faint">
          Practice evolution
        </h3>
        <p className="num text-[12px] text-ink-soft">
          Stage {Math.max(1, current + 1)} of {PRACTICE_STAGES.length}
        </p>
      </div>

      {/*
       * A fixed height, so the space is reserved before the image arrives and
       * nothing below it shifts.
       *
       * Deliberately not `aspect-… max-h-…`: with both set the browser honours
       * the ratio by shrinking the width instead of the height, which leaves a
       * band of empty background beside the picture. A fixed height on a
       * full-width box lets `object-cover` do the cropping.
       */}
      <div className="relative h-[190px] w-full sm:h-[240px]">
        <Image
          src={PRACTICE_VISUAL.src}
          alt={PRACTICE_VISUAL.alt}
          fill
          /*
           * This is the largest thing on the Build screen and sits above the
           * fold, so it is the Largest Contentful Paint element and is marked
           * accordingly. Nothing else in the app is — the map draws itself
           * and event artwork stays lazy behind a dialog.
           */
          priority
          /* The panel spans the full content column: max-w-6xl (1152px) less
             48px of padding at desktop, and the viewport width below that. */
          sizes="(min-width: 1152px) 1104px, 100vw"
          className="object-cover"
          style={{ objectPosition: PRACTICE_VISUAL.focus }}
        />

        {/* Veil every stage that is not yet built, and mark the one that is. */}
        <div className="absolute inset-0 flex" aria-hidden>
          {PRACTICE_STAGES.map((stage, i) => {
            const owned = i <= current;
            const isCurrent = i === current;
            return (
              <div
                key={stage.id}
                className="relative h-full"
                style={{ width: `${stage.to - stage.from}%` }}
              >
                {!owned && (
                  <div className="absolute inset-0 bg-[#070E19]/80 backdrop-grayscale" />
                )}
                {isCurrent && (
                  <>
                    {/* Lift the stage you actually own out of the murk. The
                        first one is a dim interior and was near-black on a
                        phone once the caption scrim landed on top of it. */}
                    <div className="absolute inset-0 bg-clinical/[0.07]" />
                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-clinical shadow-[0_0_12px_rgba(53,224,192,0.8)]" />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Readability scrim under the caption — kept shallow so it darkens
            the text band and not the building above it. */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0B1526] via-[#0B1526]/70 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-x-3 gap-y-1 p-3.5">
          <p className="display text-[17px] leading-tight text-ink sm:text-xl">
            {currentStage?.label ?? "No premises yet"}
          </p>
          {nextStage && (
            <p className="num text-[12.5px] text-ink-faint">
              Next: {nextStage.label}
            </p>
          )}
        </div>
      </div>

      {/*
       * The same progression as text, which is what a screen reader gets —
       * and, since it has to exist anyway, the place to put the figures the
       * photograph cannot carry.
       *
       * Every rung states its capacity, its department slots, what it costs to
       * buy and what it costs every week thereafter. Celebrating a progression
       * while hiding its running cost would be the picture selling the player
       * something.
       */}
      <ol className="divide-y divide-rule-soft border-t border-rule">
        {LADDER.map((rung, i) => {
          const owned = rung.id === "network" ? cities > 1 : i <= current;
          const isCurrent =
            rung.id === "network" ? false : i === current && cities <= 1;
          const isNext =
            !owned &&
            (rung.id === "network" ? current >= 1 : i === current + 1);
          const facility =
            rung.id === "network" ? null : FACILITY_BY_ID.get(rung.id as never);

          return (
            <li
              key={rung.id}
              aria-current={isCurrent ? "step" : undefined}
              className={`px-4 py-3 ${isCurrent ? "bg-clinical-tint" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 shrink-0 ${
                    isCurrent
                      ? "text-clinical"
                      : owned
                        ? "text-ink-soft"
                        : "text-ink-faint"
                  }`}
                >
                  <MedIcon name={rung.icon} className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p
                      className={`text-[13.5px] font-semibold ${owned ? "text-ink" : "text-ink-faint"}`}
                    >
                      {rung.label}
                    </p>
                    {/* The state as a word, always. The tint agrees with it
                        rather than carrying it. */}
                    <p
                      className={`t-label ${
                        isCurrent
                          ? "text-clinical"
                          : owned
                            ? "text-ink-soft"
                            : isNext
                              ? "text-gold"
                              : "text-ink-faint"
                      }`}
                    >
                      {isCurrent
                        ? "Where you are"
                        : owned
                          ? "Built"
                          : isNext
                            ? "Next"
                            : "Later"}
                    </p>
                  </div>

                  <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">
                    {rung.unlocks}
                  </p>

                  {facility && (
                    <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                      <Fact label="Slots" value={`${facility.slots}`} />
                      <Fact
                        label="Departments"
                        value={`${facility.departmentSlots}`}
                      />
                      <Fact label="To buy" value={money(facility.cost)} />
                      <Fact
                        label="Every week"
                        value={money(facility.upkeep)}
                        caution
                      />
                    </dl>
                  )}

                  {isNext && facility && (
                    <p className="mt-1.5 text-[12px] text-gold">
                      {cash >= facility.cost
                        ? "Affordable now, at Lyon prices. Property costs more in richer markets."
                        : `${money(facility.cost - cash)} short at Lyon prices.`}
                    </p>
                  )}
                  {isNext && !facility && (
                    <p className="mt-1.5 text-[12px] text-gold">
                      Take a licence and build in a second market. Staff spread
                      across the network; your own hours stay where you are.
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Fact({
  label,
  value,
  caution,
}: {
  label: string;
  value: string;
  caution?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="t-label text-ink-faint">{label}</dt>
      <dd
        className={`num text-[12.5px] ${caution ? "text-caution" : "text-ink-soft"}`}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * The five rungs.
 *
 * Four are premises the game already models. The fifth is a network, which is
 * not a building you buy — but it is unmistakably the next thing after a
 * hospital, and leaving it off made the progression look finished one step
 * early. Its `unlocks` line says what it actually changes rather than implying
 * it is another purchase.
 */
const LADDER: {
  id: string;
  label: string;
  icon: MedIconName;
  unlocks: string;
}[] = [
  {
    id: "room",
    label: "Rented exam room",
    icon: "clinic",
    unlocks: "One department, and your own two hands. Everything is you.",
  },
  {
    id: "clinic",
    label: "Community clinic",
    icon: "clinic",
    unlocks:
      "A front desk, a waiting room and three departments. The first point at which hiring beats working harder.",
  },
  {
    id: "centre",
    label: "Medical centre",
    icon: "bed",
    unlocks:
      "Real diagnostic space. Six departments, and enough slots that staffing rather than room becomes the limit.",
  },
  {
    id: "hospital",
    label: "Regional hospital",
    icon: "bed",
    unlocks:
      "Wards, theatres and an emergency entrance. Twelve departments — every field in the game at once.",
  },
  {
    id: "network",
    label: "Multi-city network",
    icon: "globe",
    unlocks:
      "Premises in more than one market. Demand, fees and outbreaks all become local, and staff spread across sites while your own hours stay where you are.",
  },
];
