import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PROFILE_ACCENT,
  PROFILE_ACCENT_IDS,
  PROFILE_ACCENTS,
  PROFILE_SURFACES,
  contrastRatio,
  profileThemeStyle,
  resolveProfileAccent,
} from "../../lib/profile-theme";

const HEX = /^#[0-9A-F]{6}$/;
const AA_TEXT = 4.5;
const AA_LARGE = 3;

describe("resolveProfileAccent", () => {
  it("accepts every palette id, ignoring case and spaces", () => {
    for (const id of PROFILE_ACCENT_IDS) {
      assert.equal(resolveProfileAccent(id), id);
      assert.equal(resolveProfileAccent(`  ${id.toUpperCase()} `), id);
    }
  });

  it("falls back to the DocCy teal for anything else", () => {
    assert.equal(DEFAULT_PROFILE_ACCENT, "teal");
    for (const raw of [null, undefined, "", "pink", "coral", "blue", "green", "#ff0000", 42, {}, ["amber"]]) {
      assert.equal(resolveProfileAccent(raw), "teal");
    }
  });
});

describe("profile palettes", () => {
  it("offers exactly three accents, DocCy teal first", () => {
    assert.deepEqual([...PROFILE_ACCENT_IDS], ["teal", "amber", "violet"]);
  });

  it("defines every colour of every palette as an upper-case hex", () => {
    for (const id of PROFILE_ACCENT_IDS) {
      const palette = PROFILE_ACCENTS[id];
      assert.ok(palette.label.trim().length > 0, `${id} label`);
      for (const key of ["hero", "onHero", "heroBtn", "avatar", "ink", "soft", "softDark", "link", "linkDark"] as const) {
        assert.match(palette[key], HEX, `${id}.${key}`);
      }
    }
    for (const mode of ["light", "dark"] as const) {
      for (const [key, value] of Object.entries(PROFILE_SURFACES[mode])) {
        assert.match(value, HEX, `${mode}.${key}`);
      }
    }
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
    for (const id of PROFILE_ACCENT_IDS) {
      const p = PROFILE_ACCENTS[id];
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
        assert.ok(ratio >= min, `${id}: ${name} is ${ratio.toFixed(2)}, needs ${min}`);
      }
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
  it("exposes the chosen palette as CSS variables with both light and dark tones", () => {
    const style = profileThemeStyle("amber");
    const coral = PROFILE_ACCENTS.amber;
    assert.equal(style["--p-accent"], coral.hero);
    assert.equal(style["--p-accent-on"], coral.onHero);
    assert.equal(style["--p-accent-btn"], coral.heroBtn);
    assert.equal(style["--p-accent-avatar"], coral.avatar);
    assert.equal(style["--p-accent-ink"], coral.ink);
    assert.equal(style["--p-accent-soft-light"], coral.soft);
    assert.equal(style["--p-accent-soft-dark"], coral.softDark);
    assert.equal(style["--p-accent-link-light"], coral.link);
    assert.equal(style["--p-accent-link-dark"], coral.linkDark);
  });

  it("carries the light and dark surfaces too, so the CSS holds no colour of its own", () => {
    const style = profileThemeStyle("teal");
    for (const mode of ["light", "dark"] as const) {
      for (const [key, value] of Object.entries(PROFILE_SURFACES[mode])) {
        assert.equal(style[`--p-${key}-${mode}`], value, `--p-${key}-${mode}`);
      }
    }
  });

  it("uses teal for an unknown id", () => {
    assert.deepEqual(profileThemeStyle("nope" as never), profileThemeStyle("teal"));
  });
});
