/**
 * VALIDATION PRIMITIVES
 *
 * Shared by the root save validator and by each career's own validator. They
 * are deliberately dull: every one answers a single yes/no question about a
 * value of unknown type, and none of them repairs anything.
 *
 * Three kinds of question matter, and all three have bitten this project:
 *
 *   - shape:      the field exists and is the right type
 *   - finiteness: numbers are real numbers, because a NaN spreads silently
 *                 through an economy and surfaces as a blank screen
 *   - catalogue:  identifiers still name something. This is the class that can
 *                 be structurally perfect and still fatal, since a stale id
 *                 resolves to `undefined` at every lookup.
 */

export const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export const isInt = (v: unknown): v is number =>
  isFiniteNumber(v) && Number.isInteger(v);

export const isStr = (v: unknown): v is string => typeof v === "string";

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Every listed field of a record is a finite number. */
export const numbers = (o: unknown, fields: string[]): boolean =>
  isObj(o) && fields.every((f) => isFiniteNumber(o[f]));

/** Every value of a record is a finite number. Keys are unconstrained. */
export const numberMap = (o: unknown): boolean =>
  isObj(o) && Object.values(o).every(isFiniteNumber);

/** An array whose every entry satisfies the guard. */
export const every = (
  v: unknown,
  guard: (x: unknown) => boolean,
): v is unknown[] => Array.isArray(v) && v.every(guard);

/** A string that names something in a catalogue. */
export const inCatalogue = (
  v: unknown,
  cat: { has: (k: never) => boolean },
): boolean => isStr(v) && cat.has(v as never);

/** A string drawn from a fixed set. */
export const oneOf = (v: unknown, allowed: readonly string[]): boolean =>
  isStr(v) && allowed.includes(v);
