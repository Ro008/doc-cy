"use client";

import { AuthAboutFooter } from "@/components/navigation/AuthAboutFooter";
import {
  DoctorSessionProvider,
  useDoctorSession,
} from "@/components/navigation/DoctorSessionProvider";
import { HtmlLang } from "@/components/navigation/HtmlLang";
import { ResponsiveBottomInset } from "@/components/navigation/ResponsiveBottomInset";
import { UserBar } from "@/components/navigation/UserBar";

function AppChromeInner({ children }: { children: React.ReactNode }) {
  const { sessionState, showProChrome } = useDoctorSession();

  return (
    <>
      <HtmlLang />
      <UserBar />
      <ResponsiveBottomInset enabled={showProChrome}>
        {children}
        <AuthAboutFooter visible={sessionState.isLoggedIn} />
      </ResponsiveBottomInset>
    </>
  );
}

/** Logged-out first paint; session is resolved on the client after HTML. */
export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <DoctorSessionProvider>
      <AppChromeInner>{children}</AppChromeInner>
    </DoctorSessionProvider>
  );
}
