"use client";

import { useState } from "react";
import type { RunState } from "@/lib/game/types";
import { getCareer } from "@/lib/game/careers";
import { MAP_VIEWBOX, sy } from "@/lib/ui/worldmap";
import { MapSurface } from "@/components/visuals/map/MapSurface";
import { horizonFor, pointFor } from "@/lib/ui/careerMap";

/**
 * WHERE YOU ARE, AND WHERE THE TRADE IS
 *
 * The Physician's `NetworkMap` is nine hundred lines of markers, clustering,
 * routes and market intelligence, because a Physician can *enter* fourteen
 * markets. A Chef cannot move a kitchen and a Solicitor cannot move chambers,
 * so this map is not a board of moves — it is the board the one move you
 * already made was chosen from.
 *
 * It draws every city the career can start in: yours lit, the rest legible.
 * Selecting another shows what it would have been, which is genuinely useful
 * (the next run is the decision it informs) and is honest about being a
 * comparison rather than a destination — the line under the map says you do
 * not move, rather than leaving a player to work out why nothing is buyable.
 *
 * The geography comes from `MapSurface`, career-agnostic and shared with the
 * Physician's map: the coastline a Chef sees is the coastline a doctor sees,
 * because it is the same file.
 */
export function HomeMap({ state }: { state: RunState }) {
  const career = getCareer(state.careerId);
  const cities = career?.startCities ?? [];
  /* Where this run is. A save written before the choice existed has no
     `startCity` and is, correctly, in the career's default city. */
  const homeId = state.startCity ?? cities[0]?.id;
  const home = cities.find((c) => c.id === homeId) ?? cities[0];
  const [selected, setSelected] = useState<string | null>(null);
  const shown = cities.find((c) => c.id === selected) ?? home;
  const horizon = horizonFor(state.careerId);

  if (!career || !home || !shown) return null;

  const away = shown.id !== home.id;

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="home-map-h"
        className="overflow-hidden rounded-lg border border-rule bg-card"
      >
        <div className="border-b border-rule px-4 py-3">
          <h2 id="home-map-h" className="text-sm font-semibold text-ink">
            {home.name}, {home.country}
          </h2>
          <p className="mt-1 text-xs text-ink-faint">{home.blurb}</p>
        </div>

        <div className="relative w-full" style={{ aspectRatio: "100 / 56" }}>
          <MapSurface viewBox={MAP_VIEWBOX} />

          {/*
           * Markers are drawn in the same viewBox as the surface so they
           * cannot drift from the coastline underneath them.
           */}
          <svg
            viewBox={`0 0 ${MAP_VIEWBOX.w} ${MAP_VIEWBOX.h}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label={`Map of the world. You are in ${home.name}, ${home.country}. ${cities.length} places this trade is done.`}
          >
            {cities.map((c) => {
              const p = pointFor(c.position);
              if (!p) return null;
              const isHome = c.id === home.id;
              const isShown = c.id === shown.id;
              return (
                <g key={c.id}>
                  {isShown && (
                    <circle
                      cx={p.x}
                      cy={sy(p.y)}
                      r={2.6}
                      fill={isHome ? "#35E0C0" : "#7C8CA6"}
                      opacity={0.14}
                    />
                  )}
                  {isHome && (
                    <circle
                      cx={p.x}
                      cy={sy(p.y)}
                      r={1.5}
                      fill="none"
                      stroke="#35E0C0"
                      strokeWidth={0.35}
                      opacity={0.65}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={sy(p.y)}
                    r={isHome ? 0.62 : 0.45}
                    fill={isHome ? "#35E0C0" : "#7C8CA6"}
                  />
                </g>
              );
            })}
          </svg>

          {/* Labels sit in HTML, not SVG: text scaled by a non-uniform
              preserveAspectRatio would be stretched horizontally. */}
          {cities.map((c) => {
            const p = pointFor(c.position);
            if (!p) return null;
            const isHome = c.id === home.id;
            return (
              <span
                key={c.id}
                aria-hidden
                className={`pointer-events-none absolute -translate-x-1/2 translate-y-2 whitespace-nowrap text-[11px] tracking-wide ${
                  isHome
                    ? "font-medium text-clinical"
                    : c.id === shown.id
                      ? "text-ink"
                      : "text-ink-faint"
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

        {/*
         * The list is how the map is actually operated: a 4px marker is not a
         * touch target and is not reachable by keyboard. Every city on the
         * board is a button here, in the same order, and this is the path a
         * screen reader takes.
         */}
        <ul className="grid gap-px bg-rule-soft sm:grid-cols-2">
          {cities.map((c) => {
            const isHome = c.id === home.id;
            const on = c.id === shown.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c.id)}
                  aria-pressed={on}
                  className={`flex w-full items-baseline justify-between gap-2 px-4 py-2.5 text-left text-xs transition ${
                    on ? "bg-card-high text-ink" : "bg-card text-ink-soft hover:text-ink"
                  }`}
                >
                  <span className={isHome ? "font-medium text-clinical" : ""}>
                    {c.name}
                  </span>
                  <span className="text-ink-faint">
                    {isHome ? "Where you are" : c.country}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* What the selected city is, or would have been. */}
      <section
        aria-live="polite"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h3 className="text-sm font-semibold text-ink">
          {shown.name}
          {away ? " — not where you are" : ""}
        </h3>
        <p className="mt-1 text-xs text-ink-faint">
          {away
            ? "You did not start here, and there is no moving to it. This is what it would have been."
            : "This is the market every week of this run is played against."}
        </p>
        <ul className="mt-3 space-y-1">
          {shown.effects.map((e) => (
            <li key={e} className="text-xs text-ink">
              {e}
            </li>
          ))}
        </ul>
      </section>

      {horizon && (
        <p className="rounded-lg border border-dashed border-rule px-4 py-3 text-xs text-ink-faint">
          {horizon}
        </p>
      )}
    </div>
  );
}
