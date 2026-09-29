import { isUndeliverableTestEmail } from "@/lib/registration-decision-emails";

/**
 * What the Requests tab shows. Requests are permanent (never deleted), so rows no
 * founder can act on are left out of the view instead:
 * - a pending request whose applicant login no longer exists can never be approved
 *   (automated test runs delete their logins); it is counted, not shown;
 * - decisions on automated-test addresses (`@integration.test`, `@test-doccy.com.cy`).
 * Real test inboxes (gmail "+" addresses) stay visible.
 */
export function reviewableRegistrationRows<
  T extends { status: string; applicant_auth_user_id: string | null; requester_email: string | null },
>(rows: T[]): { rows: T[]; hiddenPending: number } {
  let hiddenPending = 0;
  const kept = rows.filter((row) => {
    if (row.status === "pending") {
      if (!row.applicant_auth_user_id) {
        hiddenPending += 1;
        return false;
      }
      return true;
    }
    return !isUndeliverableTestEmail(String(row.requester_email ?? ""));
  });
  return { rows: kept, hiddenPending };
}
