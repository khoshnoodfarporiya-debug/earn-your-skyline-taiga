import { test, expect, type Page } from "@playwright/test";

/**
 * THE FRONT DOOR
 *
 * This file seeds nothing on purpose. Every other spec installs a profile so
 * it can get at the game; these tests are about the screen that stands in
 * front of it, so they have to meet it the way a new player does.
 */

const PLAYERS_KEY = "career-tycoon:players:v1";
const ACTIVE_KEY = "career-tycoon:activePlayer:v1";

const fresh = async (page: Page) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
};

test.describe("the front door", () => {
  test("you cannot reach the game without an account", async ({ page }) => {
    await fresh(page);

    await expect(
      page.getByRole("heading", { name: /Create your account/i }),
      "a new player is asked to create an account",
    ).toBeVisible();

    /* And the game genuinely is not behind it yet. */
    await expect(
      page.getByRole("navigation", { name: "Primary" }),
      "no game chrome is rendered before signing in",
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^open\s*chef/i })).toHaveCount(0);
  });

  test("the screen is honest about what the account is", async ({ page }) => {
    await fresh(page);

    /*
     * This is a real assertion about the product, not about wording for its
     * own sake: a sign-in page that implies more security than it has is how
     * somebody ends up typing a password they use elsewhere into a game.
     */
    await expect(
      page.getByText(/lives in this browser and nowhere else/i),
      "it says where the account actually lives",
    ).toBeVisible();
    await expect(
      page.getByText(/do not reuse a password/i),
      "and warns against reusing a real password",
    ).toBeVisible();
  });

  test("creating an account opens the game and remembers you", async ({
    page,
  }) => {
    await fresh(page);

    await page.getByPlaceholder(/What should the game call you/i).fill("Rosa");
    await page.getByRole("button", { name: /Create account and play/i }).click();

    await expect(
      page.getByRole("button", { name: /^open\s*chef/i }).first(),
      "the career select is behind the door",
    ).toBeVisible();

    /* And it is a real account, written down. */
    const stored = await page.evaluate(
      ([k, a]) => ({
        players: window.localStorage.getItem(k),
        active: window.localStorage.getItem(a),
      }),
      [PLAYERS_KEY, ACTIVE_KEY] as const,
    );
    expect(stored.players).toContain("Rosa");
    expect(stored.active).toBeTruthy();

    /* Coming back does not ask again. */
    await page.reload();
    await expect(
      page.getByRole("button", { name: /^open\s*chef/i }).first(),
      "a returning player goes straight in",
    ).toBeVisible();
  });

  test("a bad name is refused with a reason", async ({ page }) => {
    await fresh(page);

    await page.getByPlaceholder(/What should the game call you/i).fill("R");
    await page.getByRole("button", { name: /Create account and play/i }).click();

    await expect(
      page.locator("main").getByRole("alert"),
      "the form says why, rather than doing nothing",
    ).toContainText(/at least 2 characters/i);
    /* And it did not let them through. */
    await expect(page.getByRole("button", { name: /^open\s*chef/i })).toHaveCount(0);
  });

  test("a passcode is asked for, and it is not stored as text", async ({
    page,
  }) => {
    await fresh(page);

    await page.getByPlaceholder(/What should the game call you/i).fill("Otto");
    await page.getByPlaceholder(/Leave empty for no passcode/i).fill("hunter22");
    await page.getByRole("button", { name: /Create account and play/i }).click();
    await expect(page.getByRole("button", { name: /^open\s*chef/i }).first()).toBeVisible();

    /*
     * The one security property this thing actually claims: whatever somebody
     * typed is not sitting in storage in the clear.
     */
    const raw = await page.evaluate(
      (k) => window.localStorage.getItem(k) ?? "",
      PLAYERS_KEY,
    );
    expect(raw, "the passcode is never written down as text").not.toContain(
      "hunter22",
    );
    expect(raw, "a salted digest is stored instead").toContain("hash");

    /* Signing out and back in asks for it. */
    await page.evaluate((a) => window.localStorage.removeItem(a), ACTIVE_KEY);
    await page.reload();
    await page.getByRole("button", { name: /Otto/ }).click();
    await expect(
      page.getByRole("heading", { name: /Welcome back, Otto/i }),
    ).toBeVisible();

    await page.getByLabel(/Passcode/i).fill("wrong");
    await page.getByRole("button", { name: /^Play$/ }).click();
    await expect(
      page.locator("main").getByRole("alert"),
      "the wrong passcode is refused",
    ).toContainText(/not the passcode/i);

    await page.getByLabel(/Passcode/i).fill("hunter22");
    await page.getByRole("button", { name: /^Play$/ }).click();
    await expect(
      page.getByRole("button", { name: /^open\s*chef/i }).first(),
      "and the right one lets you in",
    ).toBeVisible();
  });


  test("a stale active pointer is cleaned up, not trusted", async ({ page }) => {
    await fresh(page);

    /*
     * The id in storage is a claim, and for a while the app believed it
     * unconditionally: a pointer to a profile that no longer exists opened a
     * scoped game with a blank identity. Now it must land on the front door,
     * and the dead pointer must be gone.
     */
    await page.evaluate(
      ([k, a]) => {
        window.localStorage.setItem(
          k,
          JSON.stringify([
            { id: "real", name: "Real", createdAt: 0, lastSeenAt: 0 },
          ]),
        );
        window.localStorage.setItem(a, "ghost");
      },
      [PLAYERS_KEY, ACTIVE_KEY] as const,
    );
    await page.reload();

    await expect(
      page.getByRole("heading", { name: /Who is playing/i }),
      "a dead pointer lands on the front door",
    ).toBeVisible();
    expect(
      await page.evaluate((a) => window.localStorage.getItem(a), ACTIVE_KEY),
      "and the dead pointer is removed",
    ).toBeNull();
  });

  test("a corrupted save is refused, not resumed and not a crash", async ({
    page,
  }) => {
    await fresh(page);

    /* A real run, saved the real way. */
    await page.getByPlaceholder(/What should the game call you/i).fill("Iris");
    await page.getByRole("button", { name: /Create account and play/i }).click();
    const chef = page.getByRole("button", { name: /^open\s*chef/i }).first();
    await chef.click();
    await chef.click();
    await page.getByRole("button", { name: /^Begin in Lyon$/ }).click();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).last(),
    ).toBeVisible();

    /* Corrupt it the way the validator was once blind to: delete a resource
       the career declares. */
    await page.evaluate(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (!key.includes(":save:")) continue;
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}");
        delete parsed.r.cash;
        window.localStorage.setItem(key, JSON.stringify(parsed));
      }
    });
    await page.reload();

    await expect(
      page.getByRole("button", { name: /^open\s*chef/i }).first(),
      "the game lands on the select screen rather than crashing",
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue your run/i }),
      "and the corrupted run is not offered back",
    ).toHaveCount(0);
  });

  test("two accounts get two separate games", async ({ page }) => {
    await fresh(page);

    /* The first player starts a run. */
    await page.getByPlaceholder(/What should the game call you/i).fill("Ada");
    await page.getByRole("button", { name: /Create account and play/i }).click();
    const chef = page.getByRole("button", { name: /^open\s*chef/i }).first();
    await chef.click();
    await chef.click();
    await page.getByRole("button", { name: /^Begin in Lyon$/ }).click();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).last(),
    ).toBeVisible();

    /* The second signs in fresh and must not inherit it. */
    await page.evaluate((a) => window.localStorage.removeItem(a), ACTIVE_KEY);
    await page.reload();
    await page.getByRole("button", { name: /Create another account/i }).click();
    await page.getByPlaceholder(/What should the game call you/i).fill("Grace");
    await page.getByRole("button", { name: /Create account and play/i }).click();

    await expect(
      page.getByRole("button", { name: /continue your run/i }),
      "the second player does not inherit the first player's run",
    ).toHaveCount(0);
  });
});
