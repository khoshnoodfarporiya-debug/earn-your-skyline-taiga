"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { PurchaseItem } from "@/lib/ui/purchases";
import { money } from "@/lib/game/format";
import { MedIcon } from "../visuals/MedIcon";

/**
 * THE MOMENT AFTER
 *
 * Buying a regional hospital and having a row silently change from "Buy" to
 * "Owned" is the difference between a management game and a form. This is the
 * beat that says it happened: the artwork you just bought, what it cost, what
 * you have left, and what it does for you from now on.
 *
 * ---------------------------------------------------------------- not modal
 *
 * It does not take focus and it does not block. The purchase is already done —
 * asking the player to dismiss a confirmation of a thing they chose is a
 * second decision about a decision.
 *
 * It is `role="status"` with `aria-live="polite"`, so a screen-reader user is
 * told what was bought and what the balance is without being interrupted
 * mid-sentence.
 *
 * ------------------------------------------------------------------ motion
 *
 * A short rise-and-fade, disabled entirely under `prefers-reduced-motion`
 * (see `.rise` in globals.css, which the reduced-motion block already turns
 * off). The dismiss timer is unaffected: the message still goes away, it just
 * stops sliding.
 */
export function PurchaseToast({
  item,
  spent,
  balance,
  onDone,
}: {
  item: PurchaseItem;
  /** What actually left the account, after any trade-in. */
  spent: number;
  /** Cash remaining, read after the command applied. */
  balance: number;
  onDone: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timer.current = setTimeout(onDone, 6000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [onDone]);

  /* The single most useful consequence, taken from the effects the model
     already derived rather than written twice. */
  const gain = item.effects.find((e) => e.tone === "good");

  return (
    <div
      role="status"
      aria-live="polite"
      className="rise pointer-events-auto w-full max-w-sm overflow-hidden rounded-panel border border-clinical/40 bg-card shadow-lift"
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-form bg-paper">
          {item.art ? (
            <Image
              src={item.art.src}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
              style={{ objectPosition: item.art.focus }}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-ink-faint">
              <MedIcon name={item.icon} className="h-6 w-6" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="t-label flex items-center gap-1.5 text-clinical">
            <MedIcon name="shield" className="h-3.5 w-3.5" />
            Bought
          </p>
          <p className="mt-0.5 truncate text-[14px] font-semibold text-ink">
            {item.label}
          </p>
          <p className="num mt-0.5 text-[12.5px] text-ink-soft">
            {money(spent)} spent · {money(balance)} left
          </p>
          {gain && (
            <p className="mt-0.5 text-[12px] leading-snug text-good">
              {gain.label}: {gain.value}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onDone}
          className="-m-1 shrink-0 self-start rounded-form p-2 text-[12px] text-ink-faint transition hover:text-ink"
        >
          <span aria-hidden>×</span>
          <span className="sr-only">Dismiss</span>
        </button>
      </div>
    </div>
  );
}

/** Bottom-right on desktop, above the mobile nav bar on a phone. */
export function ToastStack({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 p-3 sm:inset-x-auto sm:right-4 sm:items-end"
      style={{ paddingBottom: "max(5.5rem, env(safe-area-inset-bottom))" }}
    >
      {children}
    </div>
  );
}
