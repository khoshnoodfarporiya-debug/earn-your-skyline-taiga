"use client";

import { useState } from "react";
/**
 * What the composer actually needs from a post, generic over the career's
 * own context type — the doctor's `PostDef` and the chef's `ChefPostDef`
 * both satisfy it structurally, and neither leaks into the other.
 */
interface ComposerPost<C> {
  id: string;
  label: string;
  blurb: string;
  body: (c: C) => string;
  hazard?: number;
  preview: string[];
  /** Grouping word shown beside the chosen post. Career-specific. */
  category: string;
}

/**
 * The composer.
 *
 * Only posts the current run actually supports are offered, and each one
 * states its consequences before you publish — the point is a legible trade,
 * not a surprise. Anything carrying a confidentiality or accuracy hazard says
 * so in plain words and in a marked block, never by colour alone.
 */
export function PostComposer<C>({
  posts,
  context,
  canPost,
  week,
  emptyLine,
  onPublish,
}: {
  posts: ComposerPost<C>[];
  context: C;
  canPost: boolean;
  week: number;
  /** The career's own advice for an empty catalogue. */
  emptyLine: string;
  onPublish: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  /*
   * Collapsed by default.
   *
   * By mid-run there are eleven eligible posts, and rendered as an open wall
   * of chips they took the whole handset screen — the feed, which is the thing
   * the phone is for, started below the fold. Posting is a once-a-week
   * decision; the feed is what you open the phone to read. So the composer is
   * a single line until you want it.
   */
  const [open, setOpen] = useState(false);
  const chosen = posts.find((p) => p.id === selected) ?? null;

  if (!canPost) {
    return (
      <div className="border-b border-rule/60 bg-[#101C31] px-4 py-3.5">
        <p className="sign text-[11.5px] text-ink-faint">Composer</p>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
          You have already posted this week. One meaningful post a week —
          anything more and people stop reading.
        </p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="border-b border-rule/60 bg-[#101C31] px-4 py-3.5">
        <p className="sign text-[11.5px] text-ink-faint">Composer</p>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
          {emptyLine}
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-rule/60 bg-card px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-baseline justify-between gap-3 text-left"
      >
        <span className="sign text-[11.5px] text-clinical">
          Compose · week {week}
        </span>
        <span className="num text-[12px] text-ink-faint">
          {posts.length} available
          <span aria-hidden className="ml-2 inline-block">
            {open ? "▴" : "▾"}
          </span>
        </span>
      </button>

      {!open && (
        <p className="mt-1 text-[13px] leading-snug text-ink-soft">
          One post a week. Tap to see what is worth saying.
        </p>
      )}

      <div className={`mt-2.5 flex-wrap gap-1.5 ${open ? "flex" : "hidden"}`}>
        {posts.map((p) => {
          const active = p.id === selected;
          return (
            <button
              key={p.id}
              onClick={() => setSelected(active ? null : p.id)}
              aria-pressed={active}
              className={`min-h-[38px] rounded-form border px-3 text-[13.5px] transition ${
                active
                  ? "border-clinical bg-clinical-tint text-clinical"
                  : "border-rule bg-card text-ink-soft hover:border-clinical/50 hover:text-ink"
              }`}
            >
              {p.label}
              {p.hazard !== undefined && (
                <span aria-hidden className="ml-1.5 text-caution">
                  ⚠
                </span>
              )}
            </button>
          );
        })}
      </div>

      {chosen && (
        <div className="mt-3 rounded-form border border-rule bg-[#0B1526] p-3">
          <p className="text-[14.5px] leading-relaxed text-ink">
            &ldquo;{chosen.body(context)}&rdquo;
          </p>

          <ul className="mt-3 space-y-1">
            {chosen.preview.map((line) => (
              <li
                key={line}
                className="num flex gap-2 text-[13px] leading-snug text-ink-soft"
              >
                <span aria-hidden className="text-clinical">
                  ·
                </span>
                {line}
              </li>
            ))}
          </ul>

          {chosen.hazard !== undefined && (
            <p className="mt-3 rounded-form border border-caution/50 bg-caution-tint px-3 py-2 text-[13px] leading-snug text-caution">
              <span className="sign mr-1.5 text-[11.5px]">Risk</span>
              {Math.round(chosen.hazard * 100)}% chance this rebounds on you.
              {chosen.category === "caseStudy" &&
                " A safer, anonymised version of this post is always available."}
            </p>
          )}

          <button
            onClick={() => {
              onPublish(chosen.id);
              setSelected(null);
            }}
            className="mt-3 min-h-[46px] w-full rounded-form bg-clinical px-4 text-[14px] font-bold text-on-accent transition hover:brightness-110"
          >
            Publish
          </button>
        </div>
      )}
    </div>
  );
}
