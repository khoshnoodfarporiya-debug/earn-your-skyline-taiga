import type { ResourceDef } from "./types";

export function money(n: number): string {
  const v = Math.round(n);
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US")}`;
}

export function formatResource(def: ResourceDef, value: number): string {
  switch (def.format) {
    case "money":
      return money(value);
    case "percent":
      return `${Math.round(value)}`;
    case "int":
      return Math.round(value).toLocaleString("en-US");
  }
}

export function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
}

/**
 * A patient count small enough to sit inside a map marker.
 *
 * Below a thousand the real number fits and is shown; above it, one decimal
 * of thousands. Deliberately not an abbreviation with a unit letter that
 * could be read as something else — an earlier version rendered 100 patients
 * as "1h" and every reader took it for one hour.
 */
export function compactCount(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  if (v < 1000) return `${v}`;
  const k = v / 1000;
  // One decimal only where it fits: 1.2k, but 27k rather than 27.3k, so a
  // badge never grows past four characters.
  return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}
