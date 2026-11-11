"use client";

import { useMemo } from "react";
import type { RunState } from "@/lib/game/types";
import { weeklyFinance, type FlowLine } from "@/lib/ui/finance";
import { money } from "@/lib/game/format";
import type { ScreenId } from "@/lib/ui/navigation";
import { MedIcon } from "./MedIcon";

/**
 * THE SHAPE OF A NORMAL WEEK
 *
 * Revenue in, every standing cost out, and what is left. Drawn as a waterfall
 * because the question is compositional — which line is eating the week — and a
 * pie would answer a different question badly.
 *
 * ------------------------------------------------------- the sentence first
 *
 * "At the current burn rate, available cash covers approximately seven weeks."
 *
 * That sentence sits above the bars and is the only part a hurried player has
 * to read. Everything below it is the evidence. A chart whose meaning only
 * exists in the picture is a chart that fails on a phone, in a screen reader,
 * and for anyone who is not fluent in reading bars — so the text is not a
 * caption, it is the deliverable.
 *
 * ----------------------------------------------------------- fixed variable
 *
 * The split is called out separately because it is the one thing that decides
 * whether a bad month is survivable. Consumables fall when you treat fewer
 * people; payroll and premises do not, and a practice whose fixed costs exceed
 * its revenue cannot save itself by working less.
 */
export function FinanceWaterfall({
  state,
  onNavigate,
}: {
  state: RunState;
  onNavigate: (screen: ScreenId) => void;
}) {
  const f = useMemo(() => weeklyFinance(state), [state]);
  /* Scale every bar against the largest single line, so the smallest cost is
     still visible rather than being a hairline next to payroll. */
  const peak = Math.max(
    1,
    ...f.income.map((l) => l.amount),
    ...f.costs.map((l) => -l.amount),
  );

  return (
    <section className="form" aria-labelledby="finance-title">
      <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
        <h3 id="finance-title" className="sign text-[11.5px] text-ink-soft">
          A week of money
        </h3>
        <span
          className={`num text-[12px] ${f.net >= 0 ? "text-good" : "text-alarm"}`}
        >
          {money(f.net)} net
        </span>
      </div>

      {/* The whole diagram, in one sentence. */}
      <p className="border-b border-rule-soft px-5 py-3.5 text-[13.5px] leading-relaxed text-ink">
        {f.summary}
      </p>

      <dl className="px-5 py-4">
        {f.income.map((l) => (
          <Line key={l.id} line={l} peak={peak} onNavigate={onNavigate} />
        ))}

        <div className="my-2.5 border-t border-rule-soft" />

        {f.costs.map((l) => (
          <Line key={l.id} line={l} peak={peak} onNavigate={onNavigate} />
        ))}

        <div className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-rule pt-3">
          <dt className="text-[14px] font-semibold text-ink">
            Left at the end of the week
          </dt>
          <dd
            className={`num text-xl font-semibold ${
              f.net >= 0 ? "text-good" : "text-alarm"
            }`}
          >
            {money(f.net)}
          </dd>
        </div>
      </dl>

      {/* ------------------------------------------------- fixed vs variable */}
      <div className="grid gap-px border-t border-rule bg-rule-soft sm:grid-cols-2">
        <div className="bg-card px-5 py-3.5">
          <p className="t-label text-ink-faint">Charged whatever happens</p>
          <p className="num mt-0.5 text-[17px] font-semibold text-ink">
            {money(f.fixed)}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-ink-soft">
            Payroll, premises and interest. A quiet week costs this much before
            a single patient arrives.
          </p>
        </div>
        <div className="bg-card px-5 py-3.5">
          <p className="t-label text-ink-faint">Tracks how busy you are</p>
          <p className="num mt-0.5 text-[17px] font-semibold text-ink">
            {money(f.variable)}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-ink-soft">
            Consumables, campaigns and how you live. These fall when the work
            does.
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------- upcoming */}
      {f.upcoming.length > 0 && (
        <div className="border-t border-rule px-5 py-4">
          <h4 className="t-label flex items-center gap-1.5 text-ink-faint">
            <MedIcon name="clock" className="h-3.5 w-3.5" />
            Falls due
          </h4>
          <ul className="mt-2 space-y-2">
            {f.upcoming.map((u, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                <span className="num text-[13px] font-semibold text-ink">
                  {money(u.amount)}
                </span>
                <span
                  className={`t-label ${u.urgent ? "text-caution" : "text-ink-faint"}`}
                >
                  {u.when}
                </span>
                <span className="w-full text-[12px] leading-snug text-ink-soft">
                  {u.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ----------------------------------------------------- affordability */}
      <div className="border-t border-rule bg-paper px-5 py-4">
        <h4 className="t-label text-ink-faint">What the profit buys</h4>
        <p className="mt-1 text-[12px] leading-snug text-ink-soft">
          {f.net > 0
            ? "How long saving at this week's rate takes to reach each rung, from where your cash stands now."
            : "Nothing, while the week is running at a loss. These become reachable once the practice is profitable."}
        </p>
        <ul className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {f.affordability.map((a) => (
            <li
              key={a.label}
              className="flex items-baseline justify-between gap-2 text-[12.5px]"
            >
              <span className="text-ink-soft">{a.label}</span>
              <span className="num text-ink">
                {!Number.isFinite(a.weeks)
                  ? "—"
                  : a.weeks === 0
                    ? "affordable now"
                    : `${a.weeks} week${a.weeks === 1 ? "" : "s"}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Line({
  line,
  peak,
  onNavigate,
}: {
  line: FlowLine;
  peak: number;
  onNavigate: (screen: ScreenId) => void;
}) {
  const magnitude = Math.abs(line.amount);
  const income = line.amount >= 0;
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[13px] text-ink">
          {line.label}
          {line.nature === "fixed" && (
            <span className="t-label ml-2 text-ink-faint">fixed</span>
          )}
        </dt>
        <dd
          className={`num text-[13.5px] font-semibold ${
            income ? "text-good" : "text-ink"
          }`}
        >
          {money(line.amount)}
        </dd>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper" aria-hidden>
        <div
          className={`h-full rounded-full ${income ? "bg-good" : "bg-caution/70"}`}
          style={{ width: `${Math.max(2, (magnitude / peak) * 100)}%` }}
        />
      </div>
      <dd className="mt-1 text-[12px] leading-snug text-ink-faint">
        {line.detail}
        {line.destination && (
          <button
            type="button"
            onClick={() => onNavigate(line.destination!)}
            className="ml-1.5 inline-block -my-3 py-3 text-clinical transition hover:text-clinical-hover"
          >
            Go there
          </button>
        )}
      </dd>
    </div>
  );
}
