// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { headers } from "next/headers";
import "./globals.css";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { PromotePracticeFab } from "@/components/dashboard/PromotePracticeFab";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DocCy | Healthcare Appointments in Cyprus",
  description:
    "Book healthcare appointments in Cyprus via DocCy.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  const locale = headers().get("x-next-intl-locale") ?? "en";

  return (
    <html lang={locale}>
      <body
        className={`${inter.variable} min-h-screen bg-slate-50 text-slate-900 antialiased`}
      >
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        <PromotePracticeFab />
        <FeedbackWidget />
      </body>
    </html>
  );
}

