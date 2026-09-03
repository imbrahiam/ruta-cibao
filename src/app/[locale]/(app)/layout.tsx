import { setRequestLocale } from "next-intl/server";
import { AppHeader } from "@/components/shell/app-header";

/**
 * The signed-in shell.
 *
 * Onboarding deliberately does not use this: those three screens are one task,
 * and a header offering ways to wander off mid-verification would work against
 * them.
 */
export default async function AppLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader locale={locale} />
      <main
        id="contenido"
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-8"
      >
        {children}
      </main>
    </div>
  );
}
