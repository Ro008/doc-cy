import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  LANGUAGE_CHIP_ON_ACCENT,
  LANGUAGE_CHIP_ON_DARK,
  LANGUAGE_CHIP_ON_LIGHT,
} from "@/lib/language-chips";
import {
  CYPRUS_SPOKEN_LANGUAGE_LABELS,
  CYPRUS_SPOKEN_LANGUAGE_THEMES,
  isMasterLanguageLabel,
  validateLanguageSelection,
} from "@/lib/cyprus-languages";

function pillBackgroundToken(pillClass: string): string {
  const match = pillClass.match(/\bbg-[a-z0-9-]+\b/);
  assert.ok(match, `Expected a bg-* token in: ${pillClass}`);
  return match[0];
}

describe("language chips: one colour for every language (user, 2026-10-13)", () => {
  const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

  it("has one chip per surface, none of them a status colour", () => {
    for (const chip of [LANGUAGE_CHIP_ON_LIGHT, LANGUAGE_CHIP_ON_DARK, LANGUAGE_CHIP_ON_ACCENT]) {
      assert.match(chip, /\bbg-/);
      assert.match(chip, /\btext-/);
      assert.doesNotMatch(chip, /red|rose|amber|yellow|emerald|violet|indigo/);
    }
    assert.match(LANGUAGE_CHIP_ON_LIGHT, /clinical/);
    assert.match(LANGUAGE_CHIP_ON_DARK, /clinical/);
    // The hero is teal: the chip takes the hero's own text colour.
    assert.match(LANGUAGE_CHIP_ON_ACCENT, /accent-on/);
  });

  it("the finder cards, the profile and the pickers use them, not a colour per language", () => {
    const finder = read("components/finder/FinderCardLanguages.tsx");
    assert.match(finder, /LANGUAGE_CHIP_ON_LIGHT/);
    assert.doesNotMatch(finder, /pillClass|languageThemeForLabel/);
    const picker = read("components/languages/LanguageMultiSelect.tsx");
    assert.match(picker, /LANGUAGE_CHIP_ON_LIGHT/);
    assert.match(picker, /LANGUAGE_CHIP_ON_DARK/);
    assert.doesNotMatch(picker, /pillClass|languageThemeForLabel/);
  });
});

describe("cyprus spoken languages", () => {
  it("does not offer Other as a selectable language", () => {
    assert.equal(CYPRUS_SPOKEN_LANGUAGE_LABELS.includes("Other"), false);
    assert.equal(isMasterLanguageLabel("Other"), false);
  });

  it("includes Chinese, Hebrew, and Ukrainian", () => {
    for (const label of ["Chinese", "Hebrew", "Ukrainian"] as const) {
      assert.equal(isMasterLanguageLabel(label), true);
      assert.ok(CYPRUS_SPOKEN_LANGUAGE_LABELS.includes(label));
    }
  });

  it("gives each selectable language a unique chip background", () => {
    const backgrounds = CYPRUS_SPOKEN_LANGUAGE_THEMES.map((t) =>
      pillBackgroundToken(t.pillClass),
    );
    assert.equal(
      new Set(backgrounds).size,
      backgrounds.length,
      `Duplicate chip backgrounds: ${backgrounds.join(", ")}`,
    );
  });

  it("accepts the new languages in form validation", () => {
    const result = validateLanguageSelection([
      "Chinese",
      "Hebrew",
      "Ukrainian",
    ]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.value, ["Chinese", "Hebrew", "Ukrainian"]);
    }
  });

  it("rejects Other in form validation", () => {
    const result = validateLanguageSelection(["English", "Other"]);
    assert.equal(result.ok, false);
  });
});
