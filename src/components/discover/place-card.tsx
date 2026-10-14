import { ArrowUpRight, MapPin } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import type { client } from "@/lib/orpc";

type Place = Awaited<ReturnType<typeof client.places.browse>>["items"][number];

export function PlaceCard({ place }: { place: Place }) {
  const t = useTranslations("discover");
  const Icon = categoryIcon(place.categoryIcon);
  return (
    <Link
      href={`/mapa?lugar=${encodeURIComponent(place.slug)}`}
      className="surface-card group flex min-w-0 flex-col overflow-hidden transition-[box-shadow,transform] duration-200 hover:shadow-[0_12px_32px_-14px_rgb(0_0_0/0.3)] focus-visible:outline-2 focus-visible:outline-offset-4 motion-safe:hover:-translate-y-0.5"
    >
      <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-accent">
        {place.imageUrl ? (
          <Image
            src={place.imageUrl}
            alt={t("imageAlt", { name: place.name })}
            fill
            sizes="(min-width: 768px) 360px, 100vw"
            className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
            unoptimized={!place.imageUrl.startsWith("/")}
          />
        ) : (
          <Icon className="size-12 text-primary/35" aria-hidden />
        )}
        {place.imageUrl && (
          <Badge className="absolute right-3 bottom-3 bg-white/90 text-foreground">
            {t("illustration")}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2.5 flex items-center gap-1.5 font-medium text-primary text-xs">
          <Icon className="size-3.5" aria-hidden />
          {place.categoryName}
        </div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-base leading-snug tracking-tight">
            {place.name}
          </h3>
          <ArrowUpRight
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:text-primary motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
            aria-hidden
          />
        </div>
        {place.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {place.description}
          </p>
        )}
        <p className="mt-auto flex items-center gap-1.5 pt-5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden />
          {place.municipalityName}
        </p>
      </div>
    </Link>
  );
}
