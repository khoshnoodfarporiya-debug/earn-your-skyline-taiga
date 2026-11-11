import { adoptLegacySave, setSaveScope } from "./save";

/**
 * ACCOUNTS
 *
 * The sign-in page's model. Read this before changing anything here, because
 * the honest description of what this is matters more than the code:
 *
 * ---------------------------------------------------- what this is, exactly
 *
 * A **local profile**, not authentication. Everything lives in this browser.
 * It exists to do three real jobs:
 *
 *   1. Give a run an owner, so two people sharing a machine get two separate
 *      games instead of overwriting each other's save.
 *   2. Give the game a name to use.
 *   3. Put a deliberate front door on the app.
 *
 * It is NOT a security boundary. Anyone with the browser can open devtools
 * and remove it, and that is fine — there is nothing behind it worth
 * attacking, and pretending otherwise would be the actual mistake. The
 * sign-in screen says so in as many words, because a lock that overstates
 * itself teaches the wrong habit.
 *
 * The optional passcode is stored as a **salted SHA-256 digest**, never as
 * text. That is not because it defends against a determined person — it does
 * not — but because writing somebody's chosen secret into localStorage in the
 * clear would be indefensible even for a game, and people reuse passcodes.
 * The screen tells them not to.
 *
 * ------------------------------------------------------------- the seam
 *
 * `AccountStore` is the only thing the UI talks to, and every method is
 * `async` even though the local one resolves immediately. That is the whole
 * point: a Neon-backed store implements the same interface with network
 * calls, and not one line of `AccountGate` has to change. The local store is
 * the first implementation, not the only possible one.
 */

export interface Player {
  id: string;
  name: string;
  createdAt: number;
  lastSeenAt: number;
  /** Absent when the profile has no passcode. */
  lock?: { salt: string; hash: string };
}

/** What a sign-in screen needs from wherever the accounts actually live. */
export interface AccountStore {
  list(): Promise<Player[]>;
  create(name: string, passcode?: string): Promise<Player>;
  /** True when the passcode matches, or the profile has no passcode. */
  verify(id: string, passcode: string): Promise<boolean>;
  /** Mark a profile as used, for ordering and for "last played". */
  touch(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export const PLAYERS_KEY = "career-tycoon:players:v1";
export const ACTIVE_KEY = "career-tycoon:activePlayer:v1";

export const NAME_MIN = 2;
export const NAME_MAX = 24;

/**
 * Why a name is not allowed, or null when it is fine.
 *
 * Returned as a sentence rather than a boolean so the form can say the same
 * thing the validator decided, instead of inventing its own wording.
 */
export function nameProblem(
  name: string,
  taken: readonly Player[] = [],
): string | null {
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN) {
    return `A name needs at least ${NAME_MIN} characters.`;
  }
  if (trimmed.length > NAME_MAX) {
    return `${NAME_MAX} characters is the limit.`;
  }
  if (!/^[\p{L}\p{N} '._-]+$/u.test(trimmed)) {
    return "Letters, numbers, spaces and - . _ ' only.";
  }
  if (taken.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    return "There is already somebody with that name on this device.";
  }
  return null;
}

export function passcodeProblem(code: string): string | null {
  if (code.length === 0) return null;
  if (code.length < 4) return "A passcode needs at least 4 characters.";
  if (code.length > 64) return "That is longer than a passcode needs to be.";
  return null;
}

/* ------------------------------------------------------------- the digest */

const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/** A random salt, so two people choosing the same passcode do not collide. */
function newSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

/**
 * SHA-256 over salt + code.
 *
 * Web Crypto, so there is no dependency and it is the same call in the
 * browser and in Node. Not a password KDF — see the note at the top about
 * what this is and is not defending.
 */
export async function digest(salt: string, code: string): Promise<string> {
  const bits = await crypto.subtle.digest("SHA-256", enc.encode(salt + code));
  return toHex(bits);
}

export function newId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

/* ------------------------------------------------- the local implementation */

function readPlayers(): Player[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PLAYERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    /* A malformed entry is dropped rather than crashing the front door. */
    return parsed.filter(
      (p): p is Player =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as Player).id === "string" &&
        typeof (p as Player).name === "string",
    );
  } catch {
    return [];
  }
}

function writePlayers(players: Player[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
  } catch {
    /* Storage disabled. The session still works; it just will not persist. */
  }
}

export const localAccountStore: AccountStore = {
  async list() {
    return readPlayers().sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  },

  async create(name, passcode) {
    const players = readPlayers();
    const now = Date.now();
    const player: Player = {
      id: newId(),
      name: name.trim(),
      createdAt: now,
      lastSeenAt: now,
    };
    if (passcode && passcode.length > 0) {
      const salt = newSalt();
      player.lock = { salt, hash: await digest(salt, passcode) };
    }
    writePlayers([...players, player]);
    /*
     * The first account adopts whatever run was already in this browser, so
     * the day this screen appears nobody loses a ninety-week game to it.
     */
    if (players.length === 0) adoptLegacySave(player.id);
    return player;
  },

  async verify(id, passcode) {
    const player = readPlayers().find((p) => p.id === id);
    if (!player) return false;
    if (!player.lock) return true;
    return (await digest(player.lock.salt, passcode)) === player.lock.hash;
  },

  async touch(id) {
    const players = readPlayers();
    const player = players.find((p) => p.id === id);
    if (!player) return;
    player.lastSeenAt = Date.now();
    writePlayers(players);
  },

  async remove(id) {
    writePlayers(readPlayers().filter((p) => p.id !== id));
    if (typeof window === "undefined") return;
    try {
      /* Take the profile's saves with it, or they are orphaned bytes. */
      const doomed: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(`career-tycoon:p.${id}:`)) doomed.push(k);
      }
      for (const k of doomed) window.localStorage.removeItem(k);
      if (window.localStorage.getItem(ACTIVE_KEY) === id) {
        window.localStorage.removeItem(ACTIVE_KEY);
      }
    } catch {
      /* nothing to do */
    }
  },
};

/* ------------------------------------------------------------ the session */

/** Who is signed in on this device, if anybody. */
export function readActive(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

/**
 * Sign in.
 *
 * Points the save layer at this player before anything reads a run, which is
 * the ordering that matters: load the game first and you load somebody else's.
 */
export function signIn(id: string): void {
  setSaveScope(id);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* The scope is set in memory either way, so the session still works. */
  }
}

export function signOut(): void {
  setSaveScope(null);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* nothing to do */
  }
}

/** How long ago, in words, for the profile list. */
export function lastSeenWord(player: Player): string {
  const days = Math.floor((Date.now() - player.lastSeenAt) / 86_400_000);
  if (days <= 0) return "Played today";
  if (days === 1) return "Played yesterday";
  if (days < 30) return `Played ${days} days ago`;
  const months = Math.floor(days / 30);
  return `Played ${months} month${months === 1 ? "" : "s"} ago`;
}
