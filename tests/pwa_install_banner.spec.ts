import { expect, test } from "@playwright/test";

test.describe("PWA install banner", () => {
  test("does not show banner on desktop web", async ({ page }, testInfo) => {
    test.skip(
      !testInfo.project.name.toLowerCase().includes("desktop"),
      "Desktop-only regression guard"
    );
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Close install banner" })).toBeHidden();
  });

  test.describe("mobile-only UX", () => {
    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(
        !testInfo.project.name.toLowerCase().includes("mobile"),
        "Mobile-only UX flow"
      );
      await page.goto("/");
    });

    test("shows banner on mobile web and remembers Close action", async ({ page }) => {
      const closeBtn = page.getByRole("button", { name: "Close install banner" });
      await expect(closeBtn).toBeVisible({ timeout: 7000 });

      await closeBtn.evaluate((el) => {
        (el as HTMLButtonElement).click();
      });
      await expect(closeBtn).toBeHidden();

      await page.reload();
      await expect(closeBtn).toBeHidden();
    });
  });

  test("does not show banner when already running in standalone", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      Object.defineProperty(window, "matchMedia", {
        value: (query: string) => {
          if (query.includes("display-mode: standalone")) {
            return {
              matches: true,
              media: query,
              onchange: null,
              addListener: () => undefined,
              removeListener: () => undefined,
              addEventListener: () => undefined,
              removeEventListener: () => undefined,
              dispatchEvent: () => false,
            } as MediaQueryList;
          }
          return original(query);
        },
      });
    });

    await page.goto("/");
    await expect(page.getByRole("button", { name: "Close" })).toBeHidden();
    await context.close();
  });

  test("shows Android install CTA when beforeinstallprompt is available", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.toLowerCase().includes("pixel"),
      "Android-specific prompt flow"
    );

    await page.goto("/");
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt") as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: "accepted"; platform: string }>;
        preventDefault: () => void;
      };

      event.prompt = async () => undefined;
      event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
      event.preventDefault = () => undefined;
      window.dispatchEvent(event);
    });

    const installBtn = page.getByRole("button", { name: "Install" });
    await expect(installBtn).toBeVisible({ timeout: 7000 });
    await installBtn.evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(page.getByRole("button", { name: "Close install banner" })).toBeHidden();
  });
});
