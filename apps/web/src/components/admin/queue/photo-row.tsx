"use client";

import type { ApiOutputs, DecidePhotoInput } from "@ruta/contracts";
import { ImageOff } from "lucide-react";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import { api } from "@/lib/web/api";
import { DecisionBar } from "./decision-bar";
import {
  ItemRow,
  ItemTitle,
  MunicipalityTag,
  usePerson,
  useWhen,
} from "./item-parts";
import { type Body, useDecision } from "./use-decision";

export type PendingPhoto = ApiOutputs["moderation"]["queue"]["photos"][number];

export function PhotoRow({ photo }: { photo: PendingPhoto }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const [broken, setBroken] = useState(false);
  const { decide, pending, error, decided } = useDecision<
    Body<DecidePhotoInput>
  >((input) => api.moderation.decidePhoto(input));

  return (
    <ItemRow
      titleId={`${id}-title`}
      item={
        <>
          <ItemTitle id={`${id}-title`}>{photo.placeName}</ItemTitle>
          <div className="flex flex-wrap gap-1.5">
            <MunicipalityTag name={photo.municipalityName} />
          </div>
          <p className="t-small text-ink-2">
            {person("uploadedBy", photo.uploadedBy)}
          </p>
          <p className="t-small text-ink-2">
            {when("receivedAt", photo.createdAt)}
          </p>
        </>
      }
      detail={
        broken ? (
          <div className="flex aspect-[4/3] max-w-sm items-center justify-center gap-2 rounded-card bg-paper-2 p-4 text-ink-2">
            <ImageOff aria-hidden className="size-5 shrink-0" />
            <p className="t-small">{q("photoUnavailable")}</p>
          </div>
        ) : (
          // biome-ignore lint/performance/noImgElement: arbitrary uploaded host, reviewed as-is
          <img
            src={photo.url}
            alt={q("photoAlt", { place: photo.placeName })}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="max-h-80 w-full max-w-sm rounded-card bg-paper-2 object-contain"
          />
        )
      }
      decision={
        <DecisionBar
          id={id}
          subject={photo.placeName}
          pending={pending}
          error={error}
          decided={decided}
          primary={{
            label: t("publish"),
            onConfirm: () => decide({ photoId: photo.id, decision: "publish" }),
          }}
          secondary={{
            label: t("reject"),
            variant: "danger",
            confirm: q("photoRejectConfirm"),
            onConfirm: () => decide({ photoId: photo.id, decision: "reject" }),
          }}
        />
      }
    />
  );
}
