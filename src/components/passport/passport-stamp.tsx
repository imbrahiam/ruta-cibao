"use client";

import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { type CSSProperties, useId } from "react";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import { cn } from "@/lib/utils";

export type StampPlace = {
  name: string;
  slug: string;
  municipalityName: string;
  categoryColor: string;
  categoryIcon?: string;
  imageUrl?: string | null;
};

/** A slight, fixed tilt per position, so the page looks stuck by hand. */
const TILTS = ["-1.5deg", "1deg", "-0.5deg", "1.5deg", "-1deg", "0.5deg"];

/**
 * The circular postmark: the province's name and the day, around a ring.
 *
 * Drawn in the brand green at partial opacity so the photo shows through it,
 * the way ink does. The words come from the catalogue; the SVG only bends them.
 */
function Cancellation({ text, index }: { text: string; index: number }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className="stamp-mark pointer-events-none absolute -top-4 -right-4 size-[5.5rem] text-primary opacity-80 sm:size-24"
      style={
        {
          "--stamp-index": index,
          rotate: "-14deg",
        } as CSSProperties
      }
    >
      <defs>
        <path
          id={id}
          d="M50 50m-37 0a37 37 0 1 1 74 0a37 37 0 1 1-74 0"
          fill="none"
        />
      </defs>
      <circle
        cx="50"
        cy="50"
        r="47"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <circle
        cx="50"
        cy="50"
        r="27"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text
        fill="currentColor"
        fontSize="9.4"
        fontWeight="700"
        letterSpacing="0.6"
      >
        <textPath href={`#${id}`} startOffset="0">
          {text}
        </textPath>
      </text>
      {/* A pin at the centre: the same mark as the app icon. */}
      <path
        d="M50 64s-10-9-10-17a10 10 0 0 1 20 0c0 8-10 17-10 17Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="47" r="3.2" fill="currentColor" />
    </svg>
  );
}

/**
 * A place you have visited, as a postage stamp: perforated paper, the photo
 * (or the category's pictogram), the name under it, and the postmark with the
 * date over the corner.
 */
export function PassportStamp({
  place,
  stampedAt,
  index,
}: {
  place: StampPlace | null;
  stampedAt: string;
  index: number;
}) {
  const t = useTranslations("passport");
  const format = useFormatter();
  const Icon = categoryIcon(place?.categoryIcon ?? "map-pin");
  const date = format
    .dateTime(new Date(stampedAt), {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .replace(/\./g, "")
    .toUpperCase();
  const postmark = t("cancellation", { date });

  const paper = (
    <div className="relative" style={{ rotate: TILTS[index % TILTS.length] }}>
      <div className="stamp-perforated bg-white">
        <div className="p-2">
          <div
            className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-secondary"
            style={
              place && !place.imageUrl
                ? { backgroundColor: `${place.categoryColor}24` }
                : undefined
            }
          >
            {place?.imageUrl ? (
              <Image
                src={place.imageUrl}
                alt=""
                fill
                sizes="(min-width: 1024px) 220px, 45vw"
                className="object-cover"
                unoptimized={!place.imageUrl.startsWith("/")}
              />
            ) : (
              <Icon
                className="size-10"
                style={place ? { color: place.categoryColor } : undefined}
                aria-hidden
              />
            )}
          </div>
          <p className="mt-2 line-clamp-2 min-h-[2.6em] px-0.5 font-semibold text-[15px] leading-tight">
            {place?.name ?? t("unavailablePlace")}
          </p>
        </div>
      </div>
      <Cancellation text={postmark} index={index} />
    </div>
  );

  const label = place
    ? t("stampLabel", {
        name: place.name,
        date: format.dateTime(new Date(stampedAt), {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      })
    : t("unavailablePlace");

  if (!place) {
    return (
      <div role="img" aria-label={label}>
        {paper}
      </div>
    );
  }

  return (
    <Link
      href={`/mapa?lugar=${encodeURIComponent(place.slug)}`}
      aria-label={label}
      className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      {paper}
    </Link>
  );
}

/**
 * A place not visited yet: the stamp's outline, dashed, with its name in it.
 * The empty spaces are the point — they make the goal visible.
 */
export function PassportSlot({ place }: { place: StampPlace }) {
  const t = useTranslations("passport");
  const Icon = categoryIcon(place.categoryIcon ?? "map-pin");
  return (
    <Link
      href={`/mapa?lugar=${encodeURIComponent(place.slug)}`}
      aria-label={t("slotLabel", { name: place.name })}
      className={cn(
        "group flex flex-col rounded-md border-2 border-foreground/20 border-dashed p-2 text-muted-foreground transition-colors",
        "hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4",
      )}
    >
      <span className="flex aspect-[4/5] items-center justify-center">
        <Icon className="size-9 opacity-60" aria-hidden />
      </span>
      <span className="mt-2 line-clamp-2 min-h-[2.6em] px-0.5 font-medium text-[15px] leading-tight">
        {place.name}
      </span>
    </Link>
  );
}
