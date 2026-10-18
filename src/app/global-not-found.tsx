import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import messages from "../../messages/es.json";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  weight: ["500"],
});
const copy = messages.notFound;

export const metadata: Metadata = {
  title: `${copy.title} · ${messages.app.name}`,
  description: copy.description,
};

/**
 * A route that is not on the map, said as a map would say it: a road that
 * ends. Its own document, because it renders outside every layout.
 */
export default function GlobalNotFound() {
  return (
    <html lang="es-DO" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 py-16 text-center">
          <svg viewBox="0 0 120 64" aria-hidden className="w-36 text-ink-4">
            <path
              d="M8 52c18 0 22-30 44-30s22 18 36 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="2 7"
            />
            <circle
              cx="8"
              cy="52"
              r="5"
              fill="var(--card)"
              stroke="var(--ink)"
              strokeWidth="2.5"
            />
            <path
              d="M96 34l12 12M108 34l-12 12"
              stroke="var(--danger)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <p className="t-label mt-8 text-ink-3">{copy.code}</p>
          <h1 className="t-h2 mt-3 max-w-[20ch] text-ink">{copy.title}</h1>
          <p className="t-body-lg mt-3 max-w-[46ch] text-ink-2">
            {copy.description}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/mapa"
              className="press inline-flex h-10 items-center rounded-full bg-ink px-4 text-[15px] font-medium text-paper hover:opacity-90"
            >
              {copy.openMap}
            </a>
            <a
              href="/"
              className="press inline-flex h-10 items-center rounded-full bg-card px-4 text-[15px] font-medium text-ink shadow-ring hover:bg-paper-2"
            >
              {copy.goHome}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
