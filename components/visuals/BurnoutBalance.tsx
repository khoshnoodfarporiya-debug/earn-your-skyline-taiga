"use client";

import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import { burnoutRelief, restBonus } from "@/lib/game/medical/lifestyle";
import { MedIcon, type MedIconName } from "./MedIcon";
import type { ScreenId } from "@/lib/ui/navigation";

/**
 * WHAT THE WEEK TAKES OUT OF YOU
 *
 * Burnout was a bar that filled up and, until recently, killed you at the top.
 * It is now a gradual condition with four named stages and a recovery you can
 * plan — which only helps if the player can see what is adding to it and what
 * is taking it away.
 *
 * -------------------------------------------------------- the two halves
 *
 * Every week has a cost side and a recovery side, and the recovery side is not
 * only "rest":
 *
 *   cost      each working block, at its own rate — clinic is the expensive
 *             one, and nurses make it cheaper
 *   recovery  the automatic weekly drop, plus what your life buys you, plus
 *             the compounding return on fitness
 *
 * All six numbers below come from `applyAction` and the drift block in
 * `resolveWeek`. They are the real rates, not illustrative ones, which is why
 * the header calls them "per block" rather than "roughly".
 *
 * ----------------------------------------------------------- on the stages
 *
 * The four stages are labelled and the effects of each are stated, because the
 * old presentation — a bar that turns orange somewhere — taught nothing about
 * *when* to act. The threshold that matters is 65, where skill starts dropping
 * and standing bleeds, and that is a number a player should be steering around
 * rather than discovering.
 */
export function BurnoutBalance({
  state,
  onNavigate,
}: {
  state: RunState;
  onNavigate: (screen: ScreenId) => void;
}) {
  const m = med(state);
  const burnout = state.r.burnout;
  const fitness = state.r._fitness ?? 0;
  const nurses = m.staff.filter((x) => x.role === "nurse").length;

  /* The automatic weekly drop, exactly as `resolveWeek` computes it. */
  const baseRecovery = burnout < 50 ? 3.5 : 2;
  const lifeRelief = burnoutRelief(m);
  const fitnessReturn = fitness * 0.12;
  const totalRecovery = baseRecovery + lifeRelief + fitnessReturn;

  const stage = STAGES.find((s) => burnout < s.max) ?? STAGES[STAGES.length - 1];

  const costs: Line[] = [
    {
      icon: "stethoscope",
      label: "Seeing patients",
      value: Math.max(2.5, 6.5 - nurses * 0.6),
      note:
        nurses > 0
          ? `Each nurse takes 0.6 off this. You have ${nurses}.`
          : "Nurses take 0.6 off this each. You have none.",
    },
    { icon: "globe", label: "Growing the panel", value: 4, note: "Talks, screenings, referral work." },
    { icon: "clock", label: "Travelling", value: 3.5, note: "Being present in another city." },
    { icon: "microscope", label: "Studying", value: 3, note: "Journals, courses, audit of your own outcomes." },
    { icon: "clipboard", label: "Running the practice", value: 2.5, note: "Rotas, coding, compliance." },
    { icon: "team", label: "Networking", value: 2, note: "Time spent with the profession." },
  ];

  const recoveries: Line[] = [
    {
      icon: "bed",
      label: "A rest block",
      value: -(15 + restBonus(m)),
      note:
        restBonus(m) > 0
          ? `15 as standard, plus ${Math.round(restBonus(m))} from where you live.`
          : "The only thing that removes a large amount at once.",
    },
    {
      icon: "pulse",
      label: "An exercise block",
      value: -5,
      note: `Also adds 1.5 to fitness, which pays out every week after. Fitness is ${fitness.toFixed(1)} of 20.`,
    },
    { icon: "patient", label: "Seeing people who matter", value: -2, note: "Costs a block and gives one back." },
    {
      icon: "clock",
      label: "The week passing",
      value: -baseRecovery,
      note:
        burnout < 50
          ? "3.5 automatically, while you are under 50."
          : "2 automatically. It was 3.5 until you passed 50 — recovery slows as it gets worse.",
    },
  ];

  if (lifeRelief > 0) {
    recoveries.push({
      icon: "clinic",
      label: "How you live",
      value: -lifeRelief,
      note: "Everything you have bought yourself, every week, without a block.",
    });
  }
  if (fitnessReturn > 0.05) {
    recoveries.push({
      icon: "pulse",
      label: "Fitness carried over",
      value: -fitnessReturn,
      note: "Decays by 0.12 a week if you stop. This is the compounding half.",
    });
  }

  return (
    <section className="form" aria-labelledby="balance-title">
      <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
        <h3 id="balance-title" className="sign text-[11.5px] text-ink-soft">
          What the week takes out of you
        </h3>
        <span className="num text-[12px] text-ink-soft">
          burnout {Math.round(burnout)}
        </span>
      </div>

      {/* ---------------------------------------------------- the stages */}
      <div className="px-5 py-4">
        <ol className="flex gap-1">
          {STAGES.map((s) => {
            const active = s.id === stage.id;
            return (
              <li key={s.id} className="min-w-0 flex-1">
                <div
                  className={`h-1.5 rounded-full ${active ? s.bar : "bg-paper"}`}
                  aria-hidden
                />
                <p
                  className={`t-label mt-1 truncate ${active ? s.text : "text-ink-faint"}`}
                >
                  {s.label}
                </p>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-[13px] leading-relaxed text-ink">
          <span className={stage.text}>{stage.label}.</span>{" "}
          <span className="text-ink-soft">{stage.detail}</span>
        </p>
      </div>

      {/* ----------------------------------------------- cost and recovery */}
      <div className="grid gap-px border-t border-rule bg-rule-soft sm:grid-cols-2">
        <Column
          title="Adds to it, per block"
          lines={costs}
          tone="caution"
        />
        <Column
          title="Takes it away"
          lines={recoveries}
          tone="good"
          footer={`Without spending a single block you recover ${totalRecovery.toFixed(1)} a week.`}
        />
      </div>

      {/* --------------------------------------------------- the routes out */}
      <div className="border-t border-rule bg-paper px-5 py-4">
        <h4 className="t-label text-ink-faint">If it is climbing</h4>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          A rest block is the fastest lever and the most expensive — it is a
          sixth of the week. Hiring a nurse makes every clinic block cheaper
          forever. Exercise is the only one that compounds. Buying somewhere
          better to live raises the automatic recovery without costing a block
          at all.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate("staff")}
            className="min-h-[44px] rounded-form bg-card-high px-3.5 text-[12.5px] text-ink-soft transition hover:text-ink"
          >
            Hire a nurse
          </button>
          <button
            type="button"
            onClick={() => onNavigate("life")}
            className="min-h-[44px] rounded-form bg-card-high px-3.5 text-[12.5px] text-ink-soft transition hover:text-ink"
          >
            Look at how you live
          </button>
          <button
            type="button"
            onClick={() => onNavigate("overview")}
            className="min-h-[44px] rounded-form bg-clinical px-3.5 text-[12.5px] font-semibold text-on-accent transition hover:bg-clinical-hover"
          >
            Plan rest into the week
          </button>
        </div>
      </div>
    </section>
  );
}

interface Line {
  icon: MedIconName;
  label: string;
  value: number;
  note: string;
}

function Column({
  title,
  lines,
  tone,
  footer,
}: {
  title: string;
  lines: Line[];
  tone: "caution" | "good";
  footer?: string;
}) {
  const peak = Math.max(1, ...lines.map((l) => Math.abs(l.value)));
  return (
    <div className="bg-card px-5 py-4">
      <h4 className="t-label text-ink-faint">{title}</h4>
      <dl className="mt-2 space-y-2.5">
        {lines.map((l) => (
          <div key={l.label}>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="flex items-center gap-1.5 text-[13px] text-ink">
                <span className="text-ink-faint">
                  <MedIcon name={l.icon} className="h-4 w-4" />
                </span>
                {l.label}
              </dt>
              <dd
                className={`num text-[13px] font-semibold ${
                  tone === "good" ? "text-good" : "text-caution"
                }`}
              >
                {l.value > 0 ? "+" : "−"}
                {Math.abs(l.value).toFixed(1)}
              </dd>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper" aria-hidden>
              <div
                className={`h-full rounded-full ${tone === "good" ? "bg-good" : "bg-caution"}`}
                style={{ width: `${Math.max(3, (Math.abs(l.value) / peak) * 100)}%` }}
              />
            </div>
            <dd className="mt-1 text-[12px] leading-snug text-ink-faint">
              {l.note}
            </dd>
          </div>
        ))}
      </dl>
      {footer && (
        <p className="mt-3 border-t border-rule-soft pt-2 text-[12.5px] leading-snug text-ink-soft">
          {footer}
        </p>
      )}
    </div>
  );
}

/**
 * The four stages, with the thresholds the simulation actually uses.
 *
 * 65 is the one that matters: above it, effective skill drops and standing
 * bleeds every week. 100 is a setback rather than an ending — being signed off
 * is expensive and recoverable, and the wording says so.
 */
const STAGES = [
  {
    id: "fine",
    max: 40,
    label: "Steady",
    detail: "Nothing is costing you. This is a pace you could hold for years.",
    bar: "bg-good",
    text: "text-good",
  },
  {
    id: "tiring",
    max: 65,
    label: "Tiring",
    detail:
      "No penalty yet, and recovery has slowed to 2 a week. This is where a habit is worth building rather than a rescue.",
    bar: "bg-clinical",
    text: "text-clinical",
  },
  {
    id: "impaired",
    max: 85,
    label: "Impaired",
    detail:
      "Above 65 your effective skill drops and standing bleeds every week. Outcomes get worse before you feel worse.",
    bar: "bg-caution",
    text: "text-caution",
  },
  {
    id: "critical",
    max: 101,
    label: "Critical",
    detail:
      "At 100 you are signed off — a setback you climb out of over weeks, not an ending. Getting back early makes it longer.",
    bar: "bg-alarm",
    text: "text-alarm",
  },
];
