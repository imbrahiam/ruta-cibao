import { AppHeader } from "@/components/shell/app-header";
import { SiteNav } from "@/components/shell/site-nav";

/**
 * The signed-in shell.
 *
 * Onboarding deliberately does not use this: those three screens are one task,
 * and a header offering ways to wander off mid-verification would work against
 * them.
 */
export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pb-20 md:pb-0">
      <AppHeader />
      <main
        id="contenido"
        className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 md:py-14"
      >
        {children}
      </main>
      <SiteNav mobile />
    </div>
  );
}
