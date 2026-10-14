import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import type { client } from "@/lib/orpc";

type Place = Awaited<ReturnType<typeof client.places.browse>>["items"][number];

/**
 * One place in the directory's photo grid.
 *
 * The picture on a soft tile, the name under it rather than over it — words on
 * a photograph are a contrast gamble on a cheap screen in sunlight, and words
 * under it never are. No shadow: the tile separates from the page by tone.
 * A place without a photo shows its category's pictogram on its colour, so
 * the grid never has a broken-image hole in it.
 */
export function PlaceTile({
  place,
  priority = false,
}: {
  place: Place;
  priority?: boolean;
}) {
  const t = useTranslations("discover");
  const Icon = categoryIcon(place.categoryIcon);
  return (
    <Link
      href={`/mapa?lugar=${encodeURIComponent(place.slug)}`}
      className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <span
        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-secondary"
        style={
          place.imageUrl
            ? undefined
            : { backgroundColor: `${place.categoryColor}1a` }
        }
      >
        {place.imageUrl ? (
          <Image
            src={place.imageUrl}
            alt={t("imageAlt", { name: place.name })}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 270px, (min-width: 768px) 33vw, 50vw"
            className="object-cover motion-safe:transition-transform motion-safe:duration-250 motion-safe:ease-(--ease-out-soft) motion-safe:group-hover:scale-[1.03]"
            unoptimized={!place.imageUrl.startsWith("/")}
          />
        ) : (
          <Icon
            className="size-10"
            style={{ color: place.categoryColor }}
            aria-hidden
          />
        )}
      </span>
      <span className="mt-2.5 block px-0.5">
        <span className="line-clamp-2 font-semibold text-[17px] leading-snug tracking-[-0.01em] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-2">
          {place.name}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[15px] text-muted-foreground leading-snug">
          {place.municipalityName} · {place.categoryName}
        </span>
      </span>
    </Link>
  );
}
