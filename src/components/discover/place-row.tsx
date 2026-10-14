import { ChevronRight, MapPin } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import type { client } from "@/lib/orpc";

type Place = Awaited<ReturnType<typeof client.places.browse>>["items"][number];

/**
 * One place in the directory, as a list row rather than a poster.
 *
 * A list is for scanning: five or six rows fit on a phone where the old card
 * fitted one and a half, and the category's own colour and icon — the ones the
 * map pins wear — tie the row to what the person will see when they open it.
 */
export function PlaceRow({ place }: { place: Place }) {
  const t = useTranslations("discover");
  const Icon = categoryIcon(place.categoryIcon);
  return (
    <Link
      href={`/mapa?lugar=${encodeURIComponent(place.slug)}`}
      className="group flex min-h-24 items-center gap-4 rounded-2xl p-2 transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div
        className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: `${place.categoryColor}1a` }}
      >
        {place.imageUrl ? (
          <Image
            src={place.imageUrl}
            alt={t("imageAlt", { name: place.name })}
            fill
            sizes="80px"
            className="object-cover"
            unoptimized={!place.imageUrl.startsWith("/")}
          />
        ) : (
          <Icon
            className="size-8"
            style={{ color: place.categoryColor }}
            aria-hidden
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {/* The colour stays on the icon: several category colours are too
            light to carry small text at WCAG AA contrast. */}
        <p className="mb-1 flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
          <Icon
            className="size-3.5"
            style={{ color: place.categoryColor }}
            aria-hidden
          />
          {place.categoryName}
        </p>
        <h3 className="line-clamp-2 font-semibold text-base leading-snug">
          {place.name}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-muted-foreground text-sm">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{place.municipalityName}</span>
        </p>
      </div>
      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground transition-transform motion-safe:group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
