import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { SUPPORT_MESSAGE_LIMITS, parseSupportMessageBody } from "@/lib/support-message";

const ok = { subject: "General Question", message: "Hello", email: "a@b.co", url: "https://mydoccy.com/x" };

describe("parseSupportMessageBody", () => {
  it("reads a visitor's message", () => {
    const result = parseSupportMessageBody(ok, false);
    assert.deepEqual(result, {
      ok: true,
      value: {
        topic: "General Question",
        message: "Hello",
        email: "a@b.co",
        url: "https://mydoccy.com/x",
        context: null,
      },
    });
  });

  it("applies the same rules as the form: a visitor needs an email", () => {
    const result = parseSupportMessageBody({ ...ok, email: "" }, false);
    assert.equal(result.ok, false);
  });

  it("lets a signed-in sender leave the email out (stored as null)", () => {
    const result = parseSupportMessageBody({ ...ok, email: "" }, true);
    assert.equal(result.ok && result.value.email, null);
  });

  it("refuses the untouched incorrect-info template", () => {
    const message = "I'm reporting incorrect information about a Health Finder listing.\n\nWhat seems incorrect:\n";
    assert.equal(parseSupportMessageBody({ ...ok, message }, false).ok, false);
  });

  it("refuses a body that is not an object, or has no topic or message", () => {
    assert.equal(parseSupportMessageBody(null, false).ok, false);
    assert.equal(parseSupportMessageBody("hi", false).ok, false);
    assert.equal(parseSupportMessageBody({ ...ok, subject: "" }, false).ok, false);
    assert.equal(parseSupportMessageBody({ ...ok, message: 42 }, false).ok, false);
  });

  it("refuses a message or email over the limit, and trims the url", () => {
    const tooLong = "x".repeat(SUPPORT_MESSAGE_LIMITS.message + 1);
    assert.equal(parseSupportMessageBody({ ...ok, message: tooLong }, false).ok, false);
    const longEmail = `${"x".repeat(SUPPORT_MESSAGE_LIMITS.email)}@b.co`;
    assert.equal(parseSupportMessageBody({ ...ok, email: longEmail }, false).ok, false);
    const result = parseSupportMessageBody({ ...ok, url: "u".repeat(SUPPORT_MESSAGE_LIMITS.url + 50) }, false);
    assert.equal(result.ok && result.value.url?.length, SUPPORT_MESSAGE_LIMITS.url);
  });

  it("keeps only short text values of the listing context", () => {
    const result = parseSupportMessageBody(
      {
        ...ok,
        context: {
          kind: "incorrect_listing_info",
          professional: "Petros Marcou",
          specialty: "Dentist",
          district: "Larnaca",
          nested: { a: 1 },
          n: 5,
        },
      },
      false,
    );
    assert.deepEqual(result.ok && result.value.context, {
      kind: "incorrect_listing_info",
      professional: "Petros Marcou",
      specialty: "Dentist",
      district: "Larnaca",
    });
  });

  it("a context with nothing usable becomes null", () => {
    const result = parseSupportMessageBody({ ...ok, context: { a: { b: 1 } } }, false);
    assert.equal(result.ok && result.value.context, null);
  });
});

describe("POST /api/support-message", () => {
  const route = readFileSync(
    path.resolve(__dirname, "../../app/api/support-message/route.ts"),
    "utf8",
  );

  it("takes the sender from the session, never from the body", () => {
    assert.match(route, /auth\.getUser\(\)/);
    assert.doesNotMatch(route, /body\.user_?[iI]d/);
  });

  it("is rate limited and writes to user_events with the service role", () => {
    assert.match(route, /enforcePublicApiRateLimit\(req, "supportMessage"\)/);
    assert.match(route, /createServiceRoleClient\(\)/);
    assert.match(route, /USER_EVENTS_TABLE/);
    assert.match(route, /supportMessageEvent\(/);
  });
});
