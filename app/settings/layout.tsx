import { EnglishIntlProvider } from "@/components/i18n/EnglishIntlProvider";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <EnglishIntlProvider namespaces={["DoctorAgenda"]}>{children}</EnglishIntlProvider>;
}
