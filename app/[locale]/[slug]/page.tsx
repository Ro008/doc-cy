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
}: {
  params: {locale: string; slug: string};
}) {
  setRequestLocale(params.locale);

  const doctorParams: PageProps["params"] = {slug: params.slug};
  return <DoctorPage params={doctorParams} />;
}

