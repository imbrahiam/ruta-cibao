"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, MapPin, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { RouteMap } from "@/components/routes/route-map";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { useSignInHref } from "@/hooks/use-sign-in-href";
import { useRouter } from "@/i18n/navigation";
import { isSubmittable } from "@/lib/map/config";
import { newIdempotencyKey } from "@/lib/offline/submit";
import { orpc } from "@/lib/orpc";

/**
 * Opening a case with the ayuntamiento: what, where (optional), and the
 * detail. Only verified residents can open one, because a case carries the
 * weight of a citizen's voice; everyone else is told why and how to get there.
 */
export function OpenConsultationSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("consultations.form");
  const { isSignedIn, isCitizen } = useAuth();
  const signInHref = useSignInHref();
  const router = useRouter();
  const queryClient = useQueryClient();
  const categories = useQuery({
    ...orpc.consultations.categories.queryOptions(),
    enabled: open,
  });
  const [form, setForm] = useState({ title: "", body: "", categoryId: "" });
  const [point, setPoint] = useState<{ lng: number; lat: number } | null>(null);
  const [placing, setPlacing] = useState(false);
  const add = useCallback((next: { lng: number; lat: number }) => {
    if (isSubmittable(next)) setPoint(next);
  }, []);

  const submit = useMutation(
    orpc.consultations.open.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: ["consultations"] });
        toast.success({ title: t("sent") });
        onClose();
        router.push(`/consultas/${result.slug}`);
      },
      onError: () => toast.error({ title: t("failed") }),
    }),
  );

  const valid =
    form.title.trim().length >= 8 &&
    form.body.trim().length >= 40 &&
    Boolean(form.categoryId);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t("title")}
      description={t("description")}
      size="lg"
      footer={
        isCitizen ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button
              variant="accent"
              disabled={!valid || submit.isPending}
              onClick={() =>
                submit.mutate({
                  requestId: newIdempotencyKey(),
                  categoryId: form.categoryId,
                  title: form.title.trim(),
                  body: form.body.trim(),
                  location: point ?? undefined,
                })
              }
            >
              {submit.isPending ? t("sending") : t("submit")}
            </Button>
          </>
        ) : null
      }
    >
      {!isCitizen ? (
        <div className="rounded-card bg-paper-2 p-5">
          <BadgeCheck strokeWidth={1.5} className="size-5 text-accent" />
          <p className="mt-3 text-[15px] font-medium">
            {t("citizenOnlyTitle")}
          </p>
          <p className="t-small mt-1 text-ink-2">{t("citizenOnlyBody")}</p>
          <ButtonLink
            href={
              (isSignedIn
                ? "/verificar?next=/consultas"
                : signInHref) as "/verificar"
            }
            variant="primary"
            className="mt-4"
          >
            {isSignedIn ? t("verify") : t("signIn")}
          </ButtonLink>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field htmlFor="case-category" label={t("topic")}>
            <Select
              id="case-category"
              value={form.categoryId}
              onChange={(event) =>
                setForm({ ...form, categoryId: event.target.value })
              }
            >
              <option value="" disabled>
                {t("topicPlaceholder")}
              </option>
              {(categories.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            htmlFor="case-title"
            label={t("caseTitle")}
            hint={t("caseTitleHint")}
          >
            <Input
              id="case-title"
              value={form.title}
              maxLength={120}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </Field>
          <Field
            htmlFor="case-body"
            label={t("body")}
            hint={t("bodyHint", {
              count: Math.max(0, 40 - form.body.trim().length),
            })}
          >
            <Textarea
              id="case-body"
              value={form.body}
              maxLength={2000}
              onChange={(event) =>
                setForm({ ...form, body: event.target.value })
              }
            />
          </Field>
          <div>
            <p className="text-[14px] font-medium text-ink">
              {t("where")}{" "}
              <span className="font-normal text-ink-3">· {t("optional")}</span>
            </p>
            {placing || point ? (
              <div
                data-base-ui-swipe-ignore
                className="relative mt-2 overflow-hidden rounded-card shadow-ring"
              >
                <RouteMap
                  path={point ? [point] : []}
                  onAdd={add}
                  label={t("where")}
                  className="relative h-56"
                />
                {point ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPoint(null);
                      setPlacing(false);
                    }}
                    className="press glass absolute top-2 right-2 z-10 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[14px] text-ink"
                  >
                    <X strokeWidth={1.5} className="size-4" />
                    {t("removePoint")}
                  </button>
                ) : (
                  <span className="t-small glass absolute top-2 left-2 z-10 rounded-full px-3 py-1 text-ink-2">
                    {t("tapMap")}
                  </span>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => setPlacing(true)}
              >
                <MapPin strokeWidth={1.5} />
                {t("addPoint")}
              </Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
