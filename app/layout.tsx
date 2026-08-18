// app/layout.tsx
import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import "sonner/dist/styles.css";
import { NavigationProgressBar } from "@/components/navigation/NavigationProgressBar";
import { AppChrome } from "@/components/navigation/AppChrome";
import { trafficSessionPersistInlineScript } from "@/lib/traffic-log";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAdsTag } from "@/components/analytics/GoogleAdsTag";
import { googleAdsTagId } from "@/lib/google-ads";

const InstallBanner = dynamic(
  () => import("@/components/pwa/InstallBanner").then((mod) => mod.InstallBanner),
  { ssr: false },
);

const CookieConsentBar = dynamic(
  () =>
    import("@/components/analytics/CookieConsentBar").then((mod) => mod.CookieConsentBar),
  { ssr: false },
);

const FeedbackWidget = dynamic(
  () =>
    import("@/components/feedback/FeedbackWidget").then((mod) => mod.FeedbackWidget),
  { ssr: false },
);

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
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  verification: {
    google: "7STpFNfbIxl-9gf32k1tVq5RZUNYRK75Tw_qATGBXVQ",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12B8C0",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} min-h-screen bg-slate-950 text-slate-900 antialiased`}
      >
        <GoogleAdsTag />
        <script
          dangerouslySetInnerHTML={{ __html: trafficSessionPersistInlineScript() }}
        />
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>
        <AppChrome>{children}</AppChrome>
        <Toaster richColors position="top-center" closeButton />
        <InstallBanner />
        <CookieConsentBar adsTagEnabled={Boolean(googleAdsTagId())} />
        <FeedbackWidget />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
