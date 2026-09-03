import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { OfflineIndicator } from "@/components/offline/offline-indicator";
import { ServiceWorker } from "@/components/offline/service-worker";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { formats, TIME_ZONE } from "@/i18n/config";
import { type Locale, routing } from "@/i18n/routing";
import "../globals.css";

/**
 * Self-hosted, not fetched at runtime.
 *
 * `next/font` downloads the files at build time and serves them from this
 * origin, so a phone on a weak connection makes no request to a font CDN and
 * the app still renders correctly with no network at all. `display: swap`
 * means text is readable immediately in the fallback rather than invisible
 * while a webfont loads.
 */
const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#166534",
  // The map needs pinch-to-zoom, and capping it would fail WCAG 1.4.4 anyway.
  maximumScale: 5,
};

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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");

  return { title: t("name"), description: t("tagline") };
}

export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  // Resolved by next-intl from the route segment via next/root-params, and
  // already validated there — an unknown locale never reaches this layout.
  const locale = (await getLocale()) as Locale;
  const [messages, now] = await Promise.all([loadMessages(locale), shellNow()]);

  return (
    <html lang={locale} className={`${sans.variable} ${mono.variable}`}>
      <body>
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          timeZone={TIME_ZONE}
          now={now}
          formats={formats}
        >
          <ServiceWorker>
            <Providers>
              {children}
              <OfflineIndicator />
              <Toaster position="top-center" />
            </Providers>
          </ServiceWorker>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
