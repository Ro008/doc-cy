export type ListedResendEmail = {
  id: string;
  subject: string;
  to: string[];
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

/** Poll Resend's list-sent-emails API until a subject match appears. */
export async function waitForResendEmailWithSubject(input: {
  apiKey: string;
  subjectIncludes: string;
  /** When set, the listed recipient must include this address (avoids matching an older identical subject). */
  toIncludes?: string;
  timeoutMs?: number;
}): Promise<ListedResendEmail> {
  const timeoutMs = input.timeoutMs ?? 30_000;
  const started = Date.now();
  const needle = input.subjectIncludes.toLowerCase();
  const toNeedle = input.toIncludes?.trim().toLowerCase() ?? "";
  let lastError = "No emails returned";

  while (Date.now() - started < timeoutMs) {
    const response = await fetch("https://api.resend.com/emails?limit=20", {
      headers: { Authorization: `Bearer ${input.apiKey}` },
    });
    if (!response.ok) {
      lastError = `Resend list failed (${response.status}): ${await response.text()}`;
    } else {
      const payload = (await response.json()) as {
        data?: Array<{ id?: string; subject?: string; to?: unknown }>;
      };
      const match = (payload.data ?? []).find((row) => {
        const subjectOk = String(row.subject ?? "").toLowerCase().includes(needle);
        if (!subjectOk) return false;
        if (!toNeedle) return true;
        return asStringArray(row.to).join(" ").toLowerCase().includes(toNeedle);
      });
      if (match?.id) {
        return {
          id: String(match.id),
          subject: String(match.subject ?? ""),
          to: asStringArray(match.to),
        };
      }
      lastError = toNeedle
        ? `No sent email yet with subject including "${input.subjectIncludes}" to ${input.toIncludes}`
        : `No sent email yet with subject including "${input.subjectIncludes}"`;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(lastError);
}

/** Fetch a sent email body and extract the first `/auth/confirm-email` URL. */
export async function fetchResendConfirmEmailUrl(input: {
  apiKey: string;
  emailId: string;
}): Promise<string | null> {
  const response = await fetch(`https://api.resend.com/emails/${input.emailId}`, {
    headers: { Authorization: `Bearer ${input.apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Resend get email failed (${response.status}): ${await response.text()}`);
  }
  const payload = (await response.json()) as { html?: string | null; text?: string | null };
  const blob = `${payload.html ?? ""}\n${payload.text ?? ""}`;
  const match = blob.match(/https?:\/\/[^\s"'<>]+\/auth\/confirm-email\?[^\s"'<>]+/i);
  return match?.[0]?.replace(/&amp;/g, "&") ?? null;
}
