"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, LocateFixed, MapPinPlus, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useBoundaries } from "@/hooks/use-boundaries";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSignInHref } from "@/hooks/use-sign-in-href";
import { Link } from "@/i18n/navigation";
import { markInstallMoment } from "@/lib/install-moment";
import { municipalityAt } from "@/lib/map/boundaries";
import { enqueue, newIdempotencyKey } from "@/lib/offline/queue";
import { client, orpc } from "@/lib/orpc";

/** Where the new place goes, and how that coordinate was arrived at. */
type NewPlace = { lng: number; lat: number; source: "map" | "gps" };

function errorReason(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("data" in error)) return;
  const data = error.data;
  if (!data || typeof data !== "object" || !("reason" in data)) return;
  return typeof data.reason === "string" ? data.reason : undefined;
}

export function AddPlaceDrawer({
  place,
  onClose,
  onPickAgain,
}: {
  place: NewPlace | null;
  onClose: () => void;
  onPickAgain: () => void;
}) {
  const t = useTranslations("map.addPlace");
  const businessCopy = useTranslations("business.form");
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const signInHref = useSignInHref();
  const { data: categories = [] } = useQuery(
    orpc.places.categories.queryOptions(),
  );
  const { data: boundaries } = useBoundaries();
  const {
    viewer,
    isLoading: isLoadingViewer,
    isUnavailable: isViewerUnavailable,
  } = useAuth();

  const [categoryId, setCategoryId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A point determines its municipality, so this is read rather than asked.
  // The old version guessed by nearest municipal centre — which is wrong for
  // every border community, and exactly the guess the boundaries removed.
  const municipality = place
    ? municipalityAt(place, boundaries).municipality
    : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!place || !categoryId || !viewer?.userId) {
      setError(t("validation.required"));
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const requestId = newIdempotencyKey();
    const input = {
      requestId,
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      address: String(form.get("address") ?? "") || undefined,
      categoryId,
      location: { lng: place.lng, lat: place.lat },
      locationSource: place.source,
      business:
        categories.find((category) => category.id === categoryId)?.kind ===
        "business"
          ? {
              contactPhone: String(form.get("contactPhone") ?? ""),
              whatsapp: String(form.get("whatsapp") ?? ""),
              openingHours: String(form.get("openingHours") ?? ""),
            }
          : undefined,
    };

    setSubmitting(true);
    setError(null);

    try {
      if (!navigator.onLine) {
        await enqueue({
          procedure: "places.submit",
          userId: viewer.userId,
          input,
          idempotencyKey: requestId,
          labelKey: "map.addPlace.queued",
        });
        toast.success(t("queued"));
        markInstallMoment();
      } else {
        await client.places.submit(input);
        toast.success(t("sent"));
        markInstallMoment();
      }
      formElement.reset();
      setCategoryId("");
      onClose();
    } catch (caught) {
      const reason = errorReason(caught);
      setError(
        reason === "duplicate"
          ? t("validation.duplicate")
          : reason === "verification_required"
            ? t("validation.verificationRequired")
            : reason === "outside_province"
              ? t("outsideProvince")
              : t("failed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={place !== null}
      onOpenChange={(open) => !open && onClose()}
      showSwipeHandle={!isDesktop}
      swipeDirection={isDesktop ? "right" : "down"}
    >
      <DrawerContent>
        <DrawerHeader className="border-b">
          <div className="flex items-start gap-3 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPinPlus className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <DrawerTitle className="text-lg">{t("title")}</DrawerTitle>
              <DrawerDescription className="text-pretty leading-relaxed">
                {t("description")}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {isLoadingViewer ? (
            <p
              className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground text-sm"
              role="status"
            >
              <Spinner className="size-4" /> {t("checkingAccount")}
            </p>
          ) : isViewerUnavailable ? (
            <p
              className="rounded-xl border bg-muted/40 p-5 text-center text-muted-foreground text-sm leading-relaxed"
              role="status"
            >
              {t("accountUnavailable")}
            </p>
          ) : viewer?.kind === "anonymous" ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border bg-muted/40 p-6 text-center">
              <LocateFixed
                className="size-7 text-muted-foreground"
                aria-hidden
              />
              <div className="space-y-1">
                <p className="font-medium">{t("signInTitle")}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t("signInDescription")}
                </p>
              </div>
              <Button
                className="h-11 w-full"
                nativeButton={false}
                render={<Link href={signInHref} />}
              >
                {t("signIn")}
              </Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {categories.find((category) => category.id === categoryId)
                ?.kind === "business" && (
                <fieldset className="space-y-3 rounded-xl border p-4">
                  <legend className="px-1 text-sm font-medium">
                    {businessCopy("publicDetails")}
                  </legend>
                  {(["contactPhone", "whatsapp", "openingHours"] as const).map(
                    (field) => (
                      <div key={field} className="space-y-2">
                        <Label htmlFor={`new-business-${field}`}>
                          {businessCopy(field)}
                        </Label>
                        <Input
                          id={`new-business-${field}`}
                          name={field}
                          type={field === "openingHours" ? "text" : "tel"}
                          maxLength={field === "openingHours" ? 240 : 24}
                        />
                      </div>
                    ),
                  )}
                </fieldset>
              )}
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/35 px-3 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <CheckCircle2
                    className="size-5 shrink-0 text-emerald-600"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      {place?.source === "gps"
                        ? t("pointFromGps")
                        : t("pointSelected")}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">
                      {municipality?.name ?? t("municipalityUnknown")} ·{" "}
                      <span className="font-mono">
                        {place?.lat.toFixed(5)}, {place?.lng.toFixed(5)}
                      </span>
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onPickAgain}
                >
                  <RotateCcw aria-hidden />
                  {t("changePoint")}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="place-name">{t("name")}</Label>
                <Input
                  id="place-name"
                  name="name"
                  placeholder={t("namePlaceholder")}
                  minLength={3}
                  maxLength={100}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="place-category">{t("category")}</Label>
                <NativeSelect
                  id="place-category"
                  size="lg"
                  className="w-full"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  required
                >
                  <NativeSelectOption value="">
                    {t("categoryPlaceholder")}
                  </NativeSelectOption>
                  {categories.map((category) => (
                    <NativeSelectOption key={category.id} value={category.id}>
                      {category.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label htmlFor="place-description">{t("details")}</Label>
                <Textarea
                  id="place-description"
                  name="description"
                  placeholder={t("detailsPlaceholder")}
                  minLength={20}
                  maxLength={600}
                  required
                />
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t("detailsHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="place-address">{t("address")}</Label>
                <Input
                  id="place-address"
                  name="address"
                  placeholder={t("addressPlaceholder")}
                  maxLength={240}
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="h-12 w-full text-base"
                disabled={submitting}
              >
                {submitting ? (
                  <Spinner className="size-5" />
                ) : (
                  <MapPinPlus className="size-5" aria-hidden />
                )}
                {submitting ? t("sending") : t("submit")}
              </Button>

              <p className="text-center text-muted-foreground text-xs leading-relaxed">
                {t("moderationHint")}
              </p>
            </form>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
