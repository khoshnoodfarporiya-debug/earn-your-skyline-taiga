/**
 * THE PHYSICIAN SYMBOL FAMILY
 *
 * One drawing style for every symbol in the medical career, so a player learns
 * the vocabulary once and reads it everywhere: a stethoscope means clinical
 * work whether it is on a nav item, a staff card or a case row.
 *
 * ------------------------------------------------------------- the rules
 *
 * Every glyph is drawn on a 24×24 grid with a 1.6 stroke, round caps and round
 * joins, and **no fills**. That is the whole style guide, and it is enforced by
 * the shared `common` object below rather than by convention — an icon cannot
 * accidentally arrive at 1.5 or with a mitred corner, because no glyph sets its
 * own stroke.
 *
 * Consequences worth stating:
 *
 * 1. **Nothing here is filled.** The interface already had three icon idioms —
 *    outline SVGs in `Icons.tsx`, filled department dots, and emoji in a couple
 *    of strings. Mixed weights read as mixed origins, which is exactly what a
 *    visual identity is for.
 *
 * 2. **Detail is capped for 16px.** Each glyph is drawn with at most a handful
 *    of strokes and no feature smaller than about 2 units, because these are
 *    used at 16–24px far more often than at 48. A microscope with a legible
 *    focus knob at 48px is a smudge at 16.
 *
 * 3. **No graphic medicine.** No blood, no wounds, no surgical detail, no
 *    distressed patients. The subjects are instruments, rooms, records and
 *    people.
 *
 * 4. **The cross is rationed.** It appears on the patient glyph and nowhere
 *    else. A screen where every symbol carries a cross carries no information
 *    in the cross at all.
 *
 * An icon is never the only carrier of meaning: everywhere one of these is
 * used, a text label sits beside it or an `aria-label` is supplied.
 */

export type MedIconName =
  // --- the practice
  | "stethoscope" // general clinical work
  | "clinic" // premises
  | "bed" // capacity
  | "patient" // patients
  | "pulse" // patient condition
  | "microscope" // research
  | "flask" // laboratory
  | "ecg" // cardiac diagnostics
  | "capsule" // supplies
  | "shield" // safety and compliance
  | "certificate" // qualification
  | "team" // staffing
  | "globe" // network
  | "alert" // risk
  | "clipboard" // contracts and administration
  | "money" // finance
  | "clock" // time and hours
  | "ambulance" // the fleet
  // --- departments
  | "heart"
  | "brain"
  | "bone"
  | "child"
  | "skin"
  | "mind"
  | "scan"
  | "maternity"
  | "emergency"
  | "scalpel"
  | "cell";

export function MedIcon({
  name,
  className = "h-5 w-5",
  label,
}: {
  name: MedIconName;
  className?: string;
  /**
   * Supply this only when the icon is the sole carrier of its meaning. When a
   * text label sits beside it — which is the normal case — leave it off and the
   * icon is hidden from assistive technology instead of read twice.
   */
  label?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...(label
      ? { role: "img" as const, "aria-label": label }
      : { "aria-hidden": true, focusable: false as const }),
  };

  return <svg {...common}>{PATHS[name] ?? PATHS.stethoscope}</svg>;
}

/**
 * The glyphs themselves.
 *
 * A lookup rather than a switch so the set can be enumerated — the test that
 * asserts every department has an icon walks this object, and a department
 * pointing at a name that does not exist here fails rather than silently
 * falling back to a stethoscope.
 */
const PATHS: Record<MedIconName, React.ReactNode> = {
  stethoscope: (
    <>
      <path d="M5 3v5a4 4 0 0 0 8 0V3" />
      <path d="M4 3h2M12 3h2" />
      <path d="M9 12v3a5 5 0 0 0 10 0v-1" />
      <circle cx="19" cy="11" r="2" />
    </>
  ),
  clinic: (
    <>
      <path d="M3 21V8l6-4 6 4v13" />
      <path d="M15 21V11h6v10" />
      <path d="M3 21h18" />
      <path d="M9 9v4M7 11h4" />
    </>
  ),
  /* A van in profile with the cross on its flank. The cross appears on
     exactly one other glyph, and this is the second place it earns its
     keep — an ambulance without one reads as a delivery van. */
  ambulance: (
    <>
      <path d="M2 17V8h11v9" />
      <path d="M13 11h4l4 3.5V17h-3" />
      <path d="M2 17h4M11 17h2" />
      <circle cx="8" cy="17.5" r="2" />
      <circle cx="18" cy="17.5" r="2" />
      <path d="M6.5 10.5v3M5 12h3" />
    </>
  ),
  bed: (
    <>
      <path d="M3 19v-9M3 14h18v5" />
      <path d="M21 19v-4a3 3 0 0 0-3-3h-7v2" />
      <circle cx="7" cy="10" r="2" />
    </>
  ),
  patient: (
    <>
      <circle cx="12" cy="6" r="3" />
      <path d="M6 21v-3a6 6 0 0 1 12 0v3" />
      {/* The one cross in the family. */}
      <path d="M12 13v4M10 15h4" />
    </>
  ),
  pulse: (
    <>
      <path d="M20.5 10c0 4.5-8.5 9.5-8.5 9.5S3.5 14.5 3.5 10a4.5 4.5 0 0 1 8.5-2.1A4.5 4.5 0 0 1 20.5 10z" />
    </>
  ),
  microscope: (
    <>
      <path d="M6 21h13" />
      <path d="M9 21a6 6 0 0 0 6-9" />
      <path d="M8 15h4" />
      <path d="M11 5.5 8.5 8l3.5 4 2.5-2.5z" />
      <path d="M13 3.5 15 5.5" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3v6L4.5 17.5A2 2 0 0 0 6.3 20.5h11.4a2 2 0 0 0 1.8-3L15 9V3" />
      <path d="M8 3h8" />
      <path d="M7.5 14h9" />
    </>
  ),
  ecg: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M5.5 12h3l1.5-3 2.5 6 1.5-3h4.5" />
    </>
  ),
  capsule: (
    <>
      <rect x="2.5" y="8" width="19" height="8" rx="4" />
      <path d="M12 8v8" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  certificate: (
    <>
      <rect x="3.5" y="3.5" width="17" height="12" rx="1.5" />
      <path d="M7 7.5h10M7 11h5" />
      <path d="M9 15.5v5l3-1.6 3 1.6v-5" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="7.5" r="3" />
      <path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2" />
      <path d="M16 4.2a3 3 0 0 1 0 6.6" />
      <path d="M17 13.4a5 5 0 0 1 4 4.6v2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.8 21 19.5H3z" />
      <path d="M12 9.5v4.5M12 17h.01" />
    </>
  ),
  clipboard: (
    <>
      <rect x="4.5" y="4.5" width="15" height="16" rx="2" />
      <path d="M9 4.5V3.2A1.2 1.2 0 0 1 10.2 2h3.6A1.2 1.2 0 0 1 15 3.2v1.3z" />
      <path d="M8.5 11h7M8.5 15h4.5" />
    </>
  ),
  money: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),

  // ------------------------------------------------------------ departments
  heart: (
    <>
      <path d="M20.5 9.6c0 4.3-8.5 9.4-8.5 9.4S3.5 13.9 3.5 9.6a4.4 4.4 0 0 1 8.5-2A4.4 4.4 0 0 1 20.5 9.6z" />
      <path d="M6.5 11.2h3l1.3-2.2 1.9 4.2 1.2-2h3.6" />
    </>
  ),
  brain: (
    <>
      <path d="M12 5.2A3.2 3.2 0 0 0 6 6.6a3 3 0 0 0-1.4 5A3.2 3.2 0 0 0 6.6 17a3.2 3.2 0 0 0 5.4 1.6z" />
      <path d="M12 5.2A3.2 3.2 0 0 1 18 6.6a3 3 0 0 1 1.4 5A3.2 3.2 0 0 1 17.4 17a3.2 3.2 0 0 1-5.4 1.6z" />
      <path d="M12 5.2v13.4" />
    </>
  ),
  bone: (
    <>
      <path d="M6.5 17.5 17.5 6.5" />
      <path d="M5.4 14.4a2.4 2.4 0 1 0-2.1 3.6 2.4 2.4 0 0 0 3.4 3.1" />
      <path d="M18.6 9.6a2.4 2.4 0 1 0 2.1-3.6 2.4 2.4 0 0 0-3.4-3.1" />
    </>
  ),
  child: (
    <>
      <circle cx="12" cy="7" r="3.4" />
      <path d="M9.3 4.6C8 3.6 7 3.9 7 5.2M14.7 4.6c1.3-1 2.3-.7 2.3.6" />
      <path d="M7.5 21v-3a4.5 4.5 0 0 1 9 0v3" />
    </>
  ),
  skin: (
    <>
      <path d="M4.5 12a7.5 7.5 0 0 1 15 0 7.5 7.5 0 0 1-15 0z" />
      <path d="M9 10.5h.01M14.2 9.6h.01M11.5 13.8h.01M15 14.2h.01" />
    </>
  ),
  mind: (
    <>
      <path d="M4.5 11.5a7 7 0 1 1 3.4 6L4 19l1.1-3.4a7 7 0 0 1-.6-4.1z" />
      <path d="M9.6 10a2.4 2.4 0 0 1 4.5 1.1c0 1.6-2.1 1.9-2.1 3.2" />
      <path d="M12 16.6h.01" />
    </>
  ),
  scan: (
    <>
      <path d="M3.5 8V5.5a2 2 0 0 1 2-2H8M16 3.5h2.5a2 2 0 0 1 2 2V8M20.5 16v2.5a2 2 0 0 1-2 2H16M8 20.5H5.5a2 2 0 0 1-2-2V16" />
      <path d="M3.5 12h17" />
    </>
  ),
  maternity: (
    <>
      <circle cx="10" cy="5.5" r="2.6" />
      <path d="M10 8.1c-2.6 0-4.2 2-4.2 4.6V21" />
      <path d="M10 12.5a4 4 0 1 1 0 8" />
    </>
  ),
  emergency: (
    <>
      <path d="M3 17V9a2 2 0 0 1 2-2h8v10" />
      <path d="M13 10h3.5l3.5 3.6V17" />
      <circle cx="7.5" cy="18.5" r="1.8" />
      <circle cx="16.5" cy="18.5" r="1.8" />
    </>
  ),
  scalpel: (
    <>
      <path d="M4 20 9 15" />
      <path d="M9.5 14.5 19 5a2.2 2.2 0 0 0-3.2-3L8 10.5z" />
    </>
  ),
  cell: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="10.5" cy="10.5" r="2.6" />
      <path d="M15 14.5h.01M13.8 17.4h.01M16.8 11.6h.01" />
    </>
  ),
};

/** Every name the family knows, for tests and for enumerating the set. */
export const MED_ICON_NAMES = Object.keys(PATHS) as MedIconName[];
