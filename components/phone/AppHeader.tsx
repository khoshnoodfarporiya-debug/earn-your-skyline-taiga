"use client";

import type { ReactNode } from "react";
import { AppIcon, appAccent } from "./AppIcon";
import type { PhoneApp } from "./PhoneShell";

/**
 * The top of an app's screen.
 *
 * Every app opens the same way — its own icon, its own name, one line saying
 * what the screen is for, and a strip of live numbers underneath. Doing this
 * in one component rather than five copies is what makes the handset feel
 * like one device instead of five pages that happen to share a bezel.
 *
 * The tinted wash behind it is the app's own hue at 8%, which is enough for
 * the eye to know it has changed rooms and not enough to fight the content.
 */
export function AppHeader({
  app,
  title,
  blurb,
  stats,
  children,
}: {
  app: PhoneApp;
  title: string;
  blurb: string;
  /** The two or three numbers this screen is operated against. */
  stats?: { label: string; value: string; tone?: "good" | "bad" }[];
  children?: ReactNode;
}) {
  const accent = appAccent(app);

  return (
    <header className="relative overflow-hidden border-b border-rule/60 px-4 pb-3.5 pt-4">
      {/* the app's own light, falling from the top */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-full"
        style={{
          background: `linear-gradient(180deg, ${accent}14 0%, transparent 78%)`,
        }}
      />

      <div className="relative flex items-start gap-3">
        <AppIcon app={app} size={40} className="shrink-0 shadow-lift" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold leading-tight text-ink">
            {title}
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-ink-soft">{blurb}</p>
        </div>
      </div>

      {stats && stats.length > 0 && (
        <dl className="relative mt-3 flex flex-wrap gap-x-5 gap-y-2 rounded-form border border-rule/60 bg-card/70 px-3 py-2">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="sign text-[10.5px] leading-none text-ink-faint">
                {s.label}
              </dt>
              <dd
                className={`num mt-1 text-[13.5px] leading-none ${
                  s.tone === "bad"
                    ? "text-alarm"
                    : s.tone === "good"
                      ? "text-good"
                      : "text-ink"
                }`}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {children}
    </header>
  );
}
