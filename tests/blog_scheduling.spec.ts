import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

const TEMP_SLUG = "zz-scheduled-future-post-e2e";
const TEMP_PATH = path.join(process.cwd(), "content", "blog", `${TEMP_SLUG}.mdx`);
const TEMP_TITLE = "Scheduled Future Post E2E";

function cyprusIsoDateWithOffset(daysOffset: number): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Nicosia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  const date = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);
  date.setDate(date.getDate() + daysOffset);
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

test.describe("Blog scheduling", () => {
  test.beforeAll(async () => {
    const tomorrowInCyprus = cyprusIsoDateWithOffset(1);
    const source = `---
title: "${TEMP_TITLE}"
date: "${tomorrowInCyprus}"
description: "Temporary future post for scheduling test."
district: "paphos"
tags: ["scheduling", "test"]
image: "/showcase/16-premium-storefront.png"
---

This post should not be visible until tomorrow in Cyprus timezone.
`;
    await fs.writeFile(TEMP_PATH, source, "utf8");
  });

  test.afterAll(async () => {
    await fs.rm(TEMP_PATH, { force: true });
  });

  test("future-dated posts are hidden from list, sitemap, and direct slug", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByRole("heading", { level: 1, name: /DocCy Blog|Blog/i })).toBeVisible();
    await expect(page.getByText(TEMP_TITLE, { exact: true })).toHaveCount(0);

    await page.goto("/sitemap.xml");
    await expect(page.getByText(`/blog/${TEMP_SLUG}`, { exact: false })).toHaveCount(0);

    const direct = await page.goto(`/blog/${TEMP_SLUG}`);
    expect(direct?.status()).toBe(404);
  });
});
