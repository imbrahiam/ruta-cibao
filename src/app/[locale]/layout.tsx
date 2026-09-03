import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OfflineIndicator } from "@/components/offline/offline-indicator";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { formats, TIME_ZONE } from "@/i18n/config";
import { type Locale, routing } from "@/i18n/routing";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * The catalogue is a build-time constant, so it belongs in the static shell
 * rather than being re-read per request. Caching it is what lets every page
 * below prerender its text instead of streaming it in.
 */
async function loadMessages(locale: Locale) {
  "use cache";
  return (await import(`../../../messages/${locale}.json`)).default;
}

/**
 * Reference time for the provider.
 *
 * next-intl renders statically only when `locale`, `messages`, `timeZone` and
 * `now` are all passed explicitly — omit any one and it reads the request
 * config, which pulls the whole page out of the static shell. A raw
 * `new Date()` cannot be prerendered either, so the value is cached: it is a
 * stable reference point, not a clock.
 *
 * Anything that must show true elapsed time — "reported 4 minutes ago" on the
 * traffic layer — passes its own `now` at the call site, inside a boundary that
 * is dynamic anyway because the data is.
 */
async function shellNow() {
  "use cache";
  return new Date();
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });

  return { title: t("name"), description: t("tagline") };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Lets the whole subtree render statically where it can.
  setRequestLocale(locale);
  const [messages, now] = await Promise.all([loadMessages(locale), shellNow()]);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          timeZone={TIME_ZONE}
          now={now}
          formats={formats}
        >
          <SerwistProvider swUrl="/serwist/sw.js">
            <Providers>
              {children}
              <OfflineIndicator />
              <Toaster position="top-center" />
            </Providers>
          </SerwistProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
