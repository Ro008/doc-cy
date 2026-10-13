"use client";

import * as React from "react";
import {
  Bell,
  Building2,
  CreditCard,
  Lock,
  Megaphone,
  Tags,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  SETTINGS_SECTIONS,
  settingsSectionHref,
  type SettingsSectionId,
} from "@/lib/settings-sections";

const SECTION_ICONS: Record<SettingsSectionId, LucideIcon> = {
  clinics: Building2,
  services: Tags,
  profile: UserRound,
  notifications: Bell,
  promote: Megaphone,
  plan: CreditCard,
  account: Lock,
};

/**
 * Settings sidebar (design B1): the doctor's name, the sections, and Holiday mode at
 * the bottom so it is one tap away from every section. On phones it sits above the
 * content with the sections as a grid of buttons, all six in view (user, 2026-10-12:
 * a row scrolling sideways hid half of them).
 */
export function SettingsSidebar({
  active,
  onSelect,
  header,
  badges,
  footer,
}: {
  active: SettingsSectionId;
  onSelect: (section: SettingsSectionId) => void;
  header: React.ReactNode;
  /** Small counts or dots next to a section (e.g. number of clinics). */
  badges?: Partial<Record<SettingsSectionId, React.ReactNode>>;
  footer: React.ReactNode;
}) {
  return (
    <aside
      data-testid="settings-sidebar"
      className="flex flex-col gap-5 lg:sticky lg:top-20 lg:w-64 lg:shrink-0 lg:self-start"
    >
      <div>{header}</div>
      <nav aria-label="Settings sections">
        <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-7 lg:flex lg:flex-col lg:gap-1">
          {SETTINGS_SECTIONS.map((section, index) => {
            const Icon = SECTION_ICONS[section.id];
            const current = section.id === active;
            // A thin line on wide screens sets account admin apart from the practice.
            const startsAccountGroup =
              "group" in section && !("group" in (SETTINGS_SECTIONS[index - 1] ?? {}));
            const shortLabel = "shortLabel" in section ? section.shortLabel : null;
            return (
              <li
                key={section.id}
                className={`min-w-0${startsAccountGroup ? " lg:mt-2 lg:border-t lg:border-slate-800 lg:pt-3" : ""}`}
              >
                <a
                  href={settingsSectionHref(section.id)}
                  data-settings-section={section.id}
                  aria-current={current ? "page" : undefined}
                  aria-label={shortLabel ? section.label : undefined}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    onSelect(section.id);
                  }}
                  className={`flex h-16 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-2xl px-1 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 lg:h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3.5 lg:text-sm ${
                    current
                      ? "bg-clinical-500/15 text-clinical-50 ring-1 ring-inset ring-clinical-400/40"
                      : "text-slate-300 ring-1 ring-inset ring-slate-700/60 hover:bg-white/5 hover:text-slate-50 lg:ring-0"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  <span className="flex min-w-0 items-center gap-1.5 lg:contents">
                    {shortLabel ? (
                      <>
                        <span className="lg:hidden">{shortLabel}</span>
                        <span className="hidden lg:inline lg:flex-1">{section.label}</span>
                      </>
                    ) : (
                      <span className="lg:flex-1">{section.label}</span>
                    )}
                    {badges?.[section.id] ?? null}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="lg:mt-4">{footer}</div>
    </aside>
  );
}
