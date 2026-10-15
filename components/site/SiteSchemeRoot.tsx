import type { ReactNode } from "react";

import { profileThemeStyle } from "@/lib/profile-theme";
import { getSiteScheme } from "@/lib/site-default-scheme";

/**
 * The themed root of a public page (Finder, home, Clinics, district pages, loading screens):
 * the visitor's Light / Dark choice, else the founders' default, painted by the
 * server so there is no flash. The header's switch flips `data-scheme` in place.
 */
export async function SiteSchemeRoot({ children }: { children: ReactNode }) {
  const scheme = await getSiteScheme();
  return (
    <div className="doccy-profile min-h-screen" data-scheme={scheme} style={profileThemeStyle()}>
      {children}
    </div>
  );
}
