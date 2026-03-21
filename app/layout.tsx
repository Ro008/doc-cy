// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { PromotePracticeFab } from "@/components/dashboard/PromotePracticeFab";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DocCy: Smart Medical Appointments in Cyprus",
  description:
    "A simple platform for clinics and doctors in Cyprus to manage their medical appointments online.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} min-h-screen bg-slate-50 text-slate-900 antialiased`}
      >
        {children}
        <PromotePracticeFab />
        <FeedbackWidget />
      </body>
    </html>
  );
}

