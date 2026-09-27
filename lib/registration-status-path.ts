/**
 * Where a signed-in login goes inside /agenda (no imports: the middleware uses it).
 * A login without a professional profile (registration pending or denied) sees only
 * the Status page; a professional on the Status page goes back to the agenda.
 */

export const REGISTRATION_STATUS_PATH = "/agenda/status";

export function agendaRedirectForLogin(pathname: string, hasProfessional: boolean): string | null {
  const path = pathname.split("?")[0]?.replace(/\/$/, "") || pathname;
  const onStatus = path === REGISTRATION_STATUS_PATH;
  if (hasProfessional) return onStatus ? "/agenda" : null;
  return onStatus ? null : REGISTRATION_STATUS_PATH;
}
