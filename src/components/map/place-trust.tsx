"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CircleAlert, MapPin, ThumbsUp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Spinner } from "@/components/ui/spinner";
import { client, orpc } from "@/lib/orpc";

/**
 * How much this place can be believed, and the one question that improves it.
 *
 * A civic map fails in two directions and only one of them is loud. The obvious
 * failure is a place that was never there — moderation catches that. The quiet
 * one is a place that *was* there: the clinic moved, the colmado closed, the
 * bridge washed out, and the map keeps sending people. Only somebody walking
 * past catches that, so the map has to ask them, and it has to ask cheaply
 * enough that answering is a reflex rather than a chore.
 *
 * Hence one tap and two answers. A star rating would invite an opinion about
 * quality; this asks the only thing a passer-by can answer honestly.
 *
 * The state is a sentence, never a score. "Confirmado por 4 vecinos" is
 * something a person can act on; "fiabilidad 78%" is a number nobody can.
 */
type Trust = {
  state: "new" | "confirmed" | "doubted" | "established";
  confirmations: number;
  doubts: number;
  ageDays: number | null;
};

const TONE: Record<Trust["state"], string> = {
  new: "text-sky-700 dark:text-sky-400",
  confirmed: "text-emerald-700 dark:text-emerald-400",
  doubted: "text-amber-700 dark:text-amber-400",
  established: "text-muted-foreground",
};

const ICON: Record<Trust["state"], typeof BadgeCheck> = {
  new: MapPin,
  confirmed: BadgeCheck,
  doubted: CircleAlert,
  established: BadgeCheck,
};

export function PlaceTrust({
  placeId,
  slug,
  trust,
  myVerdict,
  isMine,
}: {
  placeId: string;
  slug: string;
  trust: Trust;
  myVerdict: "exists" | "gone" | null;
  isMine: boolean;
}) {
  const t = useTranslations("map.trust");
  const { viewer } = useAuth();
  const queryClient = useQueryClient();

  const confirm = useMutation({
    mutationFn: (verdict: "exists" | "gone") =>
      client.places.confirm({ placeId, verdict }),
    onSuccess: async (_result, verdict) => {
      toast.success(verdict === "exists" ? t("thanks") : t("thanksGone"));
      await queryClient.invalidateQueries({
        queryKey: orpc.places.detail.queryOptions({ input: { slug } }).queryKey,
      });
    },
    onError: () => toast.error(t("failed")),
  });

  const Icon = ICON[trust.state];
  const signedIn = viewer !== undefined && viewer.kind !== "anonymous";
  // Nobody is asked about their own submission, and nobody is asked twice.
  const canAnswer = signedIn && !isMine && myVerdict === null;

  const summary =
    trust.state === "confirmed"
      ? t("confirmed", { count: trust.confirmations })
      : trust.state === "doubted"
        ? t("doubted", { count: trust.doubts })
        : trust.state === "new"
          ? t("new")
          : trust.ageDays !== null
            ? t("established", { days: trust.ageDays })
            : t("unknown");

  return (
    // No box. The sheet is already a surface and the buttons already carry an
    // outline, so a tinted card around them was a third one — grey inside grey
    // inside a floating panel. The state's own colour is the signal here; the
    // sheet separates its blocks with a hairline instead.
    <div className="flex flex-col gap-3">
      <Marker className={TONE[trust.state]}>
        <MarkerIcon>
          <Icon />
        </MarkerIcon>
        <MarkerContent className="font-medium">{summary}</MarkerContent>
      </Marker>

      {myVerdict !== null && (
        <p className="text-muted-foreground text-xs leading-relaxed">
          {myVerdict === "exists" ? t("youConfirmed") : t("youSaidGone")}
        </p>
      )}

      {canAnswer && (
        <>
          <p className="text-[13px] leading-snug">{t("question")}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-10 flex-1"
              disabled={confirm.isPending}
              onClick={() => confirm.mutate("exists")}
            >
              {confirm.isPending && confirm.variables === "exists" ? (
                <Spinner className="size-4" />
              ) : (
                <ThumbsUp className="size-4" aria-hidden />
              )}
              {t("yes")}
            </Button>
            <Button
              variant="outline"
              className="h-10 flex-1"
              disabled={confirm.isPending}
              onClick={() => confirm.mutate("gone")}
            >
              {confirm.isPending && confirm.variables === "gone" ? (
                <Spinner className="size-4" />
              ) : (
                <X className="size-4" aria-hidden />
              )}
              {t("no")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
