import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as theme from "../../lib/profile-theme";
import { PROFILE_ACCENT, PROFILE_SURFACES, contrastRatio, profileThemeStyle } from "../../lib/profile-theme";

const HEX = /^#[0-9A-F]{6}$/;
const AA_TEXT = 4.5;
const AA_LARGE = 3;

describe("profile palette", () => {
  it("is DocCy teal on every profile: no colour for the professional to pick (user, 2026-10-13)", () => {
    assert.equal(PROFILE_ACCENT.hero, "#12B8C0");
    assert.equal(PROFILE_ACCENT.onHero, "#062F61");
    for (const gone of ["PROFILE_ACCENTS", "PROFILE_ACCENT_IDS", "DEFAULT_PROFILE_ACCENT", "resolveProfileAccent"]) {
      assert.equal(gone in theme, false, gone);
    }
  });

  it("defines every colour as an upper-case hex", () => {
    for (const key of ["hero", "onHero", "heroBtn", "avatar", "ink", "soft", "softDark", "link", "linkDark"] as const) {
      assert.match(PROFILE_ACCENT[key], HEX, key);
    }
    for (const mode of ["light", "dark"] as const) {
      for (const [key, value] of Object.entries(PROFILE_SURFACES[mode])) {
        assert.match(value, HEX, `${mode}.${key}`);
      }
    }
  });

  it("dark mode is DocCy's navy, the same as the professional's dashboard (user, 2026-10-10)", () => {
    // ink-900 page, slate-900/70 cards and slate-700/70 borders over it, slate text.
    assert.equal(PROFILE_SURFACES.dark.bg, "#062F61");
    assert.equal(PROFILE_SURFACES.dark.surface, "#0C1E3B");
    assert.equal(PROFILE_SURFACES.dark.border, "#263C59");
    assert.equal(PROFILE_SURFACES.dark.text, "#F8FAFC");
  });

  it("keeps every text pair readable (WCAG AA) in light and dark", () => {
    const light = PROFILE_SURFACES.light;
    const dark = PROFILE_SURFACES.dark;
    for (const mode of [light, dark]) {
      for (const bg of [mode.bg, mode.surface]) {
        assert.ok(contrastRatio(mode.text, bg) >= AA_TEXT);
        assert.ok(contrastRatio(mode.body, bg) >= AA_TEXT);
        assert.ok(contrastRatio(mode.muted, bg) >= AA_TEXT);
      }
    }
    const p = PROFILE_ACCENT;
    const pairs: Array<[string, string, string, number]> = [
      ["onHero on hero", p.onHero, p.hero, AA_TEXT],
      ["onHero on heroBtn", p.onHero, p.heroBtn, AA_TEXT],
      ["initials on avatar", p.onHero, p.avatar, AA_LARGE],
      ["white on ink (light CTA)", "#FFFFFF", p.ink, AA_TEXT],
      ["text on soft (light)", light.text, p.soft, AA_TEXT],
      ["text on softDark (dark)", dark.text, p.softDark, AA_TEXT],
      ["link on light surface", p.link, light.surface, AA_TEXT],
      ["linkDark on dark surface", p.linkDark, dark.surface, AA_TEXT],
      ["hero chip on dark page", p.hero, dark.bg, AA_LARGE],
    ];
    for (const [name, fg, bg, min] of pairs) {
      const ratio = contrastRatio(fg, bg);
      assert.ok(ratio >= min, `${name} is ${ratio.toFixed(2)}, needs ${min}`);
    }
  });
});

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    assert.equal(Math.round(contrastRatio("#000000", "#FFFFFF") * 10) / 10, 21);
    assert.equal(contrastRatio("#777777", "#777777"), 1);
    assert.equal(Math.round(contrastRatio("#767676", "#FFFFFF") * 100) / 100, 4.54);
  });
});

describe("profileThemeStyle", () => {
  it("exposes the palette as CSS variables with both light and dark tones", () => {
    const style = profileThemeStyle();
    assert.equal(style["--p-accent"], PROFILE_ACCENT.hero);
    assert.equal(style["--p-accent-on"], PROFILE_ACCENT.onHero);
    assert.equal(style["--p-accent-btn"], PROFILE_ACCENT.heroBtn);
    assert.equal(style["--p-accent-avatar"], PROFILE_ACCENT.avatar);
    assert.equal(style["--p-accent-ink"], PROFILE_ACCENT.ink);
    assert.equal(style["--p-accent-soft-light"], PROFILE_ACCENT.soft);
    assert.equal(style["--p-accent-soft-dark"], PROFILE_ACCENT.softDark);
    assert.equal(style["--p-accent-link-light"], PROFILE_ACCENT.link);
    assert.equal(style["--p-accent-link-dark"], PROFILE_ACCENT.linkDark);
  });

  it("carries the light and dark surfaces too, so the CSS holds no colour of its own", () => {
    const style = profileThemeStyle();
    for (const mode of ["light", "dark"] as const) {
      for (const [key, value] of Object.entries(PROFILE_SURFACES[mode])) {
        assert.equal(style[`--p-${key}-${mode}`], value, `--p-${key}-${mode}`);
      }
    }
  });
});
