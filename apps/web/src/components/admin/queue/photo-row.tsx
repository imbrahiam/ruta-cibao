"use client";

import type { ApiOutputs, DecidePhotoInput } from "@ruta/contracts";
import { ImageOff, Maximize2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/web/api";
import { MediaViewer } from "../media-viewer";
import { DecisionBar } from "./decision-bar";
import { ItemRow, MunicipalityTag, usePerson, useWhen } from "./item-parts";
import { type Body, useDecision } from "./use-decision";

export type PendingPhoto = ApiOutputs["moderation"]["queue"]["photos"][number];

export function PhotoRow({ photo }: { photo: PendingPhoto }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const [broken, setBroken] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const { decide, pending, error } = useDecision<Body<DecidePhotoInput>>(
    (input) => api.moderation.decidePhoto(input),
    { queue: "photos", id: photo.id },
  );

  return (
    <ItemRow
      titleId={`${id}-title`}
      title={photo.placeName}
      meta={<MunicipalityTag name={photo.municipalityName} />}
      byline={
        <>
          {person("uploadedBy", photo.uploadedBy)}
          {when("receivedAt", photo.createdAt)}
        </>
      }
      detail={
        broken ? (
          <div className="flex h-40 w-64 max-w-full flex-col items-center justify-center gap-2 rounded-(--radius-field) border bg-muted p-4 text-center text-muted-foreground">
            <ImageOff aria-hidden className="size-5 shrink-0" />
            <p role="status" className="text-sm">
              {q("photoUnavailable")}
            </p>
            <Button
              variant="outline"
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
              className="relative block w-64 max-w-full overflow-hidden rounded-(--radius-field) border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {/* biome-ignore lint/performance/noImgElement: arbitrary uploaded host, reviewed as-is */}
              <img
                src={photo.url}
                alt={q("photoAlt", { place: photo.placeName })}
                loading="lazy"
                decoding="async"
                onError={() => setBroken(true)}
                className="h-40 w-full object-cover"
              />
              <span
                aria-hidden
                className="absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
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
        )
      }
      decision={
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
      }
    />
  );
}
