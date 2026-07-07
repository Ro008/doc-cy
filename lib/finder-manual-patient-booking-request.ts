export type PatientBookingRequestResult =
  | { ok: true; duplicate?: boolean }
  | { ok: false; reason?: string; status: number };

export function patientBookingRequestErrorMessage(
  reason: string | undefined,
  status: number,
): string {
  if (status === 503 || reason === "service_role_not_configured") {
    return "This action is not available on this server (missing configuration).";
  }
  if (reason === "manual_not_found") {
    return "This listing is no longer available.";
  }
  if (reason === "invalid_manual_id") {
    return "Something went wrong with this card. Please refresh the page.";
  }
  if (reason === "dedupe_lookup_failed") {
    return "We could not record your vote. Please try again.";
  }
  if (reason === "table_missing") {
    return "This feature is not active yet: the database needs the latest DocCy migration (table directory_manual_patient_booking_requests).";
  }
  if (reason === "insert_failed" || reason === "permission_denied") {
    return "We could not save your vote. If you run DocCy, apply pending Supabase migrations and try again.";
  }
  return "Could not record your vote. Please try again.";
}

export async function submitPatientBookingRequest(
  manualId: string,
): Promise<PatientBookingRequestResult> {
  try {
    const res = await fetch("/api/directory-manual/patient-booking-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manualId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      reason?: string;
      duplicate?: boolean;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, reason: data.reason, status: res.status };
    }
    return { ok: true, duplicate: data.duplicate };
  } catch {
    return { ok: false, status: 0 };
  }
}
