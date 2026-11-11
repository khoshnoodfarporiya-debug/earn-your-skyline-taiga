import { every, isInt, isObj, isStr, numbers, oneOf } from "../validate";

/**
 * ONE PHONE VALIDATOR, FOR ALL SEVEN CAREERS
 *
 * Before this existed there were three levels of rigour in the codebase and
 * one of them was zero: the Physician's validator checked its phone inline,
 * the Chef and Solicitor did a shape sketch of theirs, and the four
 * pack-driven careers did not look at the phone at all. A save with a
 * malformed feed, a choice that was any object, or `answered: 99` on a
 * two-choice message passed every one of them — and that last one is not a
 * wrong number, it is a crash the moment the thread renders.
 *
 * The phone is one shape everywhere (that is the whole point of the shared
 * shell), so it gets one validator. Every claim the handset's UI relies on is
 * enforced here:
 *
 *   - the three metrics exist and are finite
 *   - every feed post, message and news item has the fields its row renders
 *   - a message's choices, when present, are real choices — label, detail,
 *     reply, effect — not just "some object"
 *   - `answered`, when present, indexes into those choices
 *
 * Careers whose phone is optional call this only when the field is present;
 * absence stays legal, because a save from before that career had a handset
 * must keep loading.
 */

const TONES = ["good", "bad", "neutral"] as const;
const MESSAGE_ROLES = [
  "staff",
  "recruiter",
  "journalist",
  "regulator",
  "rival",
  "peer",
] as const;

/** One choice on a message: the exact shape `MessagesApp` renders. */
function isChoice(c: unknown): boolean {
  return (
    isObj(c) &&
    isStr(c.label) &&
    isStr(c.detail) &&
    isStr(c.reply) &&
    isObj(c.effect)
  );
}

export function validatePhone(phone: unknown): boolean {
  if (!isObj(phone)) return false;

  if (!numbers(phone.social, ["followers", "trust", "sentiment", "scrutiny"])) {
    return false;
  }
  if (!isInt(phone.lastPostWeek) || phone.lastPostWeek < 0) return false;
  if (!numbers(phone, ["recruitBoost"])) return false;
  if (!every(phone.postsMade, isStr)) return false;

  if (
    !every(
      phone.feed,
      (p) =>
        isObj(p) &&
        isStr(p.id) &&
        isInt(p.week) &&
        isStr(p.author) &&
        isStr(p.handle) &&
        isStr(p.body) &&
        oneOf(p.kind, ["player", "world"]) &&
        numbers(p, ["likes"]) &&
        oneOf(p.tone, TONES) &&
        every(
          p.comments,
          (c) => isObj(c) && isStr(c.author) && isStr(c.handle) && isStr(c.body),
        ),
    )
  ) {
    return false;
  }

  if (
    !every(
      phone.messages,
      (x) =>
        isObj(x) &&
        isStr(x.id) &&
        isInt(x.week) &&
        isStr(x.from) &&
        isStr(x.handle) &&
        isStr(x.body) &&
        oneOf(x.role, MESSAGE_ROLES) &&
        typeof x.read === "boolean" &&
        (x.choices === undefined || every(x.choices, isChoice)) &&
        /*
         * The bound that was missing everywhere. An `answered` outside the
         * choices it answers is not a stale value, it is a crash in the
         * thread view — so it is rejected here rather than survived there.
         * (The render also guards, because a validator and a component
         * disagreeing about who is responsible is how both end up wrong.)
         */
        (x.answered === undefined ||
          (isInt(x.answered) &&
            Array.isArray(x.choices) &&
            x.answered >= 0 &&
            x.answered < x.choices.length)),
    )
  ) {
    return false;
  }

  if (
    !every(
      phone.news,
      (n) =>
        isObj(n) &&
        isStr(n.id) &&
        isInt(n.week) &&
        isStr(n.outlet) &&
        isStr(n.headline) &&
        isStr(n.body) &&
        oneOf(n.tone, TONES) &&
        typeof n.read === "boolean",
    )
  ) {
    return false;
  }

  return true;
}
