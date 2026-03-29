import {redirect} from "next/navigation";

type Props = {
  params: {locale: string; slug: string};
  searchParams?: {appointmentId?: string};
};

export default function LegacyBookingSuccessRedirect({
  params,
  searchParams,
}: Props) {
  const id = (searchParams?.appointmentId ?? "").trim();
  const qs = id
    ? `?appointmentId=${encodeURIComponent(id)}`
    : "";
  redirect(`/${params.locale}/${params.slug}/request-sent${qs}`);
}
