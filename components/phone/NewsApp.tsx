"use client";

import type { RunState } from "@/lib/game/types";
import { phoneOf } from "@/lib/ui/phoneAccess";
import { EndOfList } from "./EndOfList";

const TONE = {
  good: { word: "Positive", cls: "text-good border-good/50 bg-good-tint" },
  bad: { word: "Concerning", cls: "text-alarm border-alarm/50 bg-alarm-tint" },
  neutral: { word: "Industry", cls: "text-ink-faint border-rule bg-card" },
} as const;

/**
 * News: outbreaks, competitors and regulation, written from the run's own
 * state. Each item is tagged with a word as well as a colour.
 */
export function NewsApp({ state }: { state: RunState }) {
  const phone = phoneOf(state);
  /*
   * Two sources, one feed.
   *
   * The phone's own items are the run's private drama (an outbreak in your
   * city, a competitor's press release). `state.news` is the world reporting
   * itself, and every item there carries a real gameplay effect. Merging them
   * and sorting by week is right because the *player* does not experience two
   * kinds of news — but each world item shows its `impact` line, so the ones
   * that changed something are distinguishable from the ones that are colour.
   */
  const world = (state.news ?? []).map((n) => ({
    id: n.id,
    week: n.week,
    outlet: n.outlet,
    headline: n.headline,
    body: n.body,
    tone: n.tone,
    read: true,
    impact: n.impact,
  }));
  const news = [
    ...(phone?.news ?? []).map((n) => ({ ...n, impact: "" })),
    ...world,
  ].sort((a, b) => b.week - a.week);

  if (news.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[14px] leading-relaxed text-ink-soft">
        No stories yet. The trade press notices outbreaks, expansions and
        anything a regulator says.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-rule/40">
      {news.map((item) => {
        const tone = TONE[item.tone];
        return (
          <li
            key={item.id}
            className={`px-4 py-3.5 ${!item.read ? "bg-clinical-tint/40" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-[12px] text-ink-faint">
                {item.outlet}
              </span>
              <span
                className={`sign rounded-sm border px-1.5 py-0.5 text-[11.5px] ${tone.cls}`}
              >
                {tone.word}
              </span>
              <span className="num ml-auto text-[12px] text-ink-faint">
                wk {item.week}
              </span>
            </div>
            <h3 className="mt-1.5 text-[14.5px] font-semibold leading-snug text-ink">
              {item.headline}
            </h3>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              {item.body}
            </p>
            {item.impact && (
              /* The line that separates news from wallpaper: what this
                 actually did to the game. */
              <p className="num mt-1.5 text-[12.5px] text-clinical">
                {item.impact}
              </p>
            )}
          </li>
        );
      })}
      <li>
        <EndOfList>You have read everything</EndOfList>
      </li>
    </ul>
  );
}
