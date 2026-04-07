export type PromotePracticeCopy = {
  fabAriaLabel: string;
  closeAriaLabel: string;
  growthLabel: string;
  title: string;
  subtitle: string;
  missingSlugTitle: string;
  missingSlugBody: string;
  patientsScanPrefix: string;
  printButton: string;
  downloadButton: string;
  printHelper: string;
  printPrepareFailed: string;
  printDialogFailed: string;
  printCta: string;
};

const EN_COPY: PromotePracticeCopy = {
  fabAriaLabel: "Promote your practice — booking QR",
  closeAriaLabel: "Close",
  growthLabel: "GROWTH",
  title: "Promote your practice",
  subtitle: "QR for your public booking page — print a sign or download for your clinic.",
  missingSlugTitle: "Promote your practice",
  missingSlugBody:
    "Your public profile link isn't ready yet. Once your profile has a URL slug, you can generate a QR code and print a sign for your clinic.",
  patientsScanPrefix: "Patients scan to open",
  printButton: "Print booking sign",
  downloadButton: "Download QR (PNG)",
  printHelper:
    "Print opens an A5 layout with the DocCy wordmark, your name, QR, and a short call to action — ready for your printer.",
  printPrepareFailed: "Could not prepare print view. Please try again.",
  printDialogFailed: "Could not open the print dialog on this device.",
  printCta: "Scan to book your next appointment",
};

const EL_COPY: PromotePracticeCopy = {
  fabAriaLabel: "Προώθηση του ιατρείου σας — QR κρατήσεων",
  closeAriaLabel: "Κλείσιμο",
  growthLabel: "ΑΝΑΠΤΥΞΗ",
  title: "Προωθήστε το ιατρείο σας",
  subtitle:
    "QR για τη δημόσια σελίδα κρατήσεών σας — εκτυπώστε πινακίδα ή κατεβάστε το για τον χώρο σας.",
  missingSlugTitle: "Προωθήστε το ιατρείο σας",
  missingSlugBody:
    "Ο δημόσιος σύνδεσμος προφίλ σας δεν είναι έτοιμος ακόμη. Μόλις το προφίλ αποκτήσει slug, μπορείτε να δημιουργήσετε QR και να εκτυπώσετε πινακίδα για το ιατρείο σας.",
  patientsScanPrefix: "Οι ασθενείς σκανάρουν για να ανοίξουν",
  printButton: "Εκτύπωση πινακίδας κράτησης",
  downloadButton: "Λήψη QR (PNG)",
  printHelper:
    "Η εκτύπωση ανοίγει διάταξη A5 με το λογότυπο DocCy, το όνομά σας, το QR και σύντομο κάλεσμα για ενέργεια — έτοιμο για εκτύπωση.",
  printPrepareFailed: "Δεν ήταν δυνατή η προετοιμασία για εκτύπωση. Δοκιμάστε ξανά.",
  printDialogFailed: "Δεν ήταν δυνατό να ανοίξει το παράθυρο εκτύπωσης σε αυτή τη συσκευή.",
  printCta: "Σκανάρετε για να κλείσετε το επόμενο ραντεβού σας",
};

export function resolvePromotePracticeCopy(localeLike?: string | null): PromotePracticeCopy {
  const value = String(localeLike ?? "").toLowerCase();
  if (value.startsWith("el") || value.startsWith("gr")) return EL_COPY;
  return EN_COPY;
}
