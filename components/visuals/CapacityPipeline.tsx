"use client";

import { useMemo } from "react";
import type { RunState } from "@/lib/game/types";
import { capacityPipeline, type CapacityRow } from "@/lib/ui/capacity";
import type { ScreenId } from "@/lib/ui/navigation";
import { MedIcon } from "./MedIcon";

/**
 * WHERE THE WEEK'S CAPACITY COMES FROM
 *
 * An operational pipeline, not a percentage. Four sources add up to the people
 * you have; the buildings cap it; two multipliers scale it; and one line says
 * which of those is the reason the number is what it is.
 *
 * --------------------------------------------------------- the binding row
 *
 * The single most useful thing on this screen is the sentence at the top —
 * "your main limit this week is technician cover" — because the mistake it
 * prevents is expensive. A player who is space-limited and hires three GPs has
 * bought three salaries and no throughput, and nothing in the old interface
 * told them that before the money left.
 *
 * The limit rows are therefore drawn as a matched pair with the smaller one
 * marked, rather than as two bars the player has to compare by eye. Which is
 * binding is stated in words; the bars are the corroboration, not the message.
 *
 * ------------------------------------------------------------------- units
 *
 * "Units" is the simulation's own currency and it needs saying once: a
 * severity-1 case costs 1, a tumour resection costs 12. That sentence is in
 * the total row rather than in a legend, because a legend is a thing players
 * do not read.
 */
export function CapacityPipeline({
  state,
  clinicBlocks = 0,
  onNavigate,
}: {
  state: RunState;
  /** Your own clinical time in the week being described. */
  clinicBlocks?: number;
  onNavigate: (screen: ScreenId) => void;
}) {
  const p = useMemo(
    () => capacityPipeline(state, clinicBlocks),
    [state, clinicBlocks],
  );

  const sources = p.rows.filter((r) => r.kind === "source" && r.value > 0);
  const limits = p.rows.filter((r) => r.kind === "limit");
  const modifiers = p.rows.filter((r) => r.kind === "modifier");
  const total = p.rows.find((r) => r.kind === "total")!;
  const peak = Math.max(1, ...sources.map((r) => r.value));

  return (
    <section className="form" aria-labelledby="capacity-title">
      <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
        <h3 id="capacity-title" className="sign text-[11.5px] text-ink-soft">
          What you can get through
        </h3>
        <span className="num text-[12px] text-ink-soft">
          {Math.round(p.effective)} units
        </span>
      </div>

      {/* The answer, before the arithmetic. */}
      <div className="border-b border-rule-soft bg-caution-tint px-5 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <span className="text-caution">
                <MedIcon name="alert" className="h-4 w-4" />
              </span>
              {p.bindingLabel}
            </p>
            <p className="mt-1 max-w-[62ch] text-[12.5px] leading-relaxed text-ink-soft">
              {p.bindingDetail}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(p.bindingDestination)}
            className="min-h-[44px] shrink-0 rounded-form bg-clinical px-4 text-[13px] font-semibold text-on-accent transition hover:bg-clinical-hover"
          >
            Deal with it
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------- sources */}
      <div className="px-5 py-4">
        <h4 className="t-label text-ink-faint">Who can treat</h4>
        <dl className="mt-2 space-y-2.5">
          {sources.map((r) => (
            <Row
              key={r.id}
              row={r}
              width={(r.value / peak) * 100}
              onNavigate={onNavigate}
            />
          ))}
          {sources.length === 0 && (
            <p className="text-[13px] text-ink-soft">
              Nobody yet. No clinical staff, and no clinic blocks in this
              week&rsquo;s plan — each one you assign is worth about{" "}
              <span className="num text-ink">
                {Math.round(p.perClinicBlock)}
              </span>{" "}
              units.
            </p>
          )}
        </dl>
      </div>

      {/* -------------------------------------------------------- limits */}
      <div className="border-t border-rule-soft bg-paper px-5 py-4">
        <h4 className="t-label text-ink-faint">
          Capacity is the smaller of these two
        </h4>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {limits.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => r.destination && onNavigate(r.destination)}
              className={`min-h-[44px] rounded-form border px-3.5 py-3 text-left transition ${
                r.binding
                  ? "border-caution/60 bg-caution-tint"
                  : "border-rule bg-card hover:border-clinical/40"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] text-ink-soft">{r.label}</span>
                <span className="num text-[15px] font-semibold text-ink">
                  {r.display}
                </span>
              </span>
              {/* The word, not just the tint — this is the whole message of
                  the block and it must survive a monochrome screen. */}
              <span
                className={`t-label mt-1 block ${
                  r.binding ? "text-caution" : "text-ink-faint"
                }`}
              >
                {r.binding ? "This is the limit" : "Spare"}
              </span>
              <span className="mt-1 block text-[12px] leading-snug text-ink-faint">
                {r.detail}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------- modifiers */}
      <div className="border-t border-rule-soft px-5 py-4">
        <h4 className="t-label text-ink-faint">Then scaled by</h4>
        <dl className="mt-2 space-y-2">
          {modifiers.map((r) => (
            <div key={r.id} className="flex flex-wrap items-baseline gap-x-2">
              <dt className="text-[13px] text-ink">{r.label}</dt>
              <dd
                className={`num text-[13px] font-semibold ${
                  r.value >= 1 ? "text-good" : "text-caution"
                }`}
              >
                {r.display}
              </dd>
              <dd className="w-full text-[12px] leading-snug text-ink-faint">
                {r.detail}
                {r.destination && (
                  <button
                    type="button"
                    onClick={() => onNavigate(r.destination!)}
                    className="ml-1.5 inline-block -my-3 py-3 text-clinical transition hover:text-clinical-hover"
                  >
                    Go there
                  </button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* --------------------------------------------------------- total */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t-2 border-rule px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">{total.label}</p>
          <p className="mt-0.5 max-w-[62ch] text-[12px] leading-snug text-ink-soft">
            {total.detail}
            {p.perClinicBlock > 0 && (
              <>
                {" "}
                One more clinic block of your own adds about{" "}
                <span className="num text-ink">
                  {Math.round(p.perClinicBlock)}
                </span>
                .
              </>
            )}
          </p>
        </div>
        <p className="num text-2xl font-semibold text-clinical">
          {Math.round(p.effective)}
        </p>
      </div>
    </section>
  );
}

function Row({
  row,
  width,
  onNavigate,
}: {
  row: CapacityRow;
  width: number;
  onNavigate: (screen: ScreenId) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[13px] text-ink">{row.label}</dt>
        <dd className="num text-[13px] font-semibold text-ink">
          {row.display}
        </dd>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-paper"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-clinical/70"
          style={{ width: `${Math.max(2, width)}%` }}
        />
      </div>
      <dd className="mt-1 text-[12px] leading-snug text-ink-faint">
        {row.detail}
        {row.destination && (
          <button
            type="button"
            onClick={() => onNavigate(row.destination!)}
            className="ml-1.5 inline-block -my-3 py-3 text-clinical transition hover:text-clinical-hover"
          >
            Go there
          </button>
        )}
      </dd>
    </div>
  );
}
