"use client";

import type { CareerDef, RunState } from "@/lib/game/types";
import { formatResource } from "@/lib/game/format";

/** Reading colour: how bad the current value is for the player. */
function tone(polarity: string, value: number, max: number) {
  const pct = value / max;
  const bad = polarity === "lower-better" ? pct : 1 - pct;
  if (bad > 0.75) return { bar: "#FF6B6B", text: "text-alarm" };
  if (bad > 0.5) return { bar: "#FFB020", text: "text-caution" };
  return { bar: "#35E0C0", text: "text-ink" };
}

export function Meters({
  career,
  state,
}: {
  career: CareerDef;
  state: RunState;
}) {
  const meters = career.resources.filter((r) => r.display === "meter");
  const stats = career.resources.filter((r) => r.display === "stat");

  return (
    <div className="form">
      <h3 className="form-head sign px-5 py-2.5 text-[11.5px] text-ink-soft">
        Observations
      </h3>

      <div className="divide-y divide-rule-soft">
        {meters.map((def) => {
          const value = state.r[def.id] ?? 0;
          const max = def.max ?? 100;
          const pct = Math.max(0, Math.min(100, (value / max) * 100));
          const t = tone(def.polarity, value, max);
          return (
            <div key={def.id} className="px-5 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] text-ink">{def.label}</span>
                <span className={`num text-[15px] font-medium ${t.text}`}>
                  {formatResource(def, value)}
                </span>
              </div>

              {/* Segmented monitor gauge, lit in its own tone. */}
              <div
                className="gauge mt-2"
                style={{
                  ["--fill" as string]: `${pct}%`,
                  ["--tone" as string]: t.bar,
                }}
                role="meter"
                aria-valuenow={Math.round(value)}
                aria-valuemin={def.min ?? 0}
                aria-valuemax={max}
                aria-label={def.label}
              />

              <p className="mt-1.5 text-[12px] leading-snug text-ink-faint">
                {def.hint}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-rule bg-rule-soft">
        {stats.map((def) => (
          <div key={def.id} className="bg-card px-5 py-3">
            <p className="sign text-[11.5px] text-ink-faint">{def.label}</p>
            <p className="num mt-0.5 text-base">
              {formatResource(def, state.r[def.id] ?? 0)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
