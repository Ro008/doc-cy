"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Languages, Loader2, Star, Users, X } from "lucide-react";
import { GesyProviderBadge } from "@/components/brand/GesyProviderBadge";
import { BookingSection } from "@/components/doctor/BookingSection";
import { ProfileBookingStepProvider } from "@/components/doctor/profile/ProfileBookingStep";
import { ProfileClinicChooser } from "@/components/doctor/profile/ProfileClinicChooser";
import { PendingLink } from "@/components/navigation/PendingLink";
import { HideInstallBanner } from "@/components/pwa/HideInstallBanner";
import { RevealMobileButton } from "@/components/doctor/profile/RevealMobileButton";
import {
  FINDER_POPUP_HISTORY_KEY,
  finderPopupChooserRows,
  finderPopupInitialClinicId,
  type FinderPopupData,
  type FinderPopupProfessional,
} from "@/lib/finder-profile-popup";
import { harmonizeFinderSpecialtyList } from "@/lib/finder-specialty-harmonize";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { requestProfileServiceSelect } from "@/lib/public/profile-booking-events";

/** Service chips shown before "Show all". */
const FINDER_POPUP_SERVICES_SHOWN = 6;

type OpenRequest = { locationId: string | null; slotKey: string | null };
type Current = OpenRequest & { professional: FinderPopupProfessional };

type PopupApi = { open: (professional: FinderPopupProfessional, request: OpenRequest) => void };

const PopupContext = React.createContext<PopupApi | null>(null);
const CardContext = React.createContext<{ professional: FinderPopupProfessional; locationId: string | null } | null>(
  null,
);

/**
 * The Finder's profile pop-up (mockup F; user, 2026-10-17). Every card link to more about a
 * registered professional (her name, photo, All times, a time) opens her profile over the
 * Finder: her hero on the teal band, her services, "Choose a clinic", the calendar and the
 * booking form, so the patient books without leaving the results. A time picked on the card
 * opens the booking form at once. Back closes the pop-up; the Finder under it stays put.
 */
export function FinderProfilePopupProvider({
  children,
  detailsAside,
  professionalNotice,
  ownProfileNotice,
}: {
  children: React.ReactNode;
  /** "What to expect", next to the booking form (drawn on the server). */
  detailsAside: React.ReactNode;
  /** Instead of the calendar for a signed-in professional or applicant (as on the profile). */
  professionalNotice: React.ReactNode;
  ownProfileNotice: React.ReactNode;
}) {
  const [current, setCurrent] = React.useState<Current | null>(null);

  // Its own history entry (same address), so Back closes it instead of leaving the Finder.
  const open = React.useCallback((professional: FinderPopupProfessional, request: OpenRequest) => {
    const state = (window.history.state ?? {}) as Record<string, unknown>;
    if (!state[FINDER_POPUP_HISTORY_KEY]) {
      window.history.pushState({ ...state, [FINDER_POPUP_HISTORY_KEY]: professional.slug }, "", window.location.href);
    }
    setCurrent({ professional, ...request });
  }, []);

  const close = React.useCallback(() => {
    const state = (window.history.state ?? {}) as Record<string, unknown>;
    if (state[FINDER_POPUP_HISTORY_KEY]) window.history.back();
    else setCurrent(null);
  }, []);

  React.useEffect(() => {
    const onPop = () => {
      const state = (window.history.state ?? {}) as Record<string, unknown>;
      if (!state[FINDER_POPUP_HISTORY_KEY]) setCurrent(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const api = React.useMemo(() => ({ open }), [open]);

  return (
    <PopupContext.Provider value={api}>
      {children}
      {current ? (
        <FinderProfilePopup
          key={`${current.professional.slug}|${current.locationId ?? ""}|${current.slotKey ?? ""}`}
          current={current}
          onClose={close}
          detailsAside={detailsAside}
          professionalNotice={professionalNotice}
          ownProfileNotice={ownProfileNotice}
        />
      ) : null}
    </PopupContext.Provider>
  );
}

/** One registered card: the links inside it open this professional's pop-up. */
export function FinderCardPopupScope({
  professional,
  locationId,
  children,
}: {
  professional: FinderPopupProfessional;
  /** The card's clinic (`professional_clinics.id`): the pop-up opens on it. */
  locationId: string | null;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ professional, locationId }), [professional, locationId]);
  return <CardContext.Provider value={value}>{children}</CardContext.Provider>;
}

/**
 * A real link to her profile (a new tab, a middle click and no JavaScript still work); a
 * plain click inside a registered card opens the pop-up instead. Outside one (a listing),
 * it is the usual link to the page.
 */
export function FinderPopupLink({
  href,
  slotKey = null,
  fill = false,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  href: string;
  /** A time on the card: the pop-up opens straight on the booking form for it. */
  slotKey?: string | null;
  /** Fill a sized parent (the photo tile). */
  fill?: boolean;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  const card = React.useContext(CardContext);
  const popup = React.useContext(PopupContext);
  if (!card || !popup) {
    return (
      <PendingLink href={href} navigationReason="profile" prefetch={false} fill={fill} aria-label={ariaLabel} className={className}>
        {children}
      </PendingLink>
    );
  }
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      className={fill ? `flex ${className ?? ""}` : className}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        popup.open(card.professional, { locationId: card.locationId, slotKey });
      }}
    >
      {children}
    </a>
  );
}

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; data: FinderPopupData };

function FinderProfilePopup({
  current,
  onClose,
  detailsAside,
  professionalNotice,
  ownProfileNotice,
}: {
  current: Current;
  onClose: () => void;
  detailsAside: React.ReactNode;
  professionalNotice: React.ReactNode;
  ownProfileNotice: React.ReactNode;
}) {
  const { professional } = current;
  const t = useTranslations("DoctorProfilePage");
  const bookingT = useTranslations("BookingPage");
  const [host, setHost] = React.useState<Element | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [load, setLoad] = React.useState<Load>({ status: "loading" });
  const [reload, setReload] = React.useState(0);
  const [clinicId, setClinicId] = React.useState<string | null>(null);
  // The card's time is for the card's clinic, once: another clinic starts on its own next time.
  const [slotKey, setSlotKey] = React.useState<string | null>(current.slotKey);
  const [serviceId, setServiceId] = React.useState<string | null>(null);
  // A long list of services would push her calendar down: the first few, then "Show all".
  const [allServices, setAllServices] = React.useState(false);

  React.useEffect(() => {
    setHost(document.querySelector(".doccy-profile") ?? document.body);
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/directory/professional-booking?slug=${encodeURIComponent(professional.slug)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as FinderPopupData | null;
        if (!res.ok || !body?.ok) throw new Error(String(res.status));
        setLoad({ status: "ready", data: body });
        setClinicId((id) => (id && body.clinics.some((c) => c.id === id) ? id : finderPopupInitialClinicId(body.clinics, current.locationId)));
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [professional.slug, current.locationId, reload]);

  // The Finder behind does not scroll while the pop-up is open.
  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Escape closes the pop-up, unless the booking form is open over it (Escape is its own).
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector('[data-testid="profile-booking-dialog"]')) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  React.useEffect(() => {
    if (host) boxRef.current?.focus();
  }, [host]);

  if (!host) return null;

  const profileHref = publicProfessionalProfilePath(professional.slug);
  const pills = harmonizeFinderSpecialtyList([...professional.specialties]);
  const data = load.status === "ready" ? load.data : null;
  const clinic = data?.clinics.find((c) => c.id === clinicId) ?? null;
  const several = (data?.clinics.length ?? 0) > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-black/60 backdrop-blur-sm sm:px-6 sm:py-8"
      onMouseDown={(event) => {
        // A click on the dim backdrop closes it (nothing is typed in the pop-up itself).
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={professional.name}
        tabIndex={-1}
        data-testid="finder-profile-popup"
        className="relative mx-auto max-w-[1040px] bg-profile-bg text-profile-body shadow-2xl outline-none max-sm:min-h-full sm:rounded-[28px]"
      >
        {/* The "Add DocCy to your Home Screen" banner would cover the pop-up on a phone. */}
        <HideInstallBanner />
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
          <a
            href={profileHref}
            data-testid="finder-popup-full-profile"
            className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-accent-link underline-offset-4 hover:underline"
          >
            Open full profile
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="finder-popup-close"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-profile-border bg-profile-surface text-profile-text transition hover:border-accent"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="grid gap-5 px-4 pb-6 sm:px-6 sm:pb-7 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-5">
            {/* Her hero on the teal band, as on her profile (user, 2026-10-17: one profile
                shown, so the strong colour does not feel noisy). */}
            <header className="rounded-[2rem] bg-accent p-5 text-accent-on sm:p-6">
              <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-x-4 gap-y-3 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-x-5">
                <div className="h-[104px] w-[88px] overflow-hidden rounded-3xl bg-accent-avatar sm:row-span-2 sm:h-36 sm:w-28">
                  <img src={professional.avatarUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 self-center sm:self-start">
                  <h2 className="text-balance text-[24px] font-semibold leading-[1.1] tracking-tight sm:text-[30px]">
                    {professional.name}
                  </h2>
                  {professional.rating ? (
                    <p className="mt-2 inline-flex items-center gap-x-2 text-[15px] font-semibold">
                      <Star className="h-[18px] w-[18px] fill-current" aria-hidden />
                      <span className="tabular-nums" aria-label={`${professional.rating.average.toFixed(1)} out of 5 stars`}>
                        {professional.rating.average.toFixed(1)}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{t("reviewsSummary", { count: professional.rating.count })}</span>
                    </p>
                  ) : null}
                </div>
                <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {pills.map((label) => (
                      <span key={label} className="inline-flex max-w-full rounded-full bg-accent-on px-3 py-1.5 text-sm font-bold text-accent">
                        {label}
                      </span>
                    ))}
                    {professional.isGesy ? (
                      <span className="inline-flex items-center px-1">
                        <GesyProviderBadge size="xs" language="en" variant="mono" className="[&_img]:h-7" />
                      </span>
                    ) : null}
                  </div>
                  {data?.headline ? <p className="mt-3 text-lg font-medium leading-snug">{data.headline}</p> : null}
                  <div className="mt-3 flex flex-col items-start gap-y-1 text-[15px] font-medium sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
                    {professional.languages ? (
                      <span className="inline-flex items-start gap-x-2">
                        <Languages className="mt-[3px] h-4 w-4 shrink-0" aria-hidden />
                        <span>{t("heroSpeaks", { languages: professional.languages })}</span>
                      </span>
                    ) : null}
                    {professional.patientsSeen ? (
                      <span className="inline-flex items-center gap-x-2">
                        <Users className="h-4 w-4 shrink-0" aria-hidden />
                        <span>{professional.patientsSeen}</span>
                      </span>
                    ) : null}
                    {data?.hasPersonalMobile ? (
                      <RevealMobileButton
                        professionalId={professional.id}
                        label={t("heroShowMobile")}
                        loadingLabel={t("heroShowMobileLoading")}
                        errorLabel={t("heroShowMobileError")}
                        className="text-accent-on underline decoration-1 underline-offset-4 hover:decoration-2"
                        testId="finder-popup-mobile"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </header>

            {data && data.services.length > 0 && data.viewerMode === "patient" ? (
              <section aria-labelledby="finder-popup-services-heading" data-testid="finder-popup-services">
                <h3 id="finder-popup-services-heading" className="text-base font-semibold text-profile-text">
                  What do you need?
                </h3>
                <p className="mt-0.5 text-sm text-profile-muted">Pick one, then a time. You can change it in the form.</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {(allServices ? data.services : data.services.slice(0, FINDER_POPUP_SERVICES_SHOWN)).map((service) => {
                    const picked = service.id === serviceId;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        aria-pressed={picked}
                        onClick={() => {
                          setServiceId(service.id);
                          requestProfileServiceSelect(service.id);
                        }}
                        className={`inline-flex min-h-10 items-center rounded-full border-2 px-3.5 text-sm font-bold transition ${
                          picked
                            ? "border-accent-cta bg-accent-cta text-accent-on-cta"
                            : "border-profile-border bg-profile-surface text-profile-text hover:border-accent-cta"
                        }`}
                      >
                        {service.name}
                      </button>
                    );
                  })}
                  {!allServices && data.services.length > FINDER_POPUP_SERVICES_SHOWN ? (
                    <button
                      type="button"
                      onClick={() => setAllServices(true)}
                      data-testid="finder-popup-services-more"
                      className="inline-flex min-h-10 items-center px-2 text-sm font-bold text-accent-link underline-offset-4 hover:underline"
                    >
                      Show all {data.services.length}
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-3" data-testid="finder-popup-booking">
            {load.status === "loading" ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-profile-border bg-profile-surface">
                <Loader2 className="h-6 w-6 animate-spin text-accent-link" aria-label="Loading the calendar" />
              </div>
            ) : load.status === "error" || !data ? (
              <div className="rounded-3xl border border-profile-border bg-profile-surface p-5 text-sm">
                <p className="font-bold text-profile-text">The calendar could not be loaded.</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setLoad({ status: "loading" });
                      setReload((n) => n + 1);
                    }}
                    className="inline-flex min-h-10 items-center rounded-xl border-2 border-accent-soft px-3.5 font-bold text-accent-link hover:border-accent"
                  >
                    Try again
                  </button>
                  <a href={profileHref} className="inline-flex min-h-10 items-center font-bold text-accent-link hover:underline">
                    Open full profile
                  </a>
                </div>
              </div>
            ) : (
              <>
                <ProfileClinicChooser
                  rows={finderPopupChooserRows(data.clinics, clinicId).map((row) => ({ ...row, href: profileHref }))}
                  labels={{
                    title: bookingT("chooseClinic"),
                    nextFree: t("nextFree"),
                    callToBook: t("callToBook"),
                    noTimes: t("nextAvailabilityNoTimes"),
                  }}
                  onSelect={(id) => {
                    setSlotKey(null);
                    setClinicId(id);
                  }}
                />
                <ProfileBookingStepProvider>
                  <section className="min-w-0 rounded-3xl border border-profile-border bg-profile-surface p-4 text-profile-body shadow-lg shadow-black/5 sm:p-5 lg:p-4">
                    {data.viewerMode === "own_profile" ? (
                      ownProfileNotice
                    ) : data.viewerMode === "professional" ? (
                      professionalNotice
                    ) : clinic ? (
                      <div data-testid="booking-section">
                        <BookingSection
                          key={clinic.id}
                          doctorId={professional.id}
                          doctorName={professional.name}
                          weeklySlots={clinic.booking.weeklySlots}
                          takenSlotTimes={data.takenSlotTimes}
                          profileSlug={professional.slug}
                          locationId={clinic.id}
                          locationLabel={several ? clinic.title : null}
                          locationScopedPause={several}
                          initialSlotKey={slotKey}
                          breakStart={clinic.booking.breakStart}
                          breakEnd={clinic.booking.breakEnd}
                          publicPhoneAvailable={clinic.publicPhoneAvailable}
                          onlineBookingsPaused={clinic.booking.onlineBookingsPaused}
                          holidayModeEnabled={clinic.booking.holidayModeEnabled}
                          holidayStartDate={clinic.booking.holidayStartDate}
                          holidayEndDate={clinic.booking.holidayEndDate}
                          bookingHorizonDays={clinic.booking.bookingHorizonDays}
                          minimumNoticeHours={clinic.booking.minimumNoticeHours}
                          services={data.services}
                          initialServiceId={serviceId}
                          layout="panel"
                          detailsAside={detailsAside}
                          onTimesStale={() => {
                            setSlotKey(null);
                            setReload((n) => n + 1);
                          }}
                        />
                      </div>
                    ) : (
                      <p className="text-sm">No clinic to book online yet.</p>
                    )}
                  </section>
                </ProfileBookingStepProvider>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    host,
  );
}
