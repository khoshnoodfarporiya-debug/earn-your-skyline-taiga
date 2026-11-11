import type { ReactNode } from "react";
import Image from "next/image";
import { money } from "@/lib/game/format";
import type { Visual } from "@/lib/ui/visuals";
import { type Tone, TONE_TEXT } from "./Panel";

/**
 * THE THING YOU CAN BUY
 *
 * Premises, departments, equipment, staff, supplies, qualifications, houses,
 * cars — mechanically different, visually the same decision every time: what
 * is it, what does it do, what does it cost, can I afford it, do I own it.
 *
 * That shape was written out five times with five different treatments. Prices
 * were 13px in one screen and 14px in another; effects were pills in Life,
 * mono footnotes in Practice and bulleted lines in Career; and Practice made
 * the entire card a <button>, which gives a screen reader an accessible name
 * that is three sentences long.
 *
 * Two decisions worth stating, because they are the ones that change how the
 * screens read:
 *
 * 1. **The price is the biggest thing in the card.** It is what the player is
 *    actually deciding about. It used to be small grey text competing with the
 *    title for the same baseline.
 *
 * 2. **Out of reach is not disabled.** Every unaffordable item was rendered at
 *    60% opacity, which reads as broken rather than as something to save
 *    toward — and the whole point of the mid-game is choosing what to save
 *    toward. The card stays fully legible; only the action dims, and the gap
 *    is stated in cash.
 */

export interface ItemChip {
  text: string;
  tone?: Tone;
}

export function Chip({ text, tone = "neutral" }: ItemChip) {
  const skin =
    tone === "accent"
      ? "bg-clinical-tint text-clinical"
      : tone === "good"
        ? "bg-good-tint text-good"
        : tone === "caution"
          ? "bg-caution-tint text-caution"
          : tone === "alarm"
            ? "bg-alarm-tint text-alarm"
            : "bg-paper text-ink-soft";
  return (
    <li className={`num rounded-sm px-1.5 py-0.5 text-[12px] ${skin}`}>
      {text}
    </li>
  );
}

export function ChipRow({ chips }: { chips: ItemChip[] }) {
  if (chips.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <Chip key={c.text} {...c} />
      ))}
    </ul>
  );
}

export function ItemCard({
  title,
  suffix,
  blurb,
  price,
  owned,
  ownedLabel = "Owned",
  affordable,
  cash,
  accent,
  chips = [],
  details = [],
  consequence,
  footnote,
  blocker,
  visual,
  children,
}: {
  title: string;
  /** Post-nominals, counts — anything that qualifies the name inline. */
  suffix?: ReactNode;
  blurb?: string;
  /** Omit for things that are not bought with cash. */
  price?: number;
  owned?: boolean;
  ownedLabel?: string;
  affordable?: boolean;
  /** Used to say how far short you are, which a bare price cannot. */
  cash?: number;
  /** Left spine colour — the specialty this belongs to, if any. */
  accent?: string;
  chips?: ItemChip[];
  /**
   * Sentence-length effects, which a chip cannot carry. A chip is a token —
   * "+34 slots", "40 CPD" — and putting "Treat severity 3 yourself in the
   * chosen department" in one produces a wall of boxes that is harder to read
   * than the plain list it replaced.
   */
  details?: string[];
  /**
   * The same three questions about every purchase, in the same order:
   * what it costs you the moment you buy it, what it does for you from then
   * on, and what could go wrong.
   *
   * Separated from `details` because they are not interchangeable. A details
   * list is a bag of facts in whatever order the panel happened to build it;
   * a player comparing two machines wants the recurring cost of one next to
   * the recurring cost of the other, and reading two unordered bullet lists
   * to find them is the work this removes.
   *
   * Every field is optional and an absent one renders nothing — a thing with
   * no ongoing cost should say nothing rather than "no ongoing cost".
   */
  consequence?: {
    /** Paid once, on purchase. Time blocks, an upfront fee beyond the price. */
    now?: string;
    /** Every week afterwards, for as long as you keep it. */
    later?: string;
    /** What it exposes you to. Rendered in the caution colour *and* labelled. */
    risk?: string;
  };
  footnote?: ReactNode;
  /** Why this cannot be bought yet, in the player's words. */
  blocker?: ReactNode;
  /** Optional catalogue artwork. The text below remains the source of truth. */
  visual?: Visual;
  /** The action(s). Kept outside the card body so the card is not a button. */
  children?: ReactNode;
}) {
  const short =
    price !== undefined && cash !== undefined && !owned && cash < price
      ? price - cash
      : 0;

  return (
    /*
     * An <article>, not a bare div: each of these is a self-contained thing to
     * evaluate, and the role lets a screen reader move card to card instead of
     * walking every price and chip in sequence. It also replaces the wrapping
     * <button> that Practice used, whose accessible name was the whole card.
     */
    <article
      aria-label={title}
      className={`spine px-4 py-3.5 ${owned ? "bg-card-high" : "bg-card"}`}
      style={{
        ["--dept" as string]: owned ? "rgb(var(--accent))" : (accent ?? "transparent"),
      }}
    >
      {visual ? (
        <div className="relative -mx-4 -mt-3.5 mb-3 aspect-[5/1] overflow-hidden border-b border-rule-soft bg-paper">
          <Image
            src={visual.src}
            alt=""
            fill
            sizes="(min-width: 1024px) 720px, 100vw"
            className="object-cover opacity-90"
            style={{ objectPosition: visual.focus }}
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-card/70 via-transparent to-transparent"
          />
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="t-card text-ink">
            {title}
            {suffix ? <span className="ml-2 font-normal">{suffix}</span> : null}
          </h4>
          {blurb ? (
            /* Capped, because the premises list is full-width: an unconstrained
               blurb runs a thousand pixels on a desktop and the eye loses the
               line. */
            <p className="mt-0.5 max-w-[62ch] text-[12.5px] leading-snug text-ink-soft">
              {blurb}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          {owned ? (
            <span className="sign text-[11.5px] text-clinical">
              {ownedLabel}
            </span>
          ) : price !== undefined ? (
            <>
              <p
                className={`num text-[15px] font-semibold leading-none ${
                  affordable === false ? "text-ink-faint" : "text-ink"
                }`}
              >
                {money(price)}
              </p>
              {short > 0 ? (
                <p className="num mt-1 text-[11.5px] text-caution">
                  {money(short)} short
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <ChipRow chips={chips} />

      {details.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {details.map((d) => (
            <li
              key={d}
              className="num flex gap-2 text-[12.5px] leading-snug text-ink-soft"
            >
              <span aria-hidden className="text-clinical">
                ·
              </span>
              {d}
            </li>
          ))}
        </ul>
      ) : null}

      {consequence &&
      (consequence.now || consequence.later || consequence.risk) ? (
        /* A description list, so the label is programmatically tied to the
           value rather than merely sitting next to it. */
        <dl className="mt-2.5 space-y-1 border-t border-rule-soft pt-2">
          {consequence.now ? (
            <ConsequenceRow label="Now" text={consequence.now} />
          ) : null}
          {consequence.later ? (
            <ConsequenceRow label="Every week" text={consequence.later} />
          ) : null}
          {consequence.risk ? (
            <ConsequenceRow label="Risk" text={consequence.risk} caution />
          ) : null}
        </dl>
      ) : null}

      {footnote ? (
        <p className="num mt-2 text-[11.5px] text-ink-faint">{footnote}</p>
      ) : null}

      {children ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {children}
        </div>
      ) : null}

      {blocker ? (
        <p className="num mt-2 text-[11.5px] text-caution">{blocker}</p>
      ) : null}
    </article>
  );
}

/**
 * One line of the Now / Every week / Risk block.
 *
 * The label is a word, not a colour or an icon: "Risk" in caution orange still
 * says "Risk" on a monochrome display, to a colour-blind player, and to a
 * screen reader that never sees the orange at all.
 */
function ConsequenceRow({
  label,
  text,
  caution,
}: {
  label: string;
  text: string;
  caution?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt
        className={`t-label w-[68px] shrink-0 ${
          caution ? "text-caution" : "text-ink-faint"
        }`}
      >
        {label}
      </dt>
      <dd
        className={`text-[12.5px] leading-snug ${
          caution ? "text-caution" : "text-ink-soft"
        }`}
      >
        {text}
      </dd>
    </div>
  );
}

/**
 * The one button style every purchase uses.
 *
 * `primary` is the affordable buy, `quiet` is a sell or a toggle, and a
 * disabled button keeps its label rather than vanishing — a control that
 * disappears when you cannot afford it makes the screen change shape as your
 * cash moves, which is exactly when the player is trying to compare things.
 */
export function ActionButton({
  onClick,
  disabled,
  variant = "primary",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "quiet" | "danger";
  children: ReactNode;
}) {
  const skin =
    variant === "primary"
      ? "bg-clinical text-on-accent hover:bg-clinical-hover disabled:bg-paper disabled:text-ink-faint"
      : variant === "danger"
        ? "bg-paper text-ink-soft hover:text-alarm disabled:text-ink-faint"
        : "bg-card-high text-ink-soft hover:text-ink disabled:text-ink-faint";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[44px] rounded-form px-4 text-[13px] font-semibold transition disabled:cursor-not-allowed ${skin}`}
    >
      {children}
    </button>
  );
}

export { TONE_TEXT };
