"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-context";
import { cn } from "@/lib/utils";

/**
 * Where you are.
 *
 * Signed out, this is the blue dot every map has taught people to read: a
 * filled circle in a white ring with a soft halo standing for accuracy.
 * Deliberately not shaped like a place pin — a person is not a place, and
 * giving them the same silhouette as a clinic would put them in its class.
 *
 * Signed in with a photo, the dot becomes the photo. That is not decoration:
 * on a shared phone, or with a second window open on a desktop, it is the only
 * thing on screen that says *whose* location this is. The ring stays, the halo
 * stays, and the size stays — so it is still the same object in the same place,
 * wearing a face.
 *
 * Real DOM rather than the data URIs the pins use, because an avatar is a real
 * image with a real load state, and because a photo that fails to load has to
 * fall back to something rather than to a broken-image glyph.
 */
const ACCENT = "#1a73e8";

export function LocationMarker() {
  const t = useTranslations("map.actions");
  const { viewer } = useAuth();

  const photo = viewer && viewer.kind !== "anonymous" ? viewer.image : null;
  const initial = viewer?.displayName?.trim().charAt(0).toUpperCase();

  return (
    <span
      className="relative block size-7"
      role="img"
      aria-label={photo ? t("hereWithPhoto") : t("here")}
    >
      {/* The halo pulses to say the fix is live rather than a place you saved.
          Motion-reduce stops it: nothing here is communicated by movement, so
          removing it costs nothing. */}
      <span
        aria-hidden
        className="absolute inset-0 animate-ping rounded-full opacity-40 motion-reduce:animate-none"
        style={{ backgroundColor: ACCENT }}
      />
      <span
        aria-hidden
        className="absolute inset-0 rounded-full opacity-20"
        style={{ backgroundColor: ACCENT }}
      />

      <span
        className={cn(
          "absolute inset-[3px] overflow-hidden rounded-full ring-2 ring-white",
          "flex items-center justify-center shadow-[0_1px_4px_rgba(15,23,42,0.35)]",
        )}
        style={{ backgroundColor: ACCENT }}
      >
        {photo ? (
          // biome-ignore lint/performance/noImgElement: a 21px avatar inside a map overlay is not a content image, and next/image would wrap it in a layout box and a loader.
          <img
            src={photo}
            alt=""
            width={21}
            height={21}
            draggable={false}
            referrerPolicy="no-referrer"
            className="size-full select-none object-cover"
          />
        ) : initial ? (
          <span className="font-semibold text-[10px] text-white leading-none">
            {initial}
          </span>
        ) : null}
      </span>
    </span>
  );
}
