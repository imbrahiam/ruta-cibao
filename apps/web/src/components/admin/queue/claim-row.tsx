"use client";

import type { ApiOutputs, DecideClaimInput } from "@ruta/contracts";
import { normalizePhone } from "@ruta/shared/phone";
import { useId } from "react";
import { useTranslations } from "use-intl";
import { api } from "@/lib/web/api";
import { ContactValue } from "../contact/contact-value";
import { DecisionBar } from "./decision-bar";
import {
  ClampedText,
  Fact,
  Facts,
  ItemRow,
  LeadImage,
  MunicipalityTag,
  ResidentBadge,
  usePerson,
  useWhen,
} from "./item-parts";
import { type Body, useDecision } from "./use-decision";

export type PendingClaim = ApiOutputs["moderation"]["queue"]["claims"][number];

export function ClaimRow({ claim }: { claim: PendingClaim }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const { decide, pending, error } = useDecision<Body<DecideClaimInput>>(
    (input) => api.moderation.decideClaim(input),
    { queue: "claims", id: claim.id },
  );

  // The same number twice is one contact, not two rows to compare by eye.
  const phone = claim.contactPhone ? normalizePhone(claim.contactPhone) : null;
  const sameNumber =
    phone !== null &&
    claim.whatsapp !== null &&
    normalizePhone(claim.whatsapp) === phone;

  return (
    <ItemRow
      titleId={`${id}-title`}
      title={claim.placeName}
      lead={
        <LeadImage
          placeImage={claim.placeImage}
          personImage={claim.claimedByImage}
        />
      }
      meta={
        <>
          <MunicipalityTag name={claim.municipalityName} />
          {claim.categoryName}
        </>
      }
      byline={
        <>
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-foreground">
            {person("claimedBy", claim.claimedBy)}
            {claim.claimantResidentVerified ? <ResidentBadge /> : null}
          </span>
          {when("receivedAt", claim.createdAt)}
        </>
      }
      detail={
        <Facts>
          <Fact label={q("evidence")} wide>
            <ClampedText>{claim.evidence}</ClampedText>
          </Fact>
          {sameNumber ? (
            <Fact label={q("phoneAndWhatsapp")}>
              <ContactValue kind="phone" value={claim.contactPhone ?? ""} />
            </Fact>
          ) : (
            <>
              <Fact label={q("contactPhone")}>
                {claim.contactPhone ? (
                  <ContactValue kind="phone" value={claim.contactPhone} />
                ) : null}
              </Fact>
              <Fact label={q("whatsapp")}>
                {claim.whatsapp ? (
                  <ContactValue kind="whatsapp" value={claim.whatsapp} />
                ) : null}
              </Fact>
            </>
          )}
          <Fact label={q("openingHours")} wide>
            {claim.openingHours}
          </Fact>
        </Facts>
      }
      decision={
        <DecisionBar
          id={id}
          subject={claim.placeName}
          pending={pending}
          error={error}
          primary={{
            label: t("approve"),
            onConfirm: () => decide({ claimId: claim.id, decision: "approve" }),
          }}
          secondary={{
            label: t("reject"),
            destructive: true,
            note: { min: 10, max: 500 },
            onConfirm: (note) =>
              decide({ claimId: claim.id, decision: "reject", note }),
          }}
        />
      }
    />
  );
}
