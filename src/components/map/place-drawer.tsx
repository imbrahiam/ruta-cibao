"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Compass,
  Ellipsis,
  Share2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BusinessPanel } from "@/components/map/business-panel";
import { PlaceGallery } from "@/components/map/place-gallery";
import { PlacePhotos } from "@/components/map/place-photos";
import { PlaceReportForm } from "@/components/map/place-report-form";
import { PlaceTrust } from "@/components/map/place-trust";
import { useToggleSaved } from "@/components/map/saved-places";
import { StampVisit } from "@/components/passport/stamp-visit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useMediaQuery } from "@/hooks/use-media-query";
import { categoryIcon } from "@/lib/map/category-icons";
import { detectPlatform, directionsUrl } from "@/lib/map/directions";
import { orpc } from "@/lib/orpc";
import { shareUrl } from "@/lib/share";
import { cn } from "@/lib/utils";

/**
 * What a place is, and what you can do about it.
 *
 * A drawer rather than a panel or a new page: the map stays visible behind it,
 * which is the context that makes the content mean anything, and it is
 * dismissed with the swipe people already use.
 *
 * Three things make it feel like one object rather than a screen that reloads:
 *
 *   It never remounts. Tapping a second pin swaps the contents of the drawer
 *   that is already open, so it slides once — when it first appears — and after
 *   that only its text crossfades. Remounting it per place is what made the
 *   panel slam in from the right on every tap.
 *
 *   It opens with real content. The map hands over the name and the category
 *   from the tile it already drew, so the title and the coloured chip are there
 *   on the same frame as the tap; the description, the photo and the address
 *   fill in behind them. Nothing is faked with grey blocks.
 *
 *   The peek is useful on its own. Name, category, and the three things anyone
 *   opens a place to do sit above the fold on a phone, so the common case needs
 *   no drag at all. Pulling it up is for the description and the photo.
 */
type Preview = { name: string; categoryId?: string } | null;

/**
 * How much of the sheet rests on screen on a phone.
 *
 * Three heights, the way Google and Apple Maps do it. The peek holds the
 * header and "Cómo llegar" and nothing else — about a third of the screen, so
 * the pin and the streets around it stay in view. It used to be 55%, which
 * left a strip of map between the search row and the sheet. The middle shows
 * the photo and description; the top is everything.
 *
 * The peek is exported because the map has to know it — a pin opened from a
 * link has to land in the strip the sheet leaves visible, and two numbers
 * drifting apart would put it underneath.
 */
export const PEEK_SNAP = 0.36;
const MID_SNAP = 0.62;
const FULL_SNAP = 0.94;
const SNAP_POINTS = [PEEK_SNAP, MID_SNAP, FULL_SNAP];

/** Where the expand button goes next: up a step, and from the top back down. */
function nextSnap(current: number | string | null): number {
  if (current === PEEK_SNAP) return MID_SNAP;
  if (current === MID_SNAP) return FULL_SNAP;
  return PEEK_SNAP;
}

export function PlaceDrawer({
  slug,
  preview,
  onResolved,
  onClose,
}: {
  slug: string | null;
  preview: Preview;
  /**
   * Where the open place actually is, once the detail lands.
   *
   * A slug can arrive from the URL — a shared link, a row in the saved list —
   * with the map still looking somewhere else entirely. The screen uses this to
   * move there and highlight the pin, which the tile could not tell it because
   * no pin was tapped.
   */
  onResolved?: (place: {
    id: string;
    slug: string;
    lng: number;
    lat: number;
  }) => void;
  onClose: () => void;
}) {
  const t = useTranslations("map.place");
  const savedCopy = useTranslations("map.saved");
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [reporting, setReporting] = useState(false);
  const [snapPoint, setSnapPoint] = useState<number | string | null>(PEEK_SNAP);

  /**
   * Set while a downward swipe that would have dismissed the expanded sheet is
   * being turned into a drop back to the peek.
   *
   * Base UI announces that close in two events — the snap point going to
   * `null`, then the open state going to `false` — and restores the snap point
   * it came from if the close is refused. The flag carries the decision from
   * the first event to the other two: refuse the dismissal, and ignore the
   * restore, because the peek is where the sheet should land, not the height it
   * was dragged from.
   */
  const swipingToPeek = useRef(false);

  /**
   * Which place the sheet on screen belongs to.
   *
   * It lags `slug` by exactly one exit animation, and that lag is the feature.
   * Tapping a second pin used to swap the text inside a sheet that never
   * moved, which read as the same panel rewriting itself — the reader had to
   * notice the letters had changed to know anything had happened. Now the
   * first sheet leaves and a second one arrives, which is the same gesture the
   * map already uses for opening one and needs no noticing at all.
   *
   * Closing is staged the same way for a duller reason: dropping the slug on
   * the way out would empty the sheet before it had finished leaving, so it
   * would slide away blank.
   */
  const [shownSlug, setShownSlug] = useState<string | null>(slug);
  const [open, setOpen] = useState(slug !== null);
  const replacing = slug !== null && shownSlug !== null && slug !== shownSlug;

  useEffect(() => {
    if (slug === shownSlug) return;

    // Opening onto an empty screen: nothing has to leave first.
    if (shownSlug === null) {
      setShownSlug(slug);
      setOpen(true);
      return;
    }

    // Closing, or being replaced. Either way this sheet leaves now and
    // `onOpenChangeComplete` decides what — if anything — arrives after it.
    setOpen(false);
  }, [slug, shownSlug]);

  const query = useQuery({
    ...orpc.places.detail.queryOptions({ input: { slug: shownSlug ?? "" } }),
    enabled: shownSlug !== null,
  });

  /**
   * The replacement's detail, fetched while the outgoing sheet is still
   * leaving.
   *
   * Same query key as above, so this is one request and one cache entry rather
   * than a second fetch — it only starts it earlier. By the time the new sheet
   * has finished sliding in, its content is usually already there, which is
   * what keeps a swap from being an animation followed by a spinner.
   */
  useQuery({
    ...orpc.places.detail.queryOptions({ input: { slug: slug ?? "" } }),
    enabled: replacing,
  });
  // Cached and shared with the filter chips, so the category chip can be right
  // before the place detail has come back.
  const { data: categories = [] } = useQuery(
    orpc.places.categories.queryOptions(),
  );

  const place = query.data;
  const previewCategory = preview?.categoryId
    ? categories.find((category) => category.id === preview.categoryId)
    : undefined;

  // What the drawer shows right now: the detail once it lands, the tile's own
  // version of it until then.
  const shown = place
    ? {
        name: place.name,
        categoryName: place.category.name,
        categoryColor: place.category.color,
        categoryIcon: place.category.icon,
        municipality: place.municipality.name,
      }
    : preview
      ? {
          name: preview.name,
          categoryName: previewCategory?.name ?? null,
          categoryColor: previewCategory?.color ?? null,
          categoryIcon: previewCategory?.icon,
          municipality: null,
        }
      : null;

  const CategoryIcon = categoryIcon(shown?.categoryIcon);
  const save = useToggleSaved(place?.id ?? "");

  // The share sheet, the clipboard, or a selection copy — `shareUrl` picks
  // whichever the browser actually has, and says what it did so the toast can
  // be honest about it.
  async function sharePlace() {
    if (!place) return;
    const outcome = await shareUrl({
      url: `${window.location.origin}/mapa?lugar=${place.slug}`,
      title: place.name,
    });
    if (outcome === "copied") toast.success(t("copied"));
    if (outcome === "failed") toast.error(t("copyFailed"));
  }

  // A new place starts at the peek and closes the report form the last one may
  // have left open.
  useEffect(() => {
    if (shownSlug === null) return;
    setReporting(false);
    setSnapPoint(PEEK_SNAP);
    swipingToPeek.current = false;
  }, [shownSlug]);

  const placeId = place?.id;
  const placeSlug = place?.slug;
  const lng = place?.location.lng;
  const lat = place?.location.lat;

  /**
   * Only the place the URL is currently asking for is reported.
   *
   * The detail on screen lags the URL by one exit animation, and the sheet that
   * is still leaving belongs to the *previous* place — reporting that one would
   * fly the map to where the reader has just navigated away from, and then fly
   * it again a moment later when the replacement lands.
   */
  useEffect(() => {
    if (placeId === undefined || placeSlug !== slug) return;
    if (lng === undefined || lat === undefined) return;
    onResolved?.({ id: placeId, slug: placeSlug, lng, lat });
  }, [placeId, placeSlug, slug, lng, lat, onResolved]);

  const expanded = snapPoint === FULL_SNAP;
  const raised = snapPoint !== PEEK_SNAP;
  // Until the sheet is at its top rest position, dragging inside it should
  // raise it rather than scroll it — Base UI hands a drag to whichever
  // scrollable element is under the finger, so the way to be dragged is to
  // stop being scrollable.
  const bodyScrolls = isDesktop || expanded;

  return (
    <Drawer
      open={open}
      // Only a person closing the sheet reaches this; the staged close above
      // sets the state directly, so a swap never reads as a dismissal.
      onOpenChange={(next, details) => {
        // The swipe that just refused to dismiss the sheet. It stays open at
        // the peek; the snap point restore that follows is turned away below.
        if (!next && swipingToPeek.current) {
          details.cancel();
          return;
        }
        if (!next) onClose();
      }}
      // The outgoing sheet has left. Whatever the URL says now is what arrives.
      onOpenChangeComplete={(next) => {
        if (next || slug === shownSlug) return;
        setShownSlug(slug);
        setOpen(slug !== null);
      }}
      snapPoints={isDesktop ? undefined : SNAP_POINTS}
      // Always a value, never `undefined`: Base UI decides controlled versus
      // uncontrolled on the first render, and `useMediaQuery` reports mobile
      // during hydration, so handing it `undefined` once the desktop query
      // matched would be switching the drawer's nature underneath it.
      snapPoint={isDesktop ? null : snapPoint}
      onSnapPointChange={(next, details) => {
        // Pulling the expanded sheet down goes back to the peek rather than
        // off the screen. A full sheet covers the map, so the gesture that
        // gets rid of it is also the gesture for seeing what is underneath —
        // and losing the place because you wanted a look at the street is the
        // kind of thing you only forgive an app once. From the peek the same
        // pull does close it, so nothing is trapped: down twice, or a tap on
        // the map.
        if (next === null && snapPoint !== PEEK_SNAP) {
          details.cancel();
          swipingToPeek.current = true;
          setSnapPoint(PEEK_SNAP);
          return;
        }
        // Base UI putting back the height the refused swipe started from.
        if (swipingToPeek.current) {
          swipingToPeek.current = false;
          details.cancel();
          return;
        }
        setSnapPoint(next);
      }}
      // One pull, one snap point: without this a quick flick from the top
      // skips the peek entirely, which is the jump this is here to prevent.
      snapToSequentialPoints={!isDesktop}
      showSwipeHandle={!isDesktop}
      swipeDirection={isDesktop ? "right" : "down"}
      // Not modal: the map stays pannable with the drawer open, so someone can
      // look around without dismissing what they just tapped.
      modal={false}
      // ...and a press outside is not a dismissal either. Tapping a second pin
      // is a press outside *and* a selection: letting both run raced a close
      // against an open on the same URL, and the drawer sometimes lost. The map
      // closes it explicitly when the tap lands on empty ground instead.
      disablePointerDismissal
    >
      <DrawerContent
        // A swap is two animations back to back, so each is shortened: at the
        // full 450 ms out and in, tapping between two pins takes most of a
        // second. `--drawer-swipe-strength` is the primitive's own knob for the
        // exit; the class handles the entrance.
        className={cn(replacing && "duration-250")}
        style={
          replacing
            ? ({ "--drawer-swipe-strength": 0.55 } as React.CSSProperties)
            : undefined
        }
      >
        {reporting && place ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* The form carries its own heading, but the drawer still needs an
                accessible name while it is showing. */}
            <DrawerTitle className="sr-only">
              {t("reportForm.title")}
            </DrawerTitle>
            <PlaceReportForm
              placeId={place.id}
              placeName={place.name}
              onCancel={() => setReporting(false)}
              onDone={() => setReporting(false)}
            />
          </div>
        ) : (
          // No animation of its own: the sheet it lives in is the thing that
          // moves now, and playing the contents in on top of that entrance
          // would be two arrivals for one tap.
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-start gap-3 px-5 pt-2 pb-4 md:pt-5">
              <div className="min-w-0 flex-1">
                <DrawerTitle className="text-balance text-left font-semibold text-xl leading-tight">
                  {shown?.name ?? (
                    <span className="flex items-center gap-2 text-base text-muted-foreground">
                      <Spinner className="size-4" /> {t("loading")}
                    </span>
                  )}
                </DrawerTitle>

                {shown && (
                  <DrawerDescription className="mt-2 flex flex-wrap items-center gap-2 text-left">
                    {shown.categoryName && (
                      <Badge
                        variant="secondary"
                        className="gap-1.5 border"
                        style={{
                          borderColor: shown.categoryColor ?? undefined,
                        }}
                      >
                        <CategoryIcon
                          className="size-3.5"
                          style={{ color: shown.categoryColor ?? undefined }}
                          aria-hidden
                        />
                        {shown.categoryName}
                      </Badge>
                    )}
                    {shown.municipality && (
                      <span className="text-sm">{shown.municipality}</span>
                    )}
                    {/* The street, as a subtitle rather than its own card: from
                        the map it duplicates the pin already on screen. */}
                    {place?.address && (
                      <span className="w-full text-muted-foreground text-sm">
                        {place.address}
                      </span>
                    )}
                  </DrawerDescription>
                )}
              </div>

              {/* Swiping is a shortcut, never the only way. WCAG 2.2 (2.5.7)
                  asks for a single-tap alternative to every drag, and someone
                  who has never met a bottom sheet does not know the handle
                  moves — so on a phone the sheet can be raised, lowered and
                  closed with buttons as well. */}
              <div className="-mr-1 flex shrink-0 items-center gap-1">
                {!isDesktop && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 rounded-full"
                    aria-label={expanded ? t("collapse") : t("expand")}
                    aria-expanded={raised}
                    onClick={() => setSnapPoint(nextSnap(snapPoint))}
                  >
                    {expanded ? (
                      <ChevronDown className="size-5" aria-hidden />
                    ) : (
                      <ChevronUp className="size-5" aria-hidden />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 rounded-full bg-muted/70 md:size-9 md:bg-transparent"
                  aria-label={t("close")}
                  onClick={onClose}
                >
                  <X className="size-5 md:size-4" aria-hidden />
                </Button>
              </div>
            </div>

            {/* Directions is the primary action; everything else lives behind
                one overflow menu instead of competing with it. */}
            <div className="flex shrink-0 gap-2 border-b px-5 pb-4">
              <Button
                className="h-11 flex-1 text-[15px]"
                nativeButton={false}
                disabled={!place}
                render={
                  place ? (
                    // biome-ignore lint/a11y/useAnchorContent: Base UI renders the button's own label and icon inside this anchor.
                    <a
                      href={directionsUrl(
                        {
                          lat: place.location.lat,
                          lng: place.location.lng,
                          label: place.name,
                        },
                        detectPlatform(navigator.userAgent),
                      )}
                      target="_blank"
                      rel="noreferrer"
                    />
                  ) : (
                    <span />
                  )
                }
              >
                <Compass className="size-5" aria-hidden />
                {t("directions")}
              </Button>

              {place && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-11 shrink-0"
                        aria-label={t("more")}
                      />
                    }
                  >
                    <Ellipsis className="size-5" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    // Sized to the longest row, not to the ••• button: the
                    // default `w-(--anchor-width)` plus `min-w-32` wrapped
                    // every label mid-word. Rows stay on one line with room
                    // to breathe instead.
                    className="w-max min-w-48 p-1.5"
                  >
                    {save.signedIn && (
                      <DropdownMenuItem
                        onClick={() => save.toggle.mutate(!save.saved)}
                        className="gap-2.5 whitespace-nowrap px-3 py-2.5"
                      >
                        {save.saved ? (
                          <BookmarkCheck className="size-4" aria-hidden />
                        ) : (
                          <Bookmark className="size-4" aria-hidden />
                        )}
                        {save.saved ? savedCopy("remove") : savedCopy("add")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => void sharePlace()}
                      className="gap-2.5 whitespace-nowrap px-3 py-2.5"
                    >
                      <Share2 className="size-4" aria-hidden />
                      {t("share")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setReporting(true)}
                      className="gap-2.5 whitespace-nowrap px-3 py-2.5"
                    >
                      <TriangleAlert className="size-4" aria-hidden />
                      {t("report")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div
              className={cn(
                "min-h-0 flex-1 overscroll-contain",
                bodyScrolls ? "overflow-y-auto" : "overflow-hidden",
              )}
            >
              {place && (
                // Keyed by the place: the drawer swaps its contents rather
                // than remounting, and a carousel left mid-swipe would open
                // the next place on its second photo.
                <PlaceGallery
                  key={place.id}
                  name={place.name}
                  imageUrl={place.imageUrl}
                  photos={place.photos}
                />
              )}

              {/* Blocks separated by a hairline rather than each sitting in its
                  own tinted card. Inside a sheet that is already a surface,
                  boxing every section stacked three greys on top of each other
                  and made the sheet read as a list of widgets instead of one
                  page about one place. */}
              <div className="flex flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] [&>*]:border-t [&>*]:py-5 [&>*:first-child]:border-t-0">
                {query.isError && (
                  <p
                    role="alert"
                    className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
                  >
                    {t("loadError")}
                  </p>
                )}

                {place?.description && (
                  <p className="text-pretty text-[15px] leading-7">
                    {place.description}
                  </p>
                )}

                {/* Between the description and the trust vote: who runs a
                    colmado is part of what the place *is*, where "is it still
                    there" is a question about it. */}
                {place && (
                  <BusinessPanel placeId={place.id} placeName={place.name} />
                )}

                {place && (
                  <StampVisit
                    key={place.id}
                    placeId={place.id}
                    slug={place.slug}
                  />
                )}

                {place && (
                  <PlaceTrust
                    placeId={place.id}
                    slug={place.slug}
                    trust={place.trust}
                    myVerdict={place.myVerdict}
                    isMine={place.isMine}
                  />
                )}

                {place && (
                  <PlacePhotos
                    placeId={place.id}
                    slug={place.slug}
                    photoCount={place.photos.length}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
