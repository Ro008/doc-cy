export type PromotePracticeCopy = {
  missingSlugTitle: string;
  missingSlugBody: string;
  bookingLinkLabel: string;
  copyLinkButton: string;
  patientsScanCaption: string;
  printButton: string;
  downloadButton: string;
  printHelper: string;
  printPrepareFailed: string;
  printDialogFailed: string;
  /** `lang` of the printed sign. */
  htmlLang: string;
  signBadge: string;
  signHeadline: string;
  signStepScan: string;
  signStepPick: string;
  signStepConfirm: string;
  signNoApp: string;
  scriptsSectionTitle: string;
  voicemailTitle: string;
  voicemailHint: string;
  receptionTitle: string;
  receptionHint: string;
  websiteTitle: string;
  websiteHint: string;
  websiteButtonLabel: string;
  websiteSendToWebPerson: string;
  websiteFreeHelp: string;
  websiteFreeHelpNote: string;
  websiteContactSupport: string;
  websiteHtmlToggle: string;
  websiteHtmlHint: string;
  copyButton: string;
  copiedButton: string;
  copyFailed: string;
};

const EN_COPY: PromotePracticeCopy = {
  missingSlugTitle: "Promote your practice",
  missingSlugBody:
    "Your public profile link isn't ready yet. Once your profile has a URL slug, you can generate a QR code and print a sign for your clinic.",
  bookingLinkLabel: "Your booking page",
  copyLinkButton: "Copy link",
  patientsScanCaption: "Patients scan to open your booking page.",
  printButton: "Print booking sign",
  downloadButton: "Download QR (PNG)",
  printHelper: "An A5 sign with your name and QR, ready to print.",
  printPrepareFailed: "Could not prepare print view. Please try again.",
  printDialogFailed: "Could not open the print dialog on this device.",
  htmlLang: "en",
  signBadge: "Book online · 24/7",
  signHeadline: "Book your next visit online",
  signStepScan: "Scan the code",
  signStepPick: "Pick a time",
  signStepConfirm: "Get a confirmation",
  signNoApp: "No app needed",
  scriptsSectionTitle: "Phone and website scripts",
  voicemailTitle: "Voicemail message",
  voicemailHint: "Paste this on your clinic phone when you are closed. Edit the wording if you like, then copy.",
  receptionTitle: "Reception script",
  receptionHint:
    "A short line for your team after they book a caller. Replace the placeholders in square brackets.",
  websiteTitle: "Website booking button",
  websiteHint:
    "Send the button label and link below to whoever maintains your website. We do not rebuild your site, we add a booking path.",
  websiteButtonLabel: "Button label",
  websiteSendToWebPerson: "Send this to your web person",
  websiteFreeHelp: "Want us to add it for you?",
  websiteFreeHelpNote:
    "For verified profiles with an existing website, we can add a booking button at no extra cost. Tell us through Support.",
  websiteContactSupport: "Contact Support",
  websiteHtmlToggle: "Show HTML for your web person (optional)",
  websiteHtmlHint: "Only needed if they ask for embed code.",
  copyButton: "Copy text",
  copiedButton: "Copied",
  copyFailed: "Could not copy. Select the text and copy manually.",
};

const EL_COPY: PromotePracticeCopy = {
  missingSlugTitle: "Προωθήστε το ιατρείο σας",
  missingSlugBody:
    "Ο δημόσιος σύνδεσμος προφίλ σας δεν είναι έτοιμος ακόμη. Μόλις το προφίλ αποκτήσει slug, μπορείτε να δημιουργήσετε QR και να εκτυπώσετε πινακίδα για το ιατρείο σας.",
  bookingLinkLabel: "Η σελίδα κρατήσεών σας",
  copyLinkButton: "Αντιγραφή συνδέσμου",
  patientsScanCaption: "Οι ασθενείς σκανάρουν για να ανοίξουν τη σελίδα κρατήσεών σας.",
  printButton: "Εκτύπωση πινακίδας κράτησης",
  downloadButton: "Λήψη QR (PNG)",
  printHelper: "Πινακίδα A5 με το όνομά σας και το QR, έτοιμη για εκτύπωση.",
  printPrepareFailed: "Δεν ήταν δυνατή η προετοιμασία για εκτύπωση. Δοκιμάστε ξανά.",
  printDialogFailed: "Δεν ήταν δυνατό να ανοίξει το παράθυρο εκτύπωσης σε αυτή τη συσκευή.",
  htmlLang: "el",
  signBadge: "Κράτηση online · 24/7",
  signHeadline: "Κλείστε το επόμενο ραντεβού σας online",
  signStepScan: "Σκανάρετε τον κωδικό",
  signStepPick: "Επιλέξτε ώρα",
  signStepConfirm: "Λάβετε επιβεβαίωση",
  signNoApp: "Χωρίς εφαρμογή",
  scriptsSectionTitle: "Σενάρια τηλεφώνου και ιστότοπου",
  voicemailTitle: "Μήνυμα φωνητικού ταχυδρομείου",
  voicemailHint:
    "Επικολλήστε το στο τηλέφωνο του ιατρείου όταν είστε κλειστά. Αλλάξτε τη διατύπωση αν θέλετε και μετά αντιγράψτε.",
  receptionTitle: "Σενάριο υποδοχής",
  receptionHint:
    "Μια σύντομη φράση για την ομάδα σας αφού κλείσει ραντεβού από τηλέφωνο. Αντικαταστήστε τα κενά σε αγκύλες.",
  websiteTitle: "Κουμπί κράτησης στον ιστότοπο",
  websiteHint:
    "Στείλτε την ετικέτα και τον σύνδεσμο παρακάτω σε όποιον συντηρεί τον ιστότοπό σας. Δεν ξαναφτιάχνουμε το site, προσθέτουμε διαδρομή κράτησης.",
  websiteButtonLabel: "Κείμενο κουμπιού",
  websiteSendToWebPerson: "Στείλτε το στον τεχνικό της ιστοσελίδας",
  websiteFreeHelp: "Θέλετε να το προσθέσουμε εμείς;",
  websiteFreeHelpNote:
    "Για επαληθευμένα προφίλ με υπάρχοντα site, μπορούμε να προσθέσουμε κουμπί κράτησης χωρίς επιπλέον κόστος. Γράψτε μας από το Support.",
  websiteContactSupport: "Επικοινωνία Support",
  websiteHtmlToggle: "Εμφάνιση HTML για τον τεχνικό (προαιρετικό)",
  websiteHtmlHint: "Μόνο αν ζητήσουν κώδικα ενσωμάτωσης.",
  copyButton: "Αντιγραφή",
  copiedButton: "Αντιγράφηκε",
  copyFailed: "Δεν ήταν δυνατή η αντιγραφή. Επιλέξτε το κείμενο χειροκίνητα.",
};

export function resolvePromotePracticeCopy(localeLike?: string | null): PromotePracticeCopy {
  const value = String(localeLike ?? "").toLowerCase();
  if (value.startsWith("el") || value.startsWith("gr")) return EL_COPY;
  return EN_COPY;
}
