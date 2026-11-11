import type { DemandDriver, KitchenState } from "./kitchen";
import { cityOf } from "./kitchen";
import { dinerMix, seasonOf, type SegmentShare } from "./diners";
import { competitorPressure } from "./competitors";
import { interestOf } from "./buzz";

/**
 * THE SCENE
 *
 * One function, so that every part of the game that asks "how busy will next
 * week be" gets the same answer from the same three inputs: who is in this
 * city, what the other restaurants are taking off you, and what you have said
 * on the phone.
 *
 * It lives in its own file because `diners.ts` and `competitors.ts` each need
 * the other's ideas and neither can import the other without a cycle. This is
 * the layer above both, and the only one that knows they are related.
 *
 * ------------------------------------------------------------- the contract
 *
 * `forecastFor` takes this as an *optional* argument. A caller that does not
 * pass one gets the arithmetic this career has always had, which is what
 * keeps every existing test and the balance harness meaningful. The three
 * places that decide or display a real week all pass it, and they all call
 * this — so the forecast on screen and the week that resolves can never be
 * looking at different numbers.
 */

export interface Scene {
  /** Who is in the room, most numerous first. */
  mix: SegmentShare[];
  /** Multiplier on how many people want a table. */
  demand: number;
  /** Multiplier on what they spend per head. */
  spend: number;
  /** How patient tonight's room is, against the service's own patience. */
  patience: number;
  /** What to say about it, for the forecast panel. */
  drivers: DemandDriver[];
}

export function sceneFor(
  k: KitchenState,
  reputation: number,
  week: number,
  service?: string,
): Scene {
  const pressure = competitorPressure(k, reputation);
  const room = dinerMix(k, reputation, week, service, pressure);
  const mix = room.shares;
  const interest = interestOf(k);
  const demand = room.demand * interest;

  const drivers: DemandDriver[] = [];
  const season = seasonOf(week);
  const top = mix[0];

  if (top && top.share > 0.2) {
    drivers.push({
      label: top.segment.label,
      effect: top.appeal >= 58 ? "up" : top.appeal <= 40 ? "down" : "flat",
      note:
        top.appeal >= 58
          ? `${Math.round(top.share * 100)}% of the room, and this restaurant is built for them.`
          : top.appeal <= 40
            ? `${Math.round(top.share * 100)}% of the room, and they are not getting what they came for.`
            : `${Math.round(top.share * 100)}% of the room.`,
    });
  }

  const taken = Object.values(pressure).reduce((a, b) => a + b, 0);
  if (taken > 0.15) {
    const worst = Object.entries(pressure).sort((a, b) => b[1] - a[1])[0];
    const seg = mix.find((x) => x.segment.id === worst[0]);
    drivers.push({
      label: "The other kitchens",
      effect: "down",
      note: seg
        ? `${seg.segment.label} are being taken off you — about ${Math.round(worst[1] * 100)}% of them are eating somewhere else.`
        : "The city's other restaurants are taking covers off you.",
    });
  }

  if (interest > 1.02) {
    drivers.push({
      label: "What you posted",
      effect: "up",
      note: `People are coming because of something you said — ${Math.round((interest - 1) * 100)}% more of them. It fades.`,
    });
  }

  drivers.push({
    label: season.label,
    effect:
      season.id === "summer" || season.id === "autumn"
        ? "up"
        : season.id === "winter"
          ? "flat"
          : "up",
    note: season.note,
  });

  if (cityOf(k).shelfLife !== 0) {
    drivers.push({
      label: `${cityOf(k).name} produce`,
      effect: cityOf(k).shelfLife > 0 ? "up" : "down",
      note:
        cityOf(k).shelfLife > 0
          ? "Everything keeps a week longer here, which is worth money every single week."
          : "Everything dies a week sooner here. Order small and often or pay for it.",
    });
  }

  return { mix, demand, spend: room.spend, patience: room.patience, drivers };
}
