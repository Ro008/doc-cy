// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Refresh Supabase session on every request so server components
  // (like /agenda) can see the authenticated user via cookies.
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession();

  return res;
}

