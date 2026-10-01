/**
 * TEMPORARY (remove once Livio ships these endpoints; docs/handoff/settings-redesign.md).
 *
 * Settings calls a few endpoints the backend does not have yet: we build the frontend
 * first and Livio implements the contract. Until then the route is missing (404/405),
 * and the doctor sees that the failure is expected and what it is waiting for,
 * instead of a generic error that looks like a bug.
 */

export const BACKEND_PENDING = {
  removeSpecialty: { what: "removing a specialty", endpoint: "DELETE /api/doctor-specialties" },
  addClinic: { what: "adding a clinic", endpoint: "POST /api/clinic-requests" },
  removeClinic: { what: "removing a clinic", endpoint: "DELETE /api/professional-clinics" },
  clinicChangeRequest: { what: "requesting a clinic change", endpoint: "POST /api/clinic-change-requests" },
  notificationSettings: {
    what: "saving notification settings",
    endpoint: "PUT /api/doctor-notification-settings",
  },
  cancelSpecialtyRequest: {
    what: "cancelling a specialty request",
    endpoint: "DELETE /api/doctor-specialty-change-request",
  },
} as const;

export type BackendPendingAction = keyof typeof BACKEND_PENDING;

export function backendPendingMessage(action: BackendPendingAction): string {
  const { what, endpoint } = BACKEND_PENDING[action];
  return `Expected to fail for now: ${what} works once Livio builds it in the backend (${endpoint}).`;
}

export function settingsActionErrorMessage(
  action: BackendPendingAction,
  status: number,
  body: { message?: unknown } | null | undefined,
  fallback: string,
): string {
  if (status === 404 || status === 405) return backendPendingMessage(action);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  return message || fallback;
}
