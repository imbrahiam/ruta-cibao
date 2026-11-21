"use client";

import type { ApiOutputs, DecidePhotoInput } from "@ruta/contracts";
import { ImageOff, Maximize2 } from "lucide-react";
import { useId, useState } from "react";
import { useFormatter, useNow, useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/web/api";
import { MediaViewer } from "../media-viewer";
import { DecisionBar } from "./decision-bar";
import { MunicipalityTag, usePerson, useWhen } from "./item-parts";
import { type Body, useDecision } from "./use-decision";

export type PendingPhoto = ApiOutputs["moderation"]["queue"]["photos"][number];

export function PhotoRow({ photo }: { photo: PendingPhoto }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [broken, setBroken] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const { decide, pending, error } = useDecision<Body<DecidePhotoInput>>(
    (input) => api.moderation.decidePhoto(input),
    { queue: "photos", id: photo.id },
  );

  const created = new Date(photo.createdAt);
  const titleId = `${id}-title`;

  // A tile: the picture first, since it is what is being judged, then where
  // it goes and who sent it, and the decision at the foot.
  return (
    <li
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-3 rounded-(--radius-card) bg-muted/45 p-3"
    >
      {broken ? (
        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-(--radius-field) border bg-muted p-4 text-center text-muted-foreground">
          <ImageOff aria-hidden className="size-5 shrink-0" />
          <p role="status" className="text-sm">
            {q("photoUnavailable")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="pointer-coarse:h-11"
            onClick={() => setBroken(false)}
          >
            {q("viewer.retry")}
          </Button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setViewing(0)}
            aria-label={q("photoOpen", { place: photo.placeName })}
            className="group relative block w-full cursor-zoom-in overflow-hidden rounded-(--radius-field) border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {/* biome-ignore lint/performance/noImgElement: arbitrary uploaded host, reviewed as-is */}
            <img
              src={photo.url}
              alt={q("photoAlt", { place: photo.placeName })}
              loading="lazy"
              decoding="async"
              onError={() => setBroken(true)}
              className="aspect-[4/3] w-full object-cover"
            />
            <span
              aria-hidden
              className="absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100"
            >
              <Maximize2 className="size-3.5" />
            </span>
          </button>
          <MediaViewer
            items={[
              {
                kind: "image",
                src: photo.url,
                alt: q("photoAlt", { place: photo.placeName }),
              },
            ]}
            index={viewing}
            onIndexChange={setViewing}
          />
        </>
      )}
      <div className="flex min-w-0 flex-col gap-1 px-1">
        <h2
          id={titleId}
          title={photo.placeName}
          className="truncate text-[15px] leading-snug font-medium"
        >
          {photo.placeName}
        </h2>
        <p className="truncate text-sm text-muted-foreground">
          <MunicipalityTag name={photo.municipalityName} />
        </p>
        <p className="flex min-w-0 items-baseline gap-1.5 text-[13px] text-muted-foreground">
          <span className="truncate">
            {person("uploadedBy", photo.uploadedBy)}
          </span>
          <time
            dateTime={photo.createdAt}
            title={when("receivedAt", photo.createdAt)}
            className="shrink-0 tabular-nums"
          >
            {format.relativeTime(created, now)}
          </time>
        </p>
      </div>
      <div className="mt-auto px-1 pb-1">
        <DecisionBar
          id={id}
          subject={photo.placeName}
          pending={pending}
          error={error}
          primary={{
            label: t("publish"),
            onConfirm: () => decide({ photoId: photo.id, decision: "publish" }),
          }}
          secondary={{
            label: t("reject"),
            destructive: true,
            confirm: q("photoRejectConfirm"),
            onConfirm: () => decide({ photoId: photo.id, decision: "reject" }),
          }}
        />
      </div>
    </li>
  );
}
