import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_MFA_MAX_AGE_SECONDS,
  adminCanWrite,
  adminDenialStatus,
  decideAdminWriteAccess,
  decideAdminAccess,
  decodeJwtClaims,
  lastTotpVerifiedAt,
  resolveAdminAccess,
  type AdminUserRow,
} from "../../lib/admin-auth-core";

const NOW = 1_790_000_000;
const USER_ID = "11111111-1111-4111-8111-111111111111";

const admin: AdminUserRow = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  auth_user_id: USER_ID,
  name: "Livio",
  email: "admin@example.com",
  role: "founder",
  is_active: true,
};

function amr(totpAgeSeconds: number) {
  return [
    { method: "totp", timestamp: NOW - totpAgeSeconds },
    { method: "password", timestamp: NOW - totpAgeSeconds - 30 },
  ];
}

function identity(overrides: Partial<{ aal: string | null; amr: unknown }> = {}) {
  return { userId: USER_ID, aal: "aal2", amr: amr(60), ...overrides };
}

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function fakeJwt(claims: object): string {
  return `${base64Url({ alg: "HS256", typ: "JWT" })}.${base64Url(claims)}.sig`;
}

describe("lastTotpVerifiedAt", () => {
  it("returns the newest totp timestamp", () => {
    assert.equal(
      lastTotpVerifiedAt([
        { method: "totp", timestamp: 100 },
        { method: "password", timestamp: 500 },
        { method: "totp", timestamp: 300 },
      ]),
      300,
    );
  });

  it("returns null without a timestamped totp entry", () => {
    assert.equal(lastTotpVerifiedAt([{ method: "password", timestamp: 100 }]), null);
    assert.equal(lastTotpVerifiedAt(["password", "totp"]), null);
    assert.equal(lastTotpVerifiedAt(undefined), null);
    assert.equal(lastTotpVerifiedAt([{ method: "totp", timestamp: "100" }]), null);
  });
});

describe("decideAdminAccess", () => {
  it("allows an active admin with a recent second factor", () => {
    const result = decideAdminAccess({
      identity: identity(),
      admin,
      isProfessional: false,
      nowSeconds: NOW,
    });
    assert.deepEqual(result, { ok: true, admin, mfaVerifiedAt: NOW - 60 });
  });

  it("allows a partner the same way (roles are checked per action)", () => {
    const partner = { ...admin, role: "partner" as const };
    const result = decideAdminAccess({
      identity: identity(),
      admin: partner,
      isProfessional: false,
      nowSeconds: NOW,
    });
    assert.equal(result.ok, true);
  });

  it("refuses without a signed-in user", () => {
    const result = decideAdminAccess({
      identity: null,
      admin: null,
      isProfessional: false,
      nowSeconds: NOW,
    });
    assert.deepEqual(result, { ok: false, reason: "signed_out" });
  });

  it("refuses a professional's account even if it has an admin row", () => {
    const result = decideAdminAccess({
      identity: identity(),
      admin,
      isProfessional: true,
      nowSeconds: NOW,
    });
    assert.deepEqual(result, { ok: false, reason: "professional_account" });
  });

  it("refuses a signed-in user with no admin row", () => {
    const result = decideAdminAccess({
      identity: identity(),
      admin: null,
      isProfessional: false,
      nowSeconds: NOW,
    });
    assert.deepEqual(result, { ok: false, reason: "not_admin" });
  });

  it("refuses an admin row that belongs to another user", () => {
    const result = decideAdminAccess({
      identity: identity(),
      admin: { ...admin, auth_user_id: "22222222-2222-4222-8222-222222222222" },
      isProfessional: false,
      nowSeconds: NOW,
    });
    assert.deepEqual(result, { ok: false, reason: "not_admin" });
  });

  it("refuses a deactivated admin", () => {
    const result = decideAdminAccess({
      identity: identity(),
      admin: { ...admin, is_active: false },
      isProfessional: false,
      nowSeconds: NOW,
    });
    assert.deepEqual(result, { ok: false, reason: "inactive" });
  });

  it("requires aal2", () => {
    const result = decideAdminAccess({
      identity: identity({ aal: "aal1", amr: [{ method: "password", timestamp: NOW }] }),
      admin,
      isProfessional: false,
      nowSeconds: NOW,
    });
    assert.deepEqual(result, { ok: false, reason: "mfa_required" });
  });

  it("requires a timestamped totp entry even at aal2", () => {
    const result = decideAdminAccess({
      identity: identity({ amr: ["password", "totp"] }),
      admin,
      isProfessional: false,
      nowSeconds: NOW,
    });
    assert.deepEqual(result, { ok: false, reason: "mfa_required" });
  });

  it("refuses a totp timestamp from the future", () => {
    const result = decideAdminAccess({
      identity: identity({ amr: amr(-3600) }),
      admin,
      isProfessional: false,
      nowSeconds: NOW,
    });
    assert.deepEqual(result, { ok: false, reason: "mfa_required" });
  });

  it("accepts a second factor exactly 7 days old and refuses one a second older", () => {
    const at = decideAdminAccess({
      identity: identity({ amr: amr(ADMIN_MFA_MAX_AGE_SECONDS) }),
      admin,
      isProfessional: false,
      nowSeconds: NOW,
    });
    assert.equal(at.ok, true);
    const after = decideAdminAccess({
      identity: identity({ amr: amr(ADMIN_MFA_MAX_AGE_SECONDS + 1) }),
      admin,
      isProfessional: false,
      nowSeconds: NOW,
    });
    assert.deepEqual(after, { ok: false, reason: "mfa_expired" });
  });

  it("uses 7 days as the 2FA lifetime", () => {
    assert.equal(ADMIN_MFA_MAX_AGE_SECONDS, 7 * 24 * 60 * 60);
  });
});

describe("adminCanWrite", () => {
  it("gives founders full access", () => {
    assert.equal(adminCanWrite(admin), true);
  });

  it("keeps partners read-only", () => {
    assert.equal(adminCanWrite({ ...admin, role: "partner" }), false);
  });

  it("refuses an unknown or inactive role", () => {
    assert.equal(adminCanWrite({ ...admin, role: "owner" as never }), false);
    assert.equal(adminCanWrite({ ...admin, is_active: false }), false);
  });
});

describe("decideAdminWriteAccess", () => {
  it("passes a founder's access through", () => {
    const access = { ok: true as const, admin, mfaVerifiedAt: NOW };
    assert.deepEqual(decideAdminWriteAccess(access), access);
  });

  it("refuses a partner as read-only", () => {
    const access = { ok: true as const, admin: { ...admin, role: "partner" as const }, mfaVerifiedAt: NOW };
    assert.deepEqual(decideAdminWriteAccess(access), { ok: false, reason: "read_only" });
  });

  it("keeps the original refusal when there is no admin", () => {
    assert.deepEqual(decideAdminWriteAccess({ ok: false, reason: "mfa_expired" }), {
      ok: false,
      reason: "mfa_expired",
    });
  });
});

describe("adminDenialStatus", () => {
  it("maps a read-only partner to 403", () => {
    assert.equal(adminDenialStatus("read_only"), 403);
  });

  it("maps sign-in problems to 401, wrong accounts to 403, and lookups to 503", () => {
    assert.equal(adminDenialStatus("signed_out"), 401);
    assert.equal(adminDenialStatus("mfa_required"), 401);
    assert.equal(adminDenialStatus("mfa_expired"), 401);
    assert.equal(adminDenialStatus("professional_account"), 403);
    assert.equal(adminDenialStatus("not_admin"), 403);
    assert.equal(adminDenialStatus("inactive"), 403);
    assert.equal(adminDenialStatus("unavailable"), 503);
  });
});

describe("decodeJwtClaims", () => {
  it("reads the payload of a JWT", () => {
    const claims = decodeJwtClaims(fakeJwt({ sub: USER_ID, aal: "aal2" }));
    assert.equal(claims?.sub, USER_ID);
    assert.equal(claims?.aal, "aal2");
  });

  it("returns null for malformed tokens", () => {
    assert.equal(decodeJwtClaims(""), null);
    assert.equal(decodeJwtClaims("not-a-jwt"), null);
    assert.equal(decodeJwtClaims("a.%%%.c"), null);
    assert.equal(decodeJwtClaims(`a.${Buffer.from("[1]").toString("base64url")}.c`), null);
  });
});

describe("resolveAdminAccess", () => {
  const token = fakeJwt({ sub: USER_ID, aal: "aal2", amr: amr(60) });

  function deps(overrides: Partial<Parameters<typeof resolveAdminAccess>[0]> = {}) {
    const calls: string[] = [];
    const d: Parameters<typeof resolveAdminAccess>[0] = {
      readAccessToken: async () => token,
      verifyUserId: async () => {
        calls.push("verify");
        return USER_ID;
      },
      loadAdminRow: async () => {
        calls.push("admin");
        return admin;
      },
      isProfessionalAccount: async () => {
        calls.push("professional");
        return false;
      },
      nowSeconds: () => NOW,
      ...overrides,
    };
    return { d, calls };
  }

  it("allows an admin whose token the server verified", async () => {
    const { d } = deps();
    const result = await resolveAdminAccess(d);
    assert.equal(result.ok, true);
  });

  it("is signed out without a token and touches nothing else", async () => {
    const { d, calls } = deps({ readAccessToken: async () => null });
    assert.deepEqual(await resolveAdminAccess(d), { ok: false, reason: "signed_out" });
    assert.deepEqual(calls, []);
  });

  it("is signed out when the server rejects the token", async () => {
    const { d, calls } = deps({ verifyUserId: async () => null });
    assert.deepEqual(await resolveAdminAccess(d), { ok: false, reason: "signed_out" });
    assert.deepEqual(calls, []);
  });

  it("is signed out when the verified user is not the token's subject", async () => {
    const { d } = deps({
      verifyUserId: async () => "33333333-3333-4333-8333-333333333333",
    });
    assert.deepEqual(await resolveAdminAccess(d), { ok: false, reason: "signed_out" });
  });

  it("reads aal and amr from the verified token", async () => {
    const { d } = deps({
      readAccessToken: async () => fakeJwt({ sub: USER_ID, aal: "aal1", amr: amr(60) }),
    });
    assert.deepEqual(await resolveAdminAccess(d), { ok: false, reason: "mfa_required" });
  });

  it("fails closed when a lookup throws", async () => {
    const { d } = deps({
      loadAdminRow: async () => {
        throw new Error("db down");
      },
    });
    assert.deepEqual(await resolveAdminAccess(d), { ok: false, reason: "unavailable" });
  });

  it("refuses a professional's account", async () => {
    const { d } = deps({ isProfessionalAccount: async () => true });
    assert.deepEqual(await resolveAdminAccess(d), {
      ok: false,
      reason: "professional_account",
    });
  });
});
