import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROFILE_SURFACES, contrastRatio } from "../../lib/profile-theme";
import { PRO_SURFACES } from "../../lib/pro-theme";
import tailwindConfig from "../../tailwind.config";

const HEX = /^#[0-9A-F]{6}$/;
const AA_TEXT = 4.5;

// Text colours the professional's pages put on these surfaces (Tailwind slate).
const SLATE_50 = "#F8FAFC";
const SLATE_300 = "#CBD5E1";
const SLATE_400 = "#94A3B8";

describe("professional's pages palette (user, 2026-10-15: match the public profile's dark mode)", () => {
  it("uses the public profile's dark page, card and line colours", () => {
    assert.equal(PRO_SURFACES.page, PROFILE_SURFACES.dark.bg);
    assert.equal(PRO_SURFACES.card, PROFILE_SURFACES.dark.surface);
    assert.equal(PRO_SURFACES.line, PROFILE_SURFACES.dark.border);
  });

  it("defines every colour as an upper-case hex", () => {
    for (const [key, value] of Object.entries(PRO_SURFACES)) {
      assert.match(value, HEX, key);
    }
  });

  it("puts lighter cards in front of a deeper page, and raised rows lighter again", () => {
    const fromWhite = (hex: string) => contrastRatio("#FFFFFF", hex);
    assert.ok(fromWhite(PRO_SURFACES.page) > fromWhite(PRO_SURFACES.card), "card lighter than page");
    assert.ok(fromWhite(PRO_SURFACES.card) > fromWhite(PRO_SURFACES.raised), "raised lighter than card");
  });

  it("keeps body and muted text readable (WCAG AA) on every surface", () => {
    for (const key of ["page", "card", "raised"] as const) {
      assert.ok(contrastRatio(SLATE_50, PRO_SURFACES[key]) >= AA_TEXT, `slate-50 on ${key}`);
      assert.ok(contrastRatio(SLATE_300, PRO_SURFACES[key]) >= AA_TEXT, `slate-300 on ${key}`);
      assert.ok(contrastRatio(SLATE_400, PRO_SURFACES[key]) >= AA_TEXT, `slate-400 on ${key}`);
    }
  });

  it("is exposed to Tailwind as pro-page, pro-card, pro-raised and pro-line", () => {
    const colors = (tailwindConfig.theme?.extend?.colors ?? {}) as Record<string, unknown>;
    assert.deepEqual(colors.pro, {
      page: PRO_SURFACES.page,
      card: PRO_SURFACES.card,
      raised: PRO_SURFACES.raised,
      line: PRO_SURFACES.line,
    });
  });
});
