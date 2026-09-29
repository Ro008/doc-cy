/**
 * "See other times" on the reschedule email-link page (/reschedule/[id]).
 *
 * CONTRACT for the backend (not built yet — the frontend already calls it):
 *
 *   POST /api/reschedule/[id]/request-other-time
 *   body: { token: string; appointmentLocal: "YYYY-MM-DDTHH:mm" }   // Cyprus wall clock, like POST /api/appointments
 *
 *   - token must match appointments.reschedule_access_token and the row must be NEEDS_RESCHEDULE
 *     (live or expired proposal) — else 403 / 400.
 *   - the time must be bookable like a public booking (hours, horizon, minimum notice, overlap
 *     via candidateOverlapsAnyBlockingInterval excluding this appointment) — else 409.
 *   - on success, UPDATE the SAME row (no new appointment): status REQUESTED,
 *     appointment_datetime = the chosen time, proposed_slots = [], proposal_expires_at = null,
 *     reschedule_access_token = null, keep patient fields/reason/location. This frees the three
 *     held times and the doctor sees it in "Needs your answer" like any request (1-click approve).
 *   - email the doctor ("<patient> asked for another time") and the patient ("request sent").
 *   - 200 { appointment: { id, appointment_datetime, status: "REQUESTED" } }.
 */
export function rescheduleRequestOtherTimePath(appointmentId: string): string {
  return `/api/reschedule/${encodeURIComponent(appointmentId)}/request-other-time`;
}

/** Patient-facing message for a failed "request this time". */
export function rescheduleOtherTimeErrorMessage(status: number, serverMessage: string | null): string {
  if (status === 404 || status === 405 || status === 501) {
    return "Choosing another time online is not available yet. Please pick one of the times above.";
  }
  if (status === 409) return "That time was just booked. Please choose another one.";
  if (status === 410) return "This link has expired. Please book a new time on the profile.";
  const trimmed = String(serverMessage ?? "").trim();
  return trimmed || "Could not send your request. Please try again.";
}
