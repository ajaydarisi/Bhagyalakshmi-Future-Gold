import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: {
      ...(await import(`../../messages/${locale}/common.json`)).default,
      home: (await import(`../../messages/${locale}/home.json`)).default,
      products: (await import(`../../messages/${locale}/products.json`)).default,
      constants: (await import(`../../messages/${locale}/constants.json`)).default,
      about: (await import(`../../messages/${locale}/about.json`)).default,
      auth: (await import(`../../messages/${locale}/auth.json`)).default,
      account: (await import(`../../messages/${locale}/account.json`)).default,
      cart: (await import(`../../messages/${locale}/cart.json`)).default,
      wishlist: (await import(`../../messages/${locale}/wishlist.json`)).default,
      search: (await import(`../../messages/${locale}/search.json`)).default,
      feedback: (await import(`../../messages/${locale}/feedback.json`)).default,
    },
  };
});
