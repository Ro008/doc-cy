import { NextRequest, NextResponse } from "next/server";
import {
  INTERNAL_DIRECTORY_COOKIE,
  readInternalDirectorySecrets,
  roleFromCookieValue,
} from "@/lib/internal-directory-auth-core";

export async function POST(req: NextRequest) {
  const secrets = readInternalDirectorySecrets();
  if (!secrets.founder) {
    return NextResponse.json(
      { message: "Internal directory is not configured." },
      { status: 503 },
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const password = String(body.password ?? "");
  const role = roleFromCookieValue(password, secrets);
  if (!role) {
    return NextResponse.json({ message: "Invalid access code." }, { status: 401 });
  }

  const cookieValue = role === "founder" ? secrets.founder : secrets.partner;
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(INTERNAL_DIRECTORY_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
