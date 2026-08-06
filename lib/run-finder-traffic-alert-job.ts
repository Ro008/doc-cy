import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FINDER_TRAFFIC_ALERT_COOLDOWN_MS,
  FINDER_TRAFFIC_ALERT_KEY,
  FINDER_TRAFFIC_SPIKE_MULTIPLIER,
  aggregateFinderTrafficRows,
  buildFinderTrafficAlertEmail,
  finderTrafficPathOrFilter,
  isFinderTrafficPath,
  shouldSendFinderTrafficAlert,
  type FinderTrafficAggregateRow,
  type FinderTrafficAlertMetrics,
} from "@/lib/finder-traffic-alert";
import { sendResendEmail } from "@/lib/resend";
import { createServiceRoleClient } from "@/lib/supabase-service";

const WINDOW_MS = 60 * 60 * 1000;
const BASELINE_DAYS = 7;

export type FinderTrafficAlertJobResult = {
  dryRun: boolean;
  alerted: boolean;
  skippedReason: string | null;
  humanCount: number;
  botCount: number;
  baselineHumanAvg: number;
  multiplier: number;
  emailPreview?: { subject: string; text: string };
};

async function countFinderVisitsInWindow(
  supabase: SupabaseClient,
  start: Date,
  end: Date,
  botFilter: "human" | "bot" | "all",
): Promise<number> {
  let query = supabase
    .from("website_visits")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  if (botFilter === "human") query = query.eq("is_bot", false);
  if (botFilter === "bot") query = query.eq("is_bot", true);

  const { count, error } = await query.or(finderTrafficPathOrFilter());
  if (error) {
    throw new Error(`finder visit count failed: ${error.message}`);
  }
  return count ?? 0;
}

async function loadFinderVisitRows(
  supabase: SupabaseClient,
  start: Date,
  end: Date,
): Promise<FinderTrafficAggregateRow[]> {
  const { data, error } = await supabase
    .from("website_visits")
    .select("page_path, country, user_agent, is_bot")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .or(finderTrafficPathOrFilter())
    .limit(5000);

  if (error) {
    throw new Error(`finder visit rows failed: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => ({
      page_path: String((row as { page_path?: string }).page_path ?? ""),
      country: ((row as { country?: string | null }).country ?? null) as string | null,
      user_agent: ((row as { user_agent?: string | null }).user_agent ?? null) as string | null,
      is_bot: Boolean((row as { is_bot?: boolean }).is_bot),
    }))
    .filter((row) => isFinderTrafficPath(row.page_path));
}

async function wasAlertSentRecently(supabase: SupabaseClient, now: Date): Promise<boolean> {
  const { data, error } = await supabase
    .from("ops_traffic_alerts")
    .select("alerted_at")
    .eq("alert_key", FINDER_TRAFFIC_ALERT_KEY)
    .order("alerted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const code = String((error as { code?: string }).code ?? "");
    const msg = String(error.message ?? "");
    if (code === "42P01" || /relation.*does not exist|could not find the table/i.test(msg)) {
      return false;
    }
    throw new Error(`ops_traffic_alerts lookup failed: ${error.message}`);
  }

  if (!data?.alerted_at) return false;
  const lastMs = new Date(String(data.alerted_at)).getTime();
  return now.getTime() - lastMs < FINDER_TRAFFIC_ALERT_COOLDOWN_MS;
}

async function recordAlertSent(
  supabase: SupabaseClient,
  details: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("ops_traffic_alerts").insert({
    alert_key: FINDER_TRAFFIC_ALERT_KEY,
    details,
  });

  if (error) {
    console.error("[DocCy][finder-traffic-alert] cooldown_insert_failed", error.message);
  }
}

function resolveFounderRecipients(): string[] {
  const override = process.env.RESEND_TO_OVERRIDE?.trim();
  if (override) return [override];

  const raw = process.env.FOUNDER_NOTIFY_EMAIL?.trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function runFinderTrafficAlertJob(options?: {
  dryRun?: boolean;
  now?: Date;
}): Promise<FinderTrafficAlertJobResult> {
  const dryRun = Boolean(options?.dryRun);
  const now = options?.now ?? new Date();
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - WINDOW_MS);

  const supabase = createServiceRoleClient();
  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  const [humanCount, botCount] = await Promise.all([
    countFinderVisitsInWindow(supabase, windowStart, windowEnd, "human"),
    countFinderVisitsInWindow(supabase, windowStart, windowEnd, "bot"),
  ]);

  const baselineCounts: number[] = [];
  for (let day = 1; day <= BASELINE_DAYS; day += 1) {
    const start = new Date(windowStart.getTime() - day * 24 * 60 * 60 * 1000);
    const end = new Date(windowEnd.getTime() - day * 24 * 60 * 60 * 1000);
    baselineCounts.push(await countFinderVisitsInWindow(supabase, start, end, "human"));
  }

  const baselineHumanAvg =
    baselineCounts.reduce((sum, n) => sum + n, 0) / Math.max(baselineCounts.length, 1);

  const multiplier =
    baselineHumanAvg > 0 ? humanCount / baselineHumanAvg : humanCount > 0 ? Infinity : 0;

  const baseResult: FinderTrafficAlertJobResult = {
    dryRun,
    alerted: false,
    skippedReason: null,
    humanCount,
    botCount,
    baselineHumanAvg,
    multiplier,
  };

  if (!shouldSendFinderTrafficAlert({ humanCount, baselineHumanAvg })) {
    return {
      ...baseResult,
      skippedReason: "below_threshold",
    };
  }

  if (!dryRun && (await wasAlertSentRecently(supabase, now))) {
    return {
      ...baseResult,
      skippedReason: "cooldown",
    };
  }

  const rows = await loadFinderVisitRows(supabase, windowStart, windowEnd);
  const aggregates = aggregateFinderTrafficRows(rows);

  const metrics: FinderTrafficAlertMetrics = {
    windowStart,
    windowEnd,
    humanCount,
    botCount,
    baselineHumanAvg,
    baselineSampleDays: BASELINE_DAYS,
    multiplier: Number.isFinite(multiplier) ? multiplier : FINDER_TRAFFIC_SPIKE_MULTIPLIER,
    topPages: aggregates.topPages,
    topCountries: aggregates.topCountries,
    sampleUserAgents: aggregates.sampleUserAgents,
  };

  const email = buildFinderTrafficAlertEmail(metrics);

  if (dryRun) {
    return {
      ...baseResult,
      emailPreview: { subject: email.subject, text: email.text },
      skippedReason: "dry_run",
    };
  }

  const recipients = resolveFounderRecipients();
  if (recipients.length === 0) {
    return {
      ...baseResult,
      skippedReason: "no_founder_email",
      emailPreview: { subject: email.subject, text: email.text },
    };
  }

  await sendResendEmail({
    to: recipients.length === 1 ? recipients[0]! : recipients,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  await recordAlertSent(supabase, {
    humanCount,
    botCount,
    baselineHumanAvg,
    multiplier,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  });

  return {
    ...baseResult,
    alerted: true,
    skippedReason: null,
  };
}
