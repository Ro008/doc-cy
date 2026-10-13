import { isUndeliverableTestEmail } from "@/lib/registration-decision-emails";

/**
 * What the Requests tab shows. Requests are permanent (never deleted), so rows are
 * left out of the main view instead:
 * - a pending request whose applicant login no longer exists can never be approved.
 *   A real applicant's goes to `unapprovable` (the "Can't be approved" group, where
 *   founders close it); one made by an automated test run is only counted in
 *   `hiddenPending` (test runs delete their logins);
 * - decisions on automated-test addresses (`@integration.test`, `@test-doccy.com.cy`)
 *   are not shown.
 * Real test inboxes (gmail "+" addresses) stay visible.
 */
export function reviewableRegistrationRows<
  T extends { status: string; applicant_auth_user_id: string | null; requester_email: string | null },
>(rows: T[]): { rows: T[]; unapprovable: T[]; hiddenPending: number } {
  const unapprovable: T[] = [];
  let hiddenPending = 0;
  const kept = rows.filter((row) => {
    if (row.status === "pending") {
      if (row.applicant_auth_user_id) return true;
      if (isUndeliverableTestEmail(String(row.requester_email ?? ""))) hiddenPending += 1;
      else unapprovable.push(row);
      return false;
    }
    return !isUndeliverableTestEmail(String(row.requester_email ?? ""));
  });
  return { rows: kept, unapprovable, hiddenPending };
}
