import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { LoginPageClient } from "@/components/auth/LoginPageClient";
import { safeAuthNextPath } from "@/lib/auth-redirect";
import { postLoginDestination } from "@/lib/doctor-routes";
import { amrFromAccessToken, hasValidEmailStep } from "@/lib/professional-email-step";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: { next?: string | string[]; link?: string; signin?: string };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rawNext = searchParams?.next;
  const nextPath = safeAuthNextPath(Array.isArray(rawNext) ? rawNext[0] : rawNext);

  // A professional needs the emailed step (30 days): with a password-only (or
  // expired) session she signs in again here instead of being sent back.
  let signOutFirst = false;
  if (user) {
    const { data: professional } = await supabase
      .from("professionals")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    signOutFirst = Boolean(professional) && !hasValidEmailStep(amrFromAccessToken(session?.access_token));
    if (!signOutFirst) redirect(postLoginDestination(nextPath));
  }

  return (
    <LoginPageClient
      nextPath={nextPath}
      linkInvalid={searchParams?.link === "invalid"}
      signInAgain={searchParams?.signin === "again"}
      signOutFirst={signOutFirst}
    />
  );
}
