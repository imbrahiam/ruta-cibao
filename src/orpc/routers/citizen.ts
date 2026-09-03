import { openapi } from "@orpc/openapi";
import {
  verifyCedulaInput,
  verifyCedulaOutput,
} from "@/modules/citizen/contracts";
import { verifyCedula } from "@/modules/citizen/verify-cedula";
import { memberProcedure } from "../base";

/**
 * Upgrading a visitor to a verified resident.
 *
 * A member procedure, not a citizen one: the whole point is that the caller is
 * not a citizen yet.
 */
export const citizenRouter = {
  verifyCedula: memberProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/citizen/verify-cedula",
        summary: "Verify a cédula and become a resident",
      }),
    )
    .input(verifyCedulaInput)
    .output(verifyCedulaOutput)
    .handler(({ context, input }) => verifyCedula(context.viewer, input)),
};
