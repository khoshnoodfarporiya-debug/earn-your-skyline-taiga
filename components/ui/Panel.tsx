import type { ReactNode } from "react";

/**
 * PANEL
 *
 * The section wrapper every management screen was rebuilding by hand:
 *
 *   <section className="form">
 *     <div className="form-head px-5 py-2.5">
 *       <h3 className="sign text-[11.5px] text-ink-soft">…</h3>
 *     </div>
 *     <p className="border-b border-rule-soft px-5 py-2.5 text-[12px] …">…</p>
 *
 * Twenty-odd copies, with the padding and type size drifting between them —
 * 12px here, 12.5px there, some with the divider, some without. One component
 * means the next screen inherits the decisions rather than re-making them.
 *
 * `aside` is the right-hand figure in the header (a count, a total). `note` is
 * the one line explaining what the section is for, which reads better above
 * the contents than buried in a tooltip.
 */
export function Panel({
  title,
  aside,
  note,
  flush,
  children,
}: {
  title: string;
  aside?: ReactNode;
  note?: ReactNode;
  /** Contents manage their own padding (grids, dividers, tables). */
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="form overflow-hidden">
      <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
        <h3 className="t-label text-ink-soft">{title}</h3>
        {aside ? <div className="num text-[12px] text-ink-soft">{aside}</div> : null}
      </div>

      {note ? (
        <p className="border-b border-rule-soft px-5 py-2.5 text-[12.5px] leading-snug text-ink-soft">
          {note}
        </p>
      ) : null}

      {flush ? children : <div className="px-5 py-4">{children}</div>}
    </section>
  );
}

/**
 * A row of figures under a panel header — the "what this is doing for you"
 * strip. Hairline-separated cells rather than bordered boxes, so four numbers
 * read as one instrument instead of four cards.
 */
export function StatRow({
  stats,
}: {
  stats: { label: string; value: ReactNode; note?: string; tone?: Tone }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-px bg-rule-soft sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-card px-5 py-3.5">
          <p className="t-label text-ink-faint">{s.label}</p>
          <p className={`t-value mt-1 ${s.tone ? TONE_TEXT[s.tone] : "text-ink"}`}>
            {s.value}
          </p>
          {s.note ? (
            <p className="mt-0.5 text-[12px] text-ink-faint">{s.note}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export type Tone = "neutral" | "good" | "caution" | "alarm" | "accent";

export const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ink",
  good: "text-good",
  caution: "text-caution",
  alarm: "text-alarm",
  accent: "text-clinical",
};
