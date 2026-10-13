import { getTranslations } from "next-intl/server";
import { ProfileServiceBookButton } from "@/components/doctor/profile/ProfileServiceBookButton";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";
import { formatServicePrice } from "@/lib/public/service-price";

type Service = { id: string; name: string; price: string | null };

/** "Services & prices": the professional's own list, prices in euros ("€60", "From €95"). */
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
        className="text-2xl font-extrabold tracking-tight text-profile-text sm:text-[28px]"
      >
        {t("servicesHeading")}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {services.map((service) => {
          const price = formatServicePrice(service.price, (price) => t("servicePriceFrom", { price }));
          return (
          <li
            key={service.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-profile-border bg-profile-surface px-5 py-4"
          >
            <span className="min-w-0 font-semibold text-profile-text">{service.name}</span>
            <span className="flex shrink-0 items-center gap-3">
              {price ? (
                <span className="text-lg font-extrabold tabular-nums text-profile-text">{price}</span>
              ) : (
                <span className="text-sm font-medium text-profile-muted">{t("servicePriceMissing")}</span>
              )}
              <ProfileServiceBookButton
                serviceId={service.id}
                serviceName={service.name}
                label={t("serviceBook")}
                ariaLabel={t("serviceBookFor", { name: service.name })}
              />
            </span>
          </li>
          );
        })}
      </ul>
    </section>
  );
}
