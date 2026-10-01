import { LISTING_CLINICS_SELECT, listingClinicLocations } from "@/lib/listing-clinic-location";
import Link from "next/link";
import { Suspense } from "react";
import { startOfMonth, startOfWeek, subMonths } from "date-fns";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { fetchAllSupabaseRows, fetchAllSupabaseRowsForIdChunks } from "@/lib/supabase-fetch-all";
import {
  founderDirectoryHref,
  getCallToBookWindowDays,
  getManualVotesWindowDays,
  parseFounderDashboardQuery,
  type CallToBookSortCol,
  type FounderDashboardQuery,
  type ManualVotesSortCol,
  type SortDir,
} from "@/lib/founder-dashboard-query";
import { InternalDirectoryClient } from "@/components/internal/InternalDirectoryClient";
import type { DirectoryDoctorRow } from "@/components/internal/InternalDirectoryClient";
import {
  PendingSpecialtiesPanel,
  type PendingSpecialtyRow,
} from "@/components/internal/PendingSpecialtiesPanel";
import {
  buildPendingSpecialtyItems,
  type PendingSpecialtyJunctionRow,
} from "@/lib/pending-specialty-review";
import { InternalSignOutButton } from "@/components/internal/InternalSignOutButton";
import { FounderKpiCards } from "@/components/internal/FounderKpiCards";
import { SpecialtyBreakdown } from "@/components/internal/SpecialtyBreakdown";
import { LanguageDistribution } from "@/components/internal/LanguageDistribution";
import {
  RecentActivityFeed,
  type RecentAppointmentRow,
} from "@/components/internal/RecentActivityFeed";
import { AppointmentsGrowthChart } from "@/components/internal/AppointmentsGrowthChart";
import {
  aggregateLanguages,
  aggregateSpecialties,
} from "@/lib/founder-metrics";
import { buildLastSixMonthsAppointmentCounts } from "@/lib/founder-appointments-by-month";
import { cyprusMonthStartUtcIso } from "@/lib/cyprus-calendar";
import { TrialConversionTable } from "@/components/internal/TrialConversionTable";
import { TrialMonthsSetting } from "@/components/internal/TrialMonthsSetting";
import { loadTrialMonths } from "@/lib/trial-months-setting";
import { RegistrationRequestsSection } from "@/components/internal/RegistrationRequestsSection";
import {
  countReviewablePendingRequests,
  loadRegistrationRequestsForReview,
} from "@/lib/registration-requests";
import {
  INTERNAL_DASHBOARD_TABS,
  internalDashboardTab,
  internalDashboardTabHref,
  type InternalDashboardTab,
} from "@/lib/internal-dashboard-tab";
import { WebsiteAnalyticsPanel } from "@/components/internal/WebsiteAnalyticsPanel";
import { PendingLink } from "@/components/navigation/PendingLink";
import { InternalDirectoryShell } from "@/components/internal/DirectoryNavContext";
import {
  ManualPatientVotesSection,
  type ManualPatientVoteRow,
} from "@/components/internal/ManualPatientVotesSection";
import {
  CallToBookClicksSection,
  type CallToBookDashboardRow,
} from "@/components/internal/CallToBookClicksSection";
import { buildCallToBookDashboardRows, sumCallToBookStats } from "@/lib/call-to-book";
import { buildManualVoteDashboardRows } from "@/lib/founder-manual-votes";
import {
  FinderInvitationRequestsSection,
  type FinderInvitationRequestRow,
} from "@/components/internal/FinderInvitationRequestsSection";
import { loadLocalTestLoginPasswordsByAuthUserId } from "@/lib/local-test-login-credentials";
import { redirect } from "next/navigation";
import { adminCanWrite, getAdminAccess } from "@/lib/admin-auth";
import { adminSignInPath } from "@/lib/admin-sign-in-flow";
import { professionalAccountEmail } from "@/lib/professional-account-contact";
import {
  hasPendingSpecialty,
  loadSpecialtyCatalogueNames,
  loadSpecialtyEntriesByProfessionalIds,
  primarySpecialtyEntry,
  SPECIALTY_LINKS_SELECT,
  specialtyNamesForRow,
  type ProfessionalSpecialtyEntry,
} from "@/lib/specialty-catalogue";
import { USER_EVENTS_TABLE, parseMissingProfessionalReportDetails } from "@/lib/user-events";

function sortManualPatientVoteRows(
  rows: ManualPatientVoteRow[],
  col: ManualVotesSortCol,
  dir: SortDir,
): ManualPatientVoteRow[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let c = 0;
    switch (col) {
      case "votes":
        c = a.count - b.count;
        break;
      case "last":
        c = new Date(a.lastAt).getTime() - new Date(b.lastAt).getTime();
        break;
      case "name":
        c = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
        break;
      case "district":
        c = (a.district ?? "").localeCompare(b.district ?? "", "en", { sensitivity: "base" });
        break;
      case "specialty":
        c = (a.specialty ?? "").localeCompare(b.specialty ?? "", "en", { sensitivity: "base" });
        break;
      default:
        c = 0;
    }
    if (c !== 0) return mul * c;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
}

function sortCallToBookRows(
  rows: CallToBookDashboardRow[],
  col: CallToBookSortCol,
  dir: SortDir,
): CallToBookDashboardRow[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let c = 0;
    switch (col) {
      case "clicks":
        c = a.count - b.count;
        break;
      case "finder":
        c = a.finderCount - b.finderCount;
        break;
      case "profile":
        c = a.professionalProfileCount - b.professionalProfileCount;
        break;
      case "last":
        c = new Date(a.lastAt).getTime() - new Date(b.lastAt).getTime();
        break;
      case "name":
        c = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
        break;
      case "district":
        c = (a.district ?? "").localeCompare(b.district ?? "", "en", { sensitivity: "base" });
        break;
      case "specialty":
        c = (a.specialty ?? "").localeCompare(b.specialty ?? "", "en", { sensitivity: "base" });
        break;
      default:
        c = 0;
    }
    if (c !== 0) return mul * c;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
}

/** Always run on the server per request — no static cache of dashboard numbers */
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getRuntimeEnvironmentLabel(): "production" | "preview" | "local" {
  const vercelEnv = (process.env.VERCEL_ENV ?? "").trim().toLowerCase();
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  return "local";
}

/** Page header with the Requests / Statistics tabs (until the internal site gets its own design). */
function DashboardHeader({
  admin: signedInAdmin,
  canMutate,
  runtimeLabel,
  runtimeBadgeClass,
  tab,
  pendingRequestsCount,
}: {
  admin: { name: string };
  canMutate: boolean;
  runtimeLabel: string;
  runtimeBadgeClass: string;
  tab: InternalDashboardTab;
  pendingRequestsCount: number;
}) {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-clinical-500/90">
            {canMutate ? "Founder" : "Business Partner"}
          </p>
          {canMutate ? (
            <>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white lg:text-3xl">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Platform health · professionals · bookings · live data
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white lg:text-3xl">
                Hi {signedInAdmin.name}
              </h1>
              <p className="mt-1 text-sm text-slate-400">Your DocCy overview.</p>
            </>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-1 font-semibold uppercase tracking-[0.12em] ${runtimeBadgeClass}`}
            >
              Environment: {runtimeLabel}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-600/60 bg-slate-800/70 px-2 py-1 font-semibold tracking-[0.04em] text-slate-200">
              Signed in: {signedInAdmin.name}
            </span>
            {canMutate ? null : (
              <span className="inline-flex items-center rounded-full border border-slate-600/60 bg-slate-800/70 px-2 py-1 font-semibold uppercase tracking-[0.12em] text-slate-200">
                Access: Read-only
              </span>
            )}
          </div>
        </div>
        <InternalSignOutButton />
      </div>
      <nav aria-label="Dashboard sections" className="mx-auto flex max-w-7xl gap-1 px-4 lg:px-8">
        {INTERNAL_DASHBOARD_TABS.map((item) => {
          const selected = item.id === tab;
          return (
            <Link
              key={item.id}
              href={internalDashboardTabHref(item.id)}
              aria-current={selected ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
                selected
                  ? "border-clinical-400 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.label}
              {item.id === "requests" && pendingRequestsCount > 0 ? (
                <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-950">
                  {pendingRequestsCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export default async function FounderDashboardPage({
  searchParams,
}: {
  searchParams?: {
    tab?: string | string[];
    manualVotesRange?: string | string[];
    manualVotesCol?: string | string[];
    manualVotesDir?: string | string[];
    callToBookRange?: string | string[];
    callToBookCol?: string | string[];
    callToBookDir?: string | string[];
  };
}) {
  // Admin login + active admin_users row + authenticator code within 7 days.
  const access = await getAdminAccess("page");
  if ("reason" in access) redirect(adminSignInPath("/internal/directory"));
  const signedInAdmin = access.admin;
  const canMutate = adminCanWrite(signedInAdmin);

  const supabase = createServiceRoleClient();
  const runtimeLabel = getRuntimeEnvironmentLabel();
  const runtimeBadgeClass =
    runtimeLabel === "production"
      ? "border-clinical-400/35 bg-clinical-500/10 text-clinical-200"
      : runtimeLabel === "preview"
        ? "border-violet-400/35 bg-violet-500/10 text-violet-200"
        : "border-slate-600/60 bg-slate-800/70 text-slate-200";

  if (!supabase) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-200">
        <div className="mx-auto max-w-lg rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
          <h1 className="text-lg font-semibold text-amber-100">Configuration required</h1>
          <p className="mt-2 text-sm text-amber-100/90">
            Add <code className="rounded bg-black/30 px-1">SUPABASE_SERVICE_ROLE_KEY</code> to
            your environment so this page can load analytics (server-side only). Never expose this
            key to the browser.
          </p>
          <PendingLink
            href="/internal"
            className="mt-6 inline-block text-sm text-clinical-300 hover:underline"
          >
            ← Back to gate
          </PendingLink>
        </div>
      </main>
    );
  }

  const tab = internalDashboardTab(searchParams?.tab);
  if (tab === "requests") {
    // The review queue only: nothing else on this page is loaded.
    const [trialMonthsSetting, review, specialtyCatalogue] = await Promise.all([
      loadTrialMonths(supabase),
      loadRegistrationRequestsForReview(supabase).catch((err) => {
        console.error("[internal/directory] registration requests load failed", err);
        return { items: [], hiddenPending: 0 };
      }),
      loadSpecialtyCatalogueNames(supabase).catch((err) => {
        console.error("[internal/directory] specialty catalogue load failed", err);
        return [] as string[];
      }),
    ]);
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 mx-auto h-96 max-w-4xl rounded-full bg-clinical-600/[0.07] blur-3xl" />
        <div className="absolute right-0 top-1/4 h-64 w-64 rounded-full bg-violet-600/[0.06] blur-3xl" />
      </div>
        <DashboardHeader
          admin={signedInAdmin}
          canMutate={canMutate}
          runtimeLabel={runtimeLabel}
          runtimeBadgeClass={runtimeBadgeClass}
          tab="requests"
          pendingRequestsCount={review.items.filter((item) => item.status === "pending").length}
        />
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 lg:px-8">
          <RegistrationRequestsSection
            items={review.items}
            hiddenPending={review.hiddenPending}
            canMutate={canMutate}
            defaultTrialMonths={trialMonthsSetting.ok ? trialMonthsSetting.months : null}
            specialtyCatalogue={specialtyCatalogue}
          />
        </div>
      </main>
    );
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dashboardQuery: FounderDashboardQuery = parseFounderDashboardQuery(searchParams);
  const monthStartIso = cyprusMonthStartUtcIso();
  const chartRangeStart = startOfMonth(subMonths(new Date(), 5));

  const doctorSelectWithAccountEmail =
    "id, name, email, registration_email, phone, slug, languages, status, created_at, auth_user_id, pro_access_until";
  const doctorSelectLegacy =
    "id, name, email, phone, slug, languages, status, created_at, auth_user_id";

  let doctorsRes = await fetchAllSupabaseRows(() =>
    supabase
      .from("professionals")
      .select(doctorSelectWithAccountEmail)
      .eq("is_registered", true)
      .order("created_at", { ascending: false }),
  );
  if (
    doctorsRes.error &&
    /registration_email/i.test(String(doctorsRes.error.message ?? ""))
  ) {
    doctorsRes = (await fetchAllSupabaseRows(() =>
      supabase
        .from("professionals")
        .select(doctorSelectLegacy)
        .eq("is_registered", true)
        .order("created_at", { ascending: false }),
    )) as typeof doctorsRes;
  }
  const [
    apptCountRes,
    apptsMonthCountRes,
    appts7dRes,
    recentApptsRes,
    apptsForChartRes,
  ] = await Promise.all([
    supabase.from("appointments").select("id", { count: "exact", head: true }),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStartIso),
    // Distinct-doctor count computed in SQL instead of fetching every appointment row.
    supabase.rpc("founder_active_doctor_count", { p_since: sevenDaysAgoIso }),
    supabase
      .from("appointments")
      .select("id, patient_name, appointment_datetime, created_at, doctor_id")
      .order("created_at", { ascending: false })
      .limit(5),
    // Pre-grouped by month in SQL instead of fetching every appointment row since chartRangeStart.
    supabase.rpc("founder_appointments_by_month", {
      p_since: chartRangeStart.toISOString(),
    }),
  ]);

  if (doctorsRes.error) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-200">
        <div className="mx-auto max-w-lg rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <h1 className="text-lg font-semibold text-red-100">
            Could not load professionals
          </h1>
          <p className="mt-2 text-sm text-red-100/90">{doctorsRes.error.message}</p>
          <PendingLink
            href="/internal"
            className="mt-6 inline-block text-sm text-clinical-300 hover:underline"
          >
            ← Back to gate
          </PendingLink>
        </div>
      </main>
    );
  }

  let recentApptRowsRaw: {
    id: unknown;
    patient_name: unknown;
    appointment_datetime: unknown;
    doctor_id: unknown;
    created_at?: unknown;
  }[] = [];

  if (!recentApptsRes.error && recentApptsRes.data) {
    recentApptRowsRaw = recentApptsRes.data;
  } else {
    const fallback = await supabase
      .from("appointments")
      .select("id, patient_name, appointment_datetime, doctor_id, created_at")
      .order("appointment_datetime", { ascending: false })
      .limit(5);
    recentApptRowsRaw = fallback.data ?? [];
  }

  const rawDoctors = doctorsRes.data ?? [];
  // Specialty, licence and review flag come from professional_specialties.
  let specialtyEntriesByDoctor = new Map<string, ProfessionalSpecialtyEntry[]>();
  try {
    specialtyEntriesByDoctor = await loadSpecialtyEntriesByProfessionalIds(
      supabase,
      rawDoctors.map((d) => String(d.id)),
    );
  } catch (err) {
    console.error("[internal/directory] professional specialties load failed", err);
  }
  const rows = rawDoctors.map((d) => {
    const entries = specialtyEntriesByDoctor.get(String(d.id)) ?? [];
    const primary = primarySpecialtyEntry(entries);
    return {
    id: d.id as string,
    name: d.name as string,
    email:
      professionalAccountEmail({
        registration_email: (d as { registration_email?: string | null }).registration_email,
        email: (d as { email?: string | null }).email,
      }) || null,
    phone: (d as { phone?: string | null }).phone ?? null,
    slug: (d.slug as string | null) ?? null,
    specialty: primary?.name ?? null,
    languages: Array.isArray(d.languages)
      ? (d.languages as string[])
      : d.languages
        ? [String(d.languages)]
        : [],
    status: (d.status as string | null) ?? null,
    license_number: primary?.licenseNumber ?? null,
    created_at: (d as { created_at?: string | null }).created_at ?? null,
    pro_access_until: (d as { pro_access_until?: string | null }).pro_access_until ?? null,
    is_specialty_approved: !hasPendingSpecialty(entries),
    auth_user_id: (d as { auth_user_id?: string | null }).auth_user_id ?? null,
    };
  });

  const showLocalTestCredentials = runtimeLabel === "local";
  let directoryDoctorRows: DirectoryDoctorRow[] = rows.map((r) => {
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      specialty: r.specialty,
      languages: r.languages,
      status: r.status,
      license_number: r.license_number,
      is_specialty_approved: r.is_specialty_approved,
    };
  });

  if (showLocalTestCredentials) {
    const loginPasswordsByAuthUserId = await loadLocalTestLoginPasswordsByAuthUserId(
      supabase,
      rows.map((r) => r.auth_user_id).filter((id): id is string => Boolean(id)),
    );

    directoryDoctorRows = rows.map((r) => {
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        specialty: r.specialty,
        languages: r.languages,
        status: r.status,
        license_number: r.license_number,
        is_specialty_approved: r.is_specialty_approved,
        email: r.email,
        loginPassword: r.auth_user_id
          ? loginPasswordsByAuthUserId.get(r.auth_user_id) ?? null
          : null,
      };
    });
  }

  // Registered, still pending, with a custom specialty awaiting review (newest first).
  const pendingProfessionals = rows
    .filter(
      (r) => !r.is_specialty_approved && (r.status ?? "").trim().toLowerCase() === "pending",
    )
    .map((r) => ({ id: r.id, name: r.name ?? null, email: r.email }));

  const pendingSpecialtyItems: PendingSpecialtyRow[] = buildPendingSpecialtyItems(
    pendingProfessionals,
    pendingProfessionals.flatMap((r) =>
      (specialtyEntriesByDoctor.get(r.id) ?? []).map(
        (entry): PendingSpecialtyJunctionRow => ({
          id: entry.id,
          professional_id: r.id,
          specialty: entry.name,
          license_number: entry.licenseNumber,
          is_approved: entry.isApproved,
        }),
      ),
    ),
  );

  const specialtyOptions = await loadSpecialtyCatalogueNames(supabase);
  const verifiedRows = rows.filter(
    (r) => (r.status ?? "").trim().toLowerCase() === "verified"
  );
  const totalDoctors = verifiedRows.length;
  const totalAppointments = apptCountRes.error ? 0 : apptCountRes.count ?? 0;
  const appointmentsThisMonth = apptsMonthCountRes.error
    ? 0
    : apptsMonthCountRes.count ?? 0;

  const activeDoctors7d =
    !appts7dRes.error && typeof appts7dRes.data === "number" ? appts7dRes.data : 0;

  const newDoctorsThisWeek = verifiedRows.filter((r) => {
    if (!r.created_at) return false;
    return new Date(r.created_at) >= weekStart;
  }).length;

  const chartRows =
    !apptsForChartRes.error && apptsForChartRes.data
      ? (apptsForChartRes.data as { month_key: string; appt_count: number | string | null }[])
      : [];
  const chartData = buildLastSixMonthsAppointmentCounts(chartRows);

  const specialtyItems = aggregateSpecialties(verifiedRows);
  const languageItems = aggregateLanguages(verifiedRows);

  let manualVoteRowsUnsorted: ManualPatientVoteRow[] = [];
  try {
    const manualVotesDays = getManualVotesWindowDays(dashboardQuery.manualVotesRange);
    const sinceIso =
      manualVotesDays != null
        ? new Date(Date.now() - manualVotesDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
    // Voter dedupe + count computed in SQL instead of fetching every booking-request row.
    const { data: voteStats, error: reqErr } = await supabase.rpc("founder_user_event_stats", {
      p_event_type: "request_online_appointment",
      p_since: sinceIso,
    });
    if (!reqErr && voteStats?.length) {
      const ids = voteStats.map((v: { professional_id: string }) => String(v.professional_id));
      const { data: namesRows } = await supabase
        .from("professionals")
        .select(`id, name, ${LISTING_CLINICS_SELECT}, ${SPECIALTY_LINKS_SELECT}`)
        .in("id", ids.length > 500 ? ids.slice(0, 500) : ids);
      const nameMap = new Map(
        (namesRows ?? []).map((n) => [
          String(n.id),
          {
            name: String((n as { name?: string }).name ?? ""),
            // The primary clinic's district (Point E5).
            district: listingClinicLocations(n as { listing_clinics?: unknown })[0]?.district ?? null,
            specialty: specialtyNamesForRow(n as { specialty_links?: unknown })[0] ?? null,
          },
        ])
      );
      manualVoteRowsUnsorted = buildManualVoteDashboardRows(voteStats, nameMap);
    }
  } catch (reqStatsErr) {
    console.error("[DocCy] manual patient request stats failed", reqStatsErr);
  }

  let finderInvitationRows: FinderInvitationRequestRow[] = [];
  try {
    const invitationSinceIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invitationRows, error: invitationErr } = await fetchAllSupabaseRows(() =>
      supabase
        .from(USER_EVENTS_TABLE)
        .select("id, details, created_at, visitor_key")
        .eq("event_type", "missing_professional_report")
        .gte("created_at", invitationSinceIso)
        .order("created_at", { ascending: false }),
    );

    if (!invitationErr && invitationRows?.length) {
      const byKey = new Map<
        string,
        { requestedName: string; specialty: string | null; district: string | null; voters: Set<string>; lastAt: string }
      >();
      for (const r of invitationRows) {
        const report = parseMissingProfessionalReportDetails((r as { details?: unknown }).details);
        if (!report) continue;
        const requestedName = report.requested_name;
        const { specialty, district } = report;
        const ca = String((r as { created_at?: string }).created_at ?? "");
        const id = String((r as { id?: string }).id ?? "");
        const vk = (r as { visitor_key?: string | null }).visitor_key?.trim();
        const dedupeId = vk || `legacy:${id}`;
        const key = `${requestedName.toLowerCase()}|${specialty ?? ""}|${district ?? ""}`;
        const cur = byKey.get(key);
        if (!cur) {
          byKey.set(key, {
            requestedName,
            specialty,
            district,
            voters: new Set([dedupeId]),
            lastAt: ca,
          });
        } else {
          cur.voters.add(dedupeId);
          if (ca > cur.lastAt) cur.lastAt = ca;
        }
      }
      finderInvitationRows = Array.from(byKey.values())
        .map((agg) => ({
          requestedName: agg.requestedName,
          specialty: agg.specialty,
          district: agg.district,
          count: agg.voters.size,
          lastAt: agg.lastAt,
        }))
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
        });
    }
  } catch (invitationStatsErr) {
    console.error("[DocCy] finder invitation request stats failed", invitationStatsErr);
  }

  const manualVoteRowsSorted = sortManualPatientVoteRows(
    manualVoteRowsUnsorted,
    dashboardQuery.manualVotesCol,
    dashboardQuery.manualVotesDir,
  ).slice(0, 120);

  const podiumSorted = [...manualVoteRowsUnsorted].sort(
    (a, b) =>
      b.count - a.count ||
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
  const patientVotesPodium = podiumSorted.slice(0, 3).map((r, i) => ({
    rank: (i + 1) as 1 | 2 | 3,
    name: r.name,
    specialty: r.specialty,
    count: r.count,
  }));
  const patientVotesPodiumMax = Math.max(podiumSorted[0]?.count ?? 0, 1);

  let callToBookRows: CallToBookDashboardRow[] = [];
  let callToBookTotal = 0;
  let callToBookFinderCount = 0;
  let callToBookProfessionalProfileCount = 0;
  try {
    const callToBookDays = getCallToBookWindowDays(dashboardQuery.callToBookRange);
    const sinceIso =
      callToBookDays != null
        ? new Date(Date.now() - callToBookDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
    // Per-professional click/finder/profile counts computed in SQL instead of
    // fetching every click row.
    const { data: clickStats, error: clickErr } = await supabase.rpc("founder_user_event_stats", {
      p_event_type: "show_phone_number",
      p_since: sinceIso,
    });
    if (!clickErr && clickStats?.length) {
      const totals = sumCallToBookStats(clickStats);
      callToBookTotal = totals.total;
      callToBookFinderCount = totals.finderCount;
      callToBookProfessionalProfileCount = totals.professionalProfileCount;
      const ids = clickStats.map((r: { professional_id: string }) => String(r.professional_id));
      const { data: namesRows } = await fetchAllSupabaseRowsForIdChunks(ids, (idChunk) =>
        supabase
          .from("professionals")
          .select(`id, name, ${LISTING_CLINICS_SELECT}, ${SPECIALTY_LINKS_SELECT}`)
          .in("id", idChunk),
      );
      const nameMap = new Map(
        (namesRows ?? []).map((n) => [
          String((n as { id?: string }).id ?? ""),
          {
            name: String((n as { name?: string }).name ?? ""),
            // The primary clinic's district (Point E5).
            district: listingClinicLocations(n as { listing_clinics?: unknown })[0]?.district ?? null,
            specialty: specialtyNamesForRow(n as { specialty_links?: unknown })[0] ?? null,
          },
        ]),
      );
      callToBookRows = sortCallToBookRows(
        buildCallToBookDashboardRows(clickStats, nameMap),
        dashboardQuery.callToBookCol,
        dashboardQuery.callToBookDir,
      ).slice(0, 120);
    }
  } catch (callToBookErr) {
    console.error("[DocCy] call to book click stats failed", callToBookErr);
  }

  const doctorIds = Array.from(
    new Set(recentApptRowsRaw.map((a) => a.doctor_id as string))
  );
  const nameById: Record<string, string> = {};
  if (doctorIds.length > 0) {
    const { data: docRows } = await supabase
      .from("professionals")
      .select("id, name")
      .in("id", doctorIds);
    for (const d of docRows ?? []) {
      nameById[d.id as string] = (d.name as string) ?? "";
    }
  }

  const activityItems: RecentAppointmentRow[] = recentApptRowsRaw.map((a) => {
    const created = (a.created_at as string | null | undefined) ?? null;
    return {
      id: a.id as string,
      patient_name: (a.patient_name as string) ?? "Patient",
      appointment_datetime: a.appointment_datetime as string,
      booked_at_iso: created,
      doctor_id: a.doctor_id as string,
      doctor_name: nameById[a.doctor_id as string] ?? null,
    };
  });
  const trialMonths = await loadTrialMonths(supabase);
  if (trialMonths.ok === false) console.error("[internal/directory] trial months load failed", trialMonths.error);

  const pendingRequestsCount = await countReviewablePendingRequests(supabase);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 mx-auto h-96 max-w-4xl rounded-full bg-clinical-600/[0.07] blur-3xl" />
        <div className="absolute right-0 top-1/4 h-64 w-64 rounded-full bg-violet-600/[0.06] blur-3xl" />
      </div>

      <DashboardHeader
        admin={signedInAdmin}
        canMutate={canMutate}
        runtimeLabel={runtimeLabel}
        runtimeBadgeClass={runtimeBadgeClass}
        tab="statistics"
        pendingRequestsCount={pendingRequestsCount}
      />

      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 lg:px-8">
            <p className="rounded-xl border border-slate-800/80 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-400">
              Loading dashboard…
            </p>
          </div>
        }
      >
        <InternalDirectoryShell canMutate={canMutate}>
          <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 lg:px-8">
        {pendingRequestsCount > 0 ? (
          <section className="rounded-2xl border border-amber-500/45 bg-amber-500/10 p-5 shadow-lg shadow-black/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/95">
                  Action required
                </p>
                <h2 className="mt-1 text-lg font-semibold text-amber-100">
                  {`${pendingRequestsCount} registration request${pendingRequestsCount === 1 ? "" : "s"}`}
                </h2>
                <p className="mt-1 text-sm text-amber-100/85">
                  {canMutate
                    ? "Open each item below to review it."
                    : "Pending items are listed below for awareness. Your access is read-only."}
                </p>
              </div>
              <Link
                href={internalDashboardTabHref("requests")}
                className="inline-flex items-center justify-center rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-amber-900/30 transition hover:bg-amber-200"
              >
                Review requests
              </Link>
            </div>
          </section>
        ) : null}

        <FounderKpiCards
          totalDoctors={totalDoctors}
          totalAppointments={totalAppointments}
          appointmentsThisMonth={appointmentsThisMonth}
          activeDoctors7d={activeDoctors7d}
          newDoctorsThisWeek={newDoctorsThisWeek}
        />

        <PendingSpecialtiesPanel
          items={pendingSpecialtyItems}
          specialtyOptions={specialtyOptions}
        />
        <ManualPatientVotesSection
          query={dashboardQuery}
          rows={manualVoteRowsSorted}
          podium={patientVotesPodium}
          maxVotes={patientVotesPodiumMax}
        />
        <CallToBookClicksSection
          query={dashboardQuery}
          total={callToBookTotal}
          finderCount={callToBookFinderCount}
          professionalProfileCount={callToBookProfessionalProfileCount}
          rows={callToBookRows}
        />
        <FinderInvitationRequestsSection rows={finderInvitationRows} />
        <TrialMonthsSetting
          months={trialMonths.ok ? trialMonths.months : null}
          canEdit={canMutate}
        />
        <TrialConversionTable doctors={verifiedRows} />
        <WebsiteAnalyticsPanel />

        <div className="grid gap-6 xl:grid-cols-12">
          <div className="order-2 space-y-6 xl:order-1 xl:col-span-8">
            <AppointmentsGrowthChart data={chartData} />

            <div className="grid gap-6 md:grid-cols-2">
              <SpecialtyBreakdown items={specialtyItems} />
              <LanguageDistribution items={languageItems} totalDoctorCount={totalDoctors} />
            </div>
          </div>

          <div className="order-1 xl:order-2 xl:col-span-4">
            <RecentActivityFeed items={activityItems} />
          </div>
        </div>

        <section
          id="professional-directory"
          className="rounded-2xl border border-slate-800/80 bg-slate-900/25 p-5 shadow-inner shadow-black/20 backdrop-blur-sm"
        >
          <div className="mb-5 flex flex-col gap-1 border-b border-slate-800/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Professional directory</h2>
              <p className="text-xs text-slate-500">Search, filter, open public profiles</p>
            </div>
          </div>
          <InternalDirectoryClient
            doctors={directoryDoctorRows}
            showLocalTestCredentials={showLocalTestCredentials && canMutate}
          />
        </section>
          </div>
        </InternalDirectoryShell>
      </Suspense>
    </main>
  );
}
