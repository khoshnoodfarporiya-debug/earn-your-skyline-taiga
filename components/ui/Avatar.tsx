"use client";

import { useState } from "react";
import Image from "next/image";
import {
  isOrganisation,
  portraitForPerson,
  portraitForSocialHandle,
} from "@/lib/ui/portraits";
import { initialsOf } from "@/lib/game/people";

/**
 * ONE FACE COMPONENT
 *
 * There were two: a private one in `PeoplePanel` keyed on a person id, and
 * another in the phone keyed on a handle. They drew the same circle from the
 * same initials with two different palettes, and only one of them could ever
 * have learned about portraits.
 *
 * ------------------------------------------------------- how identity resolves
 *
 * By **handle first, then person id**, and the order matters. `meridian` is Dr
 * Anneke Roth in the relationship model and Meridian Health Group on the
 * phone; resolving by id would put her face on the group's press releases. So
 * a caller that has a handle passes it, and the handle wins.
 *
 * An organisation resolves to no portrait at all and gets a distinct
 * treatment — a rounded square rather than a circle — because a press office
 * is not a person and should not look like one.
 *
 * ------------------------------------------------------------ the fallback
 *
 * Initials, on a hue derived from the identity, are the guaranteed floor. They
 * are used when there is no portrait, and they are *restored* when an image
 * fails to load: `onError` flips to them rather than leaving the browser's
 * broken-image glyph. That path is the reason the image is not simply a CSS
 * background.
 *
 * ------------------------------------------------------------------- status
 *
 * Someone `gone` is desaturated and dimmed. That is a supplement, never the
 * signal — every surface using this also prints the word "Gone" beside it,
 * because a greyer circle is not a status a player can be expected to read.
 */

export type AvatarShape = "circle" | "rounded";

export function Avatar({
  name,
  personId,
  handle,
  size = 36,
  variant = "avatar",
  you = false,
  gone = false,
  label,
  className = "",
}: {
  /** Used for the initials and, when `label` is set, the accessible name. */
  name: string;
  /** `PersonDef.id`, for People, Rivals, contracts and events. */
  personId?: string;
  /** Exact social handle including the `@`. Wins over `personId`. */
  handle?: string;
  /** Rendered size in CSS pixels. */
  size?: number;
  /** `profile` requests the 512px file — for anything above about 96px. */
  variant?: "avatar" | "profile";
  /** The player's own account. */
  you?: boolean;
  /** Desaturates the portrait. Never the only indication — see the note. */
  gone?: boolean;
  /**
   * Supply only when no identifying text sits beside the avatar. When the
   * name is already on screen this stays undefined and the element is hidden
   * from assistive technology, so a screen reader is not read the name twice.
   */
  label?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const organisation = handle ? isOrganisation(handle) : false;
  const portrait =
    (handle ? portraitForSocialHandle(handle) : null) ??
    (personId && !organisation ? portraitForPerson(personId) : null);

  const shape: AvatarShape = organisation ? "rounded" : "circle";
  const radius = shape === "circle" ? "rounded-full" : "rounded-[22%]";

  const a11y = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const };

  if (portrait && !failed) {
    return (
      <span
        {...a11y}
        className={`relative block shrink-0 overflow-hidden border border-rule ${radius} ${className}`}
        /* Fixed box, always. The image loads into a reserved square so a feed
           of thirty rows does not reflow as the faces arrive. */
        style={{ width: size, height: size }}
      >
        <Image
          src={variant === "profile" ? portrait.profile : portrait.src}
          alt=""
          width={portrait.width}
          height={portrait.height}
          sizes={`${size}px`}
          loading={variant === "profile" ? "eager" : "lazy"}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover ${
            gone ? "opacity-55 grayscale" : ""
          }`}
          style={{ objectPosition: portrait.focus }}
        />
      </span>
    );
  }

  /* ------------------------------------------------------------ initials */
  const key = handle ?? personId ?? name;
  const tint = you ? "rgb(var(--accent))" : TINTS[hashOf(key) % TINTS.length];

  return (
    <span
      {...a11y}
      className={`flex shrink-0 items-center justify-center font-semibold ${radius} ${className}`}
      style={{
        width: size,
        height: size,
        background: `${tint}22`,
        border: `1px solid ${tint}66`,
        color: tint,
        fontSize: Math.max(10, size * 0.36),
        opacity: gone ? 0.6 : 1,
      }}
    >
      {organisation ? orgMark(name) : initialsOf(name)}
    </span>
  );
}

/**
 * An organisation's mark.
 *
 * Same initials logic, but institutions are named in words rather than
 * "Firstname Lastname" — "The Clinical Lede" would otherwise read "TL", which
 * is fine, while "WellWise Daily" would read "WD". Both are correct; the point
 * is only that the *shape* differs, so the reader can tell a masthead from a
 * colleague before reading either.
 */
function orgMark(name: string): string {
  const words = name.replace(/^The\s+/i, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** The same hash the phone and the People screen already used. */
function hashOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

const TINTS = [
  "#4D9DE0",
  "#6FD08C",
  "#C77DFF",
  "#F5A623",
  "#E8825C",
  "#5AA9C7",
  "#F58FC2",
  "#8AA4F0",
];
