import { EnglishIntlProvider } from "@/components/i18n/EnglishIntlProvider";

export default function ForProfessionalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EnglishIntlProvider namespaces={["LandingPage"]}>{children}</EnglishIntlProvider>;
}
