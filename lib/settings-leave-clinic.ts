/**
 * The words of the "Leave clinic" dialog in Settings (user, 2026-10-11). Leaving needs
 * no founder and never cancels a visit: confirmed visits stay, and requests waiting for
 * her answer can still be accepted or declined, but no other times can be suggested
 * once her hours at the clinic are gone.
 */

export const LEAVE_CLINIC_LOSES =
  "Patients won’t find you at this clinic any more, and your hours, slot length and booking limits there are removed. The clinic itself stays in DocCy.";

export type ClinicUpcomingCounts = { confirmed: number; open: number };

export function leaveClinicNotes(counts: ClinicUpcomingCounts): string[] {
  const notes: string[] = [];
  if (counts.confirmed === 1) notes.push("1 confirmed visit at this clinic stays in your agenda.");
  if (counts.confirmed > 1) notes.push(`${counts.confirmed} confirmed visits at this clinic stay in your agenda.`);
  if (counts.open === 1) {
    notes.push(
      "1 request at this clinic is waiting for your answer. After you leave, you can only accept or decline it. To suggest other times, do it before leaving.",
    );
  }
  if (counts.open > 1) {
    notes.push(
      `${counts.open} requests at this clinic are waiting for your answer. After you leave, you can only accept or decline them. To suggest other times, do it before leaving.`,
    );
  }
  return notes;
}
