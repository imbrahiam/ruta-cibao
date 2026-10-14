"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Clock,
  MessageCircle,
  Phone,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSignInHref } from "@/hooks/use-sign-in-href";
import { Link } from "@/i18n/navigation";
import { newIdempotencyKey } from "@/lib/offline/queue";
import { client, orpc } from "@/lib/orpc";
import { uuid } from "@/lib/uuid";
import { updateBusinessInput } from "@/modules/businesses/contracts";

/**
 * Who runs this business, and how to reach them.
 *
 * Only rendered for a place whose category is a business, and it says nothing
 * at all until there is something to say — a river does not get an empty
 * "sin dueño" row, and neither does an unclaimed colmado for a reader who is
 * not signed in.
 *
 * The contact details shown here are only ever an *approved* claim's. A pending
 * one is a request, and printing its phone number on the map would make the
 * review pointless.
 */
function errorReason(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("data" in error)) return;
  const data = error.data;
  if (!data || typeof data !== "object" || !("reason" in data)) return;
  return typeof data.reason === "string" ? data.reason : undefined;
}

export function BusinessPanel({
  placeId,
  placeName,
}: {
  placeId: string;
  placeName: string;
}) {
  const t = useTranslations("business");
  const formCopy = useTranslations("business.form");
  const signInHref = useSignInHref();
  const queryClient = useQueryClient();
  const { viewer } = useAuth();
  // The same breakpoint the place drawer reads, so a sheet stacked on top of
  // it slides the way the one underneath did.
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [claiming, setClaiming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery(
    orpc.businesses.claimState.queryOptions({ input: { placeId } }),
  );

  const claim = useMutation({
    mutationFn: (input: {
      evidence: string;
      contactPhone?: string;
      whatsapp?: string;
      openingHours?: string;
    }) =>
      client.businesses.claim({
        requestId: newIdempotencyKey(),
        placeId,
        ...input,
      }),
    onSuccess: async () => {
      toast.success(formCopy("sent"));
      setClaiming(false);
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: orpc.businesses.claimState.key(),
      });
    },
    onError: (caught) => {
      const reason = errorReason(caught);
      setError(
        reason === "already_claimed"
          ? formCopy("alreadyClaimed")
          : reason === "already_pending"
            ? formCopy("alreadyPending")
            : reason === "not_a_business"
              ? formCopy("notABusiness")
              : formCopy("failed"),
      );
    },
  });
  const update = useMutation({
    ...orpc.businesses.update.mutationOptions(),
    onSuccess: async () => {
      setEditing(false);
      toast.success(formCopy("updated"));
      await queryClient.invalidateQueries({
        queryKey: orpc.businesses.claimState.key(),
      });
    },
    onError: () => toast.error(formCopy("failed")),
  });

  if (!data?.claimable) return null;

  const isCitizen = viewer?.kind === "citizen";
  const anonymous = !viewer || viewer.kind === "anonymous";

  /**
   * What there is to say about who runs this place.
   *
   * Null when the answer is only an offer to claim it, because that offer is a
   * button and a button needs nothing around it. Wrapping one control in a
   * bordered, tinted box put three surfaces between the map and a single tap —
   * the sheet, the box, and the button's own outline — for no information at
   * all.
   */
  const ownership =
    data.claimed || data.contactPhone || data.whatsapp || data.openingHours ? (
      <div className="flex flex-col gap-3">
        {data.claimed && (
          <Badge className="w-fit border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <BadgeCheck className="size-3.5" aria-hidden />
            {data.mine ? t("mine") : t("claimed")}
          </Badge>
        )}

        {/* Details are optional even on an approved claim: a business may simply
          not want a phone number on the map. */}
        {(data.contactPhone || data.whatsapp || data.openingHours) && (
          <dl className="flex flex-col gap-2 text-sm">
            {data.contactPhone && (
              <div className="flex items-center gap-2.5">
                <Phone
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <dt className="sr-only">{t("phone")}</dt>
                <dd>
                  {/* A phone number on a phone is a link. */}
                  <a
                    href={`tel:${data.contactPhone.replace(/\D/g, "")}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {data.contactPhone}
                  </a>
                </dd>
              </div>
            )}
            {data.whatsapp && (
              <div className="flex items-center gap-2.5">
                <MessageCircle
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <dt className="sr-only">{t("whatsapp")}</dt>
                <dd>
                  <a
                    className="underline underline-offset-4"
                    href={`https://wa.me/1${data.whatsapp.replace(/\D/g, "").slice(-10)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {data.whatsapp}
                  </a>
                </dd>
              </div>
            )}
            {data.openingHours && (
              <div className="flex items-center gap-2.5">
                <Clock
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <dt className="sr-only">{t("hours")}</dt>
                <dd className="text-pretty">{data.openingHours}</dd>
              </div>
            )}
          </dl>
        )}

        {data.claimed && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t("claimedHint")}
          </p>
        )}
        {data.mine && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            {formCopy("edit")}
          </Button>
        )}
        {!data.claimed &&
          !data.pending &&
          (isCitizen ? (
            <Button variant="outline" onClick={() => setClaiming(true)}>
              {t("claim")}
            </Button>
          ) : (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={anonymous ? signInHref : "/verificar"} />}
            >
              {t("claim")}
            </Button>
          ))}
      </div>
    ) : data.pending ? (
      <div className="flex items-start gap-2.5" role="status">
        <Clock
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="space-y-1">
          <p className="font-medium text-sm">{t("pending")}</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t("pendingHint")}
          </p>
        </div>
      </div>
    ) : anonymous ? (
      <Button
        variant="outline"
        className="h-11 w-full"
        nativeButton={false}
        render={<Link href={signInHref} />}
      >
        <Store className="size-4" aria-hidden />
        {t("claim")}
      </Button>
    ) : isCitizen ? (
      <Button
        variant="outline"
        className="h-11 w-full"
        onClick={() => setClaiming(true)}
      >
        <Store className="size-4" aria-hidden />
        {t("claim")}
      </Button>
    ) : (
      <div className="flex flex-col gap-2.5">
        <p className="text-muted-foreground text-xs leading-relaxed">
          {formCopy("needsCedulaHint")}
        </p>
        <Button
          variant="outline"
          className="h-11 w-full"
          nativeButton={false}
          render={<Link href="/verificar" />}
        >
          <ShieldCheck className="size-4" aria-hidden />
          {formCopy("verify")}
        </Button>
      </div>
    );

  return (
    <>
      {/* A wrapper with no look of its own: the sheet spaces and separates its
          blocks through its direct children, and one of the branches above is a
          bare button that must keep its own height rather than inherit a
          block's padding. */}
      <section>{ownership}</section>
      <Drawer
        open={editing}
        onOpenChange={setEditing}
        swipeDirection={isDesktop ? "right" : "down"}
        showSwipeHandle={!isDesktop}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-lg">{formCopy("edit")}</DrawerTitle>
            <DrawerDescription>{formCopy("editHint")}</DrawerDescription>
          </DrawerHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const input = updateBusinessInput.safeParse({
                requestId: uuid(),
                placeId,
                contactPhone: form.get("contactPhone"),
                whatsapp: form.get("whatsapp"),
                openingHours: form.get("openingHours"),
              });
              if (!input.success) {
                toast.error(formCopy("invalidPhone"));
                return;
              }
              update.mutate(input.data);
            }}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-1">
              {(["contactPhone", "whatsapp", "openingHours"] as const).map(
                (field) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={`edit-business-${field}`}>
                      {formCopy(field)}
                    </Label>
                    <Input
                      id={`edit-business-${field}`}
                      name={field}
                      type={field === "openingHours" ? "text" : "tel"}
                      defaultValue={data[field] ?? ""}
                      maxLength={field === "openingHours" ? 240 : 24}
                    />
                  </div>
                ),
              )}
            </div>
            <DrawerFooter>
              <Button type="submit" disabled={update.isPending}>
                {formCopy("save")}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      {/* A sheet stacked on the place drawer rather than a dialog over it.
          Claiming is a step deeper into the place you already have open, not a
          detour away from it: Base UI stacks the two, scaling the one
          underneath back so it stays visible as the thing you came from, and
          closing this one returns you to it. */}
      <Drawer
        open={claiming}
        onOpenChange={setClaiming}
        swipeDirection={isDesktop ? "right" : "down"}
        showSwipeHandle={!isDesktop}
      >
        <DrawerContent>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setError(null);
              claim.mutate({
                evidence: String(form.get("evidence") ?? ""),
                contactPhone: String(form.get("phone") ?? "") || undefined,
                whatsapp: String(form.get("whatsapp") ?? "") || undefined,
                openingHours: String(form.get("hours") ?? "") || undefined,
              });
            }}
          >
            <DrawerHeader>
              <DrawerTitle className="text-lg">{formCopy("title")}</DrawerTitle>
              <DrawerDescription className="text-pretty leading-relaxed">
                {formCopy("description", { name: placeName })}
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-1">
              <div className="space-y-2">
                <Label htmlFor="claim-evidence">{formCopy("evidence")}</Label>
                <Textarea
                  id="claim-evidence"
                  name="evidence"
                  rows={4}
                  placeholder={formCopy("evidencePlaceholder")}
                  minLength={20}
                  maxLength={600}
                  required
                />
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {formCopy("evidenceHint")}
                </p>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="claim-phone">{formCopy("phone")}</Label>
                  <Input
                    id="claim-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder={formCopy("phonePlaceholder")}
                    maxLength={24}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="claim-whatsapp">{formCopy("whatsapp")}</Label>
                  <Input
                    id="claim-whatsapp"
                    name="whatsapp"
                    type="tel"
                    inputMode="tel"
                    placeholder={formCopy("phonePlaceholder")}
                    maxLength={24}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="claim-hours">{formCopy("hours")}</Label>
                <Input
                  id="claim-hours"
                  name="hours"
                  placeholder={formCopy("hoursPlaceholder")}
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
            </div>

            <DrawerFooter className="flex-row gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-11 flex-1"
                onClick={() => setClaiming(false)}
              >
                {formCopy("cancel")}
              </Button>
              <Button
                type="submit"
                className="h-11 flex-1"
                disabled={claim.isPending}
              >
                {claim.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  <Store className="size-4" aria-hidden />
                )}
                {claim.isPending ? formCopy("sending") : formCopy("submit")}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
