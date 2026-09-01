import DoctorPage, {
  generateMetadata,
  revalidate,
  type PageProps,
} from "@/lib/public/doctor-profile-page";

import {setRequestLocale} from "next-intl/server";

export {generateMetadata};
export {revalidate};

export default async function LocaleSlugPage({
  params,
  searchParams,
}: {
  params: {locale: string; slug: string};
  searchParams?: {slot?: string | string[]; location?: string | string[]};
}) {
  setRequestLocale(params.locale);

  const doctorParams: PageProps["params"] = { slug: params.slug, locale: params.locale };
  return <DoctorPage params={doctorParams} searchParams={searchParams} />;
}
