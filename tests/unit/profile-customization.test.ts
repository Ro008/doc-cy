import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PROFILE_CUSTOMIZATION,
  PROFILE_CUSTOMIZATION_BACKEND,
  profileCustomizationFromRow,
  saveProfileCustomization,
} from "../../lib/profile-customization";

describe("profileCustomizationFromRow", () => {
  it("uses DocCy teal and no headline until the backend stores them", () => {
    assert.deepEqual(DEFAULT_PROFILE_CUSTOMIZATION, { accent: "teal", headline: null });
    assert.deepEqual(profileCustomizationFromRow({ id: "p1", name: "Dr X" }), DEFAULT_PROFILE_CUSTOMIZATION);
    assert.deepEqual(profileCustomizationFromRow(null), DEFAULT_PROFILE_CUSTOMIZATION);
  });

  it("reads the columns the backend will add, sanitised", () => {
    assert.deepEqual(
      profileCustomizationFromRow({ profile_accent: "Amber", profile_headline: "  Kind  care  " }),
      { accent: "amber", headline: "Kind care" },
    );
    assert.deepEqual(
      profileCustomizationFromRow({ profile_accent: "coral", profile_headline: "   " }),
      { accent: "teal", headline: null },
    );
  });
});

describe("PROFILE_CUSTOMIZATION_BACKEND", () => {
  it("names the contract Livio builds", () => {
    assert.deepEqual(PROFILE_CUSTOMIZATION_BACKEND, {
      method: "PATCH",
      endpoint: "/api/professional-profile-customization",
      columns: ["professionals.profile_accent", "professionals.profile_headline"],
    });
  });
});

type FetchCall = { url: string; init: RequestInit };

function fakeFetch(status: number, calls: FetchCall[]): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : "{}", { status });
  }) as unknown as typeof fetch;
}

describe("saveProfileCustomization", () => {
  it("sends the accent and the normalised headline to the contract endpoint", async () => {
    const calls: FetchCall[] = [];
    const result = await saveProfileCustomization(
      { accent: "violet", headline: "  Calm,  careful dentistry " },
      fakeFetch(200, calls),
    );
    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/professional-profile-customization");
    assert.equal(calls[0].init.method, "PATCH");
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
      accent: "violet",
      headline: "Calm, careful dentistry",
    });
  });

  it("sends null when the headline is cleared", async () => {
    const calls: FetchCall[] = [];
    await saveProfileCustomization({ accent: "teal", headline: "   " }, fakeFetch(200, calls));
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { accent: "teal", headline: null });
  });

  it("reports the expected failure while the backend does not exist yet", async () => {
    for (const status of [404, 405]) {
      assert.deepEqual(
        await saveProfileCustomization({ accent: "teal", headline: null }, fakeFetch(status, [])),
        { ok: false, reason: "backend_pending", status },
      );
    }
  });

  it("does not call the server with an invalid headline", async () => {
    const calls: FetchCall[] = [];
    const result = await saveProfileCustomization(
      { accent: "teal", headline: "a".repeat(91) },
      fakeFetch(200, calls),
    );
    assert.deepEqual(result, { ok: false, reason: "invalid" });
    assert.equal(calls.length, 0);
  });

  it("reports other errors as failed", async () => {
    assert.deepEqual(
      await saveProfileCustomization({ accent: "teal", headline: null }, fakeFetch(500, [])),
      { ok: false, reason: "failed", status: 500 },
    );
    const throwing = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    assert.deepEqual(await saveProfileCustomization({ accent: "teal", headline: null }, throwing), {
      ok: false,
      reason: "failed",
    });
  });
});
