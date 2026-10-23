import { ORPCError } from "@orpc/client";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";
import { requestId } from "@/lib/ids";

/** Longest edge sent to the server; enough for a full-width detail photo. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

/**
 * A photo chosen for a contribution, already compressed on the phone. The
 * request id is fixed when the photo is chosen, so retrying an upload after a
 * lost connection reuses the server's reservation instead of making a second.
 */
export type LocalPhoto = {
  uri: string;
  width: number;
  height: number;
  requestId: string;
};

export type PickResult =
  | { status: "picked"; photo: LocalPhoto }
  | { status: "cancelled" }
  | { status: "denied" };

/**
 * Asks for the camera or the library only at the moment of use, then shrinks
 * the image (and drops its EXIF, location included) before it leaves the phone.
 */
export async function pickPhoto(
  source: "camera" | "library",
): Promise<PickResult> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: "denied" };

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 1,
    exif: false,
  };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return { status: "cancelled" };

  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_EDGE) {
    context.resize(
      asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE },
    );
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
  });
  return {
    status: "picked",
    photo: {
      uri: saved.uri,
      width: saved.width,
      height: saved.height,
      requestId: requestId(),
    },
  };
}

/**
 * Reserve, upload and attach one photo to a place. Safe to call again with the
 * same photo after a failure: the reservation is keyed by its request id, and
 * a photo the server already attached comes back without a second upload.
 */
export async function uploadPlacePhoto(
  placeId: string,
  photo: LocalPhoto,
): Promise<"pending" | "published"> {
  const body = await (await fetch(photo.uri)).blob();
  let reservation: Awaited<ReturnType<typeof api.places.photoUpload>>;
  try {
    reservation = await api.places.photoUpload({
      requestId: photo.requestId,
      placeId,
      contentType: "image/jpeg",
      sizeBytes: body.size,
    });
  } catch (error) {
    // Same request id, different bytes: this photo was replaced on the phone
    // after an earlier attempt. Treat it as a new photo.
    if (error instanceof ORPCError && error.code === "CONFLICT") {
      photo.requestId = requestId();
      return uploadPlacePhoto(placeId, photo);
    }
    throw error;
  }
  if (reservation.status !== "upload") return reservation.status;

  const response = await fetch(reservation.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "image/jpeg" },
    body,
  });
  if (!response.ok) throw new Error(`upload failed: ${response.status}`);

  const attached = await api.places.attachPhoto({
    placeId,
    storageKey: reservation.storageKey,
  });
  return attached.status;
}
