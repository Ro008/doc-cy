import type { UserEventStatRow } from "@/lib/user-events";

/**
 * One row from `founder_user_event_stats('request_online_appointment', …)`: a vote counts
 * once per visitor.
 */
export type ManualVoteStatRow = UserEventStatRow;

export type ProfessionalDirectoryMeta = {
  name?: string | null;
  district?: string | null;
  specialty?: string | null;
};

/**
 * Maps pre-aggregated vote stats onto dashboard rows, filling in professional
 * metadata. Return shape matches `ManualPatientVoteRow`
 * (components/internal/ManualPatientVotesSection.tsx).
 */
export function buildManualVoteDashboardRows(
  stats: readonly ManualVoteStatRow[],
  metaById: ReadonlyMap<string, ProfessionalDirectoryMeta>,
) {
  return stats.map((row) => {
    const id = String(row.professional_id ?? "");
    const meta = metaById.get(id);
    const count = Number(row.visitor_count);
    return {
      manualId: id,
      name: meta?.name?.trim() || id.slice(0, 8),
      district: meta?.district ?? null,
      specialty: meta?.specialty ?? null,
      count: Number.isFinite(count) ? count : 0,
      lastAt: String(row.last_at ?? ""),
    };
  });
}
