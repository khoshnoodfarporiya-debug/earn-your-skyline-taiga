"use client";

import type { ScreenId } from "@/lib/ui/navigation";
import { MedIcon, type MedIconName } from "../visuals/MedIcon";

/**
 * NOTHING HERE, AND WHY, AND WHAT TO DO
 *
 * An empty panel is a question the interface has failed to answer. "Nothing in
 * progress" is technically true and completely useless: it does not say whether
 * that is normal, whether it is a problem, or what would change it.
 *
 * So the shape is fixed, and the type enforces it. Four things, always:
 *
 *   what   the state, plainly — "no contracts running"
 *   why    the mechanism that produced it — not an apology, a cause
 *   can    what the player is able to do about it
 *   go     the screen where they would do it, when there is one
 *
 * `why` and `can` are required. A panel that cannot explain its own emptiness
 * is a panel that should not be rendering an empty state at all — it should be
 * rendering the thing that is missing.
 *
 * ------------------------------------------------------------------- on tone
 *
 * "Nothing is spreading. It will not last." is better writing than "no
 * outbreaks", and it is still not guidance. Both go in: the voice stays, and
 * the sentence that tells you what to do goes underneath it.
 */
export function EmptyState({
  icon = "clipboard",
  what,
  why,
  can,
  go,
  onNavigate,
}: {
  icon?: MedIconName;
  /** The state, in a short phrase. */
  what: string;
  /** The mechanism that produced it. Never an apology. */
  why: string;
  /** What the player can do — or that waiting is genuinely the right answer. */
  can: string;
  /** Where to do it. Omitted when the answer is honestly "keep playing". */
  go?: { label: string; destination: ScreenId };
  onNavigate?: (screen: ScreenId) => void;
}) {
  return (
    <div className="flex gap-3.5 px-5 py-5">
      <span aria-hidden className="mt-0.5 shrink-0 text-ink-faint">
        <MedIcon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-ink">{what}</p>
        <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-ink-soft">
          {why}
        </p>
        <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-ink-soft">
          {can}
        </p>
        {go && onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate(go.destination)}
            className="mt-2.5 min-h-[44px] rounded-form bg-card-high px-3.5 text-[12.5px] text-clinical transition hover:text-clinical-hover"
          >
            {go.label}
          </button>
        )}
      </div>
    </div>
  );
}
