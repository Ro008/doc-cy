import { isDoctorProductPath } from "@/lib/doctor-routes";

/**
 * Pages whose URL can carry patient data (a Visits search, a visit id) or a sign-in token
 * (user, 2026-10-12). Google's tag and Vercel's analytics send the full URL of the page, so
 * they stay off there: the doctor's internal area, the emailed sign-in link and the
 * founders' internal area.
 */
export function isPrivateAreaPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.replace(/\/+$/, "") || "/";
  if (isDoctorProductPath(path)) return true;
  return (
    path === "/dashboard/appointments" ||
    path.startsWith("/dashboard/appointments/") ||
    path === "/auth/sign-in-link" ||
    path === "/internal" ||
    path.startsWith("/internal/")
  );
}
