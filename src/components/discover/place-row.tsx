import { useTranslations } from "next-intl";
import { ListRow, RowThumb } from "@/components/ui-patterns/list-row";
import { categoryIcon } from "@/lib/map/category-icons";
import type { client } from "@/lib/orpc";

type Place = Awaited<ReturnType<typeof client.places.browse>>["items"][number];

/**
 * One place in the directory's list view: a 64px photo (or the category's
 * pictogram), the name, and "Municipio · categoría" — the town on every row,
 * because in a three-municipality province that is the first question.
 */
export function PlaceRow({ place }: { place: Place }) {
  const t = useTranslations("discover");
  return (
    <ListRow
      href={`/mapa?lugar=${encodeURIComponent(place.slug)}`}
      leading={
        <RowThumb
          src={place.imageUrl}
          alt={t("imageAlt", { name: place.name })}
          icon={categoryIcon(place.categoryIcon)}
          color={place.categoryColor}
        />
      }
      title={place.name}
      meta={`${place.municipalityName} · ${place.categoryName}`}
    />
  );
}
