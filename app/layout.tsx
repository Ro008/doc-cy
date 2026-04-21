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
import { NavigationProgressBar } from "@/components/navigation/NavigationProgressBar";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "DocCy | Smart Booking Assistant for Clinics in Cyprus",
  description:
    "The future of clinic management in Cyprus. Streamline your appointments with DocCy's digital booking assistant. Designed for modern healthcare and wellness providers.",
  keywords: [
    "clinic management software Cyprus",
    "medical booking system Paphos",
    "doctor appointment assistant",
    "DocCy",
  ],
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "DocCy - Upgrade Your Clinic's Booking Experience",
    description:
      "The future of clinic management in Cyprus. Streamline your appointments with DocCy's digital booking assistant. Designed for modern healthcare and wellness providers.",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/showcase/16-premium-storefront.png",
        alt: "DocCy clinic booking experience preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DocCy - Upgrade Your Clinic's Booking Experience",
    description:
      "The future of clinic management in Cyprus. Streamline your appointments with DocCy's digital booking assistant. Designed for modern healthcare and wellness providers.",
    images: ["/showcase/16-premium-storefront.png"],
  },
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
  width: "device-width",
  initialScale: 1,
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
        <NavigationProgressBar />
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
