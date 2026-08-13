import { EnglishIntlProvider } from "@/components/i18n/EnglishIntlProvider";

export default function DashboardAppointmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EnglishIntlProvider namespaces={["AppointmentReview"]}>{children}</EnglishIntlProvider>
  );
}
