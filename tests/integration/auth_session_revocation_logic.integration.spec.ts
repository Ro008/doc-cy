import { expect, test } from "@playwright/test";
import { isSessionRevokedByPolicy } from "@/lib/auth-session-revocation";

test.describe("Auth session revocation policy", () => {
  test("revokes older token when keep-session id differs", () => {
    const revoked = isSessionRevokedByPolicy({
      revokedAfterIso: "2026-04-21T08:00:00.000Z",
      keepSessionId: "session-keep",
      tokenIat: Math.floor(new Date("2026-04-21T07:59:00.000Z").getTime() / 1000),
      tokenSessionId: "session-old",
    });
    expect(revoked).toBe(true);
  });

  test("does not revoke active keep-session even if token is older", () => {
    const revoked = isSessionRevokedByPolicy({
      revokedAfterIso: "2026-04-21T08:00:00.000Z",
      keepSessionId: "session-keep",
      tokenIat: Math.floor(new Date("2026-04-21T07:59:00.000Z").getTime() / 1000),
      tokenSessionId: "session-keep",
    });
    expect(revoked).toBe(false);
  });

  test("does not revoke when token iat is newer than cutoff", () => {
    const revoked = isSessionRevokedByPolicy({
      revokedAfterIso: "2026-04-21T08:00:00.000Z",
      keepSessionId: "session-keep",
      tokenIat: Math.floor(new Date("2026-04-21T08:01:00.000Z").getTime() / 1000),
      tokenSessionId: "session-other",
    });
    expect(revoked).toBe(false);
  });

  test("fails open when revocation timestamp is missing", () => {
    const revoked = isSessionRevokedByPolicy({
      revokedAfterIso: null,
      keepSessionId: "session-keep",
      tokenIat: Math.floor(new Date("2026-04-21T07:59:00.000Z").getTime() / 1000),
      tokenSessionId: "session-old",
    });
    expect(revoked).toBe(false);
  });
});

