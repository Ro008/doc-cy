// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { headers } from "next/headers";
import "./globals.css";
import "sonner/dist/styles.css";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { PromotePracticeFab } from "@/components/dashboard/PromotePracticeFab";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DocCy | Healthcare Appointments in Cyprus",
  description: "Book healthcare appointments in Cyprus via DocCy.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DocCy",
  },
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();
  const locale = headers().get("x-next-intl-locale") ?? "en";

  return (
    <html lang={locale}>
      <body
        className={`${inter.variable} min-h-screen bg-slate-50 text-slate-900 antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Toaster richColors position="top-center" closeButton />
        <InstallBanner />
        <PromotePracticeFab />
        <FeedbackWidget />
      </body>
    </html>
  );
}
