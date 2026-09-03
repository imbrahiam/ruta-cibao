/**
 * Onboarding shell.
 *
 * Mobile first and deliberately narrow: one column, generous spacing, and
 * `min-h-dvh` rather than `min-h-screen` so the mobile browser's collapsing
 * address bar cannot cut off the submit button.
 */
export default function OnboardingLayout({
  children,
}: LayoutProps<"/[locale]">) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-10">
        {children}
      </main>
    </div>
  );
}
