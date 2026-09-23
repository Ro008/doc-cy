export type RegisterFaqItem = {
  question: string;
  answer: string;
};

/**
 * Questions shown under the /register form. DocCy does not sync with external
 * calendars: confirmed bookings email "Add to Google Calendar" and
 * "Add to Apple / Outlook (.ics)" buttons to both sides — keep answers to that.
 */
export const REGISTER_FAQ_ITEMS: readonly RegisterFaqItem[] = [
  {
    question: "Is the 6-month trial really free?",
    answer:
      "Your public profile is free forever, with no listing fee. Online booking (agenda and 1-click approval) is free for 6 full months, with no credit card to sign up. After that, Founding Members keep booking at €19/month.",
  },
  {
    question: "Will DocCy create double bookings or extra work?",
    answer:
      "No. DocCy is your single source of truth. When a patient calls, add the visit to your panel in about 5 seconds and the slot is blocked on your public profile straight away.",
  },
  {
    question: "How does 1-click approval protect my agenda?",
    answer:
      "Every request arrives with the patient's name, requested time and reason for consultation. Nothing enters your agenda without your explicit approval.",
  },
  {
    question: "Can I see bookings in my own calendar?",
    answer:
      "Yes. When a booking is confirmed, you and your patient each get an email with buttons to add it to Google Calendar or Apple / Outlook. Your DocCy agenda stays the place to manage changes.",
  },
  {
    question: "How do I get my current patients to book online?",
    answer:
      "Print a QR code for your reception desk or share your booking link. Patients can then request a slot whenever suits them.",
  },
  {
    question: "I use a paper diary or another tool. Is it hard to switch?",
    answer:
      "Setup takes less than 5 minutes. Prefer a hands-off start? Book a free 15-minute call: we register you and walk you through the site.",
  },
  {
    question: "What if the Founding Members Club is full?",
    answer:
      "New sign-ups move to standard pricing at €49/month. Your public profile stays free forever either way.",
  },
];
