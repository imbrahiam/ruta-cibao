"use server";

import { getTranslations } from "next-intl/server";
import { requireMember } from "@/modules/access/permissions";
import { getServerViewer } from "@/modules/access/server";
import { verifyCedulaInput } from "@/modules/citizen/contracts";
import { verifyCedula } from "@/modules/citizen/verify-cedula";

export type VerifyState = {
  status: "idle" | "verified" | "pending" | "rejected" | "taken" | "invalid";
  message: string | null;
};

export const initialVerifyState: VerifyState = {
  status: "idle",
  message: null,
};

/**
 * The cédula step, as a Server Action.
 *
 * A form post rather than a client fetch, so it works with JavaScript still
 * loading or disabled — which matters on the phones this province actually
 * uses. The same `verifyCedula` service backs the oRPC procedure, so the API
 * and this form can never drift apart.
 */
export async function verifyCedulaAction(
  _previous: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const t = await getTranslations("onboarding.cedula");

  const parsed = verifyCedulaInput.safeParse({
    cedula: formData.get("cedula"),
    municipalityId: formData.get("municipalityId"),
  });

  if (!parsed.success) {
    const tv = await getTranslations("validation");
    return { status: "invalid", message: tv("cedula.format") };
  }

  const viewer = requireMember(await getServerViewer());
  const result = await verifyCedula(viewer, parsed.data);

  switch (result.status) {
    case "verified":
      return {
        status: "verified",
        message: t("verified", { name: result.fullName ?? "" }),
      };
    case "pending":
      return { status: "pending", message: t("pending") };
    case "rejected":
      return { status: "rejected", message: t("rejected") };
    case "taken":
      return { status: "taken", message: t("taken") };
  }
}
