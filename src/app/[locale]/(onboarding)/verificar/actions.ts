"use server";

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { requireMember } from "@/modules/access/permissions";
import { getServerViewer } from "@/modules/access/server";
import { verifyCedulaInput } from "@/modules/citizen/contracts";
import { verifyCedula } from "@/modules/citizen/verify-cedula";
import type { VerifyState } from "./verify-state";

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
  // The locale rides along in the form: a Server Action has no route context,
  // so resolving it from the `[locale]` segment here would crash. Anything
  // but a known locale falls back to the default rather than trusting the wire.
  const posted = formData.get("locale");
  const locale =
    typeof posted === "string" && hasLocale(routing.locales, posted)
      ? posted
      : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "onboarding.cedula" });

  const parsed = verifyCedulaInput.safeParse({
    cedula: formData.get("cedula"),
    name: formData.get("name"),
    municipalityId: formData.get("municipalityId"),
    confirmNumber: formData.get("confirmNumber") === "1",
  });

  if (!parsed.success) {
    const tv = await getTranslations({ locale, namespace: "validation" });
    const nameIssue = parsed.error.issues.some((issue) =>
      issue.path.includes("name"),
    );
    return {
      status: nameIssue ? "invalid_name" : "invalid",
      message: tv(nameIssue ? "cedula.name" : "cedula.format"),
    };
  }

  const viewer = requireMember(await getServerViewer());
  const result = await verifyCedula(viewer, parsed.data);

  switch (result.status) {
    case "matched":
      return { status: "matched", message: t("matched") };
    case "in_review":
      return { status: "in_review", message: t("inReview") };
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
    case "check_digit":
      return { status: "check_digit", message: t("checkDigit") };
  }
}
