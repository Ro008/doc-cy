// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  // Refresh Supabase session on every request so server components
  // (like /agenda) can see the authenticated user via cookies.
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protect /agenda and /agenda/*: require auth, redirect to login if no session
  if (pathname === "/agenda" || pathname.startsWith("/agenda/")) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Private internal directory (shared secret cookie; set via /internal gate)
  if (pathname === "/internal/directory" || pathname.startsWith("/internal/directory/")) {
    const secret = process.env.INTERNAL_DIRECTORY_SECRET?.trim();
    if (!secret) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    const cookie = req.cookies.get("doccy-internal-directory")?.value;
    if (cookie !== secret) {
      const gate = new URL("/internal", req.url);
      return NextResponse.redirect(gate);
    }
  }

  return res;
}
