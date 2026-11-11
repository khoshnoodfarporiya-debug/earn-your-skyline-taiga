"use client";

import type { CityId, MedicalState } from "@/lib/game/medical/types";
import { cityOf, populationCeiling } from "@/lib/game/medical/cities";
import { catchmentIn, slotsIn } from "@/lib/game/medical/sim";
import { SPECIALTY_BY_ID } from "@/lib/game/medical/data";
import { money } from "@/lib/game/format";
import { networkNodes } from "@/lib/ui/visuals";

/**
 * COMPARE MODE (Phase 4).
 *
 * The market list answers "which market is highest on this one axis". This
 * answers the question a player actually holds when weighing an expansion:
 * *these two or three, side by side, on every axis at once* — because the
 * decision is never "highest fees", it is "are Tokyo's fees worth Tokyo's
 * costs against Dubai's licence".
 *
 * A real table on a desktop, deliberately: rows are axes with a header
 * cell, columns are cities, and a screen reader walks it as a comparison
 * rather than as three unrelated stacks of numbers. On a phone the same
 * data renders as stacked city cards instead — a table wide enough to be
 * readable is wide enough to grow a phone's layout viewport sideways, even
 * from inside a scroll container, and a page must never scroll sideways.
 *
 * Everything shown is read from the same model the map and the list read.
 * Nothing here is a new number; it is the existing numbers finally sitting
 * next to each other.
 */
export function CompareDrawer({
  m,
  reputation,
  ids,
  onRemove,
  onClear,
}: {
  m: MedicalState;
  reputation: number;
  ids: CityId[];
  onRemove: (id: CityId) => void;
  onClear: () => void;
}) {
  if (ids.length < 2) return null;

  const nodes = networkNodes(m);
  const cols = ids
    .map((id) => {
      const node = nodes.find((n) => n.id === id);
      return node ? { node, city: cityOf(id) } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  if (cols.length < 2) return null;

  /* The strongest case-mix leans, as words — "+35% cardiology" says what a
     bare 1.35 in a bias map cannot. */
  const mixOf = (id: CityId) => {
    const bias = cityOf(id).bias;
    const leans = (Object.entries(bias) as [
      Parameters<typeof SPECIALTY_BY_ID.get>[0],
      number,
    ][])
      .filter(([, x]) => x !== 1)
      .sort((a, b) => Math.abs(b[1] - 1) - Math.abs(a[1] - 1))
      .slice(0, 2)
      .map(([spec, x]) => {
        const label = SPECIALTY_BY_ID.get(spec)?.label ?? spec;
        const pct = Math.round((x - 1) * 100);
        return `${pct > 0 ? "+" : ""}${pct}% ${label.toLowerCase()}`;
      });
    return leans.length > 0 ? leans.join(", ") : "even";
  };

  const rows: {
    label: string;
    value: (c: (typeof cols)[number]) => string;
    tone?: (c: (typeof cols)[number]) => "good" | "alarm" | "plain";
  }[] = [
    {
      label: "Licence",
      value: (c) =>
        c.node.state === "locked" ? money(c.city.entryCost) : "held",
      tone: (c) => (c.node.state === "locked" ? "plain" : "good"),
    },
    { label: "Fees", value: (c) => `${c.city.feeIndex.toFixed(2)}×` },
    {
      label: "Costs",
      value: (c) => `${c.city.costIndex.toFixed(2)}×`,
      tone: (c) => (c.city.costIndex >= 1.3 ? "alarm" : "plain"),
    },
    { label: "Property", value: (c) => `${c.city.propertyIndex.toFixed(2)}×` },
    {
      label: "Competition",
      value: (c) => `${Math.round(c.city.competition * 100)}%`,
    },
    {
      label: "Room to grow",
      value: (c) =>
        Math.round(
          c.node.state === "operating"
            ? catchmentIn(m, c.node.id, reputation)
            : populationCeiling(c.node.id),
        ).toLocaleString("en-US"),
    },
    {
      label: "Your presence",
      value: (c) =>
        c.node.state === "operating"
          ? `${c.node.sites} site${c.node.sites === 1 ? "" : "s"} · ${c.node.panel.toLocaleString("en-US")} patients · ${slotsIn(m, c.node.id)} slots`
          : c.node.state === "licensed"
            ? "licensed, nothing built"
            : "none",
    },
    { label: "Case mix", value: (c) => mixOf(c.node.id) },
    {
      label: "Outbreak",
      value: (c) => (c.node.outbreak ? "active now" : "none"),
      tone: (c) => (c.node.outbreak ? "alarm" : "plain"),
    },
  ];

  return (
    <section aria-labelledby="compare-title" className="form overflow-hidden">
      <div className="form-head flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <h3 id="compare-title" className="sign text-[11.5px] text-ink-faint">
          Side by side
        </h3>
        <button
          type="button"
          onClick={onClear}
          className="sign rounded-form border border-rule bg-card px-2.5 py-1 text-[11px] text-ink-soft transition hover:border-clinical hover:text-clinical"
        >
          Clear comparison
        </button>
      </div>

      {/* ------------------------------------------------- phone: stacked */}
      <div className="divide-y divide-rule-soft md:hidden">
        {cols.map((c) => (
          <div key={c.node.id} className="px-4 py-3">
            <div className="flex items-baseline gap-2">
              <h4 className="text-[14.5px] font-semibold text-ink">
                {c.node.name}
              </h4>
              {c.node.isHome && (
                <span className="sign text-[10.5px] text-clinical">home</span>
              )}
              <button
                type="button"
                onClick={() => onRemove(c.node.id)}
                className="sign ml-auto text-[10.5px] text-ink-faint transition hover:text-alarm"
              >
                remove
                <span className="sr-only">
                  {` ${c.node.name} from the comparison`}
                </span>
              </button>
            </div>
            <dl className="mt-2 space-y-1">
              {rows.map((row) => {
                const tone = row.tone?.(c) ?? "plain";
                return (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <dt className="sign shrink-0 text-[11px] text-ink-faint">
                      {row.label}
                    </dt>
                    <dd
                      className={`num text-right text-[12.5px] ${
                        tone === "good"
                          ? "text-good"
                          : tone === "alarm"
                            ? "text-alarm"
                            : "text-ink"
                      }`}
                    >
                      {row.value(c)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>

      {/* --------------------------------------------- desktop: side by side */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-rule-soft">
              <th scope="col" className="w-32 px-4 py-2.5" aria-label="Axis" />
              {cols.map((c) => (
                <th key={c.node.id} scope="col" className="px-4 py-2.5">
                  <span className="flex items-baseline gap-2">
                    <span className="text-[14.5px] font-semibold text-ink">
                      {c.node.name}
                    </span>
                    {c.node.isHome && (
                      <span className="sign text-[10.5px] text-clinical">
                        home
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemove(c.node.id)}
                      className="sign text-[10.5px] text-ink-faint transition hover:text-alarm"
                    >
                      remove
                      <span className="sr-only">
                        {` ${c.node.name} from the comparison`}
                      </span>
                    </button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-soft">
            {rows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="sign px-4 py-2.5 align-top text-[11.5px] font-normal text-ink-faint"
                >
                  {row.label}
                </th>
                {cols.map((c) => {
                  const tone = row.tone?.(c) ?? "plain";
                  return (
                    <td
                      key={c.node.id}
                      className={`num px-4 py-2.5 align-top text-[13.5px] ${
                        tone === "good"
                          ? "text-good"
                          : tone === "alarm"
                            ? "text-alarm"
                            : "text-ink"
                      }`}
                    >
                      {row.value(c)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
