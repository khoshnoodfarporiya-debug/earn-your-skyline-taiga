"use client";

import { useState } from "react";
import type { MedicalState } from "@/lib/game/medical/types";
import type { MapNode } from "@/lib/ui/visuals";
import { OUTBREAK_BY_ID } from "@/lib/game/medical/outbreaks";
import {
  capturedShare,
  cityOf,
  contestedShare,
  populationCeiling,
} from "@/lib/game/medical/cities";
import { FACILITY_TYPES } from "@/lib/game/medical/data";
import { catchmentIn, facilityPrice, slotsIn } from "@/lib/game/medical/sim";
import { money } from "@/lib/game/format";
import { cityVisual } from "@/lib/ui/visuals";
import { ArtFrame } from "./ArtFrame";

/**
 * The card under the map.
 *
 * Selecting a marker updates this in place — it is never a page. What it shows
 * depends on how far along the market is: an unlicensed city is a pitch (what
 * it would cost, what it would send you), an operating one is a report (panel,
 * capacity, last week's arrivals and billing).
 *
 * Disabled actions say why they are disabled. A greyed button with no
 * explanation is the thing that makes a strategy game feel broken.
 */

const idx = (n: number) => `${n.toFixed(2)}×`;

export function CityDetail({
  node,
  m,
  reputation,
  cash,
  dispatch,
}: {
  node: MapNode;
  m: MedicalState;
  reputation: number;
  cash: number;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const c = cityOf(node.id);
  const report = m.lastCityReports.find((r) => r.city === node.id);
  const outbreak = node.outbreak;
  const def = outbreak ? OUTBREAK_BY_ID.get(outbreak.id) : null;
  const bias = Object.entries(c.bias)
    .filter(([, v]) => v >= 1.25)
    .map(([k, v]) => `${k} ${idx(v)}`);
  const quiet = Object.entries(c.bias)
    .filter(([, v]) => v <= 0.85)
    .map(([k, v]) => `${k} ${idx(v)}`);

  /* Everything about this market that can cost you, stated plainly. */
  const localRisks = [
    c.competition >= 0.35
      ? `Crowded — ${Math.round(c.competition * 100)}% of the market is already held`
      : null,
    c.costIndex >= 1.3
      ? `Expensive to run at ${idx(c.costIndex)} costs`
      : null,
    c.feeIndex <= 0.6
      ? `Thin margins — fees bill at only ${idx(c.feeIndex)}`
      : null,
    outbreak ? `An outbreak is running here now` : null,
    node.isHome ? "Your own clinical hours only count here" : null,
  ].filter((x): x is string => x !== null);
  if (localRisks.length === 0) localRisks.push("Nothing unusual about this one.");

  /* Always-true facts about the market, whatever your position in it. */
  const market: [string, string, string?][] = [
    ["Population", `${c.population}M`],
    ["Licence", c.entryCost === 0 ? "home" : money(c.entryCost)],
    ["Fees", idx(c.feeIndex)],
    ["Costs", idx(c.costIndex)],
    [
      "Competition",
      `${Math.round(c.competition * 100)}% held`,
      "The share incumbents already hold. Reputation is the only thing that prises it loose.",
    ],
    [
      "Market access",
      `${Math.round(contestedShare(c.id, reputation) * 100)}%`,
      "How much of this city is open to you at your current reputation — a ceiling on what you could reach, not what you hold.",
    ],
    [
      "Room to grow",
      Math.round(populationCeiling(c.id)).toLocaleString("en-US"),
      "The hard limit the city's population puts on how many patients you could ever hold here.",
    ],
  ];

  /*
   * Your position in it, once you have one.
   *
   * Two of these were previously misnamed and both flattered the player.
   * "Capacity" was `slotsIn`, which counts rooms, not treatment throughput —
   * it is now "Premises slots" and says what it counts. "Your share" was
   * `contestedShare`, which is how much of the market is open to you at all;
   * it read as though a ninety-patient practice controlled 93% of Lyon. Real
   * captured share is panel against the city's population ceiling, and it is
   * reported separately from access.
   */
  const position: [string, string, string?][] =
    node.state === "operating"
      ? [
          ["Sites", `${node.sites}`],
          ["Panel", node.panel.toLocaleString("en-US")],
          [
            "Premises slots",
            `${slotsIn(m, node.id)}`,
            "Room to treat, from the buildings you own here. Not the same as how many people your staff can actually see.",
          ],
          [
            "Ceiling",
            Math.round(catchmentIn(m, node.id, reputation)).toLocaleString(
              "en-US",
            ),
            "The largest panel this city will currently sustain for you.",
          ],
          ["Arrived", report ? `${report.arrived}` : "—"],
          ["Treated", report ? `${report.treated}` : "—"],
          ["Billed", report ? money(report.revenue) : "—"],
          [
            "Captured",
            `${(capturedShare(c.id, node.panel) * 100).toFixed(1)}%`,
            "Your panel against everyone this city could ever supply.",
          ],
        ]
      : [];

  const status =
    node.state === "operating"
      ? node.isHome
        ? "Operating · you work here"
        : "Operating"
      : node.state === "licensed"
        ? "Licensed · no premises built"
        : "Not licensed";

  return (
    /*
     * A named region, so the card is a place a screen-reader user can jump to
     * rather than something they have to find by walking the map. It is also
     * what makes "the panel that describes the selected city" unambiguous —
     * several other headings on this screen are h4s too.
     */
    <div
      role="region"
      aria-label={`Selected city: ${node.name}`}
      className="border-t border-rule"
    >
      {/*
       * The city itself. Keyed off the selection, so exactly one photograph is
       * in flight at a time — the map never pulls fourteen of these. `key`
       * forces a fresh element per city so the fade replays on each change
       * rather than cross-dissolving mid-download.
       */}
      <ArtFrame
        /* Prefixed: this and the tab set below are siblings both keyed off
           the city, and a bare id on each collides. */
        key={`art-${node.id}`}
        visual={cityVisual(node.id)}
        ratio="aspect-[21/9] sm:aspect-[21/7]"
        scrim="bottom"
        sizes="(min-width: 1152px) 1104px, 100vw"
        className="fade border-b border-rule"
        imageClassName={node.state === "locked" ? "grayscale-[0.55]" : ""}
      >
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-x-3 gap-y-1 p-3.5 sm:px-5">
          <div className="min-w-0">
            <h4 className="display text-2xl leading-none text-ink drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              {node.name}
            </h4>
            <p className="num mt-1 text-[12px] text-ink-soft drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              {node.country}
            </p>
          </div>
          <span
            className={`sign shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] backdrop-blur-[2px] ${
              node.state === "operating"
                ? "border-clinical/60 bg-clinical-tint/90 text-clinical"
                : node.state === "licensed"
                  ? "border-rule bg-[#070E19]/80 text-ink-soft"
                  : "border-rule bg-[#070E19]/80 text-ink-faint"
            }`}
          >
            {status}
          </span>
        </div>
      </ArtFrame>

      {/*
       * Three tabs rather than one long column. The panel was showing market
       * facts, your position, case mix, risks and every purchase button at
       * once — twenty-odd figures with no hierarchy, which is exactly the
       * "dense admin dashboard" problem in miniature.
       *
       * Overview answers "should I care about this place", Market answers
       * "what is it worth", Operations answers "what do I have here and what
       * can I do next". The action bar sits outside the tabs because it is
       * the point of the panel and must never be a tab you have to find.
       */}
      <Tabs
        /* Remounts per city so selecting a new market lands on Overview
           rather than on whichever tab you last opened. */
        key={`tabs-${node.id}`}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <>
                <p className="t-body text-ink-soft">{c.blurb}</p>

                {outbreak && (
                  <p className="mt-3 rounded-form bg-alarm-tint px-3 py-2.5 text-[13px] leading-snug text-ink-soft">
                    <span className="font-semibold text-alarm">
                      {def?.label ?? outbreak.id}
                    </span>{" "}
                    broke out here in week {outbreak.startedWeek} ·{" "}
                    {outbreak.weeksLeft} week
                    {outbreak.weeksLeft === 1 ? "" : "s"} to run ·{" "}
                    {outbreak.contained ? "contained" : "not contained"}
                    {def && (
                      <span className="mt-0.5 block text-ink-faint">
                        {def.pathogen}
                      </span>
                    )}
                  </p>
                )}

                <h5 className="t-label mt-4 text-ink-faint">
                  {node.state === "locked" ? "To expand here" : "Watch out for"}
                </h5>
                <ul className="mt-2 space-y-1.5">
                  {(node.state === "locked"
                    ? [
                        `Register to practise — ${money(c.entryCost)}`,
                        `Then premises from ${money(facilityPrice(FACILITY_TYPES[0].id, node.id))}`,
                      ]
                    : localRisks
                  ).map((line) => (
                    <li
                      key={line}
                      className="flex gap-2 text-[13px] leading-snug text-ink-soft"
                    >
                      <span aria-hidden className="text-ink-faint">
                        ·
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </>
            ),
          },
          {
            id: "market",
            label: "Market",
            content: (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                  {market.map(([label, value, hint]) => (
                    <Stat key={label} label={label} value={value} hint={hint} />
                  ))}
                </dl>

                <h5 className="t-label mt-5 text-ink-faint">Case mix</h5>
                {bias.length > 0 ? (
                  <p className="num mt-1.5 text-[13px] leading-snug text-ink">
                    {bias.join(" · ")}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[13px] leading-snug text-ink-soft">
                    An even spread — nothing over-represented.
                  </p>
                )}
                {quiet.length > 0 && (
                  <p className="num mt-1 text-[12.5px] leading-snug text-ink-faint">
                    Sends less: {quiet.join(" · ")}
                  </p>
                )}
              </>
            ),
          },
          {
            id: "operations",
            label: "Operations",
            content:
              position.length > 0 ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                  {position.map(([label, value, hint]) => (
                    <Stat key={label} label={label} value={value} hint={hint} />
                  ))}
                </dl>
              ) : (
                /* A locked market has no operations yet — say so rather than
                   showing an empty grid. */
                <p className="t-body text-ink-soft">
                  {node.state === "licensed"
                    ? "You hold the licence but have not built here yet. Buy premises below and this becomes a working site."
                    : "You have no presence here. Register to practise, then build."}
                </p>
              ),
          },
        ]}
      />

      <div className="border-t border-rule-soft px-4 py-3.5 sm:px-5">
        <Actions node={node} cash={cash} dispatch={dispatch} />
      </div>
    </div>
  );
}

/**
 * A minimal tab set.
 *
 * Real buttons with `aria-selected` and a `tabpanel`, so a screen reader gets
 * the same three-way choice a sighted player does. Only the active panel is
 * mounted — an inactive tab must not be reachable by tabbing into invisible
 * content.
 */
function Tabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0].id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <>
      <div role="tablist" className="flex gap-1 px-3 pt-3 sm:px-4">
        {tabs.map((t) => {
          const on = t.id === current.id;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls={`citytab-${t.id}`}
              onClick={() => setActive(t.id)}
              className={`min-h-[36px] flex-1 rounded-form px-3 text-[13px] font-medium transition ${
                on
                  ? "bg-card-high text-ink"
                  : "text-ink-faint hover:bg-card-high/50 hover:text-ink-soft"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`citytab-${current.id}`}
        className="px-4 pb-1 pt-4 sm:px-5"
      >
        {current.content}
      </div>
    </>
  );
}

/**
 * One figure with its name.
 *
 * A figure that needs explaining carries the explanation with it rather than
 * relying on the reader to guess — the two stats this component gets wrong
 * most easily are exactly the two that look self-evident and are not.
 */
function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <dt
        className="sign text-[11.5px] text-ink-faint"
        title={hint}
        aria-description={hint}
      >
        {label}
        {hint && (
          <span aria-hidden className="ml-1 text-ink-faint/70">
            ?
          </span>
        )}
      </dt>
      <dd className="num mt-0.5 truncate text-[14px] text-ink">{value}</dd>
    </div>
  );
}

/* ----------------------------------------------------------------- actions */

function Actions({
  node,
  cash,
  dispatch,
}: {
  node: MapNode;
  cash: number;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const c = cityOf(node.id);

  if (node.state === "locked") {
    const short = c.entryCost - cash;
    return (
      <div className="mt-3">
        <Action
          onClick={() => dispatch("enterCity", node.id)}
          reason={short > 0 ? `${money(short)} short of the licence` : null}
          primary
        >
          Register to practise — {money(c.entryCost)}
        </Action>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {FACILITY_TYPES.map((f) => {
        const price = facilityPrice(f.id, node.id);
        const short = price - cash;
        return (
          <Action
            key={f.id}
            onClick={() => dispatch("buyFacility", `${f.id}:${node.id}`)}
            reason={short > 0 ? `${money(short)} short` : null}
            title={`${f.label} in ${node.name} — ${money(price)}`}
          >
            {f.label.split(" ")[0]} {money(price)}
          </Action>
        );
      })}
      {!node.isHome && (
        <Action
          onClick={() => dispatch("relocate", node.id)}
          reason={
            node.state === "operating"
              ? null
              : "you can only work where you have premises"
          }
        >
          Move here
        </Action>
      )}
      {node.isHome && (
        <p className="self-center text-[12.5px] text-ink-faint">
          You work here — your own clinical hours count in this city only.
        </p>
      )}
    </div>
  );
}

/**
 * A button that explains itself when it cannot be pressed. `reason` being
 * non-null is what disables it, so there is no way to add a disabled state
 * without also saying why.
 */
function Action({
  onClick,
  reason,
  title,
  primary,
  children,
}: {
  onClick: () => void;
  reason: string | null;
  title?: string;
  primary?: boolean;
  children: React.ReactNode;
}) {
  const disabled = reason !== null;
  return (
    <span className="inline-flex flex-col gap-0.5">
      <button
        onClick={onClick}
        disabled={disabled}
        title={disabled ? reason : title}
        className={
          primary
            ? "rounded-form bg-clinical px-3 py-1.5 text-[13px] font-medium text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint"
            : "num rounded-form border border-rule bg-card px-2.5 py-1 text-[12.5px] transition hover:border-clinical hover:text-clinical disabled:cursor-not-allowed disabled:opacity-40"
        }
      >
        {children}
      </button>
      {disabled && (
        <span className="text-[11.5px] leading-none text-ink-faint">
          {reason}
        </span>
      )}
    </span>
  );
}
