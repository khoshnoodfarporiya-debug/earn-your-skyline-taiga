import { defineConfig, devices } from "@playwright/test";

/**
 * Browser regression coverage.
 *
 * Deliberately small: one browser, one viewport pair, and only the things that
 * cannot be asserted in `npm run check` — scroll position, focus movement,
 * layout shift, console output. Everything about the simulation is tested far
 * more cheaply in the Node suite and does not belong here.
 *
 * The dev server is reused if one is already up, so running this alongside a
 * preview does not fight for port 3500.
 *
 * ------------------------------------------------------------- on the workers
 *
 * This ran on a single worker with `fullyParallel` off, so 204 tests went one
 * at a time and the suite took six and a half minutes — almost all of it spent
 * waiting on a browser rather than doing anything. Nothing here needs the
 * serialisation: every test seeds its own save into its own browser context,
 * and localStorage does not cross a context boundary, so there is no shared
 * state for one test to leave behind for another.
 *
 * ------------------------------------------------------------ on the flake
 *
 * A four-worker run once produced six timeouts, and the same flows passed on a
 * single-worker rerun. The obvious reading — too much parallelism — turned out
 * to be wrong, and it took reproducing the failure to see why.
 *
 * `npm run build` wipes `.next/dev/cache/images`, so the e2e run that follows
 * it transcodes every one of the 45 purchase images from scratch. Cold, the
 * artwork tests failed on ONE worker exactly as readily as on four; the
 * single-worker reruns that "fixed" it were simply running against a cache the
 * failed run had just populated. Parallelism was never the variable.
 *
 * What actually failed was a ten-second assertion inside the suite's own
 * `scrollThrough` helper, sized for a warm cache. That is fixed where it lives
 * (see `imagesSettled` and `undecodedArt` in the spec) rather than by widening
 * this timeout.
 *
 * Two workers rather than four is kept as margin, not as the fix: the ceiling
 * is one dev server, not the machine's sixteen cores, and the measured cost
 * against four is small.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 2,
  reporter: [["list"]],
  timeout: 45_000,
  use: {
    baseURL: "http://localhost:3500",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
      /*
       * Eight tests drive `setViewportSize` themselves — several sweeping
       * 375/390/768/1024/1440 inside a single body — so the project's viewport
       * is overwritten before their first assertion. Running them under both
       * projects executed the identical widths twice and proved it twice.
       *
       * They still run, in full, under `mobile`. This drops the duplicate, not
       * the coverage: no width and no assertion is lost, and any test that
       * actually depends on the project viewport is untagged and still runs on
       * both.
       */
      grepInvert: /@sets-own-viewport/,
    },
  ],
  webServer: {
    /*
     * The Next binary directly, not `npm run dev`. On Windows the npm script
     * runs behind a `cmd.exe` wrapper, and at teardown Playwright kills the
     * wrapper it spawned while the actual `next dev` node process survives as
     * an orphan still holding port 3500 — the run then hangs at exit waiting
     * for a server that will never die. When the process Playwright owns IS
     * the server, the tree kill reaches it.
     */
    command: "node node_modules/next/dist/bin/next dev -p 3500",
    url: "http://localhost:3500",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
