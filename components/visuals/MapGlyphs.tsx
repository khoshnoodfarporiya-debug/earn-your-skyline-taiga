/**
 * MAP GLYPHS
 *
 * Small drawn marks for the board. Deliberately SVG rather than emoji: an
 * emoji padlock renders as a different picture on every platform, carries its
 * own colour that fights the palette, and cannot be tinted to match the state
 * it belongs to. These inherit `currentColor` and look the same everywhere.
 */

/** A closed padlock: shackle above, body below. */
export function LockGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 14"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      aria-hidden
    >
      {/* Shackle */}
      <path d="M3.6 6V4.2a2.4 2.4 0 0 1 4.8 0V6" />
      {/* Body */}
      <rect
        x={1.6}
        y={6}
        width={8.8}
        height={6.6}
        rx={1.4}
        fill="currentColor"
        fillOpacity={0.18}
      />
      {/* Keyhole */}
      <circle cx={6} cy={9.3} r={0.9} fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * A person, for a patient count.
 *
 * Exists so a number on a marker is not a riddle: "190" could be patients,
 * reputation, staff or money, and the glyph settles it before the tooltip
 * has to.
 */
export function PatientGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={className} fill="currentColor" aria-hidden>
      <circle cx={5} cy={2.7} r={2} />
      <path d="M0.8 9.6c0-2.3 1.9-3.7 4.2-3.7s4.2 1.4 4.2 3.7z" />
    </svg>
  );
}

/** A clinical cross, for the city you work in. */
export function HomeGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} fill="currentColor" aria-hidden>
      <path d="M4.9 1h2.2v3.9H11v2.2H7.1V11H4.9V7.1H1V4.9h3.9z" />
    </svg>
  );
}
