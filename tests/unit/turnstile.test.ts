import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  TURNSTILE_SITEVERIFY_URL,
  turnstileEnforced,
  turnstileMissingInProduction,
  verifyTurnstileToken,
  waitForTurnstileToken,
} from "../../lib/turnstile";
import { bookingRefusal } from "../../lib/booking-refusal";

/**
 * Cloudflare Turnstile on the public booking form (user, 2026-10-11): before a request is saved
 * and the confirmation email goes out, Cloudflare confirms a person filled the form, so DocCy
 * can't be used to mass-send emails. On only where the secret key is set (Vercel Production).
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

type Call = { url: string; body: URLSearchParams };

function fakeFetch(reply: unknown, calls: Call[], ok = true): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: new URLSearchParams(String(init?.body ?? "")) });
    return { ok, json: async () => reply } as Response;
  }) as typeof fetch;
}

describe("turnstileEnforced", () => {
  it("is on only when both keys are set: half a setup must never block every booking", () => {
    const both = { TURNSTILE_SECRET_KEY: "0x4AAA", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4BBB" };
    assert.equal(turnstileEnforced(both), true);
    // Secret without the site key: the form would send no token, so don't ask for one.
    assert.equal(turnstileEnforced({ TURNSTILE_SECRET_KEY: "0x4AAA" }), false);
    assert.equal(turnstileEnforced({ ...both, TURNSTILE_SECRET_KEY: "  " }), false);
    assert.equal(turnstileEnforced({}), false);
  });
});

describe("turnstileMissingInProduction (a reminder in Vercel's logs until the keys are set)", () => {
  it("flags Vercel Production without both keys", () => {
    assert.equal(turnstileMissingInProduction({ VERCEL_ENV: "production" }), true);
    assert.equal(turnstileMissingInProduction({ VERCEL_ENV: "production", TURNSTILE_SECRET_KEY: "s" }), true);
    assert.equal(
      turnstileMissingInProduction({
        VERCEL_ENV: "production",
        TURNSTILE_SECRET_KEY: "s",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k",
      }),
      false,
    );
  });

  it("stays quiet in previews, CI and locally, where the check is off on purpose", () => {
    assert.equal(turnstileMissingInProduction({ VERCEL_ENV: "preview" }), false);
    assert.equal(turnstileMissingInProduction({}), false);
  });

  it("the booking route logs it", () => {
    const route = read("app/api/appointments/route.ts");
    assert.match(route, /turnstileMissingInProduction\(\)/);
  });
});

describe("verifyTurnstileToken", () => {
  it("asks Cloudflare with the secret, the token and the visitor's IP", async () => {
    const calls: Call[] = [];
    const ok = await verifyTurnstileToken("tok-1", "203.0.113.9", {
      secret: "sec",
      fetchImpl: fakeFetch({ success: true }, calls),
    });
    assert.equal(ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, TURNSTILE_SITEVERIFY_URL);
    assert.equal(calls[0].body.get("secret"), "sec");
    assert.equal(calls[0].body.get("response"), "tok-1");
    assert.equal(calls[0].body.get("remoteip"), "203.0.113.9");
  });

  it("refuses when Cloudflare says no", async () => {
    const calls: Call[] = [];
    const ok = await verifyTurnstileToken("tok-1", "", {
      secret: "sec",
      fetchImpl: fakeFetch({ success: false, "error-codes": ["invalid-input-response"] }, calls),
    });
    assert.equal(ok, false);
    assert.equal(calls[0].body.has("remoteip"), false);
  });

  it("refuses a missing token without asking", async () => {
    const calls: Call[] = [];
    assert.equal(await verifyTurnstileToken("", "1.2.3.4", { secret: "sec", fetchImpl: fakeFetch({}, calls) }), false);
    assert.equal(await verifyTurnstileToken(undefined, "1.2.3.4", { secret: "sec", fetchImpl: fakeFetch({}, calls) }), false);
    assert.equal(calls.length, 0);
  });

  it("refuses when Cloudflare can't be reached (fails closed)", async () => {
    const failing = (async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    assert.equal(await verifyTurnstileToken("tok", "1.2.3.4", { secret: "sec", fetchImpl: failing }), false);
    const calls: Call[] = [];
    assert.equal(await verifyTurnstileToken("tok", "1.2.3.4", { secret: "sec", fetchImpl: fakeFetch({}, calls, false) }), false);
  });
});

describe("waitForTurnstileToken (send pressed before Cloudflare answered, ~2s)", () => {
  it("returns the token as soon as it arrives", async () => {
    let token = "";
    setTimeout(() => (token = "tok"), 30);
    assert.equal(await waitForTurnstileToken(() => token, 2_000, 10), "tok");
  });

  it("gives up with an empty token after the timeout", async () => {
    const started = Date.now();
    assert.equal(await waitForTurnstileToken(() => "", 60, 10), "");
    assert.ok(Date.now() - started >= 50);
  });

  it("doesn't wait when the token is already there", async () => {
    assert.equal(await waitForTurnstileToken(() => "ready", 5_000, 1_000), "ready");
  });
});

describe("booking form and API", () => {
  it("a failed check reads as plain words and keeps the patient on the form", () => {
    assert.deepEqual(bookingRefusal(400, "bot_check_failed"), { messageKey: "botCheckFailed", backToCalendar: false });
  });

  it("POST /api/appointments checks the token before saving the request or emailing", () => {
    const route = read("app/api/appointments/route.ts");
    const check = route.indexOf("verifyTurnstileToken(");
    assert.ok(check > 0, "verifies the token");
    assert.ok(check < route.indexOf("createAppointmentDraft("), "before the draft is saved");
    assert.match(route, /code: "bot_check_failed"/);
    assert.match(route, /turnstileEnforced\(/);
  });

  it("the form shows Cloudflare's box only when a person has to tick it", () => {
    const widget = read("components/booking/TurnstileWidget.tsx");
    assert.match(widget, /appearance: "interaction-only"/);
    assert.match(widget, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
    const booking = read("components/doctor/BookingSection.tsx");
    assert.match(booking, /<TurnstileWidget\b/);
    assert.match(booking, /turnstileToken/);
    // Send pressed before the token arrived: wait for it instead of an error.
    assert.match(booking, /waitForTurnstileToken\(/);
  });
});
