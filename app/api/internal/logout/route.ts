import { NextResponse } from "next/server";
import { INTERNAL_DIRECTORY_COOKIE } from "@/lib/internal-directory-auth-core";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(INTERNAL_DIRECTORY_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
