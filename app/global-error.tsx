"use client";

/**
 * The boundary above the root layout: it catches what `app/error.tsx`
 * cannot — an error in the layout itself. There is no stylesheet, no font
 * pipeline and no game code alive when this renders, so it carries its own
 * <html> and <body> and repeats the one promise that matters: the save can
 * be downloaded before anything else is attempted. The dump logic is
 * duplicated from `app/error.tsx` deliberately — a shared import would be a
 * shared point of failure, and these two files must never fail together.
 */

function downloadSaves() {
  const saves: Record<string, string> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("career-tycoon")) {
        saves[key] = window.localStorage.getItem(key) ?? "";
      }
    }
  } catch {
    /* Storage denied — the file will say so by being empty. */
  }
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
  a.download = `earn-your-skyline-backup-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#08111f",
          color: "#e6edf6",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: "24px",
        }}
      >
        <section
          role="alert"
          style={{
            maxWidth: "26rem",
            width: "100%",
            background: "#0d192a",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: "14px",
            padding: "28px",
          }}
        >
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 10px" }}>
            The game hit an error it couldn&apos;t recover from
          </h1>
          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.55,
              color: "#aebacb",
              margin: "0 0 20px",
            }}
          >
            Your progress is stored on this device and has not been touched.
            Download a backup, then reload.
          </p>
          <button
            type="button"
            onClick={downloadSaves}
            style={{
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
            }}
          >
            Download a backup of your saves
          </button>
          <button
            type="button"
            onClick={reset}
            style={{
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
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ fontSize: "12px", color: "#7d8da3", marginTop: "16px" }}>
              Error code {error.digest}.
            </p>
          ) : null}
        </section>
      </body>
    </html>
  );
}
