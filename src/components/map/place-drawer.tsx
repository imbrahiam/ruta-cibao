"use client";

import { useQuery } from "@tanstack/react-query";
import { Compass, MapPin, Share2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc";

/**
 * What a place is, and what you can do about it.
 *
 * A drawer rather than a panel or a new page: the map stays visible behind it,
 * which is the context that makes the content mean anything, and it is
 * dismissed with the swipe people already use. Pulling it further up reveals
 * the actions without covering the marker.
 *
 * While the detail loads the drawer is already open with the name in place —
 * the map handed us that from the tile — so what arrives is description and
 * actions, not the whole screen. Nothing is faked with grey blocks.
 */
export function PlaceDrawer({
  slug,
  onClose,
}: {
  slug: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("map.place");

  const query = useQuery({
    ...orpc.places.detail.queryOptions({ input: { slug: slug ?? "" } }),
    enabled: slug !== null,
  });

  const place = query.data;

  return (
    <Drawer
      open={slug !== null}
      onOpenChange={(open) => !open && onClose()}
      // Two rest positions: a peek that leaves most of the map visible, and a
      // fuller one for the description. Neither ever covers the whole screen.
      snapPoints={[0.4, 0.85]}
      showSwipeHandle
      // Not modal: the map stays pannable with the drawer open, so someone can
      // look around without dismissing what they just tapped.
      modal={false}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-left text-xl">
            {place?.name ?? (
              <span className="flex items-center gap-2 text-muted-foreground text-base">
                <Spinner className="size-4" /> {t("loading")}
              </span>
            )}
          </DrawerTitle>
          {place && (
            <DrawerDescription className="flex flex-wrap items-center gap-2 text-left">
              <Badge
                variant="secondary"
                className="gap-1.5"
                style={{ borderColor: place.category.color }}
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: place.category.color }}
                />
                {place.category.name}
              </Badge>
              <span className="text-muted-foreground text-sm">
                {place.municipality.name}
              </span>
            </DrawerDescription>
          )}
        </DrawerHeader>

        <div className="flex flex-col gap-5 px-4 pb-8">
          {place?.description && (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {place.description}
            </p>
          )}

          {place?.address && (
            <p className="flex items-start gap-2 text-sm">
              <MapPin
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              {place.address}
            </p>
          )}

          {place && (
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                className="h-12 w-full text-base"
                nativeButton={false}
                render={
                  // Hands off to whatever navigation app the phone already has,
                  // rather than pretending to be one.
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <Compass className="size-5" aria-hidden />
                {t("directions")}
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-11 flex-1"
                  onClick={() => {
                    const url = `${window.location.origin}/mapa?lugar=${place.slug}`;
                    // The share sheet where it exists, the clipboard where it
                    // does not; both leave the person with a working link.
                    if (navigator.share) {
                      void navigator.share({ title: place.name, url });
                      return;
                    }
                    void navigator.clipboard.writeText(url);
                  }}
                >
                  <Share2 className="size-4" aria-hidden />
                  {t("share")}
                </Button>

                <Button variant="outline" className="h-11 flex-1">
                  <TriangleAlert className="size-4" aria-hidden />
                  {t("report")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
