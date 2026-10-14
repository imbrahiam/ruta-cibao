import { openapi } from "@orpc/openapi";
import { z } from "zod";
import {
  passportInput,
  passportOutput,
  stampInput,
  stampResult,
} from "@/modules/passport/contracts";
import {
  passportStatus,
  readPassport,
  stampVisit,
} from "@/modules/passport/service";
import { memberProcedure } from "../base";

export const passportRouter = {
  list: memberProcedure
    .meta(openapi({ method: "GET", path: "/passport" }))
    .input(passportInput)
    .output(passportOutput)
    .handler(({ context, input }) =>
      readPassport(context.db, context.viewer, input),
    ),
  status: memberProcedure
    .meta(openapi({ method: "GET", path: "/passport/places/{placeId}" }))
    .input(z.object({ placeId: z.uuid() }))
    .output(z.object({ stampedAt: z.iso.datetime().nullable() }))
    .handler(({ context, input }) =>
      passportStatus(context.db, context.viewer, input.placeId),
    ),
  stamp: memberProcedure
    .meta(openapi({ method: "POST", path: "/passport/stamps" }))
    .input(stampInput)
    .output(stampResult)
    .handler(({ context, input }) => stampVisit(context.viewer, input)),
};
