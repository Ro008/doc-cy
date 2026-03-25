import BookingSuccessPage, {
  revalidate,
} from "@/lib/public/booking-success-page";

import {setRequestLocale} from "next-intl/server";

export {revalidate};

type Props = {
  params: {locale: string; slug: string};
  searchParams?: {appointmentId?: string};
};

export default async function LocaleBookingSuccessPage({params, searchParams}: Props) {
  setRequestLocale(params.locale);

  return (
    <BookingSuccessPage
      params={{slug: params.slug}}
      searchParams={searchParams}
    />
  );
}

