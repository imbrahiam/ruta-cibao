"use client";

import { useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A marker that is a DOM element rather than a picture of one.
 *
 * `google.maps.Marker` was deprecated in February 2024 in favour of
 * `AdvancedMarkerElement` — which needs a Map ID, and a Map ID makes Google
 * ignore the custom style that is the only way to clear its own listings off
 * this map. Neither losing that toggle nor shipping a deprecation warning was
 * acceptable, so this takes the third road: `OverlayView`, which is not
 * deprecated, needs no Map ID, and hands back a plain div.
 *
 * What that buys beyond silence: the marker is now HTML, so the selected pin
 * can grow with a CSS transition and a new one can drop in, none of which a
 * rasterised icon could do.
 *
 * `anchor` says which part of the element sits on the coordinate — the tip for
 * a pin, the middle for the dot that stands for a person.
 *
 * `label` rides along under the marker without being part of it: outside the
 * button, so growing the selected pin does not also grow its name, and out of
 * the flow, so the anchor stays the tip of the pin rather than the bottom of
 * the text.
 */
type Position = { lat: number; lng: number };

export function GoogleMarker({
  mapId,
  position,
  anchor = "bottom",
  zIndex = 1,
  title,
  selected = false,
  label,
  onClick,
  children,
}: {
  mapId: string;
  position: Position;
  anchor?: "bottom" | "center";
  zIndex?: number;
  title?: string;
  /** Grows the marker with a transition rather than redrawing it larger. */
  selected?: boolean;
  /** Drawn under the marker, unscaled and untappable. */
  label?: React.ReactNode;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const map = useMap(mapId);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);

  // `draw` is called by Google on every pan and zoom, long after this effect
  // ran, so it reads the latest position through a ref rather than closing over
  // the one it was mounted with.
  const positionRef = useRef(position);
  positionRef.current = position;

  useEffect(() => {
    if (!map) return;

    const node = document.createElement("div");
    node.style.position = "absolute";
    node.style.willChange = "transform";

    class MarkerOverlay extends google.maps.OverlayView {
      override onAdd() {
        // `overlayMouseTarget` is the pane that receives pointer events; the
        // others would render the marker and swallow every tap on it.
        this.getPanes()?.overlayMouseTarget.appendChild(node);
      }

      override draw() {
        const point = this.getProjection()?.fromLatLngToDivPixel(
          new google.maps.LatLng(positionRef.current),
        );
        if (!point) return;

        node.style.left = `${point.x}px`;
        node.style.top = `${point.y}px`;
      }

      override onRemove() {
        node.remove();
      }
    }

    const overlay = new MarkerOverlay();
    overlay.setMap(map);
    overlayRef.current = overlay;
    setElement(node);

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
      setElement(null);
    };
  }, [map]);

  useEffect(() => {
    if (!element) return;
    element.style.transform =
      anchor === "center" ? "translate(-50%, -50%)" : "translate(-50%, -100%)";
    element.style.zIndex = String(zIndex);
    element.style.cursor = onClick ? "pointer" : "";
    element.style.pointerEvents = onClick ? "auto" : "none";
    if (title) element.title = title;
  }, [element, anchor, zIndex, onClick, title]);

  // Moving a marker after it is placed — the location dot following a new fix,
  // a search result replacing the last one — repositions it without remounting.
  // Google only calls `draw` when the map itself redraws, so a coordinate that
  // changes on its own has to ask for one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the coordinates are the trigger; `draw` reads them through the ref.
  useEffect(() => {
    overlayRef.current?.draw();
  }, [position.lat, position.lng]);

  if (!element) return null;

  // A pin you can open is a button and says so; the location dot and the
  // search result are not interactive and stay out of the tab order.
  const marker = onClick ? (
    <button
      type="button"
      onClick={(event) => {
        // The marker lives in a pane *inside* the map, so a plain click also
        // reaches the map's own listener — which reads a click on open ground
        // as "close whatever is open". Both fired, the selection was undone
        // on the same tick, and the drawer never appeared. Google's built-in
        // markers stop this internally; an OverlayView has to do it itself.
        event.stopPropagation();
        onClick();
      }}
      // The map begins its gesture handling on pointerdown, and a marker
      // press is not the start of a pan.
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      aria-label={title}
      data-selected={selected || undefined}
      // The growth is a transform, not a bigger image: swapping the pin's
      // width and height is a jump no transition can smooth, while a scale
      // eases and keeps the tip anchored on the coordinate.
      className="block origin-bottom cursor-pointer transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-selected:scale-115 motion-reduce:transition-none"
    >
      {children}
    </button>
  ) : (
    <div className="origin-bottom">{children}</div>
  );

  return createPortal(
    <>
      {marker}
      {label && (
        // The pane element is already positioned, so `top-full` is directly
        // below the marker's box — the tip of the pin — and the text may spill
        // out of it in both directions without moving anything.
        //
        // The fixed width is the whole trick. An absolutely positioned box
        // shrinks to fit, but never wider than the block it is positioned
        // inside — and that block is the marker, which is thirty pixels of pin.
        // Left to itself the name was set in a thirty-pixel column and then
        // clipped to two lines of it, which is why the labels looked like they
        // had not rendered at all. This gives the text a lane of its own,
        // centred on the pin and free to overhang it on both sides.
        //
        // A block, not a flex row: the label clamps itself to two lines with
        // `-webkit-box`, and a flex parent blockifies its children — the
        // computed display came back `flow-root` and the clamp quietly stopped
        // applying. It centres itself in the lane with auto margins instead.
        <span
          aria-hidden
          className="pointer-events-none absolute top-full left-1/2 mt-0.5 block w-40 -translate-x-1/2"
        >
          {label}
        </span>
      )}
    </>,
    element,
  );
}
