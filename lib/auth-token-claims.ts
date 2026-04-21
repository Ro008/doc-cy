export type AuthTokenClaims = {
  iat: number | null;
  sessionId: string | null;
};

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

export function parseAuthTokenClaims(accessToken: string | null | undefined): AuthTokenClaims {
  if (!accessToken) return { iat: null, sessionId: null };
  const parts = accessToken.split(".");
  if (parts.length < 2) return { iat: null, sessionId: null };
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1] ?? "")) as {
      iat?: unknown;
      session_id?: unknown;
    };
    const iatRaw = payload.iat;
    const iat =
      typeof iatRaw === "number" && Number.isFinite(iatRaw) ? Math.floor(iatRaw) : null;
    const sessionIdRaw = payload.session_id;
    const sessionId =
      typeof sessionIdRaw === "string" && sessionIdRaw.trim()
        ? sessionIdRaw.trim()
        : null;
    return { iat, sessionId };
  } catch {
    return { iat: null, sessionId: null };
  }
}

