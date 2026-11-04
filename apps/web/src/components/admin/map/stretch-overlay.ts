/// <reference types="google.maps" />

import type { LatLng } from "./map-types";
import { roadFillPx } from "./road-stretch";

/**
 * A stretch of road drawn as one solid line of one colour, with round ends and
 * round joins, exactly as wide as the street's fill so it covers the street to
 * its edges and never spills over them.
 *
 * `google.maps.Polyline` has no per-pixel dashes or dots. So this is one SVG
 * layer in the map's own overlay pane: a single path whose width is the
 * basemap's road fill at the current zoom (`roadFillPx`, the weight `mapStyle`
 * paints roads with), redrawn by the same `draw()` the markers use, so it stays
 * on the road while panning and zooming.
 */
export type StretchStyle = {
  color: string;
  /**
   * `solid`: an open stretch. `dots`: a cleared one. `dashes`: a trail. Shape
   * says what colour alone must not.
   */
  pattern: "solid" | "dots" | "dashes";
  selected: boolean;
  zIndex: number;
};

export type StretchOverlay = google.maps.OverlayView & {
  update(path: LatLng[], style: StretchStyle): void;
  onSelect: (() => void) | undefined;
};

const SVG_NS = "http://www.w3.org/2000/svg";

/** A click on the line lands within this many pixels; fingers are not precise. */
const HIT_PX = 28;

/** Points closer than this on screen are one point. */
const MIN_STEP_PX = 0.75;

let overlayClass:
  | (new (
      path: LatLng[],
      style: StretchStyle,
    ) => StretchOverlay)
  | undefined;

function pathElement(parent: SVGElement): SVGPathElement {
  const element = document.createElementNS(SVG_NS, "path");
  element.setAttribute("fill", "none");
  element.setAttribute("stroke-linejoin", "round");
  element.setAttribute("stroke-linecap", "round");
  element.setAttribute("pointer-events", "none");
  parent.append(element);
  return element;
}

function setStroke(
  element: SVGPathElement,
  color: string,
  width: number,
  opacity = 1,
) {
  element.setAttribute("stroke", color);
  element.setAttribute("stroke-width", width.toFixed(2));
  element.setAttribute("stroke-opacity", String(opacity));
}

/** Dots are zero-length dashes with round caps; dashes are plain dashes. */
function setPattern(
  element: SVGPathElement,
  pattern: StretchStyle["pattern"],
  core: number,
) {
  if (pattern === "solid") {
    element.removeAttribute("stroke-dasharray");
    element.setAttribute("stroke-linecap", "round");
  } else if (pattern === "dots") {
    element.setAttribute("stroke-dasharray", `0 ${(core * 2.4).toFixed(2)}`);
    element.setAttribute("stroke-linecap", "round");
  } else {
    element.setAttribute(
      "stroke-dasharray",
      `${(core * 2.4).toFixed(2)} ${(core * 1.8).toFixed(2)}`,
    );
    element.setAttribute("stroke-linecap", "butt");
  }
}

/** Defined lazily: `google.maps.OverlayView` exists only after the load. */
export function createStretchOverlay(
  path: LatLng[],
  style: StretchStyle,
): StretchOverlay {
  overlayClass ??= class extends google.maps.OverlayView {
    onSelect: (() => void) | undefined;
    private readonly svg = document.createElementNS(SVG_NS, "svg");
    private readonly core = pathElement(this.svg);
    private readonly hit = pathElement(this.svg);

    constructor(
      private path: LatLng[],
      private style: StretchStyle,
    ) {
      super();
      // A zero-size origin the paths overflow from, in the pane's own pixels.
      this.svg.setAttribute("width", "1");
      this.svg.setAttribute("height", "1");
      this.svg.style.cssText =
        "position:absolute;left:0;top:0;overflow:visible;pointer-events:none";
      this.hit.setAttribute("stroke", "transparent");
      this.hit.addEventListener("click", () => this.onSelect?.());
    }

    override onAdd() {
      this.getPanes()?.overlayMouseTarget.append(this.svg);
    }

    override onRemove() {
      this.svg.remove();
    }

    override draw() {
      const projection = this.getProjection();
      const map = this.getMap();
      if (!projection || !(map instanceof google.maps.Map)) return;

      let d = "";
      let lastX = Number.NaN;
      let lastY = Number.NaN;
      for (const point of this.path) {
        const pixel = projection.fromLatLngToDivPixel(point);
        if (!pixel) continue;
        if (Math.hypot(pixel.x - lastX, pixel.y - lastY) < MIN_STEP_PX)
          continue;
        d += `${d ? "L" : "M"}${pixel.x.toFixed(1)} ${pixel.y.toFixed(1)}`;
        lastX = pixel.x;
        lastY = pixel.y;
      }
      // A stretch too short to show at this zoom is a dot, not nothing.
      if (!d.includes("L")) d += "h0";

      const { style } = this;
      const core = roadFillPx(map.getZoom() ?? 15);

      for (const element of [this.core, this.hit]) {
        element.setAttribute("d", d);
      }
      setStroke(this.core, style.color, core);
      setPattern(this.core, style.pattern, core);
      this.hit.setAttribute("stroke-width", String(HIT_PX));
      this.hit.setAttribute("stroke-linecap", "round");
      this.hit.setAttribute(
        "pointer-events",
        this.onSelect ? "stroke" : "none",
      );
      this.hit.style.cursor = this.onSelect ? "pointer" : "";
      this.svg.style.zIndex = String(style.zIndex);
    }

    update(path: LatLng[], style: StretchStyle) {
      this.path = path;
      this.style = style;
      this.draw();
    }
  };
  return new overlayClass(path, style);
}
