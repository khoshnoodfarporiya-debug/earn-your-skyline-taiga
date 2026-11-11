"use client";

import { useMemo, useState } from "react";
import type { CityId, MedicalState } from "@/lib/game/medical/types";
import { cityOf, populationCeiling } from "@/lib/game/medical/cities";
import { catchmentIn, slotsIn } from "@/lib/game/medical/sim";
import { money } from "@/lib/game/format";
import { networkNodes } from "@/lib/ui/visuals";

/**
 * THE MARKET LIST
 *
 * One compact, sortable, filterable row per market — replacing the wall of
 * fourteen large cards that used to sit under the map repeating everything
 * the map and the intelligence panel had already said.
 *
 * It exists for the questions a map is bad at: *which* market has the highest
 * fees, which are cheapest to enter, where am I actually making money. Those
 * are comparisons across rows, and a table answers them in one glance where a
 * map cannot answer them at all.
 *
 * Selecting a row drives the same selection the map uses, so the two are one
 * interface rather than two views that happen to agree.
 */

type SortKey = "name" | "entry" | "fees" | "costs" | "ceiling" | "panel";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "entry", label: "Licence" },
  { id: "fees", label: "Fees" },
  { id: "costs", label: "Costs" },
  { id: "ceiling", label: "Room to grow" },
  { id: "panel", label: "Your patients" },
];

export function MarketList({
  m,
  reputation,
  selected,
  onSelect,
  compare,
  onToggleCompare,
}: {
  m: MedicalState;
  reputation: number;
  selected: CityId;
  onSelect: (id: CityId) => void;
  /** Markets currently held side by side, capped at three by the owner. */
  compare: CityId[];
  onToggleCompare: (id: CityId) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [minesOnly, setMinesOnly] = useState(false);

  const rows = useMemo(() => {
    const nodes = networkNodes(m);
    const q = query.trim().toLowerCase();
    return nodes
      .filter((n) => (minesOnly ? n.state !== "locked" : true))
      .filter(
        (n) =>
          q === "" ||
          n.name.toLowerCase().includes(q) ||
          n.country.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const ca = cityOf(a.id);
        const cb = cityOf(b.id);
        switch (sort) {
          case "entry":
            return ca.entryCost - cb.entryCost;
          case "fees":
            return cb.feeIndex - ca.feeIndex;
          case "costs":
            return ca.costIndex - cb.costIndex;
          case "ceiling":
            return populationCeiling(b.id) - populationCeiling(a.id);
          case "panel":
            return b.panel - a.panel;
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [m, query, sort, minesOnly]);

  return (
    <section aria-labelledby="market-list-title" className="form">
      <div className="form-head flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <h3
          id="market-list-title"
          className="sign text-[11.5px] text-ink-faint"
        >
          All markets
        </h3>
        <p className="num text-[12px] text-ink-faint">
          {rows.length} of {networkNodes(m).length}
        </p>
      </div>

      {/* ------------------------------------------------------------ filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-rule-soft px-4 py-2.5">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search markets by city or country</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city or country"
            className="w-full min-w-0 rounded-form border border-rule bg-paper px-2.5 py-1.5 text-[13.5px] text-ink placeholder:text-ink-faint focus-visible:border-clinical focus-visible:outline-none"
          />
        </label>

        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
          <span className="sr-only sm:not-sr-only">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort markets by"
            className="rounded-form border border-rule bg-paper px-2 py-1.5 text-[13px] text-ink focus-visible:border-clinical focus-visible:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setMinesOnly((v) => !v)}
          aria-pressed={minesOnly}
          className={`rounded-form border px-2.5 py-1.5 text-[12.5px] transition ${
            minesOnly
              ? "border-clinical bg-clinical-tint text-clinical"
              : "border-rule bg-card text-ink-soft hover:border-clinical hover:text-clinical"
          }`}
        >
          Mine only
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-[14px] text-ink-soft">
          No market matches that search.
        </p>
      ) : (
        <ul className="divide-y divide-rule-soft">
          {rows.map((n) => {
            const c = cityOf(n.id);
            const isSelected = n.id === selected;
            const inCompare = compare.includes(n.id);
            const compareFull = compare.length >= 3 && !inCompare;
            return (
              /* The compare toggle is a SIBLING of the row button, never a
                 child: a button inside a button is a hydration error this
                 codebase has already paid for once. */
              <li key={n.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => onSelect(n.id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={`flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left transition ${
                    isSelected ? "bg-clinical-tint" : "hover:bg-paper"
                  }`}
                >
                  {/* State by shape and colour, and spelled out in the row. */}
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      n.state === "operating"
                        ? "bg-clinical"
                        : n.state === "licensed"
                          ? "border-2 border-clinical"
                          : "border border-ink-faint/70"
                    }`}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[14.5px] font-medium text-ink">
                        {n.name}
                      </span>
                      <span className="num text-[11.5px] text-ink-faint">
                        {n.country}
                      </span>
                      {n.isHome && (
                        <span className="sign text-[11px] text-clinical">
                          you are here
                        </span>
                      )}
                      {n.outbreak && (
                        <span className="sign text-[11px] text-alarm">
                          outbreak
                        </span>
                      )}
                    </span>
                    <span className="num mt-0.5 block text-[12px] text-ink-soft">
                      {n.state === "operating"
                        ? `${n.sites} site${n.sites === 1 ? "" : "s"} · ${n.panel.toLocaleString("en-US")} patients · ${slotsIn(m, n.id)} slots`
                        : n.state === "licensed"
                          ? "Licensed · nothing built"
                          : `Licence ${money(c.entryCost)}`}
                    </span>
                  </span>

                  {/* The comparison columns, which are the reason this list
                      exists. Hidden on the narrowest screens, where the row
                      summary above already carries the essentials. */}
                  <span className="num hidden shrink-0 gap-4 text-right text-[12px] sm:flex">
                    <span className="w-14">
                      <span className="block text-ink-faint">fees</span>
                      <span
                        className={
                          c.feeIndex >= 1.3 ? "text-good" : "text-ink-soft"
                        }
                      >
                        {c.feeIndex.toFixed(2)}×
                      </span>
                    </span>
                    <span className="w-14">
                      <span className="block text-ink-faint">costs</span>
                      <span
                        className={
                          c.costIndex >= 1.3 ? "text-alarm" : "text-ink-soft"
                        }
                      >
                        {c.costIndex.toFixed(2)}×
                      </span>
                    </span>
                    <span className="w-16">
                      <span className="block text-ink-faint">
                        {n.state === "operating" ? "ceiling" : "room to grow"}
                      </span>
                      <span className="text-ink-soft">
                        {Math.round(
                          n.state === "operating"
                            ? catchmentIn(m, n.id, reputation)
                            : populationCeiling(n.id),
                        ).toLocaleString("en-US")}
                      </span>
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleCompare(n.id)}
                  aria-pressed={inCompare}
                  disabled={compareFull}
                  title={
                    compareFull
                      ? "Three markets is the comparison's width"
                      : undefined
                  }
                  className={`sign my-2 mr-3 shrink-0 self-center rounded-form border px-2.5 py-1.5 text-[11px] transition ${
                    inCompare
                      ? "border-clinical bg-clinical-tint text-clinical"
                      : "border-rule bg-card text-ink-faint hover:border-clinical hover:text-clinical disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-rule disabled:hover:text-ink-faint"
                  }`}
                >
                  {inCompare ? "comparing" : "compare"}
                  <span className="sr-only">{` ${n.name}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
