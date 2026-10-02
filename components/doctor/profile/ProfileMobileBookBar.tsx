"use client";

import * as React from "react";
import { useDoctorSession } from "@/components/navigation/DoctorSessionProvider";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";

type Props = {
  /** "Next: Mon 5 Oct · 09:00", or null when there is no free time online. */
  next: string | null;
  cta: string;
};

/**
 * Phones only: once the hero's booking card has scrolled away, a bar keeps
 * "Request appointment" at hand (as on the big booking sites). It hides again while
 * the booking calendar itself is on screen. Sits above the pro tab bar when shown.
 */
export function ProfileMobileBookBar({ next, cta }: Props) {
  const [visible, setVisible] = React.useState(false);
  const { showProChrome } = useDoctorSession();

  React.useEffect(() => {
    const hero = document.querySelector("[data-testid='profile-next-availability']");
    const book = document.getElementById(PROFILE_SECTION_IDS.book);
    if (!hero || !book || typeof IntersectionObserver === "undefined") return;
    let heroInView = true;
    let bookInView = false;
    const update = () => setVisible(!heroInView && !bookInView);
    // Any bit of the hero's booking card on screen is enough to hide the bar.
    const heroObserver = new IntersectionObserver(([entry]) => {
      heroInView = entry.isIntersecting;
      update();
    });
    // The calendar only counts once it fills the middle of the screen, not when its
    // last pixels peek out under the sticky tabs.
    const bookObserver = new IntersectionObserver(
      ([entry]) => {
        bookInView = entry.isIntersecting;
        update();
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );
    heroObserver.observe(hero);
    bookObserver.observe(book);
    return () => {
      heroObserver.disconnect();
      bookObserver.disconnect();
    };
  }, []);

  return (
    <div
      data-testid="profile-mobile-book-bar"
      data-visible={visible ? "true" : "false"}
      aria-hidden={!visible}
      className={`fixed inset-x-0 z-30 border-t border-profile-border bg-profile-surface px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition duration-300 lg:hidden ${
        showProChrome ? "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))]" : "bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
      } ${visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"}`}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        {next ? (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-profile-text">{next}</span>
        ) : (
          <span className="flex-1" />
        )}
        <a
          href={`#${PROFILE_SECTION_IDS.book}`}
          tabIndex={visible ? undefined : -1}
          className="inline-flex min-h-12 shrink-0 items-center rounded-2xl bg-accent-cta px-5 text-[15px] font-extrabold text-accent-on-cta transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {cta}
        </a>
      </div>
    </div>
  );
}
