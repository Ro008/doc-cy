import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
  UserRound,
} from "lucide-react";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import {
  PRO_CHROME_BOOT_AVATAR_ID,
  PRO_CHROME_BOOT_STICKY_ID,
  PRO_CHROME_BOOT_TABS_ID,
} from "@/lib/pro-session-hint";
import { DOCTOR_HOME_PATH, DOCTOR_NAV_TABS, type DoctorNavTabId } from "@/lib/doctor-routes";

const BOOT_TAB_ICONS: Record<DoctorNavTabId, typeof CalendarDays> = {
  dashboard: LayoutDashboard,
  agenda: CalendarDays,
  settings: Settings,
  insights: BarChart3,
};

const tabClass =
  "flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium leading-tight text-clinical-100 no-underline sm:text-[11px]";

/**
 * Server HTML stand-in for professional chrome.
 * Visible only when the boot script finds the session hint cookie, and hidden
 * after the interactive UserBar hydrates — so a refresh does not wait on Auth
 * or the page JS bundle.
 */
export function ProChromeBoot() {
  return (
    <>
      <nav
        id={PRO_CHROME_BOOT_TABS_ID}
        aria-label="Professional navigation"
        data-testid="userbar-mobile-tabs-boot"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-ink-900/85 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_28px_rgba(15,31,46,0.55)] backdrop-blur-2xl lg:hidden"
      >
        <div className="relative mx-auto flex max-w-2xl items-stretch justify-between gap-0 px-1 pt-0.5">
          {DOCTOR_NAV_TABS.map((tab) => {
            const Icon = BOOT_TAB_ICONS[tab.id];
            return (
              <a key={tab.id} href={tab.href} className={tabClass}>
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span>{tab.label}</span>
              </a>
            );
          })}
          <a href={DOCTOR_HOME_PATH} className={tabClass}>
            <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden />
            <span>More</span>
          </a>
        </div>
      </nav>

      <a
        id={PRO_CHROME_BOOT_AVATAR_ID}
        href={DOCTOR_HOME_PATH}
        aria-label="Open Dashboard"
        data-testid="userbar-toggle-boot"
        className="inline-flex items-center gap-2 rounded-full border border-clinical-400/45 bg-ink-900/90 px-1.5 py-1 no-underline shadow-sm shadow-ink-900/40"
      >
        <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-ink-800 text-xs font-semibold text-clinical-200 sm:h-9 sm:w-9">
          DC
        </span>
        <UserRound className="hidden h-4 w-4 text-clinical-200/90 sm:inline" aria-hidden />
      </a>

      <header
        id={PRO_CHROME_BOOT_STICKY_ID}
        data-testid="pro-sticky-header-boot"
        className="sticky top-0 z-50 border-b border-clinical-400/15 bg-ink-900/90 shadow-sm shadow-ink-900/25 backdrop-blur-md"
      >
        <div className="mx-auto flex h-14 max-w-[1920px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-6">
            <a href={DOCTOR_HOME_PATH} className="inline-flex shrink-0 no-underline">
              <DocCyWordmark variant="dark" />
            </a>
            <nav aria-label="Doctor sections" className="flex items-center gap-1">
              {DOCTOR_NAV_TABS.map((tab) => (
                <a
                  key={tab.id}
                  href={tab.href}
                  className="inline-flex h-9 items-center rounded-full border border-transparent px-3.5 text-sm font-medium text-clinical-100 no-underline"
                >
                  {tab.label}
                </a>
              ))}
            </nav>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-clinical-400/45 bg-ink-900/90 px-1.5 py-1 shadow-sm shadow-ink-900/40">
            <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-ink-800 text-xs font-semibold text-clinical-200 sm:h-9 sm:w-9">
              DC
            </span>
            <UserRound className="hidden h-4 w-4 text-clinical-200/90 sm:inline" aria-hidden />
          </span>
        </div>
      </header>
    </>
  );
}
