"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import { ImageViewer } from "@/components/ui/image-viewer";
import { Progress } from "@/components/ui/progress";
import { client, orpc } from "@/lib/orpc";

/**
 * What the place actually looks like.
 *
 * The file never touches this server: the app hands the browser a URL it may
 * PUT one object to, the phone uploads straight to storage, and only then does
 * it tell the app where the photo landed. A camera roll's worth of megapixels
 * going through a Node process on a small VPS is how a contribution feature
 * becomes an outage.
 *
 * Who took it decides whether it appears. A cédula-verified resident's photo
 * publishes on the spot; anybody else's waits for a moderator. That asymmetry
 * is the return on verifying — and it keeps the queue down to the submissions
 * that genuinely need a person to look.
 */
const ACCEPTED = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 8 * 1024 * 1024;

type PendingPhoto = {
  file: File;
  preview: string;
  /** 0–100 for the PUT to storage. */
  progress: number;
  phase: "uploading" | "attaching" | "error";
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toLocaleString("es-DO", { maximumFractionDigits: 1 })} MB`;
}

/**
 * PUTs without `fetch`, because only XHR reports upload progress — and a
 * multi-megabyte photo on a rural connection with no progress bar reads as a
 * frozen app. Aborting rejects with an AbortError, which the caller treats as
 * a deliberate cancel rather than a failure.
 */
function putFile(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
  register: (xhr: XMLHttpRequest) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error("upload failed"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    xhr.send(file);
  });
}

export function PlacePhotos({
  placeId,
  slug,
  photos,
  name,
}: {
  placeId: string;
  slug: string;
  photos: string[];
  name: string;
}) {
  const t = useTranslations("map.photos");
  const tv = useTranslations("viewer");
  const { viewer } = useAuth();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  const activeRequest = useRef<XMLHttpRequest | null>(null);
  // Whose failure this is: aborting a superseded run must not touch the state
  // a newer pick already wrote.
  const runRef = useRef(0);

  // The preview is an object URL: drop it when the pending photo goes away
  // or the drawer closes, so it never outlives its use.
  useEffect(() => {
    const preview = pending?.preview;
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [pending?.preview]);

  function clearPending() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setPending(null);
  }

  async function startUpload(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error(t("tooLarge"));
      return;
    }
    const run = ++runRef.current;
    clearPending();
    setPending({
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      phase: "uploading",
    });

    try {
      const { uploadUrl, storageKey } = await client.places.photoUpload({
        placeId,
        contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
        sizeBytes: file.size,
      });

      await putFile(
        uploadUrl,
        file,
        (progress) =>
          setPending((current) =>
            current?.phase === "uploading" ? { ...current, progress } : current,
          ),
        (xhr) => {
          activeRequest.current = xhr;
        },
      );
      activeRequest.current = null;

      setPending((current) =>
        current ? { ...current, progress: 100, phase: "attaching" } : current,
      );
      const result = await client.places.attachPhoto({ placeId, storageKey });

      toast.success(
        result.status === "published" ? t("published") : t("queued"),
      );
      await queryClient.invalidateQueries({
        queryKey: orpc.places.detail.queryOptions({ input: { slug } }).queryKey,
      });
      setPending(null);
    } catch (error) {
      // A newer pick already owns the state; a superseded failure stays quiet.
      if (run !== runRef.current) return;
      // Cancelling is a choice, not a failure: no toast, just clear.
      if (error instanceof DOMException && error.name === "AbortError") {
        setPending(null);
        return;
      }
      setPending((current) =>
        current ? { ...current, phase: "error" } : current,
      );
    }
  }

  const signedIn = viewer !== undefined && viewer.kind !== "anonymous";

  if (photos.length === 0 && !signedIn) return null;

  return (
    <div className="flex flex-col gap-2">
      {photos.length > 0 && (
        // A horizontal strip rather than a grid: on a phone it is one swipe,
        // and `scroll-fade-x` says there is more without a scrollbar saying it.
        // Tapping opens the viewer on that photo.
        <div className="-mx-5 flex scroll-fade-x snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1">
          {photos.map((photo, index) => (
            <button
              key={photo}
              type="button"
              onClick={() => setViewIndex(index)}
              className="relative aspect-[4/3] w-56 shrink-0 snap-start overflow-hidden rounded-xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("alt", { name, number: index + 1 })}
            >
              <Image
                src={photo}
                alt=""
                fill
                sizes="14rem"
                className="object-cover"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}
      <ImageViewer
        photos={photos.map((photo, index) => ({
          src: photo,
          alt: t("alt", { name, number: index + 1 }),
        }))}
        index={viewIndex ?? 0}
        onIndexChange={setViewIndex}
        open={viewIndex !== null}
        onOpenChange={(open) => {
          if (!open) setViewIndex(null);
        }}
        title={name}
        counter={
          viewIndex !== null
            ? tv("counter", { current: viewIndex + 1, total: photos.length })
            : ""
        }
        labels={{
          close: tv("close"),
          previous: tv("previous"),
          next: tv("next"),
        }}
      />

      {signedIn && (
        <>
          <input
            ref={input}
            type="file"
            accept={ACCEPTED}
            // No `capture`: the OS then offers both the camera and the photo
            // library, instead of jumping straight into the camera.
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void startUpload(file);
            }}
          />
          {pending ? (
            <Attachment
              state={pending.phase === "error" ? "error" : "uploading"}
            >
              <AttachmentMedia variant="image">
                {/* An object URL, not a remote image: plain img, no optimizer. */}
                {/* biome-ignore lint/performance/noImgElement: blob URL */}
                <img src={pending.preview} alt="" />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{pending.file.name}</AttachmentTitle>
                <AttachmentDescription>
                  {pending.phase === "error"
                    ? t("failed")
                    : pending.phase === "attaching"
                      ? t("saving")
                      : t("uploadingProgress", {
                          percent: pending.progress,
                        })}
                  {" · "}
                  {formatBytes(pending.file.size)}
                </AttachmentDescription>
                {pending.phase !== "error" && (
                  <Progress
                    value={pending.progress}
                    aria-label={t("uploading")}
                    className="mt-1.5"
                  />
                )}
              </AttachmentContent>
              <AttachmentActions>
                {pending.phase === "error" ? (
                  <>
                    <AttachmentAction
                      aria-label={t("retry")}
                      title={t("retry")}
                      onClick={() => void startUpload(pending.file)}
                    >
                      <RotateCcw aria-hidden />
                    </AttachmentAction>
                    <AttachmentAction
                      aria-label={t("dismiss")}
                      title={t("dismiss")}
                      onClick={clearPending}
                    >
                      <X aria-hidden />
                    </AttachmentAction>
                  </>
                ) : (
                  <AttachmentAction
                    aria-label={t("cancel")}
                    title={t("cancel")}
                    onClick={clearPending}
                  >
                    <X aria-hidden />
                  </AttachmentAction>
                )}
              </AttachmentActions>
            </Attachment>
          ) : (
            // A quiet text link rather than a full button: adding a photo is
            // a low-frequency act next to directions and the photo itself.
            <Button
              variant="link"
              className="h-10 w-full"
              onClick={() => input.current?.click()}
            >
              <ImagePlus className="size-4" aria-hidden />
              {photos.length > 0 ? t("addAnother") : t("addFirst")}
            </Button>
          )}

          {viewer?.kind !== "citizen" && (
            <p className="text-center text-muted-foreground text-[11px] leading-relaxed">
              {t("visitorNote")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
