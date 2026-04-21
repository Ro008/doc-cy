type RevocationInputs = {
  revokedAfterIso: string | null | undefined;
  keepSessionId: string | null | undefined;
  tokenIat: number | null | undefined;
  tokenSessionId: string | null | undefined;
};

export function isSessionRevokedByPolicy(input: RevocationInputs): boolean {
  const revokedAfterMs = input.revokedAfterIso ? Date.parse(input.revokedAfterIso) : NaN;
  const tokenIatMs = typeof input.tokenIat === "number" ? input.tokenIat * 1000 : NaN;
  if (!Number.isFinite(revokedAfterMs) || !Number.isFinite(tokenIatMs)) return false;

  const tokenSessionId = (input.tokenSessionId ?? "").trim();
  const keepSessionId = (input.keepSessionId ?? "").trim();
  const isKeptSession = Boolean(keepSessionId) && tokenSessionId === keepSessionId;
  if (isKeptSession) return false;

  return tokenIatMs < revokedAfterMs;
}

