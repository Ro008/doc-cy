import { redirect } from "next/navigation";
import { adminSignInPath } from "@/lib/admin-sign-in-flow";

export const dynamic = "force-dynamic";

/** Old gate address (bookmarks, emails): the admin sign-in lives at /internal/sign-in. */
export default function InternalGatePage({
  searchParams,
}: {
  searchParams?: { next?: string | string[] };
}) {
  const next = Array.isArray(searchParams?.next) ? searchParams?.next[0] : searchParams?.next;
  redirect(adminSignInPath(next));
}
