/**
 * TEMPORARY (remove once Livio ships the endpoint; docs/handoff/settings-redesign.md).
 *
 * Settings › Notifications calls an endpoint the backend does not have yet: the frontend
 * came first and Livio implements the contract. Until then the route is missing (404/405),
 * and the professional sees that the failure is expected and what it is waiting for,
 * instead of a generic error that looks like a bug.
 */

export const BACKEND_PENDING = {
  notificationSettings: {
    what: "saving notification settings",
    endpoint: "PUT /api/doctor-notification-settings",
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
