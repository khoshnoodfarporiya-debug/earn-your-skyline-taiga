"use client";

import {
  defaultScreen,
  sectionsFor,
  type SectionId,
} from "@/lib/ui/navigation";
import type { Severity } from "@/lib/ui/alerts";
import { NavIcon } from "./NavIcon";

/**
 * Five primary destinations, rendered as a thumb-reachable bar fixed to the
 * bottom on mobile and as a horizontal rail on desktop. Same hierarchy in
 * both; only the position and density change.
 *
 * Badges carry a shape as well as a colour (a ring for warnings, a filled dot
 * for critical) so severity is never communicated by hue alone.
 */
export function PrimaryNav({
  active,
  careerId,
  onNavigate,
  badges,
}: {
  active: SectionId;
  /** Which career's destinations to show — they are not the same set. */
  careerId: string;
  onNavigate: (screen: ReturnType<typeof defaultScreen>) => void;
  /** Worst outstanding severity per section, if any. */
  badges: Partial<Record<SectionId, { severity: Severity; count: number }>>;
}) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/95 backdrop-blur lg:static lg:z-auto lg:rounded-form lg:border-0 lg:bg-transparent lg:backdrop-blur-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-6xl lg:gap-1 lg:p-1">
        {sectionsFor(careerId).map((section) => {
          const isActive = active === section.id;
          const badge = badges[section.id];
          return (
            <li key={section.id} className="flex-1">
              <button
                onClick={() => onNavigate(defaultScreen(section.id, careerId))}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-h-[56px] w-full flex-col items-center justify-center gap-1 px-1 py-2 transition lg:min-h-[44px] lg:flex-row lg:gap-2.5 lg:rounded-form lg:px-4 lg:py-2.5 ${
                  isActive
                    ? "text-clinical lg:bg-clinical-tint"
                    : "text-ink-soft hover:text-ink lg:hover:bg-card"
                }`}
              >
                {/* Active marker: a lit rail, not just a colour change. */}
                <span
                  aria-hidden
                  className={`absolute inset-x-3 top-0 h-0.5 rounded-full transition lg:inset-x-2 lg:bottom-0 lg:top-auto ${
                    isActive ? "bg-clinical" : "bg-transparent"
                  }`}
                />
                <span className="relative">
                  <NavIcon name={section.icon} />
                  {badge && (
                    <span
                      className={`absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[11.5px] font-bold leading-none ${
                        badge.severity === "critical"
                          ? "bg-alarm text-[#2A0808]"
                          : "border border-caution bg-caution-tint text-caution"
                      }`}
                    >
                      <span aria-hidden>{badge.count}</span>
                      <span className="sr-only">
                        {`${badge.count} ${
                          badge.severity === "critical" ? "critical" : "warning"
                        }${badge.count === 1 ? "" : "s"} in ${section.label}`}
                      </span>
                    </span>
                  )}
                </span>
                <span className="sign text-[11.5px] leading-none">
                  {section.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
