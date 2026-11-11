import type { LedgerLine, RunState } from "../game/types";
import { med } from "../game/careers/doctor";
import { REP_BY_ID, recentRepChanges } from "../game/reputation";
import { cultureScore } from "../game/medical/culture";
import { SETBACK_LABEL } from "../game/setbacks";
import { CRISIS_LABEL } from "../game/crisis";
import { unreadTotal } from "../game/medical/phone";
import { money } from "../game/format";
import type { ScreenId } from "./navigation";

/**
 * WHAT CHANGED, AND WHY
 *
 * The weekly review showed a ledger: correct, complete, and silent about
 * cause. "Patient trust −4" is a fact the player can do nothing with.
 *
 * Every line here carries its reason, taken from the thing that actually
 * produced it — the reputation log records why each category moved, the case
 * report records how many were referred and what blocked them, and the ledger
 * records the money. Nothing is inferred and nothing is invented; a change
 * with no recorded cause is not shown at all, which is better than guessing.
 *
 * ------------------------------------------------------------- what is left out
 *
 * Unchanged statistics. A summary that lists everything is a second copy of
 * the dashboard, and the whole point is to tell the player which four or five
 * things are different this week.
 */

export type ChangeTone = "good" | "bad" | "neutral";

export interface Change {
  /** "Patient trust" */
  label: string;
  /** "−4" — already formatted, sign included. */
  value: string;
  /** "31% of arriving patients were referred elsewhere." Never empty. */
  because: string;
  tone: ChangeTone;
  /** Where to go about it, when there is somewhere useful. */
  go?: { label: string; destination: ScreenId };
}

export interface WeekChanges {
  money: Change[];
  work: Change[];
  people: Change[];
  risks: Change[];
  /** Things newly available rather than newly wrong. */
  opportunities: Change[];
}

const signed = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(Math.round(n))}`;

/**
 * Build the summary for the week that just resolved.
 *
 * `before` is the state as it was when the player pressed commit; `after` is
 * what came back. Comparing the two is what lets this report movement rather
 * than levels — and the reasons come from the run's own records, not from the
 * difference.
 */
export function whatChanged(
  before: RunState,
  after: RunState,
  ledger: LedgerLine[],
): WeekChanges {
  const out: WeekChanges = {
    money: [],
    work: [],
    people: [],
    risks: [],
    opportunities: [],
  };
  if (after.careerId !== "doctor") return out;
  const m = med(after);

  /* ------------------------------------------------------------- money */
  const net = ledger.reduce((n, l) => n + (l.amount ?? 0), 0);
  if (Math.abs(net) >= 1) {
    /* Name the largest line on each side rather than repeating the ledger —
       the ledger is directly below and does not need summarising. */
    const income = ledger
      .filter((l) => (l.amount ?? 0) > 0)
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0];
    const cost = ledger
      .filter((l) => (l.amount ?? 0) < 0)
      .sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0))[0];
    out.money.push({
      label: net >= 0 ? "You made money" : "You lost money",
      value: money(net),
      because:
        income && cost
          ? `${income.label} brought in ${money(income.amount ?? 0)}; ${cost.label.toLowerCase()} took ${money(-(cost.amount ?? 0))}.`
          : income
            ? `${income.label} brought in ${money(income.amount ?? 0)}.`
            : cost
              ? `${cost.label} took ${money(-(cost.amount ?? 0))}.`
              : "Ordinary running costs.",
      tone: net >= 0 ? "good" : "bad",
      go: { label: "See the money", destination: "money" },
    });
  }

  /* -------------------------------------------------------------- work */
  const arrived = m.lastCases.reduce((n, c) => n + c.arrived, 0);
  const treated = m.lastCases.reduce((n, c) => n + c.treated, 0);
  const away = arrived - treated;
  if (arrived > 0) {
    out.work.push({
      label: "Patients treated",
      value: `${treated} of ${arrived}`,
      because:
        away === 0
          ? "Everyone who arrived was seen."
          : `${away} referred elsewhere — ${Math.round((away / arrived) * 100)}% of arrivals.`,
      tone: away === 0 ? "good" : away / arrived > 0.35 ? "bad" : "neutral",
      go: away > 0 ? { label: "See why", destination: "caseload" } : undefined,
    });
  }

  /* ------------------------------------------------------------ people */
  const burnDelta = after.r.burnout - before.r.burnout;
  if (Math.abs(burnDelta) >= 2) {
    out.people.push({
      label: "Burnout",
      value: signed(burnDelta),
      because:
        burnDelta > 0
          ? "The blocks you spent this week cost more than the week gave back."
          : "Rest, fitness and whatever relief your life is buying you.",
      tone: burnDelta > 0 ? "bad" : "good",
      go:
        after.r.burnout >= 70
          ? { label: "Look at your life", destination: "life" }
          : undefined,
    });
  }

  /*
   * Reputation, with the reason the simulation recorded at the time.
   *
   * Only movements from THIS week, and only ones large enough to matter —
   * every category drifts a little every week and reporting all of it would
   * bury the one that moved for a reason.
   */
  const byCategory = new Map<string, { delta: number; why: string }>();
  for (const c of recentRepChanges(after, 1)) {
    const prev = byCategory.get(c.id);
    byCategory.set(c.id, {
      delta: (prev?.delta ?? 0) + c.delta,
      /* Keep the reason attached to the largest single movement, which is
         the one the player will recognise. */
      why:
        prev && Math.abs(prev.delta) >= Math.abs(c.delta) ? prev.why : c.why,
    });
  }
  for (const [id, { delta, why }] of byCategory) {
    if (Math.abs(delta) < 1.5) continue;
    const def = REP_BY_ID.get(id as never);
    out.people.push({
      label: def?.label ?? id,
      value: signed(delta),
      because: `${why.charAt(0).toUpperCase()}${why.slice(1)}.`,
      tone: delta > 0 ? "good" : "bad",
      go: { label: "See your standing", destination: "standing" },
    });
  }

  const cultureBefore = cultureScore(med(before), before.week).score;
  const cultureAfter = cultureScore(m, after.week).score;
  if (Math.abs(cultureAfter - cultureBefore) >= 2) {
    const driver = cultureScore(m, after.week).drivers[0];
    out.people.push({
      label: "Workplace culture",
      value: signed(cultureAfter - cultureBefore),
      because: driver
        ? `${driver.label} — ${driver.detail}`
        : "Pay, workload and morale together.",
      tone: cultureAfter >= cultureBefore ? "good" : "bad",
      go: { label: "Look at the team", destination: "team" },
    });
  }

  const staffBefore = med(before).staff.length;
  if (m.staff.length < staffBefore) {
    out.people.push({
      label: "People left",
      value: signed(m.staff.length - staffBefore),
      because:
        "Loyalty fell far enough that staying stopped being worth it to them.",
      tone: "bad",
      go: { label: "Look at the team", destination: "team" },
    });
  }

  /* ------------------------------------------------------------- risks */
  const newSetbacks = (after.setbacks ?? []).filter(
    (a) => !(before.setbacks ?? []).some((b) => b.kind === a.kind),
  );
  for (const sb of newSetbacks) {
    out.risks.push({
      label: SETBACK_LABEL[sb.kind],
      value: "new",
      because:
        "Serious, and recoverable. The routes back are listed at the top of every screen.",
      tone: "bad",
    });
  }
  const clearedSetbacks = (before.setbacks ?? []).filter(
    (b) => !(after.setbacks ?? []).some((a) => a.kind === b.kind),
  );
  for (const sb of clearedSetbacks) {
    out.risks.push({
      label: `Through the ${SETBACK_LABEL[sb.kind].toLowerCase()}`,
      value: "cleared",
      because: `${sb.weeks} weeks of it, and you are still here.`,
      tone: "good",
    });
  }

  const newCrises = (after.crises ?? []).filter(
    (a) => !(before.crises ?? []).some((b) => b.id === a.id),
  );
  for (const c of newCrises) {
    out.risks.push({
      label: CRISIS_LABEL[c.kind],
      value: "new",
      because: "This will get worse on its own if you leave it.",
      tone: "bad",
    });
  }

  const newOutbreaks = m.outbreaks.filter(
    (a) => a.startedWeek === before.week,
  );
  for (let i = 0; i < newOutbreaks.length; i++) {
    out.risks.push({
      label: "Outbreak began",
      value: "new",
      because:
        "Affected specialties surge whether or not you are equipped for them.",
      tone: "bad",
      go: { label: "Respond", destination: "outbreaks" },
    });
  }

  /* ----------------------------------------------------- opportunities */
  const newOffers = (after.offers ?? []).filter(
    (a) => !(before.offers ?? []).some((b) => b.defId === a.defId),
  );
  if (newOffers.length > 0) {
    out.opportunities.push({
      label: "New work on offer",
      value: `${newOffers.length}`,
      because: "Offered because of what you have built. Offers lapse.",
      tone: "good",
      go: { label: "See the offers", destination: "contracts" },
    });
  }

  const unread = unreadTotal(m);
  if (unread > 0) {
    out.opportunities.push({
      label: "Unread messages",
      value: `${unread}`,
      because: "Someone is waiting on an answer from you.",
      tone: "neutral",
    });
  }

  const newMilestones = (after.timeline ?? []).filter(
    (t) => t.week >= before.week,
  );
  for (const t of newMilestones) {
    out.opportunities.push({
      label: t.title,
      value: "milestone",
      because: t.detail,
      tone: "good",
      go: { label: "See the timeline", destination: "timeline" },
    });
  }

  return out;
}

/** True when there is nothing worth showing — a genuinely quiet week. */
export const isQuiet = (c: WeekChanges): boolean =>
  c.money.length === 0 &&
  c.work.length === 0 &&
  c.people.length === 0 &&
  c.risks.length === 0 &&
  c.opportunities.length === 0;

/** Ordered for display: what is wrong, then what happened, then what is new. */
export const changeGroups = (
  c: WeekChanges,
): { title: string; items: Change[] }[] =>
  [
    { title: "Needs attention", items: c.risks },
    { title: "The week", items: [...c.money, ...c.work] },
    { title: "You and your team", items: c.people },
    { title: "New", items: c.opportunities },
  ].filter((g) => g.items.length > 0);
