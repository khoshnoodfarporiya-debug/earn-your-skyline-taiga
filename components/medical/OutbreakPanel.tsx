"use client";

import type { ScreenId } from "@/lib/ui/navigation";
import { EmptyState } from "../ui/EmptyState";
import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import { cityOf } from "@/lib/game/medical/cities";
import { SPECIALTY_BY_ID, colourFor } from "@/lib/game/medical/data";
import {
  OUTBREAKS,
  OUTBREAK_BY_ID,
  outbreakPressure,
  pressureBand,
  severityCeiling,
} from "@/lib/game/medical/outbreaks";
import { money } from "@/lib/game/format";
import { OUTBREAK_VISUAL } from "@/lib/ui/visuals";
import { ArtFrame } from "../visuals/ArtFrame";
import { DEPARTMENT_BY_ID } from "@/lib/ui/departments";
import { MedIcon } from "../visuals/MedIcon";
import {
  OUTBREAK_CONTAINMENT_ART,
  asBanner,
} from "@/lib/ui/careerSceneArt";

const SEVERITY_TONE = [
  "",
  "#6FD08C",
  "#F5A623",
  "#FF8551",
  "#FF6B6B",
  "#FF4D4D",
];

const BAND_TONE = {
  low: "text-good",
  rising: "text-caution",
  high: "text-caution",
  severe: "text-alarm",
} as const;

const BAND_WORD = {
  low: "Low",
  rising: "Rising",
  high: "High",
  severe: "Severe",
} as const;

/**
 * WHAT THE WORLD IS ABOUT TO DO
 *
 * The spawn roll is a pure function of the week and how many cities you run,
 * so there is no reason to hide it. Showing it turns outbreaks from a thing
 * that happens to you into a cost of expansion you can see coming — and it
 * makes the endgame legible: the same board is more dangerous at week 120
 * than it was at week 20, and now you can watch that happen.
 *
 * The numbers here are read from the same functions the simulation rolls
 * against, never re-derived, so the display cannot drift from the rules.
 */
function PressureStrip({ week, cities }: { week: number; cities: number }) {
  const p = outbreakPressure(week, cities);
  const band = pressureBand(p);
  const ceiling = severityCeiling(week);
  /* 0.22 is the cap in outbreakPressure — a full bar means "as bad as it gets". */
  const fill = Math.min(100, Math.round((p / 0.22) * 100));

  return (
    <section className="form px-5 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="t-label text-ink-faint">Outbreak pressure</h3>
        <span className={`num text-[12.5px] ${BAND_TONE[band]}`}>
          {BAND_WORD[band]} · {(p * 100).toFixed(1)}% a week
        </span>
      </div>

      <div className="well mt-2.5 h-1.5 overflow-hidden p-0">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            band === "severe"
              ? "bg-alarm"
              : band === "low"
                ? "bg-good"
                : "bg-caution"
          }`}
          style={{ width: `${fill}%` }}
        />
      </div>

      <p className="t-body mt-2 text-ink-soft">
        {cities === 0
          ? "You operate nowhere, so nothing can reach you."
          : `Every city you run is exposure, and the years add to it. Worst pathogen the world will send you now: severity ${ceiling} of 5.`}
      </p>
    </section>
  );
}

export function OutbreakPanel({
  state,
  dispatch,
  onNavigate,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  const m = med(state);
  const hasPharmacy = m.equipment.includes("pharmacy");
  const containmentUnderway = m.outbreaks.some((o) => o.contained);

  return (
    <div className="space-y-4">
      <PressureStrip week={state.week} cities={m.cities.length} />

      <section className="form overflow-hidden">
        {/*
         * Only while something is actually spreading. A quiet week gets the
         * plain header — the picture is a signal, not wallpaper.
         */}
        {m.outbreaks.length > 0 && (
          <ArtFrame
            visual={
              containmentUnderway
                ? asBanner(OUTBREAK_CONTAINMENT_ART)
                : OUTBREAK_VISUAL
            }
            ratio="aspect-[21/9] sm:aspect-[21/6]"
            scrim="bottom"
            sizes="(min-width: 1152px) 1104px, 100vw"
            className="fade border-b border-rule"
          >
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-3.5 sm:px-5">
              <p className="display text-2xl leading-none text-ink drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                {containmentUnderway ? "Containment underway" : "Outbreak response"}
              </p>
              <p className="num text-[12.5px] text-alarm drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                {m.outbreaks.length} running in{" "}
                {new Set(m.outbreaks.map((o) => o.city)).size}{" "}
                {new Set(m.outbreaks.map((o) => o.city)).size === 1
                  ? "city"
                  : "cities"}
              </p>
            </div>
          </ArtFrame>
        )}

        <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
          <h3 className="sign text-[11.5px] text-ink-soft">Active outbreaks</h3>
          <span className="num text-[12px] text-ink-soft">
            {m.outbreaks.length} running · {m.solved.length} solved
          </span>
        </div>

        {m.outbreaks.length === 0 ? (
          <EmptyState
            icon="shield"
            what="Nothing is spreading. It will not last."
            why="The weekly chance of an outbreak rises with the years and with how many cities you hold — the pressure figure above is the actual roll the simulation makes."
            can="Nothing to do today. The preparation that helps is a pathology lab, a pharmacy and slack in your capacity, all of which are worth having anyway."
            go={{ label: "Look at capacity", destination: "caseload" }}
            onNavigate={onNavigate}
          />
        ) : (
          <div className="divide-y divide-rule-soft">
            {m.outbreaks.map((active) => {
              const def = OUTBREAK_BY_ID.get(active.id);
              if (!def) return null;
              const key = `${active.id}:${active.city}`;
              const tone = SEVERITY_TONE[def.severity];
              const canContain =
                !active.contained && state.r.cash >= def.containCost;
              const canResearch =
                state.r.cash >= def.researchCost &&
                state.r.cpd >= def.researchCpd;
              const canVaccinate =
                def.vaccineCost > 0 &&
                hasPharmacy &&
                state.r.cash >= def.vaccineCost;

              return (
                <div
                  key={key}
                  className="spine px-4 py-4"
                  style={{ ["--dept" as string]: tone }}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="display text-lg" style={{ color: tone }}>
                      {def.label}
                    </h4>
                    <span className="num text-[12px] text-ink-soft">
                      {cityOf(active.city).name} · severity {def.severity} ·{" "}
                      {Math.ceil(active.weeksLeft)} wk left
                    </span>
                  </div>
                  <p className="num text-[11.5px] text-ink-faint">
                    {def.pathogen}
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                    {def.blurb}
                  </p>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {def.affects.map((sp) => (
                      <span
                        key={sp}
                        className="num flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[12.5px]"
                        style={{
                          background: `${colourFor(sp)}22`,
                          color: colourFor(sp),
                        }}
                      >
                        <MedIcon
                          name={DEPARTMENT_BY_ID.get(sp)?.icon ?? "stethoscope"}
                          className="h-3.5 w-3.5"
                        />
                        {SPECIALTY_BY_ID.get(sp)?.label} ×{def.surge.toFixed(1)}
                        {!m.departments.includes(sp) && " · not open"}
                      </span>
                    ))}
                    {active.contained && (
                      <span className="num rounded-sm bg-clinical-tint px-1.5 py-0.5 text-[12.5px] text-clinical">
                        contained
                      </span>
                    )}
                  </div>

                  <p className="num mt-2 text-[12px] text-alarm">
                    +{def.riskPerWeek.toFixed(1)} risk and{" "}
                    {def.reputationPerWeek.toFixed(1)} reputation every week it
                    runs
                  </p>

                  {/* The three things a clinician actually has. */}
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <button
                      onClick={() => dispatch("contain", key)}
                      disabled={!canContain}
                      className="rounded-form border border-rule bg-card px-3 py-2 text-left transition hover:border-clinical disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="sign block text-[11.5px] text-clinical">
                        Contain
                      </span>
                      <span className="num mt-0.5 block text-[12px] text-ink-soft">
                        {active.contained
                          ? "already in place"
                          : money(def.containCost)}
                      </span>
                      <span className="mt-1 block text-[12.5px] leading-snug text-ink-faint">
                        Isolation and screening. Blunts it, does not end it.
                      </span>
                    </button>

                    <button
                      onClick={() => dispatch("research", key)}
                      disabled={!canResearch}
                      className="rounded-form border border-rule bg-card px-3 py-2 text-left transition hover:border-clinical disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="sign block text-[11.5px] text-clinical">
                        Research
                      </span>
                      <span className="num mt-0.5 block text-[12px] text-ink-soft">
                        {money(def.researchCost)} · {def.researchCpd} CPD
                      </span>
                      <span className="mt-1 block text-[12.5px] leading-snug text-ink-faint">
                        Solve the pathogen for good. Publishable.
                      </span>
                    </button>

                    <button
                      onClick={() => dispatch("vaccinate", key)}
                      disabled={!canVaccinate}
                      className="rounded-form border border-rule bg-card px-3 py-2 text-left transition hover:border-clinical disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="sign block text-[11.5px] text-clinical">
                        Vaccinate
                      </span>
                      <span className="num mt-0.5 block text-[12px] text-ink-soft">
                        {def.vaccineCost > 0
                          ? money(def.vaccineCost)
                          : "no vaccine exists"}
                      </span>
                      <span className="mt-1 block text-[12.5px] leading-snug text-ink-faint">
                        {def.vaccineCost <= 0
                          ? "Nothing to immunise against."
                          : hasPharmacy
                            ? "Ends it here. Enormous public standing."
                            : "Needs a dispensing pharmacy."}
                      </span>
                    </button>
                  </div>

                  <p className="mt-2 text-[12.5px] leading-snug text-ink-faint">
                    Or ride it out — a surge is billable work if you have the
                    capacity for it.
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- research */}
      <section className="form">
        <div className="form-head px-5 py-2.5">
          <h3 className="sign text-[11.5px] text-ink-soft">
            Pathogen register
          </h3>
        </div>
        <p className="border-b border-rule-soft px-5 py-2.5 text-[12px] text-ink-soft">
          Anything you have published on never returns to any of your cities.
        </p>
        <div className="grid gap-px bg-rule-soft sm:grid-cols-2">
          {OUTBREAKS.map((o) => {
            const solved = m.solved.includes(o.id);
            const running = m.outbreaks.some((a) => a.id === o.id);
            return (
              <div
                key={o.id}
                className={`px-4 py-2.5 ${solved ? "bg-clinical-tint" : "bg-card"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13.5px] text-ink">{o.label}</span>
                  <span
                    className={`num text-[11.5px] ${
                      solved
                        ? "text-clinical"
                        : running
                          ? "text-alarm"
                          : "text-ink-faint"
                    }`}
                  >
                    {solved ? "SOLVED" : running ? "ACTIVE" : "—"}
                  </span>
                </div>
                <p className="num text-[11.5px] text-ink-faint">{o.pathogen}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
