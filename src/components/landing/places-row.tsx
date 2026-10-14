import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import { type LandingPlace, landingPlaces } from "@/modules/landing/overview";
import { PlacesScroller } from "./places-scroller";

/**
 * Places to visit: real, published places, photographs first.
 *
 * Cards you choose between by looking, so the photograph leads and the name
 * sits under it on the page ground — never over the picture, where it would
 * depend on what the sky in that photo happens to look like.
 */
export async function PlacesRow() {
  await connection();
  const [places, t] = await Promise.all([
    landingPlaces(),
    getTranslations("landing.places"),
  ]);

  return (
    <PlacesFrame>
      {places.length === 0 ? (
        <p className="px-5 text-base text-muted-foreground md:px-0">
          {t("empty")}
        </p>
      ) : (
        <PlacesScroller heading={<Heading />}>
          {places.map((place) => (
            <li
              key={place.id}
              className="w-[78%] max-w-[20rem] shrink-0 snap-start sm:w-[17rem] md:w-[calc((100%-3*1.25rem)/4)] md:max-w-none"
            >
              <PlaceCard place={place} />
            </li>
          ))}
        </PlacesScroller>
      )}
    </PlacesFrame>
  );
}

function PlacesFrame({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="places-title"
      className="mx-auto mt-16 mb-20 max-w-6xl md:mt-28 md:mb-28 md:px-5"
    >
      {children}
    </section>
  );
}

async function Heading() {
  const t = await getTranslations("landing.places");
  return (
    <div className="flex min-w-0 flex-1 items-end justify-between gap-4 md:justify-start md:gap-6">
      <h2 id="places-title" className="section-title">
        {t("title")}
      </h2>
      <Link
        href="/explorar"
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full font-semibold text-base text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {t("seeAll")}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

async function PlaceCard({ place }: { place: LandingPlace }) {
  const t = await getTranslations("landing");
  const Icon = categoryIcon(place.categoryIcon);
  return (
    <Link
      href={`/mapa?lugar=${encodeURIComponent(place.slug)}`}
      className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <div className="relative flex aspect-[4/5] items-center md:aspect-square justify-center overflow-hidden rounded-2xl bg-secondary">
        {place.imageUrl ? (
          <>
            <Image
              src={place.imageUrl}
              alt={t("places.imageAlt", { name: place.name })}
              fill
              sizes="(min-width: 768px) 280px, 78vw"
              className="landing-zoom object-cover saturate-[.9]"
              unoptimized={!place.imageUrl.startsWith("/")}
            />
            <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2.5 py-1 font-medium text-[13px] text-white">
              {t("illustration")}
            </span>
          </>
        ) : (
          <Icon className="size-14 text-foreground/25" aria-hidden />
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 font-semibold text-[17px] leading-snug">
        {place.name}
      </h3>
      <p className="mt-0.5 text-base text-muted-foreground">
        {place.municipalityName} · {place.categoryName}
      </p>
    </Link>
  );
}

export async function PlacesSkeleton() {
  const t = await getTranslations("landing.places");
  return (
    <PlacesFrame>
      <div className="mb-5 px-5 md:mb-7 md:px-0">
        <h2 id="places-title" className="section-title">
          {t("title")}
        </h2>
      </div>
      <div className="flex gap-4 overflow-hidden px-5 md:gap-5 md:px-0">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="w-[78%] max-w-[20rem] shrink-0 sm:w-[17rem] md:w-[calc((100%-3*1.25rem)/4)] md:max-w-none"
          >
            <div className="aspect-[4/5] rounded-2xl bg-secondary md:aspect-square" />
            <div className="mt-3 h-5 w-3/4 rounded bg-secondary" />
            <div className="mt-2 h-4 w-1/2 rounded bg-secondary" />
          </div>
        ))}
      </div>
    </PlacesFrame>
  );
}
