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

    await expect(page.getByRole("heading", { level: 1, name: "How can we help?" })).toBeVisible();
    await expect(page.getByTestId("help-article")).toHaveCount(HELP_ARTICLES.length);
    await expect(page.getByTestId("help-tutorial-card")).toHaveCount(HELP_ARTICLES.length);

    const headings = await page.locator("section[id] > h2").allTextContents();
    expect(headings).toEqual(HELP_MANUAL.map((section) => section.title));

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

  test("a tutorial card in the overview jumps to its article", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 700 });
    await signIn(page);
    await page.goto("/help");

    const last = HELP_ARTICLES[HELP_ARTICLES.length - 1];
    await page.getByTestId("help-tutorial-card").filter({ hasText: last.title }).click();
    await expect(page).toHaveURL(new RegExp(`#${last.slug}$`));
    await expect(page.locator(`article#${last.slug}`)).toBeInViewport();
  });

  test("search narrows the tutorials, and says so when nothing matches", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page);
    await page.goto("/help");

    const search = page.getByTestId("help-search");
    await search.fill("decline");
    await expect(page.getByTestId("help-article")).toHaveCount(1);
    await expect(page.locator("article#accept-or-decline")).toBeVisible();

    await search.fill("zzzzzz");
    await expect(page.getByTestId("help-article")).toHaveCount(0);
    await expect(page.getByTestId("help-empty")).toBeVisible();
    await expect(page.getByTestId("help-contact-empty")).toBeVisible();

    await page.getByRole("button", { name: "Show all tutorials" }).click();
    await expect(page.getByTestId("help-article")).toHaveCount(HELP_ARTICLES.length);
  });

  test("you can contact us from the top and from every article, and it opens the support form", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page);
    await page.goto("/help");

    await expect(page.getByTestId("help-contact-hero")).toBeVisible();
    await expect(page.getByTestId("help-contact-article")).toHaveCount(HELP_ARTICLES.length);

    await page.getByTestId("help-contact-hero").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  });

  test("each article links to the next one", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page);
    await page.goto("/help");

    await expect(page.getByTestId("help-next")).toHaveCount(HELP_ARTICLES.length - 1);
    await page.locator(`article#${HELP_ARTICLES[0].slug}`).getByTestId("help-next").click();
    await expect(page).toHaveURL(new RegExp(`#${HELP_ARTICLES[1].slug}$`));
  });

  test("the dashboard offers the tour, and stays closed on this device once closed", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page);
    await page.goto("/dashboard");

    const tour = page.getByTestId("dashboard-help-tour");
    await expect(tour).toBeVisible({ timeout: 20_000 });
    await expect(tour.getByRole("link")).toHaveAttribute("href", helpArticlePath("dashboard"));

    await tour.getByRole("button", { name: "Close" }).click();
    await expect(tour).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Needs your answer" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("dashboard-help-tour")).toHaveCount(0);
  });

  test("the dashboard links Needs your answer to the tutorial that explains it", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page);
    await page.goto("/dashboard");

    const link = page.getByTestId("dashboard-help-answer");
    await expect(link).toBeVisible({ timeout: 20_000 });
    await expect(link).toHaveAttribute("href", helpArticlePath("accept-or-decline"));
    await link.click();
    await expect(page).toHaveURL(/\/help#accept-or-decline$/);
    await expect(page.locator("article#accept-or-decline")).toBeInViewport();
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
