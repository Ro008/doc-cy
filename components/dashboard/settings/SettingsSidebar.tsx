"use client";

import * as React from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  CreditCard,
  Lock,
  Megaphone,
  Phone,
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
  availability: CalendarDays,
  clinics: Building2,
  services: Tags,
  profile: UserRound,
  contact: Phone,
  notifications: Bell,
  promote: Megaphone,
  plan: CreditCard,
  account: Lock,
};

/**
 * Settings sidebar (design B1): the doctor's name, the sections, and Holiday mode at
 * the bottom so it is one tap away from every section. On phones it sits above the
 * content with the sections as a scrolling row.
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
      <nav aria-label="Settings sections" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-1.5 lg:flex-col lg:gap-1">
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = SECTION_ICONS[section.id];
            const current = section.id === active;
            return (
              <li key={section.id} className="shrink-0">
                <a
                  href={settingsSectionHref(section.id)}
                  data-settings-section={section.id}
                  aria-current={current ? "page" : undefined}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    onSelect(section.id);
                  }}
                  className={`flex h-11 items-center gap-3 whitespace-nowrap rounded-2xl px-3.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 ${
                    current
                      ? "bg-clinical-500/15 text-clinical-50 ring-1 ring-inset ring-clinical-400/40"
                      : "text-slate-300 hover:bg-white/5 hover:text-slate-50"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  <span className="lg:flex-1">{section.label}</span>
                  {badges?.[section.id] ?? null}
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
