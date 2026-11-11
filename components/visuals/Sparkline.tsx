/**
 * A twelve-week trend, drawn small.
 *
 * The only chart in the interface that is genuinely a chart, and it is here
 * because direction over time is the one thing a number and a delta cannot
 * show: "credibility 58, +4" is equally true of a steady climb and of a
 * collapse that has just started to recover.
 *
 * ------------------------------------------------------------- constraints
 *
 * No axes, no gridlines, no tooltip. It is 64×20 next to a figure that already
 * states the current value and the movement, so anything more would be
 * decoration competing with the text it sits beside.
 *
 * `aria-hidden` throughout: the caller states the value, the delta and the
 * reason in words. A screen reader being read a series of twelve numbers would
 * be worse than being read nothing.
 */
export function Sparkline({
  values,
  tone = "neutral",
  className = "h-5 w-16",
}: {
  values: number[];
  tone?: "good" | "bad" | "neutral";
  className?: string;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  /* A flat series would divide by zero and, worse, would draw a line through
     the top of the box rather than the middle. */
  const span = max - min || 1;
  const step = 100 / (values.length - 1);

  const points = values
    .map((v, i) => `${(i * step).toFixed(2)},${(28 - ((v - min) / span) * 24).toFixed(2)}`)
    .join(" ");

  const stroke =
    tone === "good"
      ? "var(--spark-good, #43C78B)"
      : tone === "bad"
        ? "var(--spark-bad, #EF6461)"
        : "var(--spark-neutral, #71829B)";

  return (
    <svg
      className={className}
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <polyline
        points={points}
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
