"use client";

import * as React from "react";
import { DesktopNavTabLink } from "@/components/navigation/DesktopNavTabLink";
import { subscribeNavigationPending } from "@/lib/doccy-navigation";
import {
  DOCTOR_NAV_TABS,
  activeDoctorNavTab,
  selectedDoctorNavTab,
  type DoctorNavTabId,
} from "@/lib/doctor-routes";

type PillBox = { left: number; width: number };

/**
 * Doctor section tabs with one teal pill that slides to the clicked tab right
 * away and shimmers until the page arrives.
 */
export function DesktopNavTabs({
  pathname,
  badges = {},
}: {
  pathname: string;
  badges?: Partial<Record<DoctorNavTabId, string | null>>;
}) {
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  React.useEffect(() => subscribeNavigationPending(setPendingHref), []);

  const activeTab = activeDoctorNavTab(pathname);
  const selectedTab = selectedDoctorNavTab(pathname, pendingHref);
  const loading = selectedTab !== null && selectedTab !== activeTab;

  const tabEls = React.useRef(new Map<DoctorNavTabId, HTMLAnchorElement>());
  const [pill, setPill] = React.useState<PillBox | null>(null);
  // Place the pill without animating on first paint; slide on later changes.
  const [animate, setAnimate] = React.useState(false);

  const measure = React.useCallback(() => {
    const el = selectedTab ? tabEls.current.get(selectedTab) : undefined;
    setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  }, [selectedTab]);

  React.useLayoutEffect(() => {
    measure();
  }, [measure, badges.dashboard]);

  React.useEffect(() => {
    const id = window.requestAnimationFrame(() => setAnimate(true));
    const observer = new ResizeObserver(() => measure());
    tabEls.current.forEach((el) => observer.observe(el));
    return () => {
      window.cancelAnimationFrame(id);
      observer.disconnect();
    };
  }, [measure]);

  return (
    <nav aria-label="Doctor sections" className="relative flex items-center gap-1">
      {pill ? (
        <span
          aria-hidden
          data-testid="userbar-nav-pill"
          className={`absolute left-0 top-0 h-9 overflow-hidden rounded-full border border-clinical-400 bg-clinical-500 shadow-md shadow-clinical-500/30 ${
            animate ? "transition-[transform,width] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none" : ""
          }`}
          style={{ width: pill.width, transform: `translateX(${pill.left}px)` }}
        >
          {loading ? (
            <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.5)_50%,transparent_75%)] bg-[length:200%_100%] motion-safe:animate-shimmer" />
          ) : null}
        </span>
      ) : null}
      {DOCTOR_NAV_TABS.map((tab) => (
        <DesktopNavTabLink
          key={tab.id}
          href={tab.href}
          label={tab.label}
          isActive={activeTab === tab.id}
          isSelected={selectedTab === tab.id}
          badge={badges[tab.id] ?? null}
          tabRef={(el) => {
            if (el) tabEls.current.set(tab.id, el);
            else tabEls.current.delete(tab.id);
          }}
          data-testid={`userbar-nav-${tab.id}`}
        />
      ))}
    </nav>
  );
}
