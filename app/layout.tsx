// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import "./globals.css";
import "sonner/dist/styles.css";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { NavigationProgressBar } from "@/components/navigation/NavigationProgressBar";
import { UserBar } from "@/components/navigation/UserBar";
import { AuthAboutFooter } from "@/components/navigation/AuthAboutFooter";
import { ResponsiveBottomInset } from "@/components/navigation/ResponsiveBottomInset";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
  verification: {
    google: "7STpFNfbIxl-9gf32k1tVq5RZUNYRK75Tw_qATGBXVQ",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B7BB5",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();
  const locale = headers().get("x-next-intl-locale") ?? "en";
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialUserBarState = {
    isLoggedIn: false,
    email: null as string | null,
    doctorSlug: null as string | null,
    doctorName: null as string | null,
    avatarUrl: null as string | null,
  };

  if (user) {
    const { data: doctorRow } = await supabase
      .from("doctors")
      .select("slug, name, avatar_url")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const avatarPath = String(
      (doctorRow as { avatar_url?: string | null } | null)?.avatar_url ?? ""
    ).trim();
    const avatarUrl = avatarPath
      ? supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl
      : null;

    initialUserBarState = {
      isLoggedIn: true,
      email: user.email ?? null,
      doctorSlug: typeof doctorRow?.slug === "string" ? doctorRow.slug : null,
      doctorName: typeof doctorRow?.name === "string" ? doctorRow.name : null,
      avatarUrl,
    };
  }

  return (
    <html lang={locale}>
      <body
        className={`${inter.variable} min-h-screen bg-slate-950 text-slate-900 antialiased`}
      >
        <NavigationProgressBar />
        <NextIntlClientProvider messages={messages}>
          <UserBar initialSessionState={initialUserBarState} />
          <ResponsiveBottomInset enabled={Boolean(user)}>
            {children}
            <AuthAboutFooter visible={Boolean(user)} />
          </ResponsiveBottomInset>
        </NextIntlClientProvider>
        <Toaster richColors position="top-center" closeButton />
        <InstallBanner />
        <FeedbackWidget />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
