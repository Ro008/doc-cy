import { getPublicBookingBaseUrl } from "@/lib/site-url";

export function buildPublicProfileUrl(slug: string): string {
  const base = getPublicBookingBaseUrl();
  return `${base}/${encodeURIComponent(slug)}`;
}

export function buildVoicemailScriptText(
  localeLike: string | null | undefined,
  bookingUrl: string
): string {
  const isEl =
    String(localeLike ?? "")
      .toLowerCase()
      .startsWith("el") ||
    String(localeLike ?? "")
      .toLowerCase()
      .startsWith("gr");
  if (isEl) {
    return `Το ιατρείο μας είναι κλειστό αυτή τη στιγμή. Για να δείτε διαθέσιμες ώρες και να κλείσετε ραντεβού online, επισκεφθείτε ${bookingUrl}. Σας ευχαριστούμε.`;
  }
  return `Our clinic is currently closed. To see available appointment times and book online, visit ${bookingUrl}. Thank you.`;
}

export function buildReceptionScriptText(
  localeLike: string | null | undefined,
  bookingUrl: string
): string {
  const isEl =
    String(localeLike ?? "")
      .toLowerCase()
      .startsWith("el") ||
    String(localeLike ?? "")
      .toLowerCase()
      .startsWith("gr");
  if (isEl) {
    return `Σας κλείνω το ραντεβού για [ημέρα] στις [ώρα], [όνομα ασθενούς]. Για την επόμενη επίσκεψη, μπορείτε να δείτε τα διαθέσιμα slots και να κλείσετε online στο ${bookingUrl}, χωρίς να περιμένετε στη γραμμή.`;
  }
  return `I've booked you for [day] at [time], [patient name]. For your next visit, you can see my available times and book online at ${bookingUrl}, without calling and waiting on hold.`;
}

export function buildWebsiteButtonHtml(
  bookingUrl: string,
  localeLike?: string | null
): string {
  const isEl =
    String(localeLike ?? "")
      .toLowerCase()
      .startsWith("el") ||
    String(localeLike ?? "")
      .toLowerCase()
      .startsWith("gr");
  const label = isEl ? "Κράτηση online" : "Book appointment online";
  const safeUrl = bookingUrl.replace(/"/g, "&quot;");
  return `<a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#34d399;color:#0f172a;font-weight:600;text-decoration:none;border-radius:8px;">${label}</a>`;
}

export function buildWebsiteSupportPrefill(
  localeLike: string | null | undefined,
  doctorName: string,
  bookingUrl: string
): string {
  const isEl =
    String(localeLike ?? "")
      .toLowerCase()
      .startsWith("el") ||
    String(localeLike ?? "")
      .toLowerCase()
      .startsWith("gr");
  if (isEl) {
    return `Γεια σας DocCy,\n\nΘα ήθελα βοήθεια να προσθέσουμε ένα κουμπί «Κράτηση online» στον υπάρχοντα ιστότοπό μου.\n\nΠροφίλ: ${doctorName}\nΣύνδεσμος κρατήσεων: ${bookingUrl}\n\nΕυχαριστώ.`;
  }
  return `Hi DocCy team,\n\nI'd like help adding a "Book appointment online" button to my existing website.\n\nProfile: ${doctorName}\nBooking page: ${bookingUrl}\n\nThank you.`;
}
