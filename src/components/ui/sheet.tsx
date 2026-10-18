"use client";

import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * A modal surface: a bottom sheet on a phone, a centred panel from 810px up.
 *
 * One component for both because the content is the same and only the
 * ergonomics differ: a thumb reaches the bottom of a phone, a pointer reaches
 * the middle of a laptop. Base UI's drawer does the focus trap, the swipe to
 * dismiss and the Escape key; this file is only the material.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
  dismissible?: boolean;
}) {
  const t = useTranslations("common");

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection="down"
      disablePointerDismissal={!dismissible}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 bg-scrim opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-[420ms] ease-soft data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <Drawer.Popup
            className={cx(
              "relative flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-t-panel bg-card text-ink shadow-lg outline-none",
              "[transform:translateY(var(--drawer-swipe-movement-y,0))] transition-[transform,opacity] duration-[420ms] ease-soft",
              "data-[starting-style]:[transform:translateY(100%)] data-[ending-style]:[transform:translateY(100%)] data-[ending-style]:duration-300 data-[ending-style]:ease-in",
              "md:max-h-[min(760px,calc(100dvh-48px))] md:rounded-panel md:data-[starting-style]:[transform:translateY(8px)] md:data-[starting-style]:opacity-0 md:data-[ending-style]:[transform:translateY(8px)] md:data-[ending-style]:opacity-0",
              size === "md" ? "md:max-w-[480px]" : "md:max-w-[640px]",
            )}
          >
            <div className="flex shrink-0 justify-center pt-2.5 md:hidden">
              <span aria-hidden className="h-1 w-9 rounded-full bg-paper-3" />
            </div>
            <header className="flex shrink-0 items-start gap-3 px-5 pt-3 pb-1 md:px-6 md:pt-6">
              <div className="min-w-0 flex-1">
                <Drawer.Title className="t-h3 text-ink">{title}</Drawer.Title>
                {description ? (
                  <Drawer.Description className="t-small mt-1 text-ink-2">
                    {description}
                  </Drawer.Description>
                ) : null}
              </div>
              <Drawer.Close
                aria-label={t("close")}
                className="press -mr-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-paper-3 hover:text-ink pointer-coarse:size-11"
              >
                <X strokeWidth={1.5} className="size-[18px]" />
              </Drawer.Close>
            </header>
            <Drawer.Content className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-5 md:px-6 md:pb-6">
              {children}
            </Drawer.Content>
            {footer ? (
              <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-line/60 px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] sm:flex-row sm:justify-end md:px-6 md:pb-5">
                {footer}
              </footer>
            ) : (
              <div className="h-[env(safe-area-inset-bottom,0px)] shrink-0" />
            )}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
