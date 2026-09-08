import { RouteOff } from "lucide-react";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import messages from "../../messages/es.json";
import "./globals.css";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const copy = messages.notFound;

export const metadata: Metadata = {
  title: `${copy.code} · ${copy.title}`,
  description: copy.description,
};

export default function GlobalNotFound() {
  return (
    <html lang="es" className={sans.variable}>
      <body>
        <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-5 py-12 text-foreground">
          <div
            className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 size-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl"
            aria-hidden
          />

          <section className="relative z-10 flex w-full max-w-xl flex-col items-center text-center">
            <div className="mb-7 flex size-16 items-center justify-center rounded-2xl border bg-background shadow-sm">
              <RouteOff className="size-7 text-muted-foreground" aria-hidden />
            </div>

            <p className="font-mono font-medium text-muted-foreground text-sm tracking-[0.24em]">
              {copy.code}
            </p>
            <h1 className="mt-3 text-balance font-semibold text-4xl tracking-tight sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-4 max-w-md text-pretty text-base text-muted-foreground leading-7">
              {copy.description}
            </p>

            <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/mapa"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 font-medium text-primary-foreground text-sm shadow-sm transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {copy.openMap}
              </a>
              <a
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-lg border bg-background px-5 font-medium text-sm shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {copy.goHome}
              </a>
            </div>

            <p className="mt-8 text-muted-foreground text-xs">
              {messages.app.name}
            </p>
          </section>
        </main>
      </body>
    </html>
  );
}
