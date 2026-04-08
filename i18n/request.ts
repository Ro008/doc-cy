import {getRequestConfig} from "next-intl/server";

import {routing} from "./routing";

export default getRequestConfig(async ({requestLocale}) => {
  const requestedLocale = await requestLocale;
  const locale = (routing.locales as readonly string[]).includes(
    requestedLocale ?? ""
  )
    ? (requestedLocale as string)
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

