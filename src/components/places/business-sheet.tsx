"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { errorReason } from "@/lib/errors";
import { newIdempotencyKey } from "@/lib/offline/submit";
import { client, orpc } from "@/lib/orpc";

type ClaimState = Awaited<ReturnType<typeof client.businesses.claimState>>;

/**
 * "This is my business": a resident claims a place and, once the municipality
 * approves, keeps its phone, WhatsApp and hours current. Claiming needs a
 * verified cédula, because the claim is a statement about a real person.
 */
export function BusinessSheet({
  open,
  onOpenChange,
  placeId,
  placeName,
  state,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeId: string;
  placeName: string;
  state: ClaimState;
}) {
  const t = useTranslations("place.business");
  const { isCitizen } = useAuth();
  const queryClient = useQueryClient();
  const editing = state.mine;
  const [evidence, setEvidence] = useState("");
  const [phone, setPhone] = useState(state.contactPhone ?? "");
  const [whatsapp, setWhatsapp] = useState(state.whatsapp ?? "");
  const [hours, setHours] = useState(state.openingHours ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await client.businesses.update({
          requestId: newIdempotencyKey(),
          placeId,
          contactPhone: phone,
          whatsapp,
          openingHours: hours,
        });
        toast.success({ title: t("updated") });
      } else {
        await client.businesses.claim({
          requestId: newIdempotencyKey(),
          placeId,
          evidence,
          contactPhone: phone,
          whatsapp,
          openingHours: hours || undefined,
        });
        toast.success({ title: t("claimed"), description: t("claimedHint") });
      }
      await queryClient.invalidateQueries({
        queryKey: orpc.businesses.claimState.key(),
      });
      onOpenChange(false);
    } catch (caught) {
      const reason = errorReason(caught);
      setError(
        reason
          ? t(`errors.${reason}` as "errors.unknown")
          : t("errors.unknown"),
      );
    } finally {
      setBusy(false);
    }
  };

  const evidenceShort = !editing && evidence.trim().length < 20;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t("editTitle") : t("claimTitle")}
      description={placeName}
      footer={
        !editing && !isCitizen ? null : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={busy || evidenceShort}
              onClick={submit}
            >
              {busy ? t("sending") : editing ? t("save") : t("submit")}
            </Button>
          </>
        )
      }
    >
      {!editing && !isCitizen ? (
        <div className="rounded-card bg-paper-2 p-5">
          <BadgeCheck strokeWidth={1.5} className="size-5 text-accent" />
          <p className="mt-3 text-[15px] font-medium">
            {t("citizenOnlyTitle")}
          </p>
          <p className="t-small mt-1 text-ink-2">{t("citizenOnlyBody")}</p>
          <ButtonLink href="/verificar" variant="primary" className="mt-4">
            {t("verify")}
          </ButtonLink>
        </div>
      ) : state.pending && !editing ? (
        <p className="t-body rounded-card bg-paper-2 p-5 text-ink-2">
          {t("pending")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {!editing ? (
            <Field
              htmlFor="claim-evidence"
              label={t("evidence")}
              hint={t("evidenceHint")}
            >
              <Textarea
                id="claim-evidence"
                value={evidence}
                maxLength={600}
                onChange={(event) => setEvidence(event.target.value)}
              />
            </Field>
          ) : null}
          <Field
            htmlFor="business-phone"
            label={t("phone")}
            optional={t("optional")}
          >
            <Input
              id="business-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="809 555 0123"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>
          <Field
            htmlFor="business-whatsapp"
            label={t("whatsapp")}
            optional={t("optional")}
          >
            <Input
              id="business-whatsapp"
              type="tel"
              inputMode="tel"
              placeholder="829 555 0123"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
            />
          </Field>
          <Field
            htmlFor="business-hours"
            label={t("hours")}
            optional={t("optional")}
            hint={t("hoursHint")}
          >
            <Input
              id="business-hours"
              value={hours}
              maxLength={240}
              onChange={(event) => setHours(event.target.value)}
            />
          </Field>
          {error ? (
            <p role="alert" className="t-small text-danger">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
