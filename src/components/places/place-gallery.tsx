"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { toast } from "@/components/ui/toast";
import { useSignInHref } from "@/hooks/use-sign-in-href";
import { useRouter } from "@/i18n/navigation";
import { errorReason } from "@/lib/errors";
import { client, orpc } from "@/lib/orpc";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type PhotoType = (typeof TYPES)[number];

/**
 * PUT straight to storage with XHR, because only XHR reports upload progress,
 * and on a rural connection a progress bar is the difference between waiting
 * and giving up.
 */
function put(url: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status)));
    xhr.onerror = () => reject(new TypeError("network"));
    xhr.send(file);
  });
}

export function PlaceGallery({
  placeId,
  placeName,
  photos,
}: {
  placeId: string;
  placeName: string;
  photos: string[];
}) {
  const t = useTranslations("place.photos");
  const { isSignedIn } = useAuth();
  const signInHref = useSignInHref();
  const router = useRouter();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const upload = async (file: File) => {
    if (!TYPES.includes(file.type as PhotoType)) {
      toast.error({ title: t("wrongType") });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error({ title: t("tooLarge") });
      return;
    }
    setProgress(0);
    try {
      const { uploadUrl, storageKey } = await client.places.photoUpload({
        placeId,
        contentType: file.type as PhotoType,
        sizeBytes: file.size,
      });
      await put(uploadUrl, file, setProgress);
      const result = await client.places.attachPhoto({ placeId, storageKey });
      toast.success({
        title: result.status === "published" ? t("published") : t("pending"),
      });
      await queryClient.invalidateQueries({
        queryKey: orpc.places.detail.key(),
      });
    } catch (error) {
      const reason = errorReason(error);
      toast.error({
        title: reason === "too_many" ? t("tooMany") : t("failed"),
      });
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };

  const tiles = photos.slice(0, 12);

  return (
    <div className="mt-5">
      <ul className="scrollbar-none flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-5 px-5">
        {tiles.map((url, index) => (
          <li key={url} className="snap-start">
            <button
              type="button"
              onClick={() => setViewing(index)}
              aria-label={t("open", { index: index + 1, total: tiles.length })}
              className="press block overflow-hidden rounded-card bg-paper-2 shadow-ring"
            >
              {/* biome-ignore lint/performance/noImgElement: presigned storage URLs, not optimisable by next/image */}
              <img
                src={url}
                alt=""
                loading="lazy"
                className={
                  index === 0
                    ? "h-40 w-56 object-cover"
                    : "h-40 w-32 object-cover"
                }
              />
            </button>
          </li>
        ))}
        <li className="snap-start">
          <button
            type="button"
            onClick={() =>
              isSignedIn
                ? input.current?.click()
                : router.push(signInHref as "/entrar")
            }
            disabled={progress !== null}
            className="press flex h-40 w-32 flex-col items-center justify-center gap-2 rounded-card bg-paper-2 px-3 text-center text-[14px] text-ink-2 shadow-ring hover:text-ink"
          >
            {progress !== null ? (
              <>
                <span className="font-mono text-[12px] text-ink-3 tabular">
                  {progress}%
                </span>
                <span className="h-1 w-16 overflow-hidden rounded-full bg-paper-3">
                  <span
                    className="block h-full bg-accent transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </span>
                <span className="sr-only" role="status">
                  {t("uploading", { progress })}
                </span>
              </>
            ) : (
              <>
                <ImagePlus strokeWidth={1.5} className="size-5" />
                {photos.length === 0 ? t("addFirst") : t("add")}
              </>
            )}
          </button>
        </li>
      </ul>
      {/* No `capture`, on purpose: the phone then offers both camera and gallery. */}
      <input
        ref={input}
        type="file"
        accept={TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <PhotoViewer
        photos={tiles}
        index={viewing}
        onIndexChange={setViewing}
        title={placeName}
      />
    </div>
  );
}

function PhotoViewer({
  photos,
  index,
  onIndexChange,
  title,
}: {
  photos: string[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  title: string;
}) {
  const t = useTranslations("place.photos");
  const tCommon = useTranslations("common");
  const current = index ?? 0;
  const step = (delta: number) =>
    onIndexChange((current + delta + photos.length) % photos.length);

  return (
    <Dialog.Root
      open={index !== null}
      onOpenChange={(open) => !open && onIndexChange(null)}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-[#121211]/92 transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className="fixed inset-0 z-[70] flex flex-col text-[#f3f2ee] outline-none transition-[opacity,filter] duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[starting-style]:blur-sm"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") step(1);
            if (event.key === "ArrowLeft") step(-1);
          }}
        >
          <div className="flex items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2">
            <Dialog.Title className="min-w-0 flex-1 truncate text-[15px] font-medium">
              {title}
            </Dialog.Title>
            <span className="font-mono text-[12px] opacity-70 tabular">
              {t("counter", { current: current + 1, total: photos.length })}
            </span>
            <Dialog.Close
              aria-label={tCommon("close")}
              className="press flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <X strokeWidth={1.5} className="size-5" />
            </Dialog.Close>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            {photos[current] ? (
              // biome-ignore lint/performance/noImgElement: presigned storage URLs
              <img
                key={photos[current]}
                src={photos[current]}
                alt={t("alt", { name: title, index: current + 1 })}
                className="max-h-full max-w-full rounded-card object-contain animate-fade"
              />
            ) : null}
            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label={t("previous")}
                  onClick={() => step(-1)}
                  className="press absolute left-3 flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <ChevronLeft strokeWidth={1.5} className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label={t("next")}
                  onClick={() => step(1)}
                  className="press absolute right-3 flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <ChevronRight strokeWidth={1.5} className="size-5" />
                </button>
              </>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
