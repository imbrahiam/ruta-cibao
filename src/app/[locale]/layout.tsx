import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { OfflineIndicator } from "@/components/offline/offline-indicator";
import { ServiceWorker } from "@/components/offline/service-worker";
import { Providers } from "@/components/providers";
import { AppToaster } from "@/components/shell/app-toaster";
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

/**
 * The display face: headlines and the wordmark, nothing you read at length or
 * tap. A warm serif with optical sizes, after land-book's serif wordmark —
 * Geist stays the voice of the interface, so legibility for people who read
 * slowly is untouched.
 */
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "opsz"],
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#213d34",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Safari (iOS 26 included) can overlay its bottom bar over fixed content.
  // `resizes-content` makes the layout viewport shrink instead, so the bottom
  // nav and the map controls above it are never covered.
  interactiveWidget: "resizes-content",
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

  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("tagline"),
    applicationName: t("name"),
    appleWebApp: { capable: true, statusBarStyle: "default", title: t("name") },
    formatDetection: { telephone: false },
  };
}

export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  // Resolved by next-intl from the route segment via next/root-params, and
  // already validated there — an unknown locale never reaches this layout.
  const locale = (await getLocale()) as Locale;
  const [messages, now] = await Promise.all([loadMessages(locale), shellNow()]);

  return (
    <html
      lang={locale}
      className={`${sans.variable} ${mono.variable} ${display.variable}`}
    >
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
              {/* Reads the path to step aside on the map, which is a runtime
                  read: outside a boundary it would hold back the shell. */}
              <Suspense fallback={null}>
                <OfflineIndicator />
              </Suspense>
              <AppToaster />
            </Providers>
          </ServiceWorker>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
