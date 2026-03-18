type ResendEmail = {
  to: string | string[];
  subject: string;
  text: string;
};

export async function sendResendEmail(email: ResendEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    // Demo-friendly: don't fail booking if email isn't configured.
    console.warn("[DocCy] Resend is not configured. Skipping email send.", {
      hasApiKey: Boolean(apiKey),
      hasFrom: Boolean(from),
    });
    return { skipped: true as const };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email.to,
      subject: email.subject,
      text: email.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Resend send failed (${res.status}): ${body.slice(0, 500)}`
    );
  }

  return (await res.json().catch(() => ({}))) as unknown;
}

