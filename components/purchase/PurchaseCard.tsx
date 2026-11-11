"use client";

import Image from "next/image";
import type { PurchaseItem, PurchaseState } from "@/lib/ui/purchases";
import { money } from "@/lib/game/format";
import { MedIcon } from "../visuals/MedIcon";

/**
 * THE THING YOU CAN BUY, WITH ITS PICTURE
 *
 * One card for a hospital, a scanner, a house and a watch. The five catalogues
 * behind them have nothing in common; `lib/ui/purchases.ts` normalises them,
 * and this renders exactly one shape.
 *
 * ------------------------------------------------------------ the hierarchy
 *
 * Artwork, then name, then one line of what it does, then the price. In that
 * order, at that weight. The previous card led with a title and buried the
 * effect in a bulleted list — which is a settings menu, not a purchase.
 *
 * The card itself is an <article> with a <button> for the action, never a
 * button wrapping everything: a card-as-button gives a screen reader an
 * accessible name four sentences long, and makes the picture a control.
 *
 * -------------------------------------------------------------- the states
 *
 * Six, and never carried by colour alone. Every one has a word in the badge,
 * a border treatment and its own button label:
 *
 *   active        In service      teal border, "Owned"
 *   owned         Owned           teal border, "Sell for …"
 *   affordable    (category)      plain border, "Buy · £x"
 *   unaffordable  £x short        plain border, dimmed button, "£x short"
 *   locked        Locked          dashed border, padlock, reason on the face
 *
 * Nothing glows. Gold is reserved for the genuinely prestigious end of the
 * catalogue — a country estate, a private jet — and is a border and a label,
 * not a shadow.
 */
export function PurchaseCard({
  item,
  onOpen,
  onBuy,
  busy,
  justAffordable,
}: {
  item: PurchaseItem;
  /** Crossed from out of reach into affordable since the last render. */
  justAffordable?: boolean;
  /** Opens the detail view. The card body is the trigger. */
  onOpen: () => void;
  /** The one-tap path, for players who do not want the detail view. */
  onBuy: () => void;
  /** True while a purchase is in flight — see `usePurchase`. */
  busy?: boolean;
}) {
  const skin = SKIN[item.state];
  /* Prestige is a price band, not a category: the most expensive rung of any
     group earns the gold treatment. */
  const prestige = item.price >= 900_000;

  return (
    <article
      aria-label={item.label}
      className={`group relative flex flex-col overflow-hidden rounded-panel border bg-card transition ${
        prestige && item.state !== "locked" ? "border-gold/35" : skin.border
      }`}
    >
      {/* The department's own wayfinding colour, as a 3px edge rather than a
          saturated background — the same hue that identifies the field on the
          caseload, the rota and the outbreak chips. */}
      {item.accent && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: item.accent }}
        />
      )}
      {/* ------------------------------------------------------- the artwork */}
      {/*
       * Clicking the picture opens the detail view — a pointer shortcut, not
       * a second control. It is hidden from assistive technology and out of
       * the tab order, because the labelled "Details" button below does the
       * same job: two controls with one purpose is noise in a screen reader
       * and an extra stop for a keyboard user.
       */}
      <button
        type="button"
        onClick={onOpen}
        tabIndex={-1}
        aria-hidden
        className="relative block aspect-[4/3] w-full overflow-hidden bg-paper text-left"
      >
        {item.art ? (
          <Image
            src={item.art.src}
            alt={item.art.alt}
            fill
            /* Two columns at desktop inside a 1152px shell, one on a phone.
               The browser picks from these rather than downloading the 720px
               file for a 180px slot. */
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            loading="lazy"
            className={`object-cover transition duration-300 motion-reduce:transition-none ${
              item.state === "locked"
                ? "opacity-40 grayscale"
                : item.owned || item.active
                  ? "opacity-100"
                  : "opacity-90 group-hover:opacity-100"
            }`}
            style={{ objectPosition: item.art.focus }}
          />
        ) : (
          /* No artwork: a typographic tile in the item's own colour rather
             than a shared "image missing" graphic, which is worse than
             either having the picture or not pretending to. */
          <span className="flex h-full w-full items-center justify-center bg-card-high text-ink-faint">
            <MedIcon name={item.icon} className="h-10 w-10" />
          </span>
        )}

        {/* A shallow scrim so the badge stays legible over a bright image. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-void/70 to-transparent"
        />

        <span
          className={`absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-form px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
            justAffordable ? "bg-gold text-[#2A2008]" : skin.badge
          }`}
        >
          <MedIcon
            name={justAffordable ? "certificate" : (skin.icon ?? item.icon)}
            className="h-3.5 w-3.5"
          />
          {justAffordable
            ? "Now within reach"
            : (skin.word ?? (prestige ? "Prestige" : item.categoryWord))}
        </span>
      </button>

      {/* ---------------------------------------------------------- the body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h4 className="text-[15px] font-semibold leading-tight text-ink">
            {item.label}
          </h4>
          <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">
            {item.headline}
          </p>
        </div>

        <div className="mt-auto">
          {/* Price and the recurring cost together — the second number is the
              one that decides whether the first is affordable. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p
              className={`num text-[17px] font-semibold leading-none ${
                prestige ? "text-gold" : "text-ink"
              }`}
            >
              {money(item.price)}
            </p>
            {item.upkeep > 0 && (
              <p className="num text-[12px] text-caution">
                {money(item.upkeep)}/wk after
              </p>
            )}
          </div>

          {/*
           * Coverage, for an open department.
           *
           * A department you have opened and cannot staff is a distinct
           * failure from one you have not opened — it is charging upkeep to
           * refer work away — and neither the price nor the "Owned" button
           * can say so. The word carries it; the colour agrees with it.
           */}
          {item.coverage && item.owned && (
            <p className="mb-2 flex items-center gap-1.5 text-[12px]">
              <span className={COVER_TEXT[item.coverage.level]}>
                <MedIcon
                  name={item.coverage.level === "covered" ? "shield" : "alert"}
                  className="h-3.5 w-3.5"
                />
              </span>
              <span className={`t-label ${COVER_TEXT[item.coverage.level]}`}>
                {COVER_WORD[item.coverage.level]}
              </span>
              <span className="num text-ink-soft">
                takes severity {item.coverage.covered} of {item.coverage.needed}
              </span>
            </p>
          )}

          {/*
           * A refusal, on the face of the card.
           *
           * "Locked" on a button says that it is refused; it does not say
           * why, and the reason is a sentence rather than a price — a
           * department with no slot needs premises, not money. Making the
           * player open a drawer to find that out is the dead end the whole
           * comprehension pass was about.
           */}
          {item.lock && !item.owned && (
            <p className="mb-2 flex items-start gap-1.5 text-[12px] leading-snug text-caution">
              <span aria-hidden className="mt-0.5 shrink-0">
                <MedIcon name="alert" className="h-3.5 w-3.5" />
              </span>
              {item.lock}
            </p>
          )}

          {item.shortfall > 0 && !item.owned && (
            <p className="num mt-1 text-[12px] text-caution">
              {money(item.shortfall)} short
            </p>
          )}
          {item.tradeIn && !item.owned && (
            <p className="num mt-1 text-[12px] text-good">
              {money(item.tradeIn.refund)} back for the{" "}
              {item.tradeIn.label.toLowerCase()}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <Action item={item} onBuy={onBuy} busy={busy} />
            <button
              type="button"
              onClick={onOpen}
              className="min-h-[44px] shrink-0 rounded-form border border-rule px-3 text-[12.5px] text-ink-soft transition hover:border-clinical hover:text-clinical"
            >
              Details
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * The primary control.
 *
 * Its label carries the state on its own: "Buy · £34,000", "£12,400 short",
 * "Owned", "Locked". A disabled button that still says "Buy" makes the player
 * click it to find out why.
 */
function Action({
  item,
  onBuy,
  busy,
}: {
  item: PurchaseItem;
  onBuy: () => void;
  busy?: boolean;
}) {
  const base =
    "min-h-[44px] flex-1 rounded-form px-3 text-[13px] font-semibold transition disabled:cursor-not-allowed";

  if (item.state === "locked") {
    return (
      <button
        type="button"
        disabled
        className={`${base} bg-paper text-ink-faint`}
      >
        Locked
      </button>
    );
  }
  if (item.active || (item.owned && item.kind !== "facility")) {
    return (
      <button
        type="button"
        disabled
        className={`${base} bg-clinical-tint text-clinical`}
      >
        {item.active && item.kind === "lifestyle" ? "In service" : "Owned"}
      </button>
    );
  }
  if (!item.affordable) {
    return (
      <button
        type="button"
        disabled
        className={`${base} bg-paper text-ink-faint`}
      >
        Not enough cash
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={busy}
      className={`${base} bg-clinical text-on-accent hover:bg-clinical-hover disabled:opacity-60`}
    >
      {busy ? "Buying…" : item.owned ? "Buy another" : "Buy"}
    </button>
  );
}

/**
 * Coverage as a word first.
 *
 * "Covered" / "Thin" / "Uncovered" is the same vocabulary the Team screen's
 * rota uses, so a player learns it once. The colours agree with the words
 * rather than replacing them.
 */
const COVER_WORD: Record<string, string> = {
  covered: "Covered",
  partial: "Thin",
  uncovered: "Uncovered",
};

const COVER_TEXT: Record<string, string> = {
  covered: "text-good",
  partial: "text-caution",
  uncovered: "text-alarm",
};

const SKIN: Record<
  PurchaseState,
  {
    border: string;
    badge: string;
    word: string | null;
    icon?: "shield" | "alert";
  }
> = {
  active: {
    border: "border-clinical/45",
    badge: "bg-clinical text-on-accent",
    word: "In service",
  },
  owned: {
    border: "border-clinical/30",
    badge: "bg-clinical-tint text-clinical",
    word: "Owned",
  },
  affordable: {
    border: "border-rule",
    badge: "bg-void/70 text-ink-soft",
    word: null,
  },
  unaffordable: {
    border: "border-rule",
    badge: "bg-void/70 text-caution",
    word: "Saving toward",
  },
  locked: {
    border: "border-dashed border-rule",
    badge: "bg-void/80 text-ink-faint",
    word: "Locked",
    icon: "shield",
  },
};
