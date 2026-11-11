"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { kitchen } from "@/lib/game/careers/chef";
import {
  KITCHEN_ROLES,
  ROLE_BY_ID,
  SERVICE_BY_ID,
  SHORTLIST_WEEKS,
  agencyFees,
  brigadeMorale,
  rolePay,
  shortlistLive,
  wages,
} from "@/lib/game/careers/kitchen";
import { TRAIT_BY_ID } from "@/lib/game/careers/brigade";
import { AppHeader } from "./AppHeader";

/**
 * THE STAFFING AGENCY, ON THE PHONE
 *
 * Hiring used to be a shelf: you paid, and a person you had never seen
 * appeared on the payroll with whatever skill the run had decided for them.
 * That is not how anybody staffs a kitchen, and it made the most expensive
 * recurring decision in the game the one you knew least about.
 *
 * So it works the way it works in the trade. You brief an agency and pay them
 * to go and look. They come back with three people, and you can read all of
 * them — name, skill, wage, temperament — before committing to anybody. The
 * search fee is spent whether or not you take one, which is what stops the
 * shortlist being a free reroll and makes "brief again" a real decision.
 *
 * Briefing and placing together cost exactly what a hire cost before, so the
 * economy is untouched; what changed is how much you know when you spend it.
 */
export function AgencyApp({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const live = shortlistLive(k, state.week);
  const morale = brigadeMorale(k);
  /* The draft rolls skill around this centre — see `draftCandidate` in
     chef.ts. Said out loud so "better kitchens get better people" is
     information rather than something you infer from three bad hires. */
  const expect = Math.round(
    Math.max(20, Math.min(95, 32 + state.r.reputation * 0.35)),
  );

  const header = (
    <AppHeader
      app="agency"
      title="Brigade staffing"
      blurb={
        live.length > 0
          ? "The agency came back with these three. Read them, then decide — they are only free for so long."
          : `Pay the agency to go looking and you get to see who they find. At your standing they turn up cooks around skill ${expect}.`
      }
      stats={[
        {
          label: "On the payroll",
          value:
            k.staff.length === 0
              ? "Only you"
              : `${k.staff.length} cook${k.staff.length === 1 ? "" : "s"}`,
        },
        { label: "Wages", value: `${money(wages(k))}/wk` },
        ...(morale !== null
          ? [
              {
                label: "Morale",
                value: String(Math.round(morale)),
                tone:
                  morale < 35
                    ? ("bad" as const)
                    : morale > 65
                      ? ("good" as const)
                      : undefined,
              },
            ]
          : []),
      ]}
    />
  );

  /* ------------------------------------------------- who they came back with */
  if (live.length > 0) {
    const until = (k.shortlistWeek ?? state.week) + SHORTLIST_WEEKS - 1;
    return (
      <div>
        {header}

        <p className="border-b border-rule/60 px-4 py-2 text-[12px] text-ink-faint">
          Available until week {until}. After that they take other work.
        </p>

        <ul className="divide-y divide-rule/40">
          {live.map((c) => {
            const role = ROLE_BY_ID.get(c.role);
            const { placement } = role
              ? agencyFees(k, role)
              : { placement: 0 };
            const tooDear = state.r.cash < placement;
            const speciality = c.speciality
              ? SERVICE_BY_ID.get(c.speciality)
              : undefined;
            return (
              <li key={c.id} className="px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14.5px] font-semibold text-ink">
                    {c.name}
                  </span>
                  <span className="num shrink-0 text-[11.5px] text-ink-faint">
                    {money(c.salary)}/wk
                  </span>
                </div>
                <p className="text-[12.5px] text-ink-faint">{role?.label}</p>

                {/* Skill, as a thing you can compare across three people at a
                    glance — which is the entire reason the shortlist exists. */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="sign shrink-0 text-[10.5px] text-ink-faint">
                    Skill
                  </span>
                  <span
                    role="meter"
                    aria-valuenow={c.skill}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${c.name}'s skill`}
                    className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-rule-soft"
                  >
                    <span
                      className="block h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.max(4, Math.min(100, c.skill))}%`,
                        background:
                          c.skill >= 65
                            ? "#43C78B"
                            : c.skill >= 45
                              ? "#F4B860"
                              : "#EF6461",
                      }}
                    />
                  </span>
                  <span className="num shrink-0 text-[11.5px] text-ink-soft">
                    {c.skill}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {speciality && (
                    <span className="rounded-full bg-chef-tint px-2 py-0.5 text-[11.5px] text-chef">
                      Best on {speciality.label.toLowerCase()}
                    </span>
                  )}
                  {c.traits.map((id) => {
                    const t = TRAIT_BY_ID.get(id);
                    if (!t) return null;
                    return (
                      <span
                        key={id}
                        title={t.effect}
                        className={`rounded-full px-2 py-0.5 text-[11.5px] ${
                          t.good
                            ? "bg-good-tint text-good"
                            : "bg-caution-tint text-caution"
                        }`}
                      >
                        {t.label}
                      </span>
                    );
                  })}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <button
                    type="button"
                    disabled={tooDear}
                    onClick={() => dispatch("hireCandidate", c.id)}
                    className="rounded-form border border-rule bg-card/60 px-3.5 py-2 text-[13px] font-medium text-ink transition enabled:hover:border-clinical enabled:hover:bg-card-high enabled:hover:text-clinical disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Take them on · {money(placement)}
                  </button>
                  {tooDear && (
                    <span className="text-[12px] text-ink-faint">
                      You have {money(state.r.cash)}.
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="px-4 py-4 text-center text-[12.5px] leading-relaxed text-ink-faint">
          None of them right? Brief the agency again below — it costs the fee
          again, and you will see three different people.
        </p>

        <BriefList state={state} dispatch={dispatch} again />
      </div>
    );
  }

  /* ----------------------------------------------------- nobody found yet */
  return (
    <div>
      {header}
      <BriefList state={state} dispatch={dispatch} />
      <p className="px-4 py-4 text-center text-[12.5px] leading-relaxed text-ink-faint">
        The fee pays for the search, not the person. Taking one of them on
        costs the placement fee on top — together, exactly what a hire has
        always cost.
      </p>
    </div>
  );
}

/** The roles you can send the agency after, with what looking costs. */
function BriefList({
  state,
  dispatch,
  again = false,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
  again?: boolean;
}) {
  const k = kitchen(state);
  return (
    <ul className="divide-y divide-rule/40 border-t border-rule/60">
      {KITCHEN_ROLES.map((r) => {
        const { search, placement } = agencyFees(k, r);
        const { salary } = rolePay(k, r);
        const tooDear = state.r.cash < search;
        return (
          <li key={r.id} className="px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14.5px] font-semibold text-ink">
                {r.label}
              </span>
              <span className="num shrink-0 text-[11.5px] text-ink-faint">
                {money(salary)}/wk
              </span>
            </div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink-faint">
              {r.blurb}
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-good-tint px-2 py-0.5 text-[11.5px] text-good">
              <span className="num">+{r.covers}</span> covers a week
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <button
                type="button"
                disabled={tooDear}
                onClick={() => dispatch("briefAgency", r.id)}
                className="rounded-form border border-rule bg-card/60 px-3.5 py-2 text-[13px] font-medium text-ink transition enabled:hover:border-clinical enabled:hover:bg-card-high enabled:hover:text-clinical disabled:cursor-not-allowed disabled:opacity-45"
              >
                {again ? "Brief again" : "Find me one"} · {money(search)}
              </button>
              <span className="text-[12px] text-ink-faint">
                {tooDear
                  ? `You have ${money(state.r.cash)}.`
                  : `then ${money(placement)} to take one on`}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
