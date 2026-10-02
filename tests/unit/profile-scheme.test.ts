import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROFILE_SCHEME_COOKIE,
  parseProfileScheme,
  profileSchemeCookie,
} from "../../lib/profile-scheme";

describe("parseProfileScheme", () => {
  it("opens in light unless the visitor chose dark", () => {
    assert.equal(parseProfileScheme(undefined), "light");
    assert.equal(parseProfileScheme(""), "light");
    assert.equal(parseProfileScheme("light"), "light");
    assert.equal(parseProfileScheme("dark"), "dark");
    assert.equal(parseProfileScheme(" Dark "), "dark");
    assert.equal(parseProfileScheme("auto"), "light");
    assert.equal(parseProfileScheme("dark; injected"), "light");
  });
});

describe("profileSchemeCookie", () => {
  it("is a small, first-party preference cookie kept for a year on every profile", () => {
    assert.equal(PROFILE_SCHEME_COOKIE, "doccy_profile_scheme");
    assert.equal(
      profileSchemeCookie("dark"),
      "doccy_profile_scheme=dark; Path=/; Max-Age=31536000; SameSite=Lax",
    );
    assert.equal(
      profileSchemeCookie("light"),
      "doccy_profile_scheme=light; Path=/; Max-Age=31536000; SameSite=Lax",
    );
  });
});
