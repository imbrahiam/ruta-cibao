/**
 * One degradation mode per process.
 *
 * The server caches its configuration on first use, which is right for a
 * single deployment but makes a test that flips two providers in one process a
 * lie. Each mode therefore runs in its own process with its own environment,
 * the way a real misconfiguration would.
 */
import { GET as thumbnail } from "@/app/api/places/[id]/thumbnail/route";
import { geocode, isGeocodingEnabled } from "@/lib/geocode";
import { canDeliverEmail, isEmailConfigured, sendEmail } from "@/lib/mail";
import {
  checkNativePushReceipts,
  isPushEnabled,
  sendPushToUser,
} from "@/lib/push";
import { computeDirections } from "@/modules/directions/compute-directions";
import { readiness } from "@/modules/platform/readiness";

const mode = process.argv[2];

async function main(): Promise<unknown> {
  switch (mode) {
    case "directions": {
      try {
        await computeDirections({
          origin: { lng: -71.3, lat: 19.45 },
          destination: { lng: -71.25, lat: 19.47 },
          mode: "drive",
        });
        return { ok: true };
      } catch (error) {
        const failure = error as {
          code?: string;
          data?: { reason?: string };
        };
        return { code: failure.code, reason: failure.data?.reason };
      }
    }
    case "push": {
      const notificationId = crypto.randomUUID();
      return {
        enabled: isPushEnabled(),
        sent: await sendPushToUser("nobody", { notificationId }),
        receipts: await checkNativePushReceipts(),
      };
    }
    case "mail": {
      const error = await sendEmail({
        to: "person@example.invalid",
        subject: "Prueba",
        html: "<p>Prueba</p>",
        text: "Prueba",
      }).then(
        () => null,
        (reason: unknown) =>
          reason instanceof Error ? reason.message : String(reason),
      );
      return {
        configured: isEmailConfigured(),
        canDeliver: canDeliverEmail(),
        error,
      };
    }
    case "readiness": {
      const result = await readiness();
      return result;
    }
    case "geocode": {
      return {
        enabled: isGeocodingEnabled(),
        results: await geocode("Santiago Rodríguez", 3),
      };
    }
    case "thumbnail": {
      const id = crypto.randomUUID();
      const response = await thumbnail(
        new Request(`http://localhost:3000/api/places/${id}/thumbnail`),
        { params: Promise.resolve({ id }) },
      );
      return { status: response.status };
    }
    default:
      throw new Error(`unknown probe mode: ${mode ?? "(none)"}`);
  }
}

console.log(JSON.stringify(await main()));
