import type { RunState } from "../game/types";
import { REPUTATIONS, readRep, recentRepChanges, type RepId } from "../game/reputation";
import type { MedIconName } from "../../components/visuals/MedIcon";
import type { ScreenId } from "./navigation";

/**
 * WHAT EACH KIND OF STANDING ACTUALLY DOES
 *
 * `REPUTATIONS` already says what each category *is* and what moves it. Two
 * things were missing, and they are the two a player needs to decide whether to
 * care: what it does to the simulation, and the cheapest way to raise it.
 *
 * Those live here rather than in `lib/game/reputation.ts` because they are
 * guidance about play, not model data — the engine has no use for the sentence
 * "influence gates the professorship", and putting UI prose in the game module
 * is how the two drift.
 *
 * Each `effect` names a real mechanism you can find in the code. Each `route`
 * names something the player can do this week, with the screen it is on.
 */

export interface StandingGuide {
  id: RepId;
  icon: MedIconName;
  /** What this number does to the simulation. */
  effect: string;
  /** The most direct way to raise it, and where. */
  route: string;
  destination: ScreenId;
}

export const STANDING_GUIDE: Record<RepId, StandingGuide> = {
  credibility: {
    id: "credibility",
    icon: "certificate",
    effect:
      "Drives how much of each city's catchment you can hold, and how many of your panel present each week. It is the single biggest lever on how many patients arrive at all.",
    route:
      "Treat hard cases well. Severity and specialty prestige both multiply what a good outcome is worth, so one oncology case moves it more than twenty skin checks.",
    destination: "caseload",
  },
  patients: {
    id: "patients",
    icon: "patient",
    effect:
      "Sets the ceiling on how far your panel can grow in a market. Trust falls with the share of arrivals you refer away, not the raw number, so growing while under-resourced costs you here.",
    route:
      "Turn fewer people away. Capacity, an open department, or a machine — whichever the caseload screen says stopped the most patients.",
    destination: "caseload",
  },
  loyalty: {
    id: "loyalty",
    icon: "team",
    effect:
      "Feeds workplace culture, which multiplies everything your staff get through between ×0.86 and ×1.14 — and below 25 it is what makes people resign.",
    route:
      "Close the pay gap and stop overworking the rota. Both are on the team screen, with the figure that is currently wrong.",
    destination: "team",
  },
  influence: {
    id: "influence",
    icon: "globe",
    effect:
      "Gates what gets offered to you: the larger contracts, investor interest, and the academic appointments. A quiet career with good numbers still gets passed over.",
    route:
      "Spend a block on the profession. It is deliberately slow — influence is what makes the back half of a run open up, so it cannot be bought quickly.",
    destination: "overview",
  },
  popularity: {
    id: "popularity",
    icon: "clipboard",
    effect:
      "Multiplies what campaigns return and how fast a new market takes you seriously. It also decides how loudly a bad week is reported.",
    route:
      "Be visible without a crisis forcing it — a content block, or a post from the phone. One post a week, and the rest is the unglamorous half.",
    destination: "growth",
  },
  ethics: {
    id: "ethics",
    icon: "shield",
    effect:
      "Multiplies every other category rather than standing beside them. Being believed dishonest devalues credibility, popularity and influence at once.",
    route:
      "Take the answer that costs you something when an event offers an easy one. Nothing else moves it, and nothing else protects the rest of this list.",
    destination: "timeline",
  },
};

export interface StandingRow {
  id: RepId;
  label: string;
  value: number;
  hint: string;
  driver: string;
  guide: StandingGuide;
  /** Net movement over the window, and the reason for the largest part of it. */
  delta: number;
  why: string | null;
  /** Values oldest-first, for a sparkline. Always ends at the current value. */
  trend: number[];
}

/**
 * The six categories with their recent history reconstructed.
 *
 * The log records deltas, so the series is built by walking *backwards* from
 * the current value and subtracting — which is exact, not an approximation,
 * because every movement in the game goes through `applyRep` and is logged.
 */
export function standingRows(state: RunState, weeks = 12): StandingRow[] {
  const changes = recentRepChanges(state, weeks);

  return REPUTATIONS.map((def) => {
    const mine = changes.filter((c) => c.id === def.id);
    const value = readRep(state, def.id);

    /* Newest first in the log. Walk back to the start of the window, then
       reverse so the series reads left to right. */
    const back: number[] = [value];
    let running = value;
    for (const c of mine) {
      running -= c.delta;
      back.push(running);
    }
    const trend = back.reverse();

    const delta = mine.reduce((n, c) => n + c.delta, 0);
    const biggest = [...mine].sort(
      (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
    )[0];

    return {
      id: def.id,
      label: def.label,
      value,
      hint: def.hint,
      driver: def.driver,
      guide: STANDING_GUIDE[def.id],
      delta,
      why: biggest?.why ?? null,
      trend,
    };
  });
}
