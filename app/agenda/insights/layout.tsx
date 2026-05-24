import { NextIntlClientProvider } from "next-intl";

import { practiceInsightsClientMessages } from "@/lib/practice-insights-i18n";

export default function PracticeInsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider locale="en" messages={practiceInsightsClientMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
