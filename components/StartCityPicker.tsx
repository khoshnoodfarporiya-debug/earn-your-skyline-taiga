"use client";

import { useState } from "react";
import type { StartCity } from "@/lib/game/types";
import { MAP_VIEWBOX, sy } from "@/lib/ui/worldmap";
import { CITY_POSITIONS } from "@/lib/ui/worldmap.generated";
import { MapSurface } from "@/components/visuals/map/MapSurface";

/**
 * WHERE DO YOU START?
 *
 * The second half of choosing a career, and a real decision rather than a
 * flavour dropdown: every city on this screen changes numbers the simulation
 * reads, and each card states which ones. The careers generate those lines
 * from their own tables (see `startCities` on each `CareerDef`), so a card
 * cannot advertise a market that does not exist.
 *
 * ------------------------------------------------------------------- the map
 *
 * The map is here to answer "where *is* that" — it is a second view of the
 * same list, not the only way to choose. Every city is reachable from the list
 * below it, which is also the reliable path for a screen reader and the one
 * that works on a phone where a 4px marker is not a touch target.
 *
 * It is deliberately the same coastline the Physician's network map draws:
 * `MapSurface` is career-agnostic and shared, so the world does not change
 * shape between screens.
 */
export function StartCityPicker({
  careerLabel,
  cities,
  onBegin,
  onBack,
}: {
  careerLabel: string;
  cities: StartCity[];
  onBegin: (cityId: string) => void;
  onBack: () => void;
}) {
  const [picked, setPicked] = useState(cities[0]?.id ?? "");
  const chosen = cities.find((c) => c.id === picked) ?? cities[0];
  if (!chosen) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-10 sm:px-8">
      <header className="rise">
        <div className="flex items-baseline gap-3">
          <span className="sign text-[12px] text-clinical">{careerLabel}</span>
          <span className="h-px flex-1 bg-rule" />
          <span className="num text-[12px] text-ink-faint">
            {cities.length} PLACES
          </span>
        </div>
        <h1 className="display mt-4 text-3xl leading-none">Where do you start?</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          Chosen once, and you do not move. Every city here changes what the
          work is worth, what it costs to be there and what walks through the
          door — the whole run is played against the one you pick.
        </p>
      </header>

      {/* ------------------------------------------------------------- map */}
      <section
        className="rise mt-7 overflow-hidden rounded-form border border-rule bg-card"
        aria-label={`Map of where a ${careerLabel} can start`}
      >
        <div className="relative w-full" style={{ aspectRatio: "100 / 56" }}>
          <MapSurface viewBox={MAP_VIEWBOX} />

          <svg
            viewBox={`0 0 ${MAP_VIEWBOX.w} ${MAP_VIEWBOX.h}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            {cities.map((c) => {
              const p = CITY_POSITIONS[c.position];
              if (!p) return null;
              const on = c.id === chosen.id;
              return (
                <g key={c.id}>
                  {on && (
                    <circle cx={p.x} cy={sy(p.y)} r={2.6} fill="#35E0C0" opacity={0.16} />
                  )}
                  <circle
                    cx={p.x}
                    cy={sy(p.y)}
                    r={on ? 0.72 : 0.5}
                    fill={on ? "#35E0C0" : "#7C8CA6"}
                  />
                </g>
              );
            })}
          </svg>

          {/*
           * Labels live in HTML rather than SVG: the board is drawn with a
           * non-uniform `preserveAspectRatio`, which would stretch any text
           * inside it horizontally.
           */}
          {cities.map((c) => {
            const p = CITY_POSITIONS[c.position];
            if (!p) return null;
            const on = c.id === chosen.id;
            return (
              <span
                key={c.id}
                aria-hidden
                className={`pointer-events-none absolute -translate-x-1/2 translate-y-2 whitespace-nowrap text-[11px] tracking-wide ${
                  on ? "font-medium text-clinical" : "text-ink-faint"
                }`}
                style={{
                  left: `${p.x}%`,
                  top: `${(sy(p.y) / MAP_VIEWBOX.h) * 100}%`,
                }}
              >
                {c.name}
              </span>
            );
          })}
        </div>
      </section>

      {/* ----------------------------------------------------------- cards */}
      <ul className="rise mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cities.map((c) => {
          const on = c.id === chosen.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setPicked(c.id)}
                aria-pressed={on}
                className={`flex h-full w-full flex-col rounded-form border p-4 text-left transition ${
                  on
                    ? "border-clinical bg-clinical-tint"
                    : "border-rule bg-card hover:border-clinical/60"
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="display text-lg leading-none text-ink">
                    {c.name}
                  </span>
                  <span
                    className={`sign shrink-0 text-[11.5px] ${
                      c.difficulty === "hard"
                        ? "text-alarm"
                        : c.difficulty === "gentle"
                          ? "text-good"
                          : "text-caution"
                    }`}
                  >
                    {c.difficulty === "hard"
                      ? "HARD"
                      : c.difficulty === "gentle"
                        ? "GENTLE"
                        : "EVEN"}
                  </span>
                </span>
                <span className="mt-0.5 block text-[12px] text-ink-faint">
                  {c.country}
                </span>
                <span className="mt-2 block text-[13px] leading-relaxed text-ink-soft">
                  {c.blurb}
                </span>
                <span className="mt-3 block border-t border-rule-soft pt-2.5">
                  <span className="sign block text-[11.5px] text-ink-faint">
                    What changes here
                  </span>
                  <span className="mt-1 block space-y-0.5">
                    {c.effects.map((e) => (
                      <span
                        key={e}
                        className="block text-[12.5px] leading-snug text-ink"
                      >
                        {e}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* --------------------------------------------------------- commit */}
      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-3 border-t border-rule bg-void/95 py-4 backdrop-blur">
        <button
          type="button"
          onClick={() => onBegin(chosen.id)}
          className="rounded-form border border-clinical bg-clinical px-5 py-2.5 text-sm font-medium text-on-accent transition hover:brightness-110"
        >
          Begin in {chosen.name}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-form border border-rule px-4 py-2.5 text-sm text-ink-soft transition hover:border-clinical hover:text-ink"
        >
          Choose another career
        </button>
      </div>
    </main>
  );
}
