import { ViewTransition } from "react";

/**
 * Onboarding shell.
 *
 * Mobile first and deliberately narrow: one column, generous spacing, and
 * `min-h-dvh` rather than `min-h-screen` so the mobile browser's collapsing
 * address bar cannot cut off the submit button.
 *
 * Steps crossfade into each other rather than snapping. The onboarding flow is
 * three screens that share a frame, and a hard cut between them reads as a page
 * reload — which is exactly the impression the prefetching works to avoid. The
 * global reduced-motion rule turns this off for anyone who asked.
 */
export default function OnboardingLayout({
  children,
}: LayoutProps<"/[locale]">) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-10">
        <ViewTransition>{children}</ViewTransition>
      </main>
    </div>
  );
}
