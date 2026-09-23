import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REGISTER_AVATAR_MIN_PX,
  avatarDimensionsProblem,
  avatarFileProblem,
} from "../../lib/register-avatar";
import {
  REGISTER_PRIMARY_LANGUAGES,
  registerLanguageOptions,
} from "../../lib/register-languages";
import { CYPRUS_SPOKEN_LANGUAGE_LABELS } from "../../lib/cyprus-languages";

const MB = 1024 * 1024;

describe("register avatar file checks", () => {
  it("accepts ordinary photos", () => {
    assert.equal(avatarFileProblem({ name: "me.jpg", type: "image/jpeg", size: 2 * MB }), null);
    assert.equal(avatarFileProblem({ name: "me.png", type: "image/png", size: 1 * MB }), null);
    assert.equal(avatarFileProblem({ name: "me.webp", type: "image/webp", size: 1 * MB }), null);
  });

  it("explains iPhone HEIC photos instead of a generic error", () => {
    for (const file of [
      { name: "IMG_0001.HEIC", type: "image/heic", size: 2 * MB },
      { name: "IMG_0002.heif", type: "", size: 2 * MB },
    ]) {
      assert.match(avatarFileProblem(file) ?? "", /HEIC/);
      assert.match(avatarFileProblem(file) ?? "", /JPG/);
    }
  });

  it("rejects non-images and files over 10 MB", () => {
    assert.match(avatarFileProblem({ name: "cv.pdf", type: "application/pdf", size: MB }) ?? "", /JPG, PNG or WebP/);
    assert.match(avatarFileProblem({ name: "big.jpg", type: "image/jpeg", size: 11 * MB }) ?? "", /10 MB/);
  });

  it("needs at least 400×400 px so the profile photo stays sharp", () => {
    assert.equal(REGISTER_AVATAR_MIN_PX, 400);
    assert.equal(avatarDimensionsProblem(400, 400), null);
    assert.equal(avatarDimensionsProblem(3024, 4032), null);
    assert.match(avatarDimensionsProblem(128, 128) ?? "", /128×128/);
    // The crop is square, so the short side is what matters.
    assert.match(avatarDimensionsProblem(1200, 300) ?? "", /at least 400×400/);
  });
});

describe("register language pills", () => {
  it("leads with the languages most used in Cyprus, all real options", () => {
    assert.deepEqual(
      [...REGISTER_PRIMARY_LANGUAGES],
      ["Greek", "English", "Russian", "Turkish", "Ukrainian", "Hebrew"],
    );
    for (const label of REGISTER_PRIMARY_LANGUAGES) {
      assert.ok(CYPRUS_SPOKEN_LANGUAGE_LABELS.includes(label), label);
    }
  });

  it("collapsed: primary languages plus any extra already picked", () => {
    const { visible, hiddenCount } = registerLanguageOptions(["German"], false);
    assert.deepEqual(visible, [...REGISTER_PRIMARY_LANGUAGES, "German"]);
    assert.equal(hiddenCount, CYPRUS_SPOKEN_LANGUAGE_LABELS.length - REGISTER_PRIMARY_LANGUAGES.length - 1);
  });

  it("expanded: every language, primary first", () => {
    const { visible, hiddenCount } = registerLanguageOptions([], true);
    assert.equal(visible.length, CYPRUS_SPOKEN_LANGUAGE_LABELS.length);
    assert.deepEqual(visible.slice(0, REGISTER_PRIMARY_LANGUAGES.length), [...REGISTER_PRIMARY_LANGUAGES]);
    assert.equal(hiddenCount, 0);
  });
});
