import HomePage from "../page";
import { setRequestLocale } from "next-intl/server";

export default async function LocaleHomePage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  return <HomePage />;
}

