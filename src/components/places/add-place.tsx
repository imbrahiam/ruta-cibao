"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { useMapContext } from "@/components/map/map-core";
import { type PickCenter, PickFrame } from "@/components/map/pick-frame";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { useBoundaries } from "@/hooks/use-boundaries";
import { errorReason } from "@/lib/errors";
import { municipalityAt } from "@/lib/map/boundaries";
import { distanceMetres } from "@/lib/map/road-geometry";
import { newIdempotencyKey, sendOrQueue } from "@/lib/offline/submit";
import { client, orpc } from "@/lib/orpc";

/**
 * Putting a place on the map: drop the pin, then say what it is. It goes to
 * the municipality for review before anyone else sees it, and the copy says
 * so before the person starts typing rather than after.
 */
export function AddPlace({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("addPlace");
  const { map } = useMapContext();
  const { viewer, isCitizen } = useAuth();
  const { data: boundaries } = useBoundaries();
  const queryClient = useQueryClient();
  const categories = useQuery(orpc.places.categories.queryOptions());
  const [center, setCenter] = useState<PickCenter | null>(null);
  const [step, setStep] = useState<"pick" | "details">("pick");
  const [locating, setLocating] = useState(false);
  const gpsFix = useRef<{ lng: number; lat: number } | null>(null);
  const [form, setForm] = useState({
    name: "",
    categoryId: "",
    description: "",
    address: "",
    contactPhone: "",
    whatsapp: "",
    openingHours: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const where = center ? municipalityAt(center, boundaries) : null;
  const category = categories.data?.find((item) => item.id === form.categoryId);
  const isBusiness = category?.kind === "business";
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const useMyLocation = () => {
    if (!window.isSecureContext || !("geolocation" in navigator)) {
      toast.error({ title: t("gpsUnavailable") });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        gpsFix.current = {
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        };
        map?.easeTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 17,
          duration: 600,
        });
      },
      () => {
        setLocating(false);
        toast.error({ title: t("gpsFailed") });
      },
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  };

  const submit = async () => {
    if (!center || !viewer?.userId) return;
    setBusy(true);
    setError(null);
    const fromGps =
      isCitizen &&
      gpsFix.current !== null &&
      distanceMetres(gpsFix.current, center) < 5;
    const requestId = newIdempotencyKey();
    const input = {
      requestId,
      name: form.name.trim(),
      description: form.description.trim(),
      address: form.address.trim() || undefined,
      categoryId: form.categoryId,
      location: { lng: center.lng, lat: center.lat },
      locationSource: fromGps ? ("gps" as const) : ("map" as const),
      business: isBusiness
        ? {
            contactPhone: form.contactPhone,
            whatsapp: form.whatsapp,
            openingHours: form.openingHours,
          }
        : undefined,
    };
    try {
      const outcome = await sendOrQueue({
        procedure: "places.submit",
        input,
        userId: viewer.userId,
        idempotencyKey: requestId,
        labelKey: "pending.labels.place",
        send: () => client.places.submit(input),
      });
      toast.success({
        title: outcome.queued ? t("queued") : t("sent"),
        description: outcome.queued ? undefined : t("sentHint"),
      });
      await queryClient.invalidateQueries({
        queryKey: orpc.places.contributions.key(),
      });
      onDone();
    } catch (caught) {
      const reason = errorReason(caught);
      setError(t(`errors.${reason ?? "unknown"}` as "errors.unknown"));
    } finally {
      setBusy(false);
    }
  };

  const valid =
    form.name.trim().length >= 3 &&
    form.description.trim().length >= 20 &&
    Boolean(form.categoryId);

  return (
    <>
      <PickFrame
        onCenter={setCenter}
        card={
          <div>
            <p className="t-label text-ink-3">{t("eyebrow")}</p>
            <p
              className="mt-1.5 text-[17px] leading-snug font-medium tracking-[-0.012em] text-ink"
              aria-live="polite"
            >
              {where?.state === "outside"
                ? t("outside")
                : where?.state === "inside"
                  ? t("inside", { municipality: where.municipality.name })
                  : t("move")}
            </p>
            <p className="t-small mt-0.5 text-ink-2">{t("pickHint")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={useMyLocation}
                disabled={locating}
              >
                <LocateFixed strokeWidth={1.5} />
                {locating ? t("locating") : t("here")}
              </Button>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={onCancel}>
                {t("cancel")}
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={!center || where?.state === "outside"}
                onClick={() => setStep("details")}
              >
                {t("continue")}
              </Button>
            </div>
          </div>
        }
      />
      <Sheet
        open={step === "details"}
        onOpenChange={(open) => !open && setStep("pick")}
        title={t("detailsTitle")}
        description={t("reviewNote")}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStep("pick")}>
              {t("back")}
            </Button>
            <Button variant="accent" disabled={!valid || busy} onClick={submit}>
              {busy ? t("sending") : t("submit")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field htmlFor="place-name" label={t("name")} hint={t("nameHint")}>
            <Input
              id="place-name"
              value={form.name}
              maxLength={100}
              onChange={(event) => set("name")(event.target.value)}
            />
          </Field>
          <Field htmlFor="place-category" label={t("category")}>
            <Select
              id="place-category"
              value={form.categoryId}
              onChange={(event) => set("categoryId")(event.target.value)}
            >
              <option value="" disabled>
                {t("categoryPlaceholder")}
              </option>
              {(["place", "business"] as const).map((kind) => (
                <optgroup key={kind} label={t(`kinds.${kind}`)}>
                  {(categories.data ?? [])
                    .filter((item) => item.kind === kind)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field
            htmlFor="place-description"
            label={t("description")}
            hint={t("descriptionHint", {
              count: Math.max(0, 20 - form.description.trim().length),
            })}
          >
            <Textarea
              id="place-description"
              value={form.description}
              maxLength={600}
              onChange={(event) => set("description")(event.target.value)}
            />
          </Field>
          <Field
            htmlFor="place-address"
            label={t("address")}
            optional={t("optional")}
          >
            <Input
              id="place-address"
              value={form.address}
              maxLength={240}
              onChange={(event) => set("address")(event.target.value)}
            />
          </Field>
          {isBusiness ? (
            <fieldset className="flex flex-col gap-4 rounded-card bg-paper-2 p-4">
              <legend className="t-label float-left mb-1 text-ink-3">
                {t("businessLegend")}
              </legend>
              <Field
                htmlFor="place-phone"
                label={t("phone")}
                optional={t("optional")}
              >
                <Input
                  id="place-phone"
                  type="tel"
                  inputMode="tel"
                  value={form.contactPhone}
                  onChange={(event) => set("contactPhone")(event.target.value)}
                />
              </Field>
              <Field
                htmlFor="place-whatsapp"
                label={t("whatsapp")}
                optional={t("optional")}
              >
                <Input
                  id="place-whatsapp"
                  type="tel"
                  inputMode="tel"
                  value={form.whatsapp}
                  onChange={(event) => set("whatsapp")(event.target.value)}
                />
              </Field>
              <Field
                htmlFor="place-hours"
                label={t("hours")}
                optional={t("optional")}
              >
                <Input
                  id="place-hours"
                  value={form.openingHours}
                  maxLength={240}
                  onChange={(event) => set("openingHours")(event.target.value)}
                />
              </Field>
            </fieldset>
          ) : null}
          {error ? (
            <p role="alert" className="t-small text-danger-ink">
              {error}
            </p>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
