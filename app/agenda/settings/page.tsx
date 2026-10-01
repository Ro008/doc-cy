import { redirect } from "next/navigation";
import { legacySettingsRedirect } from "@/lib/settings-sections";

export const dynamic = "force-dynamic";

/** Settings moved to /settings (user, 2026-09-30); old links keep their section. */
export default function LegacyAgendaSettingsPage({
  searchParams,
}: {
  searchParams?: { section?: string | string[] };
}) {
  redirect(legacySettingsRedirect(searchParams ?? {}));
}
