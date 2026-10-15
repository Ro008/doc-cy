import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PROFILE_CUSTOMIZATION,
  PROFILE_CUSTOMIZATION_BACKEND,
  profileCustomizationFromRow,
  saveProfileCustomization,
} from "../../lib/profile-customization";

describe("profileCustomizationFromRow", () => {
  it("has no headline until she writes one", () => {
    assert.deepEqual(DEFAULT_PROFILE_CUSTOMIZATION, { headline: null });
    assert.deepEqual(profileCustomizationFromRow({ id: "p1", name: "Dr X" }), DEFAULT_PROFILE_CUSTOMIZATION);
    assert.deepEqual(profileCustomizationFromRow(null), DEFAULT_PROFILE_CUSTOMIZATION);
  });

  it("reads the column, sanitised", () => {
    assert.deepEqual(profileCustomizationFromRow({ profile_headline: "  Kind  care  " }), {
      headline: "Kind care",
    });
    assert.deepEqual(profileCustomizationFromRow({ profile_headline: "   " }), { headline: null });
  });

  it("knows no page colour: every profile is DocCy teal (user, 2026-10-13)", () => {
    assert.deepEqual(profileCustomizationFromRow({ profile_accent: "amber", profile_headline: "Hi" }), {
      headline: "Hi",
    });
  });
});

describe("PROFILE_CUSTOMIZATION_BACKEND", () => {
  it("names the route and the column", () => {
    assert.deepEqual(PROFILE_CUSTOMIZATION_BACKEND, {
      method: "PATCH",
      endpoint: "/api/professional-profile-customization",
      columns: ["professionals.profile_headline"],
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
  it("sends the normalised headline, and nothing else, to the contract endpoint", async () => {
    const calls: FetchCall[] = [];
    const result = await saveProfileCustomization(
      { headline: "  Calm,  careful dentistry " },
      fakeFetch(200, calls),
    );
    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/professional-profile-customization");
    assert.equal(calls[0].init.method, "PATCH");
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { headline: "Calm, careful dentistry" });
  });

  it("sends null when the headline is cleared", async () => {
    const calls: FetchCall[] = [];
    await saveProfileCustomization({ headline: "   " }, fakeFetch(200, calls));
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { headline: null });
  });

  it("passes on the server's words when she changed it too often (5 in 30 days)", async () => {
    const tooOften = (async () =>
      new Response(JSON.stringify({ message: "You have reached the limit for this change. If it is urgent, contact us." }), {
        status: 429,
      })) as unknown as typeof fetch;
    assert.deepEqual(await saveProfileCustomization({ headline: "One more" }, tooOften), {
      ok: false,
      reason: "too_often",
      message: "You have reached the limit for this change. If it is urgent, contact us.",
    });
    const noWords = (async () => new Response("", { status: 429 })) as unknown as typeof fetch;
    const result = await saveProfileCustomization({ headline: "One more" }, noWords);
    assert.equal(result.ok === false && result.reason === "too_often" && result.message.length > 0, true);
  });

  it("no longer treats a missing route as expected: the backend exists (2026-10-13)", async () => {
    assert.deepEqual(await saveProfileCustomization({ headline: null }, fakeFetch(404, [])), {
      ok: false,
      reason: "failed",
      status: 404,
    });
  });

  it("does not call the server with an invalid headline", async () => {
    const calls: FetchCall[] = [];
    const result = await saveProfileCustomization({ headline: "a".repeat(91) }, fakeFetch(200, calls));
    assert.deepEqual(result, { ok: false, reason: "invalid" });
    assert.equal(calls.length, 0);
  });

  it("reports other errors as failed", async () => {
    assert.deepEqual(await saveProfileCustomization({ headline: null }, fakeFetch(500, [])), {
      ok: false,
      reason: "failed",
      status: 500,
    });
    const throwing = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    assert.deepEqual(await saveProfileCustomization({ headline: null }, throwing), {
      ok: false,
      reason: "failed",
    });
  });
});
