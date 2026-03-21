import { NextRequest, NextResponse } from "next/server";

const COOKIE = "doccy-internal-directory";

export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_DIRECTORY_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { message: "Internal directory is not configured." },
      { status: 503 }
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  if (body.password !== secret) {
    return NextResponse.json({ message: "Invalid access code." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, secret, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
