"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type * as React from "react";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Link } from "@/i18n/navigation";
import { markInstallMoment } from "@/lib/install-moment";
import { categoryIcon } from "@/lib/map/category-icons";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

/**
 * The places somebody kept.
 *
 * A private list, not a rating: nothing here is counted, ranked or shown to
 * anyone else, which is the only version of "save" that cannot be brigaded on
 * a civic map. Saving needs an account, so the control only exists for one.
 */
function useSavedPlaces() {
  const { viewer } = useAuth();
  const signedIn = viewer !== undefined && viewer.kind !== "anonymous";

  return {
    signedIn,
    query: useQuery({
      ...orpc.places.saved.queryOptions(),
      enabled: signedIn,
    }),
  };
}

/** The bookmark on a place, as state and action for menu rows and buttons. */
export function useToggleSaved(placeId: string) {
  const queryClient = useQueryClient();
  const { signedIn, query } = useSavedPlaces();

  const saved = (query.data ?? []).some((place) => place.id === placeId);
  const toggle = useMutation({
    mutationFn: (next: boolean) =>
      orpc.places.toggleSaved.call({ placeId, saved: next }),
    // The button flips now and the list catches up. On a phone that drops to
    // 2G mid-tap, waiting for the round trip reads as the tap not registering.
    onMutate: async (next) => {
      await queryClient.cancelQueries({
        queryKey: orpc.places.saved.queryOptions().queryKey,
      });
      const previous = queryClient.getQueryData(
        orpc.places.saved.queryOptions().queryKey,
      );
      if (!next) {
        queryClient.setQueryData(
          orpc.places.saved.queryOptions().queryKey,
          (current) => current?.filter((place) => place.id !== placeId),
        );
      }
      return { previous };
    },
    onSuccess: (_result, next) => {
      if (next) markInstallMoment();
    },
    onError: (_error, _next, context) => {
      queryClient.setQueryData(
        orpc.places.saved.queryOptions().queryKey,
        context?.previous,
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: orpc.places.saved.queryOptions().queryKey,
      }),
  });

  return { signedIn, saved, toggle };
}

/** The bookmark on a place, for the drawer that is showing it. */
export function SavePlaceButton({
  placeId,
  className,
}: {
  placeId: string;
  className?: string;
}) {
  const t = useTranslations("map.saved");
  const { signedIn, saved, toggle } = useToggleSaved(placeId);

  if (!signedIn) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("size-11 shrink-0", className)}
      aria-label={saved ? t("remove") : t("add")}
      title={saved ? t("remove") : t("add")}
      aria-pressed={saved}
      onClick={() => toggle.mutate(!saved)}
    >
      {saved ? (
        <BookmarkCheck className="size-5 text-foreground" aria-hidden />
      ) : (
        <Bookmark className="size-5" aria-hidden />
      )}
    </Button>
  );
}

function SavedList({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("map.saved");
  const { query } = useSavedPlaces();
  const places = query.data ?? [];

  if (places.length === 0) {
    return (
      <Empty className="py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Bookmark />
          </EmptyMedia>
          <EmptyTitle>{t("empty")}</EmptyTitle>
          <EmptyDescription>{t("emptyHint")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="flex flex-col gap-1 overflow-y-auto px-4 pb-8">
      {places.map((place) => {
        const Icon = categoryIcon(place.icon);

        return (
          <li key={place.id}>
            <Link
              href={`/mapa?lugar=${place.slug}`}
              onClick={onNavigate}
              className="flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${place.color}1a` }}
              >
                <Icon className="size-4" style={{ color: place.color }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">{place.name}</span>
                <span className="block truncate text-muted-foreground text-xs">
                  {place.categoryName} · {place.municipalityName}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SavedTrigger({
  count,
  label,
  className,
  ...props
}: {
  count: number;
  label: string;
  className?: string;
} & React.ComponentProps<typeof Button>) {
  // `...props` carries what the drawer trigger injects (open handler,
  // pressed state, ref). Swallow any of it and the button goes dead.
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative size-11", className)}
      aria-label={label}
      {...props}
    >
      <Bookmark className="size-5" aria-hidden />
      {count > 0 && (
        <Badge className="absolute -top-0.5 -right-0.5 min-w-5 bg-foreground px-1 text-[11px] text-background tabular-nums">
          {count > 9 ? "9+" : count}
        </Badge>
      )}
    </Button>
  );
}

/**
 * The list, as a panel.
 *
 * One drawer for every viewport: a bottom sheet on a phone, the same floating
 * side panel the search drawer uses on a wider screen. A single container
 * matters because the panel portals to `document.body` — hiding a second
 * container with `display: none` would hide its trigger but not its portalled
 * panel, so two drawers would open at once. The pill only travels with the
 * bottom sheet; the side panel has no swipe handle.
 */
export function SavedPlaces({
  className,
  onOpen,
  open: controlledOpen,
  onOpenChange,
}: {
  className?: string;
  /** Fires when either container opens, so an owner can stand down. */
  onOpen?: () => void;
  /**
   * Controlled open state. When omitted the panel manages itself; when given
   * — the account screen drives it from the URL hash — both containers follow
   * it, and only the visible one matters.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("map.saved");
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { query } = useSavedPlaces();
  const count = query.data?.length ?? 0;

  function handleOpenChange(next: boolean) {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
    if (next) onOpen?.();
  }

  function close() {
    handleOpenChange(false);
  }

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      showSwipeHandle={!isDesktop}
      swipeDirection={isDesktop ? "right" : "down"}
    >
      <DrawerTrigger
        render={
          <SavedTrigger
            count={count}
            label={t("title")}
            className={className}
          />
        }
      />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t("title")}</DrawerTitle>
        </DrawerHeader>
        <SavedList onNavigate={close} />
      </DrawerContent>
    </Drawer>
  );
}
