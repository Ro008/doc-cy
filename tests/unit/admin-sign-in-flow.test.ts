import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_HOME_PATH,
  ADMIN_SIGN_IN_PATH,
  adminSignInPath,
  adminSignInStep,
  parseAuthHash,
  safeInternalNextPath,
} from "../../lib/admin-sign-in-flow";

describe("safeInternalNextPath", () => {
  it("keeps internal destinations", () => {
    assert.equal(safeInternalNextPath("/internal/directory"), "/internal/directory");
    assert.equal(
      safeInternalNextPath("/internal/directory?manualVotesRange=30d#pending"),
      "/internal/directory?manualVotesRange=30d#pending",
    );
  });

  it("falls back to the dashboard for anything else", () => {
    for (const raw of [
      null,
      undefined,
      "",
      "/agenda",
      "https://evil.example/internal/directory",
      "//evil.example/internal/directory",
      "/\\evil.example",
      "/internal/../agenda",
      "/internalx",
      "/internal/sign-in",
      "/internal/sign-in?next=/internal/directory",
      "/internal",
      "javascript:alert(1)",
    ]) {
      assert.equal(safeInternalNextPath(raw), ADMIN_HOME_PATH, String(raw));
    }
  });
});

describe("adminSignInPath", () => {
  it("links to the sign-in page with a safe next path", () => {
    assert.equal(ADMIN_SIGN_IN_PATH, "/internal/sign-in");
    assert.equal(adminSignInPath(), "/internal/sign-in");
    assert.equal(
      adminSignInPath("/internal/directory?x=1"),
      "/internal/sign-in?next=%2Finternal%2Fdirectory%3Fx%3D1",
    );
    assert.equal(adminSignInPath("/agenda"), "/internal/sign-in");
  });
});

describe("parseAuthHash", () => {
  it("reads an invite or recovery session", () => {
    assert.deepEqual(
      parseAuthHash("#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=invite"),
      { kind: "session", accessToken: "a.b.c", refreshToken: "r1", type: "invite" },
    );
    assert.deepEqual(parseAuthHash("access_token=x&refresh_token=y&type=recovery"), {
      kind: "session",
      accessToken: "x",
      refreshToken: "y",
      type: "recovery",
    });
  });

  it("reads an error (for example an expired link)", () => {
    assert.deepEqual(
      parseAuthHash("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"),
      { kind: "error", code: "otp_expired", description: "Email link is invalid or has expired" },
    );
  });

  it("ignores anything else", () => {
    assert.equal(parseAuthHash(""), null);
    assert.equal(parseAuthHash("#pending"), null);
    assert.equal(parseAuthHash("#access_token=only"), null);
  });
});

describe("adminSignInStep", () => {
  it("asks for the password when signed out", () => {
    assert.deepEqual(adminSignInStep({ access: "signed_out" }), { step: "password" });
  });

  it("asks an invited or recovering admin to choose a password first", () => {
    assert.deepEqual(adminSignInStep({ access: "mfa_required", mustSetPassword: true }), {
      step: "set_password",
    });
  });

  it("asks a recovering admin who has an authenticator app for the code first", () => {
    assert.deepEqual(
      adminSignInStep({ access: "mfa_required", mustSetPassword: true, hasVerifiedFactor: true }),
      { step: "verify_totp" },
    );
    assert.deepEqual(
      adminSignInStep({ access: "ok", mustSetPassword: true, hasVerifiedFactor: true }),
      { step: "set_password" },
    );
  });

  it("never asks a signed-out visitor to set a password", () => {
    assert.deepEqual(adminSignInStep({ access: "signed_out", mustSetPassword: true }), {
      step: "password",
    });
  });

  it("enrols an authenticator app when the admin has none", () => {
    assert.deepEqual(adminSignInStep({ access: "mfa_required", hasVerifiedFactor: false }), {
      step: "enrol_totp",
    });
  });

  it("asks for the code when the admin already has an authenticator app", () => {
    assert.deepEqual(adminSignInStep({ access: "mfa_required", hasVerifiedFactor: true }), {
      step: "verify_totp",
    });
  });

  it("starts over (password and code) after 7 days", () => {
    assert.deepEqual(adminSignInStep({ access: "mfa_expired", hasVerifiedFactor: true }), {
      step: "reauthenticate",
    });
  });

  it("refuses accounts that aren't active admins, before any 2FA setup", () => {
    for (const access of ["not_admin", "inactive", "professional_account"] as const) {
      assert.deepEqual(adminSignInStep({ access, mustSetPassword: true }), {
        step: "denied",
        reason: access,
      });
    }
  });

  it("is done once access is granted", () => {
    assert.deepEqual(adminSignInStep({ access: "ok" }), { step: "done" });
  });

  it("reports a failed lookup as an error", () => {
    assert.deepEqual(adminSignInStep({ access: "unavailable" }), { step: "error" });
  });
});
