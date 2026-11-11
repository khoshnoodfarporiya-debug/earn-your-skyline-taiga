"use client";

import { useEffect, useRef, useState } from "react";
import {
  lastSeenWord,
  localAccountStore,
  nameProblem,
  passcodeProblem,
  signIn,
  type AccountStore,
  type Player,
} from "@/lib/game/account";

/**
 * THE FRONT DOOR
 *
 * The first thing anybody sees. Create a profile, or pick the one that is
 * already here, and the game opens behind it.
 *
 * ------------------------------------------------------------- honesty
 *
 * This screen says, in plain words, that the profile lives in this browser
 * and that the passcode is not protecting anything valuable. That sentence is
 * not decoration — a sign-in page that implies more security than it has is
 * how people end up typing a password they use elsewhere into a game. The
 * copy exists to stop that, and it should not be quietly removed to make the
 * page look more professional.
 *
 * ------------------------------------------------------------- the seam
 *
 * Everything here goes through `AccountStore`, and `store` is a prop with a
 * default. Swapping the local store for a Neon-backed one is a one-line
 * change at the call site; this file does not know or care where accounts
 * live, which is exactly what "local now, Neon later" has to mean to be worth
 * saying.
 */
export function AccountGate({
  onSignedIn,
  store = localAccountStore,
}: {
  onSignedIn: (player: Player) => void;
  store?: AccountStore;
}) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [mode, setMode] = useState<"choose" | "create">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [unlocking, setUnlocking] = useState<Player | null>(null);
  const [unlockCode, setUnlockCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    store.list().then((list) => {
      if (!alive) return;
      setPlayers(list);
      /* Somebody who has played before should land on their own name, not on
         an empty form asking them to sign up again. */
      setMode(list.length > 0 ? "choose" : "create");
    });
    return () => {
      alive = false;
    };
  }, [store]);

  /* The first paint is deliberately blank rather than a flash of the wrong
     screen — the profile list is only knowable client-side. */
  if (players === null) return <div className="min-h-screen bg-void" />;

  const enter = async (player: Player) => {
    await store.touch(player.id);
    signIn(player.id);
    onSignedIn(player);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const bad = nameProblem(name, players) ?? passcodeProblem(code);
    if (bad) {
      setError(bad);
      return;
    }
    setBusy(true);
    try {
      const player = await store.create(name, code || undefined);
      await enter(player);
    } finally {
      setBusy(false);
    }
  };

  const submitUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlocking || busy) return;
    setBusy(true);
    try {
      const ok = await store.verify(unlocking.id, unlockCode);
      if (!ok) {
        setError("That is not the passcode for this profile.");
        return;
      }
      await enter(unlocking);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-4 py-10">
      <div className="w-full max-w-md">
        {/* ------------------------------------------------------ the name */}
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Earn Your Skyline
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Seven careers, each with a different way of going wrong. Take a
            name and pick one.
          </p>
        </header>

        <div className="mt-6 rounded-lg border border-rule bg-card p-5">
          {/* --------------------------------------------------- unlocking */}
          {unlocking ? (
            <form onSubmit={submitUnlock}>
              <h2 className="text-sm font-semibold text-ink">
                Welcome back, {unlocking.name}
              </h2>
              <p className="mt-1 text-xs text-ink-faint">
                This profile has a passcode on it.
              </p>
              <label className="mt-4 block">
                <span className="sign text-[10.5px] text-ink-faint">
                  Passcode
                </span>
                <input
                  autoFocus
                  type="password"
                  value={unlockCode}
                  onChange={(e) => {
                    setUnlockCode(e.target.value);
                    setError(null);
                  }}
                  className="mt-1 min-h-[44px] w-full rounded-form border border-rule bg-paper px-3 text-[14px] text-ink outline-none focus:border-clinical"
                />
              </label>
              {error && (
                <p role="alert" className="mt-2 text-xs text-alarm">
                  {error}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] flex-1 rounded-form bg-clinical px-4 text-[14px] font-bold text-on-accent transition hover:brightness-110 disabled:opacity-50"
                >
                  Play
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUnlocking(null);
                    setUnlockCode("");
                    setError(null);
                  }}
                  className="min-h-[44px] rounded-form border border-rule px-4 text-[14px] text-ink-soft transition hover:text-ink"
                >
                  Back
                </button>
              </div>
            </form>
          ) : mode === "choose" ? (
            /* ------------------------------------------------ choosing */
            <>
              <h2 className="text-sm font-semibold text-ink">
                Who is playing?
              </h2>
              <ul className="mt-3 space-y-1.5">
                {players.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        if (p.lock) setUnlocking(p);
                        else void enter(p);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-form border border-rule bg-paper px-3 py-3 text-left transition hover:border-clinical"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-ink">
                          {p.name}
                        </span>
                        <span className="block text-[11.5px] text-ink-faint">
                          {lastSeenWord(p)}
                          {p.lock ? " · passcode" : ""}
                        </span>
                      </span>
                      <span aria-hidden className="text-ink-faint">
                        →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setMode("create");
                  setError(null);
                  setTimeout(() => nameRef.current?.focus(), 0);
                }}
                className="mt-3 w-full rounded-form border border-dashed border-rule px-3 py-2.5 text-[13px] text-ink-soft transition hover:border-clinical hover:text-clinical"
              >
                Create another account
              </button>
            </>
          ) : (
            /* ------------------------------------------------- creating */
            <form onSubmit={submitCreate}>
              <h2 className="text-sm font-semibold text-ink">
                Create your account
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-faint">
                Your runs are saved under this name so more than one person can
                play on this computer without treading on each other.
              </p>

              <label className="mt-4 block">
                <span className="sign text-[10.5px] text-ink-faint">Name</span>
                <input
                  ref={nameRef}
                  autoFocus
                  value={name}
                  maxLength={24}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  placeholder="What should the game call you?"
                  className="mt-1 min-h-[44px] w-full rounded-form border border-rule bg-paper px-3 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-clinical"
                />
              </label>

              <label className="mt-3 block">
                <span className="sign text-[10.5px] text-ink-faint">
                  Passcode — optional
                </span>
                <input
                  type="password"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError(null);
                  }}
                  placeholder="Leave empty for no passcode"
                  className="mt-1 min-h-[44px] w-full rounded-form border border-rule bg-paper px-3 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-clinical"
                />
              </label>

              {error && (
                <p role="alert" className="mt-2 text-xs text-alarm">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-4 min-h-[46px] w-full rounded-form bg-clinical px-4 text-[14px] font-bold text-on-accent transition hover:brightness-110 disabled:opacity-50"
              >
                Create account and play
              </button>

              {players.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("choose");
                    setError(null);
                  }}
                  className="mt-2 w-full rounded-form px-3 py-2 text-[13px] text-ink-soft transition hover:text-ink"
                >
                  Back to the list
                </button>
              )}
            </form>
          )}
        </div>

        {/*
          The sentence that keeps this screen honest. See the note at the top
          of the file before shortening it.
        */}
        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-ink-faint">
          This account lives in this browser and nowhere else — there is no
          server and nothing is sent anywhere. The passcode keeps a housemate
          out of your save; it is not protecting anything valuable, so please
          do not reuse a password from somewhere that matters.
        </p>
      </div>
    </main>
  );
}
