"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunState } from "@/lib/game/types";
import {
  purchaseBlocker,
  purchaseGroups,
  type PurchaseGroupId,
  type PurchaseItem,
} from "@/lib/ui/purchases";
import { MedIcon } from "../visuals/MedIcon";
import { PurchaseCard } from "./PurchaseCard";
import { PurchaseDetail } from "./PurchaseDetail";
import { PurchaseToast, ToastStack } from "./PurchaseToast";

/**
 * A CATALOGUE
 *
 * Cards, a detail drawer, and the confirmation that follows a purchase. One
 * component serves the Build screen and the Life screen — they were two
 * different lists with two different treatments of the same decision.
 *
 * ------------------------------------------------- double-click protection
 *
 * `pending` is a ref, not state.
 *
 * That matters. A state flag would not have flipped until the next render, so
 * two clicks inside one frame both read `false` and both dispatch — which on a
 * £4.1M private jet is a £8.2M mistake. A ref is written synchronously, so the
 * second click in the same tick sees the first. It is cleared on the next
 * frame, by which point the new state has arrived and the item reads as owned
 * anyway.
 *
 * The engine is also idempotent here — `buyLifestyle` refuses when the item is
 * already owned — so this is the second of two guards rather than the only one.
 *
 * ------------------------------------------------------------------- tabs
 *
 * Only when there is more than one group. A tab strip over a single category
 * is chrome that does nothing, and the brief is explicit about not burying
 * things behind navigation that does not earn its place.
 */
export function PurchaseShelf({
  state,
  dispatch,
  groups,
  title,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
  /** Which categories this shelf shows. */
  groups: PurchaseGroupId[];
  title?: string;
}) {
  const shown = purchaseGroups(state, groups);
  const [tab, setTab] = useState<PurchaseGroupId>(groups[0]);
  const [detail, setDetail] = useState<PurchaseItem | null>(null);
  const [toasts, setToasts] = useState<
    { key: number; item: PurchaseItem; spent: number; balance: number }[]
  >([]);
  const pending = useRef<string | null>(null);
  /*
   * NEWLY WITHIN REACH
   *
   * The brief asks for a "newly unlocked" state. Nothing in this catalogue
   * unlocks on a timer, so inventing a padlock that pops open would be
   * teaching a rule the game does not have. What *does* happen — and is worth
   * marking — is an item crossing from out of reach into affordable as the
   * money arrives.
   *
   * Tracked in a ref against the previous render, so it is a genuine
   * transition rather than a property of the item. It survives no reload,
   * which is correct: it is a notification, not a state.
   */
  const wasShort = useRef<Set<string>>(new Set());
  const justAffordable = new Set<string>();
  for (const item of shown.flatMap((g) => g.items)) {
    if (item.affordable && !item.owned && wasShort.current.has(item.id)) {
      justAffordable.add(item.id);
    }
  }
  useEffect(() => {
    wasShort.current = new Set(
      shown
        .flatMap((g) => g.items)
        .filter((i) => !i.affordable)
        .map((i) => i.id),
    );
  });
  const openerRef = useRef<HTMLElement | null>(null);
  const nextKey = useRef(0);

  const active = shown.find((g) => g.id === tab) ?? shown[0];

  const buy = useCallback(
    (item: PurchaseItem) => {
      /* Synchronous guard — see the note above. */
      if (pending.current === item.id) return;
      if (purchaseBlocker(item)) return;
      pending.current = item.id;

      const before = state.r.cash;
      dispatch(item.buy.cmd, item.buy.arg);
      /* The refund lands in the same command, so what actually left the
         account is the price minus any trade-in. Reported rather than
         recomputed, so the toast cannot disagree with the ledger. */
      const spent = item.price - (item.tradeIn?.refund ?? 0);
      setToasts((t) => [
        ...t.slice(-2),
        {
          key: nextKey.current++,
          item,
          spent,
          balance: before - spent,
        },
      ]);
      setDetail(null);
      /* Released on the next frame: by then the new state has rendered and
         the card reports the item as owned, which blocks a repeat anyway. */
      requestAnimationFrame(() => {
        pending.current = null;
      });
    },
    [dispatch, state.r.cash],
  );

  const sell = useCallback(
    (item: PurchaseItem) => {
      if (!item.sell || pending.current === item.id) return;
      pending.current = item.id;
      dispatch(item.sell.cmd, item.sell.arg);
      setDetail(null);
      requestAnimationFrame(() => {
        pending.current = null;
      });
    },
    [dispatch],
  );

  if (shown.length === 0) return null;

  return (
    <section className="form overflow-hidden" aria-label={title ?? "Purchases"}>
      {title && (
        <div className="form-head flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
          <h3 className="sign text-[11.5px] text-ink-soft">{title}</h3>
          <span className="num text-[12px] text-ink-soft">
            {active.items.filter((i) => i.owned).length} of{" "}
            {active.items.length} owned
          </span>
        </div>
      )}

      {shown.length > 1 && (
        <div
          role="tablist"
          aria-label={`${title ?? "Purchase"} categories`}
          className="scroll-thin flex gap-1 overflow-x-auto border-b border-rule px-4 py-2.5"
        >
          {shown.map((g) => (
            <button
              key={g.id}
              role="tab"
              aria-selected={g.id === active.id}
              onClick={() => setTab(g.id)}
              className={`sign flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-form border px-3.5 text-[11.5px] transition ${
                g.id === active.id
                  ? "border-clinical/60 bg-clinical-tint text-clinical"
                  : "border-rule bg-card text-ink-soft hover:border-clinical/40 hover:text-ink"
              }`}
            >
              <MedIcon name={g.icon} className="h-4 w-4" />
              {g.label}
            </button>
          ))}
        </div>
      )}

      <p className="border-b border-rule-soft px-5 py-3 text-[12.5px] leading-relaxed text-ink-soft">
        {active.note}
      </p>

      {/*
       * One column on a phone, two from 640, three from 1024. Deliberately not
       * four: a 4:3 image at a quarter of 1152px is 270px, and the artwork
       * stops being the point of the card below about 300.
       */}
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {active.items.map((item) => (
          <PurchaseCard
            key={item.id}
            item={item}
            busy={pending.current === item.id}
            justAffordable={justAffordable.has(item.id)}
            onOpen={(e?: unknown) => {
              void e;
              openerRef.current = document.activeElement as HTMLElement;
              setDetail(item);
            }}
            onBuy={() => buy(item)}
          />
        ))}
      </div>

      {detail && (
        <PurchaseDetail
          /* Re-read from the live list so the drawer reflects the state after
             a purchase rather than the snapshot it was opened with. */
          item={
            shown.flatMap((g) => g.items).find((i) => i.id === detail.id) ??
            detail
          }
          cash={state.r.cash}
          busy={pending.current === detail.id}
          onBuy={() => buy(detail)}
          onSell={() => sell(detail)}
          onClose={() => setDetail(null)}
          returnFocusTo={openerRef}
        />
      )}

      {toasts.length > 0 && (
        <ToastStack>
          {toasts.map((t) => (
            <PurchaseToast
              key={t.key}
              item={t.item}
              spent={t.spent}
              balance={t.balance}
              onDone={() =>
                setToasts((list) => list.filter((x) => x.key !== t.key))
              }
            />
          ))}
        </ToastStack>
      )}
    </section>
  );
}
