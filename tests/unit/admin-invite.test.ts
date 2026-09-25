import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_INVITE_REDIRECT_PATH,
  adminInviteRedirectUrl,
  parseAdminInviteArgs,
} from "../../scripts/lib/admin-invite.mjs";

describe("parseAdminInviteArgs", () => {
  it("reads email, name, role and flags", () => {
    const parsed = parseAdminInviteArgs([
      "--email",
      " Admin@Example.com ",
      "--name",
      " Livio Lanzo ",
      "--role",
      "founder",
      "--env-file",
      ".env.testing.local",
      "--dry-run",
    ]);
    assert.deepEqual(parsed, {
      ok: true,
      value: {
        email: "admin@example.com",
        name: "Livio Lanzo",
        role: "founder",
        envFile: ".env.testing.local",
        dryRun: true,
      },
    });
  });

  it("defaults to founder, .env.testing.local and a real run", () => {
    const parsed = parseAdminInviteArgs(["--email", "a@b.co", "--name", "A"]);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.role, "founder");
    assert.equal(parsed.value.envFile, ".env.testing.local");
    assert.equal(parsed.value.dryRun, false);
  });

  it("accepts partner", () => {
    const parsed = parseAdminInviteArgs(["--email", "a@b.co", "--name", "A", "--role", "partner"]);
    assert.equal(parsed.ok && parsed.value.role, "partner");
  });

  it("rejects a missing or malformed email", () => {
    assert.equal(parseAdminInviteArgs(["--name", "A"]).ok, false);
    assert.equal(parseAdminInviteArgs(["--email", "nope", "--name", "A"]).ok, false);
  });

  it("rejects a missing name", () => {
    assert.equal(parseAdminInviteArgs(["--email", "a@b.co"]).ok, false);
    assert.equal(parseAdminInviteArgs(["--email", "a@b.co", "--name", "  "]).ok, false);
  });

  it("rejects an unknown role or flag", () => {
    assert.equal(
      parseAdminInviteArgs(["--email", "a@b.co", "--name", "A", "--role", "owner"]).ok,
      false,
    );
    assert.equal(parseAdminInviteArgs(["--email", "a@b.co", "--name", "A", "--force"]).ok, false);
  });

  it("rejects a flag missing its value", () => {
    assert.equal(parseAdminInviteArgs(["--email", "a@b.co", "--name"]).ok, false);
  });
});

describe("adminInviteRedirectUrl", () => {
  it("points the invite at the internal sign-in page", () => {
    assert.equal(ADMIN_INVITE_REDIRECT_PATH, "/internal/sign-in");
    assert.equal(
      adminInviteRedirectUrl("https://www.mydoccy.com/"),
      "https://www.mydoccy.com/internal/sign-in",
    );
    assert.equal(
      adminInviteRedirectUrl("http://localhost:3100"),
      "http://localhost:3100/internal/sign-in",
    );
  });

  it("refuses a missing or non-http site URL", () => {
    assert.throws(() => adminInviteRedirectUrl(""));
    assert.throws(() => adminInviteRedirectUrl("javascript:alert(1)"));
  });
});
