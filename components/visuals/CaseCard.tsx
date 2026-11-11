"use client";

import { useState } from "react";
import type { CaseResult } from "@/lib/game/medical/types";
import type { MedicalState } from "@/lib/game/medical/types";
import { CONDITIONS_BY_ID, EQUIPMENT_BY_ID } from "@/lib/game/medical/data";
import { DEPARTMENT_BY_ID, staffingNeed } from "@/lib/ui/departments";
import { money } from "@/lib/game/format";
import { MedIcon } from "./MedIcon";

/**
 * ONE KIND OF CASE, AND WHAT HAPPENED TO IT
 *
 * The caseload was a four-column table: condition, seen, lost, billed. Legible,
 * and silent on the six things that decide whether to invest in this line of
 * work — what it demands, what it pays, how much of the week it eats, and what
 * it costs you when it goes wrong.
 *
 * ------------------------------------------------------------- two altitudes
 *
 * Closed, a card is readable in about a second: name, department colour,
 * severity, and the outcome as "16 of 25". Open, it is the full clinical and
 * commercial picture, drawn from `CONDITIONS` — the same row the resolver used.
 *
 * That split is the point. Twenty conditions with nine facts each is a
 * spreadsheet; twenty conditions with four facts each, any of which opens, is
 * a screen you can actually work from.
 *
 * ------------------------------------------------------------------ privacy
 *
 * There are no patients here, and there never will be. The simulation models
 * conditions and counts, not people — so there is no name, no age, no history
 * to invent, and nothing on this card could be mistaken for a real record or
 * for medical advice. The severity scale is the game's own 1–5, not a clinical
 * one.
 */
export function CaseCard({
  result,
  m,
  feeIndex = 1,
}: {
  result: CaseResult;
  m: MedicalState;
  /** What this work bills for in the current market. */
  feeIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  const cond = CONDITIONS_BY_ID.get(result.conditionId);
  const dept = DEPARTMENT_BY_ID.get(result.specialty);

  const missingEquipment = (cond?.equipment ?? []).filter(
    (e) => !m.equipment.includes(e),
  );

  return (
    <li
      className="spine"
      style={{ ["--dept" as string]: dept?.colour ?? "transparent" }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-card-high"
      >
        <span style={{ color: dept?.colour }} className="shrink-0">
          <MedIcon name={dept?.icon ?? "stethoscope"} className="h-5 w-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] text-ink">{result.label}</span>
          <span className="num block text-[11.5px] text-ink-faint">
            {dept?.label}
            <Severity level={result.severity} />
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="num block text-[13px] text-ink">
            {result.succeeded}/{result.arrived}
          </span>
          <span className="num block text-[11.5px]">
            {result.failed > 0 && (
              <span className="text-alarm">{result.failed} poor</span>
            )}
            {result.failed > 0 && result.turnedAway > 0 && " · "}
            {result.turnedAway > 0 && (
              <span className="text-caution">{result.turnedAway} away</span>
            )}
            {result.failed === 0 && result.turnedAway === 0 && (
              <span className="text-good">all seen</span>
            )}
          </span>
        </span>

        <span aria-hidden className="shrink-0 text-[13px] text-ink-faint">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && cond && (
        <div className="bg-paper px-4 py-3.5">
          <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            <Fact
              icon="clinic"
              label="Department"
              value={dept?.label ?? result.specialty}
              note={
                m.departments.includes(result.specialty)
                  ? "Open."
                  : "Not open — every one of these is referred out."
              }
              bad={!m.departments.includes(result.specialty)}
            />
            <Fact
              icon="team"
              label="Who can take it"
              value={staffingNeed(result.specialty)}
              note={`This case is severity ${cond.severity}; the field goes to ${dept?.maxSeverity}.`}
            />
            <Fact
              icon="ecg"
              label="Equipment"
              value={
                (cond.equipment ?? []).length === 0
                  ? "None needed"
                  : (cond.equipment ?? [])
                      .map((e) => EQUIPMENT_BY_ID.get(e)?.label ?? e)
                      .join(", ")
              }
              note={
                missingEquipment.length > 0
                  ? `Missing: ${missingEquipment
                      .map((e) => EQUIPMENT_BY_ID.get(e)?.label ?? e)
                      .join(", ")}.`
                  : undefined
              }
              bad={missingEquipment.length > 0}
            />
            <Fact
              icon="clock"
              label="Time it takes"
              value={`${cond.units} unit${cond.units === 1 ? "" : "s"}`}
              note={`${Math.round(cond.units)} of your weekly capacity per patient.`}
            />
            <Fact
              icon="money"
              label="What it bills"
              value={money(cond.fee * feeIndex)}
              note={`${money((cond.fee * feeIndex) / cond.units)} per unit of capacity — ${
                cond.fee / cond.units > 400 ? "good value" : "modest value"
              } against the rest of the list.`}
            />
            <Fact
              icon="alert"
              label="What a failure costs"
              value={`risk +${(cond.severity * 0.16).toFixed(2)} each`}
              note="A poor outcome also costs credibility in proportion to the specialty's prestige."
              bad={result.failed > 0}
            />
          </dl>

          {/* What actually happened, in one sentence. */}
          <p className="mt-3 border-t border-rule-soft pt-2.5 text-[12.5px] leading-relaxed text-ink-soft">
            {result.arrived} presented.{" "}
            {result.treated === 0 ? (
              <>
                None were treated — {BLOCK_REASON[result.blockedBy ?? "capacity"]}
              </>
            ) : (
              <>
                {result.treated} treated, {result.succeeded} well
                {result.failed > 0 && ` and ${result.failed} badly`}, billing{" "}
                <span className="num text-good">{money(result.revenue)}</span>.
                {result.turnedAway > 0 &&
                  ` ${result.turnedAway} were not reached — ${BLOCK_REASON[result.blockedBy ?? "capacity"]}`}
              </>
            )}
          </p>
        </div>
      )}
    </li>
  );
}

const BLOCK_REASON: Record<string, string> = {
  department: "there is no department open for this field.",
  equipment: "the machine this work needs is not installed.",
  staff: "nobody available is qualified to this severity.",
  capacity: "the week ran out before the queue did.",
};

/**
 * Severity as pips rather than a number alone.
 *
 * Five is a small enough range to read at a glance, and the digit is still
 * printed beside them — the pips are the fast read, not the only one.
 */
function Severity({ level }: { level: number }) {
  return (
    <>
      {" · sev "}
      {level}
      <span aria-hidden className="ml-1.5 inline-flex gap-0.5 align-middle">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              i <= level ? "bg-ink-soft" : "bg-rule"
            }`}
          />
        ))}
      </span>
    </>
  );
}

function Fact({
  icon,
  label,
  value,
  note,
  bad,
}: {
  icon: Parameters<typeof MedIcon>[0]["name"];
  label: string;
  value: string;
  note?: string;
  bad?: boolean;
}) {
  return (
    <div>
      <dt className="t-label flex items-center gap-1.5 text-ink-faint">
        <MedIcon name={icon} className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className={`mt-0.5 text-[12.5px] ${bad ? "text-caution" : "text-ink"}`}>
        {value}
      </dd>
      {note && (
        <dd className="text-[12px] leading-snug text-ink-faint">{note}</dd>
      )}
    </div>
  );
}
