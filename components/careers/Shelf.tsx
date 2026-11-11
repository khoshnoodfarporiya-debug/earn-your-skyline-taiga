"use client";

import { money } from "@/lib/game/format";
import type { ChefArt } from "@/lib/ui/chefArt";
import { ChefThumb } from "./ChefScene";

/**
 * The two primitives the Chef and the Solicitor share.
 *
 * They lived inside `OperationPanel` while that file was the only screen
 * either career had. Splitting the Chef into five screens made them shared
 * rather than local, so they moved out here instead of being copied — the
 * failure mode of a copy is two shelves that stop looking alike.
 */

/** A list of things you can buy or take on, each with its one control. */
export function Shelf({
  title,
  note,
  items,
  cmd,
  onCommand,
}: {
  title: string;
  note: string;
  items: {
    id: string;
    label: string;
    blurb: string;
    price: number;
    meta: string;
    disabled: boolean;
    /**
     * Why it cannot be pressed, in the player's words.
     *
     * A greyed-out button showing a price and nothing else is a dead end:
     * the player cannot tell whether they are too poor, too small, or
     * looking at something that is simply not for them yet.
     */
    why?: string;
    /**
     * The thing, photographed. Optional, and absent for every item that has
     * no master — the card then renders exactly as it always did rather than
     * reserving a hole. A card that cannot be afforded keeps its picture and
     * dims it, because "save towards this" needs to be legible.
     */
    art?: ChefArt | null;
  }[];
  cmd: string;
  onCommand: (cmd: string, arg: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-lg border border-rule bg-card p-4">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-xs text-ink-faint">{note}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li
            key={i.id}
            className="flex flex-col justify-between gap-2 overflow-hidden rounded border border-rule-soft p-3 text-xs"
          >
            <div>
              {i.art && (
                <ChefThumb
                  art={i.art}
                  state={i.disabled ? "blocked" : "available"}
                  className="mb-2.5 w-full"
                />
              )}
              <p className="font-medium text-ink">{i.label}</p>
              <p className="mt-0.5 text-ink-faint">{i.blurb}</p>
              <p className="mt-1 text-ink-faint">{i.meta}</p>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <button
                type="button"
                disabled={i.disabled}
                onClick={() => onCommand(cmd, i.id)}
                className="rounded border border-rule px-2.5 py-1 text-ink enabled:hover:border-clinical disabled:cursor-not-allowed disabled:opacity-45"
              >
                {i.price > 0 ? money(i.price) : "Take it"}
              </button>
              {/* Written next to the control rather than hidden in a `title`:
                  a tooltip is not reachable by keyboard and is not read out,
                  so the one player who most needs the reason never gets it. */}
              {i.disabled && i.why && (
                <span className="text-ink-faint">{i.why}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One figure with its label, for a row of them under a heading. */
export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div>
      <dt className="text-ink-faint">{label}</dt>
      <dd className={`font-semibold ${tone === "bad" ? "text-alarm" : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}
