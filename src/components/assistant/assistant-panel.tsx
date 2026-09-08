"use client";

import { MessageCircleQuestionMark, SquarePen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  AssistantChat,
  useAssistantChat,
} from "@/components/assistant/assistant-chat";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/**
 * Fired when something outside the panel — the search suggestions, today —
 * wants the assistant open. The panel answers on whichever container matches
 * the viewport, so callers never choose between drawer and sheet.
 */
export const ASSISTANT_OPEN_EVENT = "ruta-cibao:open-assistant";

/**
 * Where the assistant lives.
 *
 * One drawer for every viewport: a bottom sheet on a phone and the same
 * floating side panel the search drawer uses on a wider screen, so every
 * desktop panel reads as one pattern. A single container matters because the
 * panel portals to `document.body` — hiding a second container with
 * `display: none` would hide its trigger but not its portalled panel, so two
 * drawers would open at once. The pill only travels with the bottom sheet;
 * the side panel has no swipe handle.
 *
 * The panel never covers the whole screen: tapping a result has to land the
 * person back on the map, and a full-screen chat would make that feel like
 * leaving the app.
 */
function Trigger({
  label,
  showLabel,
  className,
  ...props
}: {
  label: string;
  /** Rendered beside the icon where the surrounding entries carry words. */
  showLabel?: string;
  className?: string;
} & React.ComponentProps<typeof Button>) {
  // `...props` carries what the drawer/sheet trigger injects (open handler,
  // pressed state, ref). Swallow any of it and the button goes dead.
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-11", className)}
      aria-label={label}
      title={label}
      {...props}
    >
      <MessageCircleQuestionMark className="size-5" aria-hidden />
      {showLabel}
    </Button>
  );
}

export function AssistantPanel({
  className,
  label,
  onOpen,
}: {
  className?: string;
  /** Rendered beside the icon, for the rail where every entry is labelled. */
  label?: string;
  /** Fires when either container opens, so an owner can stand down. */
  onOpen?: () => void;
}) {
  const t = useTranslations("assistant");
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  // One conversation outside the drawer: closing it unmounts the chat, and
  // the history would go with it if the state lived inside.
  const chat = useAssistantChat();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) onOpen?.();
  }

  // The search suggestions ask for the assistant by event. A typed question
  // rides along and becomes the first turn.
  useEffect(() => {
    const openFromOutside = (event: Event) => {
      setOpen(true);
      onOpen?.();
      const question = (event as CustomEvent<{ question?: unknown }>).detail
        ?.question;
      if (typeof question === "string" && question.trim().length >= 2) {
        chat.ask(question);
      }
    };
    window.addEventListener(ASSISTANT_OPEN_EVENT, openFromOutside);
    return () =>
      window.removeEventListener(ASSISTANT_OPEN_EVENT, openFromOutside);
  }, [chat, onOpen]);

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      showSwipeHandle={!isDesktop}
      swipeDirection={isDesktop ? "right" : "down"}
    >
      <DrawerTrigger
        render={
          <Trigger label={t("title")} showLabel={label} className={className} />
        }
      />
      <DrawerContent className="data-[swipe-axis=y]:h-[88dvh]">
        <DrawerHeader className="border-b pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5 text-left">
              <DrawerTitle>{t("title")}</DrawerTitle>
              <DrawerDescription>{t("subtitle")}</DrawerDescription>
            </div>

            {/* Starting over belongs up here, not in the composer. It is a
                rare action, and rare actions go where they cannot be hit by
                accident while typing — the corner every chat application has
                already taught people to look in.

                Only once there is a conversation to leave: on an empty chat
                the button would do nothing and still have to be understood. */}
            {chat.turns.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                className="size-10 shrink-0 rounded-full"
                aria-label={t("newChat")}
                title={t("newChat")}
                onClick={chat.clear}
              >
                <SquarePen className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </DrawerHeader>
        <AssistantChat chat={chat} onNavigate={() => setOpen(false)} />
      </DrawerContent>
    </Drawer>
  );
}
