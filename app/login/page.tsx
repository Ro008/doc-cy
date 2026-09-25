import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { LoginPageClient } from "@/components/auth/LoginPageClient";
import { safeAuthNextPath } from "@/lib/auth-redirect";
import { postLoginDestination } from "@/lib/doctor-routes";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: { next?: string | string[] };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rawNext = searchParams?.next;
  const nextPath = safeAuthNextPath(Array.isArray(rawNext) ? rawNext[0] : rawNext);

  if (user) {
    redirect(postLoginDestination(nextPath));
  }

  return <LoginPageClient nextPath={nextPath} />;
}
