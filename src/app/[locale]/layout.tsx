import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Providers } from "@/components/providers";
import { ServiceWorker } from "@/components/pwa/service-worker";
import { formats, TIME_ZONE } from "@/i18n/config";
import { type Locale, routing } from "@/i18n/routing";
import "../globals.css";

/*
 * Inter for everything, Fraunces for display and section headlines, Geist Mono
 * for small uppercase labels and figures. `next/font` downloads all three at
 * build time and serves them from this origin, so a phone on a weak signal
 * makes no request to a font CDN.
 */
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  weight: ["500"],
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

export const viewport: Viewport = {
  // Light by default; a person who picks dark gets dark chrome inside the app,
  // and the browser bar staying paper-coloured is the lesser mismatch.
  themeColor: "#fafaf7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Safari can lay its bottom bar over fixed content; shrinking the layout
  // viewport instead keeps the tab bar and the map controls uncovered.
  interactiveWidget: "resizes-content",
  // The map needs pinch-to-zoom, and capping it would fail WCAG 1.4.4.
  maximumScale: 5,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** The catalogue is a build-time constant; caching it keeps it in the shell. */
async function loadMessages(locale: Locale) {
  "use cache";
  return (await import(`../../../messages/${locale}.json`)).default;
}

/**
 * next-intl renders statically only when `now` is passed explicitly. This is a
 * stable reference point, not a clock: screens that show elapsed time pass
 * their own.
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
  const locale = (await getLocale()) as Locale;
  const [messages, now] = await Promise.all([loadMessages(locale), shellNow()]);
  const t = await getTranslations("app");

  return (
    <html
      lang={locale === "es" ? "es-DO" : locale}
      className={`${inter.variable} ${fraunces.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <a
          href="#contenido"
          className="sr-only z-[100] rounded-full bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          timeZone={TIME_ZONE}
          now={now}
          formats={formats}
        >
          <ServiceWorker>
            <Providers>{children}</Providers>
          </ServiceWorker>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
