import {redirect} from "next/navigation";

type Props = {
  params: {locale: string; slug: string};
  searchParams?: {appointmentId?: string; sig?: string};
};

export default function LegacyBookingSuccessRedirect({
  params,
  searchParams,
}: Props) {
  const id = (searchParams?.appointmentId ?? "").trim();
  const sig = (searchParams?.sig ?? "").trim();
  const qs = id
    ? `?appointmentId=${encodeURIComponent(id)}${sig ? `&sig=${encodeURIComponent(sig)}` : ""}`
    : "";
  redirect(`/${params.locale}/${params.slug}/request-sent${qs}`);
}
