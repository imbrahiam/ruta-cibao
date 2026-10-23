import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

export const stampInput = z.object({
  placeId: z.uuid(),
  position: z.object({
    lng: z.number().min(-180).max(180),
    lat: z.number().min(-90).max(90),
  }),
  accuracyMeters: z.number().positive().max(100000),
  capturedAt: z.iso.datetime(),
});
export type StampInput = z.infer<typeof stampInput>;
export const stampResult = z.object({
  id: z.uuid(),
  stampedAt: z.iso.datetime(),
  created: z.boolean(),
});
export const passportInput = z.object({
  offset: z.number().int().min(0).max(100000).default(0),
  limit: z.number().int().min(1).max(50).default(24),
});
export const passportOutput = z.object({
  total: z.number().int(),
  items: z.array(
    z.object({
      id: z.uuid(),
      stampedAt: z.iso.datetime(),
      place: z
        .object({
          name: z.string(),
          slug: z.string(),
          categoryName: z.string(),
          categoryColor: z.string(),
          municipalityName: z.string(),
        })
        .nullable(),
    }),
  ),
});
export type PassportInput = z.infer<typeof passportInput>;
export const passportStatusInput = z.object({ placeId: z.uuid() });
export const passportStatusOutput = z.object({
  stampedAt: z.iso.datetime().nullable(),
});

export const passportContract = {
  list: oc
    .meta(openapi({ method: "GET", path: "/passport" }))
    .input(passportInput)
    .output(passportOutput),
  status: oc
    .meta(openapi({ method: "GET", path: "/passport/places/{placeId}" }))
    .input(passportStatusInput)
    .output(passportStatusOutput),
  stamp: oc
    .meta(openapi({ method: "POST", path: "/passport/stamps" }))
    .input(stampInput)
    .output(stampResult),
};
