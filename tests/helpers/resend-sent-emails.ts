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
  timeoutMs?: number;
}): Promise<ListedResendEmail> {
  const timeoutMs = input.timeoutMs ?? 30_000;
  const started = Date.now();
  const needle = input.subjectIncludes.toLowerCase();
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
      const match = (payload.data ?? []).find((row) =>
        String(row.subject ?? "").toLowerCase().includes(needle),
      );
      if (match?.id) {
        return {
          id: String(match.id),
          subject: String(match.subject ?? ""),
          to: asStringArray(match.to),
        };
      }
      lastError = `No sent email yet with subject including "${input.subjectIncludes}"`;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(lastError);
}
