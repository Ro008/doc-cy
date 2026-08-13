import { EnglishIntlProvider } from "@/components/i18n/EnglishIntlProvider";

export default function AgendaLayout({ children }: { children: React.ReactNode }) {
  return <EnglishIntlProvider namespaces={["DoctorAgenda"]}>{children}</EnglishIntlProvider>;
}
