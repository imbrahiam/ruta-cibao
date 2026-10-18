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
 * mark on paper, never a stock picture. Opens the place on the map.
 */
export function PlaceCard({ place }: { place: PlaceCardData }) {
  return (
    <Link
      href={`/mapa?lugar=${encodeURIComponent(place.slug)}`}
      className="group flex flex-col overflow-hidden rounded-card bg-card shadow-ring transition-shadow duration-200 hover:shadow-md"
    >
      <div
        className={
          place.imageUrl
            ? "relative aspect-[3/2] overflow-hidden bg-paper-2"
            : "relative aspect-[5/2] overflow-hidden bg-paper-2"
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
          <div className="flex size-full items-center justify-center">
            <span
              className="flex size-12 items-center justify-center rounded-full bg-card shadow-sm"
              style={{ color: place.categoryColor }}
            >
              <CategoryIcon
                icon={place.categoryIcon}
                className="size-6"
                strokeWidth={1.5}
              />
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="t-small flex items-center gap-1.5 text-ink-3">
          <span
            aria-hidden
            className="size-1.5 rounded-full"
            style={{ backgroundColor: place.categoryColor }}
          />
          {place.categoryName} · {place.municipalityName}
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
