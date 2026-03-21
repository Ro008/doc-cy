import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { InternalDirectoryClient } from "@/components/internal/InternalDirectoryClient";
import { InternalSignOutButton } from "@/components/internal/InternalSignOutButton";

export const dynamic = "force-dynamic";

export default async function InternalDirectoryPage() {
  const supabase = createServiceRoleClient();

  if (!supabase) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-200">
        <div className="mx-auto max-w-lg rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
          <h1 className="text-lg font-semibold text-amber-100">Configuration required</h1>
          <p className="mt-2 text-sm text-amber-100/90">
            Add <code className="rounded bg-black/30 px-1">SUPABASE_SERVICE_ROLE_KEY</code> to
            your environment so this page can list all doctors (server-side only). Never expose
            this key to the browser.
          </p>
          <p className="mt-4 text-sm text-amber-100/80">
            Also run <code className="rounded bg-black/30 px-1">supabase/doctors_add_languages.sql</code>{" "}
            in the Supabase SQL editor if the <code className="rounded bg-black/30 px-1">languages</code>{" "}
            column is missing.
          </p>
          <Link href="/internal" className="mt-6 inline-block text-sm text-emerald-300 hover:underline">
            ← Back to gate
          </Link>
        </div>
      </main>
    );
  }

  const { data: doctors, error } = await supabase
    .from("doctors")
    .select("id, name, slug, specialty, languages, status")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-200">
        <div className="mx-auto max-w-lg rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <h1 className="text-lg font-semibold text-red-100">Could not load doctors</h1>
          <p className="mt-2 text-sm text-red-100/90">{error.message}</p>
          <p className="mt-4 text-sm text-slate-400">
            If the error mentions <code className="rounded bg-black/30 px-1">languages</code>, run the SQL
            migration in <code className="rounded bg-black/30 px-1">supabase/doctors_add_languages.sql</code>.
          </p>
          <Link href="/internal" className="mt-6 inline-block text-sm text-emerald-300 hover:underline">
            ← Back to gate
          </Link>
        </div>
      </main>
    );
  }

  const rows = (doctors ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    slug: (d.slug as string | null) ?? null,
    specialty: (d.specialty as string | null) ?? null,
    languages: Array.isArray(d.languages)
      ? (d.languages as string[])
      : d.languages
        ? [String(d.languages)]
        : [],
    status: (d.status as string | null) ?? null,
  }));

  const totalCount = rows.length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Doctor directory</h1>
            <p className="mt-1 text-sm text-slate-400">Internal · registrations overview</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <InternalSignOutButton />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <InternalDirectoryClient doctors={rows} totalCount={totalCount} />
      </div>
    </main>
  );
}
