"use client";

/**
 * THE CRASH IS NOT ALLOWED TO EAT THE SAVE
 *
 * Before this file existed, a render error anywhere in the tree fell through
 * to Next's default overlay — a stack trace in development and a blank
 * apology in production, with the player's ten-hour firm sitting one
 * `localStorage.clear()` away from gone and no way to get it out.
 *
 * This boundary makes the failure survivable in the order that matters:
 *
 *   1. the save can be DOWNLOADED, before anything else is attempted
 *   2. the render can be retried, because most crashes are transient state
 *   3. nothing here imports game code — the simulation being broken is the
 *      reason this screen is showing, so this screen depends on none of it
 *
 * The export is a raw dump of every `career-tycoon:` key, every player scope
 * included. Raw on purpose: a backup taken at the moment of a crash must not
 * pass through the validators, because the validators rejecting the state may
 * be the crash.
 */

import { useCallback } from "react";

const STAMP = () => new Date().toISOString().slice(0, 10);

function collectSaves(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("career-tycoon")) {
        out[key] = window.localStorage.getItem(key) ?? "";
      }
    }
  } catch {
    /* Storage denied — the download will say so by being empty. */
  }
  return out;
}

function downloadSaves() {
  const saves = collectSaves();
  const blob = new Blob(
    [
      JSON.stringify(
        { game: "earn-your-skyline", exported: new Date().toISOString(), saves },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `earn-your-skyline-backup-${STAMP()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* Inline styles, not classes: this screen must render correctly even when
   the stylesheet pipeline is part of what broke. */
const S = {
  wrap: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    background: "#08111f",
    color: "#e6edf6",
    fontFamily:
      "'Barlow', system-ui, -apple-system, 'Segoe UI', sans-serif",
    padding: "24px",
  },
  card: {
    maxWidth: "26rem",
    width: "100%",
    background: "#0d192a",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: "14px",
    padding: "28px",
  },
  kicker: {
    fontSize: "11px",
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "#7d8da3",
    marginBottom: "10px",
  },
  h1: {
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: 1.2,
    margin: "0 0 10px",
  },
  p: { fontSize: "14px", lineHeight: 1.55, color: "#aebacb", margin: "0 0 20px" },
  primary: {
    display: "block",
    width: "100%",
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1px solid rgba(45,212,191,0.35)",
    background: "rgba(45,212,191,0.12)",
    color: "#5eead4",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: "10px",
  },
  secondary: {
    display: "block",
    width: "100%",
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "transparent",
    color: "#e6edf6",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  fine: { fontSize: "12px", color: "#7d8da3", marginTop: "16px", lineHeight: 1.5 },
};

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const backup = useCallback(downloadSaves, []);
  return (
    <main style={S.wrap}>
      <section style={S.card} role="alert">
        <p style={S.kicker}>Something broke — your city didn&apos;t</p>
        <h1 style={S.h1}>The game hit an error it couldn&apos;t recover from</h1>
        <p style={S.p}>
          Your progress is stored on this device and this screen has not
          touched it. Download a backup first, then try again — most of the
          time the game picks up exactly where it stopped.
        </p>
        <button type="button" style={S.primary} onClick={backup}>
          Download a backup of your saves
        </button>
        <button type="button" style={S.secondary} onClick={reset}>
          Try again
        </button>
        <p style={S.fine}>
          If it keeps happening, keep the backup file
          {error.digest ? ` and quote the code ${error.digest}` : ""}.
        </p>
      </section>
    </main>
  );
}
