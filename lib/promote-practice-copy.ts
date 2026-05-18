export type PromotePracticeCopy = {
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
  title: "Promote your practice",
  subtitle: "QR, phone scripts, and your booking link in one place.",
  missingSlugTitle: "Promote your practice",
  missingSlugBody:
    "Your public profile link isn't ready yet. Once your profile has a URL slug, you can generate a QR code and print a sign for your clinic.",
  patientsScanPrefix: "Patients scan to open",
  printButton: "Print booking sign",
  downloadButton: "Download QR (PNG)",
  printHelper:
    "Print opens an A5 layout with the DocCy wordmark, your name, QR, and a short call to action, ready for your printer.",
  printPrepareFailed: "Could not prepare print view. Please try again.",
  printDialogFailed: "Could not open the print dialog on this device.",
  printCta: "Scan to book your next appointment",
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
  title: "Προωθήστε το ιατρείο σας",
  subtitle: "QR, σενάρια τηλεφώνου και σύνδεσμος κρατήσεων σε ένα σημείο.",
  missingSlugTitle: "Προωθήστε το ιατρείο σας",
  missingSlugBody:
    "Ο δημόσιος σύνδεσμος προφίλ σας δεν είναι έτοιμος ακόμη. Μόλις το προφίλ αποκτήσει slug, μπορείτε να δημιουργήσετε QR και να εκτυπώσετε πινακίδα για το ιατρείο σας.",
  patientsScanPrefix: "Οι ασθενείς σκανάρουν για να ανοίξουν",
  printButton: "Εκτύπωση πινακίδας κράτησης",
  downloadButton: "Λήψη QR (PNG)",
  printHelper:
    "Η εκτύπωση ανοίγει διάταξη A5 με το λογότυπο DocCy, το όνομά σας, το QR και σύντομο κάλεσμα για ενέργεια, έτοιμο για εκτύπωση.",
  printPrepareFailed: "Δεν ήταν δυνατή η προετοιμασία για εκτύπωση. Δοκιμάστε ξανά.",
  printDialogFailed: "Δεν ήταν δυνατό να ανοίξει το παράθυρο εκτύπωσης σε αυτή τη συσκευή.",
  printCta: "Σκανάρετε για να κλείσετε το επόμενο ραντεβού σας",
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
