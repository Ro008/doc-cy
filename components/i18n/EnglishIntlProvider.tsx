import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import en from "@/messages/en.json";

type EnNamespace = keyof typeof en;

export function pickEnglishMessages<K extends EnNamespace>(
  namespaces: readonly K[],
): Pick<typeof en, K> {
  const messages = {} as Pick<typeof en, K>;
  for (const ns of namespaces) {
    messages[ns] = en[ns];
  }
  return messages;
}

/** Client provider with only the namespaces that page needs (English product chrome). */
export function EnglishIntlProvider({
  namespaces,
  children,
}: {
  namespaces: readonly EnNamespace[];
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider locale="en" messages={pickEnglishMessages(namespaces)}>
      {children}
    </NextIntlClientProvider>
  );
}
