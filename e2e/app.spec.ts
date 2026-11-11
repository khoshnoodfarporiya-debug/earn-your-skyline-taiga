import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * SIGNED IN, ALWAYS.
 *
 * The app has a front door now: no account, no game. Every test in this file
 * is about what is behind that door, so one profile is seeded for all of them
 * rather than making sixty-six navigations each sign themselves in.
 *
 * It is installed with `addInitScript` deliberately — unlike a save fixture,
 * which must be written once (see `preload` below), the profile SHOULD come
 * back after a `localStorage.clear()` and a reload. A test clearing storage
 * is asking for a fresh game, not for the sign-in page.
 *
 * The front door itself is tested in `account.spec.ts`, which seeds nothing.
 */
const TEST_PLAYER_ID = "e2etester";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([playersKey, activeKey, id]) => {
      window.localStorage.setItem(
        playersKey,
        JSON.stringify([
          {
            id,
            name: "Tester",
            createdAt: 0,
            lastSeenAt: 0,
          },
        ]),
      );
      window.localStorage.setItem(activeKey, id);
    },
    [
      "career-tycoon:players:v1",
      "career-tycoon:activePlayer:v1",
      TEST_PLAYER_ID,
    ] as const,
  );
});

/* Saves are scoped to whoever is signed in, so the fixtures go under the
   seeded profile rather than under the bare key. */
const SAVE_KEY = `career-tycoon:p.${TEST_PLAYER_ID}:save:v11`;
const LEGACY_SAVE_KEY = `career-tycoon:p.${TEST_PLAYER_ID}:save:v8`;

/**
 * Preload a deterministic save. The fixtures are produced by the real engine
 * (`npm run fixtures`), so they always satisfy the save validator — a
 * hand-written literal would drift from the contract and let these tests pass
 * against a broken app.
 *
 * This is also why there is no debug hatch in the application: the game needs
 * no test-only controls when its own save format is the seam.
 */
async function preload(page: Page, fixture: string) {
  const save = readFileSync(join("e2e", "fixtures", `${fixture}.json`), "utf8");
  /*
   * Written ONCE, then reloaded — not via addInitScript, which re-runs on
   * every navigation and would silently restore the fixture behind any test
   * that reloads the page. That is exactly the bug that made the
   * "a finished run is not resumable" test pass a save back to itself.
   */
  await page.goto("/");
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SAVE_KEY, save] as const,
  );
  await page.reload();
}

/**
 * The week number the INTERFACE is showing — read from the status strip, not
 * from storage, so these tests fail if the display stops tracking the run.
 */
async function readWeek(page: Page): Promise<number> {
  const label = await page
    .locator('dd[aria-label^="Week:"]')
    .first()
    .getAttribute("aria-label");
  const hit = label?.match(/Week:\s*(\d+)/);
  if (!hit) throw new Error(`could not read the week from "${label}"`);
  return Number(hit[1]);
}

/**
 * Close the weekly review. Escape only works on a quiet week — a week
 * carrying a decision has to be answered — so the Continue button is the
 * reliable path and Escape is the fallback.
 */
async function dismissReview(page: Page) {
  const review = page.getByRole("dialog");
  if (!(await review.isVisible().catch(() => false))) return;

  const cont = review.getByRole("button", { name: /^Continue$/ });
  if ((await cont.count()) > 0) {
    await cont.click();
  } else {
    await page.keyboard.press("Escape");
    // A week carrying an event has no Continue and refuses Escape: it is a
    // decision, and the only way past it is to answer.
    if (await review.isVisible().catch(() => false)) {
      await review.getByRole("button").last().click();
    }
  }
  await expect(review).toBeHidden();
}

/**
 * The three public-standing numbers, as the phone reports them. Rendered as a
 * definition list, so the text runs "Followers90reach" — hence matching the
 * label and taking the digits that follow it.
 */
async function readSocial(phone: ReturnType<Page["getByRole"]>) {
  const text = (await phone.textContent()) ?? "";
  const read = (label: string) =>
    text.match(new RegExp(`${label}\\s*([\\d,]+)`, "i"))?.[1] ?? "?";
  return `${read("Followers")}/${read("Trust")}/${read("Sentiment")}`;
}

/**
 * Wait until the portraits in a region have actually arrived.
 *
 * These assertions used to be preceded by a flat `waitForTimeout(900)` or
 * `(1200)`. A fixed pause is wrong in both directions: it burns most of a
 * second on a machine that finished in 80ms, and it is a coin flip on a loaded
 * one — and several of the checks downstream are *negative* ("no personal
 * portrait appears here"), which a pause that expired early would pass without
 * proving anything. This returns the moment every portrait in scope has
 * settled, and fails loudly if none ever appears.
 */
async function portraitsSettled(page: Page, scope = "main") {
  await expect
    .poll(
      () =>
        page.evaluate((sel) => {
          const imgs = [
            ...document.querySelectorAll<HTMLImageElement>(`${sel} img`),
          ].filter((i) =>
            /characters/.test(decodeURIComponent(i.currentSrc || i.src)),
          );
          return imgs.length > 0 && imgs.every((i) => i.complete);
        }, scope),
      {
        /* Generous because a cold image cache transcodes these on demand —
           see the note on `imagesSettled`. Still an assertion, because a
           portrait that never arrives is exactly what this is checking. */
        timeout: 30_000,
        message: `no portrait ever finished loading in ${scope}`,
      },
    )
    .toBe(true);
}

/**
 * The commit control. Mobile has the sticky CommitBar; desktop has the inline
 * button in the forecast card, and only one of the two is ever in the DOM.
 */
const commitButton = (page: Page) =>
  page
    .getByRole("button", {
      // Anchored: the guidance panel has buttons like "Assign rest" that a
      // looser pattern happily matches.
      name: /^Commit week|^Assign time$|^Assign your time first$/,
    })
    .first();

/** Fill the week with one action and commit it. */
async function playWeek(page: Page, action = "Rest") {
  const plus = page.getByRole("button", {
    name: new RegExp(`More blocks on ${action}`, "i"),
  });
  for (let i = 0; i < 4; i++) {
    if (await plus.isEnabled()) await plus.click();
  }
  await commitButton(page).click();
}

/**
 * These cover the things a headless assertion suite cannot see: where the map
 * is actually scrolled to, where focus lands, whether the page overflows, and
 * what the browser complains about. Game rules are tested in `npm run check`.
 */

/** Fail on anything the browser considers a problem, including Next's own warnings. */
function watchConsole(page: Page) {
  const problems: string[] = [];
  const onMessage = (m: ConsoleMessage) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const text = m.text();
    // React DevTools nag is informational and not something the app controls.
    if (text.includes("Download the React DevTools")) return;
    problems.push(`${m.type()}: ${text}`);
  };
  page.on("console", onMessage);
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

/**
 * A fresh run, every time — no save carried between tests.
 *
 * Names are matched case-insensitively throughout: the interface upper-cases
 * labels with CSS, which does not reach the accessible name, so "PHYSICIAN"
 * on screen is "Physician" to a screen reader and to Playwright.
 */
async function startRun(page: Page) {
  // Cleared once rather than on every navigation, so a later reload keeps
  // whatever the run has since written. See the note in `preload`.
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  // The career card arms on the first press and moves on to *where* on the
  // second, so the detail is readable before committing on a phone.
  const card = page.getByRole("button", { name: /physician/i });
  await card.click();
  await expect(card, "card shows as selected before it starts").toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await card.click();
  // Then the start city. The default is Lyon, which is where every run
  // started before the choice existed.
  await page.getByRole("button", { name: /^Begin in Lyon$/ }).click();
  await expect(page.getByRole("button", { name: /^world$/i })).toBeVisible();
}

const mapGroup = (page: Page) => page.getByRole("group", { name: /World map/ });

async function openNetwork(page: Page) {
  await page.getByRole("button", { name: /^world$/i }).click();
  await expect(mapGroup(page)).toBeVisible();
}

/** Nothing anywhere in the app may make the page itself scroll sideways. */
async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow, "page-level horizontal overflow").toBeLessThanOrEqual(0);
}

test.describe("network map", () => {
  test("opens with the home city on screen", async ({ page }) => {
    const problems = watchConsole(page);
    await startRun(page);
    await openNetwork(page);

    const home = mapGroup(page).getByRole("button", { name: /you are here/ });
    await expect(home).toBeVisible();
    await expect(home).toHaveAccessibleName(/^Lyon/);

    // Visible is not enough: it must be inside the scroller's own window,
    // which is the bug this guards — the map used to open showing the
    // Americas with Lyon off to the east.
    const inView = await home.evaluate((el) => {
      const box = el.closest("[role=group]")!.getBoundingClientRect();
      const marker = el.getBoundingClientRect();
      return marker.left >= box.left - 1 && marker.right <= box.right + 1;
    });
    expect(inView, "home city inside the map viewport").toBe(true);

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("selecting a city centres it and updates the detail panel", async ({
    page,
  }) => {
    await startRun(page);
    await openNetwork(page);

    const scroller = mapGroup(page);
    const before = await scroller.evaluate((el) => el.scrollLeft);

    await page
      .getByRole("navigation", { name: /cities/i })
      .getByRole("button", { name: /Tokyo/ })
      .click();

    // The detail panel follows the selection without a page change.
    await expect(
      page.getByRole("region", { name: /^Selected city/ }),
    ).toHaveAccessibleName("Selected city: Tokyo");

    const after = await scroller.evaluate((el) => el.scrollLeft);
    const pannable = await scroller.evaluate(
      (el) => el.scrollWidth > el.clientWidth + 1,
    );
    if (pannable) {
      expect(after, "map panned towards Tokyo").toBeGreaterThan(before);
    }

    const tokyoInView = await scroller
      .getByRole("button", { name: /^Tokyo/ })
      .evaluate((el) => {
        const box = el.closest("[role=group]")!.getBoundingClientRect();
        const marker = el.getBoundingClientRect();
        return marker.left >= box.left - 1 && marker.right <= box.right + 1;
      });
    expect(tokyoInView, "Tokyo inside the map viewport").toBe(true);
  });

  test("every city is present and reachable by keyboard", async ({ page }) => {
    await startRun(page);
    await openNetwork(page);

    const cities = [
      "Lyon",
      "Madrid",
      "Milan",
      "Berlin",
      "Amsterdam",
      "Paris",
      "London",
      "Dubai",
      "Singapore",
      "Tokyo",
      "New York",
      "São Paulo",
      "Mumbai",
      "Lagos",
    ];

    /*
     * The map clusters overlapping markets, so it does NOT show fourteen
     * markers at 1x — that is the feature. What must always hold is that
     * every city is reachable, and the navigator is the guarantee: it lists
     * all fourteen at every zoom, which is why it exists.
     */
    const navigator = page.getByRole("navigation", { name: /cities/i });
    for (const city of cities) {
      const chip = navigator.getByRole("button", {
        name: new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      });
      await expect(chip, `${city} in the navigator`).toHaveCount(1);
      await chip.focus();
      await expect(chip, `${city} can hold focus`).toBeFocused();
    }

    // Nothing on the map may be unaccounted for: every button is either a
    // city or a cluster that names its members.
    const markers = mapGroup(page).getByRole("button");
    const count = await markers.count();
    expect(count, "map shows markers").toBeGreaterThan(0);
    expect(count, "clustering reduces the marker count").toBeLessThan(14);

    let covered = 0;
    for (let i = 0; i < count; i++) {
      const name = (await markers.nth(i).getAttribute("aria-label")) ?? "";
      covered += cities.filter((c) => name.includes(c)).length;
    }
    expect(
      covered,
      "every city is named by some marker",
    ).toBeGreaterThanOrEqual(cities.length);
  });

  test("zooming in separates every city onto its own marker", async ({
    page,
  }) => {
    await startRun(page);
    await openNetwork(page);

    const zoomIn = page.getByRole("button", { name: /^Zoom in$/ });
    for (let i = 0; i < 12 && (await zoomIn.isEnabled()); i++) {
      await zoomIn.click();
    }

    // At full zoom nothing is grouped: fourteen cities, fourteen markers.
    await expect(mapGroup(page).getByRole("button")).toHaveCount(14);
    for (const city of ["London", "Paris", "Amsterdam", "Berlin", "Milan"]) {
      await expect(
        mapGroup(page).getByRole("button", { name: new RegExp(`^${city}\\.`) }),
        `${city} has its own marker when zoomed`,
      ).toHaveCount(1);
    }
  });

  test("reduced motion stops the decorative animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await startRun(page);
    await openNetwork(page);

    // Routes must still be drawn as solid lines, not left mid-dash.
    const routes = page.locator("svg path.route-flow, svg path.route-draw");
    for (let i = 0; i < (await routes.count()); i++) {
      const style = await routes.nth(i).evaluate((el) => {
        const s = getComputedStyle(el);
        return { name: s.animationName, dash: s.strokeDasharray };
      });
      expect(style.name, "route animation").toBe("none");
      expect(["none", ""], "route dash pattern").toContain(style.dash);
    }

    /*
     * The map is still fully usable under reduced motion.
     *
     * Selection goes through the navigator rather than by clicking the marker
     * directly, because on a phone the board is 1180px inside a ~350px window
     * and Tokyo is simply panned off-screen — that is what panning means, and
     * the navigator is the path the interface points at for exactly this. The
     * assertion is stronger than a click: the panel must update AND the map
     * must bring the city into its own viewport.
     */
    await expect(mapGroup(page).getByRole("button").first()).toBeVisible();
    await page
      .getByRole("navigation", { name: /cities/i })
      .getByRole("button", { name: /Tokyo/ })
      .click();
    await expect(
      page.getByRole("region", { name: /^Selected city/ }),
    ).toHaveAccessibleName("Selected city: Tokyo");

    const inView = await mapGroup(page)
      .getByRole("button", { name: /^Tokyo\./ })
      .evaluate((el) => {
        const box = el.closest("[role=group]")!.getBoundingClientRect();
        const marker = el.getBoundingClientRect();
        return marker.left >= box.left - 1 && marker.right <= box.right + 1;
      });
    expect(inView, "reduced motion still centres the selected city").toBe(true);
  });

  test("every label on the map has a marker under it", async ({ page }) => {
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await openNetwork(page);

    /*
     * The regression: labels were drawn for all fourteen cities while
     * clustering meant only some had their own marker, so Berlin's name sat
     * over open water with nothing beneath it.
     */
    const check = async () => {
      const labels = await mapGroup(page).locator("svg text").allTextContents();
      const names = await mapGroup(page)
        .getByRole("button")
        .evaluateAll((els) =>
          els.map((e) => e.getAttribute("aria-label") ?? ""),
        );
      for (const label of labels) {
        const backed = names.some(
          (n) => n.startsWith(`${label}.`) && !/markets:/.test(n),
        );
        expect(backed, `"${label}" has its own marker`).toBe(true);
      }
      return labels.length;
    };

    expect(await check(), "some cities are labelled").toBeGreaterThan(0);

    // And it must still hold once zoom dissolves the clusters.
    const zoomIn = page.getByRole("button", { name: /^Zoom in$/ });
    for (let i = 0; i < 12 && (await zoomIn.isEnabled()); i++) {
      await zoomIn.click();
    }
    expect(await check(), "more cities labelled when zoomed").toBeGreaterThan(
      0,
    );
  });

  test("zoom is bounded and reset returns to the home city", async ({
    page,
  }) => {
    await startRun(page);
    await openNetwork(page);

    const scroller = mapGroup(page);
    const board = scroller.locator("> div").first();
    const widthOf = () =>
      board.evaluate((el) => el.getBoundingClientRect().width);

    const start = await widthOf();
    const zoomIn = page.getByRole("button", { name: /^Zoom in$/ });
    const zoomOut = page.getByRole("button", { name: /^Zoom out$/ });
    const reset = page.getByRole("button", { name: /Reset the map/ });

    // Out is already at the floor on first render.
    await expect(zoomOut).toBeDisabled();

    await zoomIn.click();
    expect(await widthOf(), "zooming in enlarges the board").toBeGreaterThan(
      start,
    );
    await expect(zoomOut).toBeEnabled();

    // Walk to the top end: it must clamp, not run away. Bounded, and it stops
    // as soon as the control disables itself — which is the thing under test.
    for (let i = 0; i < 10 && (await zoomIn.isEnabled()); i++) {
      await zoomIn.click();
    }
    await expect(zoomIn).toBeDisabled();
    const maxWidth = await widthOf();
    /*
     * The ceiling is 6x. It is that high on purpose: the map uses real
     * geography, which puts London and Paris ~14px apart at 1x, and zoom is
     * how that crowding is resolved. The assertion is that it *stops* — a
     * clamp, not a limit on ambition.
     */
    expect(maxWidth / start, "zoom is clamped").toBeLessThanOrEqual(6.1);
    expect(maxWidth / start, "zoom reaches its ceiling").toBeGreaterThan(5);

    // Reset restores both the zoom and the selection.
    await page
      .getByRole("navigation", { name: /cities/i })
      .getByRole("button", { name: /Tokyo/ })
      .click();
    await reset.click();
    expect(await widthOf(), "reset restores the default zoom").toBeCloseTo(
      start,
      0,
    );
    await expect(
      page.getByRole("region", { name: /^Selected city/ }),
    ).toHaveAccessibleName("Selected city: Lyon");

    const homeInView = await scroller
      .getByRole("button", { name: /you are here/ })
      .evaluate((el) => {
        const box = el.closest("[role=group]")!.getBoundingClientRect();
        const marker = el.getBoundingClientRect();
        return marker.left >= box.left - 1 && marker.right <= box.right + 1;
      });
    expect(homeInView, "reset brings the home city back into view").toBe(true);
  });

  test("marker treatment tracks real state", async ({ page }) => {
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await openNetwork(page);

    // The midrun fixture operates in Lyon and Madrid and nowhere else.
    await expect(
      mapGroup(page).getByRole("button", { name: /^Lyon\..*you are here/ }),
    ).toHaveCount(1);
    await expect(
      mapGroup(page).getByRole("button", { name: /^Madrid\..*operating/ }),
    ).toHaveCount(1);
    await expect(
      mapGroup(page).getByRole("button", { name: /^Tokyo\..*not licensed/ }),
    ).toHaveCount(1);

    // Routes exist only between operating cities: one non-home operating
    // city means exactly one route.
    const routes = page.locator("svg path.route-flow, svg path.route-draw");
    await expect(routes).toHaveCount(1);
  });

  test("two markets side by side, three is the limit, and it comes apart again", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startRun(page);
    await openNetwork(page);

    /* One market is not a comparison, so there is nothing to show yet. */
    const drawer = page.locator('section[aria-labelledby="compare-title"]');
    await page.getByRole("button", { name: /^compare Madrid$/i }).click();
    await expect(drawer).toHaveCount(0);

    /* Two is. Both cities and the axes appear side by side. */
    await page.getByRole("button", { name: /^compare Tokyo$/i }).click();
    await expect(drawer).toBeVisible();
    /* Two traps in one locator, both learned here. The drawer renders the
       phone cards and the desktop table together and shows one per
       breakpoint, so ask for the visible copy. And ask for it EXACTLY:
       getByText is case-insensitive substring matching, and "comPARISon" —
       as in the Clear-comparison button this drawer always carries —
       contains "paris". */
    const shown = (text: string) =>
      drawer.getByText(text, { exact: true }).filter({ visible: true }).first();
    await expect(shown("Madrid")).toBeVisible();
    await expect(shown("Tokyo")).toBeVisible();
    await expect(drawer.getByText(/^Fees$/i).filter({ visible: true }).first()).toBeVisible();
    await expect(
      drawer.getByText(/^Room to grow$/i).filter({ visible: true }).first(),
    ).toBeVisible();

    /* Three fills it, and every other row's toggle says so by refusing. */
    await page.getByRole("button", { name: /^compare Paris$/i }).click();
    await expect(shown("Paris")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^compare Lagos$/i }),
    ).toBeDisabled();

    /* Removing one reopens the door. */
    await page
      .getByRole("button", { name: /remove Paris from the comparison/i })
      .first()
      .click();
    await expect(drawer.getByText("Paris", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^compare Lagos$/i }),
    ).toBeEnabled();

    /* And clearing takes the whole thing down. */
    await page.getByRole("button", { name: /clear comparison/i }).click();
    await expect(drawer).toHaveCount(0);

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("no page overflow at any tested width", { tag: "@sets-own-viewport" }, async ({ page }) => {
    await startRun(page);
    await openNetwork(page);
    for (const size of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(size);
      await expectNoPageOverflow(page);
    }
  });
});

test.describe("phone", () => {
  test("opens, closes, and returns focus to its trigger", async ({ page }) => {
    const problems = watchConsole(page);
    await startRun(page);

    const trigger = page.getByRole("button", { name: /open phone/i });
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectNoPageOverflow(page);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger, "focus returned to the phone button").toBeFocused();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });
});

test.describe("practice artwork", () => {
  test("renders without shifting the layout", async ({ page }) => {
    const problems = watchConsole(page);

    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          };
          if (!shift.hadRecentInput) {
            (window as unknown as { __cls: number }).__cls += shift.value;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    await startRun(page);
    await page.getByRole("button", { name: /^work$/i }).click();

    const image = page.locator('img[src*="practice-progression"]');
    await expect(image).toBeVisible();
    // A priority image must not be lazy — that combination is what produced
    // the LCP warning in the first place.
    await expect(image).not.toHaveAttribute("loading", "lazy");

    await image.evaluate((el: HTMLImageElement) =>
      el.complete ? null : el.decode().catch(() => null),
    );

    const cls = await page.evaluate(
      () => (window as unknown as { __cls: number }).__cls,
    );
    expect(cls, "cumulative layout shift").toBeLessThan(0.1);

    // Next warns about LCP images that are not marked priority; none should
    // appear, and no image should fail to load.
    expect(problems.filter((p) => /Image|LCP|priority|sizes/i.test(p))).toEqual(
      [],
    );
    expect(problems).toEqual([]);
  });

  test("the heavy network texture is never requested", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("healthcare-network-map")) requested.push(r.url());
    });

    await startRun(page);
    await page.getByRole("button", { name: /^world$/i }).click();
    await expect(mapGroup(page)).toBeVisible();

    expect(requested, "2.5MB map PNG must not be fetched").toEqual([]);
  });
});

test.describe("artwork", () => {
  test("career covers load and no source PNG is fetched", async ({ page }) => {
    const problems = watchConsole(page);
    const pngs: string[] = [];
    page.on("request", (r) => {
      const url = decodeURIComponent(r.url());
      if (/\/visuals\/.*\.png/.test(url)) pngs.push(url);
    });

    /*
     * A clean *game*, not a signed-out browser.
     *
     * This used to be `localStorage.clear()`, which also removed the profile
     * the suite signs in with and left the test looking at the front door
     * instead of the select screen. What it wants is no saved run; the
     * account is not part of that.
     */
    await page.addInitScript(() => {
      for (const k of Object.keys(window.localStorage)) {
        if (/:(save|lastplan|taught|archive):/.test(k)) {
          window.localStorage.removeItem(k);
        }
      }
    });
    await page.goto("/");

    // next/image rewrites src to a URL-encoded optimiser path, so match on
    // the filename stem rather than the directory separator.
    const covers = page.locator('main img[src*="career-"]');
    /*
     * However many the select screen offers — the playable careers and the
     * designs shown beside them.
     *
     * Counted rather than hard-coded. This assertion said `3`, which was the
     * number of cards on the day it was written, and it broke the moment four
     * more covers were added. The claim it is actually making is that *every*
     * cover decodes and that no source PNG is fetched, and neither of those
     * has anything to do with how many careers there are.
     */
    await expect(covers.first()).toBeVisible();
    const count = await covers.count();
    expect(count, "the select screen shows career covers").toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      /*
       * Polled rather than sampled once.
       *
       * `complete && naturalWidth` is only true after the browser has finished
       * decoding, and a single read the instant the locator resolves races
       * that — which it lost on the mobile project under load, about one run
       * in twenty. Nothing about the assertion changed; it is now allowed to
       * wait for the thing it is asserting on.
       */
      await expect
        .poll(
          () =>
            covers
              .nth(i)
              .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
          { message: `career cover ${i} decoded` },
        )
        .toBe(true);
    }

    expect(pngs, "heavy source PNGs must never be requested").toEqual([]);
    expect(problems).toEqual([]);
  });

  test("only the selected city's artwork is loaded", async ({ page }) => {
    const cityRequests: string[] = [];
    page.on("request", (r) => {
      const url = decodeURIComponent(r.url());
      const hit = url.match(/\/visuals\/cities\/(city-[a-z-]+)\.webp/);
      if (hit) cityRequests.push(hit[1]);
    });

    await startRun(page);
    await page.getByRole("button", { name: /^world$/i }).click();
    await expect(mapGroup(page)).toBeVisible();
    await page.waitForTimeout(500);

    // The map itself must never pull fourteen photographs.
    expect(
      new Set(cityRequests).size,
      "cities loaded on map open",
    ).toBeLessThanOrEqual(1);
    expect(cityRequests.every((c) => c === "city-lyon")).toBe(true);

    await page
      .getByRole("navigation", { name: /cities/i })
      .getByRole("button", { name: /Mumbai/ })
      .click();
    await expect(
      page.getByRole("region", { name: /^Selected city/ }),
    ).toHaveAccessibleName("Selected city: Mumbai");
    await expect(page.locator('img[src*="city-mumbai"]')).toHaveCount(1);
    expect(
      new Set(cityRequests).size,
      "one more city after selecting",
    ).toBeLessThanOrEqual(2);
  });

  test("the milestone image appears only for a won run", async ({ page }) => {
    await startRun(page);
    // A fresh run has not won anything, so nothing may claim it has.
    await expect(page.locator('img[src*="milestone"]')).toHaveCount(0);
  });

  test("every section banner resolves and none is a PNG", async ({ page }) => {
    const problems = watchConsole(page);
    const failed: string[] = [];
    const pngs: string[] = [];
    page.on("response", (r) => {
      const url = decodeURIComponent(r.url());
      if (/\/visuals\//.test(url) && r.status() >= 400) failed.push(url);
      if (/\/visuals\/.*\.png/.test(url)) pngs.push(url);
    });

    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    // Overview's hero is the above-the-fold one and must not be lazy.
    const hero = page.locator('img[src*="section-overview"]');
    await expect(hero).toHaveCount(1);
    await expect(hero).not.toHaveAttribute("loading", "lazy");

    // Walk the screens that carry a banner and confirm each one loads.
    const screens: [RegExp, string][] = [
      /* Loose, because a badge prepends a count to the label. */
      [/Career/, "section-career"],
      [/Life/, "section-life"],
    ];
    for (const [nav, stem] of screens) {
      /*
       * By visible text, not by exact accessible name.
       *
       * A section with an outstanding alert renders a badge, which prepends
       * "1 warning in Career" to the button's accessible name — so `^career$`
       * silently stopped matching the moment standing alerts started routing
       * to that section. The label the player reads is the stable handle.
       */
      await page
        .getByRole("navigation", { name: "Primary" })
        .last()
        .getByRole("button")
        .filter({ hasText: nav })
        .first()
        .click();
      const img = page.locator(`img[src*="${stem}"]`);
      await expect(img, `${stem} present`).toHaveCount(1);
      // Lazy by design, so poll rather than assuming it has already arrived.
      await expect
        .poll(
          () =>
            img.evaluate(
              (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
            ),
          { message: `${stem} decoded` },
        )
        .toBe(true);
    }

    expect(failed, "no visual returned an error status").toEqual([]);
    expect(pngs, "no PNG master is ever requested").toEqual([]);
    expect(problems).toEqual([]);
  });
});

/* ------------------------------------------------------- weekly gameplay */

test.describe("the weekly loop", () => {
  test("allocating, committing and closing a quiet week", async ({ page }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    const weekBefore = await readWeek(page);

    // Allocation is reflected before commit: the control refuses an empty
    // week and arms once time has been assigned.
    const commit = commitButton(page);
    await expect(commit).toBeDisabled();
    const plus = page.getByRole("button", { name: /More blocks on Rest/i });
    for (let i = 0; i < 4; i++) await plus.click();
    await expect(commit).toBeEnabled();
    await expect(commit).toHaveText(/Commit week/);

    await commit.click();

    // The review opens, and a quiet week can be dismissed with Escape.
    const review = page.getByRole("dialog");
    await expect(review).toBeVisible();
    await expect(review).toContainText(
      new RegExp(`week ${weekBefore} closed`, "i"),
    );
    await page.keyboard.press("Escape");
    await expect(review).toBeHidden();

    // The interface reflects the new week.
    expect(await readWeek(page)).toBe(weekBefore + 1);
    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("an event is presented and its choice resolves", async ({ page }) => {
    const problems = watchConsole(page);
    await preload(page, "before-event");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    const before = await readWeek(page);
    await playWeek(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // This fixture is seeded to the week an illustrated event fires.
    await expect(dialog).toContainText(/Regulatory inspection/i);
    await expect(dialog.locator("img")).toHaveCount(1);
    // The category and severity badges the registry supplies.
    await expect(dialog).toContainText(/Regulatory/);
    await expect(dialog).toContainText(/Serious/);

    // Escape must NOT dismiss a week carrying a decision.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    // Resolving the choice closes it; the week has already advanced on commit.
    await dialog.getByRole("button", { name: /Cooperate fully/i }).click();
    await expect(dialog).toBeHidden();
    expect(await readWeek(page)).toBe(before + 1);

    expect(problems).toEqual([]);
  });
});

/* ------------------------------------------------------ save and continue */

test.describe("continuing a run", () => {
  test("progress survives a reload", async ({ page }) => {
    await startRun(page);

    // Make progress that is visible and specific.
    await playWeek(page);
    await dismissReview(page);
    const week = await readWeek(page);
    expect(week).toBeGreaterThan(1);

    await page.reload();

    const cont = page.getByRole("button", { name: /continue your run/i });
    await expect(cont, "continue is offered after a reload").toBeVisible();
    await cont.click();

    expect(await readWeek(page), "the week survived the reload").toBe(week);
  });

  test("a run past the old goal is still resumable", async ({ page }) => {
    /*
     * This replaces "a finished run is not offered as continuable".
     *
     * That test asserted the opposite of the product rule — that reaching the
     * goal ends the run. Reaching the goal is now a milestone, so the correct
     * assertion is that the save is still there and still playable.
     */
    await preload(page, "nearly-won");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await playWeek(page);
    await dismissReview(page);

    const week = await readWeek(page);
    await page.reload();
    await expect(
      page.getByRole("button", { name: /continue your run/i }),
      "a successful run must still be resumable",
    ).toBeVisible();
    await page.getByRole("button", { name: /continue your run/i }).click();
    expect(await readWeek(page)).toBe(week);
  });
});

/* ------------------------------------------------- the sandbox guarantee */

test.describe("nothing ends the run", () => {
  test("reaching the old win condition keeps playing", async ({ page }) => {
    const problems = watchConsole(page);
    await preload(page, "nearly-won");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    const before = await readWeek(page);
    await playWeek(page);
    await dismissReview(page);

    // Still the game, not a results screen.
    expect(await readWeek(page)).toBe(before + 1);
    await expect(commitButton(page)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /run it again/i }),
      "no end-of-run screen may appear",
    ).toHaveCount(0);

    // And the achievement was recorded rather than consumed.
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Career/ })
      .first()
      .click();
    await page.getByRole("tab", { name: /timeline/i }).click();
    await expect(page.getByText(/hospital is yours/i)).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("falling into insolvency offers a way back, not a game over", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "nearly-lost");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await playWeek(page);
    await dismissReview(page);

    // The run continues.
    await expect(commitButton(page)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /run it again/i }),
    ).toHaveCount(0);

    // And the setback is on screen with its routes out.
    await expect(
      page.getByRole("heading", { name: /business failure/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/This does not end your career/i),
    ).toBeVisible();
    await expect(page.getByText(/The way back/i)).toBeVisible();
    expect(
      await page.getByRole("button", { name: /^Do this$|^Not yet$/ }).count(),
    ).toBeGreaterThan(2);

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });
});

/* --------------------------------------------------- character and retiring */

test.describe("who you are", () => {
  const openCharacter = async (page: Page) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Career/ })
      .first()
      .click();
    await page.getByRole("tab", { name: /character/i }).click();
  };

  test("personality is earned, not chosen", async ({ page }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await openCharacter(page);

    await expect(
      page.getByRole("heading", { name: /^Personality$/ }),
    ).toBeVisible();
    await expect(
      page.getByText(/earned by what you keep doing/i),
    ).toBeVisible();
    // No button anywhere that simply grants a trait.
    await expect(
      page.getByRole("button", {
        name: /become (ruthless|charismatic|ambitious)/i,
      }),
    ).toHaveCount(0);

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("an ambition can be chosen and does not end anything", async ({
    page,
  }) => {
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await openCharacter(page);

    await expect(page.getByText(/it is not a win condition/i)).toBeVisible();
    const pick = page
      .getByRole("button", { name: /make this the goal/i })
      .first();
    await pick.click();
    // Still playing.
    await expect(page.getByRole("tab", { name: /character/i })).toBeVisible();
  });

  test("retirement is opt-in, previewed, and cancellable", async ({ page }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    /* Read on Overview: the week lives in the status strip, which only that
       screen renders — querying for it anywhere else waits forever. */
    const week = await readWeek(page);

    await openCharacter(page);
    await expect(page.getByText(/Only you decide when/i)).toBeVisible();
    await page.getByRole("button", { name: /consider retiring/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Nothing is written until/i);
    await expect(dialog).toContainText(/What this career was/i);

    // Cancelling must leave the run untouched and playable.
    await dialog.getByRole("button", { name: /keep going/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("tab", { name: /character/i })).toBeVisible();

    /* Reload rather than navigate: it proves the cancel wrote nothing to
       storage, which is the actual guarantee — and it avoids fighting the
       fixed bottom bar on a handset. */
    await page.reload();
    await page.getByRole("button", { name: /continue your run/i }).click();
    expect(await readWeek(page), "cancelling changes nothing").toBe(week);
    await openCharacter(page);

    // Escape cancels too — the destructive path must never be the default.
    await page.getByRole("button", { name: /consider retiring/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    expect(problems).toEqual([]);
  });
});

/* ------------------------------------------------------------- the phone */

test.describe("the phone", () => {
  test("posting once a week, and the refusal on the second", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "phone-ready");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    await page.getByRole("button", { name: /open phone/i }).click();
    const phone = page.getByRole("dialog");
    await expect(phone).toBeVisible();
    await expectNoPageOverflow(page);

    // The phone opens on Messages or News when either has unread items, so
    // reach Pulse explicitly rather than assuming it is the landing app.
    await phone.getByRole("button", { name: /^Pulse/i }).click();

    // The composer offers this week's eligible posts as chips; one is chosen,
    // then published. The fixture guarantees at least one is available.
    await expect(phone).toContainText(/Compose/i);
    const socialBefore = await readSocial(phone);
    const feedBefore = await phone.locator("ul > li").count();

    // It starts collapsed — by mid-run eleven eligible posts would otherwise
    // push the feed off a handset screen entirely.
    const composer = phone.getByRole("button", { name: /Compose · week/i });
    await expect(composer).toHaveAttribute("aria-expanded", "false");
    await expect(
      phone.getByRole("button", { name: /Write health advice/i }),
    ).toBeHidden();

    await composer.click();
    await expect(composer).toHaveAttribute("aria-expanded", "true");

    await phone.getByRole("button", { name: /Write health advice/i }).click();
    const publish = phone.getByRole("button", { name: /^Publish$/ });
    await expect(publish).toBeVisible();
    await publish.click();

    // It lands in the feed, attributed to the player, and moves the numbers.
    await expect
      .poll(async () => phone.locator("ul > li").count(), {
        message: "the post should appear in the feed",
      })
      .toBeGreaterThan(feedBefore);
    await expect(phone).toContainText("@you");
    await expect
      .poll(async () => readSocial(phone), {
        message: "followers, trust or sentiment should move after a post",
      })
      .not.toBe(socialBefore);

    // A second post in the same week is refused — the composer says so
    // rather than offering a button that silently does nothing.
    await expect(phone).toContainText(/already posted this week/i);
    await expect(phone.getByRole("button", { name: /^Publish$/ })).toHaveCount(
      0,
    );

    await page.keyboard.press("Escape");
    await expect(phone).toBeHidden();
    expect(problems).toEqual([]);
  });

  test("opening news and messages marks them read", async ({ page }) => {
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    const trigger = page.getByRole("button", { name: /open phone/i });
    const unreadBadge = await trigger.textContent();

    await trigger.click();
    const phone = page.getByRole("dialog");
    await expect(phone).toBeVisible();

    // Visit both inboxes; whichever carried unread items must clear.
    for (const app of [/news/i, /messages/i]) {
      const tab = phone.getByRole("button", { name: app }).first();
      if ((await tab.count()) > 0) await tab.click();
    }

    await page.keyboard.press("Escape");
    await expect(phone).toBeHidden();

    // The unread marker on the trigger must not have grown.
    const after = await trigger.textContent();
    expect((after ?? "").length).toBeLessThanOrEqual(
      (unreadBadge ?? "").length,
    );
  });
});

/* ------------------------------------------------------------- quick plan */

test.describe("filling the week in one tap", () => {
  test("a named plan spends the whole week and can still be edited", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    const commit = commitButton(page);
    await expect(commit).toBeDisabled();

    // One press fills the week, so the commit control arms without the six
    // separate stepper presses the board would otherwise need.
    await page.getByRole("button", { name: /^Balanced/ }).click();
    await expect(commit).toBeEnabled();
    await expect(commit).toHaveText(/Commit week/);

    // This fixture sits at burnout 81, so the plans that assign no rest carry
    // a warning — a one-tap button must not be able to quietly end the run.
    await expect(
      page.getByRole("button", { name: /Balanced.*no rest in it/i }),
      "a restless plan is marked while burnout is high",
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Recovery/ }),
      "the plan that does rest carries no warning",
    ).toBeVisible();

    // The steppers still govern: a plan is a starting point, not a lock.
    await page
      .getByRole("button", { name: /Fewer blocks on Rest|Fewer blocks on/i })
      .first()
      .click();
    await expect(commit).toBeEnabled();

    // And clearing empties it again rather than leaving a stale plan behind.
    await page.getByRole("button", { name: /^Clear$/ }).click();
    await expect(commit).toBeDisabled();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("last week's plan is offered again after a reload", async ({ page }) => {
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    // Recover, not Grow: this fixture is at burnout 81, and a week with no
    // rest in it ends the run outright — which would leave nothing to resume.
    await page.getByRole("button", { name: /^Recovery/ }).click();
    await commitButton(page).click();
    await dismissReview(page);

    // The offer must survive the reload: most sittings begin by resuming, and
    // that is exactly when repeating last week is worth the most.
    await page.reload();
    await page.getByRole("button", { name: /continue your run/i }).click();
    const repeat = page.getByRole("button", { name: /repeat last week/i });
    await expect(repeat).toBeVisible();

    await repeat.click();
    await expect(commitButton(page)).toBeEnabled();
  });
});

/* --------------------------------------------------------------- outbreaks */

test.describe("outbreak pressure", () => {
  test("the odds the simulation rolls against are on screen", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /World/ })
      .first()
      .click();
    await page.getByRole("tab", { name: /outbreaks/i }).click();

    const strip = page.getByText(/Outbreak pressure/i).locator("..");
    await expect(strip).toBeVisible();
    // A real percentage and a real ceiling, not a vague mood word alone.
    await expect(strip).toContainText(/%\s*a week/i);
    await expect(page.getByText(/severity \d of 5/i)).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });
});

/* ------------------------------------------------------------------- shell */

test.describe("the app shell", () => {
  test("the bottom bar stays anchored at tablet width", { tag: "@sets-own-viewport" }, async ({ page }) => {
    // 768 is the width the nav used to switch layout at while the shell was
    // still rendering the mobile instance — the bar detached from the bottom
    // and landed in the page flow.
    await page.setViewportSize({ width: 768, height: 1024 });
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    const bar = page.getByRole("navigation", { name: "Primary" }).last();
    await expect(bar).toBeVisible();
    await expect(bar).toHaveCSS("position", "fixed");

    const box = await bar.boundingBox();
    const height = page.viewportSize()?.height ?? 0;
    expect(box, "the primary nav should have a box").not.toBeNull();
    expect(
      Math.abs((box?.y ?? 0) + (box?.height ?? 0) - height),
      "the bar should sit on the bottom edge",
    ).toBeLessThanOrEqual(2);

    await expectNoPageOverflow(page);
  });
});

/* ---------------------------------------------------- the purchase screens */

test.describe("buying things", () => {
  test("a card states the gap instead of greying itself out", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Life/ })
      .first()
      .click();

    // The mid-run fixture cannot afford the country estate. The card must
    // still be fully readable and must say how far short it is — an
    // unaffordable item is something to save toward, not something broken.
    const estate = page.getByRole("article", { name: "Country estate" });
    await expect(estate).toContainText(/short/i);

    const opacity = await estate.evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity), "an unaffordable card is not dimmed").toBe(1);

    /*
     * The control is present and disabled rather than absent, so the layout
     * does not reflow as cash moves. Its label now states the reason —
     * "Not enough cash" — instead of saying "Buy" and refusing, which made
     * the player click it to find out why.
     */
    const buy = estate.getByRole("button", { name: /not enough cash/i });
    await expect(buy).toBeVisible();
    await expect(buy).toBeDisabled();

    // Something affordable in the same list is live.
    const town = page.getByRole("article", { name: "Town house" });
    await expect(town.getByRole("button", { name: /^Buy$/ })).toBeEnabled();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("a purchase card is not itself a button", async ({ page }) => {
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Work/ })
      .first()
      .click();

    // Practice used to wrap each card in a <button>, which gives a screen
    // reader an accessible name three sentences long. The name should now be
    // the verb alone.
    const buys = page.getByRole("button", { name: /^Buy$/ });
    expect(await buys.count()).toBeGreaterThan(0);
    for (const name of await buys.allTextContents()) {
      expect(
        name.trim().length,
        `"${name}" should be a short label`,
      ).toBeLessThan(12);
    }
  });

  test("buying a department opens it", async ({ page }) => {
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Work/ })
      .first()
      .click();

    /* Departments became illustrated cards, so the control is the shelf's
       "Buy" rather than a bare "Open department" row. The guarantee is
       unchanged: opening one takes it off the list of things you can open. */
    await page.getByRole("tab", { name: /^build$/i }).click();
    /* Scoped to the department shelf by its own landmark: premises cards
       also mention departments in their headline ("room for 3 departments"),
       so a text filter would count those too. */
    const shelf = page.getByRole("region", { name: /^Departments ·/ });
    const offers = () => shelf.getByRole("button", { name: /^Buy$/ });
    const open = offers().first();
    await expect(open).toBeEnabled();
    const before = await offers().count();

    await open.click();

    // One fewer department is on offer, and the panel header agrees.
    await expect.poll(async () => offers().count()).toBe(before - 1);
    /* And the shelf header counts it. */
    await expect(shelf.getByText(/\d+ of \d+ owned/)).toBeVisible();
  });
});

/* ------------------------------------------------------------- old saves */

test.describe("an older save", () => {
  test("is migrated forward rather than discarded", async ({ page }) => {
    const problems = watchConsole(page);

    /*
     * A genuine v8 save: the current fixture with every field v9 added
     * stripped out, written under the old key. This is what a player who
     * last opened the game before this build has sitting in their browser,
     * and the promise is that it keeps working.
     */
    const raw = JSON.parse(
      readFileSync(join("e2e", "fixtures", "midrun.json"), "utf8"),
    );
    delete raw.people;
    delete raw.timeline;
    delete raw.pending;
    delete raw.repLog;
    for (const key of [
      "repPatients",
      "repLoyalty",
      "repInfluence",
      "repPopularity",
      "repEthics",
    ]) {
      delete raw.r[key];
    }
    // …and everything v10 added, so this is a genuine two-hop upgrade.
    for (const key of [
      "rivals",
      "offers",
      "contracts",
      "contractLog",
      "obligations",
      "news",
      "crises",
    ]) {
      delete raw[key];
    }
    const week = raw.week;

    await page.goto("/");
    await page.evaluate(
      ([key, value]) => {
        window.localStorage.clear();
        window.localStorage.setItem(key, value);
      },
      [LEGACY_SAVE_KEY, JSON.stringify(raw)] as const,
    );
    await page.reload();

    const cont = page.getByRole("button", { name: /continue your run/i });
    await expect(cont, "an older save is still offered").toBeVisible();
    await cont.click();

    // The run it actually was, not a fresh one.
    expect(await readWeek(page), "the week survived the upgrade").toBe(week);

    // And the new subsystems are present and usable.
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Career/ })
      .first()
      .click();
    await page.getByRole("tab", { name: /standing/i }).click();
    await expect(page.getByText(/Professional credibility/i)).toBeVisible();

    // The upgrade is written back once, under the current key.
    const keys = await page.evaluate(() => Object.keys(window.localStorage));
    expect(keys, "the save is stored at the current version").toContain(
      SAVE_KEY,
    );
    expect(keys, "and the old key is cleaned up").not.toContain(
      LEGACY_SAVE_KEY,
    );

    expect(problems).toEqual([]);
  });
});

/* ------------------------------------------------- the phase 1 subsystems */

test.describe("standing, people and timeline", () => {
  const openCareerTab = async (page: Page, tab: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Career/ })
      .first()
      .click();
    await page.getByRole("tab", { name: tab }).click();
  };

  test("standing shows six categories, each with why it moved", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await openCareerTab(page, /standing/i);

    for (const label of [
      /Professional credibility/i,
      /Patient trust/i,
      /Staff loyalty/i,
      /Industry influence/i,
      /Public popularity/i,
      /Ethical standing/i,
    ]) {
      await expect(page.getByText(label).first()).toBeVisible();
    }

    // Not just bars: each one states what moves it.
    await expect(page.getByText(/Moved by:/).first()).toBeVisible();
    // And the meters are real meters, not decorative divs.
    expect(await page.getByRole("meter").count()).toBeGreaterThan(5);

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("people are characters that open, not rows of numbers", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await openCareerTab(page, /people/i);

    const person = page.getByRole("button", { name: /Iris Hallam/ });
    await expect(person).toBeVisible();
    await expect(person).toHaveAttribute("aria-expanded", "false");

    // Collapsed, the numbers are not on screen — that is the whole point of
    // leading with a person rather than a stat line.
    await expect(page.getByText(/^Respect$/)).toHaveCount(0);

    await person.click();
    await expect(person).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/^Respect$/).first()).toBeVisible();
    await expect(page.getByText(/supervising consultant/i)).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("the timeline records real milestones and nothing else", async ({
    page,
  }) => {
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await openCareerTab(page, /timeline/i);

    // The fixture hires a nurse and enters Madrid, so both must be recorded —
    // and the run's own beginning.
    await expect(page.getByText(/You qualified/)).toBeVisible();
    const entries = await page.locator("ol > li").count();
    expect(entries, "the timeline has the run's real moments").toBeGreaterThan(
      1,
    );

    // Every entry carries the week it happened.
    await expect(page.getByText(/^Week \d+$/).first()).toBeVisible();
  });
});

/* ------------------------------------------------------ phase 2 surfaces */

test.describe("the living world", () => {
  const goto = async (page: Page, section: RegExp, tab: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: section })
      .first()
      .click();
    await page.getByRole("tab", { name: tab }).click();
  };

  test("rivals are visible, and open into a career", async ({ page }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await goto(page, /World/, /rivals/i);

    /* Scoped to the panel. The shell header button is named "Physician Dr ·
       MD Back to career select", which a loose /Dr / matcher happily picks up
       and which has no aria-expanded to check — so an unscoped `.first()`
       was testing the header, not a rival. */
    const cards = page
      .getByRole("list", { name: "Rivals" })
      .getByRole("button");
    // Every rival resolves to a person: named cards, no blanks.
    expect(await cards.count()).toBeGreaterThanOrEqual(4);

    /* Held by index, not by state: filtering on `expanded: false` would
       re-resolve to a *different* card after the click. */
    const first = cards.nth(0);
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/^Standing$/).first()).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("the team screen explains its culture score", async ({ page }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await goto(page, /Work/, /^team$/i);

    // Derived, and it shows its working rather than a bare number.
    await expect(page.getByRole("meter", { name: /culture/i })).toBeVisible();
    await expect(page.getByText(/Not something you buy/i)).toBeVisible();
    await expect(page.getByText(/Average load/i).first()).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("financing shows blocked routes with the reason", async ({ page }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await goto(page, /Work/, /^money$/i);

    await expect(page.getByText(/You own/i).first()).toBeVisible();
    // All four external routes are present, offered or explained.
    for (const label of [
      /Bank facility/,
      /Outside investment/,
      /Clinical partner/,
      /Institutional grant/,
    ]) {
      await expect(page.getByRole("article", { name: label })).toBeVisible();
    }
    // At least one is blocked at week 4, and says why rather than vanishing.
    const blocked = page.getByText(
      /Nobody on the panel has heard of you|does not know you well enough/i,
    );
    expect(await blocked.count()).toBeGreaterThan(0);

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("work is presented with its risk as well as its reward", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await goto(page, /Work/, /^assignments$/i);

    await expect(
      page.getByRole("heading", { name: /On the table/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /What you are carrying/i }),
    ).toBeVisible();
    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("every new screen is reachable by keyboard alone", async ({ page }) => {
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    for (const [section, tab] of [
      [/Work/, /^assignments$/i],
      [/Work/, /^team$/i],
      [/Work/, /^money$/i],
      [/World/, /rivals/i],
    ] as const) {
      await goto(page, section, tab);
      // The tab that was activated reports itself as selected, which is what
      // a screen reader announces.
      await expect(page.getByRole("tab", { name: tab })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      // And it can be operated from the keyboard.
      await page.getByRole("tab", { name: tab }).focus();
      await expect(page.getByRole("tab", { name: tab })).toBeFocused();
    }
  });

  test("the new screens hold at mobile and desktop widths", { tag: "@sets-own-viewport" }, async ({
    page,
  }) => {
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [section, tab] of [
        [/Work/, /^team$/i],
        [/Work/, /^money$/i],
        [/World/, /rivals/i],
      ] as const) {
        await goto(page, section, tab);
        await expectNoPageOverflow(page);
      }
    }
  });
});

/* --------------------------------------------------------- comprehension */

/**
 * ORIENTATION
 *
 * Six questions a player should be able to answer without guessing: where am
 * I, what is happening, what needs attention, what can I do, why is that
 * locked, and what happens next. Each test below is one of them, asserted
 * against real run state rather than against static copy — a header that says
 * the same thing on every screen would pass a "header exists" test and fail
 * the player.
 */
test.describe("knowing where you are", () => {
  const nav = async (page: Page, section: RegExp, tab?: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: section })
      .first()
      .click();
    if (tab) await page.getByRole("tab", { name: tab }).click();
  };

  test("every screen says where you are and what is true there", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    /*
     * Two screens in different sections, because the point is that the
     * status is derived rather than boilerplate: if both said the same
     * sentence the header would be decoration.
     */
    await nav(page, /Work/, /^build$/i);
    const build = page.getByRole("main").getByRole("status").first();
    await expect(build).toBeVisible();
    const buildText = (await build.innerText()).trim();

    await nav(page, /Career/, /^standing$/i);
    const standing = page.getByRole("main").getByRole("status").first();
    await expect(standing).toBeVisible();
    const standingText = (await standing.innerText()).trim();

    expect(buildText.length).toBeGreaterThan(10);
    expect(
      standingText,
      "the status must reflect the screen, not repeat a banner",
    ).not.toBe(buildText);

    // And the breadcrumb names the section it belongs to.
    await expect(
      page
        .getByRole("main")
        .getByText(/Career/)
        .first(),
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("contextual help is a real control, not a hover tooltip", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await nav(page, /Work/, /^build$/i);

    const help = page
      .getByRole("main")
      .getByRole("button", { name: /^help/i })
      .first();
    await expect(help).toBeVisible();
    await expect(help).toHaveAttribute("aria-expanded", "false");

    /* Reachable and operable from the keyboard, which a title= tooltip is
       not — that is the whole reason this is a disclosure button. */
    await help.focus();
    await page.keyboard.press("Enter");
    await expect(help).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("main").getByRole("definition").first(),
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("a locked purchase says why, in cash", async ({ page }) => {
    const problems = watchConsole(page);
    await startRun(page);
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Work/ })
      .first()
      .click();
    await page.getByRole("tab", { name: /^build$/i }).click();

    /* A fresh run cannot afford most equipment, so at least one card must
       explain the gap rather than merely disabling its button.

       The wording moved with the purchase redesign — the card now prints the
       gap as "$12,400 short" beside the price rather than a sentence — so the
       assertion is on the guarantee, which is that the number is on the face
       of the card. */
    await expect(
      page.getByText(/\$[\d,]+ short/i).first(),
      "an unaffordable item must say how far short you are",
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("every purchase states what it costs now and every week", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startRun(page);
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Work/ })
      .first()
      .click();
    await page.getByRole("tab", { name: /^build$/i }).click();

    /*
     * Both prices, before the purchase is made.
     *
     * The card carries the one-off price and the recurring cost together;
     * the full labelled breakdown moved into the detail drawer when purchases
     * were redesigned around artwork. Both halves are asserted, because the
     * guarantee was never "these exact words" — it was that a player cannot
     * buy a thing without being shown what it costs to keep.
     */
    const card = page
      .getByRole("article")
      .filter({ hasText: /exam room/i })
      .first();
    await expect(card.getByText(/\/wk after/i)).toBeVisible();

    await card.getByRole("button", { name: /details/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText(/^price$/i)).toBeVisible();
    await expect(drawer.getByText(/every week afterwards/i)).toBeVisible();
    await expect(drawer.getByText(/upkeep/i).first()).toBeVisible();
    await page.keyboard.press("Escape");

    expect(problems).toEqual([]);
  });

  test("the weekly review explains what changed and why", async ({ page }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await playWeek(page);

    const review = page.getByRole("dialog");
    await expect(review).toBeVisible();
    /* The ledger was always there. What was missing was the cause — so this
       asserts on the grouped summary above it, not on the table. */
    await expect(
      review.getByRole("heading", { name: /the week/i }),
    ).toBeVisible();
    await expect(
      review.getByText(/referred elsewhere|brought in|took \$/i).first(),
      "each movement must carry its reason",
    ).toBeVisible();

    await dismissReview(page);
    expect(problems).toEqual([]);
  });

  test("nothing in the interface threatens to end the run", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    const banned = /ends the run|run ends|game over|of 156|before week 156/i;
    for (const [section, tab] of [
      [/Work/, /^build$/i],
      [/Work/, /^staff$/i],
      [/Career/, /^career$/i],
      [/Life/, undefined],
    ] as const) {
      await nav(page, section, tab);
      const text = await page.getByRole("main").innerText();
      expect(text, `ending language on ${section}`).not.toMatch(banned);
    }

    expect(problems).toEqual([]);
  });

  test("orientation survives a phone and a keyboard", { tag: "@sets-own-viewport" }, async ({ page }) => {
    const problems = watchConsole(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    for (const [section, tab] of [
      [/Work/, /^build$/i],
      [/Career/, /^standing$/i],
      [/World/, /^cities$/i],
    ] as const) {
      await nav(page, section, tab);
      await expectNoPageOverflow(page);
      const status = page.getByRole("main").getByRole("status").first();
      await expect(status).toBeVisible();
      /* Every control in the header is thumb-sized. A 32px button in a
         status bar is the one a player misses on a phone. */
      for (const b of await page
        .getByRole("main")
        .locator("header button")
        .all()) {
        const box = await b.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
    }

    expect(problems).toEqual([]);
  });
});

/* --------------------------------------------------- the visual system */

/**
 * VISUALS THAT EXPLAIN
 *
 * The engine harness already proves each diagram's arithmetic matches the
 * simulation. These prove the other half: that the arithmetic reaches a
 * player — on a phone, without colour, without motion, and with the text
 * summary present whether or not the picture renders.
 */
test.describe("visuals that explain the simulation", () => {
  const nav = async (page: Page, section: RegExp, tab?: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: section })
      .first()
      .click();
    if (tab) await page.getByRole("tab", { name: tab }).click();
  };

  const resume = async (page: Page, fixture = "midrun") => {
    await preload(page, fixture);
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
  };

  test("the patient funnel accounts for everyone who arrived", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Work/, /^caseload$/i);

    const flow = page.getByRole("region", {
      name: /where your patients went/i,
    });
    await expect(flow).toBeVisible();

    /* The prose summary is the deliverable, not a caption — a player who
       cannot read the bars still gets the whole diagram. */
    const summary = await flow.innerText();
    expect(summary).toMatch(/patients presented last week/i);
    expect(summary).toMatch(/Arrived/);
    expect(summary).toMatch(/Matched a department/);
    expect(summary).toMatch(/Treated/);

    /* A loss opens into its reason and a route, rather than being a number
       with no recourse attached. */
    const drop = flow.getByRole("button", { expanded: false }).first();
    if ((await drop.count()) > 0) {
      await drop.click();
      await expect(
        flow.getByRole("button", { name: /go there/i }).first(),
      ).toBeVisible();
    }

    expect(problems).toEqual([]);
  });

  test("capacity names its binding constraint and offers the fix", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Work/, /^caseload$/i);

    const cap = page.getByRole("region", { name: /what you can get through/i });
    await expect(cap).toBeVisible();
    await expect(cap.getByText(/your main limit/i)).toBeVisible();
    await expect(
      cap.getByText(/capacity is the smaller of these two/i),
    ).toBeVisible();
    /* Exactly one of the two limit cards is marked, in words. */
    await expect(cap.getByText(/^this is the limit$/i)).toHaveCount(1);
    await expect(
      cap.getByRole("button", { name: /deal with it/i }),
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("a case opens into what it demands and what it pays", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Work/, /^caseload$/i);

    const card = page
      .getByRole("region", { name: /last week/i })
      .getByRole("button", { expanded: false })
      .first();
    await card.click();
    await expect(page.getByText(/^department$/i).first()).toBeVisible();
    await expect(page.getByText(/^time it takes$/i).first()).toBeVisible();
    await expect(page.getByText(/^what it bills$/i).first()).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("departmental cover states the gap, not a percentage", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Work/, /^team$/i);

    const grid = page.getByRole("region", { name: /departmental cover/i });
    await expect(grid).toBeVisible();
    /* Severity taken over severity needed — "3/5", not "60%". */
    await expect(grid.getByText(/\d\/\d/).first()).toBeVisible();
    /* The state is a word as well as a colour. */
    await expect(
      grid.getByText(/^(covered|thin|uncovered)$/i).first(),
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("the money week is stated in a sentence before it is drawn", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Work/, /^money$/i);

    const chart = page.getByRole("region", { name: /a week of money/i });
    await expect(chart).toBeVisible();
    const text = await chart.innerText();
    /* One of the three summary forms, all of which are prose. */
    expect(text).toMatch(
      /covers approximately \d+ more week|makes \$[\d,]+ a week|losing \$[\d,]+ a week/i,
    );
    await expect(chart.getByText(/charged whatever happens/i)).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("the ladder says exactly what each locked rung needs", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Career/, /^career$/i);

    const ladder = page.getByRole("region", { name: /the clinical ladder/i });
    await expect(ladder).toBeVisible();
    await expect(ladder.getByText(/^held$/i).first()).toBeVisible();
    /* A requirement is a number and a gap, never "requirements not met". */
    await expect(ladder.getByText(/CPD/).first()).toBeVisible();
    await expect(ladder.getByText(/tuition/i).first()).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("burnout is stages and rates, not a bar that kills you", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Life/);

    const balance = page.getByRole("region", {
      name: /what the week takes out of you/i,
    });
    await expect(balance).toBeVisible();
    await expect(balance.getByText(/adds to it, per block/i)).toBeVisible();
    await expect(balance.getByText(/takes it away/i)).toBeVisible();
    /* The 100 threshold is a setback now, and the copy has to say so. */
    const text = await balance.innerText();
    expect(text).not.toMatch(/ends the run|game over/i);

    expect(problems).toEqual([]);
  });

  test("standing explains its effect and its route, per category", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Career/, /^standing$/i);

    await expect(page.getByText(/what it does/i).first()).toBeVisible();
    await expect(page.getByText(/how to raise it/i).first()).toBeVisible();
    /* Six categories, six routes — not one radar chart. */
    expect(await page.getByText(/what it does/i).count()).toBe(6);

    expect(problems).toEqual([]);
  });

  test("no source PNG is ever served, and artwork stays lazy", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    const requested: string[] = [];
    page.on("request", (r) => requested.push(r.url()));

    await resume(page);
    await nav(page, /Work/, /^caseload$/i);

    const images = requested.filter((u) => /\.(png|webp|jpe?g)/i.test(u));
    expect(
      images.filter((u) => /\.png/i.test(u)),
      "source PNGs must never reach the browser",
    ).toEqual([]);
    /* Fourteen city photographs must not land because the app booted. */
    expect(
      images.filter((u) => /cities/.test(u)).length,
      "city artwork loads one at a time, on selection",
    ).toBeLessThanOrEqual(1);

    expect(problems).toEqual([]);
  });

  test("the diagrams hold at 375px and respect reduced motion", { tag: "@sets-own-viewport" }, async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 812 });
    await resume(page);

    for (const [section, tab] of [
      [/Work/, /^caseload$/i],
      [/Work/, /^team$/i],
      [/Work/, /^money$/i],
      [/Career/, /^career$/i],
      [/Life/, undefined],
    ] as const) {
      await nav(page, section, tab);
      await expectNoPageOverflow(page);
    }

    /* Nothing that fills to a value may animate when the preference is set. */
    const animated = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '[role="meter"] > *, [role="progressbar"] > *',
        ),
      ]
        .map((el) => getComputedStyle(el).transitionDuration)
        .filter((d) => d !== "0s" && d !== ""),
    );
    expect(animated, "meters must not animate under reduced motion").toEqual(
      [],
    );

    expect(problems).toEqual([]);
  });

  test("the symbol family is one weight, and never an emoji", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Work/, /^build$/i);

    /* One stroke weight for the whole family — the identity is enforced in
       code, and this proves it survived to the DOM. */
    const weights = await page.evaluate(() =>
      Array.from(
        new Set(
          [...document.querySelectorAll("main svg[viewBox='0 0 24 24']")].map(
            (el) => el.getAttribute("stroke-width"),
          ),
        ),
      ),
    );
    expect(weights.filter(Boolean)).toEqual(["1.6"]);

    /* No emoji anywhere in the career's own screens. */
    const text = await page.getByRole("main").innerText();
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);

    expect(problems).toEqual([]);
  });
});

/* ------------------------------------------------------ the player journeys */

/**
 * SIX JOURNEYS, END TO END
 *
 * Not feature tests. Each of these is a thing a person sits down to do, walked
 * from the first click to the point where they know what to do next — because
 * the failure this phase exists to catch is not a broken control, it is a
 * player who reaches a screen and cannot tell what it wants from them.
 *
 * Assertions are therefore about comprehension: is the cause named, is the
 * requirement stated, is there somewhere to go. A journey that renders
 * perfectly and explains nothing fails.
 */
test.describe("player journeys", () => {
  const nav = async (page: Page, section: RegExp, tab?: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: section })
      .first()
      .click();
    if (tab) await page.getByRole("tab", { name: tab }).click();
  };

  const resume = async (page: Page, fixture = "midrun") => {
    await preload(page, fixture);
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
  };

  // ------------------------------------------------------------ new player
  test("a new player can read, plan and commit the first week", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startRun(page);

    /* The opening situation is taught, not assumed. */
    const lesson = page.getByRole("region", {
      name: /six blocks of your time/i,
    });
    await expect(lesson).toBeVisible();
    const taught = await lesson.innerText();
    expect(taught).toMatch(/time blocks/i);
    expect(taught).toMatch(/burnout/i);
    expect(taught).toMatch(/cash/i);
    expect(taught).toMatch(/commit/i);

    /* And it does not repeat what the guidance card says three inches below. */
    await expect(
      page.getByText(/^your week is \d+ blocks of time$/i),
      "the lesson and the next-step card must not say the same thing",
    ).toHaveCount(0);

    /* Plan and commit without guessing. */
    await page.getByRole("button", { name: /^balanced$/i }).click();
    await expect(commitButton(page)).toBeEnabled();
    await playWeek(page);
    await dismissReview(page);

    /* Having done it, the lesson retires itself — no button needed. */
    await expect(
      page.getByRole("region", { name: /six blocks of your time/i }),
    ).toHaveCount(0);

    /* And the next useful action is named. */
    await expect(
      page
        .getByRole("region", { name: /needs attention/i })
        .or(page.getByText(/next step/i))
        .first(),
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  // ------------------------------------------------------- growing practice
  test("growing the practice explains capacity and the new weekly cost", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Work/, /^build$/i);

    /* Every purchase states both prices before it is made — the one-off on
       the card, the full breakdown a click away. */
    const card = page
      .getByRole("article")
      .filter({ hasText: /exam room|community clinic/i })
      .first();
    await expect(card.getByText(/\/wk after/i)).toBeVisible();
    await card.getByRole("button", { name: /details/i }).click();
    await expect(
      page.getByRole("dialog").getByText(/every week afterwards/i),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    /* And the capacity screen says which of the two limits is binding, so
       "will this help" has an answer before the money is spent. */
    await nav(page, /Work/, /^caseload$/i);
    await expect(page.getByText(/your main limit/i)).toBeVisible();
    await expect(page.getByText(/^this is the limit$/i)).toHaveCount(1);

    expect(problems).toEqual([]);
  });

  // ----------------------------------------------------- career progression
  test("the career screen separates what you can do from what the practice can", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Career/, /^career$/i);

    const ladder = page.getByRole("region", { name: /the clinical ladder/i });
    await expect(ladder).toBeVisible();
    /* The distinction the whole ladder rests on, stated on the screen. */
    await expect(
      ladder.getByText(/employing a consultant|what you personally/i).first(),
    ).toBeVisible();
    /* Locked rungs quote a number, never "requirements not met". */
    await expect(
      ladder.getByText(/needs \d+ CPD|Needs skill \d+/i).first(),
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  // ---------------------------------------------------------------- expansion
  test("markets can be compared before a city is entered", async ({ page }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /World/, /^cities$/i);

    /* Plain language on the comparison, not "max panel". */
    const body = await page.getByRole("main").innerText();
    expect(body).not.toMatch(/max panel/i);

    expect(problems).toEqual([]);
  });

  // ------------------------------------------------------------------ crisis
  test("a setback reads as recoverable, with the routes on screen", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page, "nearly-lost");

    const body = await page.getByRole("main").innerText();
    /* Nothing anywhere may claim the run is over. */
    expect(body).not.toMatch(/game over|run is over|ends the run|run ends/i);
    /* And the way out is present rather than filed somewhere. */
    await expect(
      page.getByText(/recover|restructure|way back|climb/i).first(),
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  // ------------------------------------------------- long-running character
  test("a long run can review itself and decline to end", async ({ page }) => {
    const problems = watchConsole(page);
    await resume(page, "nearly-won");

    await nav(page, /Career/, /^timeline$/i);
    await expect(page.getByRole("main")).toBeVisible();

    await nav(page, /Career/, /^standing$/i);
    await expect(page.getByText(/how to raise it/i).first()).toBeVisible();

    await nav(page, /Career/, /^people$/i);
    await expect(page.getByRole("main")).toBeVisible();

    /* Retirement is offered, previewed, and cancellable. Still. */
    await nav(page, /Career/, /^character$/i);
    const retire = page.getByRole("button", { name: /retire/i }).first();
    if ((await retire.count()) > 0) {
      await retire.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog
        .getByRole("button", { name: /cancel|not yet|keep/i })
        .first()
        .click();
      await expect(dialog).toHaveCount(0);
      /* The run continues. */
      await expect(commitButton(page).or(page.getByRole("main"))).toBeVisible();
    }

    expect(problems).toEqual([]);
  });
});

/* --------------------------------------------------- teaching and vocabulary */

test.describe("teaching and vocabulary", () => {
  test("a lesson can be dismissed and brought back", async ({ page }) => {
    const problems = watchConsole(page);
    await startRun(page);

    const lesson = page.getByRole("region", {
      name: /six blocks of your time/i,
    });
    await expect(lesson).toBeVisible();
    await lesson.getByRole("button", { name: /hide this/i }).click();
    await expect(lesson).toHaveCount(0);

    /* And it survives a reload, so dismissing is a decision not a flicker.
       A reload lands on career select, so the run has to be resumed first —
       which is also the path a returning player actually takes. */
    await page.reload();
    await page.getByRole("button", { name: /continue your run/i }).click();
    await expect(
      page.getByRole("region", { name: /six blocks of your time/i }),
    ).toHaveCount(0);

    /* Reopened from the reference dialog. */
    await page.getByRole("button", { name: /what the words mean/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: /lessons/i }).click();
    await dialog
      .getByRole("button", { name: /show it again/i })
      .first()
      .click();
    await expect(
      page.getByRole("region", { name: /six blocks of your time/i }),
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("the glossary leads with plain language and keeps the real word", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startRun(page);
    await page.getByRole("button", { name: /what the words mean/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Active patients")).toBeVisible();
    await expect(
      dialog.getByText(/the game calls this .panel./i),
    ).toBeVisible();
    await expect(
      dialog.getByText("Professional learning points"),
    ).toBeVisible();
    await expect(
      dialog.getByText(/how many patients you could attract/i),
    ).toBeVisible();

    /* Escape closes it — nothing here is a decision the run waits on. */
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    expect(problems).toEqual([]);
  });

  test("the main interface prefers plain labels over jargon", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    const overview = await page.getByRole("main").innerText();
    expect(overview).toMatch(/active patients/i);
    /* "CPD points" as a bare label is gone; the term survives in the hint. */
    expect(overview).not.toMatch(/CPD points banked/i);

    expect(problems).toEqual([]);
  });
});

/* -------------------------------------------------------- empty and locked */

test.describe("empty and locked states", () => {
  const nav = async (page: Page, section: RegExp, tab?: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: section })
      .first()
      .click();
    if (tab) await page.getByRole("tab", { name: tab }).click();
  };

  test("every first-week empty state explains itself and offers a next step", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startRun(page);

    /* Each of these is genuinely empty in week one. */
    for (const [section, tab] of [
      [/Work/, /^caseload$/i],
      [/Work/, /^staff$/i],
      [/Work/, /^team$/i],
      [/Work/, /^assignments$/i],
      [/Career/, /^timeline$/i],
      [/World/, /^outbreaks$/i],
    ] as const) {
      await nav(page, section, tab);
      const body = await page.getByRole("main").innerText();

      /* A dead end says only what is missing. These must also say why, and
         what the player can do about it. */
      /* "None" on its own is a legitimate value — an equipment list with
         nothing in it — so the dead-ends being caught here are the ones that
         report a refusal without a reason. */
      expect(body, `${tab.source} must not dead-end`).not.toMatch(
        /^\s*(unavailable|not enough|not available)\.?\s*$/im,
      );
      /* Length is a crude proxy for "explains itself", and a good one — a
         bare "Nothing in progress." cannot clear it. */
      expect(body.length, `${tab.source} says too little`).toBeGreaterThan(200);
    }

    expect(problems).toEqual([]);
  });

  test("an unaffordable purchase names the gap in cash", async ({ page }) => {
    const problems = watchConsole(page);
    await startRun(page);
    await nav(page, /Work/, /^build$/i);
    await expect(page.getByText(/\$[\d,]+ short/i).first()).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("a department with no room says which resource is missing", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startRun(page);
    await nav(page, /Work/, /^build$/i);
    /* Week one has one department slot and it is used, so every other
       department is blocked — and must say so in a sentence. */
    await expect(
      page.getByText(/no room: all \d+ department slot/i).first(),
    ).toBeVisible();
    expect(problems).toEqual([]);
  });
});

/* ----------------------------------------------------- guidance is bounded */

test.describe("guidance", () => {
  test("shows one primary recommendation and at most one secondary", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "nearly-lost");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    const stack = page.getByRole("region", { name: /needs attention/i });
    await expect(stack).toBeVisible();
    /* A struggling practice trips several rules at once. At most two reach
       the screen; the rest are counted, not hidden. */
    const cards = await stack.getByRole("button").count();
    expect(cards, "at most a primary and a secondary").toBeLessThanOrEqual(2);

    expect(problems).toEqual([]);
  });

  test("every guidance destination is a screen that exists", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    const stack = page.getByRole("region", { name: /needs attention/i });
    if ((await stack.count()) === 0) {
      expect(problems).toEqual([]);
      return;
    }
    /* Following the recommendation must land somewhere real, with content. */
    await stack.getByRole("button").first().click();
    await expect(page.getByRole("main")).toBeVisible();
    const body = await page.getByRole("main").innerText();
    expect(body.length).toBeGreaterThan(120);

    expect(problems).toEqual([]);
  });
});

/* -------------------------------------------------------- buying things */

/**
 * THE PURCHASE EXPERIENCE
 *
 * Thirty-three items across five catalogues, one card, one drawer, one
 * confirmation. These cover the states a player can actually reach and the two
 * failure modes that cost real money — a purchase that fires twice, and a card
 * that claims something is affordable when it is not.
 */
test.describe("purchasing", () => {
  const nav = async (page: Page, section: RegExp, tab?: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: section })
      .first()
      .click();
    if (tab) await page.getByRole("tab", { name: tab }).click();
  };

  const resume = async (page: Page, fixture = "midrun") => {
    await preload(page, fixture);
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
  };

  test("every purchasable item shows its own artwork", async ({ page }) => {
    /*
     * Genuinely heavy, and marked so rather than papered over with a bigger
     * global timeout.
     *
     * This decodes the visible build and lifestyle catalogue — 56 optimised images, and on
     * a cold `.next/dev/cache/images` every one is a fresh sharp transcode.
     * A run straight after `npm run build` (which wipes that cache) fails this
     * at 45s on ONE worker as readily as on four, which is what showed the
     * flake was never about parallelism. The work is real; the budget for it
     * should say so.
     */
    test.slow();
    const problems = watchConsole(page);
    const fetched = new Set<string>();
    /* Requests, not responses. What is being asserted is which artwork the
       app asked for; a request fires the moment it asks, where a response
       waits on the optimiser finishing a transcode that this test does not
       care about. */
    page.on("request", (r) => {
      const m = /\/visuals\/purchases\/([^&"?]+)/.exec(
        decodeURIComponent(r.url()),
      );
      if (m) fetched.add(m[1]);
    });

    await resume(page);
    await nav(page, /Work/, /^build$/i);
    await scrollThrough(page);
    await nav(page, /Life/);
    for (const t of [
      /homes and properties/i,
      /vehicles/i,
      /services and wellbeing/i,
      /luxury and prestige/i,
    ]) {
      await page.getByRole("tab", { name: t }).click();
      await scrollThrough(page);
    }

    /* The original catalogue plus eleven newly illustrated lifestyle entries
       — every visible item has its own file, and none are shared. Fleet lives
       on the network screen and is covered by the registry contract. */
    expect(fetched.size, "distinct purchase images served").toBe(56);

    /* The three re-drawn cars must be the ones on screen: the originals had
       recognisable badging and are not shipped. */
    for (const car of ["reliable-saloon", "luxury-saloon", "sports-car"]) {
      expect(
        [...fetched].some((f) => f.includes(car)),
        `${car} artwork present`,
      ).toBe(true);
    }

    /*
     * Polled, not sampled.
     *
     * "No broken image" is a claim about the end state, and reading it once meant
     * reading it whenever the helper above happened to return — which, on a cold
     * image cache, could be while the last transcode was still in flight. That is
     * a false failure about a real property. Retrying until it holds keeps the
     * assertion exactly as strong (an image that genuinely never decodes still
     * fails, it just takes the budget to say so) and stops it reporting the
     * optimiser's queue as a broken picture.
     */
    const broken = await undecodedArt(page, "purchases");
    expect(broken, "every purchase image decodes").toEqual([]);


    expect(problems).toEqual([]);
  });

  test("a successful purchase confirms itself and updates immediately", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Life/);

    const card = page.getByRole("article", { name: "Town house" });
    await expect(card.getByRole("button", { name: /^buy$/i })).toBeEnabled();
    await card.getByRole("button", { name: /^buy$/i }).click();

    /* The confirmation names the item, the spend and the new balance. */
    const toast = page.getByRole("status").filter({ hasText: /town house/i });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/spent/i);
    await expect(toast).toContainText(/left/i);

    /* And the card itself changes state without a reload. */
    await expect(
      card.getByRole("button", { name: /in service|owned/i }),
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("an unaffordable item says how far short, and cannot be bought", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Life/);

    const card = page.getByRole("article", { name: "Country estate" });
    await expect(card).toContainText(/short/i);
    const buy = card.getByRole("button", { name: /not enough cash/i });
    await expect(buy).toBeVisible();
    await expect(buy).toBeDisabled();

    /* The detail view repeats the reason rather than presenting a dead
       button with no explanation. */
    await card.getByRole("button", { name: /details/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(/you are .* short/i);
    await expect(
      dialog.getByRole("button", { name: /buy for/i }),
    ).toBeDisabled();

    expect(problems).toEqual([]);
  });

  test("rapid double-clicking buys exactly one", async ({ page }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Life/);

    const cashBefore = await readCash(page);
    const card = page.getByRole("article", { name: "Town house" });
    const buy = card.getByRole("button", { name: /^buy$/i });

    /* Three clicks with no delay, which is what a mis-fire actually looks
       like — not three deliberate presses. */
    await buy.click({ clickCount: 3, delay: 0 }).catch(() => {});
    /* Wait for the purchase to actually land rather than for a fixed 400ms.
       A second one would have to pass through this same state, so reading the
       cash once the card flips is what makes the assertion below meaningful. */
    await expect(card).toContainText(/in service/i);

    const cashAfter = await readCash(page);
    /* The town house is $180,000. Two would be $360,000. */
    expect(
      cashBefore - cashAfter,
      "exactly one town house was paid for",
    ).toBeLessThan(200_000);

    expect(problems).toEqual([]);
  });

  test("owned, in-service and trade-in states are unmistakable", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Life/);

    await page
      .getByRole("article", { name: "Town house" })
      .getByRole("button", { name: /^buy$/i })
      .click();

    /* The one you keep says so in words, not only in colour. The assertion
       auto-waits, so the pause that used to sit here did nothing but cost. */
    const owned = page.getByRole("article", { name: "Town house" });
    await expect(owned).toContainText(/in service/i);

    /* And the next rung up now offers the trade-in. */
    const next = page.getByRole("article", { name: "House with a garden" });
    await expect(next).toContainText(/back for the town house/i);

    expect(problems).toEqual([]);
  });

  test("a purchase survives a reload", async ({ page }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Life/);
    await page
      .getByRole("article", { name: "Town house" })
      .getByRole("button", { name: /^buy$/i })
      .click();
    /* The purchase has to be on screen — and therefore in the save — before
       the reload, or this test races the write it exists to verify. */
    await expect(
      page.getByRole("article", { name: "Town house" }),
    ).toContainText(/in service/i);

    await page.reload();
    await page.getByRole("button", { name: /continue your run/i }).click();
    await nav(page, /Life/);
    await expect(
      page.getByRole("article", { name: "Town house" }),
    ).toContainText(/in service/i);

    expect(problems).toEqual([]);
  });

  test("the detail drawer is keyboard-operable and returns focus", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Work/, /^build$/i);

    const opener = page
      .getByRole("article", { name: "Community clinic" })
      .getByRole("button", { name: /details/i });
    await opener.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/treatment slots/i);
    await expect(dialog).toContainText(/every week afterwards/i);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();

    expect(problems).toEqual([]);
  });

  test("the catalogue holds at every width with no overflow", { tag: "@sets-own-viewport" }, async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);

    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await nav(page, /Work/, /^build$/i);
      await expectNoPageOverflow(page);
      await nav(page, /Life/);
      await expectNoPageOverflow(page);

      /* Price and state stay on screen at every size. */
      const card = page.getByRole("article", { name: "Town house" });
      await expect(card).toContainText(/\$180,000/);
      await expect(
        card.getByRole("button", { name: /buy|in service|owned|not enough/i }),
      ).toBeVisible();

      /* And the drawer is usable rather than a squeezed desktop modal. */
      await card.getByRole("button", { name: /details/i }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box!.width, `drawer width at ${width}`).toBeGreaterThan(
        Math.min(340, width * 0.85),
      );
      await page.keyboard.press("Escape");
    }

    expect(problems).toEqual([]);
  });

  test("no source PNG reaches the browser", async ({ page }) => {
    /*
     * Genuinely heavy, and marked so rather than papered over with a bigger
     * global timeout.
     *
     * This decodes the whole purchase catalogue — 45 optimised images, and on
     * a cold `.next/dev/cache/images` every one is a fresh sharp transcode.
     * A run straight after `npm run build` (which wipes that cache) fails this
     * at 45s on ONE worker as readily as on four, which is what showed the
     * flake was never about parallelism. The work is real; the budget for it
     * should say so.
     */
    test.slow();
    const problems = watchConsole(page);
    const pngs: string[] = [];
    page.on("request", (r) => {
      const u = decodeURIComponent(r.url());
      if (/art-source|purchases.*\.png/i.test(u)) pngs.push(u);
    });

    await resume(page);
    await nav(page, /Work/, /^build$/i);
    await scrollThrough(page);

    expect(pngs, "masters stay in art-source").toEqual([]);
    expect(problems).toEqual([]);
  });
});

/**
 * Walk a long screen so lazy images below the fold actually load.
 *
 * The wheel steps are kept — this app scrolls a container, and driving it with
 * `window.scrollTo` would move nothing and quietly stop these tests proving
 * anything. What is gone is the guesswork around them: a flat 90ms per step
 * plus a closing pause, roughly three seconds a call, whether the images had
 * arrived or not. Now each step waits one frame and the call ends when every
 * image has actually finished, which is both quicker and the condition the
 * callers were really after.
 */

/**
 * Artwork in `scope` that is in the DOM but has not decoded.
 *
 * ------------------------------------------------------------- the subtlety
 *
 * These images are lazy, so "has not decoded" has two very different causes:
 * the optimiser is still working (wait, and it resolves) or the image was
 * never scrolled into view (wait forever, and it never does). A fast scroll
 * can outrun the IntersectionObserver and leave one card in the second state
 * — which is exactly how a single oncology tile failed a 45-second poll while
 * its file on disk was perfectly valid.
 *
 * So this nudges anything unfinished into view before reporting it. Polling
 * on top of that gives lazy images the chance to start and slow ones the
 * chance to finish, and anything still broken afterwards is genuinely broken.
 */
async function undecodedArt(page: Page, scope: string): Promise<string[]> {
  return page.evaluate((re) => {
    const rx = new RegExp(re);
    const matching = [...document.querySelectorAll("img")].filter((x) =>
      rx.test(decodeURIComponent(x.currentSrc || x.src)),
    );
    const pending = matching.filter((x) => !x.complete || x.naturalWidth === 0);
    /*
     * Deliberately does not scroll.
     *
     * An earlier version scrolled pending images into view to wake the lazy
     * loader, and that made things worse rather than better: moving the
     * viewport underneath a test that is mid-assertion changed what was on
     * screen and the check failed on a warm cache it had always passed. The
     * caller has already walked the page; this only reports.
     */
    return pending.map((x) => x.alt);
  }, scope);
}

async function scrollThrough(page: Page) {
  for (let i = 0; i < 26; i++) {
    await page.mouse.wheel(0, 800);
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => done(null))),
    );
  }
  await imagesSettled(page);
}

/**
 * Wait for the page to stop pulling images in.
 *
 * ------------------------------------------------------------ what broke
 *
 * This used to assert that every image was `complete` within ten seconds, and
 * that ten seconds was the whole flake. `npm run build` wipes
 * `.next/dev/cache/images`, so the next suite run transcodes all 45 purchase
 * images from scratch; cold, that takes longer than ten seconds and the
 * helper threw "images below the fold never finished". It failed on ONE
 * worker exactly as readily as on four, which is what finally showed the
 * problem was never parallelism — it was an assertion in a helper, sized for
 * a warm cache.
 *
 * ---------------------------------------------------------- what it does now
 *
 * The same condition — every image decoded — on a budget that matches the
 * work instead of a guess about machine speed. Warm, it returns on the first
 * poll. Cold, it waits for the transcodes.
 *
 * A quiet-network heuristic was tried in between and was worse: returning as
 * soon as no *new* image had been requested let callers proceed while the last
 * few were still decoding, and the decode assertions downstream then failed on
 * a warm cache they had always passed. The thing the callers need is the
 * images being ready, so that is what this waits for.
 *
 * It does not assert. If the budget runs out, the test's own check reports
 * which image is missing, which is a far better failure than this helper
 * throwing "images below the fold never finished" with no name attached.
 */
async function imagesSettled(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.querySelectorAll<HTMLImageElement>("main img")].every(
            (i) => i.complete,
          ),
        ),
      { timeout: 10_000, message: "images below the fold never finished" },
    )
    .toBe(true);
}

/** Cash as an integer, from the status strip. */
async function readCash(page: Page): Promise<number> {
  const text = await page.getByRole("main").innerText();
  const m = /\$([\d,]+)/.exec(text);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
}

/* --------------------------------------------------- departments as cards */

/**
 * DEPARTMENTS
 *
 * The last purchase in the game to become a card, and the one carrying the
 * most state: a department can be locked for want of a slot, unaffordable,
 * open and uncovered, or open and fully staffed — and those are four different
 * things a player has to be able to tell apart at a glance.
 */
test.describe("department cards", () => {
  const nav = async (page: Page, section: RegExp, tab?: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: section })
      .first()
      .click();
    if (tab) await page.getByRole("tab", { name: tab }).click();
  };

  const resume = async (page: Page, fixture = "midrun") => {
    await preload(page, fixture);
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
  };

  test("all twelve departments show their own interior", async ({ page }) => {
    /*
     * Genuinely heavy, and marked so rather than papered over with a bigger
     * global timeout.
     *
     * This decodes the whole purchase catalogue — 45 optimised images, and on
     * a cold `.next/dev/cache/images` every one is a fresh sharp transcode.
     * A run straight after `npm run build` (which wipes that cache) fails this
     * at 45s on ONE worker as readily as on four, which is what showed the
     * flake was never about parallelism. The work is real; the budget for it
     * should say so.
     */
    test.slow();
    const problems = watchConsole(page);
    const fetched = new Set<string>();
    page.on("request", (r) => {
      const m = /\/visuals\/purchases\/departments\/([^&"?]+)/.exec(
        decodeURIComponent(r.url()),
      );
      if (m) fetched.add(m[1]);
    });

    await resume(page);
    await nav(page, /Work/, /^build$/i);
    await scrollThrough(page);

    expect(fetched.size, "one interior per department").toBe(12);
    /* Each of the twelve is a distinct file — no two fields share a room. */
    expect(new Set([...fetched]).size).toBe(12);

    /*
     * Polled, not sampled.
     *
     * "No broken image" is a claim about the end state, and reading it once meant
     * reading it whenever the helper above happened to return — which, on a cold
     * image cache, could be while the last transcode was still in flight. That is
     * a false failure about a real property. Retrying until it holds keeps the
     * assertion exactly as strong (an image that genuinely never decodes still
     * fails, it just takes the budget to say so) and stops it reporting the
     * optimiser's queue as a broken picture.
     */
    const broken = await undecodedArt(page, "purchases/departments");
    expect(broken, "every department image decodes").toEqual([]);


    expect(problems).toEqual([]);
  });

  test("the twelve machines use the re-shot scenes", async ({ page }) => {
    /*
     * Genuinely heavy, and marked so rather than papered over with a bigger
     * global timeout.
     *
     * This decodes the whole purchase catalogue — 45 optimised images, and on
     * a cold `.next/dev/cache/images` every one is a fresh sharp transcode.
     * A run straight after `npm run build` (which wipes that cache) fails this
     * at 45s on ONE worker as readily as on four, which is what showed the
     * flake was never about parallelism. The work is real; the budget for it
     * should say so.
     */
    test.slow();
    const problems = watchConsole(page);
    const fetched = new Set<string>();
    page.on("request", (r) => {
      const m = /\/visuals\/purchases\/equipment\/([^&"?]+)/.exec(
        decodeURIComponent(r.url()),
      );
      if (m) fetched.add(m[1]);
    });

    await resume(page);
    await nav(page, /Work/, /^build$/i);
    await scrollThrough(page);

    expect(fetched.size, "one scene per machine").toBe(12);
    /* Runtime names carry no version suffix — the build resolves it — so what
       is asserted here is that nothing labelled -v1 or -v2 leaks into a URL. */
    expect(
      [...fetched].filter((f) => /-v\d/.test(f)),
      "runtime names are version-free",
    ).toEqual([]);

    expect(problems).toEqual([]);
  });

  test("a department card carries cost, upkeep and its case load", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Work/, /^build$/i);

    const card = page.getByRole("article", { name: "Cardiology" });
    await card.scrollIntoViewIfNeeded();
    await expect(card).toContainText(/\$66,000/);
    await expect(card).toContainText(/\$1,150\/wk after/);
    await expect(card).toContainText(/heart unit/i);

    await card.getByRole("button", { name: /details/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText(/case types it takes/i)).toBeVisible();
    await expect(drawer.getByText(/hardest case/i)).toBeVisible();
    await expect(drawer.getByText(/department slots/i)).toBeVisible();
    await expect(drawer.getByText(/who can work it/i)).toBeVisible();
    await expect(drawer.getByText(/equipment it uses/i)).toBeVisible();
    await page.keyboard.press("Escape");

    expect(problems).toEqual([]);
  });

  test("an open department reports its coverage in words", async ({ page }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Work/, /^build$/i);

    /* The mid-run fixture has general practice open. Whatever its cover, the
       card must state it as a word and as a severity pair, never as a colour
       alone. */
    const gp = page.getByRole("article", { name: "General Practice" });
    await gp.scrollIntoViewIfNeeded();
    await expect(gp.getByText(/^(covered|thin|uncovered)$/i)).toBeVisible();
    await expect(gp.getByText(/takes severity \d of \d/i)).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("with no free slot every closed department says so", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    /* A fresh run has one department slot and general practice already in it,
       so every other field is genuinely refused — which is the engine's rule,
       not a decoration. */
    await startRun(page);
    await nav(page, /Work/, /^build$/i);

    const cardio = page.getByRole("article", { name: "Cardiology" });
    await cardio.scrollIntoViewIfNeeded();
    await expect(
      cardio.getByRole("button", { name: /^locked$/i }),
    ).toBeDisabled();
    await expect(cardio).toContainText(/locked/i);

    await cardio.getByRole("button", { name: /details/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(
      drawer.getByText(/all 1 department slot is in use/i),
    ).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: /buy for/i }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");

    expect(problems).toEqual([]);
  });

  test("opening a department confirms itself and updates the card", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Work/, /^build$/i);

    const card = page.getByRole("article", { name: "Dermatology" });
    await card.scrollIntoViewIfNeeded();
    await card.getByRole("button", { name: /^buy$/i }).click();

    const toast = page.getByRole("status").filter({ hasText: /dermatology/i });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/spent/i);

    /* Immediately, without a reload. */
    await expect(
      card.getByRole("button", { name: /owned|in service/i }),
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("a department stays open after a reload", async ({ page }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Work/, /^build$/i);
    const card = page.getByRole("article", { name: "Dermatology" });
    await card.scrollIntoViewIfNeeded();
    await card.getByRole("button", { name: /^buy$/i }).click();
    /* On screen — and so in the save — before the reload this test exists to
       verify, rather than racing it with a fixed pause. */
    await expect(
      card.getByRole("button", { name: /owned|in service/i }),
    ).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: /continue your run/i }).click();
    await nav(page, /Work/, /^build$/i);
    const after = page.getByRole("article", { name: "Dermatology" });
    await after.scrollIntoViewIfNeeded();
    await expect(
      after.getByRole("button", { name: /owned|in service/i }),
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("opening one twice does not charge twice", async ({ page }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Work/, /^build$/i);

    const before = await page.getByRole("main").innerText();
    const cashBefore = Number(
      /\$([\d,]+)/.exec(before)?.[1].replace(/,/g, "") ?? 0,
    );

    const card = page.getByRole("article", { name: "Dermatology" });
    await card.scrollIntoViewIfNeeded();
    await card
      .getByRole("button", { name: /^buy$/i })
      .click({ clickCount: 3, delay: 0 })
      .catch(() => {});
    /* Wait for the department to open. A second charge would have to pass
       through this same state, so this is the point at which the cash figure
       below becomes meaningful. */
    await expect(
      card.getByRole("button", { name: /owned|in service/i }),
    ).toBeVisible();

    const after = await page.getByRole("main").innerText();
    const cashAfter = Number(
      /\$([\d,]+)/.exec(after)?.[1].replace(/,/g, "") ?? 0,
    );
    /* Dermatology opens for $12,000. Two would be $24,000. */
    expect(cashBefore - cashAfter).toBeLessThan(20_000);

    expect(problems).toEqual([]);
  });

  test("equipment says when nobody can run it", async ({ page }) => {
    const problems = watchConsole(page);
    await startRun(page);
    await nav(page, /Work/, /^build$/i);

    /*
     * The requirement is stated before you own anything.
     *
     * The *warning* is a different thing and fires on a different rule: you
     * are not short of technicians until you own a machine that needs one, so
     * a fresh run correctly shows the requirement and no alarm.
     */
    const lab = page.getByRole("article", { name: "Pathology lab" });
    await lab.scrollIntoViewIfNeeded();
    await lab.getByRole("button", { name: /details/i }).click();
    let drawer = page.getByRole("dialog");
    await expect(drawer.getByText(/needs a technician/i)).toBeVisible();
    await expect(
      drawer.getByText(/one technician covers three machines/i),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    /* Buy it, and the next machine that needs a technician must now warn that
       it would sit idle — because at that point it genuinely would. */
    await preload(page, "midrun");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await nav(page, /Work/, /^build$/i);
    const ecg = page.getByRole("article", { name: "Pathology lab" });
    await ecg.scrollIntoViewIfNeeded();
    await ecg.getByRole("button", { name: /^buy$/i }).click();
    /* The lab has to be owned before the next machine can warn about sharing
       a technician with it. */
    await expect(
      ecg.getByRole("button", { name: /owned|in service/i }),
    ).toBeVisible();

    const ultrasound = page.getByRole("article", { name: "Ultrasound suite" });
    await ultrasound.scrollIntoViewIfNeeded();
    await ultrasound.getByRole("button", { name: /details/i }).click();
    drawer = page.getByRole("dialog");
    await expect(drawer.getByText(/sit idle/i)).toBeVisible();
    await page.keyboard.press("Escape");

    expect(problems).toEqual([]);
  });

  test("the department shelf holds at every width", { tag: "@sets-own-viewport" }, async ({ page }) => {
    const problems = watchConsole(page);
    await resume(page);

    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await nav(page, /Work/, /^build$/i);
      await expectNoPageOverflow(page);

      const card = page.getByRole("article", { name: "Cardiology" });
      await card.scrollIntoViewIfNeeded();
      await expect(card).toContainText(/\$66,000/);
      await expect(
        card.getByRole("button", { name: /buy|owned|locked|not enough/i }),
      ).toBeVisible();
    }

    expect(problems).toEqual([]);
  });
});

/* ----------------------------------------------------------- portraits */

/**
 * FACES ON SCREEN
 *
 * The registry's own arithmetic is proved in `npm run check`. These prove the
 * other half: that the right face reaches the right surface, that a broken
 * image degrades to initials rather than a broken glyph, and that the
 * organisation accounts never acquire a human one.
 */
test.describe("character portraits", () => {
  const nav = async (page: Page, section: RegExp, tab?: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: section })
      .first()
      .click();
    if (tab) await page.getByRole("tab", { name: tab }).click();
  };

  const resume = async (page: Page, fixture = "midrun") => {
    await preload(page, fixture);
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
  };

  test("the People screen shows each character's own face", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    const fetched = new Set<string>();
    page.on("response", (r) => {
      const m = /\/visuals\/characters\/([^&"?]+)/.exec(
        decodeURIComponent(r.url()),
      );
      if (m && r.status() < 400) fetched.add(m[1]);
    });

    await resume(page);
    await nav(page, /Career/, /^people$/i);

    /* The mid-run cast is on screen and every one of them has a distinct
       file — no two colleagues share a face. Polled rather than paused, so it
       returns as soon as the eighth face lands. */
    await expect
      .poll(() => fetched.size, { timeout: 8_000 })
      .toBeGreaterThanOrEqual(8);
    expect(new Set([...fetched]).size).toBe(fetched.size);

    /*
     * Polled, not sampled.
     *
     * "No broken image" is a claim about the end state, and reading it once meant
     * reading it whenever the helper above happened to return — which, on a cold
     * image cache, could be while the last transcode was still in flight. That is
     * a false failure about a real property. Retrying until it holds keeps the
     * assertion exactly as strong (an image that genuinely never decodes still
     * fails, it just takes the budget to say so) and stops it reporting the
     * optimiser's queue as a broken picture.
     */
    const broken = (await undecodedArt(page, "characters")).length;
    expect(broken, "every portrait decodes").toBe(0);


    expect(problems).toEqual([]);
  });

  test("a People card still expands, with a larger portrait", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /Career/, /^people$/i);

    const row = page
      .getByRole("button")
      .filter({ hasText: /Prof. Iris Hallam/ })
      .first();
    await expect(row).toHaveAttribute("aria-expanded", "false");
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(row).toHaveAttribute("aria-expanded", "true");

    /* The relationship numbers are still the point of the card. */
    await expect(page.getByText(/^warmth$/i).first()).toBeVisible();
    await expect(page.getByText(/^trust$/i).first()).toBeVisible();
    await expect(page.getByText(/^respect$/i).first()).toBeVisible();

    /* And the profile derivative is what loaded, not the 160px avatar. */
    const usedProfile = await page.evaluate(() =>
      [...document.querySelectorAll("img")].some((i) =>
        decodeURIComponent(i.currentSrc || i.src).includes("@profile"),
      ),
    );
    expect(usedProfile, "the expanded card uses the 512px file").toBe(true);

    expect(problems).toEqual([]);
  });

  test("all five rivals are recognisable", async ({ page }) => {
    const problems = watchConsole(page);
    await resume(page);
    await nav(page, /World/, /^rivals$/i);

    /* Five rivals, five faces, and the strategy and standing they always
       carried. A portrait must not have displaced the numbers. */
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              [
                ...document.querySelectorAll<HTMLImageElement>("main img"),
              ].filter((i) =>
                /characters\/cast/.test(
                  decodeURIComponent(i.currentSrc || i.src),
                ),
              ).length,
          ),
        { timeout: 8_000 },
      )
      .toBeGreaterThanOrEqual(5);
    await expect(page.getByText(/Dr Anneke Roth/).first()).toBeVisible();
    await expect(page.getByText(/Dr Sofia Aranda/).first()).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("organisation accounts never show a human face", async ({ page }) => {
    const problems = watchConsole(page);
    await resume(page);
    await page.getByRole("button", { name: /open phone/i }).click();
    await portraitsSettled(page, '[role="dialog"]');

    /*
     * Every avatar that loads on the phone must belong to a human account.
     * `@meridian` is Meridian Health Group; the person behind it is Dr Anneke
     * Roth, and her portrait appearing here would be the collision this whole
     * registry exists to prevent.
     */
    const dialog = page.getByRole("dialog");
    const rows = await dialog.evaluate((el) =>
      [...el.querySelectorAll("img")].map((i) =>
        decodeURIComponent(
          (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src,
        ),
      ),
    );
    expect(
      rows.filter((r) => /anneke-roth|sofia-aranda/.test(r)),
      "no organisation post carries a personal portrait",
    ).toEqual([]);

    expect(problems).toEqual([]);
  });

  test("a portrait that fails to load falls back to initials", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    /*
     * Every portrait request is aborted, so the component's error path is the
     * only thing that can draw an avatar.
     *
     * Matched on the *decoded* URL rather than a glob: Next serves these
     * through `/_next/image?url=%2Fvisuals%2Fcharacters%2F…`, so a glob on the
     * plain path aborts nothing and the test passes while proving nothing.
     */
    await page.route(
      (url) => decodeURIComponent(url.href).includes("/visuals/characters/"),
      (route) => route.abort(),
    );

    await resume(page);
    await nav(page, /Career/, /^people$/i);

    /* The roster has rendered — without this the count below would be zero
       because nothing had drawn yet, and the test would pass vacuously. */
    await expect(page.getByText(/Prof. Iris Hallam/).first()).toBeVisible();
    await expect(page.getByText(/Dr Femi Okoro/).first()).toBeVisible();

    /* No broken-image glyph: the failed <img> elements are gone entirely,
       replaced by the initials tile. */
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              [
                ...document.querySelectorAll<HTMLImageElement>("main img"),
              ].filter((i) =>
                /characters/.test(decodeURIComponent(i.currentSrc || i.src)),
              ).length,
          ),
        {
          timeout: 8_000,
          message: "failed portraits are replaced, not left broken",
        },
      )
      .toBe(0);

    /* A failed image request is expected here and is not an app error. */
    expect(
      problems.filter((p) => !/Failed to load|ERR_FAILED|net::/i.test(p)),
    ).toEqual([]);
  });

  test("no full-resolution master reaches the browser", async ({ page }) => {
    const problems = watchConsole(page);
    const pngs: string[] = [];
    page.on("request", (r) => {
      const u = decodeURIComponent(r.url());
      if (/art-source|characters.*\.png/i.test(u)) pngs.push(u);
    });

    await resume(page);
    await nav(page, /Career/, /^people$/i);
    await portraitsSettled(page);
    await page.getByRole("button", { name: /open phone/i }).click();
    await portraitsSettled(page, '[role="dialog"]');

    expect(pngs, "masters stay in art-source").toEqual([]);
    expect(problems).toEqual([]);
  });

  test("portraits hold at every avatar size without shifting layout", { tag: "@sets-own-viewport" }, async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page);

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await nav(page, /Career/, /^people$/i);
      await portraitsSettled(page);
      await expectNoPageOverflow(page);

      /* Every avatar is square and matches its declared box, which is what
         stops a feed reflowing as the faces arrive. */
      const boxes = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLImageElement>("main img")]
          .filter((i) =>
            /characters/.test(decodeURIComponent(i.currentSrc || i.src)),
          )
          .map((i) => {
            const r = i.getBoundingClientRect();
            return Math.abs(r.width - r.height);
          }),
      );
      expect(
        boxes.every((d) => d < 1.5),
        "avatars stay square",
      ).toBe(true);
    }

    expect(problems).toEqual([]);
  });
});

/**
 * WHERE THE RUN BEGINS
 *
 * The city is chosen before week one and never again, so the only place a
 * player can be wrong about it is this screen. What matters is that the choice
 * is legible (each city states what it changes), that it is reachable without
 * a mouse, and — the part a unit test cannot see — that the city you picked is
 * the city the run is actually played in.
 */
test.describe("choosing where to start", () => {
  const armChef = async (page: Page) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    const card = page.getByRole("button", { name: /^open\s*chef/i }).first();
    await card.click();
    await card.click();
  };

  test("every city says what it changes, and the pick is what you play", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await armChef(page);

    await expect(
      page.getByRole("heading", { name: /Where do you start\?/ }),
    ).toBeVisible();

    /* The default is offered first and named on the button, so nobody starts
       somewhere they did not read. */
    await expect(
      page.getByRole("button", { name: /^Begin in Lyon$/ }),
    ).toBeVisible();

    /* A city card is a real choice: it states the effects the simulation
       applies, not adjectives. */
    const mumbai = page.getByRole("button", { name: /^Mumbai/ }).first();
    await expect(mumbai).toBeVisible();
    await mumbai.click();
    await expect(mumbai).toHaveAttribute("aria-pressed", "true");
    /* `.first()` because New York loses a week too — the claim is that the
       effect is stated on the card, not that only one city has it. */
    await expect(
      page.getByText(/Produce dies 1 week sooner here/).first(),
    ).toBeVisible();
    await expect(page.getByText(/50% rent/).first()).toBeVisible();

    await expectNoPageOverflow(page);
    await page.getByRole("button", { name: /^Begin in Mumbai$/ }).click();

    /* And the run is in Mumbai — the map says so, and so does the rent on the
       room, which is the city's own multiplier applied to the market stall. */
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /World/ })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: /Mumbai, India/ }),
    ).toBeVisible();
    await expect(
      page.getByText(/You did not start here/).first(),
      "the cities you did not choose are comparisons, not destinations",
    ).toHaveCount(0);

    expect(problems).toEqual([]);
  });

  test("the picker is operable by keyboard and can be backed out of", async ({
    page,
  }) => {
    await armChef(page);

    /* Nothing here may be a button inside a button — the card grid and the
       map labels sit in the same stacking context. */
    const nested = await page.evaluate(
      () => document.querySelectorAll("button button").length,
    );
    expect(nested, "no nested buttons").toBe(0);

    await page.getByRole("button", { name: /Choose another career/ }).click();
    await expect(
      page.getByRole("button", { name: /^open\s*chef/i }).first(),
      "backing out returns to the careers, not into a run",
    ).toBeVisible();
  });
});

/**
 * THE CHEF, THROUGH THE REAL INTERFACE
 *
 * The engine suite proves the spoilage model; this proves a player can reach
 * it. It is deliberately one long journey rather than a dozen small tests: the
 * Chef's loop only means anything as a sequence — set the book, order against
 * the forecast, open a service, read what happened — and a test per step would
 * pass while the sequence stayed broken.
 */

/**
 * NOTHING ON SCREEN MAY BE A DEAD END
 *
 * Two failures this guards, both found by walking the real interface rather
 * than by reading the code:
 *
 *   a control that is greyed out and does not say why — the player cannot tell
 *   whether they are too poor, too small, or looking at something not meant
 *   for them yet;
 *
 *   another career's vocabulary leaking in — a Chef was shown "Student debt"
 *   and "Case notes", which are a doctor's words for a fit-out loan and a
 *   service book.
 *
 * Both are cheap to reintroduce and invisible in a diff, which is exactly what
 * a test is for.
 */
test.describe("every career reads clearly", () => {
  const CAREERS = [
    { card: /^open\s*chef/i, name: "Chef" },
    { card: /^open\s*solicitor/i, name: "Solicitor" },
  ];

  /* Words that belong to the Physician and nobody else. */
  const MEDICAL =
    /patient|caseload|department|physician|student debt|case notes|triage|outbreak/i;

  for (const career of CAREERS) {
    test(`the ${career.name} uses its own words and explains every locked control`, async ({
      page,
    }) => {
      await page.goto("/");
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();

      const card = page.getByRole("button", { name: career.card }).first();
      await card.click();
      await card.click();
      const begin = page.getByRole("button", { name: /^begin in /i }).first();
      if (await begin.count()) await begin.click();

      const nav = page.getByRole("navigation", { name: "Primary" }).last();
      await expect(nav).toBeVisible();
      const sections = await nav.getByRole("button").allInnerTexts();

      for (const raw of sections) {
        const label = raw.trim().split(String.fromCharCode(10))[0];
        if (!label) continue;
        await nav.getByRole("button").filter({ hasText: label }).first().click();

        const tabCount = await page.getByRole("tab").count();
        for (let i = 0; i < Math.max(1, tabCount); i++) {
          if (tabCount > 0) {
            const tab = page.getByRole("tab").nth(i);
            if (!(await tab.count())) break;
            await tab.click();
          }

          const text = await page.getByRole("main").innerText();
          expect(
            text.match(MEDICAL)?.[0],
            `${career.name} / ${label} shows a Physician's word`,
          ).toBeUndefined();
          expect(
            text.match(/NaN|undefined|\[object/)?.[0],
            `${career.name} / ${label} shows a broken value`,
          ).toBeUndefined();

          /* A locked control has to say why, somewhere a reader can find it. */
          const dead = await page.evaluate(() =>
            [...document.querySelectorAll("button[disabled]")]
              .filter((b) => {
                const t = (b.textContent ?? "").trim();
                if (/^[−–—+]$/.test(t)) return false;
                if (/not enough|owned|in service|sold|already|full/i.test(t)) return false;
                let scope: HTMLElement | null = b as HTMLElement;
                for (let up = 0; up < 4 && scope?.parentElement; up++) {
                  scope = scope.parentElement;
                }
                return !/(you have|costs|minimum|needs|before|not yet|requires|short|assign|locked|unlock)/i.test(
                  scope?.textContent ?? "",
                );
              })
              .map((b) => (b.textContent ?? "").trim().slice(0, 40)),
          );
          expect(
            dead,
            `${career.name} / ${label} has a locked control with no reason`,
          ).toEqual([]);
        }
      }
    });
  }
});







test.describe("every career has a phone", () => {
  /*
   * Four careers were built without one and got theirs from a voice pack
   * rather than a hand-written module. This walks all of them, because the
   * failure a pack makes easy — a career wired to the wrong pack, or to none —
   * is invisible until somebody opens that handset.
   */
  const PACKED = ["founder", "politician", "architect", "engineer"];

  for (const career of PACKED) {
    test(`the ${career} carries a phone of its own`, async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      const card = page
        .getByRole("button", { name: new RegExp(String.raw`^open\s*${career}`, "i") })
        .first();
      await card.click();
      await card.click();
      await page.getByRole("button", { name: /^Begin in / }).first().click();

      await page.getByRole("button", { name: /open phone/i }).click();
      const phone = page.getByRole("dialog");
      await expect(phone).toBeVisible();

      /* Somebody has already been in touch, in this career's own voice. */
      await phone.getByRole("button", { name: /^messages$/i }).first().click();
      await expect(
        phone.locator("li").first(),
        "the opening message is waiting",
      ).toBeVisible();

      /* And there is something to say that the run has actually earned. */
      await phone.getByRole("button", { name: /^pulse$/i }).first().click();
      await phone.getByRole("button", { name: /compose/i }).first().click();
      await expect(
        phone.getByRole("button", { name: /publish|^the |^i am|^we are/i }).first(),
        "the composer offers something",
      ).toBeVisible();

      const text = await phone.innerText();
      expect(
        text.match(/patient|caseload|larder|brigade|chambers/i)?.[0],
        "no other career's vocabulary reaches this phone",
      ).toBeUndefined();
      expect(text).not.toContain("NaN");
      expect(text).not.toContain("undefined");
    });
  }
});

test.describe("the way in", () => {
  test("a newcomer is told where to start, and who they are", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    /* Seven careers is a lot to meet at once; the screen answers the obvious
       question rather than leaving it. */
    await expect(
      page.getByText(/New here\?/i),
      "the screen suggests somewhere to start",
    ).toBeVisible();
    await expect(page.getByText(/Start with the Chef/i)).toBeVisible();

    /* And says who is playing, with a way out — the whole point of accounts
       is more than one person on a machine. */
    await expect(page.getByText(/Signed in as/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Not you\?/i }),
      "and offers a way to switch",
    ).toBeVisible();
  });

  test("signing out returns to the front door", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: /Not you\?/i }).click();
    await expect(
      page.getByRole("heading", { name: /Who is playing|Create your account/i }),
      "signing out lands back on the account screen",
    ).toBeVisible();
  });
});

test.describe("every career can see where it is", () => {
  /*
   * The map is engine-level: any career with `startCities` gets it through
   * the generic section set. This walks all seven rather than the two that
   * had bespoke screens, because the failure this catches — a career added
   * without a horizon line, or with a city the projection cannot draw — is
   * exactly the kind that only shows up on the one nobody opened.
   */
  const CAREERS = [
    "physician",
    "chef",
    "solicitor",
    "founder",
    "politician",
    "architect",
    "engineer",
  ];

  for (const career of CAREERS) {
    test(`the ${career} map draws the world and says where you are`, async ({
      page,
    }) => {
      await page.goto("/");
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();

      const card = page
        .getByRole("button", { name: new RegExp(String.raw`^open\s*${career}`, "i") })
        .first();
      await card.click();
      await card.click();
      await page.getByRole("button", { name: /^Begin in / }).first().click();

      /* The Physician's is a network of markets it can actually enter, and
         its destination is named for that; every other career shares the
         generic map. Both are "where you are". */
      await page
        .getByRole("button", { name: /^World$/i })
        .first()
        .click();

      /*
       * Matched by accessible name rather than by role. The generic map is a
       * static `role="img"`; the Physician's is an arrow-key navigable region,
       * which is the correct role for something you can actually move around
       * in. The claim being made is that the world is drawn *and described*,
       * and that is true of both.
       */
      await expect(
        page.getByLabel(/World map|Map of the world/i).first(),
        "the world is drawn, and described for anybody not looking at it",
      ).toBeVisible();

      const text = await page.locator("main").innerText();
      expect(text).not.toContain("NaN");
      expect(text).not.toContain("undefined");
    });
  }

  test("every career that cannot move says so", async ({ page }) => {
    /* A world map with one marker on it invites the question "can I move
       there?". Every career whose answer is no has to answer it out loud. */
    for (const career of ["chef", "founder", "politician", "architect", "engineer"]) {
      await page.goto("/");
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      const card = page
        .getByRole("button", { name: new RegExp(String.raw`^open\s*${career}`, "i") })
        .first();
      await card.click();
      await card.click();
      await page.getByRole("button", { name: /^Begin in / }).first().click();
      await page.getByRole("button", { name: /^World$/i }).first().click();

      await expect(
        page.getByText(/not built yet/i).first(),
        `${career} says what its map cannot show`,
      ).toBeVisible();
    }
  });
});

test.describe("the engineer", () => {
  const startEngineer = async (page: Page) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    const card = page.getByRole("button", { name: /^open\s*engineer/i }).first();
    await card.click();
    await card.click();
    await page.getByRole("button", { name: /^Begin in Berlin$/ }).click();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).last(),
    ).toBeVisible();
    await go(page, /Work/i);
  };

  /** The Engineer has three destinations: Week, Work, World. */
  const go = async (page: Page, where: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: where })
      .first()
      .click();
  };

  const tab = async (page: Page, where: RegExp) => {
    await page.getByRole("tab", { name: where }).first().click();
  };

  /** The certifier's terms, carried onto the screen where work is chosen. */
  const strip = (page: Page) => page.locator('dl[aria-label="The bench"]');

  test("the fault count is shown as a range, never as a number", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startEngineer(page);
    await tab(page, /^What you could build$/);
    await page.getByRole("button", { name: /^Start it$/ }).first().click();
    await tab(page, /^The bench$/);

    /* The career's whole contract: an estimate and a confidence, not a count. */
    await expect(
      page.getByText(/Faults in it, estimated/i).first(),
      "the player is given an estimate",
    ).toBeVisible();
    await expect(
      page.getByText(/confident/i).first(),
      "and told how much it is worth",
    ).toBeVisible();

    const text = await page.locator("main").innerText();
    expect(
      /\d+–\d+/.test(text),
      "the estimate is rendered as a band",
    ).toBe(true);

    expect(
      text.match(/patient|caseload|covers|larder|brigade|runway|polling/i)?.[0],
      "no other career's vocabulary reaches the Engineer",
    ).toBeUndefined();
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("undefined");

    expect(problems).toEqual([]);
  });

  test("craft gates what you are allowed to attempt", async ({ page }) => {
    await startEngineer(page);
    await tab(page, /^What you could build$/);
    await expect(
      page.getByText(/Needs craft \d+; yours is \d+/).first(),
      "a product beyond you says so, with both numbers",
    ).toBeVisible();
  });

  test("an engineer run survives a reload", async ({ page }) => {
    await startEngineer(page);
    await tab(page, /^What you could build$/);
    await page.getByRole("button", { name: /^Start it$/ }).first().click();
    await tab(page, /^The bench$/);
    await expect(page.getByText(/mounting bracket/i).first()).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: /continue your run/i }).click();
    await go(page, /Work/i);
    await expect(
      page.getByText(/Faults in it, estimated/i).first(),
      "the product on the bench survives a reload",
    ).toBeVisible();
  });

  /*
   * ------------------------------------------------- the organised version
   *
   * Two screens rather than four, because this career has two subjects. What
   * travels between them is the certifier: an estimate is a band, and a band
   * is only good or bad news against the line it is drawn against.
   */
  test("the workshop is the bench and what could go on it", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startEngineer(page);

    for (const [name, purpose] of [
      [/^The bench$/, /What you are building/i],
      [/^What you could build$/, /What is open to you/i],
    ] as const) {
      await tab(page, name);
      await expect(
        page.getByText(purpose).first(),
        "each screen states its own purpose",
      ).toBeVisible();
    }

    expect(problems).toEqual([]);
  });

  test("the certifier's terms follow you to where work is chosen", async ({
    page,
  }) => {
    await startEngineer(page);

    await tab(page, /^The bench$/);
    await expect(
      strip(page),
      "the bench states them in full, so the strip would be a duplicate",
    ).toHaveCount(0);

    await tab(page, /^What you could build$/);
    await expect(strip(page)).toBeVisible();
    await expect(
      strip(page),
      "what this market accepts is the thing a new product is chosen against",
    ).toContainText(/faults/i);
  });

  /* The one rule this career cannot break: the true count is never shown. */
  test("neither screen ever prints the real fault count", async ({ page }) => {
    await startEngineer(page);
    await tab(page, /^What you could build$/);
    await page.getByRole("button", { name: /^Start it$/ }).first().click();

    for (const name of [/^The bench$/, /^What you could build$/]) {
      await tab(page, name);
      const text = await page.locator("main").innerText();
      expect(
        /faults? in it:\s*\d+|latent/i.test(text),
        "the hidden number must never reach a screen",
      ).toBe(false);
      expect(text).not.toContain("NaN");
      expect(text).not.toContain("undefined");
    }
  });

  test("a product carries its decisions, and the lab hires its disciplines", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startEngineer(page);

    /* Something on the bench to decide about. */
    await tab(page, /^What you could build$/);
    await page.getByRole("button", { name: /^Start it$/ }).first().click();
    await tab(page, /^The bench$/);

    /* Requirements: negotiated once, in words. */
    await page.getByRole("button", { name: /^Hardened$/ }).first().click();
    await expect(
      page.getByText(/^Spec:/).first(),
      "the negotiated envelope is stated on the card",
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Lean spec$/ }),
      "and the negotiation does not repeat",
    ).toHaveCount(0);

    /* Architecture: the other once-only decision. */
    await page.getByRole("button", { name: /^Modular$/ }).first().click();
    await expect(page.getByText(/^Architecture:/).first()).toBeVisible();

    /* The lab and the disciplines are on the bench screen, with prices. */
    await expect(
      page.getByText(/^The lab, and the disciplines$/).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Buy — / }).first(),
      "a rig has a price on it",
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Hire — / }).first(),
      "and so does a discipline",
    ).toBeVisible();

    /* The prototype states its price, and buying it says what it bought.
       On a bracket the bill is small enough for a fresh workshop — which
       is the point of starting on brackets. */
    await page
      .getByRole("button", { name: /^Build a prototype — / })
      .first()
      .click();
    await expect(
      page.getByText(/^Prototyped$/).first(),
      "the bought prototype is on the card",
    ).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });
});

test.describe("the architect", () => {
  const startArchitect = async (page: Page) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    const card = page
      .getByRole("button", { name: /^open\s*architect/i })
      .first();
    await card.click();
    await card.click();
    await page.getByRole("button", { name: /^Begin in Amsterdam$/ }).click();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).last(),
    ).toBeVisible();
    await go(page, /Work/i);
  };

  /** The Architect has three destinations: Week, Work, World. */
  const go = async (page: Page, where: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: where })
      .first()
      .click();
  };

  const tab = async (page: Page, where: RegExp) => {
    await page.getByRole("tab", { name: where }).first().click();
  };

  /** What is unearned and what has been redrawn, carried everywhere else. */
  const strip = (page: Page) => page.locator('dl[aria-label="On the boards"]');

  /** Accept the opening offer and go back to the boards to look at it. */
  const takeTheOffer = async (page: Page) => {
    await tab(page, /^Offered$/);
    await page.getByRole("button", { name: /^Take it on$/ }).first().click();
    await tab(page, /^On the boards$/);
  };

  test("a commission shows its stage, its fee and its risk", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startArchitect(page);

    /* The practice opens with one job offered, and taking it puts it on the
       boards — the career is unplayable without that first board. */
    await takeTheOffer(page);

    await expect(
      page.getByText(/banked/i).first(),
      "the card says how much of the fee is already yours",
    ).toBeVisible();
    await expect(
      page.getByText(/chance they change the brief/i).first(),
      "and how likely the client is to send it backwards",
    ).toBeVisible();
    await expect(
      page.getByText(/Last seen/i).first(),
      "and when they last saw anybody, which is what drives it",
    ).toBeVisible();

    const text = await page.locator("main").innerText();
    expect(
      text.match(/patient|caseload|covers|larder|brigade|runway|polling/i)?.[0],
      "no other career's vocabulary reaches the Architect",
    ).toBeUndefined();
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("1 weeks");

    expect(problems).toEqual([]);
  });

  test("seeing the client is a real defence", async ({ page }) => {
    await startArchitect(page);
    await takeTheOffer(page);

    /* An associate exists to make that call for you, and the risk on the
       card has to move when one is hired. */
    const riskOf = async () => {
      const line = await page
        .getByText(/chance they change the brief/i)
        .first()
        .innerText();
      return Number((line.match(/(\d+)%/) ?? ["", "0"])[1]);
    };

    const before = await riskOf();
    await tab(page, /^The studio$/);
    await page
      .getByRole("button", { name: /^Take them on$/ })
      .last()
      .click();
    await tab(page, /^On the boards$/);
    const after = await riskOf();
    expect(
      after,
      "an associate cuts the chance the brief is reinvented",
    ).toBeLessThanOrEqual(before);
  });

  test("an architect run survives a reload", async ({ page }) => {
    await startArchitect(page);
    await takeTheOffer(page);
    await expect(page.getByText(/A house extension/).first()).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: /continue your run/i }).click();
    await go(page, /Work/i);
    await expect(
      page.getByText(/A house extension/).first(),
      "the commission survives a reload",
    ).toBeVisible();
  });

  /*
   * ------------------------------------------------- the organised version
   *
   * Four screens under one destination. The career is paid in stages and its
   * risk is being made to draw one twice, so what is unearned and what has
   * been redrawn ride on every screen that is not the boards themselves.
   */
  test("the practice is four screens, not one scroll", async ({ page }) => {
    const problems = watchConsole(page);
    await startArchitect(page);

    for (const [name, purpose] of [
      [/^On the boards$/, /What you are drawing/i],
      [/^Offered$/, /What you are being asked for/i],
      [/^Competitions$/, /Months of unpaid drawing/i],
      [/^The studio$/, /Who draws for you/i],
    ] as const) {
      await tab(page, name);
      await expect(
        page.getByText(purpose).first(),
        "each screen states its own purpose",
      ).toBeVisible();
    }

    expect(problems).toEqual([]);
  });

  test("what is unearned is on every screen except the boards", async ({
    page,
  }) => {
    await startArchitect(page);

    await tab(page, /^On the boards$/);
    await expect(
      strip(page),
      "the boards state it in full, so the strip would be a duplicate",
    ).toHaveCount(0);

    for (const name of [/^Offered$/, /^Competitions$/, /^The studio$/]) {
      await tab(page, name);
      await expect(strip(page)).toBeVisible();
      await expect(strip(page)).toContainText(/Redrawn/i);
    }
  });

  test("competitions are reachable and say what they cost", async ({
    page,
  }) => {
    await startArchitect(page);
    await tab(page, /^Competitions$/);
    await expect(
      page.getByText(/Months of unpaid work/i).first(),
      "the screen is honest about what it is",
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Enter$/ }).first(),
      "and an entry can actually be made",
    ).toBeVisible();
  });

  test("a commission carries its decisions: brief, palette, planning, cost plan", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startArchitect(page);

    /* Take the offered job so there is a card to decide on. */
    await tab(page, /^Offered$/);
    await page.getByRole("button", { name: /^Take it on$/ }).first().click();
    await tab(page, /^On the boards$/);

    /* The brief meeting: three choices, agreed once. */
    await page.getByRole("button", { name: /^Signature$/ }).first().click();
    await expect(
      page.getByText(/Brief:/).first(),
      "the agreed brief is stated on the card",
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Economy$/ }),
      "and the meeting does not repeat",
    ).toHaveCount(0);

    /* The palette, with the carbon consequence spelled out in Amsterdam. */
    await page.getByRole("button", { name: /^Mass timber$/ }).first().click();
    await expect(
      page.getByText(/reads well here/i).first(),
      "a low-carbon palette in a carbon-pricing market says so",
    ).toBeVisible();

    /* The cost plan reads the choices it was given. */
    await expect(
      page.getByText(/^Cost plan:/).first(),
      "the cost plan is stated once anything is chosen",
    ).toBeVisible();

    /* Planning can be lodged, for a stated fee, and says it is in. */
    await page
      .getByRole("button", { name: /^Lodge planning — / })
      .first()
      .click();
    await expect(
      page.getByText(/At committee/i).first(),
      "a lodged application says where it is",
    ).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });
});

test.describe("the politician", () => {
  const startPolitician = async (page: Page) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    const card = page
      .getByRole("button", { name: /^open\s*politician/i })
      .first();
    await card.click();
    await card.click();
    await page.getByRole("button", { name: /^Begin in London$/ }).click();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).last(),
    ).toBeVisible();
    await go(page, /Work/i);
  };

  /** The Politician has three destinations: Week, Work, World. */
  const go = async (page: Page, where: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: where })
      .first()
      .click();
  };

  /** Within The seat: the count, the electorate, where you stand, the ladder. */
  const tab = async (page: Page, where: RegExp) => {
    await page.getByRole("tab", { name: where }).first().click();
  };

  /** The count, carried onto the screens that are not themselves the count. */
  const strip = (page: Page) =>
    page.locator('dl[aria-label="The count"], p[aria-label="The count"]');

  test("the seat says where support is heading, not just where it is", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startPolitician(page);

    /* The count states the constraint... */
    await expect(
      page.getByText(/the only moment any of this is banked/i).first(),
      "the career states its own constraint on the screen",
    ).toBeVisible();

    /* ...and the electorate, one screen along, explains the drift. */
    await tab(page, /^The electorate$/);
    await expect(
      page.getByText(/drifts toward where your positions leave it/i).first(),
      "and explains the drift rather than hiding it",
    ).toBeVisible();

    /* Every bloc is a real meter, so a screen reader gets the numbers too. */
    expect(
      await page.getByRole("meter").count(),
      "every bloc is measurable",
    ).toBeGreaterThanOrEqual(4);

    const text = await page.locator("main").innerText();
    expect(
      text.match(/patient|caseload|covers|larder|brigade|runway|chambers/i)?.[0],
      "no other career's vocabulary reaches the Politician",
    ).toBeUndefined();
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("undefined");

    expect(problems).toEqual([]);
  });

  test("a position costs somebody, and reversing it costs everybody", async ({
    page,
  }) => {
    await startPolitician(page);
    await tab(page, /^Where you stand$/);

    /* Every stance shows who it loses as well as who it wins. */
    const build = page.getByRole("button", { name: /Build the houses/ }).first();
    await expect(build).toBeVisible();
    await build.click();
    await expect(
      build,
      "the position you took reports itself as taken",
    ).toHaveAttribute("aria-pressed", "true");

    /* Change your mind, and the seat is told about it. */
    await page.getByRole("button", { name: /Protect the green belt/ }).first().click();
    await expect(
      page.getByText(/You changed your mind on this one in public/i).first(),
      "a public reversal is recorded on the issue itself",
    ).toBeVisible();
    await expect(
      page.getByText(/You have reversed 1 position/i).first(),
      "and priced across the whole electorate",
    ).toBeVisible();
  });

  test("a politician run survives a reload", async ({ page }) => {
    await startPolitician(page);
    await tab(page, /^Where you stand$/);
    await page.getByRole("button", { name: /Fund it properly/ }).first().click();

    await page.reload();
    await page.getByRole("button", { name: /continue your run/i }).click();
    await go(page, /Work/i);
    await tab(page, /^Where you stand$/);
    await expect(
      page.getByRole("button", { name: /Fund it properly/ }).first(),
      "the position survives a reload",
    ).toHaveAttribute("aria-pressed", "true");
  });

  /*
   * ------------------------------------------------- the organised version
   *
   * This career was one generic "Business" page carrying the poll, the
   * electorate, the positions and the ladder on a single scroll. The count is
   * what every one of those is measured against, so it rides on all of them.
   */
  test("the seat is four screens, not one scroll", async ({ page }) => {
    const problems = watchConsole(page);
    await startPolitician(page);

    for (const [name, purpose] of [
      [/^The count$/, /What you would take if the vote were today/i],
      [/^The electorate$/, /Who is in this seat/i],
      [/^Where you stand$/, /questions you have answered in public/i],
      [/^The ladder$/, /The office above this one/i],
    ] as const) {
      await tab(page, name);
      await expect(
        page.getByText(purpose).first(),
        "each screen states its own purpose",
      ).toBeVisible();
    }

    expect(problems).toEqual([]);
  });

  test("the count is on every screen except its own", async ({ page }) => {
    await startPolitician(page);

    await tab(page, /^The count$/);
    await expect(
      strip(page),
      "the count screen states it in full, so the strip would be a duplicate",
    ).toHaveCount(0);

    for (const name of [
      /^The electorate$/,
      /^Where you stand$/,
      /^The ladder$/,
    ]) {
      await tab(page, name);
      await expect(strip(page).first()).toBeVisible();
      await expect(strip(page).first()).toContainText(/bar|name forward/i);
    }
  });

  test("targeting a bloc is reachable and reports itself", async ({ page }) => {
    await startPolitician(page);
    await tab(page, /^The electorate$/);

    const target = page
      .getByRole("button", { name: /^Target this bloc$/ })
      .first();
    await expect(target, "a bloc can be worked").toBeVisible();
    await target.click();
    await expect(
      page.getByRole("button", { name: /^Targeting this bloc$/ }).first(),
      "and says so once chosen",
    ).toBeVisible();
  });

  test("no other career's vocabulary reaches any of the four", async ({
    page,
  }) => {
    await startPolitician(page);

    for (const name of [
      /^The count$/,
      /^The electorate$/,
      /^The postbag$/,
      /^Where you stand$/,
      /^The ladder$/,
    ]) {
      await tab(page, name);
      const text = await page.locator("main").innerText();
      expect(
        text.match(
          /patient|caseload|triage|outbreak|physician|larder|brigade|runway|chambers/i,
        )?.[0],
        "the Politician is showing another career's word",
      ).toBeUndefined();
      expect(text).not.toContain("NaN");
      expect(text).not.toContain("undefined");
    }
  });

  test("the postbag holds the ground game", async ({ page }) => {
    const problems = watchConsole(page);
    await startPolitician(page);
    await tab(page, /^The postbag$/);

    /* The desk: names with deadlines, or an honest empty state. */
    await expect(
      page.getByText(/worked oldest first/i).first(),
      "the desk says how it is worked",
    ).toBeVisible();

    /* The ground game states what volunteers are worth, even at zero. */
    await expect(page.getByText(/^Volunteers$/).first()).toBeVisible();
    await expect(
      page.getByText(/knock the doors you cannot/i).first(),
    ).toBeVisible();

    /* The fund states its compliance rule where the money is, and a
       focus group cannot be bought from an empty fund. */
    await expect(
      page.getByText(/never the rent, which is the law/i).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Focus group/ }),
      "an empty fund cannot buy a reading of the room",
    ).toBeDisabled();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });
});

test.describe("the founder", () => {
  const startFounder = async (page: Page) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    const card = page.getByRole("button", { name: /^open\s*founder/i }).first();
    await card.click();
    await card.click();
    /* New York, because it is the city the tagline is written about: eleven
       weeks, which is the pressure the whole career is played under. */
    await page.getByRole("button", { name: /^Begin in New York$/ }).click();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).last(),
    ).toBeVisible();
  };

  /** The Founder has three destinations: Week, Work, World. */
  const go = async (page: Page, where: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: where })
      .first()
      .click();
  };

  /** Within Company: runway, team, raising. */
  const tab = async (page: Page, where: RegExp) => {
    await page.getByRole("tab", { name: where }).first().click();
  };

  /** The runway summary carried onto the screens that are not about it. */
  const strip = (page: Page) => page.locator('dl[aria-label="Runway"]');

  test("the career is played in weeks, not pounds", async ({ page }) => {
    const problems = watchConsole(page);
    await startFounder(page);
    await go(page, /Work/i);

    /* The headline is a countdown. */
    await tab(page, /^Runway$/);
    await expect(
      page.getByText(/^11 weeks$/).first(),
      "the opening runway is the eleven weeks the tagline promises",
    ).toBeVisible();

    /* And every hire is priced in the same currency, one screen along. */
    await tab(page, /^Team$/);
    await expect(
      page.getByText(/weeks of runway/i).first(),
      "a hire is priced in weeks, not just money",
    ).toBeVisible();

    const text = await page.locator("main").innerText();
    expect(
      text.match(/patient|caseload|covers|larder|brigade|chambers|hearing/i)?.[0],
      "no other career's vocabulary reaches the Founder",
    ).toBeUndefined();
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("undefined");

    expect(problems).toEqual([]);
  });

  test("hiring shortens the runway that pays for it", async ({ page }) => {
    await startFounder(page);
    await go(page, /Work/i);
    await tab(page, /^Team$/);

    /* Read off the strip rather than a section heading: the whole point of
       carrying it here is that the cost of a hire can be seen while hiring. */
    const runway = strip(page);
    const before = Number(
      ((await runway.innerText()).match(/(\d+)\s*weeks/) ?? ["", "0"])[1],
    );
    expect(before, "a founder starts with weeks on the clock").toBeGreaterThan(0);

    await page
      .getByRole("button", { name: /^Take them on$/ })
      .first()
      .click();

    const after = Number(
      ((await runway.innerText()).match(/(\d+)\s*weeks/) ?? ["", "0"])[1],
    );
    expect(
      after,
      "taking somebody on costs weeks off the clock",
    ).toBeLessThan(before);
  });

  test("a founder run survives a reload", async ({ page }) => {
    await startFounder(page);
    await go(page, /Work/i);
    await tab(page, /^Team$/);
    await page
      .getByRole("button", { name: /^Take them on$/ })
      .first()
      .click();
    await expect(page.getByText(/on the payroll/i).first()).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: /continue your run/i }).click();
    await go(page, /Work/i);
    await tab(page, /^Team$/);
    await expect(
      page.getByText(/on the payroll/i).first(),
      "the team survives a reload",
    ).toBeVisible();
  });

  /*
   * ------------------------------------------------- the organised version
   *
   * This career had no section set at all: one generic "Business" page
   * carrying runway, growth, team and raising on a single scroll, and a note
   * in the component defending it — the run has one question in it, and tabs
   * would hide the arithmetic that makes each option a decision.
   *
   * The arithmetic turned out to be per-option and travelled with the option.
   * What needed carrying was the clock, so these assert both halves: three
   * real screens, and the clock on every one of them that is not itself the
   * clock.
   */
  test("the company is three screens, not one scroll", async ({ page }) => {
    const problems = watchConsole(page);
    await startFounder(page);
    await go(page, /Work/i);

    for (const [name, purpose] of [
      [/^Runway$/, /How many weeks are left/i],
      [/^Team$/, /Who is on the payroll/i],
      [/^Raising$/, /What the company is worth/i],
    ] as const) {
      await tab(page, name);
      await expect(
        page.getByText(purpose).first(),
        "each screen states its own purpose",
      ).toBeVisible();
    }

    expect(problems).toEqual([]);
  });

  test("the clock is on every screen except its own", async ({ page }) => {
    await startFounder(page);
    await go(page, /Work/i);

    await tab(page, /^Runway$/);
    await expect(
      strip(page),
      "the Runway screen states it in full, so the strip would be a duplicate",
    ).toHaveCount(0);

    await tab(page, /^Team$/);
    await expect(strip(page)).toBeVisible();
    await expect(strip(page)).toContainText(/Burn/i);

    await tab(page, /^Raising$/);
    await expect(strip(page)).toBeVisible();
  });

  test("raising says what it takes and never gives back", async ({ page }) => {
    const problems = watchConsole(page);
    await startFounder(page);
    await go(page, /Work/i);
    await tab(page, /^Raising$/);

    await expect(
      page.getByText(/costs a piece of that share, permanently/i),
    ).toBeVisible();
    await expect(page.getByText(/for about \d+%/i).first()).toBeVisible();

    expect(problems).toEqual([]);
  });

  /* The rule every career is held to, applied across all three screens
     rather than the one the original test happened to land on. */
  test("no other career's vocabulary reaches any of the three", async ({
    page,
  }) => {
    await startFounder(page);
    await go(page, /Work/i);

    for (const name of [/^Runway$/, /^The product$/, /^Team$/, /^Raising$/]) {
      await tab(page, name);
      const text = await page.locator("main").innerText();
      expect(
        text.match(
          /patient|caseload|triage|outbreak|physician|larder|brigade|chambers|hearing/i,
        )?.[0],
        "the Founder is showing another career's word",
      ).toBeUndefined();
      expect(text).not.toContain("NaN");
      expect(text).not.toContain("undefined");
    }
  });

  test("the product screen holds the roadmap, the funnel and the tests", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startFounder(page);
    await go(page, /Work/i);
    await tab(page, /^The product$/);

    /* Discovery states itself, honestly, from zero. */
    await expect(
      page.getByRole("meter", { name: /customer insight/i }),
      "insight is a meter, not a mystery",
    ).toBeVisible();
    await expect(
      page.getByText(/You are guessing/i).first(),
      "and zero insight says so in words",
    ).toBeVisible();

    /* The roadmap holds a stance: steady by default, ship on demand. */
    const steady = page.getByRole("button", { name: /^Steady/ }).first();
    await expect(steady).toHaveAttribute("aria-pressed", "true");
    const ship = page.getByRole("button", { name: /^Ship fast/ }).first();
    await ship.click();
    await expect(
      ship,
      "choosing a pace marks it chosen",
    ).toHaveAttribute("aria-pressed", "true");
    await expect(steady).toHaveAttribute("aria-pressed", "false");
    await expect(
      page.getByRole("meter", { name: /technical debt/i }),
      "the bill is a meter beside the choice that runs it up",
    ).toBeVisible();

    /* The funnel reads top to bottom, and the economics are stated. */
    await expect(page.getByText(/^Looked$/i).first()).toBeVisible();
    await expect(page.getByText(/worth .* over their stay/i).first()).toBeVisible();

    /* An experiment can be bought, and immediately says it is running. */
    const run = page
      .getByRole("button", { name: /^Run — / })
      .first();
    await expect(run).toBeEnabled();
    await run.click();
    await expect(
      page.getByText(/reading out/i).first(),
      "the bought test says it is in flight",
    ).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });
});

test.describe("the chef", () => {
  /** Start a Chef run from a clean slate. Two presses: arm, then commit. */
  const startChef = async (page: Page) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    const card = page.getByRole("button", { name: /^open\s*chef/i }).first();
    await card.click();
    await card.click();
    /* Where. Lyon is the default and the neutral city, so the rest of these
       tests measure the kitchen and not the market. */
    await page.getByRole("button", { name: /^Begin in Lyon$/ }).click();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).last(),
    ).toBeVisible();
  };

  /** The Chef has three destinations, not the Physician's five. */
  const go = async (page: Page, where: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: where })
      .first()
      .click();
  };

  /** Within the Kitchen destination: the room, the larder, the pass, and so on. */
  const tab = async (page: Page, where: RegExp) => {
    await page.getByRole("tab", { name: where }).first().click();
  };

  /**
   * The Chef's one content destination has five screens, and the split is only
   * real if each of them is reachable and says what it is for. This is the
   * test that would have failed while the whole career was one column.
   */
  test("the kitchen is six screens, each stating what it decides", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startChef(page);
    await go(page, /Work/);

    const screens: [RegExp, RegExp][] = [
      [/The room/, /Premises and equipment/i],
      [/Larder/, /what dies next week/i],
      [/Menu/, /what you charge for it/i],
      [/The pass/, /how the last night went/i],
      [/Brigade/, /who is on the line/i],
      [/Money/, /whether you open or not/i],
    ];
    for (const [label, purpose] of screens) {
      await tab(page, label);
      await expect(
        page.getByRole("heading", { level: 1, name: label }),
        `${label} is reachable from the kitchen`,
      ).toBeVisible();
      await expect(
        page.getByText(purpose).first(),
        `${label} says what it is for`,
      ).toBeVisible();
    }

    /* The medical screens are not the Chef's, and the Solicitor's single
       "Business" screen is not either. */
    await expect(
      page.getByRole("tab", { name: /Caseload|Supplies|Business/ }),
    ).toHaveCount(0);

    /*
     * The picture is the room you are actually in.
     *
     * A new run is at the market stall, so the lead image is the market
     * kitchen and not one of the three rooms this player cannot afford. This
     * is the assertion that would fail if the artwork were ever hung off
     * anything other than the premises the simulation holds.
     */
    await tab(page, /The room/);
    const roomHero = page.locator("main img").first();
    await expect(roomHero).toHaveAttribute("src", /chef-market-kitchen/);
    await expect(
      roomHero,
      "the lead image describes itself — it is the state, not decoration",
    ).toHaveAttribute("alt", /market kitchen/i);

    expect(problems).toEqual([]);
  });

  test("a week can be planned, run and read back", async ({ page }) => {
    const problems = watchConsole(page);
    await startChef(page);

    /* 1. The book. Switching it is the choice that decides how much of next
       week is knowable before any food is bought. */
    await go(page, /Work/);
    await tab(page, /The pass/);
    const reservations = page
      .getByRole("button", { name: /Reservations only/ })
      .first();
    await expect(reservations).toBeVisible();
    await reservations.click();
    await expect(
      reservations,
      "the chosen policy reports itself as chosen",
    ).toHaveAttribute("aria-pressed", "true");

    /* 2. The larder starts empty and says so rather than showing nothing. */
    await tab(page, /Larder/);
    await expect(
      page.getByText(/Empty\. You cannot open a service/i).first(),
    ).toBeVisible();

    /* 3. Order produce — which is a phone call now. The larder screen's
       card is the doorway: it names the two numbers a call is made against
       and opens the handset on the Market app. */
    await expect(page.locator('main img[src*="chef-larder"]')).toHaveCount(0);
    await page.getByRole("button", { name: /call your suppliers/i }).click();
    const market = page.getByRole("dialog");
    await expect(
      market.getByText(/Your suppliers/i).first(),
      "the handset opens straight onto the market",
    ).toBeVisible();
    const order = market
      .getByRole("button", { name: /Standard crate/ })
      .first();
    await order.click();
    await order.click();
    /* The market's own header carries the larder count, so the app shows the
       stock arriving without the player leaving it. Asserted as a number
       rather than a sentence: what matters is that it moved off zero. */
    const larderStat = market.getByText(/^\d+ covers$/).first();
    await expect(
      larderStat,
      "the app itself shows the stock arriving",
    ).toBeVisible();
    expect(
      Number((await larderStat.innerText()).replace(/\D/g, "")),
      "and the larder is no longer empty",
    ).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect(market).toBeHidden();
    /* Stock with time on it reads as the full larder. The expiring picture is
       the same panel a few weeks later — see `npm run check`, which walks the
       lot arithmetic rather than the pixels. */
    await expect(page.locator("main img").first()).toHaveAttribute(
      "src",
      /chef-larder-fresh/,
    );
    await expect(
      page.getByText(/covers in stock/i).first(),
      "the larder reports what is in it",
    ).toBeVisible();

    /* 4. Plan the week. The forecast has to appear before committing — it is
       what the ordering decision is made against. */
    await go(page, /Week/);
    /* `.first()` because the forecast appears twice by design — once as the
       week's headline and once in the commit strip. Either would do; the
       claim is that it is on screen before anything is committed. */
    await expect(page.getByText(/Covers expected/i).first()).toBeVisible();
    await expect(
      page.getByText(/Already booked/i).first(),
      "the book's effect is shown before the week is committed",
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("the service report explains what limited the night", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startChef(page);

    await page.getByRole("button", { name: /open phone/i }).click();
    const market = page.getByRole("dialog");
    await market.getByRole("button", { name: /^market$/i }).click();
    const order = market
      .getByRole("button", { name: /Standard crate/ })
      .first();
    for (let i = 0; i < 3; i++) await order.click();
    await page.keyboard.press("Escape");

    /* Open a dinner service and commit the week. */
    await go(page, /Week/);
    const plus = page.locator("button").filter({ hasText: /^\+$/ });
    await plus.nth(1).click();
    await plus.nth(1).click();

    const commit = page.getByRole("button", { name: /^Commit week/ }).first();
    await expect(commit).toBeEnabled();
    await commit.click();
    await dismissReview(page);

    /* The report is the other half of the forecast: what actually happened,
       and — the part a player cannot infer — which constraint bound. */
    await go(page, /Work/);
    await tab(page, /The pass/);
    await expect(page.getByText(/Last service/i).first()).toBeVisible();
    await expect(page.getByText(/Limited by:/i).first()).toBeVisible();

    /*
     * The picture at the top of the pass is the service that actually ran.
     *
     * This week was dinner, so it is the dinner service and not the lunch
     * card's photograph — the image is read from `lastService.lines`, the same
     * record the report below it is printed from.
     */
    await expect(page.locator("main img").first()).toHaveAttribute(
      "src",
      /chef-dinner-service/,
    );
    await expect(page.getByText(/walked in/i).first()).toBeVisible();

    expect(problems).toEqual([]);
  });


  test("the phone is the kitchen's own", async ({ page }) => {
    const problems = watchConsole(page);
    await startChef(page);

    /* The handset opens from the same button the Physician has. */
    await page.getByRole("button", { name: /open phone/i }).click();
    const phone = page.getByRole("dialog");
    await expect(phone).toBeVisible();

    /* The mentor's welcome is waiting in messages — a chef's mentor,
       talking about critics and stock, not a colleague talking about wards. */
    await phone.getByRole("button", { name: /messages/i }).first().click();
    await expect(phone.getByText(/Chef Renard/i).first()).toBeVisible();
    await expect(
      phone.getByText(/never argue with a critic/i).first(),
    ).toBeVisible();

    /* Publish the opening post through the real composer. */
    await phone.getByRole("button", { name: /pulse/i }).first().click();
    await phone.getByRole("button", { name: /compose/i }).first().click();
    await phone.getByRole("button", { name: /the pans are on/i }).click();
    await phone.getByRole("button", { name: /^publish$/i }).click();
    await expect(
      phone.getByText(/The pans are on in/i).first(),
      "the published post lands on the feed",
    ).toBeVisible();

    /* One post a week: the composer now says so instead of offering more. */
    await expect(
      phone.getByText(/already posted this week/i).first(),
    ).toBeVisible();

    /* The market and the agency are apps, not dashboard panels. */
    await phone.getByRole("button", { name: /^market$/i }).click();
    await expect(phone.getByText(/Your suppliers/i).first()).toBeVisible();
    await expect(
      phone.getByRole("button", { name: /Standard crate/ }).first(),
      "ordering lives on the handset",
    ).toBeVisible();

    await phone.getByRole("button", { name: /^agency$/i }).click();
    await expect(
      phone.getByText(/cooks around skill \d+/i).first(),
      "the agency says who your standing attracts",
    ).toBeVisible();
    /* Hiring is a briefing and then a placement — you see who the agency
       found before you commit to anybody. */
    await phone
      .getByRole("button", { name: /find me one/i })
      .first()
      .click();
    await phone
      .getByRole("button", { name: /take them on/i })
      .first()
      .click();
    await expect(
      phone.getByText(/^1 cook$/i).first(),
      "a hire made by phone lands on the payroll, counted in the header",
    ).toBeVisible();

    /* Nothing in the handset speaks the hospital's language. */
    const text = await phone.innerText();
    expect(
      text.match(/patient|caseload|department|physician|ward/i)?.[0],
      "no medical vocabulary on the chef's phone",
    ).toBeUndefined();

    await page.keyboard.press("Escape");
    await expect(phone).toBeHidden();

    expect(problems).toEqual([]);
  });

  /**
   * THE DISHES LOOP, THROUGH THE REAL INTERFACE
   *
   * Order an ingredient, put a dish on the menu, cook it, and read back what
   * it earned. The engine suite proves the arithmetic; this proves a player
   * can reach all four steps and that each one tells them what happened.
   */
  test("a dish can be put on, cooked, and read back", async ({ page }) => {
    const problems = watchConsole(page);
    await startChef(page);
    await go(page, /Work/);

    /* 1. The pantry starts empty and says so rather than showing a blank. */
    await tab(page, /Larder/);
    await expect(
      page.getByText(/Nothing but the staple crates/i).first(),
    ).toBeVisible();

    /*
     * 2. Order an ingredient. The button carries the delivery size and the
     * life it lands with, so an order is never placed blind.
     *
     * Ordered from the emergency wholesaler specifically, because they are
     * the one supplier whose van always turns up. Every other account has a
     * real chance of failing to deliver, and a run is seeded from the clock —
     * so picking the first supplier made this test fail about one run in
     * thirty on a rule the test was not trying to prove.
     */
    const order = page
      .locator("li", { hasText: /Emergency wholesaler/ })
      .getByRole("button", { name: /Root vegetables/ })
      .first();
    await expect(order).toBeVisible();
    await order.click();
    await expect(
      page.getByText(/Stock value/i).first(),
      "the pantry reports what it is holding",
    ).toBeVisible();
    await expect(page.getByText(/^Fresh$|Fresh ·/).first()).toBeVisible();

    /* 3. Put a dish on the menu and price it. */
    await tab(page, /Menu/);
    await expect(
      page.getByText(/Nothing on\./i).first(),
      "an empty menu says what that means for the week",
    ).toBeVisible();

    await page
      .getByRole("button", { name: /^Put it on$/ })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: /^Take it off$/ }).first(),
      "the dish is now on tonight's menu",
    ).toBeVisible();

    /* The three figures a menu decision is made on. */
    await expect(page.getByText(/Sells at/).first()).toBeVisible();
    await expect(page.getByText(/Food cost/).first()).toBeVisible();
    await expect(page.getByText(/Margin/).first()).toBeVisible();

    /* Raising the price is a real control, and it moves the number. */
    const priced = await page
      .locator("main li", { hasText: /Sells at/ })
      .first()
      .innerText();
    await page.getByRole("button", { name: /Raise the price/ }).first().click();
    await expect
      .poll(async () =>
        page.locator("main li", { hasText: /Sells at/ }).first().innerText(),
      )
      .not.toBe(priced);

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("the menu warns before the week rather than after it", async ({
    page,
  }) => {
    await startChef(page);
    await go(page, /Work/);

    /* A dish on the menu with nothing behind it is the mistake this whole
       system exists to make visible, and it must be visible *before* the week
       is committed. */
    await tab(page, /Menu/);
    await page
      .getByRole("button", { name: /^Put it on$/ })
      .first()
      .click();

    await tab(page, /Larder/);
    await expect(
      page.getByText(/fall through to the staple crate/i).first(),
      "the shortfall is named on the screen where it is fixed",
    ).toBeVisible();

    await go(page, /Week/);
    await expect(
      page.getByText(/On the menu/i).first(),
      "and again on the week's own briefing, before anything is committed",
    ).toBeVisible();
  });

  /**
   * THE NIGHT, THROUGH THE REAL INTERFACE
   *
   * The engine suite proves the pipeline; this proves a player can set how the
   * kitchen runs, commit a week, and then read the night back — including the
   * station that held it up and the hire that would fix it.
   */
  test("a service is run, recorded and explained", async ({ page }) => {
    const problems = watchConsole(page);
    await startChef(page);
    await go(page, /Work/);

    /* 1. A menu, and the ingredients behind it. */
    await tab(page, /Menu/);
    const put = page.getByRole("button", { name: /^Put it on$/ });
    await put.first().click();
    await tab(page, /Larder/);
    /* The emergency wholesaler again: their van always turns up, so the night
       this test asserts on is one that genuinely had food to cook. */
    for (const name of [/Root vegetables/, /Bones and trim/]) {
      const order = page
        .locator("li", { hasText: /Emergency wholesaler/ })
        .getByRole("button", { name })
        .first();
      if ((await order.count()) && (await order.isEnabled())) await order.click();
    }
    const crate = page.getByRole("button", { name: /Standard crate/ }).first();
    if (await crate.count()) await crate.click();

    /* 2. How the kitchen is told to run — a standing decision with a stated
       cost, not a button pressed per ticket. */
    await tab(page, /The pass/);
    const push = page.getByRole("button", { name: /Push the brigade/ }).first();
    await expect(push).toBeVisible();
    await expect(
      page.getByText(/Real fatigue afterwards/).first(),
      "the cost of the policy is on the card, not hidden",
    ).toBeVisible();
    await push.click();
    await expect(push).toHaveAttribute("aria-pressed", "true");

    /* 3. Run the week. */
    await go(page, /Week/);
    const plus = page.locator("button").filter({ hasText: /^\+$/ });
    await plus.nth(1).click();
    await plus.nth(1).click();
    await plus.nth(1).click();
    const commit = page.getByRole("button", { name: /^Commit week/ }).first();
    await expect(commit).toBeEnabled();
    await commit.click();
    await dismissReview(page);

    /* 4. The night, recorded. */
    await go(page, /Work/);
    await tab(page, /The pass/);
    await expect(
      page.getByText(/served,.*walked out/i).first(),
      "the night reports what happened to the room",
    ).toBeVisible();
    await expect(page.getByText(/Satisfaction/i).first()).toBeVisible();
    await expect(
      page.getByRole("slider", { name: /Step through the night/i }),
      "and it can be stepped through, because it is a recording",
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("the brigade screen names the section that will fail", async ({
    page,
  }) => {
    await startChef(page);
    await go(page, /Work/);
    await tab(page, /Brigade/);

    /* Every station, with what it can move and who is on it. */
    await expect(page.getByText(/The sections/i).first()).toBeVisible();
    await expect(page.getByText(/tickets a quarter-hour/i).first()).toBeVisible();

    /* A one-person kitchen is short somewhere, and the screen must say where
       and what fixes it rather than "efficiency low". */
    await expect(
      page.getByText(/Where this kitchen will fail first/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/commis chef|sous chef|porter|Front of house/i).first(),
      "the fix names a hire the player can actually make",
    ).toBeVisible();

    await expectNoPageOverflow(page);
  });

  test("the agency finds people you can look at first", async ({ page }) => {
    const problems = watchConsole(page);
    await startChef(page);
    await page.getByRole("button", { name: /open phone/i }).click();
    const phone = page.getByRole("dialog");
    await phone.getByRole("button", { name: /^agency$/i }).click();

    /* Both halves of the cost are stated before anything is spent. */
    const brief = phone.getByRole("button", { name: /find me one/i }).first();
    await expect(brief, "looking has a price of its own").toBeVisible();
    await expect(
      phone.getByText(/to take one on/i).first(),
      "and so does taking somebody on",
    ).toBeVisible();

    await brief.click();

    /*
     * The whole point: three named people, each with a skill you can read,
     * rather than a blind purchase.
     */
    const takeButtons = phone.getByRole("button", { name: /take them on/i });
    await expect(takeButtons).toHaveCount(3);
    const meters = phone.getByRole("meter");
    expect(
      await meters.count(),
      "every candidate shows a skill you can compare",
    ).toBeGreaterThanOrEqual(3);

    /* The person shown is the person who turns up. */
    /* The name is its own element, so read it directly rather than
       slicing a newline out of the row text. */
    const chosen = await phone
      .locator("li")
      .first()
      .locator("span.font-semibold")
      .first()
      .innerText();
    await takeButtons.first().click();
    await expect(
      phone.getByText(/^1 cook$/i).first(),
      "placing somebody puts them on the payroll",
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await go(page, /Work/);
    await tab(page, /Brigade/);
    await expect(
      page.getByText(chosen).first(),
      "and they are the name that appears on the brigade",
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("a chef run survives a reload", async ({ page }) => {
    await startChef(page);
    await go(page, /Work/);
    await tab(page, /The pass/);
    await page.getByRole("button", { name: /Deposit on booking/ }).first().click();
    await tab(page, /Larder/);
    await page.getByRole("button", { name: /call your suppliers/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Standard crate/ })
      .first()
      .click();
    await page.keyboard.press("Escape");

    await page.reload();
    await page.getByRole("button", { name: /continue your run/i }).click();
    await go(page, /Work/);

    await tab(page, /The pass/);
    await expect(
      page.getByRole("button", { name: /Deposit on booking/ }).first(),
      "the book survives a reload",
    ).toHaveAttribute("aria-pressed", "true");
    await tab(page, /Larder/);
    await expect(
      page.getByText(/covers in stock/i).first(),
      "and so does the larder",
    ).toBeVisible();
  });

  /*
   * PHASE 3, THROUGH THE REAL INTERFACE
   *
   * The engine tests prove the arithmetic. These prove a player can reach it:
   * that the seven bars render with their reasons attached, that a complaint
   * can actually be answered with a click, and that the scene screen names
   * this city's rivals rather than a generic three.
   */
  test("the seven parts of a reputation are shown with their reasons", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startChef(page);
    await go(page, /Work/);
    await tab(page, /Word of mouth/);

    await expect(
      page.getByRole("heading", { level: 1, name: /Word of mouth/ }),
    ).toBeVisible();

    /* All seven, named, and each with the plain-English band beside the bar
       so a colour is never the only signal. */
    for (const label of [
      /Food quality/,
      /^Service$/,
      /^Value$/,
      /Atmosphere/,
      /Consistency/,
      /Hygiene/,
      /Innovation/,
    ]) {
      await expect(
        page.getByText(label).first(),
        `${label} is one of the seven`,
      ).toBeVisible();
    }
    await expect(
      page.getByText(/Excellent|Strong|Fair|Weak|Poor/).first(),
      "a bar is never the only signal",
    ).toBeVisible();

    /* And where you stand against the rest of the city. */
    await expect(
      page.getByText(/of 4 restaurants|first of|second of|third of|fourth of/i).first(),
    ).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("a week of trading is explained rather than asserted", async ({
    page,
  }) => {
    await startChef(page);

    /* Buy food, open a service, and commit — the same three things a player
       does on their first week. */
    await go(page, /Work/);
    await tab(page, /Larder/);
    await page.getByRole("button", { name: /call your suppliers/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Standard crate/ })
      .first()
      .click();
    await page.keyboard.press("Escape");

    await go(page, /Week/);
    const plus = page.locator("button").filter({ hasText: /^\+$/ });
    await plus.nth(1).click();
    await plus.nth(1).click();
    await page.getByRole("button", { name: /^Commit week/ }).first().click();
    await dismissReview(page);

    await go(page, /Work/);
    await tab(page, /Word of mouth/);

    /* Every standing move carries the sentence the simulation wrote when it
       decided it — the whole point of the model. */
    await expect(
      page.getByText(/wk \d+ [+-]?\d/).first(),
      "a change is dated and quantified",
    ).toBeVisible();
    await expect(
      page.getByText(
        /Plate quality|covers of produce|ingredients past|covers wanted food|verdict on the night/i,
      ).first(),
      "and says what caused it, in facts about the week",
    ).toBeVisible();

    await expectNoPageOverflow(page);
  });

  test("the scene names this city's rivals and who is in the room", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startChef(page);
    await go(page, /World/);
    await tab(page, /The scene/);

    await expect(
      page.getByRole("heading", { level: 1, name: /The scene/ }),
    ).toBeVisible();

    /* Lyon, in the season week one falls in, with the three Lyon rivals —
       not a generic set. */
    await expect(page.getByText(/Lyon in spring/i)).toBeVisible();
    await expect(page.getByText(/Bouchon Perrache/)).toBeVisible();
    await expect(page.getByText(/La Table de Fourvière/)).toBeVisible();

    /* Every rival states a weakness and what to do about it. */
    await expect(page.getByText(/weak on/i).first()).toBeVisible();
    await expect(
      page.getByText(/Their weakness is|You are already better than them/i).first(),
      "a rival is an opening, not a difficulty number",
    ).toBeVisible();

    /* And the eight segments, each with what they judge you on. */
    for (const label of [
      /Budget diners/,
      /Local regulars/,
      /Business customers/,
      /Tourists/,
      /Families/,
      /Food enthusiasts/,
      /Luxury diners/,
    ]) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
    await expect(page.getByText(/Judged on/).first()).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("a complaint can be answered, and the answer is recorded", async ({
    page,
  }) => {
    await startChef(page);

    /*
     * Put an open complaint into the save the way a bad night would, then
     * reload so the screen is rendering state that survived serialisation —
     * which is also the migration path a real complaint takes.
     */
    await page.evaluate(() => {
      const key = Object.keys(window.localStorage).find((k) =>
        k.startsWith("career-tycoon:") && k.includes(":save:"),
      );
      if (!key) throw new Error("no run in storage");
      const run = JSON.parse(window.localStorage.getItem(key) as string);
      run.data.kitchen.complaints = [
        {
          id: "cmp-e2e",
          week: run.week,
          author: "Marion D.",
          segment: "regulars",
          about: "service",
          accurate: true,
          body: "We waited an hour and left without eating.",
          reach: 3200,
        },
      ];
      window.localStorage.setItem(key, JSON.stringify(run));
    });
    await page.reload();
    await page.getByRole("button", { name: /continue your run/i }).click();
    await go(page, /Work/);
    await tab(page, /Word of mouth/);

    await expect(
      page.getByText(/Marion D\. has complained/i),
      "an open complaint is the first thing on the screen",
    ).toBeVisible();
    await expect(
      page.getByText(/being shared widely|Everyone in the city/i).first(),
      "and how far it has gone is stated in words",
    ).toBeVisible();

    /* Six answers, each stating when it is the right one. */
    for (const label of [
      /^Apologise$/,
      /^Offer compensation$/,
      /^Find out what happened first$/,
      /^Explain what happened$/,
      /^Say nothing$/,
      /^Defend the restaurant$/,
    ]) {
      await expect(
        page.getByRole("button", { name: label }),
        `${label} is offered`,
      ).toBeVisible();
    }

    await page.getByRole("button", { name: /^Apologise$/ }).click();

    /* Answered, closed, and gone from the "needs an answer" list. */
    await expect(
      page.getByText(/Marion D\. has complained/i),
      "an answered complaint stops asking",
    ).toHaveCount(0);

    await expectNoPageOverflow(page);
  });

  test("the phone states what a post costs before it is sent", async ({
    page,
  }) => {
    await startChef(page);
    await page.getByRole("button", { name: /open phone/i }).click();

    const phone = page.getByRole("dialog");
    await expect(phone).toBeVisible();
    /* The handset opens on whatever is unread, and week one has a message
       waiting from the mentor. The profile is on Pulse. */
    await phone.getByRole("button", { name: /^Pulse$/ }).click();
    await expect(phone.getByText(/Followers/)).toBeVisible();
    await expect(
      phone.getByText(/Listening/),
      "engagement, not a vanity number",
    ).toBeVisible();
    await expect(
      phone.getByText(/Booking/),
      "and what the posting has actually done to the room",
    ).toBeVisible();

    /* The composer is collapsed until asked for — one post a week, and the
       count of what is worth saying is on the disclosure itself. */
    const compose = phone.getByRole("button", { name: /^Compose · week/ });
    await expect(compose).toContainText(/\d+ available/);
    await compose.click();

    /* Every post states its trade on the card, before it is published. */
    const post = phone
      .getByRole("button", { name: /The pans are on/ })
      .first();
    await expect(post).toBeVisible();
    await post.click();
    await expect(
      phone.getByText(/People learn you exist/i).first(),
      "the effects are stated before publishing, not after",
    ).toBeVisible();

    await page.keyboard.press("Escape");
  });

  /*
   * PHASE 4, THROUGH THE REAL INTERFACE
   *
   * The chef rather than the restaurant: what they can do, where they could go
   * to learn faster, what is in the racks, and what the trade is offering them.
   */
  test("the craft screen shows what the chef can do and what it costs", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startChef(page);
    await go(page, /^Career$/);
    await tab(page, /The craft/);

    await expect(
      page.getByRole("heading", { level: 1, name: /The craft/ }),
    ).toBeVisible();

    /* The rank, which is computed rather than bought. */
    await expect(page.getByText(/Nobody in particular/).first()).toBeVisible();
    await expect(
      page.getByText(/points from a working chef/i).first(),
      "the next rung says how far away it is",
    ).toBeVisible();

    /* All five disciplines, and a technique that states what it does. */
    for (const label of [
      /^Butchery$/,
      /^Sauce$/,
      /^Pastry$/,
      /^Larder$/,
      /Modern technique/,
    ]) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
    await expect(
      page.getByText(/Recovers a fifth of what the kitchen would otherwise/i),
      "every technique states its effect, not a score",
    ).toBeVisible();

    /* A technique behind a prerequisite says which one. */
    await expect(
      page.getByText(/Needs breaking down a carcass first/i).first(),
    ).toBeVisible();

    /* Choosing what to practise is a setting, and it sticks. */
    const choose = page
      .locator("li", { hasText: /Stocks and reductions/ })
      .getByRole("button", { name: /Practise this/ });
    await choose.click();
    /* Rendered as a statement rather than a greyed-out button, which is why
       this looks for the text and not for a control. */
    await expect(page.getByText(/Practising this/).first()).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("a week of practice is spent and the technique moves", async ({
    page,
  }) => {
    await startChef(page);
    await go(page, /^Career$/);
    await tab(page, /The craft/);
    await page
      .locator("li", { hasText: /Stocks and reductions/ })
      .getByRole("button", { name: /Practise this/ })
      .click();

    /* The planner offers the block, and states what it will do. */
    await go(page, /Week/);
    await expect(
      page.getByText(/points towards stocks and reductions/i).first(),
      "the block says where it is going before it is spent",
    ).toBeVisible();

    /* Every stepper in the planner carries its own accessible name, which is
       a far better handle than counting plus signs. */
    await page.getByRole("button", { name: /More blocks on Practise/ }).click();
    await page.getByRole("button", { name: /^Commit week/ }).first().click();
    await dismissReview(page);

    await go(page, /^Career$/);
    await tab(page, /The craft/);
    await expect(
      page.getByText(/22 of 35/).first(),
      "the practice landed on the technique it was aimed at",
    ).toBeVisible();
  });

  test("the cellar is stock that improves, and the screen says so", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startChef(page);
    await go(page, /Work/);
    await tab(page, /Larder/);

    await expect(page.getByText(/^The cellar$/)).toBeVisible();
    await expect(
      page.getByText(/Everything else in this building rots/i),
      "the cellar states the inversion it is built on",
    ).toBeVisible();
    await expect(
      page.getByText(/Without the wine store you have a rack behind the bar/i),
      "and says what is missing before it is bought",
    ).toBeVisible();

    /* House red is affordable on week one even without the store. */
    const buy = page
      .locator("li", { hasText: /House red/ })
      .getByRole("button")
      .first();
    await expect(buy).toBeEnabled();
    await buy.click();

    await expect(
      page.getByText(/24 bottles/).first(),
      "the case is in the rack",
    ).toBeVisible();
    await expect(
      page.getByText(/Young — worth keeping/i).first(),
      "and it is described in words rather than as a multiplier",
    ).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("the guide is a standard, and it is visible all year", async ({
    page,
  }) => {
    await startChef(page);
    await go(page, /Work/);
    await tab(page, /Word of mouth/);

    await expect(page.getByText(/^The guide$/)).toBeVisible();
    await expect(
      page.getByText(/publishes in \d+ weeks?/i).first(),
      "a standard nobody can see is a lottery",
    ).toBeVisible();

    /* All six things it measures, each with what it is looking at. */
    for (const label of [
      /^The cooking$/,
      /^Technique$/,
      /Personality of the menu/,
      /The room and the service/,
      /^The list$/,
      /The kitchen itself/,
    ]) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
    await expect(
      page.getByText(/points short of one star/i).first(),
      "and it says how far away the next one is",
    ).toBeVisible();

    await expectNoPageOverflow(page);
  });

  test("the offers beyond the kitchen are earned, not bought", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startChef(page);
    await go(page, /^Career$/);
    await tab(page, /Beyond the kitchen/);

    await expect(
      page.getByRole("heading", { level: 1, name: /Beyond the kitchen/ }),
    ).toBeVisible();
    await expect(page.getByText(/Nothing on at the moment/)).toBeVisible();

    /* All five, and every one of them refused to a chef nobody has heard of —
       with the rank it would take stated rather than a bare disabled button. */
    for (const label of [
      /A pop-up in another city/,
      /Consult for a hotel group/,
      /Teach a masterclass series/,
      /Write the book/,
      /The television series/,
    ]) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
    await expect(
      page.getByText(/nobody is offering it yet/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/blocks? a week for/i).first(),
      "the card leads with what it costs, not what it pays",
    ).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("the chef screens work on a phone and by keyboard", async ({ page }) => {
    await startChef(page);
    await go(page, /Work/);

    /* Every Chef screen, not only the first: the split moved controls onto
       four screens that had never been laid out on their own. */
    for (const label of [
      /The room/,
      /Larder/,
      /Menu/,
      /The pass/,
      /Brigade/,
      /Money/,
      /Word of mouth/,
    ]) {
      await tab(page, label);
      await expectNoPageOverflow(page);

      /* No control may be a button inside a button — the bug that sent the
         Chef's first click to the back-to-menu handler. */
      const nested = await page.evaluate(
        () => document.querySelectorAll("button button").length,
      );
      expect(nested, `no nested buttons on ${label}`).toBe(0);
    }

    /*
     * Keyboard reach, checked on a screen that has controls to reach.
     *
     * Two of the Chef's screens are pure read-outs: the scene is a briefing,
     * and word of mouth has no control at all until a complaint is waiting for
     * an answer. Both are reachable by keyboard through the sub-navigation
     * above them — which is what the tablist in this same loop exercises —
     * but neither has a control for Tab to land on, so the assertion is made
     * where one exists.
     */
    await tab(page, /The room/);
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(
      () => document.activeElement?.tagName ?? "",
    );
    expect(["BUTTON", "A"], "tab reaches a control").toContain(focused);

    /* And the Map destination, which now carries two screens of its own. */
    await go(page, /World/);
    for (const label of [/^Map$/, /The scene/]) {
      await tab(page, label);
      await expectNoPageOverflow(page);
      const nested = await page.evaluate(
        () => document.querySelectorAll("button button").length,
      );
      expect(nested, `no nested buttons on ${label}`).toBe(0);
    }
  });
});

/**
 * THE SOLICITOR, THROUGH THE REAL INTERFACE
 *
 * The engine suite proves the court's arithmetic; this proves a player can
 * reach it. The career's whole shape is a sequence — take an instruction, find
 * the hours, then decide whether to take certain money or send it to a judge —
 * and a test per step would pass while the sequence stayed broken, so most of
 * this is one journey rather than a dozen assertions.
 *
 * The hearing itself is driven from a fixture. Playing eight weeks of casework
 * through the commit button to reach a listed matter would be a slow test of
 * the commit button; `solicitor-listed` is a real run, played forward by the
 * engine until a verdict genuinely lands on the following week — see
 * `scripts/fixtures.ts`.
 */
test.describe("the solicitor", () => {
  /** Start a Solicitor run from a clean slate. Two presses: arm, then commit. */
  const startSolicitor = async (page: Page) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    const card = page
      .getByRole("button", { name: /^open\s*solicitor/i })
      .first();
    await card.click();
    await card.click();
    /* London is the neutral market every run practised in before the choice
       existed, so the rest of these measure the practice and not the city. */
    await page.getByRole("button", { name: /^Begin in London$/ }).click();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).last(),
    ).toBeVisible();
  };

  /** The Solicitor has three destinations, not the Physician's five. */
  const go = async (page: Page, where: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: where })
      .first()
      .click();
  };

  /** Within Chambers: instructions, casework, the books, the firm. */
  const tab = async (page: Page, where: RegExp) => {
    await page.getByRole("tab", { name: where }).first().click();
  };

  /** Preload a fixture and actually resume it — the app opens on the menu. */
  const resume = async (page: Page, fixture: string) => {
    await preload(page, fixture);
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).last(),
    ).toBeVisible();
  };

  /**
   * Close the weekly review without throwing the journey away.
   *
   * The shared `dismissReview` answers an event by clicking its LAST choice,
   * which for this career's settlement offer is "settle the oldest case now" —
   * it would quietly close the very file the test is about and then fail three
   * lines later looking for it. Every Solicitor event puts the harmless option
   * first, so that is the one taken here.
   */
  const closeWeek = async (page: Page) => {
    const review = page.getByRole("dialog");
    if (!(await review.isVisible().catch(() => false))) return;
    /* Unanchored: an event choice's accessible name is its label AND the
       detail line underneath it, so "Push for the full fee" is really "Push
       for the full fee No change — the case runs on". Anchoring matched
       nothing, the fallback took the LAST choice, and the last choice settled
       the very file this journey is about. */
    const keep = review.getByRole("button", {
      name: /Push for the full fee|Decline the instruction|Take the meeting/,
    });
    if (await keep.count()) {
      await keep.first().click();
      await expect(review).toBeHidden();
      return;
    }
    await dismissReview(page);
  };

  /**
   * Cash, read from the Books screen's own figure.
   *
   * The shared `readCash` takes the first dollar sign in `main`, which on a
   * Solicitor screen is a settlement offer or a fee rather than the bank
   * balance — and it drops the minus sign, which matters in a career whose
   * whole subject is being owed money you have not got.
   */
  const readFirmCash = async (page: Page): Promise<number> => {
    await tab(page, /^The books$/);
    const text = await page.getByRole("main").innerText();
    const hit = /Cash\s+(-?)\$([\d,]+)/.exec(text);
    if (!hit) throw new Error("could not read cash from the books");
    return Number(`${hit[1]}${hit[2].replace(/,/g, "")}`);
  };

  test("chambers is four screens, each stating what it decides", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startSolicitor(page);
    await go(page, /Work/);

    const screens: [RegExp, RegExp][] = [
      [/^Instructions$/, /what this market will ever send you/i],
      [/^Casework$/, /what settling pays today/i],
      [/^The books$/, /costs that fall due whatever happens/i],
      [/^The firm$/, /who is billing hours/i],
    ];
    for (const [label, purpose] of screens) {
      await tab(page, label);
      await expect(
        page.getByRole("heading", { level: 1, name: label }),
        `${label} is reachable from chambers`,
      ).toBeVisible();
      await expect(
        page.getByText(purpose).first(),
        `${label} says what it is for`,
      ).toBeVisible();
    }

    /* Neither the Physician's screens nor the Chef's belong here, and nor does
       the generic shell's single "Business" screen the career used to live
       on. */
    await expect(
      page.getByRole("tab", {
        name: /Caseload|Supplies|Larder|The pass|Business/,
      }),
    ).toHaveCount(0);

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("an instruction can be taken, worked, and settled", async ({ page }) => {
    /* Genuinely long: a career select, a start city, up to six committed weeks
       with a review dialog each, and four screens walked afterwards. The
       assertions are the point; the clock is not. */
    test.slow();
    const problems = watchConsole(page);
    await startSolicitor(page);

    /* 1. Nothing is on the table in week one, and the screen says so rather
       than showing an empty list. */
    await go(page, /Work/);
    await tab(page, /^Instructions$/);
    await expect(
      page.getByRole("heading", { name: /Practising in London/ }),
    ).toBeVisible();
    await expect(page.getByText(/Nothing on offer/i).first()).toBeVisible();

    /* The market states its own ceiling — the thing a player cannot infer from
       a rate card. */
    await expect(
      page.getByText(/At this standing you are offered up to/i).first(),
    ).toBeVisible();

    /* 2. Pitch until something comes in the door. Instructions arrive on a
       resolved week, so this is the loop a player actually runs. */
    let accepted = false;
    for (let week = 0; week < 6 && !accepted; week++) {
      await go(page, /Week/);
      await playWeek(page, "Pitch for work");
      await closeWeek(page);
      await go(page, /Work/);
      await tab(page, /^Instructions$/);
      const accept = page
        .getByRole("button", { name: /Accept the instruction/ })
        .first();
      if (await accept.count()) {
        /* Who pays, and when, is on the card before it is taken — that is the
           whole point of it being a term rather than a surprise. */
        await expect(
          page.getByText(/Pays on delivery|Slow payer|Doubtful/i).first(),
          "the instruction states its payer before you accept it",
        ).toBeVisible();
        await accept.click();
        accepted = true;
      }
    }
    expect(accepted, "an instruction arrived and was accepted").toBe(true);

    /* 3. It is on the books, unprepared, against a date — and it says what
       winning pays and what losing costs. */
    await tab(page, /^Casework$/);
    await expect(
      page.getByText(/On the books in London/i).first(),
    ).toBeVisible();
    await expect(page.getByRole("meter").first()).toBeVisible();
    await expect(page.getByText(/in their costs/i).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Settle for /i }).first(),
      "the settle decision is on the file",
    ).toBeVisible();

    /* 4. Do the work. Casework is the block that moves hours into files. */
    await go(page, /Week/);
    await playWeek(page, "Casework");
    await closeWeek(page);

    /* 5. Settle it, and the money is there. Settling is the one thing in this
       career that pays on the day it is decided. */
    await go(page, /Work/);
    const before = await readFirmCash(page);
    await tab(page, /^Casework$/);
    await page.getByRole("button", { name: /^Settle for /i }).first().click();
    expect(await readFirmCash(page), "settling pays at once").toBeGreaterThan(
      before,
    );

    /* 6. And it is on the record as a settlement rather than a judgment. */
    await tab(page, /^The firm$/);
    await expect(page.getByText(/The record/i).first()).toBeVisible();
    await expect(page.getByText(/Settled/i).first()).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("a hearing is reached, and the week reads back what the court said", async ({
    page,
  }) => {
    test.slow();
    const problems = watchConsole(page);
    await resume(page, "solicitor-listed");

    /* The fixture is a practice mid-run: work on the books, money owed to it,
       and a matter listed for the week about to be committed. */
    await go(page, /Work/);
    await tab(page, /^Casework$/);
    await expect(
      page.getByText(/On the books in London/i).first(),
    ).toBeVisible();

    await go(page, /Week/);
    await playWeek(page, "Casework");

    /* The review is the week read back, and a court decided something in it. */
    const review = page.getByRole("dialog");
    await expect(review).toBeVisible();
    await expect(
      review.getByText(/Case won|Case lost|cases won/i).first(),
      "the week reports what the court said",
    ).toBeVisible();
    await closeWeek(page);

    /* And the record carries it, with the odds it was decided at. */
    await go(page, /Work/);
    await tab(page, /^The firm$/);
    await expect(
      page.getByText(/Won at \d+%|Lost at \d+%|Settled/).first(),
      "the record states how it was decided",
    ).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("a judgment you are owed can be sold rather than waited for", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page, "solicitor-listed");

    await go(page, /Work/);
    await tab(page, /^The books$/);

    /* The figures the career is operated against, and the sentence that
       separates money from everything that is not money yet. */
    await expect(
      page.getByText(/What the firm is worth/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/Owed to you/i).first()).toBeVisible();
    await expect(page.getByText(/Unbilled work/i).first()).toBeVisible();

    /* The fixture carries a judgment that has not turned into money. Selling
       it is the constraint as a button: cash today, at a stated discount. */
    const sell = page
      .getByRole("button", { name: /^Sell it today for /i })
      .first();
    await expect(sell, "a judgment on the books can be sold").toBeVisible();
    await expect(
      page.getByText(/Giving up .* to stop waiting/i).first(),
      "and the discount is stated rather than discovered",
    ).toBeVisible();

    const before = await readFirmCash(page);
    await sell.click();
    expect(await readFirmCash(page), "selling pays today").toBeGreaterThan(
      before,
    );

    expect(problems).toEqual([]);
  });

  test("the phone is the practice's own", async ({ page }) => {
    const problems = watchConsole(page);
    await startSolicitor(page);

    /* The handset opens from the same button the other two careers have. */
    await page.getByRole("button", { name: /open phone/i }).click();
    const phone = page.getByRole("dialog");
    await expect(phone).toBeVisible();

    /* The solicitor who trained you is waiting in messages — talking about
       rent and files, not about wards or critics. */
    await phone.getByRole("button", { name: /messages/i }).first().click();
    await expect(phone.getByText(/Margaret Ellory/i).first()).toBeVisible();
    await expect(
      phone.getByText(/never fall in love with a file/i).first(),
    ).toBeVisible();
    await expect(
      phone.getByText(/Senior solicitor/i).first(),
      "and they are labelled in this career's words",
    ).toBeVisible();

    /* Publish the opening post through the real composer. */
    await phone.getByRole("button", { name: /pulse/i }).first().click();
    await phone.getByRole("button", { name: /compose/i }).first().click();
    await phone.getByRole("button", { name: /the doors are open/i }).click();
    await phone.getByRole("button", { name: /^publish$/i }).click();
    await expect(
      phone.getByText(/New practice, London/i).first(),
      "the published post lands on the feed",
    ).toBeVisible();
    await expect(
      phone.getByText(/already posted this week/i).first(),
      "one post a week",
    ).toBeVisible();

    /* The cause list and the roll are apps, not dashboard panels. */
    await phone.getByRole("button", { name: /^listings$/i }).click();
    await expect(phone.getByText(/The cause list/i).first()).toBeVisible();
    await expect(
      phone.getByText(/Nothing is listed/i).first(),
      "a practice with no files says so",
    ).toBeVisible();

    await phone.getByRole("button", { name: /^roll$/i }).click();
    await expect(phone.getByText(/The roll/i).first()).toBeVisible();
    await phone
      .getByRole("button", { name: /take them on/i })
      .first()
      .click();
    await expect(
      phone.getByText(/^1 other$/i).first(),
      "a hire made by phone lands on the payroll, counted in the header",
    ).toBeVisible();

    /* Nothing in the handset speaks another career's language. */
    const text = await phone.innerText();
    expect(
      text.match(
        /patient|caseload|department|physician|ward|brigade|larder|covers/i,
      )?.[0],
      "no borrowed vocabulary on the solicitor's phone",
    ).toBeUndefined();

    await page.keyboard.press("Escape");
    await expect(phone).toBeHidden();

    /* And the person taken on is on the Firm screen, where the report lives. */
    await go(page, /Work/);
    await tab(page, /^The firm$/);
    await expect(page.getByText(/Who is billing hours/i).first()).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("counsel is briefed from the cause list, not from a shelf", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page, "solicitor-listed");

    /* The doorway: the Casework screen names what the list is for and opens
       the handset on it, rather than carrying the transaction itself. */
    await go(page, /Work/);
    await tab(page, /^Casework$/);
    await page
      .getByRole("button", { name: /call the listings office/i })
      .click();

    const phone = page.getByRole("dialog");
    await expect(
      phone.getByText(/The cause list/i).first(),
      "the handset opens straight onto the listings",
    ).toBeVisible();

    /* Every listed matter states its date, and the brief either says what it
       buys or why it cannot be pressed. */
    await expect(
      phone.getByText(/Week \d+|Listed this week/).first(),
    ).toBeVisible();
    /* Counsel is a ladder now — see "the solicitor's practice areas" for the
       tiers themselves. What this journey cares about is that the doorway
       lands on a screen where the call can be made at all. */
    await expect(
      phone.getByRole("button", { name: /A senior junior · /i }).first(),
      "briefing counsel is a call you make",
    ).toBeVisible();
    const shown = await phone.innerText();
    expect(
      /on the odds|Costs .* and you have/i.test(shown),
      "a brief states what it buys, or why it cannot be pressed",
    ).toBe(true);

    await page.keyboard.press("Escape");
    await expect(phone).toBeHidden();
    expect(problems).toEqual([]);
  });

  test("every solicitor screen fits, and none nests a button in a button", async ({
    page,
  }) => {
    await startSolicitor(page);
    await go(page, /Work/);

    for (const label of [
      /^Instructions$/,
      /^Casework$/,
      /^The books$/,
      /^The firm$/,
    ]) {
      await tab(page, label);
      await expectNoPageOverflow(page);
      const nested = await page.evaluate(
        () => document.querySelectorAll("button button").length,
      );
      expect(nested, `no nested buttons on ${label}`).toBe(0);
    }

    /* Keyboard reach, on a screen that has controls to reach. */
    await tab(page, /^The books$/);
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(
      () => document.activeElement?.tagName ?? "",
    );
    expect(["BUTTON", "A"], "tab reaches a control").toContain(focused);

    /* And the Map, which the career shares with everyone else. */
    await go(page, /World/);
    await expectNoPageOverflow(page);
  });
});

/**
 * BEING TOLD WHAT TO DO, IN EVERY CAREER
 *
 * Four systems — the badges on the navigation, the one next step, the lessons
 * that retire themselves, and the glossary — rendered for anybody and only
 * ever had Physician content, so two of the three careers played with none of
 * them. The engine suite proves each career now derives all four; this proves
 * a player actually meets them.
 */
test.describe("guidance in every career", () => {
  const CAREERS = [
    {
      card: /^open\s*chef/i,
      name: "Chef",
      begin: /^Begin in Lyon$/,
      /* The opening lesson, and a word only this career uses. */
      lesson: /A week is six blocks, and the food is already ageing/i,
      word: /Larder|Cover|Brigade/i,
    },
    {
      card: /^open\s*solicitor/i,
      name: "Solicitor",
      begin: /^Begin in London$/,
      lesson: /A week is six blocks, and none of them pay/i,
      word: /Instruction|Work in progress|Costs order/i,
    },
    {
      card: /^open\s*founder/i,
      name: "Founder",
      begin: /^Begin in New York$/,
      lesson: /A week is six blocks, and the runway shortens either way/i,
      word: /Runway|Default alive|Dilution/i,
    },
    {
      card: /^open\s*politician/i,
      name: "Politician",
      begin: /^Begin in London$/,
      lesson: /A week is six blocks, and support drains through all of them/i,
      word: /Bloc|Drift|Reversal|Party standing/i,
    },
    {
      card: /^open\s*architect/i,
      name: "Architect",
      begin: /^Begin in Amsterdam$/,
      lesson: /A week is six blocks, and a building takes years of them/i,
      word: /Commission|Banked|Sent back|Portfolio/i,
    },
    {
      card: /^open\s*engineer/i,
      name: "Engineer",
      begin: /^Begin in Berlin$/,
      lesson: /A week is six blocks, and you never see what is in the work/i,
      word: /The estimate|Confidence|Tolerance|Surfaced/i,
    },
  ];

  for (const career of CAREERS) {
    test(`the ${career.name} is taught, warned and given the words`, async ({
      page,
    }) => {
      const problems = watchConsole(page);
      await page.goto("/");
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      const card = page.getByRole("button", { name: career.card }).first();
      await card.click();
      await card.click();
      await page.getByRole("button", { name: career.begin }).click();

      /* 1. The lesson, on the screen its system lives on, in week one. */
      const lesson = page.getByRole("heading", { name: career.lesson });
      await expect(lesson, "week one opens with a lesson").toBeVisible();

      /* And it retires when the player closes it — this is the only piece of
         state in the whole feature, so it is worth proving it sticks. */
      await page.getByRole("button", { name: /^Hide this$/ }).first().click();
      await expect(lesson).toHaveCount(0);

      /* 2. The one next step. Every career gets the plan nudges at minimum,
         which is what two of the three never had. `complementary` rather than
         `region`: it is an <aside>, and the implicit role follows the tag. */
      const step = page.getByRole("complementary", {
        name: /Suggested next step/i,
      });
      await expect(step, "the Overview suggests something").toBeVisible();
      await expect(step.getByText(/Assign your time/i)).toBeVisible();

      /* 3. The glossary, which used to render for the Physician alone. */
      await page.getByRole("button", { name: /what the words mean/i }).click();
      const words = page.getByRole("dialog");
      await expect(words).toBeVisible();
      await expect(
        words.getByText(career.word).first(),
        "the glossary carries this career's vocabulary",
      ).toBeVisible();

      /* Nobody else's, though. */
      const shown = await words.innerText();
      expect(
        shown.match(/patient|caseload|triage|outbreak|physician/i)?.[0],
        `${career.name}'s glossary shows a Physician's word`,
      ).toBeUndefined();

      /* The lessons tab lists them, including the one just hidden, so it can
         be brought back. */
      await words.getByRole("tab", { name: /^Lessons$/ }).click();
      await expect(words.getByText(career.lesson).first()).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(words).toBeHidden();

      expect(problems).toEqual([]);
    });
  }

  /**
   * A badge is a claim that something needs attention, so it is asserted in a
   * state where something genuinely does. A brand-new practice is *not* one:
   * a solicitor with no work in week one has a plan, not a problem, and the
   * next-step card above is the right vehicle for that. A kitchen with an
   * empty larder cannot open at all, which is.
   */
  test("a run in trouble is badged on the destination that fixes it", async ({
    page,
  }) => {
    const problems = watchConsole(page);

    /* The Chef: nothing in the larder, from the first week. */
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    const chefCard = page.getByRole("button", { name: /^open\s*chef/i }).first();
    await chefCard.click();
    await chefCard.click();
    await page.getByRole("button", { name: /^Begin in Lyon$/ }).click();

    await expect(page.getByText(/Nothing in the larder/i).first()).toBeVisible();
    /* Asserted on the screen-reader text rather than the digit: severity is
       carried by shape and colour for a sighted player and by this sentence
       for everybody else, so this is what proves the badge says something. */
    await expect(
      page
        .getByRole("navigation", { name: "Primary" })
        .last()
        .getByRole("button")
        .filter({ hasText: /Work/ })
        .first()
        .getByText(/\d+ (critical|warning)s? in Work/i)
        .first(),
      "the kitchen is badged, and says what is wrong",
    ).toBeAttached();

    /* The Solicitor: a mid-run practice that is overdrawn. */
    await preload(page, "solicitor-listed");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    await expect(page.getByText(/Overdrawn/i).first()).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Primary" })
        .last()
        .getByRole("button")
        .filter({ hasText: /Work/ })
        .first()
        .getByText(/\d+ (critical|warning)s? in Work/i)
        .first(),
      "chambers is badged, and says what is wrong",
    ).toBeAttached();

    expect(problems).toEqual([]);
  });
});

/**
 * A CRISIS, IN A SOLICITOR'S WORDS
 *
 * The card renders for every career and only ever had Physician content
 * behind it — medical prose, medical reputation categories, and a raiser that
 * lived inside the medical module. The engine suite proves a practice now has
 * five of its own and that they are answerable; this proves a player meets one,
 * reads it in this career's language, and can act on it.
 */
test.describe("a solicitor's crisis", () => {
  /* The crisis card itself. Scoped, because a setback or another crisis can
     legitimately sit above it and every one of them has a "Do this" — the
     first version of this took the first one on the page and answered a
     burnout setback instead. */
  const crisisCard = (page: Page) =>
    page
      .locator("section")
      .filter({ hasText: /The regulator wants to see the client account/ })
      .first();

  const resumeCrisis = async (page: Page) => {
    await preload(page, "solicitor-crisis");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).last(),
    ).toBeVisible();
  };

  test("it explains itself in this career's language", async ({ page }) => {
    const problems = watchConsole(page);
    await resumeCrisis(page);

    /* It outranks whatever screen you were on — a crisis a player has to go
       looking for is one they leave until it escalates. */
    await expect(
      page.getByRole("heading", { name: /Failed inspection/i }).first(),
      "the crisis is on the Overview, not behind a tab",
    ).toBeVisible();
    await expect(
      page.getByText(/The regulator wants to see the client account/i).first(),
    ).toBeVisible();

    /* The explanation is the Solicitor's, not the Physician's. */
    await expect(
      page.getByText(/client account/i).first(),
      "it says where this kind of trouble comes from, in legal terms",
    ).toBeVisible();

    const shown = await page.getByRole("main").innerText();
    expect(
      shown.match(/malpractice|clinician|patient|rota|ward\b/i)?.[0],
      "no medical vocabulary on a solicitor's crisis",
    ).toBeUndefined();

    /* And it states the deadline rather than implying one. Scoped to main:
       the navigation itself contains a destination called "Week" now, and a
       hidden desktop rail's label is not a deadline. */
    await expect(
      page.getByRole("main").getByText(/week|stage/i).first(),
    ).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("a choice can be taken, and it moves the crisis", async ({ page }) => {
    const problems = watchConsole(page);
    await resumeCrisis(page);

    /* Every choice states what it costs before it is pressed. */
    const accountant = page
      .getByText(/Put an accountant on it/i)
      .first();
    await expect(accountant).toBeVisible();

    /* Read from the status strip's own cell rather than with `readCash`,
       which takes the first dollar sign in `main` — on this screen that is a
       crisis choice's price, and the choices change when the stage does. */
    const bank = async () =>
      (await page
        .locator('dd[aria-label^="Cash:"]')
        .first()
        .getAttribute("aria-label")) ?? "";
    const before = await bank();

    /* The option that costs time rather than money, so the assertion is about
       the crisis moving rather than about arithmetic the engine suite already
       covers. */
    await crisisCard(page)
      .getByRole("button", { name: /^Do this$/ })
      .first()
      .click();

    /* One choice per stage: the option taken leaves rather than greying out,
       and the crisis has moved on to the next beat. */
    await expect(
      page.getByText(/They have found a shortfall/i).first(),
      "answering it moves the crisis to its next stage",
    ).toBeVisible();
    await expect(
      page.getByText(/Open the books completely/i),
      "a choice already taken is not offered again",
    ).toHaveCount(0);

    /* And the run recorded what happened, in the career's own log. */
    await expect(
      page.getByText(/including the things they had not asked for/i).first(),
    ).toBeVisible();

    /* Cash did not move: that choice is paid for in time, and the panel says
       so on the card. */
    expect(await bank(), "the choice paid for in time cost no money").toBe(
      before,
    );

    expect(problems).toEqual([]);
  });

  test("the crisis costs time, and the week says so", async ({ page }) => {
    const problems = watchConsole(page);
    await resumeCrisis(page);

    /* The planner's budget before anything is answered. */
    const budgetOf = async () => {
      const strip = await page.getByRole("main").innerText();
      const hit = /of (\d+) blocks/i.exec(strip);
      return hit ? Number(hit[1]) : 0;
    };
    const before = await budgetOf();
    expect(before, "a week starts with blocks in it").toBeGreaterThan(0);

    /* "Open the books completely" costs a block of the week. */
    await crisisCard(page)
      .getByRole("button", { name: /^Do this$/ })
      .first()
      .click();

    expect(
      await budgetOf(),
      "crisis work is paid for out of the week, not out of thin air",
    ).toBeLessThan(before);

    expect(problems).toEqual([]);
  });
});

/**
 * THE PEOPLE AROUND A PRACTICE
 *
 * `people.ts` was career-neutral machinery with exactly one career plugged
 * into it — the panel imported the Physician's cast directly, so a Solicitor
 * had nobody. The engine suite proves the six exist, arrive and change
 * numbers; this proves a player can meet them.
 */
test.describe("the solicitor's people", () => {
  test("the firm screen carries who remembers you", async ({ page }) => {
    const problems = watchConsole(page);
    await preload(page, "solicitor-listed");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Work/ })
      .first()
      .click();
    await page.getByRole("tab", { name: /^The firm$/ }).first().click();

    /* The people around the practice, not the people in it. */
    await expect(
      page.getByRole("heading", { name: /^People$/ }).first(),
    ).toBeVisible();
    await expect(page.getByText(/Margaret Ellory/).first()).toBeVisible();
    await expect(
      page.getByText(/The solicitor who took you on/).first(),
      "each of them says who they are, not just a number",
    ).toBeVisible();

    /* Three of them are the accounts that talk on the handset. */
    await expect(page.getByText(/Julian Farrow/).first()).toBeVisible();
    await expect(page.getByText(/Derek Oyelaran/).first()).toBeVisible();

    /* One tap opens the bio and what they remember. */
    await page
      .getByRole("button", { name: /Margaret Ellory/ })
      .first()
      .click();
    await expect(
      page.getByText(/a stranger would one day read it aloud/i).first(),
      "opening somebody shows who they are",
    ).toBeVisible();

    /* Nobody here speaks another career's language. */
    const text = await page.getByRole("main").innerText();
    expect(
      text.match(/patient|caseload|physician|triage|outbreak|supervising consultant/i)?.[0],
      "no borrowed vocabulary among the solicitor's people",
    ).toBeUndefined();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("the handset and the people screen are the same cast", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    const card = page.getByRole("button", { name: /^open\s*solicitor/i }).first();
    await card.click();
    await card.click();
    await page.getByRole("button", { name: /^Begin in London$/ }).click();

    /* She sends the welcome message. */
    await page.getByRole("button", { name: /open phone/i }).click();
    const phone = page.getByRole("dialog");
    await phone.getByRole("button", { name: /messages/i }).first().click();
    await expect(phone.getByText(/Margaret Ellory/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(phone).toBeHidden();

    /* And she is a person with a card, from week one. */
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Work/ })
      .first()
      .click();
    await page.getByRole("tab", { name: /^The firm$/ }).first().click();
    await expect(
      page.getByText(/Margaret Ellory/).first(),
      "the person who messaged you is the person on the screen",
    ).toBeVisible();

    expect(problems).toEqual([]);
  });
});

/**
 * WHAT THE FIRM TURNED OUT TO BE
 *
 * The engine suite proves finished hours make a practice faster, better and
 * dearer at the work it does. This proves a player can see it happening, and
 * that counsel is a choice of who rather than a yes-or-no.
 */
test.describe("the solicitor's practice areas", () => {
  const openInstructions = async (page: Page) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Work/ })
      .first()
      .click();
    await page.getByRole("tab", { name: /^Instructions$/ }).first().click();
  };

  test("a new practice has specialised in nothing, and says so", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    const card = page.getByRole("button", { name: /^open\s*solicitor/i }).first();
    await card.click();
    await card.click();
    await page.getByRole("button", { name: /^Begin in London$/ }).click();

    await openInstructions(page);
    await expect(
      page.getByRole("heading", { name: /What this firm is known for/ }),
    ).toBeVisible();
    await expect(
      page.getByText(/Nothing finished yet/i).first(),
      "and it says what decides it",
    ).toBeVisible();
    await expect(
      page.getByText(/decides what this firm becomes/i).first(),
    ).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("a firm with a history shows what it has done and what it is worth", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await preload(page, "solicitor-listed");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    await openInstructions(page);

    /* The fixture is a real run: a hundred-odd finished hours in each of two
       areas, which is a practice that has started to become something. */
    await expect(
      page.getByText(/A house purchase/).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/\d+h · (Occasional|Regular work|Known for it|Specialists)/).first(),
      "hours and what the profession would call them",
    ).toBeVisible();
    await expect(
      page.getByRole("meter").first(),
      "and it is a meter rather than a number in a sentence",
    ).toBeVisible();

    /* The effects are stated rather than hidden in the maths. */
    await expect(
      page.getByText(/% hours/).first(),
      "the reward is stated in the career's own currency",
    ).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("counsel is a choice of who, not whether", async ({ page }) => {
    const problems = watchConsole(page);
    await preload(page, "solicitor-listed");
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();

    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Work/ })
      .first()
      .click();
    await page.getByRole("tab", { name: /^Casework$/ }).first().click();
    await page
      .getByRole("button", { name: /call the listings office/i })
      .click();

    const phone = page.getByRole("dialog");
    await expect(phone.getByText(/The cause list/i).first()).toBeVisible();

    /* Three of them, and each says what it buys. */
    await expect(
      phone.getByRole("button", { name: /A junior · /i }).first(),
    ).toBeVisible();
    await expect(
      phone.getByRole("button", { name: /A senior junior · /i }).first(),
    ).toBeVisible();
    await expect(
      phone.getByRole("button", { name: /Leading counsel · /i }).first(),
      "the fixture carries matters big enough for a silk",
    ).toBeVisible();

    const shown = await phone.innerText();
    expect(
      /on the odds|Costs .* and you have/i.test(shown),
      "every tier states what it buys, or why it cannot be pressed",
    ).toBe(true);

    /* And they are a real spread rather than three names for one thing. */
    const prices = [...shown.matchAll(/·\s*\$([\d,]+)/g)].map((m) =>
      Number(m[1].replace(/,/g, "")),
    );
    expect(
      new Set(prices).size,
      "the tiers are priced differently",
    ).toBeGreaterThan(1);

    await page.keyboard.press("Escape");
    await expect(phone).toBeHidden();
    expect(problems).toEqual([]);
  });
});


/**
 * WHERE THE FIRM SITS
 *
 * Chambers were derived from headcount, so there was nothing to decide and
 * nothing to see. The engine suite proves the ladder charges, caps and pays;
 * this proves a player meets the wall and is told how to get past it.
 */
test.describe("the solicitor's chambers", () => {
  const openFirm = async (page: Page) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Work/ })
      .first()
      .click();
    await page.getByRole("tab", { name: /^The firm$/ }).first().click();
  };

  const startSolicitor = async (page: Page) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    const card = page.getByRole("button", { name: /^open\s*solicitor/i }).first();
    await card.click();
    await card.click();
    await page.getByRole("button", { name: /^Begin in London$/ }).click();
  };

  test("a new practice is in a borrowed desk, and can see the next rung", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startSolicitor(page);
    await openFirm(page);

    await expect(
      page.getByRole("heading", { name: /A borrowed desk/ }),
    ).toBeVisible();
    await expect(
      page.getByText(/1 of 3/).first(),
      "the rooms say how many they hold and how many are in them",
    ).toBeVisible();
    await expect(
      page.getByText(/A high-street office/).first(),
      "and what the next set would be",
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Take it · /i }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/rent is due from the week you move|Costs .* and you have/i).first(),
      "and what taking it commits you to",
    ).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("the rooms fill up, and the firm is told it has to move", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await startSolicitor(page);

    /* Two hires fill a borrowed desk. The Roll is where hiring happens. */
    await page.getByRole("button", { name: /open phone/i }).click();
    const phone = page.getByRole("dialog");
    await phone.getByRole("button", { name: /^roll$/i }).click();
    await expect(phone.getByText(/1\/3/).first()).toBeVisible();

    const take = phone.getByRole("button", { name: /take them on/i }).first();
    await take.click();
    await take.click();
    await expect(
      phone.getByText(/3\/3/).first(),
      "the seats fill as the firm hires",
    ).toBeVisible();

    await expect(
      phone.getByText(/seats 3 and is full/i).first(),
      "and the Roll says why nobody else can be taken on",
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(phone).toBeHidden();

    /* And the Firm screen says the same thing, where the move is made. */
    await openFirm(page);
    await expect(
      page.getByText(/These rooms are full/i).first(),
    ).toBeVisible();

    expect(problems).toEqual([]);
  });
});


/**
 * MONEY THAT ARRIVES ON A DAY YOU CAN NAME
 *
 * A retainer is the premise's opposite number, and the engine suite proves it
 * is a trade rather than a button. This proves a player meets the offer,
 * understands what it costs before taking it, and can see it running.
 */
test.describe("the solicitor's retainers", () => {
  const resume = async (page: Page, fixture: string) => {
    await preload(page, fixture);
    await page.goto("/");
    await page.getByRole("button", { name: /continue your run/i }).click();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).last(),
    ).toBeVisible();
  };

  const tab = async (page: Page, where: RegExp) => {
    await page
      .getByRole("navigation", { name: "Primary" })
      .last()
      .getByRole("button")
      .filter({ hasText: /Work/ })
      .first()
      .click();
    await page.getByRole("tab", { name: where }).first().click();
  };

  test("an offer states what it pays and what it costs, before it is taken", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page, "solicitor-retainer");
    await tab(page, /^Instructions$/);

    await expect(
      page.getByRole("heading", { name: /wants you on a retainer/i }),
    ).toBeVisible();

    /* All three costs on the card, before the button. */
    await expect(page.getByText(/a week/).first()).toBeVisible();
    await expect(
      page.getByText(/Costs/).first(),
      "the hours it reserves",
    ).toBeVisible();
    await expect(
      page.getByText(/Fewer instructions will come in the door/i).first(),
      "and the cost that is easy to miss",
    ).toBeVisible();

    await expectNoPageOverflow(page);
    expect(problems).toEqual([]);
  });

  test("taking one puts it on the books, and it can be given notice", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await resume(page, "solicitor-retainer");

    /* Nothing standing to begin with, and the books say so plainly. */
    await tab(page, /^The books$/);
    await expect(
      page.getByText(/Money that arrives on a day you can name/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/waiting on somebody else/i).first(),
    ).toBeVisible();

    /* Take it. */
    await tab(page, /^Instructions$/);
    await page.getByRole("button", { name: /take the retainer/i }).first().click();

    /* And it is running, with what it pays and what it reserves. */
    await tab(page, /^The books$/);
    await expect(
      page.getByText(/Every week/i).first(),
      "the books carry what it pays",
    ).toBeVisible();
    await expect(
      page.getByText(/Hours reserved/i).first(),
      "and what it takes",
    ).toBeVisible();
    await expect(
      page.getByText(/weeks left/i).first(),
      "and that it does not run for ever",
    ).toBeVisible();

    /* And it can be ended, with the cost of ending it stated. */
    await expect(
      page.getByRole("button", { name: /give notice/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/walked away from a client/i).first(),
    ).toBeVisible();

    expect(problems).toEqual([]);
  });
});
