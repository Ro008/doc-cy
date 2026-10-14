import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProfileServiceBookButton } from "@/components/doctor/profile/ProfileServiceBookButton";
import { ProfileShowAll } from "@/components/doctor/profile/ProfileShowAll";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";
import { servicePriceParts } from "@/lib/public/service-price";

type Service = { id: string; name: string; price: string | null };

/** Rows shown before "Show all N services" (she can list up to 20). */
const SERVICES_SHOWN = 6;

/**
 * "Services & prices" as a price list (user, 2026-10-14): one card, one row per service across
 * the column, name on the left, price on the right ("from" small before it). The whole row books.
 */
export async function ProfileServicesSection({ services }: { services: readonly Service[] }) {
  if (services.length === 0) return null;
  const t = await getTranslations("DoctorProfilePage");

  return (
    <section
      id={PROFILE_SECTION_IDS.services}
      aria-labelledby="profile-services-heading"
      className="grid scroll-mt-20 gap-5"
    >
      <h2
        id="profile-services-heading"
        className="text-2xl font-semibold tracking-tight text-profile-text sm:text-[28px]"
      >
        {t("servicesHeading")}
      </h2>
      <ProfileShowAll
        shown={SERVICES_SHOWN}
        total={services.length}
        showAllLabel={t("servicesShowAll", { count: services.length })}
        showFewerLabel={t("servicesShowFewer")}
        listClassName="divide-y divide-profile-border overflow-hidden rounded-2xl border border-profile-border bg-profile-surface"
      >
        {services.map((service) => {
          const price = servicePriceParts(service.price);
          return (
            <li key={service.id}>
              <ProfileServiceBookButton
                serviceId={service.id}
                serviceName={service.name}
                label={t("serviceBook")}
                ariaLabel={t("serviceBookFor", { name: service.name })}
              >
                <span className="min-w-0 flex-1 break-words font-semibold text-profile-text">{service.name}</span>
                {price ? (
                  <span className="shrink-0 whitespace-nowrap text-right tabular-nums">
                    {price.from ? (
                      <span className="mr-1 text-sm font-medium text-profile-muted">{t("servicePriceFromWord")}</span>
                    ) : null}
                    <span className="text-lg font-bold text-profile-text">{price.price}</span>
                  </span>
                ) : (
                  <span className="shrink-0 text-sm font-medium text-profile-muted">{t("servicePriceMissing")}</span>
                )}
                <ChevronRight
                  className="h-5 w-5 shrink-0 text-profile-muted group-hover/service:hidden group-focus-visible/service:hidden"
                  aria-hidden
                />
              </ProfileServiceBookButton>
            </li>
          );
        })}
      </ProfileShowAll>
    </section>
  );
}
