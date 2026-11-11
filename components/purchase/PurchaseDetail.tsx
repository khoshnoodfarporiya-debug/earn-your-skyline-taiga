"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { PurchaseItem } from "@/lib/ui/purchases";
import { purchaseBlocker } from "@/lib/ui/purchases";
import { money } from "@/lib/game/format";
import { MedIcon } from "../visuals/MedIcon";

/**
 * THE DECISION, FULL SIZE
 *
 * A drawer rather than a page. Buying a scanner is a moment inside a screen you
 * were already reading, and navigating away from the catalogue to evaluate one
 * item — then back to compare — is how a shop becomes a chore.
 *
 * Bottom sheet on a phone, centred panel from `sm` up. Same component, same
 * content; only the anchoring changes, so there is no second mobile layout to
 * keep in step.
 *
 * ------------------------------------------------------------ what it adds
 *
 * Everything the card had no room for and nothing it invents: the full
 * artwork, the description, every effect the game data actually supports, the
 * running cost, the operational caveats, and — for homes and cars — what
 * trading up would refund.
 *
 * The confirm button restates the price. A confirmation whose button says only
 * "Confirm" is a confirmation of nothing.
 *
 * ------------------------------------------------------------------- focus
 *
 * Focus moves in, is trapped, and returns to the card that opened it. Escape
 * closes. The page behind does not scroll.
 */
export function PurchaseDetail({
  item,
  cash,
  onBuy,
  onSell,
  onClose,
  busy,
  returnFocusTo,
}: {
  item: PurchaseItem;
  cash: number;
  onBuy: () => void;
  onSell?: () => void;
  onClose: () => void;
  busy?: boolean;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = `purchase-${item.id}`;
  const blocker = purchaseBlocker(item);

  useEffect(() => {
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const returnTo = returnFocusTo?.current;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = priorOverflow;
      returnTo?.focus();
    };
  }, [onClose, returnFocusTo]);

  const afterCash = cash - item.price + (item.tradeIn?.refund ?? 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-void/80 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="stamp-in scroll-thin max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-panel border border-rule bg-card shadow-lift sm:max-h-[88vh] sm:rounded-panel"
      >
        {/* ------------------------------------------------------- artwork */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-paper">
          {item.art ? (
            <Image
              src={item.art.large}
              alt={item.art.alt}
              fill
              sizes="(min-width: 640px) 576px, 100vw"
              className="object-cover"
              style={{ objectPosition: item.art.focus }}
              priority
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-ink-faint">
              <MedIcon name={item.icon} className="h-16 w-16" />
            </span>
          )}
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-card via-card/80 to-transparent"
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2.5 top-2.5 min-h-[44px] min-w-[44px] rounded-form bg-void/75 text-[13px] text-ink-soft transition hover:text-ink"
          >
            Close
          </button>

          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="t-label flex items-center gap-1.5 text-clinical">
              <MedIcon name={item.icon} className="h-3.5 w-3.5" />
              {item.categoryWord}
              {item.active && (
                <span className="text-ink-faint">· in service</span>
              )}
              {item.owned && !item.active && (
                <span className="text-ink-faint">· owned</span>
              )}
            </p>
            <h2 id={headingId} className="display mt-1 text-2xl leading-tight">
              {item.label}
            </h2>
          </div>
        </div>

        {/* ---------------------------------------------------- description */}
        <p className="px-5 pt-4 text-[14px] leading-relaxed text-ink-soft">
          {item.blurb}
        </p>

        {/* -------------------------------------------------------- effects */}
        <dl className="mt-4 grid gap-px border-y border-rule bg-rule-soft sm:grid-cols-2">
          {item.effects.map((e) => (
            <div key={e.label} className="bg-card px-5 py-3">
              <dt className="t-label text-ink-faint">{e.label}</dt>
              <dd
                className={`num mt-0.5 text-[14px] ${
                  e.tone === "good"
                    ? "text-good"
                    : e.tone === "cost"
                      ? "text-caution"
                      : "text-ink"
                }`}
              >
                {e.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* -------------------------------------------- departmental cover */}
        {item.coverage && (
          <div className="border-b border-rule px-5 py-3.5">
            <h3 className="t-label text-ink-faint">
              {item.owned ? "How well it is covered" : "What it will need"}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              {item.coverage.note}
            </p>
            <dl className="mt-2.5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <div>
                <dt className="t-label text-ink-faint">Who can work it</dt>
                <dd className="mt-0.5 text-[12.5px] text-ink-soft">
                  {item.coverage.staffing}
                </dd>
              </div>
              <div>
                <dt className="t-label text-ink-faint">Equipment it uses</dt>
                <dd className="mt-0.5 text-[12.5px] text-ink-soft">
                  {item.coverage.missingEquipment.length === 0
                    ? "Everything it needs is installed."
                    : `Missing: ${item.coverage.missingEquipment.join(", ")}.`}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* ---------------------------------------------- what to watch for */}
        {item.caveats.length > 0 && (
          <ul className="space-y-2 border-b border-rule bg-caution-tint px-5 py-3.5">
            {item.caveats.map((c) => (
              <li
                key={c}
                className="flex gap-2 text-[12.5px] leading-relaxed text-ink"
              >
                <span aria-hidden className="mt-0.5 shrink-0 text-caution">
                  <MedIcon name="alert" className="h-4 w-4" />
                </span>
                {c}
              </li>
            ))}
          </ul>
        )}

        {/* ------------------------------------------------ what you have now */}
        {item.comparison && !item.owned && (
          <div className="border-b border-rule px-5 py-3.5">
            <h3 className="t-label text-ink-faint">Against what you have</h3>
            <p className="mt-1.5 flex items-baseline gap-2.5 text-[13px]">
              <span className="num text-ink-soft">{item.comparison.now}</span>
              <span aria-hidden className="text-ink-faint">
                &rarr;
              </span>
              <span className="num text-[16px] font-semibold text-good">
                {item.comparison.after}
              </span>
              <span className="text-ink-soft">{item.comparison.label}</span>
            </p>
          </div>
        )}

        {item.tradeIn && !item.owned && (
          <div className="border-b border-rule px-5 py-3.5">
            <h3 className="t-label text-ink-faint">Against what you have</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              You currently keep the{" "}
              <span className="text-ink">{item.tradeIn.label}</span>. Buying
              this replaces it and returns{" "}
              <span className="num text-good">
                {money(item.tradeIn.refund)}
              </span>{" "}
              — you keep exactly one.
            </p>
          </div>
        )}

        {/* ----------------------------------------------------- the money */}
        <div className="px-5 pt-4">
          <dl className="space-y-1.5">
            <Row label="Price" value={money(item.price)} strong />
            {item.tradeIn && !item.owned && (
              <Row
                label={`Trade in the ${item.tradeIn.label.toLowerCase()}`}
                value={`+${money(item.tradeIn.refund)}`}
                tone="good"
              />
            )}
            {item.upkeep > 0 && (
              <Row
                label="Every week afterwards"
                value={money(item.upkeep)}
                tone="cost"
              />
            )}
            <Row label="Cash now" value={money(cash)} />
            {!item.owned && (
              <Row
                label="Cash after"
                value={money(afterCash)}
                tone={afterCash < 0 ? "cost" : undefined}
              />
            )}
          </dl>
        </div>

        {/*
         * The action bar sticks to the bottom of the sheet.
         *
         * On a 390px phone the artwork, the effects and the money together are
         * taller than the viewport, so a purchase button in the normal flow
         * sits below the fold — the player scrolls a wall of justification to
         * reach the thing they came for. Sticky keeps the price and the button
         * on screen while the reasons scroll behind it.
         */}
        <div
          className="sticky bottom-0 border-t border-rule bg-card/95 px-5 py-3.5 backdrop-blur"
          style={{
            paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))",
          }}
        >
          {/* The refusal travels with the button it disables. It used to sit
              in the scrolling body, which on a phone put the reason off
              screen at the exact moment the player was looking at a dead
              control and wondering why. */}
          {blocker && !item.owned && (
            <p className="mb-2.5 flex items-start gap-2 rounded-form bg-alarm-tint px-3 py-2 text-[12.5px] leading-snug text-alarm">
              <span aria-hidden className="mt-0.5 shrink-0">
                <MedIcon name="alert" className="h-4 w-4" />
              </span>
              {blocker}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {item.owned && item.sell && onSell ? (
              <button
                type="button"
                onClick={onSell}
                disabled={busy}
                className="min-h-[48px] flex-1 rounded-form bg-card-high px-4 text-[14px] font-semibold text-ink-soft transition hover:text-alarm disabled:opacity-60"
              >
                Sell for {money(item.sell.refund)}
              </button>
            ) : (
              <button
                type="button"
                onClick={onBuy}
                disabled={!!blocker || busy}
                className="min-h-[48px] flex-1 rounded-form bg-clinical px-4 text-[15px] font-bold text-on-accent transition hover:bg-clinical-hover disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint"
              >
                {busy ? "Buying…" : `Buy for ${money(item.price)}`}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] rounded-form border border-rule px-4 text-[13px] text-ink-soft transition hover:text-ink"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "good" | "cost";
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-[13px] ${strong ? "text-ink" : "text-ink-soft"}`}>
        {label}
      </dt>
      <dd
        className={`num ${strong ? "text-[16px] font-semibold" : "text-[13.5px]"} ${
          tone === "good"
            ? "text-good"
            : tone === "cost"
              ? "text-caution"
              : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
