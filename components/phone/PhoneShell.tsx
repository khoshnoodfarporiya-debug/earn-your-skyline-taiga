"use client";

import type { ReactNode } from "react";
import { AppIcon, appAccent } from "./AppIcon";

export type PhoneApp =
  | "pulse"
  | "messages"
  | "news"
  | "market"
  | "agency"
  | "listings"
  | "roll";

export interface PhoneAppDef {
  id: PhoneApp;
  label: string;
}

/**
 * Every career carries the social three. What else is on the handset is the
 * career's business: a chef rings suppliers and staffing agencies, a doctor
 * does neither — their dock simply does not have the icons.
 */
export const CORE_APPS: PhoneAppDef[] = [
  { id: "pulse", label: "Pulse" },
  { id: "messages", label: "Messages" },
  { id: "news", label: "News" },
];

export const CHEF_APPS: PhoneAppDef[] = [
  ...CORE_APPS,
  { id: "market", label: "Market" },
  { id: "agency", label: "Agency" },
];

/**
 * The Solicitor's two.
 *
 * `listings` is the court's diary rather than yours: when each matter is
 * actually being heard, what has been put back, and the one call that changes
 * a hearing's odds — instructing counsel. `roll` is the register of
 * solicitors, which is where a practice finds anybody to take a seat.
 *
 * Neither is shared with another career, and neither is a second copy of a
 * dashboard panel: these are the two transactions that are genuinely calls
 * you make rather than reports you read.
 */
export const LAWYER_APPS: PhoneAppDef[] = [
  ...CORE_APPS,
  { id: "listings", label: "Listings" },
  { id: "roll", label: "Roll" },
];

/* ------------------------------------------------------------ the chrome */

/** Signal strength, drawn. Decorative: it is a phone, phones have bars. */
function Bars() {
  return (
    <svg width={15} height={11} viewBox="0 0 15 11" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={i * 4}
          y={8 - i * 2.4}
          width={2.6}
          height={3 + i * 2.4}
          rx={1}
          fill="currentColor"
          opacity={i === 3 ? 0.32 : 0.85}
        />
      ))}
    </svg>
  );
}

/** A battery, drawn. */
function Battery() {
  return (
    <svg width={22} height={11} viewBox="0 0 22 11" aria-hidden>
      <rect
        x={0.6}
        y={0.6}
        width={18}
        height={9.8}
        rx={2.6}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.45}
        strokeWidth={1.2}
      />
      <rect x={2.4} y={2.4} width={11.5} height={6.2} rx={1.4} fill="currentColor" />
      <path
        d="M20.4 3.8v3.4a2 2 0 000-3.4z"
        fill="currentColor"
        opacity={0.45}
      />
    </svg>
  );
}

/**
 * The device itself: a status bar, a scrolling app area, and a dock.
 *
 * It reads as a phone without imitating any real one — same navy, same rules
 * and mono numerals as the rest of the command centre, just at handset scale
 * and with its own bezel.
 */
export function PhoneShell({
  week,
  app,
  apps,
  onSelect,
  onClose,
  badges,
  children,
}: {
  week: number;
  app: PhoneApp;
  /** The dock for this career. Defaults to the shared three. */
  apps?: PhoneAppDef[];
  onSelect: (app: PhoneApp) => void;
  onClose: () => void;
  badges: Partial<Record<PhoneApp, number>>;
  children: ReactNode;
}) {
  const dock = apps ?? CORE_APPS;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-paper">
      {/*
       * ONE status bar, not two.
       *
       * The dialog used to render a "Personal device / Close" strip and then
       * the shell rendered "WK n / Pulse OS / ▮▮▮" underneath it — two rows of
       * chrome stacked above any content, on a 400px-wide handset. A real
       * phone's status bar carries the state and nothing else, so the close
       * control lives in it rather than in a bar of its own.
       */}
      <div className="relative flex shrink-0 items-center gap-2 bg-void/60 px-4 py-2 text-ink-soft">
        <span className="num text-[12px] tracking-wide text-ink">WK {week}</span>
        <span className="sign flex-1 text-center text-[11px] text-clinical/85">
          Pulse OS
        </span>
        <span className="flex items-center gap-1.5">
          <Bars />
          <Battery />
        </span>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1.5 ml-0.5 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition hover:bg-card-high hover:text-clinical"
          aria-label="Close phone"
        >
          <svg width={13} height={13} viewBox="0 0 13 13" aria-hidden>
            <path
              d="M1.5 1.5l10 10M11.5 1.5l-10 10"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </svg>
        </button>
        {/* the hairline that separates chrome from screen */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-rule to-transparent"
        />
      </div>

      {/* ---------------------------------------------------------- screen */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>

      {/* ------------------------------------------------------------ dock */}
      <nav
        aria-label="Phone apps"
        className="relative shrink-0 border-t border-rule/60 bg-gradient-to-b from-card to-card-high"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex items-end px-1 pb-1 pt-1.5">
          {dock.map((a) => {
            const active = app === a.id;
            const count = badges[a.id] ?? 0;
            const accent = appAccent(a.id);
            return (
              <li key={a.id} className="min-w-0 flex-1">
                <button
                  onClick={() => onSelect(a.id)}
                  aria-current={active ? "page" : undefined}
                  className="group flex w-full flex-col items-center gap-1 rounded-form px-0.5 pb-1 pt-1 transition"
                >
                  <span className="relative block">
                    {/* the lit app's tile sits in its own pool of colour */}
                    <span
                      aria-hidden
                      className="absolute -inset-1.5 rounded-[15px] transition"
                      style={{
                        background: active ? accent : "transparent",
                        opacity: active ? 0.17 : 0,
                      }}
                    />
                    <AppIcon
                      app={a.id}
                      size={30}
                      muted={!active}
                      className="relative block group-hover:opacity-100"
                    />
                    {count > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-card bg-alarm px-1 text-[11px] font-bold leading-none text-[#2A0808]">
                        {count > 9 ? "9+" : count}
                      </span>
                    )}
                  </span>
                  <span
                    className="sign block max-w-full truncate text-[10.5px] leading-none transition"
                    style={{ color: active ? accent : undefined }}
                  >
                    <span className={active ? "" : "text-ink-faint"}>
                      {a.label}
                    </span>
                  </span>
                  {count > 0 && (
                    <span className="sr-only">
                      {`${count} unread in ${a.label}`}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* the bar every handset has under its dock */}
        <span
          aria-hidden
          className="mx-auto mb-1.5 block h-[3.5px] w-24 rounded-full bg-ink-faint/35"
        />
      </nav>
    </div>
  );
}
