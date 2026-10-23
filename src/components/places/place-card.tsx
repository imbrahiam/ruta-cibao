import { Link } from "@/i18n/navigation";
import { CategoryIcon } from "./category-icon";

export type PlaceCardData = {
  slug: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  municipalityName: string;
};

/**
 * A place, as a card: its photo when it has one, otherwise its category's
 * colour and mark, never a stock picture. Both states keep the same frame, so
 * a row of cards lines up whether or not the place has been photographed yet.
 * Opens the place on the map.
 */
export function PlaceCard({ place }: { place: PlaceCardData }) {
  return (
    <Link
      href={`/mapa?lugar=${encodeURIComponent(place.slug)}`}
      className="group flex flex-col overflow-hidden rounded-card bg-card shadow-ring transition-shadow duration-200 hover:shadow-md"
    >
      <div
        className="relative aspect-[3/2] overflow-hidden bg-paper-2"
        style={
          place.imageUrl
            ? undefined
            : {
                backgroundColor: `color-mix(in srgb, ${place.categoryColor} 13%, var(--paper-2))`,
              }
        }
      >
        {place.imageUrl ? (
          // biome-ignore lint/performance/noImgElement: photos come from storage and seeds, not optimisable here
          <img
            src={place.imageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-[filter] duration-200 group-hover:brightness-[1.06]"
          />
        ) : (
          <>
            <span
              aria-hidden
              className="absolute -right-6 -bottom-8 size-36 rounded-full border-[6px] border-current opacity-[.07]"
              style={{ color: place.categoryColor }}
            />
            <div className="flex size-full items-center justify-center">
              <span
                className="flex size-14 items-center justify-center rounded-full bg-card shadow-sm"
                style={{ color: place.categoryColor }}
              >
                <CategoryIcon
                  icon={place.categoryIcon}
                  className="size-7"
                  strokeWidth={1.5}
                />
              </span>
            </div>
            <span className="t-label absolute bottom-3 left-4 text-ink-3">
              {place.municipalityName}
            </span>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="t-small flex items-center gap-1.5 text-ink-3">
          <span
            aria-hidden
            className="size-1.5 rounded-full"
            style={{ backgroundColor: place.categoryColor }}
          />
          {place.categoryName}
          {place.imageUrl ? <> · {place.municipalityName}</> : null}
        </p>
        <p className="mt-1.5 text-[17px] leading-snug font-medium tracking-[-0.012em] text-ink">
          {place.name}
        </p>
        {place.description ? (
          <p className="t-small mt-1.5 line-clamp-2 text-ink-2">
            {place.description}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
