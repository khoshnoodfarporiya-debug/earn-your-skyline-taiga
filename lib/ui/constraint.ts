import type { RunState } from "../game/types";
import { weeklyCosts } from "../game/careers/doctor";
import { kitchen, weeklyOutgoings } from "../game/careers/chef";
import { practice } from "../game/careers/lawyer";
import { chambersRent, legalWages } from "../game/careers/casework";

/**
 * THE BINDING CONSTRAINT, IN ONE NUMBER (Phase 4).
 *
 * Every career has a figure that decides whether next week is survivable,
 * and before this file each surface computed its own or showed nobody's:
 * the status strip could only state the Physician's weekly costs, so a Chef
 * read "no fixed costs" over a rent bill that falls due whether or not they
 * open, and a Solicitor read nothing at all.
 *
 * `weeklyBurnFor` answers "what leaves the account every week whatever you
 * do", from each career's own model — the same sums their ledgers charge,
 * looked up rather than re-derived, so a rule change in the model reaches
 * every readout at once.
 *
 * The four newest careers return null on purpose: their binding constraint
 * is not a weekly bill (runway is priced in weeks, the count in points, the
 * fee in stages, the certifier in faults), and each states it on a strip of
 * its own inside its screens. Null means "this career says it differently",
 * never "this career is free to run".
 */
export function weeklyBurnFor(state: RunState): number | null {
  switch (state.careerId) {
    case "doctor":
      return weeklyCosts(state);
    case "chef":
      return weeklyOutgoings(kitchen(state));
    case "lawyer": {
      const p = practice(state);
      return chambersRent(p) + legalWages(p);
    }
    default:
      return null;
  }
}

/**
 * How the cash figure should read against that burn: alarm when overdrawn,
 * caution inside two weeks of cover. The same thresholds the status strip
 * has always used for the Physician, now one rule for everybody.
 */
export function cashTone(
  state: RunState,
): "alarm" | "caution" | "plain" {
  if (state.r.cash < 0) return "alarm";
  const burn = weeklyBurnFor(state);
  if (burn !== null && burn > 0 && state.r.cash < burn * 2) return "caution";
  return "plain";
}
