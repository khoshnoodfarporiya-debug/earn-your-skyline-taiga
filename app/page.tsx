"use client";

import { useEffect, useState } from "react";
import type { RunState } from "@/lib/game/types";
import { getCareer } from "@/lib/game/careers";
import { startRun } from "@/lib/game/engine";
import { clearRun, loadRun, saveRun } from "@/lib/game/save";
import { CareerSelect } from "@/components/CareerSelect";
import { Game } from "@/components/Game";
import { AccountGate } from "@/components/AccountGate";
import {
  localAccountStore,
  readActive,
  signIn,
  signOut,
  type Player,
} from "@/lib/game/account";

export default function Page() {
  const [run, setRun] = useState<RunState | null>(null);
  const [savedRun, setSavedRun] = useState<RunState | null>(null);
  const [ready, setReady] = useState(false);
  /* Who is playing. Null means the front door. */
  const [playerId, setPlayerId] = useState<string | null>(null);
  /* The name, so the game can greet whoever is playing. */
  const [playerName, setPlayerName] = useState<string>("");

  /*
   * ORDER MATTERS HERE.
   *
   * The save scope has to be pointed at the signed-in player *before*
   * anything reads a run, or the first load hands them somebody else's game.
   * So this effect signs in first and only then looks for a save.
   */
  useEffect(() => {
    const active = readActive();
    if (!active) {
      setReady(true);
      return;
    }
    /*
     * The stored id is a claim, not a fact: the profile behind it can be gone
     * while the pointer survives (a cleared players list, a hand-edited
     * store). Trusting it blindly opened a scoped game with a blank identity
     * and no matching profile — so the profile is confirmed to exist BEFORE
     * anything signs in or reads a save, and a stale pointer is cleaned up
     * and sent back to the front door instead.
     */
    let alive = true;
    void localAccountStore.list().then((all) => {
      if (!alive) return;
      const player = all.find((x) => x.id === active);
      if (player) {
        /* Sign in first, then read: the scope must point at this player
           before anything loads a run, or it loads somebody else's. */
        signIn(active);
        setPlayerId(active);
        setPlayerName(player.name);
        setSavedRun(loadRun());
      } else {
        signOut();
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const onSignedIn = (player: Player) => {
    setPlayerId(player.id);
    setPlayerName(player.name);
    /* `signIn` has already set the scope, so this reads the right save —
       including a run adopted from before accounts existed. */
    setSavedRun(loadRun());
  };

  const update = (next: RunState) => {
    setRun(next);
    saveRun(next);
  };

  /*
   * `city` is where the run begins, for a career that offers a choice. It is
   * passed straight through to `startRun`, which resolves an unknown id to
   * the career's default rather than starting a run half-placed.
   */
  const begin = (careerId: string, city?: string) => {
    const career = getCareer(careerId);
    if (!career) return;
    const fresh = startRun(career, undefined, { city });
    clearRun();
    update(fresh);
  };

  /*
   * A run whose career no longer exists cannot be rendered. `loadRun` now
   * rejects unknown career ids outright, so this is only reachable if a run
   * held in memory somehow outlives its career — but it must still not blank
   * the screen, and it must not clear storage or set state while rendering.
   *
   * Both of those were happening here before: `clearRun()` and `setRun(null)`
   * ran during render and returned `null`, which is a side effect in the
   * render phase and a blank page for the user. The cleanup is now an effect
   * and the fallback is the career select, which is always something.
   */
  const career = run ? getCareer(run.careerId) : undefined;
  const orphaned = run !== null && career === undefined;

  useEffect(() => {
    if (!orphaned) return;
    clearRun();
    setSavedRun(null);
    setRun(null);
  }, [orphaned]);

  if (!ready) return <div className="min-h-screen" />;

  /* The front door. Nothing behind it renders until somebody is signed in. */
  if (!playerId) return <AccountGate onSignedIn={onSignedIn} />;

  // `!career` rather than `orphaned` so the type narrows here too.
  if (!run || !career) {
    return (
      <CareerSelect
        // An orphaned run must not be offered back to the player.
        hasSave={!orphaned && !!savedRun && !savedRun.outcome}
        onContinue={() => savedRun && setRun(savedRun)}
        onPick={begin}
        playerName={playerName}
        onSignOut={() => {
          signOut();
          setPlayerId(null);
          setPlayerName("");
          setSavedRun(null);
          setRun(null);
        }}
      />
    );
  }

  return (
    <Game
      career={career}
      state={run}
      setState={update}
      /* Same career, same city. A restart is another go at the run you
         chose, not a silent move back to the default market. */
      onRestart={() => begin(career.id, run.startCity)}
      onMenu={() => {
        setSavedRun(run.outcome ? null : run);
        setRun(null);
      }}
    />
  );
}
