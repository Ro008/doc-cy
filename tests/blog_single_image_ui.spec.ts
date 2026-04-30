import { expect, test } from "@playwright/test";

test.describe("Blog single-image UI rule", () => {
  test("each blog post detail renders exactly one image in the article", async ({ page }) => {
    await page.goto("/blog");
    await expect(page).toHaveURL(/\/blog(?:\?|$)/);

    const postLinks = page.locator("section article h2 a");
    const postCount = await postLinks.count();
    expect(postCount).toBeGreaterThan(0);

    const hrefs = await postLinks.evaluateAll((elements) =>
      elements
        .map((element) => (element as HTMLAnchorElement).getAttribute("href"))
        .filter((href): href is string => Boolean(href && href.startsWith("/blog/"))),
    );

    const uniquePostHrefs = Array.from(new Set(hrefs));
    expect(uniquePostHrefs.length).toBeGreaterThan(0);

    for (const href of uniquePostHrefs) {
      await page.goto(href);
      await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\?|$)`));

      const article = page.locator("article").first();
      await expect(article).toBeVisible();

      const imageCount = await article.locator("img").count();
      expect(imageCount, `Expected exactly one image in ${href}, got ${imageCount}`).toBe(1);

      const onlyImage = article.locator("img").first();
      await expect(onlyImage).toBeVisible();
    }
  });
});
