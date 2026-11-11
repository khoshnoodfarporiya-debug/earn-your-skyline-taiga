/**
 * The bottom of a phone app.
 *
 * A handset screen is ~600px tall and week four has one message in it, so
 * every app ended in half a screen of blank navy — which reads as content that
 * failed to load rather than as the end of a short list. A quiet closing line
 * costs nothing and says "that is everything", which is the true thing.
 */
export function EndOfList({ children }: { children: string }) {
  return (
    <p className="px-4 py-6 text-center text-[12.5px] leading-snug text-ink-faint">
      <span aria-hidden className="mr-2">
        ·
      </span>
      {children}
      <span aria-hidden className="ml-2">
        ·
      </span>
    </p>
  );
}
