"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Clock,
  Ellipsis,
  Flag,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  Store,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Placeholder } from "@/components/ui/loading";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Tag } from "@/components/ui/tag";
import { toast } from "@/components/ui/toast";
import { useSignInHref } from "@/hooks/use-sign-in-href";
import { Link, useRouter } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { detectPlatform, directionsUrl } from "@/lib/map/directions";
import { type client, orpc } from "@/lib/orpc";
import { BusinessSheet } from "./business-sheet";
import { CategoryIcon } from "./category-icon";
import { PassportStamp } from "./passport-stamp";
import { PlaceGallery } from "./place-gallery";
import { ReportPlaceSheet } from "./report-place-sheet";

export type PlaceDetailData = Awaited<ReturnType<typeof client.places.detail>>;

/**
 * Everything about one place, in the order a person decides with it: what it
 * is and whether it is still there, how to get there, then the rest.
 */
export function PlaceDetail({
  slug,
  onSelectNearby,
}: {
  slug: string;
  onSelectNearby?: (slug: string) => void;
}) {
  const t = useTranslations("place");
  const query = useQuery(orpc.places.detail.queryOptions({ input: { slug } }));

  if (query.isPending) {
    return (
      <div className="space-y-4 px-5 pt-3 pb-6" aria-busy>
        <Placeholder className="h-5 w-24 rounded-full" />
        <Placeholder className="h-7 w-3/4 rounded-[10px]" />
        <Placeholder className="h-4 w-1/2 rounded-full" />
        <div className="flex gap-2 pt-2">
          <Placeholder className="h-10 w-36 rounded-full" />
          <Placeholder className="h-10 w-28 rounded-full" />
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="px-5 pt-3 pb-8">
        <p className="t-h3">{t("missingTitle")}</p>
        <p className="t-small mt-1.5 text-ink-2">{t("missingBody")}</p>
      </div>
    );
  }

  return <PlaceBody place={query.data} onSelectNearby={onSelectNearby} />;
}

function PlaceBody({
  place,
  onSelectNearby,
}: {
  place: PlaceDetailData;
  onSelectNearby?: (slug: string) => void;
}) {
  const t = useTranslations("place");
  const { isSignedIn } = useAuth();
  const signInHref = useSignInHref();
  const router = useRouter();
  const [reporting, setReporting] = useState(false);
  const [business, setBusiness] = useState(false);
  const claim = useQuery({
    ...orpc.businesses.claimState.queryOptions({
      input: { placeId: place.id },
    }),
  });

  const directions = () => {
    const url = directionsUrl(
      { lat: place.location.lat, lng: place.location.lng, label: place.name },
      detectPlatform(navigator.userAgent),
    );
    window.open(url, "_blank", "noopener");
  };

  const share = async () => {
    const url = `${window.location.origin}/mapa?lugar=${encodeURIComponent(place.slug)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: place.name, url });
      } catch {
        // Closing the share sheet is not an error worth reporting.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success({ title: t("linkCopied") });
  };

  const needMember = (action: () => void) => () => {
    if (!isSignedIn) router.push(signInHref as "/entrar");
    else action();
  };

  const hasContact =
    claim.data?.claimed &&
    (claim.data.contactPhone || claim.data.whatsapp || claim.data.openingHours);

  return (
    <article className="pb-6">
      <header className="px-5 pt-2 pr-14 md:pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[14px] text-ink-2">
            <span
              className="flex size-6 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: place.category.color }}
            >
              <CategoryIcon icon={place.category.icon} className="size-3.5" />
            </span>
            {place.category.name}
          </span>
          <span aria-hidden className="text-ink-4">
            ·
          </span>
          <span className="text-[14px] text-ink-2">
            {place.municipality.name}
          </span>
        </div>
        <h2 className="t-h3 mt-2 text-ink">{place.name}</h2>
        <TrustLine trust={place.trust} />
      </header>

      <div className="scrollbar-none -mb-1 flex gap-2 overflow-x-auto px-5 pt-4 pb-1">
        <Button variant="accent" onClick={directions}>
          <Navigation strokeWidth={1.75} />
          {t("directions")}
        </Button>
        <SaveButton placeId={place.id} />
        <button
          type="button"
          aria-label={t("share")}
          onClick={share}
          className="press inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-ink shadow-ring hover:bg-paper-2 pointer-coarse:size-11"
        >
          <Share2 strokeWidth={1.5} className="size-[18px]" />
        </button>
        <Menu
          trigger={
            <button
              type="button"
              aria-label={t("more")}
              className="press inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-ink shadow-ring hover:bg-paper-2 pointer-coarse:size-11"
            >
              <Ellipsis strokeWidth={1.5} className="size-[18px]" />
            </button>
          }
        >
          <MenuItem onClick={needMember(() => setReporting(true))}>
            <Flag strokeWidth={1.5} />
            {t("report")}
          </MenuItem>
          {claim.data?.claimable || claim.data?.mine ? (
            <MenuItem onClick={needMember(() => setBusiness(true))}>
              <Store strokeWidth={1.5} />
              {claim.data.mine ? t("editBusiness") : t("claimBusiness")}
            </MenuItem>
          ) : null}
        </Menu>
      </div>

      <PlaceGallery
        placeId={place.id}
        placeName={place.name}
        photos={place.photos}
      />

      {place.description ? (
        <p className="t-body mt-5 px-5 text-ink-2">{place.description}</p>
      ) : null}

      {place.address ? (
        <p className="t-small mt-3 flex items-start gap-2 px-5 text-ink-2">
          <MapPin
            strokeWidth={1.5}
            className="mt-0.5 size-4 shrink-0 text-ink-3"
          />
          {place.address}
        </p>
      ) : null}

      {hasContact && claim.data ? (
        <Section title={t("businessTitle")}>
          <div className="divide-y divide-line/60 rounded-card bg-paper-2">
            {claim.data.openingHours ? (
              <InfoRow icon={<Clock strokeWidth={1.5} />}>
                {claim.data.openingHours}
              </InfoRow>
            ) : null}
            {claim.data.contactPhone ? (
              <InfoRow icon={<Phone strokeWidth={1.5} />}>
                <a
                  className="text-accent hover:underline"
                  href={`tel:${claim.data.contactPhone}`}
                >
                  {claim.data.contactPhone}
                </a>
              </InfoRow>
            ) : null}
            {claim.data.whatsapp ? (
              <InfoRow icon={<MessageCircle strokeWidth={1.5} />}>
                <a
                  className="text-accent hover:underline"
                  href={`https://wa.me/${claim.data.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener"
                >
                  {t("whatsapp")}
                </a>
              </InfoRow>
            ) : null}
          </div>
        </Section>
      ) : null}

      <StillHere place={place} needMember={needMember} />

      <PassportStamp placeId={place.id} location={place.location} />

      <Nearby place={place} onSelect={onSelectNearby} />

      <ReportPlaceSheet
        open={reporting}
        onOpenChange={setReporting}
        placeId={place.id}
        placeName={place.name}
      />
      {claim.data ? (
        <BusinessSheet
          open={business}
          onOpenChange={setBusiness}
          placeId={place.id}
          placeName={place.name}
          state={claim.data}
        />
      ) : null}
      {!isSignedIn ? (
        <p className="t-small mx-5 mt-6 rounded-card bg-paper-2 px-4 py-3 text-ink-2">
          {t.rich("signInHint", {
            link: (chunks) => (
              <Link
                href={signInHref as "/entrar"}
                className="font-medium text-accent underline-offset-2 hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : null}
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 px-5">
      <h3 className="t-label mb-2.5 text-ink-3">{title}</h3>
      {children}
    </section>
  );
}

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="t-small flex items-center gap-3 px-4 py-3 text-ink [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-3">
      {icon}
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function TrustLine({ trust }: { trust: PlaceDetailData["trust"] }) {
  const t = useTranslations("place.trust");
  const tone =
    trust.state === "doubted"
      ? "text-[color-mix(in_srgb,var(--warning)_75%,var(--ink))]"
      : "text-ink-3";
  return (
    <p className={cx("t-small mt-1.5", tone)}>
      {t(trust.state, {
        confirmations: trust.confirmations,
        doubts: trust.doubts,
      })}
    </p>
  );
}

function SaveButton({ placeId }: { placeId: string }) {
  const t = useTranslations("place");
  const { isSignedIn } = useAuth();
  const signInHref = useSignInHref();
  const router = useRouter();
  const queryClient = useQueryClient();
  const saved = useQuery({
    ...orpc.places.saved.queryOptions(),
    enabled: isSignedIn,
  });
  const isSaved = saved.data?.some((place) => place.id === placeId) ?? false;
  const toggle = useMutation(
    orpc.places.toggleSaved.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: orpc.places.saved.key() });
        toast.success({ title: result.saved ? t("saved") : t("unsaved") });
      },
      onError: () => toast.error({ title: t("saveFailed") }),
    }),
  );

  return (
    <Button
      variant="secondary"
      aria-pressed={isSaved}
      disabled={toggle.isPending}
      onClick={() => {
        if (!isSignedIn) router.push(signInHref as "/entrar");
        else toggle.mutate({ placeId, saved: !isSaved });
      }}
    >
      {isSaved ? (
        <BookmarkCheck strokeWidth={1.75} className="text-accent" />
      ) : (
        <Bookmark strokeWidth={1.5} />
      )}
      {isSaved ? t("savedLabel") : t("save")}
    </Button>
  );
}

/**
 * "Is it still here?" A place is only as good as the last person who walked
 * past it, so the question sits on every place, answered in one tap.
 */
function StillHere({
  place,
  needMember,
}: {
  place: PlaceDetailData;
  needMember: (action: () => void) => () => void;
}) {
  const t = useTranslations("place.stillHere");
  const queryClient = useQueryClient();
  const confirm = useMutation(
    orpc.places.confirm.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.places.detail.key({ input: { slug: place.slug } }),
        });
        toast.success({ title: t("thanks") });
      },
      onError: () => toast.error({ title: t("failed") }),
    }),
  );

  if (place.isMine) return null;

  return (
    <Section title={t("title")}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-paper-2 px-4 py-3">
        <p className="t-small text-ink-2">
          {place.myVerdict
            ? t(place.myVerdict === "exists" ? "answeredYes" : "answeredNo")
            : t("question")}
        </p>
        <div className="flex gap-2">
          {(["exists", "gone"] as const).map((verdict) => (
            <Button
              key={verdict}
              size="sm"
              variant={place.myVerdict === verdict ? "primary" : "secondary"}
              aria-pressed={place.myVerdict === verdict}
              disabled={confirm.isPending}
              onClick={needMember(() =>
                confirm.mutate({ placeId: place.id, verdict }),
              )}
            >
              {place.myVerdict === verdict ? (
                <Check strokeWidth={1.75} />
              ) : null}
              {t(verdict)}
            </Button>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Nearby({
  place,
  onSelect,
}: {
  place: PlaceDetailData;
  onSelect?: (slug: string) => void;
}) {
  const t = useTranslations("place");
  const format = useFormatter();
  const nearby = useQuery(
    orpc.places.nearby.queryOptions({
      input: {
        lng: place.location.lng,
        lat: place.location.lat,
        radiusMeters: 5000,
        limit: 6,
      },
    }),
  );
  const items = (nearby.data ?? [])
    .filter((item) => item.slug !== place.slug)
    .slice(0, 5);
  if (items.length === 0) return null;

  return (
    <Section title={t("nearby")}>
      <ul className="-mx-2">
        {items.map((item) => (
          <li key={item.slug}>
            <button
              type="button"
              onClick={() => onSelect?.(item.slug)}
              className="flex w-full items-center gap-3 rounded-card px-2 py-2.5 text-left hover:bg-paper-2"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-paper-2"
                style={{ color: item.category.color }}
              >
                <CategoryIcon icon={item.category.icon} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-ink">
                  {item.name}
                </span>
                <span className="t-small block text-ink-3">
                  {item.category.name}
                </span>
              </span>
              <span className="font-mono text-[12px] text-ink-3 tabular">
                {item.distanceMeters < 1000
                  ? `${item.distanceMeters} m`
                  : format.number(item.distanceMeters / 1000, "distance")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function PlaceTag({ name, color }: { name: string; color: string }) {
  return (
    <Tag>
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
    </Tag>
  );
}
