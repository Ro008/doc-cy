/** Where a signed-in professional lands after login. */
export const DOCTOR_HOME_PATH = "/dashboard";

export type DoctorNavTabId = "dashboard" | "agenda" | "settings" | "insights";

export type DoctorNavTab = {
  id: DoctorNavTabId;
  label: string;
  href: string;
};

/** Top-level doctor pages, in navigation order (desktop header and mobile tab bar). */
export const DOCTOR_NAV_TABS: readonly DoctorNavTab[] = [
  { id: "dashboard", label: "Dashboard", href: DOCTOR_HOME_PATH },
  { id: "agenda", label: "Agenda", href: "/agenda" },
  { id: "settings", label: "Settings", href: "/agenda/settings" },
  { id: "insights", label: "Insights", href: "/agenda/insights" },
];

function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function postLoginDestination(nextPath: string | null | undefined): string {
  return nextPath ?? DOCTOR_HOME_PATH;
}

export function activeDoctorNavTab(pathname: string): DoctorNavTabId | null {
  const path = normalizePath(pathname);
  if (path === DOCTOR_HOME_PATH) return "dashboard";
  if (path === "/agenda") return "agenda";
  if (path === "/agenda/settings" || path.startsWith("/agenda/settings/")) return "settings";
  if (path === "/agenda/insights" || path.startsWith("/agenda/insights/")) return "insights";
  return null;
}

/**
 * Doctor product pages: login-gated in middleware and shown with the sticky
 * doctor header. The appointment review page (/dashboard/appointments/…) is a
 * distraction-free flow with its own auth handling, so it is not included.
 */
export function isDoctorProductPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === DOCTOR_HOME_PATH || path === "/agenda" || path.startsWith("/agenda/");
}
