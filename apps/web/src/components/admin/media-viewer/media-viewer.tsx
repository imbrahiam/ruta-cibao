"use client";

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Play,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  type JSX,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "use-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  clampTransform,
  IDENTITY,
  MIN_SCALE,
  panBy,
  type ViewBounds,
  type ViewTransform,
  zoomAt,
} from "./viewer-transform";

export type ViewerMedia = {
  kind: "image" | "video";
  src: string;
  /** A small already-cached variant for the strip; falls back to `src`. */
  thumb?: string;
  alt: string;
};

type MediaViewerProps = {
  items: ViewerMedia[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
};

type Point = { x: number; y: number };
type Gesture = {
  start: Point;
  startedAt: number;
  startedScale: number;
  pointerType: string;
  distance: number;
  multiple: boolean;
};

const loadedImageSources = new Set<string>();

function DelayedSpinner() {
  const t = useTranslations("admin.queue.viewer");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(true), 300);
    return () => window.clearTimeout(timeout);
  }, []);

  return visible ? (
    <Spinner aria-label={t("loading")} className="absolute size-7 text-white" />
  ) : null;
}

/**
 * The viewer is always light-on-black, whatever the desk theme: its controls
 * carry their own colours instead of reading theme tokens. Pass `href` for a
 * link that opens in a new tab, `onClick` for an action.
 */
function ViewerButton({
  label,
  pressed,
  disabled,
  href,
  onClick,
  className,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const classes = cn(
    "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white outline-none transition-colors hover:bg-white/15 active:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-pressed:bg-white/20 aria-disabled:pointer-events-none aria-disabled:opacity-40 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:size-5",
    className,
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        aria-label={label}
        className={classes}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      className={classes}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function MediaViewer({
  items,
  index,
  onIndexChange,
}: MediaViewerProps): JSX.Element {
  const openerRef = useRef<HTMLElement | null>(null);
  const current = index === null ? undefined : items[index];

  return (
    <Dialog
      open={current !== undefined}
      onOpenChange={(open) => {
        if (!open) onIndexChange(null);
      }}
    >
      <DialogContent
        data-fullscreen
        showCloseButton={false}
        className="fixed inset-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-black p-0 text-white shadow-none outline-none data-[state=closed]:animate-none data-[state=open]:animate-none motion-reduce:transition-none sm:max-w-none"
        onOpenAutoFocus={() => {
          openerRef.current = document.activeElement as HTMLElement | null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          openerRef.current?.focus();
        }}
      >
        {current && index !== null && (
          <ViewerSession
            key={`${index}:${current.src}`}
            items={items}
            current={current}
            index={index}
            onIndexChange={onIndexChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ViewerSession({
  items,
  index,
  current,
  onIndexChange,
}: MediaViewerProps & { index: number; current: ViewerMedia }) {
  const t = useTranslations("admin.queue.viewer");
  const stageRef = useRef<HTMLDivElement>(null);
  const selectedThumbnailRef = useRef<HTMLButtonElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ point: Point; time: number } | null>(null);
  const transformRef = useRef<ViewTransform>(IDENTITY);
  const [transform, setTransform] = useState<ViewTransform>(IDENTITY);
  const [animated, setAnimated] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [image, setImage] = useState(() => ({
    width: 0,
    height: 0,
    status: loadedImageSources.has(current.src) ? "ready" : "loading",
  }));
  const [retry, setRetry] = useState(0);
  const isImage = current.kind === "image";
  const canZoom = isImage && image.status === "ready";
  const fit =
    image.width && image.height
      ? Math.min(stage.width / image.width, stage.height / image.height)
      : 0;
  const bounds = useMemo<ViewBounds>(
    () => ({
      stageWidth: stage.width,
      stageHeight: stage.height,
      contentWidth: image.width * fit,
      contentHeight: image.height * fit,
    }),
    [stage.width, stage.height, image.width, image.height, fit],
  );
  const view = clampTransform(transform, bounds);

  const updateTransform = useCallback(
    (next: ViewTransform, animate = false) => {
      transformRef.current = next;
      setTransform(next);
      setAnimated(animate);
    },
    [],
  );

  const imageRef = useCallback(
    (element: HTMLImageElement | null) => {
      if (element?.complete && element.naturalWidth > 0) {
        loadedImageSources.add(current.src);
        setImage({
          width: element.naturalWidth,
          height: element.naturalHeight,
          status: "ready",
        });
      }
    },
    [current.src],
  );

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    // A phone's toolbar resizing the stage must not drop the current zoom;
    // operations and rendering clamp against the new bounds instead.
    const measure = () =>
      setStage({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const neighbors = new Set([
      (index + items.length - 1) % items.length,
      (index + 1) % items.length,
    ]);
    for (const neighbor of neighbors) {
      const item = items[neighbor];
      if (item?.kind === "image" && !loadedImageSources.has(item.src)) {
        const preload = new Image();
        preload.onload = () => loadedImageSources.add(item.src);
        preload.src = item.src;
      }
    }
  }, [index, items]);

  useEffect(() => {
    selectedThumbnailRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, []);

  const pointAt = (clientX: number, clientY: number): Point => {
    const rect = stageRef.current?.getBoundingClientRect() ?? new DOMRect();
    return {
      x: clientX - rect.left - rect.width / 2,
      y: clientY - rect.top - rect.height / 2,
    };
  };

  const changeZoom = (scale: number, point: Point = { x: 0, y: 0 }) => {
    if (canZoom)
      updateTransform(zoomAt(transformRef.current, scale, point, bounds), true);
  };

  const toggleZoom = (point: Point) => {
    changeZoom(transformRef.current.scale > MIN_SCALE ? MIN_SCALE : 2.5, point);
  };

  useEffect(() => {
    const element = stageRef.current;
    if (!element || !canZoom) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = transformRef.current;
      // Two-finger trackpad scrolling reports horizontal or fractional
      // deltas; a mouse wheel reports whole vertical steps and zooms.
      if (
        !event.ctrlKey &&
        current.scale > MIN_SCALE &&
        (event.deltaX !== 0 || !Number.isInteger(event.deltaY))
      ) {
        updateTransform(panBy(current, -event.deltaX, -event.deltaY, bounds));
        return;
      }
      const rect = element.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      };
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      updateTransform(
        zoomAt(
          current,
          current.scale * Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.002)),
          point,
          bounds,
        ),
      );
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [canZoom, bounds, updateTransform]);

  const navigate = (direction: number) => {
    if (items.length > 1)
      onIndexChange((index + direction + items.length) % items.length);
  };

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if ((event.target as HTMLElement | null)?.closest?.("video")) return;
    switch (event.key) {
      case "ArrowLeft":
        navigate(-1);
        break;
      case "ArrowRight":
        navigate(1);
        break;
      case "+":
      case "=":
        changeZoom(transformRef.current.scale * 1.5);
        break;
      case "-":
        changeZoom(transformRef.current.scale / 1.5);
        break;
      case "0":
        if (canZoom) updateTransform(IDENTITY, true);
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  });

  useEffect(() => {
    const dialog = stageRef.current?.closest<HTMLElement>(
      '[data-slot="dialog-content"]',
    );
    if (!dialog) return;
    dialog.addEventListener("keydown", handleKeyDown);
    return () => dialog.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("video"))
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) {
      gesture.current = {
        start: point,
        startedAt: performance.now(),
        startedScale: transformRef.current.scale,
        pointerType: event.pointerType,
        distance: 0,
        multiple: false,
      };
    } else if (gesture.current) {
      gesture.current.multiple = true;
      lastTap.current = null;
    }
    setAnimated(false);
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const before = [...pointers.current.values()];
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    if (gesture.current) {
      gesture.current.distance = Math.max(
        gesture.current.distance,
        Math.hypot(
          point.x - gesture.current.start.x,
          point.y - gesture.current.start.y,
        ),
      );
    }
    if (!canZoom) return;
    if (pointers.current.size >= 2) {
      const [oldFirst, oldSecond] = before;
      const [newFirst, newSecond] = pointers.current.values();
      if (!oldFirst || !oldSecond || !newFirst || !newSecond) return;
      const oldDistance = Math.hypot(
        oldSecond.x - oldFirst.x,
        oldSecond.y - oldFirst.y,
      );
      const newDistance = Math.hypot(
        newSecond.x - newFirst.x,
        newSecond.y - newFirst.y,
      );
      if (oldDistance === 0) return;
      const oldMidpoint = {
        x: (oldFirst.x + oldSecond.x) / 2,
        y: (oldFirst.y + oldSecond.y) / 2,
      };
      const newMidpoint = {
        x: (newFirst.x + newSecond.x) / 2,
        y: (newFirst.y + newSecond.y) / 2,
      };
      const zoomed = zoomAt(
        transformRef.current,
        (transformRef.current.scale * newDistance) / oldDistance,
        pointAt(oldMidpoint.x, oldMidpoint.y),
        bounds,
      );
      updateTransform(
        panBy(
          zoomed,
          newMidpoint.x - oldMidpoint.x,
          newMidpoint.y - oldMidpoint.y,
          bounds,
        ),
      );
    } else if (transformRef.current.scale > MIN_SCALE) {
      updateTransform(
        panBy(
          transformRef.current,
          point.x - previous.x,
          point.y - previous.y,
          bounds,
        ),
      );
    }
  };

  const finishPointer = (
    event: PointerEvent<HTMLDivElement>,
    cancelled = false,
  ) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointers.current.size) return;
    setDragging(false);
    const completed = gesture.current;
    gesture.current = null;
    if (!completed || completed.multiple || cancelled) return;
    const elapsed = performance.now() - completed.startedAt;
    const dx = event.clientX - completed.start.x;
    const dy = event.clientY - completed.start.y;
    if (completed.pointerType !== "touch") {
      if (canZoom && completed.distance <= 10 && elapsed <= 300) {
        toggleZoom(pointAt(event.clientX, event.clientY));
      }
      return;
    }
    if (
      completed.startedScale === MIN_SCALE &&
      transformRef.current.scale === MIN_SCALE
    ) {
      if (
        Math.abs(dx) > Math.abs(dy) &&
        (Math.abs(dx) > 60 ||
          (Math.abs(dx) > 20 && Math.abs(dx) / Math.max(elapsed, 1) > 0.5))
      ) {
        lastTap.current = null;
        navigate(dx < 0 ? 1 : -1);
        return;
      }
      if (dy > 120 && dy > Math.abs(dx)) {
        onIndexChange(null);
        return;
      }
    }
    if (!canZoom || completed.distance > 10 || elapsed > 300) return;
    const now = performance.now();
    const point = { x: event.clientX, y: event.clientY };
    const previous = lastTap.current;
    if (
      previous &&
      now - previous.time < 300 &&
      Math.hypot(point.x - previous.point.x, point.y - previous.point.y) < 30
    ) {
      toggleZoom(pointAt(point.x, point.y));
      lastTap.current = null;
    } else {
      lastTap.current = { point, time: now };
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col text-white">
      <DialogTitle className="sr-only">{t("title")}</DialogTitle>
      <DialogDescription className="sr-only">{current.alt}</DialogDescription>
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:px-5">
        <span className="text-sm text-white tabular-nums">
          {items.length > 1
            ? t("counter", { number: index + 1, total: items.length })
            : ""}
        </span>
        <div className="flex items-center gap-1">
          <ViewerButton
            label={t("zoomOut")}
            disabled={!canZoom || view.scale <= MIN_SCALE}
            onClick={() => changeZoom(transformRef.current.scale / 1.5)}
          >
            <ZoomOut />
          </ViewerButton>
          <ViewerButton
            label={view.scale > MIN_SCALE ? t("fit") : t("zoomIn")}
            pressed={view.scale > MIN_SCALE}
            disabled={!canZoom}
            onClick={() => toggleZoom({ x: 0, y: 0 })}
          >
            {view.scale > MIN_SCALE ? <ZoomOut /> : <ZoomIn />}
          </ViewerButton>
          <ViewerButton
            label={t("resetZoom")}
            disabled={!canZoom || view.scale <= MIN_SCALE}
            onClick={() => updateTransform(IDENTITY, true)}
          >
            <RotateCcw />
          </ViewerButton>
          <ViewerButton label={t("openOriginal")} href={current.src}>
            <ExternalLink />
          </ViewerButton>
          <ViewerButton label={t("close")} onClick={() => onIndexChange(null)}>
            <X />
          </ViewerButton>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={stageRef}
          className={cn(
            "relative flex h-full w-full touch-none items-center justify-center overflow-hidden select-none",
            canZoom &&
              (view.scale > MIN_SCALE
                ? dragging
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : "[@media(pointer:fine)]:cursor-zoom-in"),
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => finishPointer(event)}
          onPointerCancel={(event) => finishPointer(event, true)}
          onLostPointerCapture={(event) => finishPointer(event, true)}
        >
          {isImage ? (
            <>
              {image.status === "loading" && <DelayedSpinner />}
              {image.status === "error" ? (
                <div
                  className="flex flex-col items-center gap-3 text-sm text-white"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <p>{t("loadFailed")}</p>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-full border border-white/50 px-4 text-sm font-medium text-white outline-none hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    onClick={() => {
                      setImage({ width: 0, height: 0, status: "loading" });
                      setRetry((value) => value + 1);
                      updateTransform(IDENTITY);
                    }}
                  >
                    {t("retry")}
                  </button>
                </div>
              ) : (
                // biome-ignore lint/performance/noImgElement: arbitrary uploaded host, shown as-is
                <img
                  key={retry}
                  ref={imageRef}
                  src={current.src}
                  alt={current.alt}
                  draggable={false}
                  decoding="async"
                  className={cn(
                    "pointer-events-none h-full w-full object-contain motion-reduce:transition-none",
                    animated && "transition-transform duration-150 ease-out",
                    image.status !== "ready" && "opacity-0",
                  )}
                  style={{
                    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                  }}
                  onLoad={(event) => {
                    loadedImageSources.add(current.src);
                    setImage({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                      status: "ready",
                    });
                  }}
                  onError={() => {
                    loadedImageSources.delete(current.src);
                    setImage({ width: 0, height: 0, status: "error" });
                  }}
                />
              )}
            </>
          ) : (
            // biome-ignore lint/a11y/useMediaCaption: moderation review of uploaded clips has no caption track
            <video
              src={current.src}
              aria-label={current.alt || t("video")}
              controls
              playsInline
              autoPlay
              className="max-h-full max-w-full"
            />
          )}
        </div>
        {items.length > 1 && (
          <>
            <ViewerButton
              className="absolute top-1/2 left-4 hidden -translate-y-1/2 bg-black/60 ring-1 ring-white/30 backdrop-blur-sm md:inline-flex"
              label={t("previous")}
              onClick={() => navigate(-1)}
            >
              <ChevronLeft />
            </ViewerButton>
            <ViewerButton
              className="absolute top-1/2 right-4 hidden -translate-y-1/2 bg-black/60 ring-1 ring-white/30 backdrop-blur-sm md:inline-flex"
              label={t("next")}
              onClick={() => navigate(1)}
            >
              <ChevronRight />
            </ViewerButton>
          </>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-center gap-3 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
        <p
          className="line-clamp-2 w-full max-w-3xl text-center text-sm text-white"
          title={current.alt}
        >
          {current.alt}
        </p>
        {items.length > 1 && (
          // biome-ignore lint/a11y/useSemanticElements: a scrolling thumbnail strip, not a form group
          <div
            className="flex max-w-full gap-2 overflow-x-auto p-1.5"
            role="group"
            aria-label={t("thumbnails")}
          >
            {items.map((item, itemIndex) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: the same source can appear twice; the strip is never reordered
                key={`${itemIndex}:${item.src}`}
                ref={itemIndex === index ? selectedThumbnailRef : undefined}
                type="button"
                aria-label={t("showItem", {
                  kind: item.kind,
                  number: itemIndex + 1,
                  total: items.length,
                })}
                aria-current={itemIndex === index ? "true" : undefined}
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/10 text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                  itemIndex === index
                    ? "ring-2 ring-white"
                    : "opacity-70 ring-1 ring-white/25 hover:opacity-100",
                )}
                onClick={() => onIndexChange(itemIndex)}
              >
                {item.kind === "video" ? (
                  <Play aria-hidden className="size-5" />
                ) : (
                  // biome-ignore lint/performance/noImgElement: arbitrary uploaded host, shown as-is
                  <img
                    src={item.thumb ?? item.src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
