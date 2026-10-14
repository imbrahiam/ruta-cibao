import type { Map as MapLibreMap } from "maplibre-gl";
import { markerPin, markerSize } from "@/lib/map/marker-pin";

/**
 * The same pins the Google renderer draws, for MapLibre.
 *
 * A symbol layer asks for an image by id (`pinImageId` builds it from the
 * feature's colour, icon and selection); the first time an id is seen, the
 * resolver draws that pin's SVG onto a canvas at twice its size and hands it
 * to the map. One image per category and state, made once, shared by every
 * marker that needs it — so fifty pins cost a handful of draws, and a category
 * added from the admin panel gets its pin without a sprite rebuild.
 */
const PREFIX = "pin|";
const PIXEL_RATIO = 2;

export function installPinResolver(map: MapLibreMap): void {
  map.setMissingStyleImageResolver(async (id) => {
    if (!id.startsWith(PREFIX) || map.hasImage(id)) return;
    const [color, icon, selected] = id.slice(PREFIX.length).split("|");
    if (!color) return;
    const isSelected = selected === "1";
    const { width, height } = markerSize(isSelected);
    const image = new Image();
    image.src = markerPin(color, icon || undefined, isSelected);
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * PIXEL_RATIO);
    canvas.height = Math.ceil(height * PIXEL_RATIO);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (map.hasImage(id)) return;
    map.addImage(id, context.getImageData(0, 0, canvas.width, canvas.height), {
      pixelRatio: PIXEL_RATIO,
    });
  });
}
