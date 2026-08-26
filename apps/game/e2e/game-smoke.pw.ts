import { expect, test } from "@playwright/test";

test("boots one responsive Phaser canvas without page errors", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  const canvas = page.locator("#game-root canvas");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(
      async () =>
        canvas.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 0;
        }),
      { timeout: 20_000 },
    )
    .toBe(true);

  expect(pageErrors).toEqual([]);
});
