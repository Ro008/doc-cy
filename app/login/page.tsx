import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { LoginPageClient } from "@/components/auth/LoginPageClient";

export default async function LoginPage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/agenda");
  }

  return <LoginPageClient />;
}

