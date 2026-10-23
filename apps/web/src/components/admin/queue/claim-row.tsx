"use client";

import type { ApiOutputs, DecideClaimInput } from "@ruta/contracts";
import { useId } from "react";
import { useTranslations } from "use-intl";
import { Tag } from "@/components/ui/tag";
import { api } from "@/lib/web/api";
import { DecisionBar } from "./decision-bar";
import {
  Fact,
  Facts,
  ItemRow,
  ItemTitle,
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
  const { decide, pending, error, decided } = useDecision<
    Body<DecideClaimInput>
  >((input) => api.moderation.decideClaim(input));

  return (
    <ItemRow
      titleId={`${id}-title`}
      item={
        <>
          <ItemTitle id={`${id}-title`}>{claim.placeName}</ItemTitle>
          <div className="flex flex-wrap gap-1.5">
            <MunicipalityTag name={claim.municipalityName} />
            <Tag tone="accent">{claim.categoryName}</Tag>
          </div>
          <p className="t-small text-ink-2">
            {person("claimedBy", claim.claimedBy)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <ResidentBadge verified={claim.claimantResidentVerified} />
          </div>
          <p className="t-small text-ink-2">
            {when("receivedAt", claim.createdAt)}
          </p>
        </>
      }
      detail={
        <Facts>
          <Fact label={q("evidence")}>{claim.evidence}</Fact>
          <Fact label={q("contactPhone")}>
            {claim.contactPhone ?? q("notProvided")}
          </Fact>
          <Fact label={q("whatsapp")}>
            {claim.whatsapp ?? q("notProvided")}
          </Fact>
          <Fact label={q("openingHours")}>
            {claim.openingHours ?? q("notProvided")}
          </Fact>
        </Facts>
      }
      decision={
        <DecisionBar
          id={id}
          subject={claim.placeName}
          pending={pending}
          error={error}
          decided={decided}
          primary={{
            label: t("approve"),
            onConfirm: () => decide({ claimId: claim.id, decision: "approve" }),
          }}
          secondary={{
            label: t("reject"),
            variant: "danger",
            note: { min: 10, max: 500 },
            onConfirm: (note) =>
              decide({ claimId: claim.id, decision: "reject", note }),
          }}
        />
      }
    />
  );
}
