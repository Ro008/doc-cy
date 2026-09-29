/**
 * /internal/directory tabs, until the internal site gets its own design:
 * "Requests" (the review queue, the default) and "Statistics" (everything else).
 */

export type InternalDashboardTab = "requests" | "statistics";

export const INTERNAL_DASHBOARD_TABS: ReadonlyArray<{ id: InternalDashboardTab; label: string }> = [
  { id: "requests", label: "Requests" },
  { id: "statistics", label: "Statistics" },
];

export function internalDashboardTab(value: string | string[] | undefined): InternalDashboardTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "statistics" ? "statistics" : "requests";
}

export function internalDashboardTabHref(tab: InternalDashboardTab): string {
  return `/internal/directory?tab=${tab}`;
}
