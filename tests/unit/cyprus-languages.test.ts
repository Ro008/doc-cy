import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
