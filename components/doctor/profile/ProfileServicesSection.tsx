import { getTranslations } from "next-intl/server";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";
import { formatServicePrice } from "@/lib/public/service-price";

type Service = { id: string; name: string; price: string | null };

/** "Services & prices": the professional's own list; a bare number gets "€" after it. */
export async function ProfileServicesSection({ services }: { services: readonly Service[] }) {
  if (services.length === 0) return null;
  const t = await getTranslations("DoctorProfilePage");

  return (
    <section
      id={PROFILE_SECTION_IDS.services}
      aria-labelledby="profile-services-heading"
      className="grid scroll-mt-20 gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8"
    >
      <h2
        id="profile-services-heading"
        className="text-2xl font-extrabold tracking-tight text-profile-text sm:text-[28px]"
      >
        {t("servicesHeading")}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {services.map((service) => {
          const price = formatServicePrice(service.price);
          return (
          <li
            key={service.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-profile-border bg-profile-surface px-5 py-4"
          >
            <span className="font-semibold text-profile-text">{service.name}</span>
            {price ? (
              <span className="shrink-0 text-lg font-extrabold tabular-nums text-profile-text">
                {price}
              </span>
            ) : (
              <span className="shrink-0 text-sm font-medium text-profile-muted">
                {t("servicePriceMissing")}
              </span>
            )}
          </li>
          );
        })}
      </ul>
    </section>
  );
}
