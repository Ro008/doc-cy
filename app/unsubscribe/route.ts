import { NextResponse } from "next/server";
import { applyDirectoryOutreachUnsubscribe } from "@/lib/apply-directory-outreach-unsubscribe";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

function unsubscribeHtml(input: { title: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${input.title}</title>
  </head>
  <body style="margin:0;background:#062F61;color:#F7FAFC;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <main style="max-width:560px;margin:48px auto;padding:0 20px;">
      <h1 style="font-size:22px;line-height:1.3;">${input.title}</h1>
      <p style="font-size:16px;line-height:1.65;color:#B0C0CE;">${input.body}</p>
    </main>
  </body>
</html>`;
}

function parseParams(request: Request): { id: string; token: string } {
  const url = new URL(request.url);
  return {
    id: url.searchParams.get("id") ?? "",
    token: url.searchParams.get("token") ?? "",
  };
}

async function processRequest(request: Request) {
  const { id, token } = parseParams(request);
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { ok: false as const, reason: "not_configured" as const };
  }
  return applyDirectoryOutreachUnsubscribe({ supabase, manualId: id, token });
}

export async function GET(request: Request) {
  const result = await processRequest(request);
  if (result.ok) {
    return new NextResponse(
      unsubscribeHtml({
        title: "You are unsubscribed",
        body: "You will not get these DocCy emails about patient interest on your profile. You can still register at any time.",
      }),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const body =
    result.reason === "not_configured" || result.reason === "missing_secret"
      ? "This unsubscribe link is not available right now. Email us if you still see these messages."
      : "This unsubscribe link is invalid. If you keep getting these emails, reply and ask to be removed.";

  return new NextResponse(
    unsubscribeHtml({
      title: "We could not unsubscribe that link",
      body,
    }),
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function POST(request: Request) {
  const result = await processRequest(request);
  if (result.ok) {
    return new NextResponse(null, { status: 200 });
  }
  return new NextResponse(null, { status: 400 });
}
