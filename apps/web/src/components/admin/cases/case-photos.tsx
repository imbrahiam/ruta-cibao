"use client";

import { Maximize2 } from "lucide-react";
import { useState } from "react";
import { MediaViewer } from "@/components/admin/media-viewer";

type CasePhoto = {
  url: string;
  alt: string | null;
  width: number;
  height: number;
};

/**
 * A case's photos as an even grid of thumbnails; any of them opens the shared
 * viewer, where the reviewer can zoom and step through the rest.
 */
export function CasePhotos({
  photos,
  label,
}: {
  photos: CasePhoto[];
  label: (index: number) => string;
}) {
  const [viewing, setViewing] = useState<number | null>(null);

  return (
    <>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <li key={photo.url}>
            <button
              type="button"
              onClick={() => setViewing(index)}
              aria-label={label(index)}
              className="group relative block aspect-[4/3] w-full overflow-hidden rounded-(--radius-field) border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {/* Signed storage URLs also cover pending moderation imagery. */}
              {/* biome-ignore lint/performance/noImgElement: private signed object URL */}
              <img
                src={photo.url}
                alt={photo.alt ?? ""}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                decoding="async"
                className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
              />
              <span
                aria-hidden
                className="absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <Maximize2 className="size-3.5" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <MediaViewer
        items={photos.map((photo) => ({
          kind: "image",
          src: photo.url,
          alt: photo.alt ?? "",
        }))}
        index={viewing}
        onIndexChange={setViewing}
      />
    </>
  );
}
