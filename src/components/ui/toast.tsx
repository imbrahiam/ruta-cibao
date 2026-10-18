"use client";

import { Toast } from "@base-ui/react/toast";
import { Check, CircleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * One toast manager for the whole app, so a mutation's `onSuccess` can say
 * something without threading a hook through every component.
 */
export const toastManager = Toast.createToastManager();

type ToastInput = {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  timeout?: number;
};

export const toast = {
  success: (input: ToastInput) => show("success", input),
  error: (input: ToastInput) => show("error", input),
  info: (input: ToastInput) => show("info", input),
};

function show(type: "success" | "error" | "info", input: ToastInput) {
  return toastManager.add({
    type,
    title: input.title,
    description: input.description,
    timeout: input.timeout ?? (type === "error" ? 7000 : 4500),
    priority: type === "error" ? "high" : "low",
    actionProps: input.action
      ? { children: input.action.label, onClick: input.action.onClick }
      : undefined,
  });
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager} limit={3}>
      {children}
      <Toast.Portal>
        {/* Phones: above the tab bar, where the thumb already is.
            Desktop: top centre, clear of the map's controls. */}
        <Toast.Viewport className="fixed inset-x-4 bottom-[calc(var(--tabbar-h)+12px)] z-[60] mx-auto max-w-[400px] outline-none md:top-5 md:bottom-auto">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  const t = useTranslations("common");

  return toasts.map((item) => (
    <Toast.Root
      key={item.id}
      toast={item}
      className="absolute inset-x-0 bottom-0 z-[calc(100-var(--toast-index))] origin-bottom rounded-card bg-ink text-paper shadow-lg select-none [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-var(--toast-index)*8px))_scale(calc(1-var(--toast-index)*0.04))] transition-[transform,opacity,filter] duration-[450ms] ease-out data-[ending-style]:opacity-0 data-[limited]:opacity-0 data-[starting-style]:opacity-0 data-[starting-style]:[filter:blur(6px)] data-[starting-style]:[transform:translateY(12px)] data-[ending-style]:[transform:translateY(12px)] data-[ending-style]:duration-200 data-[ending-style]:ease-in md:top-0 md:bottom-auto md:origin-top md:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+var(--toast-index)*8px))_scale(calc(1-var(--toast-index)*0.04))] md:data-[starting-style]:[transform:translateY(-12px)] md:data-[ending-style]:[transform:translateY(-12px)]"
    >
      <Toast.Content className="flex items-start gap-3 py-3 pr-2 pl-4 transition-opacity duration-200 data-[behind]:opacity-0">
        <span className="mt-0.5 shrink-0" aria-hidden>
          {item.type === "error" ? (
            <CircleAlert
              strokeWidth={1.75}
              className="size-[18px] text-[color-mix(in_srgb,var(--danger)_70%,var(--paper))]"
            />
          ) : (
            <Check strokeWidth={1.75} className="size-[18px] opacity-80" />
          )}
        </span>
        <div className="min-w-0 flex-1 py-px">
          <Toast.Title className="text-[15px] leading-snug font-medium" />
          <Toast.Description className="t-small mt-0.5 opacity-75" />
        </div>
        {item.actionProps ? (
          <Toast.Action className="press -my-0.5 h-8 shrink-0 rounded-full bg-paper/12 px-3 text-[14px] font-medium hover:bg-paper/20" />
        ) : null}
        <Toast.Close
          aria-label={t("dismiss")}
          className="press -my-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full opacity-60 hover:opacity-100"
        >
          <X strokeWidth={1.5} className="size-4" />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}
