"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { screenOf, type ScreenId } from "@/lib/ui/navigation";
import { Shelf, Stat } from "./Shelf";
import {
  BOOKING_POLICIES,
  KITCHEN_KIT,
  KIT_BY_ID,
  PREMISES,
  PRODUCE_BY_ID,
  SERVICES,
  SERVICE_BY_ID,
  brigadeCovers,
  brigadeMorale,
  cityOf,
  kitPrice,
  capitalIndex,
  extraShelfLife,
  forecastFor,
  freshnessOf,
  kitUpkeep,
  kitValue,
  larderCovers,
  larderValue,
  loyaltyOf,
  moraleOf,
  policyOf,
  premisesOf,
  ingredientState,
  pantryOf,
  pantryValue,
  premisesPrice,
  rent,
  spendPerHead,
  serviceBlocker,
  wages,
} from "@/lib/game/careers/kitchen";
import {
  kitchen,
  kitchenWorth,
  loanInterest,
  loanPayment,
  weeklyOutgoings,
} from "@/lib/game/careers/chef";
import {
  BRIGADE_ART,
  SUPPLIER_ART,
  larderArt,
  premisesArt,
  serviceArt,
} from "@/lib/ui/chefArt";
import { sceneFor } from "@/lib/game/careers/scene";
import { ChefScene, ChefThumb } from "./ChefScene";
import { MenuScreen } from "./MenuScreen";
import { PantryPanel } from "./PantryPanel";
import { ServiceDashboard } from "./ServiceDashboard";
import { BrigadePanel } from "./BrigadePanel";
import { ReputationScreen } from "./ReputationScreen";
import { SceneScreen } from "./SceneScreen";
import { CraftScreen } from "./CraftScreen";
import { BeyondScreen } from "./BeyondScreen";
import { CellarPanel } from "./CellarPanel";

/**
 * THE CHEF'S SCREENS
 *
 * One restaurant, five questions, one screen each — see `CHEF_SECTIONS` in
 * `lib/ui/navigation.ts` for why the destination was split and why it is still
 * a single entry in the nav bar.
 *
 * Nothing here decides anything. Every number is read from the kitchen model
 * or from a pure function in `kitchen.ts`, and every control dispatches a
 * command the engine already had.
 */
export function ChefScreens({
  screen,
  state,
  onCommand,
  onCall,
}: {
  screen: ScreenId;
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
  /** Open the phone on an app — how a screen rings a supplier or the agency. */
  onCall: (app: "market" | "agency") => void;
}) {
  if (state.careerId !== "chef") return null;

  const body =
    screen === "kitchen" ? (
      <RoomScreen state={state} onCommand={onCommand} />
    ) : screen === "larder" ? (
      <LarderScreen state={state} onCall={onCall} onCommand={onCommand} />
    ) : screen === "menu" ? (
      <MenuScreen state={state} onCommand={onCommand} />
    ) : screen === "pass" ? (
      <PassScreen state={state} onCommand={onCommand} />
    ) : screen === "brigade" ? (
      <BrigadeScreen state={state} onCall={onCall} onCommand={onCommand} />
    ) : screen === "books" ? (
      <MoneyScreen state={state} onCommand={onCommand} />
    ) : screen === "reviews" ? (
      <ReputationScreen state={state} onCommand={onCommand} />
    ) : screen === "scene" ? (
      <SceneScreen state={state} />
    ) : screen === "craft" ? (
      <CraftScreen state={state} onCommand={onCommand} />
    ) : screen === "beyond" ? (
      <BeyondScreen state={state} onCommand={onCommand} />
    ) : null;

  if (!body) return null;

  const def = screenOf(screen);
  return (
    <div className="space-y-6">
      {/* The Physician's ScreenHeader reads medical state, so the Chef states
          where it is itself rather than borrowing a component that would be
          null for it. */}
      <div>
        <h1 className="display text-[19px] leading-tight text-ink">{def.label}</h1>
        <p className="mt-0.5 text-xs text-ink-faint">{def.purpose}</p>
      </div>
      {body}
    </div>
  );
}

/* ------------------------------------------------------------- the room */

function RoomScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const room = premisesOf(k);
  const city = cityOf(k);
  const installed = (k.equipment ?? [])
    .map((id) => KIT_BY_ID.get(id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <div className="space-y-6">
      {/*
       * The room you are actually in, photographed.
       *
       * `premisesArt` is keyed by the premises id, so this cannot show a
       * flagship dining room to a player standing at a market stall — the
       * picture is read from the same field the rent is.
       */}
      <ChefScene
        art={premisesArt(k.premises)}
        kicker={city.name}
        title={`${room.label}, ${city.name}`}
        note={room.blurb}
        tone="live"
        /* The first image on the screen and above the fold on every width, so
           it is the one thing here that must not be lazy. */
        priority
      >
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat label="Seats a service" value={`${Math.round(room.capacity / 2)}`} />
          <Stat label="Room capacity" value={`${room.capacity} covers`} />
          <Stat label="Spend a head" value={money(spendPerHead(k))} />
          <Stat label="Rent" value={`${money(rent(k))}/wk`} />
        </dl>
        {/* What the city is doing to those figures, since the player chose it
            once at week one and will not otherwise be reminded. */}
        <p className="mt-3 border-t border-rule-soft pt-3 text-xs text-ink-faint">
          {city.name} — {city.blurb}
        </p>
      </ChefScene>

      <section
        aria-labelledby="kit-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="kit-h" className="text-sm font-semibold text-ink">
          What is installed
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          {installed.length === 0
            ? "Nothing but the room and what you carry in."
            : `${money(kitUpkeep(k))} a week in power and servicing, running whether you cook or not.${
                extraShelfLife(k) > 0
                  ? ` Everything in the larder keeps ${extraShelfLife(k)} week${extraShelfLife(k) === 1 ? "" : "s"} longer than it would bare.`
                  : ""
              }`}
        </p>
        {installed.length > 0 && (
          <ul className="mt-3 space-y-2">
            {installed.map((x) => (
              <li
                key={x.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 rounded border border-rule-soft px-3 py-2 text-xs"
              >
                <span className="font-medium text-ink">{x.label}</span>
                <span className="text-ink-faint">
                  {kitEffects(x).join(" · ") || "—"}
                </span>
                <span className="w-full text-ink-faint">
                  {money(Math.round(x.upkeep * capitalIndex(k)))}/wk upkeep
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Shelf
        title="Fit out the kitchen"
        note="Refrigeration is the only thing you can buy that changes how long food lasts."
        items={KITCHEN_KIT.filter((x) => !(k.equipment ?? []).includes(x.id)).map(
          (x) => {
            /* Bought, installed and run in this city's money — the same
               figures the command charges. */
            const price = kitPrice(k, x);
            const upkeep = Math.round(x.upkeep * capitalIndex(k));
            return {
              id: x.id,
              label: x.label,
              blurb: x.blurb,
              price,
              meta: [`${money(upkeep)}/wk`, ...kitEffects(x)].join(" · "),
              disabled: state.r.cash < price,
              why: `Costs ${money(price)} and you have ${money(state.r.cash)}.`,
            };
          },
        )}
        cmd="buyKit"
        onCommand={onCommand}
      />

      <Shelf
        title="Premises"
        note="A bigger room seats more and costs more every week, open or shut."
        items={PREMISES.filter((p) => p.id !== k.premises).map((p) => {
          /* Priced, rented and billed in this city's money, like the room you
             are standing in. */
          const price = premisesPrice(k, p);
          return {
            id: p.id,
            label: p.label,
            blurb: p.blurb,
            price,
            meta: `${money(Math.round(p.rent * city.rent))}/wk rent · ${p.capacity} covers · ${money(p.spend * city.spend)} a head`,
            disabled: state.r.cash < price,
            why: `Costs ${money(price)} and you have ${money(state.r.cash)}.`,
            art: premisesArt(p.id),
          };
        })}
        cmd="takePremises"
        onCommand={onCommand}
      />
    </div>
  );
}

/** What a piece of kit does, in the player's words. */
function kitEffects(x: (typeof KITCHEN_KIT)[number]): string[] {
  return [
    x.shelfLife > 0
      ? `+${x.shelfLife} week${x.shelfLife === 1 ? "" : "s"} of shelf life`
      : null,
    x.wasteSaved > 0 ? `${Math.round(x.wasteSaved * 100)}% less waste` : null,
    x.covers > 0 ? `+${x.covers} covers` : null,
    x.craft > 0 ? `+${x.craft} on the plate` : null,
    x.spend > 1 ? `+${Math.round((x.spend - 1) * 100)}% a head` : null,
  ].filter((s): s is string => s !== null);
}

/* --------------------------------------------------------------- larder */

function LarderScreen({
  state,
  onCall,
  onCommand,
}: {
  state: RunState;
  onCall: (app: "market" | "agency") => void;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const room = premisesOf(k);
  const covers = larderCovers(k);
  const extra = extraShelfLife(k);
  /*
   * Which larder the run has this week, and how much of it is about to be
   * money in a bin. Both come from the lots themselves — the picture and the
   * sentence under it are the same arithmetic, so they cannot disagree.
   */
  const pantry = pantryOf(k);
  const pantryAtRisk = pantry.some((lot) => {
    const st = ingredientState(lot, state.week, k);
    return st === "expiring" || st === "spoiled";
  });
  const scene = larderArt(
    k,
    state.week,
    extra,
    (id) => PRODUCE_BY_ID.get(id)?.shelfLife ?? null,
    { stocked: pantry.length > 0, atRisk: pantryAtRisk },
  );
  const doomed = k.larder.reduce((n, lot) => {
    const p = PRODUCE_BY_ID.get(lot.produce);
    if (!p) return n;
    const left =
      Math.max(1, (lot.life ?? p.shelfLife) + extra) - (state.week - lot.boughtWeek);
    return left <= 1 ? n + lot.left : n;
  }, 0);

  return (
    <div className="space-y-6">
      {/* The larder is the career. It leads with what is about to be thrown
          away rather than with what is in stock. */}
      {scene && (
        <ChefScene
          art={scene.art}
          kicker={scene.state === "expiring" ? "Going over" : "In good order"}
          title={
            scene.state === "expiring"
              ? `${doomed} covers to use this week`
              : `${covers} covers, all with time on them`
          }
          note={
            scene.state === "expiring"
              ? "Cook it, sell it cheap, or pay for it twice — once in the bin and again in the reviews."
              : "Nothing is close to its life. This is when to open the busiest service you can staff."
          }
          tone={scene.state === "expiring" ? "warning" : "quiet"}
          priority
        >
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <Stat label="Covers in stock" value={`${covers}`} />
            <Stat
              label="Dies this week"
              value={doomed > 0 ? `${doomed} covers` : "None"}
              tone={doomed > 0 ? "bad" : "good"}
            />
            <Stat
              label="Room seats"
              value={`${Math.round(room.capacity / 2)} a service`}
            />
          </dl>
        </ChefScene>
      )}

      <section
        aria-labelledby="larder-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="larder-h" className="text-sm font-semibold text-ink">
          The larder
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Served oldest first. Anything past its life is written off — you paid
          for it and nobody ate it.
        </p>

        {k.larder.length === 0 ? (
          <p className="mt-3 rounded border border-dashed border-rule px-3 py-4 text-center text-xs text-ink-faint">
            Empty. You cannot open a service without food.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {[...k.larder]
              .sort((a, b) => a.boughtWeek - b.boughtWeek)
              .map((lot) => {
                const p = PRODUCE_BY_ID.get(lot.produce);
                const extra = extraShelfLife(k);
                const fresh = freshnessOf(lot, state.week, extra);
                const life = p
                  ? p.shelfLife + extra - (state.week - lot.boughtWeek)
                  : 0;
                return (
                  <li
                    key={lot.id}
                    className="flex items-center justify-between gap-3 rounded border border-rule-soft px-3 py-2 text-xs"
                  >
                    <span className="text-ink">{p?.label ?? lot.produce}</span>
                    <span className="text-ink-faint">{lot.left} covers</span>
                    <span
                      className={
                        life <= 0
                          ? "font-semibold text-alarm"
                          : life === 1
                            ? "font-semibold text-caution"
                            : "text-ink-faint"
                      }
                    >
                      {life <= 0
                        ? "Goes in the bin"
                        : life === 1
                          ? "Last week"
                          : `${life} weeks left`}
                    </span>
                    <span className="w-24 shrink-0">
                      <span className="block h-1.5 rounded-full bg-rule">
                        <span
                          className="block h-1.5 rounded-full bg-clinical"
                          style={{ width: `${Math.round(fresh * 100)}%` }}
                        />
                      </span>
                      <span className="sr-only">
                        {Math.round(fresh * 100)}% fresh
                      </span>
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-faint">
          {covers} covers in stock · room seats {Math.round(room.capacity / 2)} a
          service
        </p>
      </section>

      {/* The named ingredients, which are what the menu is actually made
          of. The crates above are the staple underneath them. */}
      <PantryPanel state={state} onCommand={onCommand} />

      {/* And the one kind of stock that improves while it sits there, which
          is why it reads nothing like the two panels above it. */}
      <CellarPanel state={state} onCommand={onCommand} />

      {/*
       * Ordering happens on the phone now, where it always belonged in the
       * fiction — you ring the merchant, you do not order turbot from a
       * dashboard. This screen keeps the report: what you own, how fresh it
       * is, what dies next week. The card below is the doorway, stating the
       * two numbers a call is made against so the player never dials blind.
       */}
      <section
        aria-labelledby="order-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <div className="flex items-start gap-3">
          <ChefThumb art={SUPPLIER_ART} className="hidden w-28 shrink-0 sm:block" />
          <div className="min-w-0 flex-1">
            <h2 id="order-h" className="text-sm font-semibold text-ink">
              Order produce
            </h2>
            <p className="mt-1 text-xs text-ink-faint">
              Your suppliers are on the phone, under Market. Cheaper food
              arrives with less life in it; a warm account gets a better price
              and a van that turns up.
            </p>
            <p className="mt-2 text-xs text-ink">
              {covers} covers in stock
              {doomed > 0 ? ` · ${doomed} die next week` : ""} ·{" "}
              {money(state.r.cash)} in hand
            </p>
            <button
              type="button"
              onClick={() => onCall("market")}
              className="mt-3 rounded-form border border-rule px-3 py-1.5 text-xs text-ink transition hover:border-clinical hover:text-clinical"
            >
              Call your suppliers
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------- the pass */

function PassScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const last = k.lastService;

  /*
   * One block of each service, so the catalogue can be compared like for like.
   * The planner is still where blocks are assigned; this is what one of them
   * is worth before you spend it.
   */
  const cards = SERVICES.map((sv) => {
    /* The same scene the week will resolve against — who is in this city, what
       the rivals are taking, and what the phone has done. Computed here rather
       than assumed, because a forecast that omits it would be a promise the
       week does not keep. */
    const scene = sceneFor(k, state.r.reputation, state.week, sv.id);
    return {
      sv,
      why: serviceBlocker(sv, k, state.r.skill),
      fc: forecastFor(k, state.r.reputation, sv, 1, state.r.skill, {
        demand: scene.demand,
        drivers: scene.drivers,
      }),
    };
  });
  /* The drivers are the same set for any walk-in service, so they are stated
     once rather than repeated under each card. */
  const drivers = cards.find((c) => !c.sv.booked && !c.why)?.fc.drivers ?? [];

  /*
   * What the kitchen actually did last week, by covers served.
   *
   * The picture at the top of this screen is that service and no other: a week
   * spent on catering shows the van, a week of tasting menus shows the
   * tweezers. It is read from `lastService.lines`, which is the same record
   * the report below is printed from, so the image cannot claim a night the
   * ledger does not have.
   */
  const ranLine =
    last && last.lines.length > 0
      ? [...last.lines].sort((a, b) => b.served - a.served)[0]
      : null;
  const ran = ranLine ? SERVICE_BY_ID.get(ranLine.id) : null;

  return (
    <div className="space-y-6">
      {/*
       * The night itself, ticket by ticket.
       *
       * Above everything else on this screen because it is the answer to the
       * question a player opens the pass with: how did that go, and what held
       * it up. The booking policy and the catalogue are decisions that read
       * better after the report than before it.
       */}
      <ServiceDashboard state={state} onCommand={onCommand} />

      {/*
       * Last night's summary, if there was one. The dashboard above covers the
       * pipeline; this is the older per-service ledger view, kept because it
       * carries the forecast's own reckoning — reservations, no-shows and
       * walk-ins against what the book promised.
       */}
      {ran && ranLine && (
        <ChefScene
          art={serviceArt(ran.id)}
          kicker="Last service"
          title={`${ran.label} — ${ranLine.served} covers`}
          note={ranLine.binding}
          tone="live"
          priority
        >
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="Wanted a table" value={`${ranLine.wanted}`} />
            <Stat
              label="Turned away"
              value={`${ranLine.turnedAway}`}
              tone={ranLine.turnedAway > 0 ? "bad" : "good"}
            />
            <Stat label="Plate quality" value={`${Math.round(ranLine.quality)}`} />
            <Stat label="Takings" value={money(ranLine.revenue)} />
          </dl>
        </ChefScene>
      )}

      {/*
       * The book comes first because it decides the number everything else is
       * ordered against. How much of next week you can see is itself the
       * choice being made here.
       */}
      <section
        aria-labelledby="book-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="book-h" className="text-sm font-semibold text-ink">
          The book
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          How much of the room you sell before the night — and therefore how
          much of next week you can order for with confidence.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {BOOKING_POLICIES.map((pol) => {
            const active = policyOf(k).id === pol.id;
            return (
              <li key={pol.id}>
                <button
                  type="button"
                  onClick={() => onCommand("setPolicy", pol.id)}
                  aria-pressed={active}
                  className={`w-full rounded border p-3 text-left text-xs transition ${
                    active
                      ? "border-clinical bg-clinical-tint text-ink"
                      : "border-rule-soft text-ink-faint hover:border-clinical/70 hover:text-ink"
                  }`}
                >
                  <span className="block font-medium text-ink">{pol.label}</span>
                  <span className="mt-0.5 block">{pol.blurb}</span>
                  <span className="mt-1 block text-ink-faint">
                    {pol.book === 0
                      ? "No reservations"
                      : `Books ${Math.round(pol.book * 100)}% of the room`}
                    {pol.noShow > 0
                      ? ` · ${Math.round(pol.noShow * 100)}% no-shows`
                      : ""}
                    {pol.deposit > 0 ? ` · ${money(pol.deposit)} deposit` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="svc-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="svc-h" className="text-sm font-semibold text-ink">
          What you can serve
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          One block of each, as the kitchen stands today. Blocks themselves are
          assigned on the Overview.
        </p>
        <ul className="mt-3 space-y-2">
          {cards.map(({ sv, why, fc }) => (
            <li
              key={sv.id}
              className={`flex gap-3 rounded border px-3 py-2.5 text-xs ${
                why
                  ? "border-rule-soft opacity-70"
                  : ranLine?.id === sv.id
                    ? "border-chef/40"
                    : "border-rule-soft"
              }`}
            >
              {/* Card-scale, and beside the figures rather than above them:
                  five services have to stay comparable at a glance, and a
                  column of full-width photographs is a gallery. */}
              <ChefThumb
                art={serviceArt(sv.id)}
                state={why ? "blocked" : ranLine?.id === sv.id ? "current" : "available"}
                className="hidden w-24 shrink-0 sm:block"
              />
              <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium text-ink">{sv.label}</span>
                <span className="text-ink-faint">
                  {why
                    ? why
                    : sv.booked
                      ? `${fc.seats} covers agreed in advance`
                      : `${fc.low}–${fc.high} covers likely · ${fc.seats} seats`}
                </span>
              </div>
              <p className="mt-0.5 text-ink-faint">{sv.blurb}</p>
              {!why && (
                <p className="mt-1 text-ink-faint">
                  Limited by: <span className="text-ink">{fc.binding}</span>
                  {sv.reviewWeight === 0
                    ? " · nobody reviews it"
                    : sv.reviewWeight > 1.5
                      ? " · moves your reviews hard, both ways"
                      : ""}
                </p>
              )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {drivers.length > 0 && (
        <section
          aria-labelledby="drivers-h"
          className="rounded-lg border border-rule bg-card p-4"
        >
          <h2 id="drivers-h" className="text-sm font-semibold text-ink">
            What decides who comes
          </h2>
          <ul className="mt-3 space-y-2">
            {drivers.map((d) => (
              <li
                key={d.label}
                className="flex flex-wrap items-baseline justify-between gap-x-3 rounded border border-rule-soft px-3 py-2 text-xs"
              >
                <span className="font-medium text-ink">{d.label}</span>
                <span
                  className={
                    d.effect === "up"
                      ? "text-good"
                      : d.effect === "down"
                        ? "text-caution"
                        : "text-ink-faint"
                  }
                >
                  {d.effect === "up"
                    ? "Helping"
                    : d.effect === "down"
                      ? "Costing you covers"
                      : "Neutral"}
                </span>
                <span className="w-full text-ink-faint">{d.note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {last && (
        <section
          aria-labelledby="last-h"
          className="rounded-lg border border-rule bg-card p-4"
        >
          <h2 id="last-h" className="text-sm font-semibold text-ink">
            Last service
          </h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="Wanted a table" value={`${last.wanted}`} />
            <Stat label="Served" value={`${last.served}`} />
            <Stat
              label="Turned away"
              value={`${last.turnedAway}`}
              tone={last.turnedAway > 0 ? "bad" : "good"}
            />
            <Stat
              label="Wasted"
              value={last.waste > 0 ? `${last.waste} covers` : "None"}
              tone={last.waste > 0 ? "bad" : "good"}
            />
            <Stat label="Plate quality" value={`${Math.round(last.quality)}`} />
            <Stat
              label="Freshness"
              value={`${Math.round(last.freshness * 100)}%`}
              tone={last.freshness < 0.4 ? "bad" : "good"}
            />
            <Stat label="Takings" value={money(last.revenue)} />
            <Stat
              label="Thrown away"
              value={money(last.wasteCost)}
              tone={last.wasteCost > 0 ? "bad" : "good"}
            />
          </dl>

          {/* Per service, because the whole point of choosing between them is
              seeing which one actually paid. */}
          {last.lines.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-rule-soft pt-3 text-xs">
              {last.lines.map((line) => {
                const sv = SERVICE_BY_ID.get(line.id);
                return (
                  <li
                    key={line.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-3"
                  >
                    <span className="text-ink">
                      {sv?.label ?? line.id}
                      <span className="text-ink-faint"> ×{line.blocks}</span>
                    </span>
                    <span className="text-ink-faint">
                      {line.served}/{line.wanted} covers · quality{" "}
                      {Math.round(line.quality)}
                    </span>
                    <span className="text-ink">{money(line.revenue)}</span>
                    <span className="w-full text-ink-faint">
                      {line.reservations > 0
                        ? `${line.reservations} booked, ${line.noShows} did not come, ${line.walkIns} walked in`
                        : `${line.walkIns} walked in`}
                      {line.turnedAway > 0
                        ? ` · ${line.turnedAway} turned away`
                        : ""}
                      {line.foodCost > 0 ? ` · food ${money(line.foodCost)}` : ""}
                      {line.deposits > 0
                        ? ` · ${money(line.deposits)} in kept deposits`
                        : ""}
                    </span>
                    <span className="w-full text-ink-faint">
                      Limited by: <span className="text-ink">{line.binding}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- brigade */

function BrigadeScreen({
  state,
  onCall,
  onCommand,
}: {
  state: RunState;
  onCall: (app: "market" | "agency") => void;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const morale = brigadeMorale(k);
  /* The state the picture is allowed to claim: a brigade on the edge is a
     warning, a brigade that does not exist yet is neither. */
  const shaky = k.staff.some((x) => loyaltyOf(x) < 35 || moraleOf(x) < 30);

  return (
    <div className="space-y-6">
      {/*
       * The line-up before service — but only once there is a line-up. A
       * photograph of a brigade over a screen that says "nobody but you" is
       * the interface telling a lie the panel underneath then corrects.
       */}
      {k.staff.length > 0 && (
        <ChefScene
          art={BRIGADE_ART}
          kicker={shaky ? "Wearing thin" : "Before service"}
          title={`${k.staff.length} on the line${
            morale !== null ? `, morale ${Math.round(morale)}` : ""
          }`}
          note={
            shaky
              ? "Somebody here is close to handing their jacket back. A quiet week, or a raise, or they go."
              : "Skill is what they can do; morale decides how much of it turns up."
          }
          tone={shaky ? "warning" : "quiet"}
          priority
        >
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <Stat
              label="Covers a week"
              value={`${Math.round(brigadeCovers(k, state.r.skill))}`}
            />
            <Stat label="Wages" value={`${money(wages(k))}/wk`} />
            <Stat
              label="At risk"
              value={shaky ? "Somebody" : "Nobody"}
              tone={shaky ? "bad" : "good"}
            />
          </dl>
        </ChefScene>
      )}

      {/*
       * The sections, the people and the warnings.
       *
       * This replaced the flat roster that used to sit here: a brigade is not
       * a list of salaries, it is who is standing where, and the question the
       * screen has to answer is which station fails first. See
       * `BrigadePanel`.
       */}
      <BrigadePanel state={state} onCommand={onCommand} />


      {/*
       * Hiring happens on the phone, under Agency — taking somebody on is a
       * call you make, not a purchase you shelve. This screen keeps its real
       * job: the people already here, and how they are holding up.
       */}
      <section
        aria-labelledby="agency-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="agency-h" className="text-sm font-semibold text-ink">
          Take somebody on
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          The staffing agency is on the phone. Who they send depends on how
          well this kitchen is regarded — better-known rooms get better calls
          returned.
        </p>
        <button
          type="button"
          onClick={() => onCall("agency")}
          className="mt-3 rounded-form border border-rule px-3 py-1.5 text-xs text-ink transition hover:border-clinical hover:text-clinical"
        >
          Ring the agency
        </button>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- money */

function MoneyScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const room = premisesOf(k);
  const last = k.lastService;
  const pay = loanPayment(state);
  const interest = loanInterest(state.r.debt);

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="cash-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="cash-h" className="text-sm font-semibold text-ink">
          The week
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Takings clear the same night you serve. Everything below them arrives
          whether or not you unlock the door.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat
            label="Cash"
            value={money(state.r.cash)}
            tone={state.r.cash < 0 ? "bad" : "good"}
          />
          <Stat label="Last week's takings" value={money(state.r._lastRevenue ?? 0)} />
          <Stat label="Weekly outgoings" value={money(weeklyOutgoings(k))} tone="bad" />
          <Stat
            /* Both stores: crates written off and ingredients binned. The
               week records the total, so this reads it rather than adding
               two numbers up again. */
            label="Food thrown away"
            value={money(state.r._wasteCost ?? 0)}
            tone={(state.r._wasteCost ?? 0) > 0 ? "bad" : "good"}
          />
        </dl>
        <ul className="mt-3 space-y-1.5 border-t border-rule-soft pt-3 text-xs">
          <Line label={`Rent — ${room.label}`} value={-rent(k)} />
          <Line
            label={
              k.staff.length === 0
                ? "Wages — nobody but you"
                : `Wages — ${k.staff.length} on the payroll`
            }
            value={-wages(k)}
          />
          <Line
            label="Kitchen upkeep"
            value={-kitUpkeep(k)}
            note="Power, servicing and the cold running whether you cook or not."
          />
        </ul>
      </section>

      {/*
       * WHAT THE FOOD COST, AND WHAT IT EARNED
       *
       * One panel, four figures, and every one of them read off the week that
       * actually resolved rather than recomputed here: takings, what the
       * crates and the pantry cost to put on plates, what was thrown away,
       * and the share of the till that food ate. A second arithmetic in a
       * component is how two screens start disagreeing about the same week.
       */}
      {last && (
        <section
          aria-labelledby="food-h"
          className="rounded-lg border border-rule bg-card p-4"
        >
          <h2 id="food-h" className="text-sm font-semibold text-ink">
            Food cost
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            What went out on plates against what came back over the counter.
            Under a third is a kitchen making money; over a half is a kitchen
            cooking for the pleasure of it.
          </p>
          {(() => {
            /* The week's own numbers. `foodCost` is both halves — the staple
               crates drawn down and the named ingredients consumed. */
            const ingredients = last.ingredientCost ?? 0;
            const crates = last.lines.reduce((n, l) => n + l.foodCost, 0);
            const food = ingredients + crates;
            const share = last.revenue > 0 ? food / last.revenue : 0;
            const dishRevenue = (last.dishes ?? []).reduce(
              (n, x) => n + x.revenue,
              0,
            );
            return (
              <>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Stat label="Takings" value={money(last.revenue)} />
                  <Stat label="Food used" value={money(food)} tone="bad" />
                  <Stat
                    label="Food cost"
                    value={last.revenue > 0 ? `${Math.round(share * 100)}%` : "—"}
                    tone={share > 0.4 ? "bad" : "good"}
                  />
                  <Stat
                    label="Stock held"
                    value={money(larderValue(k, state.week) + pantryValue(k, state.week))}
                  />
                </dl>
                <ul className="mt-3 space-y-1.5 border-t border-rule-soft pt-3 text-xs">
                  <Line label="Staple crates drawn" value={-crates} />
                  <Line label="Ingredients on the plate" value={-ingredients} />
                  <Line
                    label="Thrown away"
                    value={-(state.r._wasteCost ?? 0)}
                    note="Past its life before it could be served."
                  />
                </ul>

                {(last.dishes ?? []).length > 0 && (
                  <>
                    <p className="mt-3 border-t border-rule-soft pt-3 text-xs text-ink-faint">
                      By dish, last week — {last.plainCovers ?? 0} cover
                      {(last.plainCovers ?? 0) === 1 ? "" : "s"} ate the staple
                      alone.
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs">
                      {(last.dishes ?? []).map((dish) => (
                        <li
                          key={dish.recipe}
                          className="flex flex-wrap items-baseline justify-between gap-x-3"
                        >
                          <span className="text-ink">{dish.name}</span>
                          <span className="text-ink-faint">
                            {dish.covers} covers · quality{" "}
                            {Math.round(dish.quality)}
                          </span>
                          <span className="text-ink">{money(dish.revenue)}</span>
                          <span className="w-full text-ink-faint">
                            food {money(dish.cost)} ·{" "}
                            {dish.revenue > 0
                              ? `${Math.round((dish.cost / dish.revenue) * 100)}% of what it sold for`
                              : "sold nothing"}
                            {dish.shortOf ? ` · ran out of ${dish.shortOf.toLowerCase()}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {dishRevenue > 0 && (
                      <p className="mt-2 text-xs text-ink-faint">
                        {Math.round((dishRevenue / Math.max(1, last.revenue)) * 100)}%
                        of the week&rsquo;s takings came off the menu; the rest is
                        the staple and kept deposits.
                      </p>
                    )}
                  </>
                )}
              </>
            );
          })()}
        </section>
      )}

      <section
        aria-labelledby="loan-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="loan-h" className="text-sm font-semibold text-ink">
          The fit-out loan
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          What the kitchen cost before it had served anybody. Interest is
          charged every week on whatever is left.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <Stat
            label="Outstanding"
            value={money(state.r.debt)}
            tone={state.r.debt > 0 ? "bad" : "good"}
          />
          <Stat label="Interest this week" value={money(interest)} />
          <Stat label="Cash to hand" value={money(state.r.cash)} />
        </dl>
        <button
          type="button"
          disabled={pay <= 0}
          onClick={() => onCommand("payLoan", "")}
          className="mt-3 rounded border border-rule px-3 py-1.5 text-xs text-ink enabled:hover:border-clinical disabled:cursor-not-allowed disabled:opacity-45"
        >
          {state.r.debt <= 0
            ? "Nothing outstanding"
            : pay <= 0
              ? "No cash to pay it with"
              : `Pay ${money(pay)} off the loan`}
        </button>
      </section>

      <section
        aria-labelledby="worth-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="worth-h" className="text-sm font-semibold text-ink">
          What the business is worth
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Half the objective. Stock counts at what is still good — the rest of
          it left as a write-off.
        </p>
        <ul className="mt-3 space-y-1.5 text-xs">
          <Line label="Cash" value={state.r.cash} />
          <Line
            label={`${room.label} — at four fifths of what it cost`}
            value={Math.round(premisesPrice(k, room) * 0.8)}
          />
          <Line label="Kitchen equipment" value={Math.round(kitValue(k))} />
          <Line
            label={`Larder — ${larderCovers(k)} covers still good`}
            value={Math.round(larderValue(k, state.week))}
          />
          <Line
            label="Pantry — ingredients still good"
            value={Math.round(pantryValue(k, state.week))}
          />
          <Line label="Fit-out loan" value={-state.r.debt} />
        </ul>
        <p className="mt-3 border-t border-rule-soft pt-3 text-xs text-ink">
          <span className="text-ink-faint">The business — </span>
          <span className="font-semibold">{money(kitchenWorth(state))}</span>
        </p>
      </section>
    </div>
  );
}

/** One signed figure against its label. */
function Line({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3">
      <span className="text-ink">{label}</span>
      <span className={value < 0 ? "text-caution" : "text-ink"}>
        {value < 0 ? `−${money(-value)}` : money(value)}
      </span>
      {note && <span className="w-full text-ink-faint">{note}</span>}
    </li>
  );
}
