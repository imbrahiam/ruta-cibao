import { openapi } from "@orpc/openapi";
import { z } from "zod";
import { pub } from "../base";

/**
 * Who the caller is, as the UI needs to know it.
 *
 * Deliberately never includes the cédula — not the ciphertext, not the blind
 * index. The platform shows the verified name instead, which keeps the number
 * out of every page, log line and API response.
 */
export const meRouter = {
  get: pub
    .meta(
      openapi({ method: "GET", path: "/me", summary: "The current viewer" }),
    )
    .output(
      z.object({
        kind: z.enum(["anonymous", "visitor", "citizen"]),
        displayName: z.string().nullable(),
        cedulaStatus: z
          .enum(["none", "pending", "verified", "unavailable", "rejected"])
          .nullable(),
        municipalityId: z.string().nullable(),
        verifiedFullName: z.string().nullable(),
      }),
    )
    .handler(async ({ context }) => {
      const viewer = await context.getViewer();

      if (viewer.kind === "anonymous") {
        return {
          kind: "anonymous" as const,
          displayName: null,
          cedulaStatus: null,
          municipalityId: null,
          verifiedFullName: null,
        };
      }

      return {
        kind: viewer.kind,
        displayName: viewer.profile.displayName,
        cedulaStatus: viewer.profile.cedulaStatus,
        municipalityId: viewer.profile.municipalityId,
        verifiedFullName: viewer.profile.verifiedFullName,
      };
    }),
};
