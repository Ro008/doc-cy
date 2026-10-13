import { getPublicBookingBaseUrl } from "@/lib/site-url";
import { EMAIL_INLINE_CTA_BTN } from "@/lib/email-brand";

export function buildPublicProfileUrl(slug: string): string {
  const base = getPublicBookingBaseUrl();
  return `${base}/${encodeURIComponent(slug)}`;
}

export type PromoteLanguage = "en" | "el";

/** The language she picks for the sign and scripts (user, 2026-10-11); English unless Greek. */
export function parsePromoteLanguage(value: string | null | undefined): PromoteLanguage {
  return isGreek(value) ? "el" : "en";
}

function isGreek(localeLike: string | null | undefined): boolean {
  const value = String(localeLike ?? "").toLowerCase();
  return value.startsWith("el") || value.startsWith("gr");
}

/**
 * Heard, not read: it names her and the site, since a long address is hard to catch
 * on a recording.
 */
export function buildVoicemailScriptText(
  localeLike: string | null | undefined,
  who: { name: string; siteHost: string }
): string {
  if (isGreek(localeLike)) {
    return `Το ιατρείο μας είναι κλειστό αυτή τη στιγμή. Για να δείτε διαθέσιμες ώρες και να ζητήσετε ραντεβού online, αναζητήστε «${who.name}» στο ${who.siteHost}. Σας ευχαριστούμε.`;
  }
  return `Our clinic is currently closed. To see available times and request an appointment online, search for ${who.name} on ${who.siteHost}. Thank you.`;
}

/** Spoken by her team, so it names her instead of saying "my". */
export function buildReceptionScriptText(
  localeLike: string | null | undefined,
  who: { name: string; bookingUrl: string }
): string {
  if (isGreek(localeLike)) {
    return `Σας κλείνω το ραντεβού για [ημέρα] στις [ώρα], [όνομα ασθενούς]. Για την επόμενη επίσκεψη, μπορείτε να δείτε τις διαθέσιμες ώρες για ${who.name} και να ζητήσετε ραντεβού online στο ${who.bookingUrl}, χωρίς να περιμένετε στη γραμμή.`;
  }
  return `I've booked you for [day] at [time], [patient name]. For your next visit, you can see ${who.name}'s available times and book online at ${who.bookingUrl}, without calling and waiting on hold.`;
}

/** The message that goes with her link on WhatsApp and Viber (Telegram: below). */
export function buildShareMessage(
  localeLike: string | null | undefined,
  name: string,
  bookingUrl: string
): string {
  return `${shareSentence(localeLike, name)}: ${bookingUrl}`;
}

function shareSentence(localeLike: string | null | undefined, name: string): string {
  return isGreek(localeLike) ? `Κλείστε ραντεβού online με ${name}` : `Book an appointment with ${name} online`;
}

/** Telegram takes the link and the sentence apart, and shows the link first. */
export function buildTelegramShareUrl(
  localeLike: string | null | undefined,
  name: string,
  bookingUrl: string
): string {
  return `https://t.me/share/url?url=${encodeURIComponent(bookingUrl)}&text=${encodeURIComponent(shareSentence(localeLike, name))}`;
}

export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildViberShareUrl(text: string): string {
  return `viber://forward?text=${encodeURIComponent(text)}`;
}

export function websiteButtonLabel(localeLike: string | null | undefined): string {
  return isGreek(localeLike) ? "Κράτηση online" : "Book appointment online";
}

export function buildWebsiteButtonHtml(
  bookingUrl: string,
  localeLike?: string | null
): string {
  const safeUrl = bookingUrl.replace(/"/g, "&quot;");
  return `<a href="${safeUrl}" style="${EMAIL_INLINE_CTA_BTN}">${websiteButtonLabel(localeLike)}</a>`;
}
