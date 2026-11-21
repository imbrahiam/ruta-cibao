import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { getT, LOCALE } from "@/lib/web/i18n";
import { site } from "@/lib/web/site";
import "./globals.css";

/*
 * Inter for text, Fraunces for display headlines. `next/font` fetches both at
 * build time and serves them from this origin, so a phone on a weak signal
 * makes no request to a font CDN.
 */
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  axes: ["opsz"],
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const t = getT("landing");

export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  // Tabs read "Page | Ruta Cibao"; the home page is the brand alone.
  title: { default: t("brand"), template: `%s | ${t("brand")}` },
  description: t("intro"),
  applicationName: t("brand"),
  openGraph: {
    siteName: t("brand"),
    locale: "es_DO",
    type: "website",
    title: t("brand"),
    description: t("intro"),
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The desk's theme script sets `data-admin-theme` here before hydration;
    // this only silences that attribute mismatch on <html> itself.
    <html
      lang={LOCALE}
      className={`${inter.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <body>
        <a
          href="#contenido"
          className="sr-only z-[100] rounded-full bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t("skip")}
        </a>
        {children}
      </body>
    </html>
  );
}
