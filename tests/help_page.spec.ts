import { expect, test, type Page } from "@playwright/test";

import { HELP_ARTICLES, HELP_MANUAL, helpArticlePath } from "../lib/help-manual";
import { exposeSupabaseAuthCookiesToClient } from "./helpers/doctorAuth";
import { signInDoctorOrFail } from "./helpers/signInDoctorOrFail";

function normalizeSecret(raw: string): string {
  return raw
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/^['"]+|['"]+$/g, "");
}

async function signIn(page: Page) {
  const email = normalizeSecret(process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "");
  const password = normalizeSecret(process.env.TEST_USER_PASSWORD ?? process.env.TEST_DOCTOR_PASSWORD ?? "");
  test.skip(!email || !password, "Missing test doctor credentials.");
  await signInDoctorOrFail(page, undefined, { email, password });
  await exposeSupabaseAuthCookiesToClient(page);
}

const firstWithVideo = HELP_ARTICLES.find((article) => article.video);

test.describe("Help manual", { tag: "@pr-e2e" }, () => {
  test("is inside the login: signed out goes to the login and comes back to /help", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/help");
    await expect(page).toHaveURL(/\/login\?.*next=%2Fhelp/);
  });

  test("lists every section and article, each with its steps, in order", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page);
    await page.goto("/help");

    await expect(page.getByRole("heading", { level: 1, name: "Help & tutorials" })).toBeVisible();
    await expect(page.getByTestId("help-article")).toHaveCount(HELP_ARTICLES.length);

    const headings = await page.locator("h2").allTextContents();
    expect(headings.slice(0, HELP_MANUAL.length)).toEqual(HELP_MANUAL.map((section) => section.title));

    for (const article of HELP_ARTICLES) {
      const card = page.locator(`article#${article.slug}`);
      await expect(card.getByRole("heading", { level: 3, name: article.title })).toBeVisible();
      await expect(card.getByTestId("help-steps").locator("li")).toHaveCount(article.steps.length);
    }
  });

  test("an article's anchor opens the manual at that article", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 600 });
    await signIn(page);
    await page.goto(helpArticlePath(HELP_ARTICLES[0].slug));

    const card = page.locator(`article#${HELP_ARTICLES[0].slug}`);
    await expect(card).toBeInViewport();
  });

  test("the contents list links to the articles", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page);
    await page.goto("/help");

    const link = page.getByTestId("help-contents").getByRole("link", { name: HELP_ARTICLES[0].title });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${HELP_ARTICLES[0].slug}$`));
  });

  test("Copy link puts the article's own link on the clipboard", async ({ page, context }) => {
    test.setTimeout(90_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page);
    await page.goto("/help");

    const first = HELP_ARTICLES[0];
    await page.locator(`article#${first.slug}`).getByTestId("help-copy-link").click();
    await expect(page.getByText("Link copied")).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    if (copied !== null) {
      expect(new URL(copied).pathname + new URL(copied).hash).toBe(helpArticlePath(first.slug));
    }
  });

  test("the account menu has Help & tutorials", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page);
    await page.goto("/dashboard");
    await expect(page.locator("html")).toHaveAttribute("data-doccy-pro-chrome-hydrated", "1", { timeout: 20_000 });

    await page.getByTestId("userbar-toggle").first().click();
    const item = page.getByTestId("userbar-link-help");
    await expect(item).toBeVisible();
    await item.click();
    await expect(page).toHaveURL(/\/help(?:[/?#]|$)/);
  });

  test("a video loads from YouTube only after the visitor clicks play", async ({ page }) => {
    test.skip(!firstWithVideo, "No video published yet.");
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page);

    const youtubeRequests: string[] = [];
    page.on("request", (req) => {
      if (/youtube/i.test(new URL(req.url()).hostname)) youtubeRequests.push(req.url());
    });

    await page.goto("/help");
    const card = page.locator(`article#${firstWithVideo!.slug}`);
    await expect(card.getByTestId("help-video-play")).toBeVisible();
    expect(youtubeRequests, "no request to YouTube before play").toEqual([]);
    await expect(card.getByTestId("help-video-player")).toHaveCount(0);

    await card.getByTestId("help-video-play").click();
    const player = card.getByTestId("help-video-player");
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
  });
});
